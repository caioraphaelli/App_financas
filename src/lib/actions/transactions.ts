"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { addMonths, computeCardDueDate } from "@/lib/format";
import type { ExpenseKind, PurchasePaymentType, RecurringPeriodType, TransactionType } from "@/lib/types/database";

export interface ActionResult {
  error?: string;
  success?: boolean;
}

// Para uma série "indeterminada" (sem data de término) geramos um horizonte
// prático de transações futuras, já que não há como criar linhas "infinitas".
const OPEN_ENDED_HORIZON_MONTHS = 36;

function parseAmount(raw: FormDataEntryValue | null): number {
  const value = Number(String(raw ?? "").replace(",", "."));
  return Number.isFinite(value) ? value : NaN;
}

/**
 * Quando a forma de pagamento é um cartão de crédito com dia de fechamento e
 * de vencimento cadastrados, a data informada pelo usuário é tratada como a
 * data da compra, e a data efetiva do lançamento é sempre recalculada a
 * partir do cadastro do cartão (o usuário não escolhe o vencimento).
 */
async function resolveTransactionDate(
  supabase: Awaited<ReturnType<typeof createClient>>,
  paymentMethodId: string | null,
  purchaseDate: string
): Promise<string> {
  if (!paymentMethodId) return purchaseDate;

  const { data: method } = await supabase
    .from("payment_methods")
    .select("kind, closing_day, due_day")
    .eq("id", paymentMethodId)
    .single();

  if (method?.kind === "cartao" && method.closing_day && method.due_day) {
    return computeCardDueDate(purchaseDate, method.closing_day, method.due_day);
  }
  return purchaseDate;
}

export async function createTransaction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada. Faça login novamente." };

  const type = String(formData.get("type")) as TransactionType;
  const description = String(formData.get("description") ?? "").trim();
  const amount = parseAmount(formData.get("amount"));
  const date = String(formData.get("date") ?? "");
  const categoryId = String(formData.get("category_id") ?? "") || null;
  const subcategoryId = String(formData.get("subcategory_id") ?? "") || null;
  const expenseKind = (String(formData.get("expense_kind") ?? "") || null) as ExpenseKind | null;
  const paymentMethodId = String(formData.get("payment_method_id") ?? "") || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const periodType = (String(formData.get("period_type") ?? "") || null) as RecurringPeriodType | null;
  const dataFimContrato = String(formData.get("data_fim_contrato") ?? "") || null;

  if (!description || !date || !amount || amount <= 0) {
    return { error: "Preencha descrição, valor (maior que zero) e data." };
  }

  const resolvedDate =
    type === "despesa" ? await resolveTransactionDate(supabase, paymentMethodId, date) : date;

  if (periodType === "meses" || periodType === "indeterminado") {
    let monthsCount: number | null = null;
    if (periodType === "meses") {
      monthsCount = Number(formData.get("months_count"));
      if (!Number.isInteger(monthsCount) || monthsCount < 1 || monthsCount > 360) {
        return { error: "Informe um número de meses válido (1 a 360)." };
      }
    }
    const occurrences = periodType === "meses" ? monthsCount! : OPEN_ENDED_HORIZON_MONTHS;

    const { data: series, error: seriesError } = await supabase
      .from("recurring_series")
      .insert({
        user_id: user.id,
        type,
        description,
        amount,
        category_id: categoryId,
        subcategory_id: subcategoryId,
        payment_method_id: paymentMethodId,
        start_date: resolvedDate,
        period_type: periodType,
        months_count: monthsCount,
        data_fim_contrato: type === "despesa" ? dataFimContrato : null,
      })
      .select()
      .single();

    if (seriesError || !series) return { error: "Não foi possível criar o lançamento recorrente." };

    const rows = Array.from({ length: occurrences }, (_, i) => ({
      user_id: user.id,
      type,
      description,
      amount,
      date: addMonths(resolvedDate, i),
      category_id: categoryId,
      subcategory_id: subcategoryId,
      expense_kind: type === "despesa" ? expenseKind ?? "fixa" : null,
      payment_method_id: paymentMethodId,
      recurring_series_id: series.id,
      notes,
    }));

    const { error: rowsError } = await supabase.from("transactions").insert(rows);
    if (rowsError) {
      await supabase.from("recurring_series").delete().eq("id", series.id);
      return { error: "Não foi possível gerar os lançamentos recorrentes." };
    }
  } else {
    const { error } = await supabase.from("transactions").insert({
      user_id: user.id,
      type,
      description,
      amount,
      date: resolvedDate,
      category_id: categoryId,
      subcategory_id: subcategoryId,
      expense_kind: type === "despesa" ? expenseKind ?? "variavel" : null,
      payment_method_id: paymentMethodId,
      notes,
    });

    if (error) return { error: "Não foi possível salvar a transação." };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/transacoes");
  return { success: true };
}

