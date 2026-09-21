"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MONTH_NAMES } from "@/lib/format";
import type { Category, PaymentMethod } from "@/lib/types/database";

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid min-w-0 gap-1">
      <Label className="text-xs font-normal text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

export function TransactionFilters({
  categories,
  paymentMethods,
  month,
  year,
}: {
  categories: Category[];
  paymentMethods: PaymentMethod[];
  month: number;
  year: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("search") ?? "");
  const [, startTransition] = useTransition();

  const years = Array.from({ length: 6 }, (_, i) => year - 3 + i);

  function updateParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "" || value === "all") params.delete(key);
      else params.set(key, value);
    }
    startTransition(() => router.push(`${pathname}?${params.toString()}`));
  }

  return (
    <div className="grid gap-3 rounded-md border bg-muted/20 p-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
      <FilterField label="Mês">
        <Select value={String(month)} onValueChange={(v) => updateParams({ month: v })}>
          <SelectTrigger className="w-full min-w-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONTH_NAMES.map((name, i) => (
              <SelectItem key={name} value={String(i + 1)}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField label="Ano">
        <Select value={String(year)} onValueChange={(v) => updateParams({ year: v })}>
          <SelectTrigger className="w-full min-w-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField label="Tipo">
        <Select
          defaultValue={searchParams.get("type") ?? "all"}
          onValueChange={(v) => updateParams({ type: v })}
        >
          <SelectTrigger className="w-full min-w-0">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="receita">Receitas</SelectItem>
            <SelectItem value="despesa">Despesas</SelectItem>
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField label="Categoria">
        <Select
          defaultValue={searchParams.get("category") ?? "all"}
          onValueChange={(v) => updateParams({ category: v })}
        >
          <SelectTrigger className="w-full min-w-0">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField label="Forma de pagamento">
        <Select
          defaultValue={searchParams.get("payment_method") ?? "all"}
          onValueChange={(v) => updateParams({ payment_method: v })}
        >
          <SelectTrigger className="w-full min-w-0">
            <SelectValue placeholder="Forma de pagamento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            {paymentMethods.map((pm) => (
              <SelectItem key={pm.id} value={pm.id}>
                {pm.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField label="Classificação">
        <Select
          defaultValue={searchParams.get("classificacao") ?? "all"}
          onValueChange={(v) => updateParams({ classificacao: v })}
        >
          <SelectTrigger className="w-full min-w-0">
            <SelectValue placeholder="Classificação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="fixa">Despesa Fixa</SelectItem>
            <SelectItem value="parcelada_curto">Despesa Parcelada — Curto Prazo</SelectItem>
            <SelectItem value="parcelada_longo">Despesa Parcelada — Longo Prazo</SelectItem>
            <SelectItem value="previsao">Previsão</SelectItem>
          </SelectContent>
        </Select>
      </FilterField>

      <FilterField label="Buscar">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateParams({ search });
          }}
          className="relative"
        >
          <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onBlur={() => updateParams({ search })}
            placeholder="Descrição..."
            className="pl-8"
          />
        </form>
      </FilterField>
    </div>
  );
}
