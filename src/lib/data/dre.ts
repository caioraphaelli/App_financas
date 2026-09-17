import "server-only";
import { createClient } from "@/lib/supabase/server";
import { MONTH_NAMES } from "@/lib/format";

interface CategoryBucket {
  name: string;
  color: string;
  total: number;
}

interface CardBucket {
  name: string;
  total: number;
  byCategory: Record<string, CategoryBucket>;
}

interface MonthAggregate {
  month: number;
  year: number;
  receitasTotal: number;
  receitasByCategory: Record<string, CategoryBucket>;
  despesasFixasTotal: number;
  despesasFixasByCategory: Record<string, CategoryBucket>;
  cartoesTotal: number;
  cartoesByCard: Record<string, CardBucket>;
  boletosTotal: number;
  boletosByCategory: Record<string, CategoryBucket>;
  outrasTotal: number;
  outrasByCategory: Record<string, CategoryBucket>;
}

const SEM_CATEGORIA_KEY = "sem-categoria";
const SEM_CATEGORIA_COLOR = "#898781";
const CARTAO_NAO_IDENTIFICADO_KEY = "cartao-nao-identificado";

function emptyAggregate(month: number, year: number): MonthAggregate {
  return {
    month,
    year,
    receitasTotal: 0,
    receitasByCategory: {},
    despesasFixasTotal: 0,
    despesasFixasByCategory: {},
    cartoesTotal: 0,
    cartoesByCard: {},
    boletosTotal: 0,
    boletosByCategory: {},
    outrasTotal: 0,
    outrasByCategory: {},
  };
}

function addToCategoryBucket(
  bucket: Record<string, CategoryBucket>,
  key: string,
  name: string,
  color: string,
  amount: number
) {
  const existing = bucket[key];
  if (existing) existing.total += amount;
  else bucket[key] = { name, color, total: amount };
}

export interface DreLineValue {
  valor: number;
  /** % do valor em relação à receita total do mês (magnitude, sempre >= 0 exceto no Saldo). */
  avPercent: number | null;
}

export interface DreAccount {
  key: string;
  name: string;
  color?: string;
  values: DreLineValue[];
  children?: DreAccount[];
}

export interface DreResult {
  months: { label: string; month: number; year: number }[];
  accounts: DreAccount[];
}

function pct(value: number, base: number): number | null {
  if (!base) return null;
  return (value / base) * 100;
}

function buildLineValues(
  full: MonthAggregate[],
  getValue: (agg: MonthAggregate) => number
): DreLineValue[] {
  return full.map((agg) => ({
    valor: getValue(agg),
    avPercent: pct(getValue(agg), agg.receitasTotal),
  }));
}

function buildCategoryAccounts(
  full: MonthAggregate[],
  getBucket: (agg: MonthAggregate) => Record<string, CategoryBucket>
): DreAccount[] {
  const keys = new Set<string>();
  for (const agg of full) {
    for (const key of Object.keys(getBucket(agg))) keys.add(key);
  }

  const accounts = Array.from(keys).map((key) => {
    const meta = full.map((agg) => getBucket(agg)[key]).find(Boolean);
    return {
      key,
      name: meta?.name ?? "Sem categoria",
      color: meta?.color,
      values: buildLineValues(full, (agg) => getBucket(agg)[key]?.total ?? 0),
    };
  });

  return accounts.sort(
    (a, b) => b.values.reduce((s, v) => s + v.valor, 0) - a.values.reduce((s, v) => s + v.valor, 0)
  );
}

