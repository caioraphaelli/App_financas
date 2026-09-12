"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TransactionWithRelations } from "@/lib/types/database";
import { formatDate } from "@/lib/format";

function toCsvValue(value: string | number): string {
  const str = String(value);
  if (/[";\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function ExportCsvButton({ transactions }: { transactions: TransactionWithRelations[] }) {
  function handleExport() {
    const header = [
      "Data",
      "Tipo",
      "Descrição",
      "Categoria",
      "Subcategoria",
      "Valor",
      "Parcela",
    ];
    const rows = transactions.map((t) => [
      formatDate(t.date),
      t.type === "receita" ? "Receita" : "Despesa",
      t.description,
      t.category?.name ?? "",
      t.subcategory?.name ?? "",
      Number(t.amount).toFixed(2).replace(".", ","),
      t.installment_number && t.installments_total
        ? `${t.installment_number}/${t.installments_total}`
        : "",
    ]);

    const csv = [header, ...rows]
      .map((row) => row.map(toCsvValue).join(";"))
      .join("\n");

    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transacoes-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <Button variant="outline" onClick={handleExport} disabled={transactions.length === 0}>
      <Download className="size-4" />
      Exportar CSV
    </Button>
  );
}
