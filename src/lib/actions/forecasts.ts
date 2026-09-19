"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { addMonths, computeCardDueDate } from "@/lib/format";
import type { ActionResult } from "@/lib/actions/transactions";
import type { ExpenseKind, PurchasePaymentType, TransactionType } from "@/lib/types/database";

function parseAmount(raw: FormDataEntryValue | null): number {
  const value = Number(String(raw ?? "").replace(",", "."));
  return Number.isFinite(value) ? value : NaN;
}

async function resolveCardDate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  paymentMethodId: string | null,
  date: string
): Promise<string> {
  if (!paymentMethodId) return date;
  const { data: method } = await supabase
    .from("payment_methods")
    .select("kind, closing_day, due_day")
    .eq("id", paymentMethodId)
    .single();
  if (method?.kind === "cartao" && method.closing_day && method.due_day) {
    return computeCardDueDate(date, method.closing_day, method.due_day);
  }
  return date;
}

export async function createForecast(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada. Faça login novamente." };

  const type = String(formData.get("type") ?? "") as TransactionType;
  const description = String(formData.get("description") ?? "").trim();
  const amount = parseAmount(formData.get("amount"));
  const dataPrevista = String(formData.get("data_prevista") ?? "");
  const categoryId = String(formData.get("category_id") ?? "") || null;
  const subcategoryId = String(formData.get("subcategory_id") ?? "") || null;
  const paymentMethodId = String(formData.get("payment_method_id") ?? "") || null;
  const repeatRaw = String(formData.get("meses_repeticao") ?? "");
  const mesesRepeticao = repeatRaw ? Number(repeatRaw) : null;

  if (!description || !amount || amount <= 0 || !dataPrevista) {
    return { error: "Preencha descrição, valor (maior que zero) e data prevista." };
  }
  if (mesesRepeticao !== null && (!Number.isInteger(mesesRepeticao) || mesesRepeticao < 1 || mesesRepeticao > 360)) {
    return { error: "Número de meses de repetição inválido." };
  }

  const occurrences = mesesRepeticao ?? 1;
  const groupId = occurrences > 1 ? crypto.randomUUID() : null;

  const rows = Array.from({ length: occurrences }, (_, i) => ({
    user_id: user.id,
    group_id: groupId,
    type,
    description,
    amount,
    category_id: categoryId,
    subcategory_id: subcategoryId,
    payment_method_id: paymentMethodId,
    data_prevista: addMonths(dataPrevista, i),
    meses_repeticao: mesesRepeticao,
  }));

  const { error } = await supabase.from("forecasts").insert(rows);
  if (error) return { error: "Não foi possível criar a previsão." };

  revalidatePath("/dashboard/transacoes");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateForecast(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada. Faça login novamente." };

  const id = String(formData.get("id") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const amount = parseAmount(formData.get("amount"));
  const dataPrevista = String(formData.get("data_prevista") ?? "");
  const categoryId = String(formData.get("category_id") ?? "") || null;
  const subcategoryId = String(formData.get("subcategory_id") ?? "") || null;
  const paymentMethodId = String(formData.get("payment_method_id") ?? "") || null;

  if (!id || !description || !amount || amount <= 0 || !dataPrevista) {
    return { error: "Preencha descrição, valor (maior que zero) e data prevista." };
  }

  const { data: existing } = await supabase
    .from("forecasts")
    .select("status")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!existing) return { error: "Previsão não encontrada." };
  if (existing.status === "convertida") {
    return { error: "Essa previsão já foi convertida e não pode mais ser editada." };
  }

  const { error } = await supabase
    .from("forecasts")
    .update({
      description,
      amount,
      data_prevista: dataPrevista,
      category_id: categoryId,
      subcategory_id: subcategoryId,
      payment_method_id: paymentMethodId,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: "Não foi possível atualizar a previsão." };

  revalidatePath("/dashboard/transacoes");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteForecast(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada." };

  const { error } = await supabase.from("forecasts").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { error: "Não foi possível excluir a previsão." };

  revalidatePath("/dashboard/transacoes");
  revalidatePath("/dashboard");
  return { success: true };
}

/**
 * Edita todas as ocorrências de uma previsão repetida (mesmo group_id) de
 * uma vez, exceto as que já foram convertidas (essas ficam de fora, como no
 * ajuste individual). A data prevista de cada ocorrência não muda — só os
 * demais campos são replicados para a série toda.
 */
export async function updateForecastGroup(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada. Faça login novamente." };

  const groupId = String(formData.get("group_id") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const amount = parseAmount(formData.get("amount"));
  const categoryId = String(formData.get("category_id") ?? "") || null;
  const subcategoryId = String(formData.get("subcategory_id") ?? "") || null;
  const paymentMethodId = String(formData.get("payment_method_id") ?? "") || null;

  if (!groupId || !description || !amount || amount <= 0) {
    return { error: "Preencha descrição e valor (maior que zero)." };
  }

  const { error } = await supabase
    .from("forecasts")
    .update({
      description,
      amount,
      category_id: categoryId,
      subcategory_id: subcategoryId,
      payment_method_id: paymentMethodId,
    })
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .neq("status", "convertida");

  if (error) return { error: "Não foi possível atualizar as previsões da série." };

  revalidatePath("/dashboard/transacoes");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteForecastGroup(groupId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada." };

  const { error } = await supabase.from("forecasts").delete().eq("group_id", groupId).eq("user_id", user.id);
  if (error) return { error: "Não foi possível excluir as previsões da série." };

  revalidatePath("/dashboard/transacoes");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function convertForecastToTransaction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada. Faça login novamente." };

  const forecastId = String(formData.get("forecast_id") ?? "");
  const { data: forecast } = await supabase
    .from("forecasts")
    .select("*")
    .eq("id", forecastId)
    .eq("user_id", user.id)
    .single();
  if (!forecast) return { error: "Previsão não encontrada." };
  if (forecast.status === "convertida") return { error: "Essa previsão já foi convertida." };

  const description = String(formData.get("description") ?? "").trim();
  const amount = parseAmount(formData.get("amount"));
  const date = String(formData.get("date") ?? "");
  const categoryId = String(formData.get("category_id") ?? "") || null;
  const subcategoryId = String(formData.get("subcategory_id") ?? "") || null;
  const paymentMethodId = String(formData.get("payment_method_id") ?? "") || null;
  const expenseKind = (String(formData.get("expense_kind") ?? "") || null) as ExpenseKind | null;

  if (!description || !amount || amount <= 0 || !date) {
    return { error: "Preencha descrição, valor (maior que zero) e data." };
  }

  const resolvedDate =
    forecast.type === "despesa" ? await resolveCardDate(supabase, paymentMethodId, date) : date;

  const { data: transaction, error } = await supabase
    .from("transactions")
    .insert({
      user_id: user.id,
      type: forecast.type,
      description,
      amount,
      date: resolvedDate,
      category_id: categoryId,
      subcategory_id: subcategoryId,
      expense_kind: forecast.type === "despesa" ? expenseKind ?? "variavel" : null,
      payment_method_id: paymentMethodId,
    })
    .select()
    .single();

  if (error || !transaction) return { error: "Não foi possível criar a transação." };

  const { error: updateError } = await supabase
    .from("forecasts")
    .update({ status: "convertida", transaction_id: transaction.id })
    .eq("id", forecastId)
    .eq("user_id", user.id);
  if (updateError) return { error: "Transação criada, mas não foi possível atualizar a previsão." };

  revalidatePath("/dashboard/transacoes");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function convertForecastToPurchase(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada. Faça login novamente." };

  const forecastId = String(formData.get("forecast_id") ?? "");
  const { data: forecast } = await supabase
    .from("forecasts")
    .select("*")
    .eq("id", forecastId)
    .eq("user_id", user.id)
    .single();
  if (!forecast) return { error: "Previsão não encontrada." };
  if (forecast.status === "convertida") return { error: "Essa previsão já foi convertida." };
  if (forecast.type !== "despesa") {
    return { error: "Só é possível converter previsões de despesa em compra parcelada." };
  }

  const description = String(formData.get("description") ?? "").trim();
  const totalAmount = parseAmount(formData.get("total_amount"));
  const installmentsTotal = Number(formData.get("installments_total"));
  const startingInstallment = Number(formData.get("starting_installment") ?? 1) || 1;
  const paymentMethod = String(formData.get("payment_method") ?? "cartao") as PurchasePaymentType;
  const paymentMethodId = String(formData.get("payment_method_id") ?? "") || null;
  const firstDueDate = String(formData.get("first_due_date") ?? "");
  const categoryId = String(formData.get("category_id") ?? "") || null;
  const subcategoryId = String(formData.get("subcategory_id") ?? "") || null;

  if (!description || !totalAmount || totalAmount <= 0 || !firstDueDate) {
    return { error: "Preencha descrição, valor total (maior que zero) e a data da parcela inicial." };
  }
  if (!Number.isInteger(installmentsTotal) || installmentsTotal < 1 || installmentsTotal > 120) {
    return { error: "Número de parcelas inválido (use entre 1 e 120)." };
  }
  if (!Number.isInteger(startingInstallment) || startingInstallment < 1 || startingInstallment > installmentsTotal) {
    return { error: "A parcela inicial deve estar entre 1 e o número total de parcelas." };
  }

  const resolvedFirstDueDate =
    paymentMethod === "cartao" ? await resolveCardDate(supabase, paymentMethodId, firstDueDate) : firstDueDate;

  const { data: purchase, error: purchaseError } = await supabase
    .from("purchases")
    .insert({
      user_id: user.id,
      description,
      category_id: categoryId,
      subcategory_id: subcategoryId,
      total_amount: totalAmount,
      installments_total: installmentsTotal,
      starting_installment: startingInstallment,
      payment_method: paymentMethod,
      payment_method_id: paymentMethodId,
      first_due_date: resolvedFirstDueDate,
    })
    .select()
    .single();
  if (purchaseError || !purchase) return { error: "Não foi possível criar a compra parcelada." };

  const installmentAmount = Math.round((totalAmount / installmentsTotal) * 100) / 100;
  const remainder = Math.round((totalAmount - installmentAmount * installmentsTotal) * 100) / 100;
  const occurrences = installmentsTotal - startingInstallment + 1;

  const rows = Array.from({ length: occurrences }, (_, i) => {
    const installmentNumber = startingInstallment + i;
    return {
      user_id: user.id,
      type: "despesa" as const,
      description: `${description} (${installmentNumber}/${installmentsTotal})`,
      amount: installmentNumber === installmentsTotal ? installmentAmount + remainder : installmentAmount,
      date: addMonths(resolvedFirstDueDate, i),
      category_id: categoryId,
      subcategory_id: subcategoryId,
      expense_kind: paymentMethod === "cartao" ? ("parcelada_cartao" as const) : ("parcelada_boleto" as const),
      purchase_id: purchase.id,
      installment_number: installmentNumber,
      installments_total: installmentsTotal,
      payment_method_id: paymentMethodId,
    };
  });

  const { error: installmentsError } = await supabase.from("transactions").insert(rows);
  if (installmentsError) {
    await supabase.from("purchases").delete().eq("id", purchase.id);
    return { error: "Não foi possível gerar as parcelas." };
  }

  const { error: updateError } = await supabase
    .from("forecasts")
    .update({ status: "convertida", purchase_id: purchase.id })
    .eq("id", forecastId)
    .eq("user_id", user.id);
  if (updateError) return { error: "Parcelamento criado, mas não foi possível atualizar a previsão." };

  revalidatePath("/dashboard/transacoes");
  revalidatePath("/dashboard/parcelamentos");
  revalidatePath("/dashboard");
  return { success: true };
}
