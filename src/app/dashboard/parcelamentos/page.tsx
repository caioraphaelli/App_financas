import type { Metadata } from "next";
import { PurchaseFormDialog } from "@/components/dashboard/purchase-form-dialog";
import { PurchasesList } from "@/components/dashboard/purchases-list";
import {
  getCategories,
  getPaymentMethods,
  getSubcategoriesByCategory,
  getPurchasesWithProgress,
} from "@/lib/data/transactions";

export const metadata: Metadata = { title: "Parcelamentos — Finanças+" };

export default async function ParcelamentosPage() {
  const [categories, subcategoriesByCategory, paymentMethods, purchases] = await Promise.all([
    getCategories(),
    getSubcategoriesByCategory(),
    getPaymentMethods(),
    getPurchasesWithProgress(),
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

      <PurchasesList
        items={purchases}
        categories={categories}
        subcategoriesByCategory={subcategoriesByCategory}
        paymentMethods={paymentMethods}
      />
    </div>
  );
}
