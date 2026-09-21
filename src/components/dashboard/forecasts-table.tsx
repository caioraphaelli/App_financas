"use client";

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { InfoBadge } from "@/components/dashboard/info-badge";
import { EditChoiceButton } from "@/components/dashboard/edit-choice-button";
import { DeleteSeriesButton } from "@/components/dashboard/delete-series-button";
import { ForecastFormDialog } from "@/components/dashboard/forecast-form-dialog";
import { ForecastGroupEditDialog } from "@/components/dashboard/forecast-group-edit-dialog";
import { deleteForecast, deleteForecastGroup } from "@/lib/actions/forecasts";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Category, ForecastStatus, ForecastWithRelations, PaymentMethod, Subcategory } from "@/lib/types/database";

const STATUS_LABELS: Record<ForecastStatus, string> = {
  pendente: "Pendente",
  convertida: "Convertida",
  nao_realizada: "Não realizada",
};

const STATUS_EXPLANATIONS: Record<ForecastStatus, string> = {
  pendente: "A data prevista ainda não passou e essa previsão ainda não foi convertida em lançamento real.",
  convertida: "Essa previsão já virou um lançamento real (uma transação ou uma compra parcelada).",
  nao_realizada: "A data prevista já passou e essa previsão não foi convertida em lançamento real.",
};

export function ForecastsTable({
  forecasts,
  categories,
  subcategoriesByCategory,
  paymentMethods,
}: {
  forecasts: ForecastWithRelations[];
  categories: Category[];
  subcategoriesByCategory: Record<string, Subcategory[]>;
  paymentMethods: PaymentMethod[];
}) {
  const [editingForecast, setEditingForecast] = useState<ForecastWithRelations | null>(null);
  const [editingGroup, setEditingGroup] = useState<ForecastWithRelations | null>(null);

  if (forecasts.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
        Nenhuma previsão encontrada.
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
              <TableHead>Data prevista</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[90px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {forecasts.map((f) => {
              const editable = f.status !== "convertida";
              const hasGroup = Boolean(f.group_id);
              return (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">{f.description}</TableCell>
                  <TableCell>
                    {f.category ? (
                      <span className="inline-flex items-center gap-1.5 text-sm">
                        <span className="size-2 rounded-full" style={{ backgroundColor: f.category.color }} aria-hidden />
                        {f.category.name}
                      </span>
                    ) : (
                      <span className="text-sm text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-muted-foreground">{formatDate(f.data_prevista)}</TableCell>
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
                    <InfoBadge
                      variant={f.status === "convertida" ? "secondary" : "outline"}
                      className={f.status === "nao_realizada" ? "text-muted-foreground" : ""}
                      label={STATUS_LABELS[f.status]}
                      explanation={STATUS_EXPLANATIONS[f.status]}
                    />
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
