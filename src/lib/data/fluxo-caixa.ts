import "server-only";
import { createClient } from "@/lib/supabase/server";
import { MONTH_NAMES } from "@/lib/format";
import { classificarPrazo, mesesRestantesAteData } from "@/lib/prazo";

export interface FluxoLineValue {
  valor: number;
  avPercent: number | null;
}

export interface FluxoNode {
  key: string;
  name: string;
  color?: string;
  values: FluxoLineValue[];
  children?: FluxoNode[];
}

export interface FluxoCaixaResult {
  months: { label: string; month: number; year: number }[];
  receitas: FluxoNode;
  despesasFixas: FluxoNode;
  despesasVariaveis: FluxoNode;
  saldo: FluxoNode;
}

interface PathSegment {
  key: string;
  name: string;
  color?: string;
}

interface PathBucket {
  name: string;
  color?: string;
  total: number;
  children: Map<string, PathBucket>;
}

function addPath(root: Map<string, PathBucket>, path: PathSegment[], amount: number) {
  let level = root;
  for (const seg of path) {
    let bucket = level.get(seg.key);
    if (!bucket) {
      bucket = { name: seg.name, color: seg.color, total: 0, children: new Map() };
      level.set(seg.key, bucket);
    }
    bucket.total += amount;
    if (seg.color && !bucket.color) bucket.color = seg.color;
    level = bucket.children;
  }
}

function mergeAcrossMonths(monthMaps: Map<string, PathBucket>[], receitasTotals: number[]): FluxoNode[] {
  const keys = new Set<string>();
  for (const m of monthMaps) for (const k of m.keys()) keys.add(k);

  const nodes = Array.from(keys).map((key) => {
    const meta = monthMaps.map((m) => m.get(key)).find(Boolean)!;
    const values = monthMaps.map((m, i) => {
      const valor = m.get(key)?.total ?? 0;
      return { valor, avPercent: receitasTotals[i] ? (valor / receitasTotals[i]) * 100 : null };
    });
    const childMaps = monthMaps.map((m) => m.get(key)?.children ?? new Map<string, PathBucket>());
    const hasChildren = childMaps.some((cm) => cm.size > 0);
    return {
      key,
      name: meta.name,
      color: meta.color,
      values,
      children: hasChildren ? mergeAcrossMonths(childMaps, receitasTotals) : undefined,
    };
  });

  return nodes.sort(
    (a, b) => b.values.reduce((s, v) => s + v.valor, 0) - a.values.reduce((s, v) => s + v.valor, 0)
  );
}

function pmBucket(kind: string | null | undefined): PathSegment {
  if (kind === "cartao") return { key: "cartao", name: "Cartões de Crédito" };
  if (kind === "boleto") return { key: "boleto", name: "Boletos" };
  return { key: "outras", name: "Outras" };
}

function categoryBucket(cat: { id: string; name: string; color: string } | null): PathSegment {
  return cat
    ? { key: cat.id, name: cat.name, color: cat.color }
    : { key: "sem-categoria", name: "Sem categoria", color: "#898781" };
}

function cardBucket(pm: { id: string; name: string } | null): PathSegment {
  return pm
    ? { key: pm.id, name: pm.name }
    : { key: "cartao-nao-identificado", name: "Cartão não identificado" };
}

function subcategoryBucket(sub: { id: string; name: string } | null): PathSegment {
  return sub
    ? { key: sub.id, name: sub.name }
    : { key: "sem-subcategoria", name: "Sem subcategoria" };
}

/** Último nível da árvore: cada transação vira uma folha própria, com valor
 * só no mês em que ocorreu (0 nos demais). */
function transactionLeaf(row: { id: string; description: string }): PathSegment {
  return { key: row.id, name: row.description };
}

const PRAZO_KEY_NAME = { curto: "Curto Prazo", longo: "Longo Prazo" } as const;

