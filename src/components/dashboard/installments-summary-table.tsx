import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MonthlyInstallmentsSummary } from "@/lib/data/transactions";

export function InstallmentsSummaryTable({ data }: { data: MonthlyInstallmentsSummary[] }) {
  const hasData = data.some((m) => m.parcelamentos > 0 || m.receitas > 0 || m.outrasDespesas > 0);

  if (!hasData) {
    return (
      <div className="flex h-32 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
        Nenhum lançamento futuro encontrado neste período.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Mês</TableHead>
            <TableHead className="text-right">Receita</TableHead>
            <TableHead className="text-right">Parcelamentos</TableHead>
            <TableHead className="text-right">Outras despesas</TableHead>
            <TableHead className="text-right">Saldo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((m) => (
            <TableRow key={m.month}>
              <TableCell className="font-medium">{m.label}</TableCell>
              <TableCell className="text-right tabular-nums text-[#006300]">
                {m.receitas > 0 ? `+ ${formatCurrency(m.receitas)}` : formatCurrency(0)}
              </TableCell>
              <TableCell className="text-right tabular-nums text-[#d03b3b]">
                {m.parcelamentos > 0 ? `- ${formatCurrency(m.parcelamentos)}` : formatCurrency(0)}
              </TableCell>
              <TableCell className="text-right tabular-nums text-[#d03b3b]">
                {m.outrasDespesas > 0 ? `- ${formatCurrency(m.outrasDespesas)}` : formatCurrency(0)}
              </TableCell>
              <TableCell
                className={cn(
                  "text-right font-medium tabular-nums",
                  m.saldo < 0 ? "text-[#d03b3b]" : "text-[#006300]"
                )}
              >
                {formatCurrency(m.saldo)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
