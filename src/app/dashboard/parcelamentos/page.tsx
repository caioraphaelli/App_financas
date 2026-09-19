import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PurchaseFormDialog } from "@/components/dashboard/purchase-form-dialog";
import { PurchasesList } from "@/components/dashboard/purchases-list";
import { InstallmentsSummaryTable } from "@/components/dashboard/installments-summary-table";
import {
  getCategories,
  getPaymentMethods,
  getSubcategoriesByCategory,
  getPurchasesWithProgress,
  getMonthlyInstallmentsSummary,
  getUserSettings,
} from "@/lib/data/transactions";

export const metadata: Metadata = { title: "Parcelamentos — Finanças+" };

export default async function ParcelamentosPage() {
  const [categories, subcategoriesByCategory, paymentMethods, purchases, monthlySummary, userSettings] =
    await Promise.all([
      getCategories(),
      getSubcategoriesByCategory(),
      getPaymentMethods(),
      getPurchasesWithProgress(),
      getMonthlyInstallmentsSummary(6),
      getUserSettings(),
    ]);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Parcelamentos</h1>
          <p className="text-sm text-muted-foreground">
            Compras parceladas no cartão ou boleto e quantas parcelas ainda faltam pagar.
          </p>
        </div>
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
    </div>
  );
}
