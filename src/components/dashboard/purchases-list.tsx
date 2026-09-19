"use client";

import { CreditCard, Landmark, Pencil } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DeleteButton } from "@/components/dashboard/delete-button";
import { PurchaseFormDialog } from "@/components/dashboard/purchase-form-dialog";
import { deletePurchase } from "@/lib/actions/transactions";
import { formatCurrency, formatDate } from "@/lib/format";
import { classificarPrazo, PRAZO_LABELS } from "@/lib/prazo";
import type { PurchaseWithProgress } from "@/lib/data/transactions";
import type { Category, PaymentMethod, Subcategory } from "@/lib/types/database";

export function PurchasesList({
  items,
  categories,
  subcategoriesByCategory,
  paymentMethods,
  limiteCurtoPrazoMeses,
}: {
  items: PurchaseWithProgress[];
  categories: Category[];
  subcategoriesByCategory: Record<string, Subcategory[]>;
  paymentMethods: PaymentMethod[];
  limiteCurtoPrazoMeses: number;
}) {
  if (items.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
        Nenhuma compra parcelada cadastrada.
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {items.map(({ purchase, paidCount, pendingCount, nextInstallment, installmentValue }) => {
        const total = purchase.installments_total;
        const progress = Math.round((paidCount / total) * 100);
        return (
          <Card key={purchase.id}>
            <CardContent className="grid gap-3 pt-6">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{purchase.description}</p>
                  {purchase.category && (
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: purchase.category.color }}
                        aria-hidden
                      />
                      {purchase.category.name}
                    </span>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  <PurchaseFormDialog
                    categories={categories}
                    subcategoriesByCategory={subcategoriesByCategory}
                    paymentMethods={paymentMethods}
                    purchase={purchase}
                    trigger={
                      <Button variant="ghost" size="icon">
                        <Pencil className="size-4" />
                      </Button>
                    }
                  />
                  <DeleteButton
                    title="Excluir compra parcelada"
                    description={`Isso excluirá "${purchase.description}" e todas as ${total} parcelas geradas. Essa ação não pode ser desfeita.`}
                    onDelete={() => deletePurchase(purchase.id)}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge variant="outline" className="gap-1">
                  {purchase.payment_method === "cartao" ? (
                    <CreditCard className="size-3" />
                  ) : (
                    <Landmark className="size-3" />
                  )}
                  {purchase.payment_method === "cartao" ? "Cartão" : "Boleto"}
                </Badge>
                <Badge variant="secondary">{formatCurrency(installmentValue)} / parcela</Badge>
                <Badge variant={pendingCount > 0 ? "default" : "outline"}>
                  {pendingCount > 0
                    ? PRAZO_LABELS[classificarPrazo(pendingCount, limiteCurtoPrazoMeses)]
                    : "Quitada"}
                </Badge>
              </div>

              <div className="grid gap-1">
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {paidCount} de {total} parcelas pagas · {pendingCount} pendente
                  {pendingCount === 1 ? "" : "s"}
                </p>
              </div>

              <div className="flex items-center justify-between border-t pt-3 text-sm">
                <span className="text-muted-foreground">Valor total</span>
                <span className="font-medium tabular-nums">{formatCurrency(Number(purchase.total_amount))}</span>
              </div>
              {nextInstallment && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Próxima parcela</span>
                  <span className="font-medium tabular-nums">{formatDate(nextInstallment.date)}</span>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
