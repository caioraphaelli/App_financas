"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions/transactions";
import type { PaymentMethodKind } from "@/lib/types/database";

const PAYMENT_METHOD_COLORS = [
  "#2a78d6",
  "#eb6834",
  "#1baf7a",
  "#eda100",
  "#e87ba4",
  "#008300",
  "#4a3aa7",
  "#e34948",
];

function parseOptionalInt(raw: FormDataEntryValue | null): number | null {
  const str = String(raw ?? "").trim();
  if (!str) return null;
  const value = Number(str);
  return Number.isInteger(value) ? value : null;
}

function parseOptionalAmount(raw: FormDataEntryValue | null): number | null {
  const str = String(raw ?? "").trim();
  if (!str) return null;
  const value = Number(str.replace(",", "."));
  return Number.isFinite(value) ? value : null;
}

export async function createPaymentMethod(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada. Faça login novamente." };

  const name = String(formData.get("name") ?? "").trim();
  const kind = String(formData.get("kind") ?? "") as PaymentMethodKind;

  if (!name || !kind) {
    return { error: "Informe um nome e o tipo da forma de pagamento." };
  }

  const isCard = kind === "cartao";

  const { count } = await supabase
    .from("payment_methods")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  const { error } = await supabase.from("payment_methods").insert({
    user_id: user.id,
    name,
    kind,
    color: PAYMENT_METHOD_COLORS[(count ?? 0) % PAYMENT_METHOD_COLORS.length],
    card_brand: isCard ? String(formData.get("card_brand") ?? "").trim() || null : null,
    card_last_digits: isCard ? String(formData.get("card_last_digits") ?? "").trim() || null : null,
    closing_day: isCard ? parseOptionalInt(formData.get("closing_day")) : null,
    due_day: isCard ? parseOptionalInt(formData.get("due_day")) : null,
    credit_limit: isCard ? parseOptionalAmount(formData.get("credit_limit")) : null,
  });

  if (error) return { error: "Não foi possível salvar a forma de pagamento." };

  revalidatePath("/dashboard/cadastros");
  revalidatePath("/dashboard/transacoes");
  revalidatePath("/dashboard/parcelamentos");
  return { success: true };
}

export async function updatePaymentMethod(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada. Faça login novamente." };

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const kind = String(formData.get("kind") ?? "") as PaymentMethodKind;

  if (!id || !name || !kind) {
    return { error: "Informe um nome e o tipo da forma de pagamento." };
  }

  const isCard = kind === "cartao";

  const { error } = await supabase
    .from("payment_methods")
    .update({
      name,
      kind,
      card_brand: isCard ? String(formData.get("card_brand") ?? "").trim() || null : null,
      card_last_digits: isCard ? String(formData.get("card_last_digits") ?? "").trim() || null : null,
      closing_day: isCard ? parseOptionalInt(formData.get("closing_day")) : null,
      due_day: isCard ? parseOptionalInt(formData.get("due_day")) : null,
      credit_limit: isCard ? parseOptionalAmount(formData.get("credit_limit")) : null,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { error: "Não foi possível atualizar a forma de pagamento." };

  revalidatePath("/dashboard/cadastros");
  revalidatePath("/dashboard/transacoes");
  revalidatePath("/dashboard/parcelamentos");
  return { success: true };
}

export async function deletePaymentMethod(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada." };

  const { error } = await supabase.from("payment_methods").delete().eq("id", id).eq("user_id", user.id);
  if (error) return { error: "Não foi possível excluir a forma de pagamento." };

  revalidatePath("/dashboard/cadastros");
  revalidatePath("/dashboard/transacoes");
  revalidatePath("/dashboard/parcelamentos");
  return { success: true };
}
