import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TransactionFilters } from "@/components/dashboard/transaction-filters";
import { TransactionsTable } from "@/components/dashboard/transactions-table";
import { TransactionFormDialog } from "@/components/dashboard/transaction-form-dialog";
import { ForecastFormDialog } from "@/components/dashboard/forecast-form-dialog";
import { ForecastsTable } from "@/components/dashboard/forecasts-table";
import { ExportCsvButton } from "@/components/dashboard/export-csv-button";
import { PurchaseFormDialog } from "@/components/dashboard/purchase-form-dialog";
import { PurchasesList } from "@/components/dashboard/purchases-list";
import { InstallmentsSummaryTable } from "@/components/dashboard/installments-summary-table";
import {
  getCategories,
  getPaymentMethods,
  getSubcategoriesByCategory,
  getTransactions,
  getUserSettings,
  getPurchasesWithProgress,
  getMonthlyInstallmentsSummary,
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

  const [categories, subcategoriesByCategory, paymentMethods, userSettings, purchases, monthlySummary] =
    await Promise.all([
      getCategories(),
      getSubcategoriesByCategory(),
      getPaymentMethods(),
      getUserSettings(),
      getPurchasesWithProgress(),
      getMonthlyInstallmentsSummary(12),
    ]);

  const showForecasts = classificacao === "previsao";
  // Sem filtro de classificação ("Todas as classificações"), o grid mistura
  // transações e previsões pendentes/não realizadas no mesmo lugar.
  const includeForecasts = !classificacao || showForecasts;

  const [transactions, forecastsRaw] = await Promise.all([
    showForecasts ? Promise.resolve([]) : getTransactions({ month, year, type, categoryId, paymentMethodId, search }),
    includeForecasts ? getForecasts({ month, year, type, categoryId, paymentMethodId, search }) : Promise.resolve([]),
  ]);

  // Fora da aba dedicada de previsões, previsões já convertidas não entram
  // no grid combinado — a transação real gerada por elas já aparece.
  const forecasts = showForecasts ? forecastsRaw : forecastsRaw.filter((f) => f.status !== "convertida");

  const filteredTransactions = transactions.filter((t) => {
    if (!classificacao || classificacao === "previsao") return true;
    if (classificacao === "fixa") return t.expense_kind === "fixa";
    if (t.expense_kind !== "parcelada_cartao" && t.expense_kind !== "parcelada_boleto") return false;
    const restantes = (t.installments_total ?? 0) - (t.installment_number ?? 0);
    const prazo = classificarPrazo(restantes, userSettings.limite_curto_prazo_meses);
    return classificacao === "parcelada_curto" ? prazo === "curto" : prazo === "longo";
  });

  const count = showForecasts ? forecasts.length : filteredTransactions.length + forecasts.length;
  const noun = showForecasts
    ? count === 1
      ? "previsão"
      : "previsões"
    : forecasts.length > 0
      ? count === 1
        ? "item"
        : "itens"
      : count === 1
        ? "transação"
        : "transações";

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Transações</h1>
        <p className="text-sm text-muted-foreground">
          Lançamentos, previsões e compras parceladas em um só lugar.
        </p>
      </div>

      <Tabs defaultValue="lancamentos">
        <TabsList>
          <TabsTrigger value="lancamentos">Lançamentos</TabsTrigger>
          <TabsTrigger value="parcelamentos">Parcelamentos</TabsTrigger>
        </TabsList>

        <TabsContent value="lancamentos" className="mt-4 grid gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {count} {noun} encontrada{count === 1 ? "" : "s"}
            </p>
            <div className="flex flex-wrap gap-2">
              <TransactionFormDialog
                categories={categories}
                subcategoriesByCategory={subcategoriesByCategory}
                paymentMethods={paymentMethods}
              />
              <ForecastFormDialog
                categories={categories}
                subcategoriesByCategory={subcategoriesByCategory}
                paymentMethods={paymentMethods}
              />
              <ExportCsvButton transactions={filteredTransactions} />
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
              forecasts={forecasts}
              categories={categories}
              subcategoriesByCategory={subcategoriesByCategory}
              paymentMethods={paymentMethods}
              purchases={purchases}
              limiteCurtoPrazoMeses={userSettings.limite_curto_prazo_meses}
            />
          )}
        </TabsContent>

        <TabsContent value="parcelamentos" className="mt-4 grid gap-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Compras parceladas no cartão ou boleto e quantas parcelas ainda faltam pagar.
            </p>
            <PurchaseFormDialog
              categories={categories}
              subcategoriesByCategory={subcategoriesByCategory}
              paymentMethods={paymentMethods}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Parcelamentos por mês</CardTitle>
              <CardDescription>
                Total de parcelas a vencer em cada mês, comparado com a receita e as outras despesas já
                programadas para o período.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <InstallmentsSummaryTable data={monthlySummary} />
            </CardContent>
          </Card>

          <PurchasesList
            items={purchases}
            categories={categories}
            subcategoriesByCategory={subcategoriesByCategory}
            paymentMethods={paymentMethods}
            limiteCurtoPrazoMeses={userSettings.limite_curto_prazo_meses}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
