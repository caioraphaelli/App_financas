import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ForecastStatus, ForecastWithRelations, TransactionType } from "@/lib/types/database";

export interface ForecastFilters {
  type?: TransactionType;
  status?: ForecastStatus;
  month?: number;
  year?: number;
  categoryId?: string;
  paymentMethodId?: string;
  search?: string;
}

/**
 * Calcula o status "efetivo" de uma previsão: se ainda está pendente mas a
 * data prevista já passou, ela é tratada como "não_realizada" na leitura —
 * não há job/cron nesta fase para atualizar o banco, então o cálculo é
 * sempre feito na consulta (mesma abordagem usada na classificação de
 * prazo). Isso significa que o valor sai da soma de "efetivado" sem exigir
 * infraestrutura de agendamento.
 */
export function effectiveForecastStatus(status: ForecastStatus, dataPrevista: string): ForecastStatus {
  if (status !== "pendente") return status;
  const todayStr = new Date().toISOString().slice(0, 10);
  return dataPrevista < todayStr ? "nao_realizada" : "pendente";
}

export async function getForecasts(filters: ForecastFilters = {}): Promise<ForecastWithRelations[]> {
  const supabase = await createClient();
  let query = supabase
    .from("forecasts")
    .select("*, category:categories(*), subcategory:subcategories(*), payment_method:payment_methods(*)")
    .order("data_prevista", { ascending: true });

  if (filters.type) query = query.eq("type", filters.type);
  if (filters.month && filters.year) {
    const start = `${filters.year}-${String(filters.month).padStart(2, "0")}-01`;
    const endMonth = filters.month === 12 ? 1 : filters.month + 1;
    const endYear = filters.month === 12 ? filters.year + 1 : filters.year;
    const end = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;
    query = query.gte("data_prevista", start).lt("data_prevista", end);
  }
  if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
  if (filters.paymentMethodId) query = query.eq("payment_method_id", filters.paymentMethodId);
  if (filters.search) query = query.ilike("description", `%${filters.search}%`);

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as unknown as ForecastWithRelations[];
  const withEffectiveStatus = rows.map((f) => ({
    ...f,
    status: effectiveForecastStatus(f.status, f.data_prevista),
  }));

  if (filters.status) {
    return withEffectiveStatus.filter((f) => f.status === filters.status);
  }
  return withEffectiveStatus;
}
