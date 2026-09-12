import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  LayoutDashboard,
  PieChart,
  CreditCard,
  FileDown,
  Filter,
  Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Finanças+ — Controle financeiro pessoal simples e visual",
  description:
    "Organize receitas, despesas, gastos fixos e compras parceladas em um dashboard visual e simples.",
};

const features = [
  {
    icon: LayoutDashboard,
    title: "Dashboard consolidado",
    description: "Receitas, despesas e saldo do mês em cards claros, atualizados em tempo real.",
  },
  {
    icon: PieChart,
    title: "Gráficos por categoria",
    description: "Veja para onde seu dinheiro está indo com um gráfico de pizza por categoria.",
  },
  {
    icon: CreditCard,
    title: "Controle de parcelamentos",
    description: "Compras no cartão ou boleto: acompanhe parcelas pagas, pendentes e valor comprometido.",
  },
  {
    icon: Filter,
    title: "Filtros e busca",
    description: "Filtre por mês, ano, categoria ou busque por descrição em segundos.",
  },
  {
    icon: FileDown,
    title: "Exportação em CSV",
    description: "Exporte as transações filtradas para uma planilha com um clique.",
  },
  {
    icon: Smartphone,
    title: "100% responsivo",
    description: "Use no computador ou no celular com uma interface adaptada para cada tela.",
  },
];

export default function LandingPage() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            Suas finanças pessoais, organizadas em um só lugar
          </h1>
          <p className="mt-4 text-pretty text-lg text-muted-foreground">
            Controle receitas, despesas fixas e parceladas, e visualize tudo em um
            dashboard simples e moderno. Chega de extratos dispersos e planilhas soltas.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" asChild>
              <Link href="/signup">
                Começar agora
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/login">Já tenho conta</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="border-t bg-muted/30 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              Tudo o que você precisa para não perder o controle
            </h2>
            <p className="mt-3 text-muted-foreground">
              Uma ferramenta pensada para o dia a dia de quem quer entender e planejar seus gastos.
            </p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <Card key={f.title}>
                <CardHeader>
                  <div className="flex size-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <f.icon className="size-5" />
                  </div>
                  <CardTitle className="mt-3 text-base">{f.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{f.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-20 text-center sm:px-6">
        <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Pronto para organizar sua vida financeira?
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
          Crie sua conta gratuitamente e comece a registrar suas transações em minutos.
        </p>
        <div className="mt-8">
          <Button size="lg" asChild>
            <Link href="/signup">
              Criar conta grátis
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      </section>
    </>
  );
}