export async function getDreComparison(
  startMonth: number,
  startYear: number,
  monthsCount: number
): Promise<DreResult> {
  const supabase = await createClient();

  // O mês escolhido no filtro é o primeiro exibido; a partir dele contamos
  // para frente pelos próximos `monthsCount` meses.
  const rangeStart = new Date(startYear, startMonth - 1, 1);
  const rangeEndExclusive = new Date(startYear, startMonth - 1 + monthsCount, 1);

  const start = `${rangeStart.getFullYear()}-${String(rangeStart.getMonth() + 1).padStart(2, "0")}-01`;
  const end = `${rangeEndExclusive.getFullYear()}-${String(rangeEndExclusive.getMonth() + 1).padStart(2, "0")}-01`;

  const { data, error } = await supabase
    .from("transactions")
    .select(
      "date, amount, type, expense_kind, category:categories(id,name,color), payment_method:payment_methods(id,name,kind)"
    )
    .gte("date", start)
    .lt("date", end);

  if (error) throw error;

  type Row = {
    date: string;
    amount: number;
    type: "receita" | "despesa";
    expense_kind: string | null;
    category: { id: string; name: string; color: string } | null;
    payment_method: { id: string; name: string; kind: string } | null;
  };

  const full: MonthAggregate[] = [];
  for (let i = 0; i < monthsCount; i++) {
    const d = new Date(rangeStart.getFullYear(), rangeStart.getMonth() + i, 1);
    full.push(emptyAggregate(d.getMonth() + 1, d.getFullYear()));
  }
  const indexByKey = new Map(full.map((agg, i) => [`${agg.year}-${agg.month}`, i]));

  for (const t of (data ?? []) as unknown as Row[]) {
    const [y, m] = t.date.split("-").map(Number);
    const agg = full[indexByKey.get(`${y}-${m}`) ?? -1];
    if (!agg) continue;

    const amount = Number(t.amount);
    const categoryKey = t.category?.id ?? SEM_CATEGORIA_KEY;
    const categoryName = t.category?.name ?? "Sem categoria";
    const categoryColor = t.category?.color ?? SEM_CATEGORIA_COLOR;

    if (t.type === "receita") {
      agg.receitasTotal += amount;
      addToCategoryBucket(agg.receitasByCategory, categoryKey, categoryName, categoryColor, amount);
      continue;
    }

    if (t.expense_kind === "fixa") {
      agg.despesasFixasTotal += amount;
      addToCategoryBucket(agg.despesasFixasByCategory, categoryKey, categoryName, categoryColor, amount);
      continue;
    }

    // Despesa variável: cartão, boleto ou outras formas de pagamento.
    const isCard = t.expense_kind === "parcelada_cartao" || t.payment_method?.kind === "cartao";
    const isBoleto = !isCard && (t.expense_kind === "parcelada_boleto" || t.payment_method?.kind === "boleto");

    if (isCard) {
      agg.cartoesTotal += amount;
      const cardKey = t.payment_method?.id ?? CARTAO_NAO_IDENTIFICADO_KEY;
      const cardName = t.payment_method?.name ?? "Cartão não identificado";
      const card = agg.cartoesByCard[cardKey] ?? { name: cardName, total: 0, byCategory: {} };
      card.total += amount;
      addToCategoryBucket(card.byCategory, categoryKey, categoryName, categoryColor, amount);
      agg.cartoesByCard[cardKey] = card;
    } else if (isBoleto) {
      agg.boletosTotal += amount;
      addToCategoryBucket(agg.boletosByCategory, categoryKey, categoryName, categoryColor, amount);
    } else {
      agg.outrasTotal += amount;
      addToCategoryBucket(agg.outrasByCategory, categoryKey, categoryName, categoryColor, amount);
    }
  }

  const receitasChildren = buildCategoryAccounts(full, (a) => a.receitasByCategory);
  const despesasFixasChildren = buildCategoryAccounts(full, (a) => a.despesasFixasByCategory);

  const cardKeys = new Set<string>();
  for (const agg of full) for (const key of Object.keys(agg.cartoesByCard)) cardKeys.add(key);
  const cartoesChildren: DreAccount[] = Array.from(cardKeys)
    .map((cardKey) => {
      const meta = full.map((agg) => agg.cartoesByCard[cardKey]).find(Boolean);
      return {
        key: cardKey,
        name: meta?.name ?? "Cartão",
        values: buildLineValues(full, (agg) => agg.cartoesByCard[cardKey]?.total ?? 0),
        children: buildCategoryAccounts(full, (agg) => agg.cartoesByCard[cardKey]?.byCategory ?? {}),
      };
    })
    .sort((a, b) => b.values.reduce((s, v) => s + v.valor, 0) - a.values.reduce((s, v) => s + v.valor, 0));

  const boletosChildren = buildCategoryAccounts(full, (a) => a.boletosByCategory);
  const outrasChildren = buildCategoryAccounts(full, (a) => a.outrasByCategory);

  const despesasVariaveisSub: DreAccount[] = [
    {
      key: "cartoes",
      name: "Cartões de Crédito",
      values: buildLineValues(full, (a) => a.cartoesTotal),
      children: cartoesChildren,
    },
    {
      key: "boletos",
      name: "Boletos",
      values: buildLineValues(full, (a) => a.boletosTotal),
      children: boletosChildren,
    },
  ];
  if (outrasChildren.length > 0) {
    despesasVariaveisSub.push({
      key: "outras",
      name: "Outras formas de pagamento",
      values: buildLineValues(full, (a) => a.outrasTotal),
      children: outrasChildren,
    });
  }

  const accounts: DreAccount[] = [
    {
      key: "receitas",
      name: "Receitas",
      values: buildLineValues(full, (a) => a.receitasTotal),
      children: receitasChildren,
    },
    {
      key: "despesas-fixas",
      name: "Despesas Fixas",
      values: buildLineValues(full, (a) => a.despesasFixasTotal),
      children: despesasFixasChildren,
    },
    {
      key: "despesas-variaveis",
      name: "Despesas Variáveis",
      values: buildLineValues(
        full,
        (a) => a.cartoesTotal + a.boletosTotal + a.outrasTotal
      ),
      children: despesasVariaveisSub,
    },
    {
      key: "saldo",
      name: "Saldo",
      values: buildLineValues(
        full,
        (a) => a.receitasTotal - a.despesasFixasTotal - (a.cartoesTotal + a.boletosTotal + a.outrasTotal)
      ),
    },
  ];

  const months = full.map((a) => ({
    label: `${MONTH_NAMES[a.month - 1].slice(0, 3)}/${String(a.year).slice(2)}`,
    month: a.month,
    year: a.year,
  }));

  return { months, accounts };
}
