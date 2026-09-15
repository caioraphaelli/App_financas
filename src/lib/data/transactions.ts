import "server-only";
import { createClient } from "@/lib/supabase/server";
import type {
  Category,
  PaymentMethod,
  Purchase,
  RecurringSeries,
  Subcategory,
  Transaction,
  TransactionType,
  TransactionWithRelations,
} from "@/lib/types/database";

export interface TransactionFilters {
  month?: number;
  year?: number;
  categoryId?: string;
  paymentMethodId?: string;
  type?: TransactionType;
  search?: string;
}

export async function getCategories(): Promise<Category[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data, error }, { data: hidden }] = await Promise.all([
    supabase
      .from("categories")
      .select("*")
      .order("type", { ascending: true })
      .order("sort_order", { ascending: true }),
    user
      ? supabase.from("hidden_categories").select("category_id").eq("user_id", user.id)
      : Promise.resolve({ data: [] as { category_id: string }[] }),
  ]);

  if (error) throw error;
  const hiddenIds = new Set((hidden ?? []).map((h) => h.category_id));
  return (data ?? []).filter((c) => !hiddenIds.has(c.id));
}

export async function getSubcategoriesByCategory(): Promise<Record<string, Subcategory[]>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data, error }, { data: hidden }] = await Promise.all([
    supabase.from("subcategories").select("*").order("sort_order", { ascending: true }),
    user
      ? supabase.from("hidden_subcategories").select("subcategory_id").eq("user_id", user.id)
      : Promise.resolve({ data: [] as { subcategory_id: string }[] }),
  ]);

  if (error) throw error;
  const hiddenIds = new Set((hidden ?? []).map((h) => h.subcategory_id));
  const map: Record<string, Subcategory[]> = {};
  for (const sub of data ?? []) {
    if (hiddenIds.has(sub.id)) continue;
    (map[sub.category_id] ??= []).push(sub);
  }
  return map;
}

