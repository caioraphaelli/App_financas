"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/actions/transactions";

export async function updateUserSettings(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada. Faça login novamente." };

  const limiteCurto = Number(formData.get("limite_curto_prazo_meses"));
  const limiteLongo = Number(formData.get("limite_longo_prazo_meses"));

  if (!Number.isInteger(limiteCurto) || limiteCurto < 1 || limiteCurto > 360) {
    return { error: "O limite de curto prazo deve ser um número inteiro entre 1 e 360 meses." };
  }
  if (!Number.isInteger(limiteLongo) || limiteLongo < 1 || limiteLongo > 360) {
    return { error: "O limite de longo prazo deve ser um número inteiro entre 1 e 360 meses." };
  }
  if (limiteLongo < limiteCurto) {
    return { error: "O limite de longo prazo deve ser maior ou igual ao de curto prazo." };
  }

  const { error } = await supabase.from("user_settings").upsert(
    {
      user_id: user.id,
      limite_curto_prazo_meses: limiteCurto,
      limite_longo_prazo_meses: limiteLongo,
    },
    { onConflict: "user_id" }
  );

  if (error) return { error: "Não foi possível salvar as configurações." };

  revalidatePath("/dashboard/cadastros");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/transacoes");
  revalidatePath("/dashboard/parcelamentos");
  return { success: true };
}
