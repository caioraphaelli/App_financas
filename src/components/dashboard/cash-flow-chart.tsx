"use client";

import { Bar, CartesianGrid, ComposedChart, Line, XAxis } from "recharts";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatCurrency, MONTH_NAMES } from "@/lib/format";
import type { MonthlyCashFlow } from "@/lib/data/transactions";

const config: ChartConfig = {
  parcelamentos: { label: "Parcelamentos", color: "#eb6834" },
  outrasDespesas: { label: "Outras despesas", color: "#1baf7a" },
  receitas: { label: "Receitas", color: "#2a78d6" },
  saldo: { label: "Saldo", color: "#4a3aa7" },
};

export function CashFlowChart({ data }: { data: MonthlyCashFlow[] }) {
  const chartData = data.map((d) => {
    const [year, month] = d.month.split("-").map(Number);
    return { ...d, label: `${MONTH_NAMES[month - 1].slice(0, 3)}/${String(year).slice(2)}` };
  });

  const hasData = chartData.some(
    (d) => d.parcelamentos > 0 || d.outrasDespesas > 0 || d.receitas > 0
  );
  if (!hasData) {
    return (
      <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
        Nenhum lançamento futuro encontrado neste período.
      </div>
    );
  }

  return (
    <ChartContainer config={config} className="max-h-[280px] w-full">
      <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} />
        <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatCurrency(Number(value))} />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="parcelamentos" stackId="despesas" fill="var(--color-parcelamentos)" radius={[0, 0, 4, 4]} maxBarSize={40} />
        <Bar dataKey="outrasDespesas" stackId="despesas" fill="var(--color-outrasDespesas)" radius={[4, 4, 0, 0]} maxBarSize={40} />
        <Bar dataKey="receitas" fill="var(--color-receitas)" radius={4} maxBarSize={40} />
        <Line
          dataKey="saldo"
          type="monotone"
          stroke="var(--color-saldo)"
          strokeWidth={2}
          dot={{ r: 3, fill: "var(--color-saldo)" }}
        />
      </ComposedChart>
    </ChartContainer>
  );
}