export async function updateTransaction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada. Faça login novamente." };

  const id = String(formData.get("id") ?? "");
  const type = String(formData.get("type") ?? "") as TransactionType;
  const description = String(formData.get("description") ?? "").trim();
  const amount = parseAmount(formData.get("amount"));
  const date = String(formData.get("date") ?? "");
  const categoryId = String(formData.get("category_id") ?? "") || null;
  const subcategoryId = String(formData.get("subcategory_id") ?? "") || null;
  const paymentMethodId = String(formData.get("payment_method_id") ?? "") || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!id || !description || !date || !amount || amount <= 0) {
    return { error: "Preencha descrição, valor (maior que zero) e data." };
  }

  const resolvedDate =
    type === "despesa" ? await resolveTransactionDate(supabase, paymentMethodId, date) : date;

  const { error } = await supabase
    .from("transactions")
    .update({
      description,
      amount,
      date: resolvedDate,
      category_id: categoryId,
      subcategory_id: subcategoryId,
      payment_method_id: paymentMethodId,
      notes,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: "Não foi possível atualizar a transação." };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/transacoes");
  return { success: true };
}

export async function deleteTransaction(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada." };

  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: "Não foi possível excluir a transação." };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/transacoes");
  revalidatePath("/dashboard/parcelamentos");
  return { success: true };
}

export async function deleteRecurringSeries(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada." };

  const { error } = await supabase
    .from("recurring_series")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: "Não foi possível excluir o lançamento recorrente." };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/transacoes");
  return { success: true };
}

interface PurchaseFormValues {
  description: string;
  totalAmount: number;
  installmentsTotal: number;
  startingInstallment: number;
  paymentMethod: PurchasePaymentType;
  paymentMethodId: string | null;
  firstDueDate: string;
  categoryId: string | null;
  subcategoryId: string | null;
}

function parsePurchaseForm(formData: FormData): PurchaseFormValues | { error: string } {
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

  return {
    description,
    totalAmount,
    installmentsTotal,
    startingInstallment,
    paymentMethod,
    paymentMethodId,
    firstDueDate,
    categoryId,
    subcategoryId,
  };
}

function buildInstallmentRows(userId: string, purchaseId: string, values: PurchaseFormValues, resolvedFirstDueDate: string) {
  const { description, totalAmount, installmentsTotal, startingInstallment, paymentMethod, paymentMethodId, categoryId, subcategoryId } =
    values;
  const installmentAmount = Math.round((totalAmount / installmentsTotal) * 100) / 100;
  const remainder = Math.round((totalAmount - installmentAmount * installmentsTotal) * 100) / 100;
  const occurrences = installmentsTotal - startingInstallment + 1;

  return Array.from({ length: occurrences }, (_, i) => {
    const installmentNumber = startingInstallment + i;
    return {
      user_id: userId,
      type: "despesa" as const,
      description: `${description} (${installmentNumber}/${installmentsTotal})`,
      amount: installmentNumber === installmentsTotal ? installmentAmount + remainder : installmentAmount,
      date: addMonths(resolvedFirstDueDate, i),
      category_id: categoryId,
      subcategory_id: subcategoryId,
      expense_kind: paymentMethod === "cartao" ? ("parcelada_cartao" as const) : ("parcelada_boleto" as const),
      purchase_id: purchaseId,
      installment_number: installmentNumber,
      installments_total: installmentsTotal,
      payment_method_id: paymentMethodId,
    };
  });
}

