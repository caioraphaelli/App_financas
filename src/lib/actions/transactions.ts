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

  if (!description || !date || !amount || amount <= 0 || !categoryId) {
    return { error: "Preencha descrição, valor (maior que zero), data e categoria." };
  }
  if (type === "despesa" && !paymentMethodId) {
    return { error: "Selecione a forma de pagamento." };
  }

  // Despesa fixa representa uma conta com vencimento próprio (ex: seguro,
  // assinatura), não uma compra no cartão a ser traduzida para a data da
  // fatura — por isso não passa pela resolução de ciclo de cartão.
  const resolvedDate =
    type === "despesa" && expenseKind !== "fixa"
      ? await resolveTransactionDate(supabase, paymentMethodId, date)
      : date;

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
  const expenseKind = (String(formData.get("expense_kind") ?? "") || null) as ExpenseKind | null;
  const periodType = (String(formData.get("period_type") ?? "") || null) as RecurringPeriodType | null;
  const dataFimContrato = String(formData.get("data_fim_contrato") ?? "") || null;
  const recurringAction = String(formData.get("recurring_action") ?? "") as "delete_others" | "keep_others" | "";

  if (!id || !description || !date || !amount || amount <= 0 || !categoryId) {
    return { error: "Preencha descrição, valor (maior que zero), data e categoria." };
  }
  if (type === "despesa" && !paymentMethodId) {
    return { error: "Selecione a forma de pagamento." };
  }

  const { data: existing } = await supabase
    .from("transactions")
    .select("expense_kind, recurring_series_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();
  if (!existing) return { error: "Transação não encontrada." };

  // Despesa fixa tem vencimento próprio e não passa pela resolução de ciclo
  // de cartão (isso é só para compras avulsas/parceladas no cartão).
  const resolvedDate =
    type === "despesa" && expenseKind !== "fixa"
      ? await resolveTransactionDate(supabase, paymentMethodId, date)
      : date;

  const switchingToFixa = type === "despesa" && existing.expense_kind !== "fixa" && expenseKind === "fixa";
  const switchingToVariavel = existing.expense_kind === "fixa" && expenseKind !== "fixa";

  // Vira fixa e o usuário escolheu repetir por vários meses: cria a série
  // recorrente a partir desta transação (que passa a ser a 1ª ocorrência) e
  // gera as ocorrências futuras, igual ao fluxo de criação.
  if (switchingToFixa && (periodType === "meses" || periodType === "indeterminado")) {
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
        data_fim_contrato: dataFimContrato,
      })
      .select()
      .single();
    if (seriesError || !series) return { error: "Não foi possível criar o lançamento recorrente." };

    const { error: updateError } = await supabase
      .from("transactions")
      .update({
        description,
        amount,
        date: resolvedDate,
        category_id: categoryId,
        subcategory_id: subcategoryId,
        payment_method_id: paymentMethodId,
        notes,
        expense_kind: "fixa",
        recurring_series_id: series.id,
      })
      .eq("id", id)
      .eq("user_id", user.id);
    if (updateError) {
      await supabase.from("recurring_series").delete().eq("id", series.id);
      return { error: "Não foi possível atualizar a transação." };
    }

    const futureRows = Array.from({ length: occurrences - 1 }, (_, idx) => ({
      user_id: user.id,
      type,
      description,
      amount,
      date: addMonths(resolvedDate, idx + 1),
      category_id: categoryId,
      subcategory_id: subcategoryId,
      expense_kind: "fixa" as const,
      payment_method_id: paymentMethodId,
      recurring_series_id: series.id,
      notes,
    }));
    if (futureRows.length) {
      const { error: rowsError } = await supabase.from("transactions").insert(futureRows);
      if (rowsError) {
        return { error: "Transação marcada como fixa, mas não foi possível gerar as ocorrências futuras." };
      }
    }

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/transacoes");
    return { success: true };
  }

  // Deixa de ser fixa e estava ligada a uma série: desvincula esta
  // transação (ela vira variável avulsa) e, se pedido, apaga as outras
  // ocorrências da série junto com a série em si.
  if (switchingToVariavel && existing.recurring_series_id) {
    const seriesId = existing.recurring_series_id;

    const { error: updateError } = await supabase
      .from("transactions")
      .update({
        description,
        amount,
        date: resolvedDate,
        category_id: categoryId,
        subcategory_id: subcategoryId,
        payment_method_id: paymentMethodId,
        notes,
        expense_kind: expenseKind ?? "variavel",
        recurring_series_id: null,
      })
      .eq("id", id)
      .eq("user_id", user.id);
    if (updateError) return { error: "Não foi possível atualizar a transação." };

    if (recurringAction === "delete_others") {
      await supabase.from("transactions").delete().eq("recurring_series_id", seriesId).eq("user_id", user.id);
      await supabase.from("recurring_series").delete().eq("id", seriesId).eq("user_id", user.id);
    }

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/transacoes");
    return { success: true };
  }

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
      ...(type === "despesa" && expenseKind ? { expense_kind: expenseKind } : {}),
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

