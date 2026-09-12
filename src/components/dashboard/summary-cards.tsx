import { ArrowDownCircle, ArrowUpCircle, Scale } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

export function SummaryCards({
  totalReceitas,
  totalDespesas,
  saldo,
}: {
  totalReceitas: number;
  totalDespesas: number;
  saldo: number;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Receitas</CardTitle>
          <ArrowUpCircle className="size-4 text-[#008300]" />
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold tabular-nums">{formatCurrency(totalReceitas)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Despesas</CardTitle>
          <ArrowDownCircle className="size-4 text-[#d03b3b]" />
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold tabular-nums">{formatCurrency(totalDespesas)}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Saldo</CardTitle>
          <Scale className="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <p
            className={cn(
              "text-2xl font-semibold tabular-nums",
              saldo >= 0 ? "text-[#006300]" : "text-[#d03b3b]"
            )}
          >
            {formatCurrency(saldo)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
