"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InfoBadge } from "@/components/dashboard/info-badge";
import { EditChoiceButton } from "@/components/dashboard/edit-choice-button";
import { DeleteSeriesButton } from "@/components/dashboard/delete-series-button";
import { TransactionFormDialog } from "@/components/dashboard/transaction-form-dialog";
import { RecurringSeriesEditDialog } from "@/components/dashboard/recurring-series-edit-dialog";
import { PurchaseFormDialog } from "@/components/dashboard/purchase-form-dialog";
import { ForecastFormDialog } from "@/components/dashboard/forecast-form-dialog";
import { ForecastGroupEditDialog } from "@/components/dashboard/forecast-group-edit-dialog";
import { deletePurchase, deleteRecurringSeries, deleteTransaction } from "@/lib/actions/transactions";
import { deleteForecast, deleteForecastGroup } from "@/lib/actions/forecasts";
import { formatCurrency, formatDate } from "@/lib/format";
import { classificarPrazo, PRAZO_LABELS } from "@/lib/prazo";
import type { PurchaseWithProgress } from "@/lib/data/transactions";
import type {
  Category,
  ForecastStatus,
  ForecastWithRelations,
  PaymentMethod,
  Purchase,
  Subcategory,
  TransactionWithRelations,
} from "@/lib/types/database";

const FORECAST_STATUS_LABELS: Record<ForecastStatus, string> = {
  pendente: "Pendente",
  convertida: "Convertida",
  nao_realizada: "Não realizada",
};

const FORECAST_STATUS_EXPLANATIONS: Record<ForecastStatus, string> = {
  pendente: "A data prevista ainda não passou e essa previsão ainda não foi convertida em lançamento real.",
  convertida: "Essa previsão já virou um lançamento real (uma transação ou uma compra parcelada).",
  nao_realizada: "A data prevista já passou e essa previsão não foi convertida em lançamento real.",
};

const PRAZO_EXPLANATIONS = {
  curto: "Faltam poucas parcelas/meses para o fim, dentro do limite de curto prazo configurado em Cadastros.",
  longo: "Ainda falta bastante tempo para o fim, acima do limite de curto prazo configurado em Cadastros.",
} as const;

type Row =
  | { kind: "transacao"; date: string; transacao: TransactionWithRelations }
  | { kind: "previsao"; date: string; previsao: ForecastWithRelations };

