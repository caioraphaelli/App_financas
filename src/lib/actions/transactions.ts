"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { addMonths } from "@/lib/format";
import type { ExpenseKind, PaymentMethod, TransactionType } from "@/lib/types/database";

export interface ActionResult {
  error?: string;
  success?: boolean;
}

function parseAmount(raw: FormDataEntryValue | null): number {
  const value = Number(String(raw ?? "").replace(",", "."));
  return Number.isFinite(value) ? value : NaN;
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
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!description || !date || !amount || amount <= 0) {
    return { error: "Preencha descrição, valor (maior que zero) e data." };
  }

  const { error } = await supabase.from("transactions").insert({
    user_id: user.id,
    type,
    description,
    amount,
    date,
    category_id: categoryId,
    subcategory_id: subcategoryId,
    expense_kind: type === "despesa" ? expenseKind ?? "variavel" : null,
    notes,
  });

  if (error) return { error: "Não foi possível salvar a transação." };

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
  const description = String(formData.get("description") ?? "").trim();
  const amount = parseAmount(formData.get("amount"));
  const date = String(formData.get("date") ?? "");
  const categoryId = String(formData.get("category_id") ?? "") || null;
  const subcategoryId = String(formData.get("subcategory_id") ?? "") || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!id || !description || !date || !amount || amount <= 0) {
    return { error: "Preencha descrição, valor (maior que zero) e data." };
  }

  const { error } = await supabase
    .from("transactions")
    .update({
      description,
      amount,
      date,
      category_id: categoryId,
      subcategory_id: subcategoryId,
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

export async function createInstallmentPurchase(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada. Faça login novamente." };

  const description = String(formData.get("description") ?? "").trim();
  const totalAmount = parseAmount(formData.get("total_amount"));
  const installmentsTotal = Number(formData.get("installments_total"));
  const paymentMethod = String(formData.get("payment_method") ?? "cartao") as PaymentMethod;
  const firstDueDate = String(formData.get("first_due_date") ?? "");
  const categoryId = String(formData.get("category_id") ?? "") || null;
  const subcategoryId = String(formData.get("subcategory_id") ?? "") || null;

  if (!description || !totalAmount || totalAmount <= 0 || !firstDueDate) {
    return { error: "Preencha descrição, valor total (maior que zero) e a data da 1ª parcela." };
  }
  if (!Number.isInteger(installmentsTotal) || installmentsTotal < 1 || installmentsTotal > 120) {
    return { error: "Número de parcelas inválido (use entre 1 e 120)." };
  }

  const { data: purchase, error: purchaseError } = await supabase
    .from("purchases")
    .insert({
      user_id: user.id,
      description,
      category_id: categoryId,
      subcategory_id: subcategoryId,
      total_amount: totalAmount,
      installments_total: installmentsTotal,
      payment_method: paymentMethod,
      first_due_date: firstDueDate,
    })
    .select()
    .single();

  if (purchaseError || !purchase) return { error: "Não foi possível criar a compra parcelada." };

  const installmentAmount = Math.round((totalAmount / installmentsTotal) * 100) / 100;
  const remainder = Math.round((totalAmount - installmentAmount * installmentsTotal) * 100) / 100;

  const rows = Array.from({ length: installmentsTotal }, (_, i) => ({
    user_id: user.id,
    type: "despesa" as const,
    description: `${description} (${i + 1}/${installmentsTotal})`,
    amount: i === installmentsTotal - 1 ? installmentAmount + remainder : installmentAmount,
    date: addMonths(firstDueDate, i),
    category_id: categoryId,
    subcategory_id: subcategoryId,
    expense_kind: paymentMethod === "cartao" ? ("parcelada_cartao" as const) : ("parcelada_boleto" as const),
    purchase_id: purchase.id,
    installment_number: i + 1,
    installments_total: installmentsTotal,
  }));

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
