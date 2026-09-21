import Link from "next/link";
import type { Metadata } from "next";
import { Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardFilters } from "@/components/dashboard/dashboard-filters";
import { SummaryCards } from "@/components/dashboard/summary-cards";
import { FluxoCaixaTable } from "@/components/dashboard/fluxo-caixa-table";
import { RendaComprometidaStrip } from "@/components/dashboard/renda-comprometida-strip";
import { OrcadoRealizadoSection } from "@/components/dashboard/orcado-realizado-table";
import { getMonthlyInstallmentsSummary, getTransactions, summarize } from "@/lib/data/transactions";
import { getFluxoCaixaComparison } from "@/lib/data/fluxo-caixa";
import { getOrcadoVsRealizado } from "@/lib/data/orcado-realizado";
import { monthLabel } from "@/lib/format";

export const metadata: Metadata = { title: "Dashboard — Finanças+" };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string; fluxoMeses?: string }>;
}) {
  const params = await searchParams;
  const now = new Date();
  const month = Number(params.month) || now.getMonth() + 1;
  const year = Number(params.year) || now.getFullYear();
  const fluxoMeses = Number(params.fluxoMeses) || 6;

  const [transactions, fluxo, comprometimento, orcadoRealizado] = await Promise.all([
    getTransactions({ month, year }),
    getFluxoCaixaComparison(month, year, fluxoMeses),
    getMonthlyInstallmentsSummary(6),
    getOrcadoVsRealizado(month, year),
  ]);
  const summary = summarize(transactions);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Visão Geral</h1>
          <p className="text-sm text-muted-foreground">{monthLabel(month, year)}</p>
        </div>
        <DashboardFilters month={month} year={year} fluxoMeses={fluxoMeses} />
      </div>

      <SummaryCards
        totalReceitas={summary.totalReceitas}
        totalDespesas={summary.totalDespesas}
        saldo={summary.saldo}
      />

      <Tabs defaultValue="fluxo">
        <TabsList>
          <TabsTrigger value="fluxo">Fluxo de Caixa</TabsTrigger>
          <TabsTrigger value="orcado">Previsto vs Realizado</TabsTrigger>
        </TabsList>

        <TabsContent value="fluxo" className="mt-4 grid gap-5">
          <FluxoCaixaTable data={fluxo} />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">% da renda comprometida (próximos 6 meses)</CardTitle>
              <CardDescription>Total de despesas do mês dividido pela receita do mês.</CardDescription>
            </CardHeader>
            <CardContent>
              <RendaComprometidaStrip data={comprometimento} />
            </CardContent>
          </Card>

          <div>
            <h2 className="text-lg font-semibold">Comparativo Mensal</h2>
            <p className="text-sm text-muted-foreground">
              Começa em {monthLabel(month, year)} (mês do filtro acima) e segue para os meses
              seguintes. Clique em uma conta para abrir o detalhamento por forma de pagamento,
              categoria e prazo. O percentual ao lado de cada valor é a análise vertical (% em
              relação à receita do mês).
            </p>
          </div>
        </TabsContent>

        <TabsContent value="orcado" className="mt-4 grid gap-6">
          <Card>
            <CardContent className="grid gap-8 pt-6">
              <OrcadoRealizadoSection
                title="Receitas"
                linhas={orcadoRealizado.receitas}
                kind="receita"
                totalOrcado={orcadoRealizado.totalOrcadoReceitas}
                totalRealizado={orcadoRealizado.totalRealizadoReceitas}
              />
              <OrcadoRealizadoSection
                title="Despesas"
                linhas={orcadoRealizado.despesas}
                kind="despesa"
                totalOrcado={orcadoRealizado.totalOrcadoDespesas}
                totalRealizado={orcadoRealizado.totalRealizadoDespesas}
              />
            </CardContent>
          </Card>

          {orcadoRealizado.totalOrcadoReceitas === 0 && orcadoRealizado.totalOrcadoDespesas === 0 && (
            <div className="flex items-start gap-2 rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
              <Info className="mt-0.5 size-4 shrink-0" />
              <p>
                Nenhuma previsão cadastrada para {monthLabel(month, year)}, por isso todo mundo aqui
                aparece como &quot;Sem previsão cadastrada&quot;. Crie previsões em{" "}
                <Link href="/dashboard/transacoes" className="font-medium underline underline-offset-2">
                  Transações → Nova previsão
                </Link>{" "}
                para comparar com o que de fato aconteceu.
              </p>
            </div>
          )}

          <div>
            <h2 className="text-lg font-semibold">Previsto vs Realizado — {monthLabel(month, year)}</h2>
            <p className="text-sm text-muted-foreground">
              &quot;Previsto&quot; é a soma das Previsões que você cadastrou para este mês, mais as
              despesas e receitas fixas (recorrentes) e as parcelas de compras parceladas já lançadas,
              em cada categoria; &quot;Realizado&quot; é a soma das transações reais do mês. Lançamentos
              avulsos (sem passar por uma Previsão, não fixos e não parcelados) contam só como
              Realizado. Use o filtro de mês acima para navegar entre meses.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
