import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PeriodFilter } from "@/components/dashboard/period-filter";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { CategoryPieChart } from "@/components/dashboard/category-pie-chart";
import { getTransactions, summarize } from "@/lib/data/transactions";
import { formatCurrency, formatDate, monthLabel } from "@/lib/format";

export const metadata: Metadata = { title: "Dashboard — Finanças+" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  const params = await searchParams;
  const now = new Date();
  const month = Number(params.month) || now.getMonth() + 1;
  const year = Number(params.year) || now.getFullYear();

  const transactions = await getTransactions({ month, year });
  const summary = summarize(transactions);
  const recent = transactions.slice(0, 6);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Visão Geral</h1>
          <p className="text-sm text-muted-foreground">{monthLabel(month, year)}</p>
        </div>
        <PeriodFilter month={month} year={year} />
      </div>

      <SummaryCards
        totalReceitas={summary.totalReceitas}
        totalDespesas={summary.totalDespesas}
        saldo={summary.saldo}
      />

      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Despesas por categoria</CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryPieChart data={summary.porCategoria} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Últimas transações</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/dashboard/transacoes">
                Ver todas
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {recent.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma transação neste período.</p>
            ) : (
              <ul className="grid gap-3">
                {recent.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 text-sm">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{t.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(t.date)} {t.category ? `· ${t.category.name}` : ""}
                      </p>
                    </div>
                    <span
                      className={
                        "shrink-0 font-medium tabular-nums " +
                        (t.type === "receita" ? "text-[#006300]" : "text-[#d03b3b]")
                      }
                    >
                      {t.type === "despesa" ? "- " : "+ "}
                      {formatCurrency(Number(t.amount))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
