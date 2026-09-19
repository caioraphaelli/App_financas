"use client";

import { Pencil, RepeatIcon } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TransactionFormDialog } from "@/components/dashboard/transaction-form-dialog";
import { DeleteButton } from "@/components/dashboard/delete-button";
import { deleteRecurringSeries, deleteTransaction } from "@/lib/actions/transactions";
import { formatCurrency, formatDate } from "@/lib/format";
import { classificarPrazo, PRAZO_LABELS } from "@/lib/prazo";
import type { Category, PaymentMethod, Subcategory, TransactionWithRelations } from "@/lib/types/database";

export function TransactionsTable({
  transactions,
  categories,
  subcategoriesByCategory,
  paymentMethods,
  limiteCurtoPrazoMeses,
}: {
  transactions: TransactionWithRelations[];
  categories: Category[];
  subcategoriesByCategory: Record<string, Subcategory[]>;
  paymentMethods: PaymentMethod[];
  limiteCurtoPrazoMeses: number;
}) {
  if (transactions.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
        Nenhuma transação encontrada para este filtro.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Descrição</TableHead>
            <TableHead>Categoria</TableHead>
            <TableHead>Data</TableHead>
            <TableHead className="text-right">Valor</TableHead>
            <TableHead className="w-[90px]" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((t) => (
            <TableRow key={t.id}>
              <TableCell>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-medium">{t.description}</span>
                  {t.installment_number && t.installments_total && (
                    <>
                      <Badge variant="secondary" className="w-fit text-xs">
                        Parcela {t.installment_number}/{t.installments_total}
                      </Badge>
                      <Badge variant="outline" className="w-fit text-xs">
                        {PRAZO_LABELS[classificarPrazo(t.installments_total - t.installment_number, limiteCurtoPrazoMeses)]}
                      </Badge>
                    </>
                  )}
                  {t.expense_kind === "fixa" && (
                    <Badge variant="outline" className="w-fit text-xs">
                      Despesa Fixa
                    </Badge>
                  )}
                  {t.recurring_series_id && (
                    <Badge variant="secondary" className="w-fit text-xs">
                      Recorrente
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap items-center gap-1.5">
                  {t.category ? (
                    <span className="inline-flex items-center gap-1.5 text-sm">
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: t.category.color }}
                        aria-hidden
                      />
                      {t.category.name}
                    </span>
                  ) : (
                    <span className="text-sm text-muted-foreground">—</span>
                  )}
                  {t.payment_method && (
                    <span className="text-xs text-muted-foreground">· {t.payment_method.name}</span>
                  )}
                </div>
              </TableCell>
              <TableCell className="whitespace-nowrap text-muted-foreground">
                {formatDate(t.date)}
              </TableCell>
              <TableCell
                className={
                  "text-right font-medium tabular-nums " +
                  (t.type === "receita" ? "text-[#006300]" : "text-[#d03b3b]")
                }
              >
                {t.type === "despesa" ? "- " : "+ "}
                {formatCurrency(Number(t.amount))}
              </TableCell>
              <TableCell>
                <div className="flex justify-end gap-1">
                  <TransactionFormDialog
                    categories={categories}
                    subcategoriesByCategory={subcategoriesByCategory}
                    paymentMethods={paymentMethods}
                    transaction={t}
                    trigger={
                      <Button variant="ghost" size="icon">
                        <Pencil className="size-4" />
                      </Button>
                    }
                  />
                  <DeleteButton
                    title="Excluir transação"
                    description={`Tem certeza que deseja excluir "${t.description}"? Essa ação não pode ser desfeita.`}
                    onDelete={() => deleteTransaction(t.id)}
                  />
                  {t.recurring_series_id && (
                    <DeleteButton
                      title="Cancelar recorrência"
                      description="Isso exclui esta e todas as demais ocorrências futuras/geradas dessa série recorrente."
                      onDelete={() => deleteRecurringSeries(t.recurring_series_id!)}
                      trigger={
                        <Button variant="ghost" size="icon" title="Cancelar recorrência">
                          <RepeatIcon className="size-4 text-muted-foreground" />
                        </Button>
                      }
                    />
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
