"use client";

import { Cell, Pie, PieChart } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { formatCurrency } from "@/lib/format";

export interface CategorySlice {
  categoryId: string;
  name: string;
  color: string;
  total: number;
}

export function CategoryPieChart({ data }: { data: CategorySlice[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
        Nenhuma despesa registrada neste período.
      </div>
    );
  }

  const total = data.reduce((acc, d) => acc + d.total, 0);
  const config: ChartConfig = Object.fromEntries(
    data.map((d) => [d.categoryId, { label: d.name, color: d.color }])
  );

  return (
    <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
      <ChartContainer config={config} className="mx-auto aspect-square max-h-[280px]">
        <PieChart>
          <ChartTooltip
            content={
              <ChartTooltipContent
                nameKey="name"
                formatter={(value) => formatCurrency(Number(value))}
              />
            }
          />
          <Pie data={data} dataKey="total" nameKey="name" innerRadius={60} outerRadius={100} strokeWidth={2}>
            {data.map((entry) => (
              <Cell key={entry.categoryId} fill={entry.color} stroke="var(--card)" />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>

      <ul className="grid gap-2 text-sm">
        {data.map((d) => (
          <li key={d.categoryId} className="flex items-center gap-2">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: d.color }}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate">{d.name}</span>
            <span className="font-medium tabular-nums">{formatCurrency(d.total)}</span>
            <span className="w-12 text-right text-xs text-muted-foreground tabular-nums">
              {total > 0 ? Math.round((d.total / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