/**
 * Edita todos os lançamentos gerados por uma recorrência (fixa) de uma só
 * vez, além da própria série (usada para eventuais novas ocorrências). A
 * data de cada lançamento não muda — só descrição, valor, categoria,
 * subcategoria e forma de pagamento são replicados para todos.
 */
export async function updateRecurringSeries(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada. Faça login novamente." };

  const seriesId = String(formData.get("recurring_series_id") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const amount = parseAmount(formData.get("amount"));
  const categoryId = String(formData.get("category_id") ?? "") || null;
  const subcategoryId = String(formData.get("subcategory_id") ?? "") || null;
  const paymentMethodId = String(formData.get("payment_method_id") ?? "") || null;

  if (!seriesId || !description || !amount || amount <= 0 || !categoryId) {
    return { error: "Preencha descrição, valor (maior que zero) e categoria." };
  }

  const { data: series } = await supabase
    .from("recurring_series")
    .select("type")
    .eq("id", seriesId)
    .eq("user_id", user.id)
    .single();
  if (!series) return { error: "Recorrência não encontrada." };
  if (series.type === "despesa" && !paymentMethodId) {
    return { error: "Selecione a forma de pagamento." };
  }

  const { error: seriesError } = await supabase
    .from("recurring_series")
    .update({
      description,
      amount,
      category_id: categoryId,
      subcategory_id: subcategoryId,
      payment_method_id: paymentMethodId,
    })
    .eq("id", seriesId)
    .eq("user_id", user.id);
  if (seriesError) return { error: "Não foi possível atualizar a recorrência." };

  const { error: txError } = await supabase
    .from("transactions")
    .update({
      description,
      amount,
      category_id: categoryId,
      subcategory_id: subcategoryId,
      payment_method_id: paymentMethodId,
    })
    .eq("recurring_series_id", seriesId)
    .eq("user_id", user.id);
  if (txError) {
    return { error: "Recorrência atualizada, mas não foi possível atualizar todos os lançamentos gerados." };
  }

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

async function parsePurchaseForm(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  formData: FormData
): Promise<PurchaseFormValues | { error: string }> {
  const description = String(formData.get("description") ?? "").trim();
  const totalAmount = parseAmount(formData.get("total_amount"));
  const installmentsTotal = Number(formData.get("installments_total"));
  const startingInstallment = Number(formData.get("starting_installment") ?? 1) || 1;
  const paymentMethod = String(formData.get("payment_method") ?? "cartao") as PurchasePaymentType;
  let paymentMethodId = String(formData.get("payment_method_id") ?? "") || null;
  const firstDueDate = String(formData.get("first_due_date") ?? "");
  const categoryId = String(formData.get("category_id") ?? "") || null;
  const subcategoryId = String(formData.get("subcategory_id") ?? "") || null;

  if (!description || !totalAmount || totalAmount <= 0 || !firstDueDate || !categoryId) {
    return { error: "Preencha descrição, valor total (maior que zero), data da parcela inicial e categoria." };
  }
  // Boleto normalmente é só uma forma de pagamento por usuário, então não
  // precisa perguntar qual — resolve automaticamente pra manter a
  // classificação por forma de pagamento no Fluxo de Caixa.
  if (paymentMethod === "boleto" && !paymentMethodId) {
    const { data: boletoMethod } = await supabase
      .from("payment_methods")
      .select("id")
      .eq("user_id", userId)
      .eq("kind", "boleto")
      .limit(1)
      .maybeSingle();
    if (!boletoMethod) {
      return { error: "Cadastre uma forma de pagamento do tipo Boleto em Cadastros." };
    }
    paymentMethodId = boletoMethod.id;
  }
  if (!paymentMethodId) {
    return { error: "Selecione o cartão utilizado." };
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

  const parsed = await parsePurchaseForm(supabase, user.id, formData);
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

  const parsed = await parsePurchaseForm(supabase, user.id, formData);
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
