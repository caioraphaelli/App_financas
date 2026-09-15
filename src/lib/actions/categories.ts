"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { TransactionType } from "@/lib/types/database";
import type { ActionResult } from "@/lib/actions/transactions";

const CATEGORY_COLORS = [
  "#2a78d6",
  "#eb6834",
  "#1baf7a",
  "#eda100",
  "#e87ba4",
  "#008300",
  "#4a3aa7",
  "#e34948",
];

function pickColor(seed: number) {
  return CATEGORY_COLORS[seed % CATEGORY_COLORS.length];
}

export async function createCategory(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada. Faça login novamente." };

  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "") as TransactionType;

  if (!name || (type !== "receita" && type !== "despesa")) {
    return { error: "Informe um nome e selecione o tipo (receita ou despesa)." };
  }

  const { count } = await supabase
    .from("categories")
    .select("id", { count: "exact", head: true })
    .eq("type", type);

  const { error } = await supabase.from("categories").insert({
    user_id: user.id,
    name,
    type,
    color: pickColor(count ?? 0),
  });

  if (error) return { error: "Não foi possível criar a categoria." };

  revalidatePath("/dashboard/cadastros");
  revalidatePath("/dashboard/transacoes");
  revalidatePath("/dashboard/parcelamentos");
  return { success: true };
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada." };

  const { data: category, error: fetchError } = await supabase
    .from("categories")
    .select("id, user_id")
    .eq("id", id)
    .single();
  if (fetchError || !category) return { error: "Categoria não encontrada." };

  if (category.user_id === null) {
    // Categoria padrão (global): não pode ser removida de verdade, então
    // fica só "escondida" para este usuário, sem afetar os demais.
    const { error } = await supabase
      .from("hidden_categories")
      .upsert({ user_id: user.id, category_id: id }, { onConflict: "user_id,category_id" });
    if (error) return { error: "Não foi possível ocultar a categoria." };
  } else {
    const { error } = await supabase.from("categories").delete().eq("id", id).eq("user_id", user.id);
    if (error) {
      return {
        error: "Não foi possível excluir. Verifique se não há transações usando essa categoria.",
      };
    }
  }

  revalidatePath("/dashboard/cadastros");
  revalidatePath("/dashboard/transacoes");
  revalidatePath("/dashboard/parcelamentos");
  return { success: true };
}

export async function createSubcategory(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada. Faça login novamente." };

  const name = String(formData.get("name") ?? "").trim();
  const categoryId = String(formData.get("category_id") ?? "");

  if (!name || !categoryId) {
    return { error: "Informe um nome para a subcategoria." };
  }

  const { error } = await supabase.from("subcategories").insert({
    user_id: user.id,
    category_id: categoryId,
    name,
  });

  if (error) return { error: "Não foi possível criar a subcategoria." };

  revalidatePath("/dashboard/cadastros");
  revalidatePath("/dashboard/transacoes");
  revalidatePath("/dashboard/parcelamentos");
  return { success: true };
}

export async function deleteSubcategory(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada." };

  const { data: subcategory, error: fetchError } = await supabase
    .from("subcategories")
    .select("id, user_id")
    .eq("id", id)
    .single();
  if (fetchError || !subcategory) return { error: "Subcategoria não encontrada." };

  if (subcategory.user_id === null) {
    // Subcategoria padrão (global): fica escondida só para este usuário.
    const { error } = await supabase
      .from("hidden_subcategories")
      .upsert({ user_id: user.id, subcategory_id: id }, { onConflict: "user_id,subcategory_id" });
    if (error) return { error: "Não foi possível ocultar a subcategoria." };
  } else {
    const { error } = await supabase.from("subcategories").delete().eq("id", id).eq("user_id", user.id);
    if (error) {
      return {
        error: "Não foi possível excluir. Verifique se não há transações usando essa subcategoria.",
      };
    }
  }

  revalidatePath("/dashboard/cadastros");
  revalidatePath("/dashboard/transacoes");
  revalidatePath("/dashboard/parcelamentos");
  return { success: true };
}
