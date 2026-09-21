"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MONTH_NAMES } from "@/lib/format";

const FLUXO_MESES_OPTIONS = [3, 6, 12];

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid min-w-0 gap-1">
      <Label className="text-xs font-normal text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

export function DashboardFilters({
  month,
  year,
  fluxoMeses,
}: {
  month: number;
  year: number;
  fluxoMeses: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const years = Array.from({ length: 6 }, (_, i) => year - 3 + i);

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="grid grid-cols-2 gap-3 rounded-md border bg-muted/20 p-3 sm:grid-cols-3 sm:w-fit">
      <FilterField label="Mês">
        <Select value={String(month)} onValueChange={(v) => updateParam("month", v)}>
          <SelectTrigger className="w-full min-w-0 sm:w-[140px]">
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
        <Select value={String(year)} onValueChange={(v) => updateParam("year", v)}>
          <SelectTrigger className="w-full min-w-0 sm:w-[100px]">
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

      <FilterField label="Comparativo">
        <Select value={String(fluxoMeses)} onValueChange={(v) => updateParam("fluxoMeses", v)}>
          <SelectTrigger className="w-full min-w-0 sm:w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FLUXO_MESES_OPTIONS.map((n) => (
              <SelectItem key={n} value={String(n)}>
                {n} meses
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </FilterField>
    </div>
  );
}
