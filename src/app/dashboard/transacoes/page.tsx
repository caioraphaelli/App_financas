import type { Metadata } from "next";
import { TransactionFilters } from "@/components/dashboard/transaction-filters";
import { TransactionsTable } from "@/components/dashboard/transactions-table";
import { TransactionFormDialog } from "@/components/dashboard/transaction-form-dialog";
import { ExportCsvButton } from "@/components/dashboard/export-csv-button";
import {
  getCategories,
  getPaymentMethods,
  getSubcategoriesByCategory,
  getTransactions,
} from "@/lib/data/transactions";
import type { TransactionType } from "@/lib/types/database";

export const metadata: Metadata = { title: "Transações — Finanças+" };

export default async function TransacoesPage({
  searchParams,
}: {
  searchParams: Promise<{
    month?: string;
    year?: string;
    type?: string;
    category?: string;
    payment_method?: string;
    search?: string;
  }>;
}) {
  const params = await searchParams;
  const now = new Date();
  const month = Number(params.month) || now.getMonth() + 1;
  const year = Number(params.year) || now.getFullYear();
  const type = (params.type as TransactionType | undefined) || undefined;
  const categoryId = params.category || undefined;
  const paymentMethodId = params.payment_method || undefined;
  const search = params.search || undefined;

  const [categories, subcategoriesByCategory, paymentMethods, transactions] = await Promise.all([
    getCategories(),
    getSubcategoriesByCategory(),
    getPaymentMethods(),
    getTransactions({ month, year, type, categoryId, paymentMethodId, search }),
  ]);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Transações</h1>
          <p className="text-sm text-muted-foreground">
            {transactions.length} transaç{transactions.length === 1 ? "ão" : "ões"} encontrada
            {transactions.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex gap-2">
          <ExportCsvButton transactions={transactions} />
          <TransactionFormDialog
            categories={categories}
            subcategoriesByCategory={subcategoriesByCategory}
            paymentMethods={paymentMethods}
          />
        </div>
      </div>

      <TransactionFilters
        categories={categories}
        paymentMethods={paymentMethods}
        month={month}
        year={year}
      />

      <TransactionsTable
        transactions={transactions}
        categories={categories}
        subcategoriesByCategory={subcategoriesByCategory}
        paymentMethods={paymentMethods}
      />
    </div>
  );
}
