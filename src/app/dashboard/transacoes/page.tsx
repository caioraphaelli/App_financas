import type { Metadata } from "next";
import { TransactionFilters } from "@/components/dashboard/transaction-filters";
import { TransactionsTable } from "@/components/dashboard/transactions-table";
import { TransactionFormDialog } from "@/components/dashboard/transaction-form-dialog";
import { ForecastFormDialog } from "@/components/dashboard/forecast-form-dialog";
import { ForecastsTable } from "@/components/dashboard/forecasts-table";
import { ExportCsvButton } from "@/components/dashboard/export-csv-button";
import {
  getCategories,
  getPaymentMethods,
  getSubcategoriesByCategory,
  getTransactions,
  getUserSettings,
} from "@/lib/data/transactions";
import { getForecasts } from "@/lib/data/forecasts";
import { classificarPrazo } from "@/lib/prazo";
import type { TransactionType } from "@/lib/types/database";

export const metadata: Metadata = { title: "Transações — Finanças+" };

type Classificacao = "fixa" | "parcelada_curto" | "parcelada_longo" | "previsao";

export default async function TransacoesPage({
  searchParams,
}: {
  searchParams: Promise<{
    month?: string;
    year?: string;
    type?: string;
    category?: string;
    payment_method?: string;
    classificacao?: string;
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
  const classificacao = (params.classificacao as Classificacao | undefined) || undefined;

  const [categories, subcategoriesByCategory, paymentMethods, userSettings] = await Promise.all([
    getCategories(),
    getSubcategoriesByCategory(),
    getPaymentMethods(),
    getUserSettings(),
  ]);

  const showForecasts = classificacao === "previsao";

  const [transactions, forecasts] = await Promise.all([
    showForecasts ? Promise.resolve([]) : getTransactions({ month, year, type, categoryId, paymentMethodId, search }),
    showForecasts ? getForecasts({ month, year, type, categoryId, paymentMethodId, search }) : Promise.resolve([]),
  ]);

  const filteredTransactions = transactions.filter((t) => {
    if (!classificacao || classificacao === "previsao") return true;
    if (classificacao === "fixa") return t.expense_kind === "fixa";
    if (t.expense_kind !== "parcelada_cartao" && t.expense_kind !== "parcelada_boleto") return false;
    const restantes = (t.installments_total ?? 0) - (t.installment_number ?? 0);
    const prazo = classificarPrazo(restantes, userSettings.limite_curto_prazo_meses);
    return classificacao === "parcelada_curto" ? prazo === "curto" : prazo === "longo";
  });

  const count = showForecasts ? forecasts.length : filteredTransactions.length;
  const noun = showForecasts ? (count === 1 ? "previsão" : "previsões") : count === 1 ? "transação" : "transações";

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Transações</h1>
          <p className="text-sm text-muted-foreground">
            {count} {noun} encontrada{count === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <ExportCsvButton transactions={filteredTransactions} />
          <ForecastFormDialog
            categories={categories}
            subcategoriesByCategory={subcategoriesByCategory}
            paymentMethods={paymentMethods}
          />
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

      {showForecasts ? (
        <ForecastsTable
          forecasts={forecasts}
          categories={categories}
          subcategoriesByCategory={subcategoriesByCategory}
          paymentMethods={paymentMethods}
        />
      ) : (
        <TransactionsTable
          transactions={filteredTransactions}
          categories={categories}
          subcategoriesByCategory={subcategoriesByCategory}
          paymentMethods={paymentMethods}
          limiteCurtoPrazoMeses={userSettings.limite_curto_prazo_meses}
        />
      )}
    </div>
  );
}
