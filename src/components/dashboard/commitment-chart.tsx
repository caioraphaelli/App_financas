"use client";

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { formatCurrency, MONTH_NAMES } from "@/lib/format";

const config: ChartConfig = {
  total: { label: "Comprometido", color: "#2a78d6" },
};

export function CommitmentChart({ data }: { data: { month: string; total: number }[] }) {
  const chartData = data.map((d) => {
    const [year, month] = d.month.split("-").map(Number);
    return { ...d, label: `${MONTH_NAMES[month - 1].slice(0, 3)}/${String(year).slice(2)}` };
  });

  const hasData = chartData.some((d) => d.total > 0);
  if (!hasData) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
        Nenhuma parcela futura comprometida.
      </div>
    );
  }

  return (
    <ChartContainer config={config} className="max-h-[220px] w-full">
      <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="label" tickLine={false} axisLine={false} />
        <ChartTooltip content={<ChartTooltipContent formatter={(value) => formatCurrency(Number(value))} />} />
        <Bar dataKey="total" fill="var(--color-total)" radius={4} maxBarSize={40} />
      </BarChart>
    </ChartContainer>
  );
}
