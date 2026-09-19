"use client";

import { useState } from "react";
import { Layers, Pencil, RefreshCcw } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ForecastFormDialog } from "@/components/dashboard/forecast-form-dialog";
import { ForecastGroupEditDialog } from "@/components/dashboard/forecast-group-edit-dialog";
import { ForecastConvertDialog } from "@/components/dashboard/forecast-convert-dialog";
import { DeleteButton } from "@/components/dashboard/delete-button";
import { deleteForecast, deleteForecastGroup } from "@/lib/actions/forecasts";
import { formatCurrency, formatDate } from "@/lib/format";
import type { Category, ForecastWithRelations, PaymentMethod, Subcategory } from "@/lib/types/database";

const STATUS_LABELS = {
  pendente: "Pendente",
  convertida: "Convertida",
  nao_realizada: "Não realizada",
} as const;

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
  const [converting, setConverting] = useState<ForecastWithRelations | null>(null);
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
              <TableHead className="w-[120px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {forecasts.map((f) => {
              const editable = f.status !== "convertida";
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
                    <Badge
                      variant={f.status === "convertida" ? "secondary" : "outline"}
                      className={f.status === "nao_realizada" ? "text-muted-foreground" : ""}
                    >
                      {STATUS_LABELS[f.status]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      {editable && (
                        <>
                          <Button variant="ghost" size="icon" title="Converter" onClick={() => setConverting(f)}>
                            <RefreshCcw className="size-4" />
                          </Button>
                          <ForecastFormDialog
                            categories={categories}
                            subcategoriesByCategory={subcategoriesByCategory}
                            paymentMethods={paymentMethods}
                            forecast={f}
                            trigger={
                              <Button variant="ghost" size="icon" title="Editar">
                                <Pencil className="size-4" />
                              </Button>
                            }
                          />
                          {f.group_id && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Editar toda a série"
                              onClick={() => setEditingGroup(f)}
                            >
                              <Layers className="size-4" />
                            </Button>
                          )}
                        </>
                      )}
                      <DeleteButton
                        title="Excluir previsão"
                        description={`Tem certeza que deseja excluir a previsão "${f.description}"?`}
                        onDelete={() => deleteForecast(f.id)}
                      />
                      {f.group_id && (
                        <DeleteButton
                          title="Excluir série de previsões"
                          description={`Tem certeza que deseja excluir todas as previsões da série "${f.description}"? Previsões já convertidas não serão afetadas.`}
                          onDelete={() => deleteForecastGroup(f.group_id!)}
                          trigger={
                            <Button variant="ghost" size="icon" title="Excluir toda a série">
                              <Layers className="size-4 text-destructive" />
                            </Button>
                          }
                        />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {converting && (
        <ForecastConvertDialog
          forecast={converting}
          categories={categories}
          subcategoriesByCategory={subcategoriesByCategory}
          paymentMethods={paymentMethods}
          open={Boolean(converting)}
          onOpenChange={(open) => !open && setConverting(null)}
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
