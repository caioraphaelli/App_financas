"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { OrcadoRealizadoLinha, OrcadoRealizadoSubcategoria } from "@/lib/data/orcado-realizado";

type Kind = "receita" | "despesa";

function Barra({
  label,
  valor,
  max,
  colorClass,
  compact,
}: {
  label: string;
  valor: number;
  max: number;
  colorClass: string;
  compact?: boolean;
}) {
  const pct = max > 0 ? Math.min((valor / max) * 100, 100) : 0;
  return (
    <div className={cn("grid items-center gap-2", compact ? "grid-cols-[52px_1fr_auto]" : "grid-cols-[56px_1fr_auto]")}>
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <div className={cn("w-full overflow-hidden rounded-full bg-muted", compact ? "h-2" : "h-2.5")}>
        <div className={cn("h-full rounded-full", colorClass)} style={{ width: `${pct}%` }} />
      </div>
      <span
        className={cn("shrink-0 text-right font-medium tabular-nums", compact ? "w-20 text-xs" : "w-24 text-xs")}
      >
        {formatCurrency(valor)}
      </span>
    </div>
  );
}

function metaBadge(orcado: number, realizado: number, kind: Kind) {
  if (orcado <= 0) {
    return (
      <Badge variant="outline" className="text-[11px] text-muted-foreground">
        Sem meta
      </Badge>
    );
  }
  const dentro = kind === "despesa" ? realizado <= orcado : realizado >= orcado;
  return (
    <Badge
      className={cn(
        "text-[11px] text-white",
        dentro ? "bg-[#006300] hover:bg-[#006300]" : "bg-[#d03b3b] hover:bg-[#d03b3b]"
      )}
    >
      {dentro ? (kind === "despesa" ? "Dentro da meta" : "Meta atingida") : kind === "despesa" ? "Fora da meta" : "Abaixo da meta"}
    </Badge>
  );
}

function SubcategoriaRow({ sub, max, kind }: { sub: OrcadoRealizadoSubcategoria; max: number; kind: Kind }) {
  const accentColor = kind === "receita" ? "bg-[#006300]" : "bg-[#d03b3b]";
  return (
    <div className="grid gap-1.5 rounded-md border bg-muted/20 p-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-medium">{sub.name}</span>
        {metaBadge(sub.orcado, sub.realizado, kind)}
      </div>
      <div className="grid gap-1">
        <Barra label="Orçado" valor={sub.orcado} max={max} colorClass="bg-foreground/30" compact />
        <Barra label="Realizado" valor={sub.realizado} max={max} colorClass={accentColor} compact />
      </div>
    </div>
  );
}

function Linha({ linha, max, kind }: { linha: OrcadoRealizadoLinha; max: number; kind: Kind }) {
  const [open, setOpen] = useState(false);
  const accentColor = kind === "receita" ? "bg-[#006300]" : "bg-[#d03b3b]";
  const diff = linha.realizado - linha.orcado;
  const temOrcamento = linha.orcado > 0;
  const diffIsGood = kind === "despesa" ? diff <= 0 : diff >= 0;
  const hasSubcategorias = linha.subcategorias.length > 0;
  const subMax = Math.max(1, ...linha.subcategorias.map((s) => Math.max(s.orcado, s.realizado)));

  return (
    <div className="grid gap-1.5 rounded-md border p-3">
      <button
        type="button"
        onClick={() => hasSubcategorias && setOpen((v) => !v)}
        disabled={!hasSubcategorias}
        className="flex min-w-0 items-center gap-1.5 text-left text-sm font-medium disabled:cursor-default"
      >
        {hasSubcategorias ? (
          open ? (
            <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
          )
        ) : (
          <span className="inline-block size-3.5 shrink-0" />
        )}
        <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: linha.color }} aria-hidden />
        <span className="truncate">{linha.name}</span>
      </button>
      <div className="grid gap-1">
        <Barra label="Orçado" valor={linha.orcado} max={max} colorClass="bg-foreground/30" />
        <Barra label="Realizado" valor={linha.realizado} max={max} colorClass={accentColor} />
      </div>
      {temOrcamento ? (
        diff !== 0 && (
          <p className={cn("text-xs", diffIsGood ? "text-[#006300]" : "text-[#d03b3b]")}>
            {diff > 0 ? "+" : ""}
            {formatCurrency(diff)} {diff > 0 ? "acima do orçado" : "abaixo do orçado"}
          </p>
        )
      ) : (
        <p className="text-xs text-muted-foreground">Sem previsão cadastrada para esta categoria.</p>
      )}
      {open && hasSubcategorias && (
        <div className="mt-1 grid gap-2 border-t pt-2">
          <p className="text-[11px] font-medium text-muted-foreground">Por subcategoria</p>
          {linha.subcategorias.map((sub) => (
            <SubcategoriaRow key={sub.subcategoryId} sub={sub} max={subMax} kind={kind} />
          ))}
        </div>
      )}
    </div>
  );
}

export function OrcadoRealizadoSection({
  title,
  linhas,
  kind,
  totalOrcado,
  totalRealizado,
}: {
  title: string;
  linhas: OrcadoRealizadoLinha[];
  kind: Kind;
  totalOrcado: number;
  totalRealizado: number;
}) {
  const accentColor = kind === "receita" ? "#006300" : "#d03b3b";
  const max = Math.max(1, ...linhas.map((l) => Math.max(l.orcado, l.realizado)));

  return (
    <div className="grid gap-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{title}</h3>
        {linhas.length > 1 && (
          <span className="text-sm text-muted-foreground">
            Orçado {formatCurrency(totalOrcado)} · Realizado{" "}
            <span className="font-medium" style={{ color: accentColor }}>
              {formatCurrency(totalRealizado)}
            </span>
          </span>
        )}
      </div>
      {linhas.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum orçado ou realizado neste período.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {linhas.map((linha) => (
            <Linha key={linha.categoryId} linha={linha} max={max} kind={kind} />
          ))}
        </div>
      )}
    </div>
  );
}