export async function createInstallmentPurchase(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada. Faça login novamente." };

  const parsed = parsePurchaseForm(formData);
  if ("error" in parsed) return parsed;

  const resolvedFirstDueDate =
    parsed.paymentMethod === "cartao"
      ? await resolveTransactionDate(supabase, parsed.paymentMethodId, parsed.firstDueDate)
      : parsed.firstDueDate;

  const { data: purchase, error: purchaseError } = await supabase
    .from("purchases")
    .insert({
      user_id: user.id,
      description: parsed.description,
      category_id: parsed.categoryId,
      subcategory_id: parsed.subcategoryId,
      total_amount: parsed.totalAmount,
      installments_total: parsed.installmentsTotal,
      starting_installment: parsed.startingInstallment,
      payment_method: parsed.paymentMethod,
      payment_method_id: parsed.paymentMethodId,
      first_due_date: resolvedFirstDueDate,
    })
    .select()
    .single();

  if (purchaseError || !purchase) return { error: "Não foi possível criar a compra parcelada." };

  const rows = buildInstallmentRows(user.id, purchase.id, parsed, resolvedFirstDueDate);

  const { error: installmentsError } = await supabase.from("transactions").insert(rows);
  if (installmentsError) {
    await supabase.from("purchases").delete().eq("id", purchase.id);
    return { error: "Não foi possível gerar as parcelas." };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/transacoes");
  revalidatePath("/dashboard/parcelamentos");
  return { success: true };
}

export async function updateInstallmentPurchase(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada. Faça login novamente." };

  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Compra parcelada inválida." };

  const parsed = parsePurchaseForm(formData);
  if ("error" in parsed) return parsed;

  const { data: existing, error: existingError } = await supabase
    .from("purchases")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (existingError || !existing) return { error: "Compra parcelada não encontrada." };

  const resolvedFirstDueDate =
    parsed.paymentMethod === "cartao"
      ? await resolveTransactionDate(supabase, parsed.paymentMethodId, parsed.firstDueDate)
      : parsed.firstDueDate;

  const { error: updateError } = await supabase
    .from("purchases")
    .update({
      description: parsed.description,
      category_id: parsed.categoryId,
      subcategory_id: parsed.subcategoryId,
      total_amount: parsed.totalAmount,
      installments_total: parsed.installmentsTotal,
      starting_installment: parsed.startingInstallment,
      payment_method: parsed.paymentMethod,
      payment_method_id: parsed.paymentMethodId,
      first_due_date: resolvedFirstDueDate,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (updateError) return { error: "Não foi possível atualizar a compra parcelada." };

  // As parcelas já geradas são recriadas do zero a partir dos novos dados,
  // já que valor, nº de parcelas e datas afetam todas as linhas.
  const { data: oldRows } = await supabase.from("transactions").select("*").eq("purchase_id", id);

  const { error: deleteError } = await supabase.from("transactions").delete().eq("purchase_id", id);
  if (deleteError) return { error: "Não foi possível recriar as parcelas." };

  const rows = buildInstallmentRows(user.id, id, parsed, resolvedFirstDueDate);
  const { error: insertError } = await supabase.from("transactions").insert(rows);
  if (insertError) {
    if (oldRows?.length) await supabase.from("transactions").insert(oldRows);
    return { error: "Não foi possível recriar as parcelas. As parcelas anteriores foram restauradas." };
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/transacoes");
  revalidatePath("/dashboard/parcelamentos");
  return { success: true };
}

export async function deletePurchase(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada." };

  const { error } = await supabase.from("purchases").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { error: "Não foi possível excluir a compra parcelada." };

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/transacoes");
  revalidatePath("/dashboard/parcelamentos");
  return { success: true };
}