export async function getFluxoCaixaComparison(
  startMonth: number,
  startYear: number,
  monthsCount: number
): Promise<FluxoCaixaResult> {
  const supabase = await createClient();
  const rangeStart = new Date(startYear, startMonth - 1, 1);
  const rangeEndExclusive = new Date(startYear, startMonth - 1 + monthsCount, 1);
  const start = `${rangeStart.getFullYear()}-${String(rangeStart.getMonth() + 1).padStart(2, "0")}-01`;
  const end = `${rangeEndExclusive.getFullYear()}-${String(rangeEndExclusive.getMonth() + 1).padStart(2, "0")}-01`;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: settings }, { data: txData, error: txError }, { data: seriesData }, { data: forecastData, error: forecastError }] =
    await Promise.all([
      user
        ? supabase.from("user_settings").select("*").eq("user_id", user.id).single()
        : Promise.resolve({ data: null }),
      supabase
        .from("transactions")
        .select(
          "id, description, amount, date, type, expense_kind, recurring_series_id, installment_number, installments_total, category:categories(id,name,color), subcategory:subcategories(id,name), payment_method:payment_methods(id,name,kind)"
        )
        .gte("date", start)
        .lt("date", end),
      supabase.from("recurring_series").select("id, data_fim_contrato"),
      supabase
        .from("forecasts")
        .select(
          "id, description, amount, data_prevista, status, category:categories(id,name,color), subcategory:subcategories(id,name), payment_method:payment_methods(id,name,kind)"
        )
        .eq("type", "despesa")
        .neq("status", "convertida")
        .gte("data_prevista", start)
        .lt("data_prevista", end),
    ]);

  if (txError) throw txError;
  if (forecastError) throw forecastError;

  const limiteCurtoPrazoMeses = settings?.limite_curto_prazo_meses ?? 3;

  const contratoFimById = new Map<string, string | null>();
  for (const s of (seriesData ?? []) as { id: string; data_fim_contrato: string | null }[]) {
    contratoFimById.set(s.id, s.data_fim_contrato);
  }

  type Row = {
    id: string;
    description: string;
    amount: number;
    date: string;
    type: "receita" | "despesa";
    expense_kind: string | null;
    recurring_series_id: string | null;
    installment_number: number | null;
    installments_total: number | null;
    category: { id: string; name: string; color: string } | null;
    subcategory: { id: string; name: string } | null;
    payment_method: { id: string; name: string; kind: string } | null;
  };
  const rows = (txData ?? []) as unknown as Row[];

  type ForecastRow = {
    id: string;
    description: string;
    amount: number;
    data_prevista: string;
    status: string;
    category: { id: string; name: string; color: string } | null;
    subcategory: { id: string; name: string } | null;
    payment_method: { id: string; name: string; kind: string } | null;
  };
  const forecastRows = (forecastData ?? []) as unknown as ForecastRow[];

  const today = new Date();
  const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

  const monthKeys: string[] = [];
  for (let i = 0; i < monthsCount; i++) {
    const d = new Date(rangeStart.getFullYear(), rangeStart.getMonth() + i, 1);
    monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  const monthIndex = new Map(monthKeys.map((k, i) => [k, i]));

  const receitasMaps = monthKeys.map(() => new Map<string, PathBucket>());
  const fixasMaps = monthKeys.map(() => new Map<string, PathBucket>());
  const variaveisMaps = monthKeys.map(() => new Map<string, PathBucket>());
  const receitasTotals = monthKeys.map(() => 0);
  const fixasTotals = monthKeys.map(() => 0);
  const variaveisTotals = monthKeys.map(() => 0);

  for (const r of rows) {
    const key = r.date.slice(0, 7);
    const i = monthIndex.get(key);
    if (i === undefined) continue;
    const amount = Number(r.amount);
    const cat = categoryBucket(r.category);

    const sub = subcategoryBucket(r.subcategory);

    if (r.type === "receita") {
      receitasTotals[i] += amount;
      const bucket: PathSegment = r.recurring_series_id
        ? { key: "fixas", name: "Fixas (recorrentes)" }
        : { key: "avulsas", name: "Avulsas" };
      addPath(receitasMaps[i], [bucket, cat, sub, transactionLeaf(r)], amount);
      continue;
    }

    if (r.expense_kind === "fixa") {
      fixasTotals[i] += amount;
      const path: PathSegment[] = [pmBucket(r.payment_method?.kind), cat, sub];
      const dataFim = r.recurring_series_id ? contratoFimById.get(r.recurring_series_id) : null;
      if (dataFim) {
        const meses = mesesRestantesAteData(dataFim);
        const prazo = classificarPrazo(meses, limiteCurtoPrazoMeses);
        path.push({ key: prazo, name: PRAZO_KEY_NAME[prazo] });
      }
      path.push(transactionLeaf(r));
      addPath(fixasMaps[i], path, amount);
    } else {
      // Despesas Variáveis: inclui parcelas de cartão/boleto (classificadas
      // pelas parcelas restantes) e despesas avulsas sem parcelamento, que
      // por não terem parcelas futuras caem sempre em Curto Prazo.
      variaveisTotals[i] += amount;
      const restantes =
        r.expense_kind === "parcelada_cartao" || r.expense_kind === "parcelada_boleto"
          ? (r.installments_total ?? 0) - (r.installment_number ?? 0)
          : 0;
      const prazo = classificarPrazo(restantes, limiteCurtoPrazoMeses);
      const pm = pmBucket(r.payment_method?.kind);
      const path: PathSegment[] = [pm];
      if (pm.key === "cartao") path.push(cardBucket(r.payment_method));
      path.push(cat, sub, { key: prazo, name: PRAZO_KEY_NAME[prazo] }, transactionLeaf(r));
      addPath(variaveisMaps[i], path, amount);
    }
  }

  // Fora do mês atual, soma as previsões de despesa (ainda não convertidas)
  // dentro de Despesas Variáveis, como estimativa de gasto futuro/passado.
  // O prazo é sempre "curto" pois previsão não é parcelamento.
  const prazoCurto = classificarPrazo(0, limiteCurtoPrazoMeses);
  for (const f of forecastRows) {
    const key = f.data_prevista.slice(0, 7);
    if (key === currentMonthKey) continue;
    const i = monthIndex.get(key);
    if (i === undefined) continue;
    const amount = Number(f.amount);
    variaveisTotals[i] += amount;
    const cat = categoryBucket(f.category);
    const sub = subcategoryBucket(f.subcategory);
    const pm = pmBucket(f.payment_method?.kind);
    const path: PathSegment[] = [pm];
    if (pm.key === "cartao") path.push(cardBucket(f.payment_method));
    path.push(cat, sub, { key: prazoCurto, name: PRAZO_KEY_NAME[prazoCurto] }, {
      key: `forecast:${f.id}`,
      name: `${f.description} (previsto)`,
    });
    addPath(variaveisMaps[i], path, amount);
  }

  const toValues = (totals: number[]): FluxoLineValue[] =>
    totals.map((valor, i) => ({ valor, avPercent: receitasTotals[i] ? (valor / receitasTotals[i]) * 100 : null }));

  const months = monthKeys.map((key) => {
    const [y, m] = key.split("-").map(Number);
    return { label: `${MONTH_NAMES[m - 1].slice(0, 3)}/${String(y).slice(2)}`, month: m, year: y };
  });

  const saldoTotals = receitasTotals.map((r, i) => r - fixasTotals[i] - variaveisTotals[i]);

  return {
    months,
    receitas: { key: "receitas", name: "Receitas", values: toValues(receitasTotals), children: mergeAcrossMonths(receitasMaps, receitasTotals) },
    despesasFixas: {
      key: "despesas-fixas",
      name: "Despesas Fixas",
      values: toValues(fixasTotals),
      children: mergeAcrossMonths(fixasMaps, receitasTotals),
    },
    despesasVariaveis: {
      key: "despesas-variaveis",
      name: "Despesas Variáveis",
      values: toValues(variaveisTotals),
      children: mergeAcrossMonths(variaveisMaps, receitasTotals),
    },
    saldo: { key: "saldo", name: "Saldo", values: toValues(saldoTotals) },
  };
}