export async function getPaymentMethods(): Promise<PaymentMethod[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("payment_methods")
    .select("*")
    .order("kind", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function getRecurringSeries(): Promise<RecurringSeries[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("recurring_series")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function getTransactions(
  filters: TransactionFilters = {}
): Promise<TransactionWithRelations[]> {
  const supabase = await createClient();
  let query = supabase
    .from("transactions")
    .select("*, category:categories(*), subcategory:subcategories(*), payment_method:payment_methods(*)")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });

  if (filters.month && filters.year) {
    const start = `${filters.year}-${String(filters.month).padStart(2, "0")}-01`;
    const endMonth = filters.month === 12 ? 1 : filters.month + 1;
    const endYear = filters.month === 12 ? filters.year + 1 : filters.year;
    const end = `${endYear}-${String(endMonth).padStart(2, "0")}-01`;
    query = query.gte("date", start).lt("date", end);
  }
  if (filters.categoryId) {
    query = query.eq("category_id", filters.categoryId);
  }
  if (filters.paymentMethodId) {
    query = query.eq("payment_method_id", filters.paymentMethodId);
  }
  if (filters.type) {
    query = query.eq("type", filters.type);
  }
  if (filters.search) {
    query = query.ilike("description", `%${filters.search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as TransactionWithRelations[];
}

export interface DashboardSummary {
  totalReceitas: number;
  totalDespesas: number;
  saldo: number;
  porCategoria: { categoryId: string; name: string; color: string; total: number }[];
}

export function summarize(transactions: TransactionWithRelations[]): DashboardSummary {
  let totalReceitas = 0;
  let totalDespesas = 0;
  const porCategoriaMap = new Map<string, { name: string; color: string; total: number }>();

  for (const t of transactions) {
    const amount = Number(t.amount);
    if (t.type === "receita") {
      totalReceitas += amount;
    } else {
      totalDespesas += amount;
      const key = t.category_id ?? "sem-categoria";
      const existing = porCategoriaMap.get(key);
      const name = t.category?.name ?? "Sem categoria";
      const color = t.category?.color ?? "#94a3b8";
      if (existing) {
        existing.total += amount;
      } else {
        porCategoriaMap.set(key, { name, color, total: amount });
      }
    }
  }

  const porCategoria = Array.from(porCategoriaMap.entries())
    .map(([categoryId, v]) => ({ categoryId, ...v }))
    .sort((a, b) => b.total - a.total);

  return {
    totalReceitas,
    totalDespesas,
    saldo: totalReceitas - totalDespesas,
    porCategoria,
  };
}

export interface PurchaseWithProgress {
  purchase: Purchase & { category: Category | null };
  installments: Transaction[];
  paidCount: number;
  pendingCount: number;
  nextInstallment: Transaction | null;
  installmentValue: number;
}

export async function getPurchasesWithProgress(
  referenceDate = new Date()
): Promise<PurchaseWithProgress[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("purchases")
    .select("*, category:categories(*)")
    .order("first_due_date", { ascending: false });

  if (error) throw error;
  const purchases = (data ?? []) as unknown as (Purchase & { category: Category | null })[];
  if (!purchases.length) return [];

  const purchaseIds = purchases.map((p) => p.id);
  const { data: installmentsData, error: installmentsError } = await supabase
    .from("transactions")
    .select("*")
    .in("purchase_id", purchaseIds)
    .order("installment_number", { ascending: true });

  if (installmentsError) throw installmentsError;
  const installments = (installmentsData ?? []) as unknown as Transaction[];

  const todayStr = referenceDate.toISOString().slice(0, 10);

  return purchases.map((purchase) => {
    const items = installments.filter((t) => t.purchase_id === purchase.id);
    // Parcelas anteriores à "starting_installment" já eram pagas antes de o
    // usuário registrar a compra no app, então contam como pagas também.
    const paidBeforeStart = purchase.starting_installment - 1;
    const paidCount = paidBeforeStart + items.filter((t) => t.date < todayStr).length;
    const pendingItems = items.filter((t) => t.date >= todayStr);
    const nextInstallment = pendingItems[0] ?? null;
    return {
      purchase,
      installments: items,
      paidCount,
      pendingCount: pendingItems.length,
      nextInstallment,
      installmentValue: items[0] ? Number(items[0].amount) : 0,
    };
  });
}

export interface MonthlyCashFlow {
  month: string;
  parcelamentos: number;
  outrasDespesas: number;
  receitas: number;
  saldo: number;
}

export async function getMonthlyCashFlowProjection(monthsAhead = 6): Promise<MonthlyCashFlow[]> {
  const supabase = await createClient();
  const today = new Date();
  const start = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
  const endDate = new Date(today.getFullYear(), today.getMonth() + monthsAhead, 1);
  const end = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-01`;

  const { data, error } = await supabase
    .from("transactions")
    .select("date, amount, type, purchase_id")
    .gte("date", start)
    .lt("date", end);

  if (error) throw error;

  const byMonth = new Map<string, { parcelamentos: number; outrasDespesas: number; receitas: number }>();
  for (const t of (data ?? []) as { date: string; amount: number; type: TransactionType; purchase_id: string | null }[]) {
    const key = t.date.slice(0, 7);
    const bucket = byMonth.get(key) ?? { parcelamentos: 0, outrasDespesas: 0, receitas: 0 };
    const amount = Number(t.amount);
    if (t.type === "receita") {
      bucket.receitas += amount;
    } else if (t.purchase_id) {
      bucket.parcelamentos += amount;
    } else {
      bucket.outrasDespesas += amount;
    }
    byMonth.set(key, bucket);
  }

  const result: MonthlyCashFlow[] = [];
  for (let i = 0; i < monthsAhead; i++) {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const bucket = byMonth.get(key) ?? { parcelamentos: 0, outrasDespesas: 0, receitas: 0 };
    result.push({
      month: key,
      parcelamentos: bucket.parcelamentos,
      outrasDespesas: bucket.outrasDespesas,
      receitas: bucket.receitas,
      saldo: bucket.receitas - bucket.parcelamentos - bucket.outrasDespesas,
    });
  }
  return result;
}
