import type { Metadata } from "next";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PurchaseFormDialog } from "@/components/dashboard/purchase-form-dialog";
import { PurchasesList } from "@/components/dashboard/purchases-list";
import { CommitmentChart } from "@/components/dashboard/commitment-chart";
import {
  getCategories,
  getSubcategoriesByCategory,
  getPurchasesWithProgress,
  getUpcomingCommitments,
} from "@/lib/data/transactions";

export const metadata: Metadata = { title: "Parcelamentos — Finanças+" };

export default async function ParcelamentosPage() {
  const [categories, subcategoriesByCategory, purchases, commitments] = await Promise.all([
    getCategories(),
    getSubcategoriesByCategory(),
    getPurchasesWithProgress(),
    getUpcomingCommitments(6),
  ]);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Parcelamentos</h1>
          <p className="text-sm text-muted-foreground">
            Compras parceladas no cartão ou boleto e quanto da sua renda futura já está comprometido.
          </p>
        </div>
        <PurchaseFormDialog categories={categories} subcategoriesByCategory={subcategoriesByCategory} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Renda comprometida nos próximos 6 meses</CardTitle>
          <CardDescription>Soma das parcelas pendentes por mês de vencimento.</CardDescription>
        </CardHeader>
        <CardContent>
          <CommitmentChart data={commitments} />
        </CardContent>
      </Card>

      <PurchasesList items={purchases} />
    </div>
  );
}
