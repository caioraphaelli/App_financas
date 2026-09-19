import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { TransactionType } from "@/lib/types/database";

export interface OrcadoRealizadoSubcategoria {
  subcategoryId: string;
  name: string;
  orcado: number;
  realizado: number;
}

export interface OrcadoRealizadoLinha {
  categoryId: string;
  name: string;
  color: string;
  orcado: number;
  realizado: number;
  subcategorias: OrcadoRealizadoSubcategoria[];
}

export interface OrcadoVsRealizadoResult {
  receitas: OrcadoRealizadoLinha[];
  despesas: OrcadoRealizadoLinha[];
  totalOrcadoReceitas: number;
  totalRealizadoReceitas: number;
  totalOrcadoDespesas: number;
  totalRealizadoDespesas: number;
}

function monthRange(month: number, year: number) {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = new Date(year, month, 1);
  const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-01`;
  return { start, end };
}

export async function getOrcadoVsRealizado(month: number, year: number): Promise<OrcadoVsRealizadoResult> {
  const supabase = await createClient();
  const { start, end } = monthRange(month, year);

  const [{ data: forecastData, error: forecastError }, { data: txData, error: txError }] = await Promise.all([
    supabase
      .from("forecasts")
      .select("amount, type, category:categories(id,name,color), subcategory:subcategories(id,name)")
      .gte("data_prevista", start)
      .lt("data_prevista", end),
    supabase
      .from("transactions")
      .select("amount, type, category:categories(id,name,color), subcategory:subcategories(id,name)")
      .gte("date", start)
      .lt("date", end),
  ]);

  if (forecastError) throw forecastError;
  if (txError) throw txError;

  type Row = {
    amount: number;
    type: TransactionType;
    category: { id: string; name: string; color: string } | null;
    subcategory: { id: string; name: string } | null;
  };

  interface Bucket {
    categoryId: string;
    name: string;
    color: string;
    orcado: number;
    realizado: number;
    type: TransactionType;
    subcategorias: Map<string, OrcadoRealizadoSubcategoria>;
  }

  const buckets = new Map<string, Bucket>();

  function ensure(row: Row): Bucket {
    const key = `${row.type}:${row.category?.id ?? "sem-categoria"}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        categoryId: row.category?.id ?? "sem-categoria",
        name: row.category?.name ?? "Sem categoria",
        color: row.category?.color ?? "#898781",
        orcado: 0,
        realizado: 0,
        type: row.type,
        subcategorias: new Map(),
      };
      buckets.set(key, bucket);
    }
    return bucket;
  }

  function ensureSubcategoria(bucket: Bucket, row: Row): OrcadoRealizadoSubcategoria {
    const key = row.subcategory?.id ?? "sem-subcategoria";
    let sub = bucket.subcategorias.get(key);
    if (!sub) {
      sub = { subcategoryId: key, name: row.subcategory?.name ?? "Sem subcategoria", orcado: 0, realizado: 0 };
      bucket.subcategorias.set(key, sub);
    }
    return sub;
  }

  for (const row of (forecastData ?? []) as unknown as Row[]) {
    const bucket = ensure(row);
    bucket.orcado += Number(row.amount);
    ensureSubcategoria(bucket, row).orcado += Number(row.amount);
  }
  for (const row of (txData ?? []) as unknown as Row[]) {
    const bucket = ensure(row);
    bucket.realizado += Number(row.amount);
    ensureSubcategoria(bucket, row).realizado += Number(row.amount);
  }

  const toLinha = (b: Bucket): OrcadoRealizadoLinha & { type: TransactionType } => ({
    categoryId: b.categoryId,
    name: b.name,
    color: b.color,
    orcado: b.orcado,
    realizado: b.realizado,
    type: b.type,
    subcategorias: Array.from(b.subcategorias.values()).sort(
      (a, c) => c.realizado + c.orcado - (a.realizado + a.orcado)
    ),
  });

  const all = Array.from(buckets.values())
    .map(toLinha)
    .sort((a, b) => b.realizado + b.orcado - (a.realizado + a.orcado));
  const receitas = all.filter((b) => b.type === "receita");
  const despesas = all.filter((b) => b.type === "despesa");

  return {
    receitas,
    despesas,
    totalOrcadoReceitas: receitas.reduce((s, r) => s + r.orcado, 0),
    totalRealizadoReceitas: receitas.reduce((s, r) => s + r.realizado, 0),
    totalOrcadoDespesas: despesas.reduce((s, r) => s + r.orcado, 0),
    totalRealizadoDespesas: despesas.reduce((s, r) => s + r.realizado, 0),
  };
}