export function TransactionsTable({
  transactions,
  forecasts,
  categories,
  subcategoriesByCategory,
  paymentMethods,
  purchases,
  limiteCurtoPrazoMeses,
}: {
  transactions: TransactionWithRelations[];
  forecasts?: ForecastWithRelations[];
  categories: Category[];
  subcategoriesByCategory: Record<string, Subcategory[]>;
  paymentMethods: PaymentMethod[];
  purchases?: PurchaseWithProgress[];
  limiteCurtoPrazoMeses: number;
}) {
  const [editingTransaction, setEditingTransaction] = useState<TransactionWithRelations | null>(null);
  const [editingSeries, setEditingSeries] = useState<TransactionWithRelations | null>(null);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [editingForecast, setEditingForecast] = useState<ForecastWithRelations | null>(null);
  const [editingGroup, setEditingGroup] = useState<ForecastWithRelations | null>(null);

  const purchasesById = new Map((purchases ?? []).map((p) => [p.purchase.id, p.purchase]));

  const rows: Row[] = [
    ...transactions.map((t): Row => ({ kind: "transacao", date: t.date, transacao: t })),
    ...(forecasts ?? []).map((f): Row => ({ kind: "previsao", date: f.data_prevista, previsao: f })),
  ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  if (rows.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
        Nenhuma transação encontrada para este filtro.
      </div>
    );
  }

  return (
    <>
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
            {rows.map((row) => {
              if (row.kind === "transacao") {
                const t = row.transacao;
                const isRecurring = Boolean(t.recurring_series_id);
                const isParcelada = Boolean(t.purchase_id);
                const hasSeries = isRecurring || isParcelada;
                return (
                  <TableRow key={`t-${t.id}`}>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-medium">{t.description}</span>
                        {t.installment_number && t.installments_total && (
                          <>
                            <InfoBadge
                              variant="secondary"
                              label={`Parcela ${t.installment_number}/${t.installments_total}`}
                              explanation={`Esta é a parcela ${t.installment_number} de ${t.installments_total} de uma compra parcelada.`}
                            />
                            {(() => {
                              const prazo = classificarPrazo(
                                t.installments_total - t.installment_number,
                                limiteCurtoPrazoMeses
                              );
                              return (
                                <InfoBadge
                                  label={PRAZO_LABELS[prazo]}
                                  explanation={PRAZO_EXPLANATIONS[prazo]}
                                />
                              );
                            })()}
                          </>
                        )}
                        {t.expense_kind === "fixa" && (
                          <InfoBadge
                            label="Despesa Fixa"
                            explanation="Despesa que se repete todo mês com o mesmo valor, como aluguel ou assinaturas."
                          />
                        )}
                        {t.recurring_series_id && (
                          <InfoBadge
                            variant="secondary"
                            label="Recorrente"
                            explanation="Este lançamento foi gerado automaticamente por uma recorrência (fixa) cadastrada, repetida mês a mês."
                          />
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
                        <EditChoiceButton
                          hasSeries={hasSeries}
                          onChooseSingle={() => setEditingTransaction(t)}
                          onChooseSeries={() => {
                            if (isParcelada) {
                              const purchase = purchasesById.get(t.purchase_id!);
                              if (purchase) setEditingPurchase(purchase);
                            } else {
                              setEditingSeries(t);
                            }
                          }}
                        />
                        <DeleteSeriesButton
                          title={hasSeries ? "Excluir lançamento" : "Excluir transação"}
                          description={`Tem certeza que deseja excluir "${t.description}"? Essa ação não pode ser desfeita.`}
                          hasSeries={hasSeries}
                          seriesDescription={
                            isParcelada
                              ? `"${t.description}" faz parte de uma compra parcelada. Você quer excluir só esta parcela, ou toda a série (isso apaga também as demais parcelas)?`
                              : `"${t.description}" faz parte de uma recorrência fixa. Você quer excluir só esta ocorrência, ou toda a série (isso apaga também as demais ocorrências geradas)?`
                          }
                          onDeleteSingle={() => deleteTransaction(t.id)}
                          onDeleteSeries={() =>
                            isParcelada ? deletePurchase(t.purchase_id!) : deleteRecurringSeries(t.recurring_series_id!)
                          }
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                );
              }

              const f = row.previsao;
              const editable = f.status !== "convertida";
              const hasGroup = Boolean(f.group_id);
              return (
                <TableRow key={`f-${f.id}`}>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-medium">{f.description}</span>
                      <InfoBadge
                        label="Previsão"
                        explanation="Estimativa de receita ou despesa futura que você cadastrou, ainda não confirmada como um lançamento real."
                      />
                      <InfoBadge
                        variant={f.status === "convertida" ? "secondary" : "outline"}
                        className={f.status === "nao_realizada" ? "text-muted-foreground" : ""}
                        label={FORECAST_STATUS_LABELS[f.status]}
                        explanation={FORECAST_STATUS_EXPLANATIONS[f.status]}
                      />
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {f.category ? (
                        <span className="inline-flex items-center gap-1.5 text-sm">
                          <span
                            className="size-2 rounded-full"
                            style={{ backgroundColor: f.category.color }}
                            aria-hidden
                          />
                          {f.category.name}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                      {f.payment_method && (
                        <span className="text-xs text-muted-foreground">· {f.payment_method.name}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {formatDate(f.data_prevista)}
                  </TableCell>
                  <TableCell
                    className={
                      "text-right font-medium tabular-nums " +
                      (f.type === "receita" ? "text-[#006300]" : "text-[#d03b3b]")
                    }
                  >
                    {f.type === "despesa" ? "- " : "+ "}
                    {formatCurrency(Number(f.amount))}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      {editable && (
                        <EditChoiceButton
                          hasSeries={hasGroup}
                          onChooseSingle={() => setEditingForecast(f)}
                          onChooseSeries={() => setEditingGroup(f)}
                        />
                      )}
                      <DeleteSeriesButton
                        title="Excluir previsão"
                        description={`Tem certeza que deseja excluir a previsão "${f.description}"?`}
                        hasSeries={hasGroup}
                        seriesDescription={`"${f.description}" faz parte de uma previsão repetida. Você quer excluir só esta ocorrência, ou toda a série? Previsões já convertidas não são afetadas pela exclusão da série.`}
                        onDeleteSingle={() => deleteForecast(f.id)}
                        onDeleteSeries={() => deleteForecastGroup(f.group_id!)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {editingTransaction && (
        <TransactionFormDialog
          categories={categories}
          subcategoriesByCategory={subcategoriesByCategory}
          paymentMethods={paymentMethods}
          transaction={editingTransaction}
          trigger={null}
          open={Boolean(editingTransaction)}
          onOpenChange={(open) => !open && setEditingTransaction(null)}
        />
      )}

      {editingSeries && (
        <RecurringSeriesEditDialog
          transaction={editingSeries}
          categories={categories}
          subcategoriesByCategory={subcategoriesByCategory}
          paymentMethods={paymentMethods}
          open={Boolean(editingSeries)}
          onOpenChange={(open) => !open && setEditingSeries(null)}
        />
      )}

      {editingPurchase && (
        <PurchaseFormDialog
          categories={categories}
          subcategoriesByCategory={subcategoriesByCategory}
          paymentMethods={paymentMethods}
          purchase={editingPurchase}
          trigger={null}
          open={Boolean(editingPurchase)}
          onOpenChange={(open) => !open && setEditingPurchase(null)}
        />
      )}

      {editingForecast && (
        <ForecastFormDialog
          categories={categories}
          subcategoriesByCategory={subcategoriesByCategory}
          paymentMethods={paymentMethods}
          forecast={editingForecast}
          trigger={null}
          open={Boolean(editingForecast)}
          onOpenChange={(open) => !open && setEditingForecast(null)}
        />
      )}

      {editingGroup && (
        <ForecastGroupEditDialog
          forecast={editingGroup}
          categories={categories}
          subcategoriesByCategory={subcategoriesByCategory}
          paymentMethods={paymentMethods}
          open={Boolean(editingGroup)}
          onOpenChange={(open) => !open && setEditingGroup(null)}
        />
      )}
    </>
  );
}
