"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { FluxoCaixaResult, FluxoLineValue, FluxoNode } from "@/lib/data/fluxo-caixa";

type Kind = "receita" | "despesa" | "saldo";

interface FlatRow {
  path: string;
  node: FluxoNode;
  level: number;
  kind: Kind;
  hasChildren: boolean;
  isExpanded: boolean;
}

function flatten(nodes: FluxoNode[], expanded: Set<string>, parentPath: string, level: number, kind: Kind): FlatRow[] {
  const rows: FlatRow[] = [];
  // Se algum irmão deste nível está aberto, os demais ficam ocultos (não só
  // fechados) para não poluir a visualização com vários ramos ao mesmo tempo.
  const activeSibling = nodes.find((node) => {
    const path = parentPath ? `${parentPath}>${node.key}` : node.key;
    return expanded.has(path);
  });
  const visibleNodes = activeSibling ? [activeSibling] : nodes;
  for (const node of visibleNodes) {
    const path = parentPath ? `${parentPath}>${node.key}` : node.key;
    const hasChildren = Boolean(node.children && node.children.length > 0);
    const isExpanded = expanded.has(path);
    rows.push({ path, node, level, kind, hasChildren, isExpanded });
    if (hasChildren && isExpanded) {
      rows.push(...flatten(node.children!, expanded, path, level + 1, kind));
    }
  }
  return rows;
}

function formatPercent(value: number | null): string {
  if (value === null) return "—";
  return `${Math.round(value * 10) / 10}%`;
}

function ValueCell({ value, kind }: { value: FluxoLineValue; kind: Kind }) {
  const isNegativeSaldo = kind === "saldo" && value.valor < 0;
  const colorClass =
    kind === "receita"
      ? "text-[#006300]"
      : kind === "despesa"
        ? "text-[#d03b3b]"
        : isNegativeSaldo
          ? "text-[#d03b3b]"
          : "text-[#006300]";
  const prefix = kind === "despesa" && value.valor > 0 ? "- " : "";

  if (value.valor === 0) {
    return (
      <TableCell className="text-right align-top">
        <span className="text-sm text-muted-foreground">—</span>
      </TableCell>
    );
  }

  return (
    <TableCell className="text-right align-top">
      <div className={cn("flex items-baseline justify-end gap-1.5 tabular-nums", colorClass)}>
        <span className="font-medium">
          {prefix}
          {formatCurrency(value.valor)}
        </span>
        <span className="text-xs text-muted-foreground">({formatPercent(value.avPercent)})</span>
      </div>
    </TableCell>
  );
}

function AccountBlock({
  title,
  node,
  kind,
  expanded,
  toggle,
}: {
  title: string;
  node: FluxoNode;
  kind: Kind;
  expanded: Set<string>;
  toggle: (path: string) => void;
}) {
  const hasChildren = Boolean(node.children && node.children.length > 0);
  const isExpanded = expanded.has(node.key);
  const rows = useMemo(
    () => (isExpanded ? flatten(node.children ?? [], expanded, node.key, 1, kind) : []),
    [node.children, node.key, expanded, kind, isExpanded]
  );

  return (
    <>
      <TableRow className={cn(kind === "saldo" && "border-t-2")}>
        <TableCell className={cn("sticky left-0 z-10 bg-background font-semibold whitespace-nowrap")}>
          <button
            type="button"
            onClick={() => hasChildren && toggle(node.key)}
            disabled={!hasChildren}
            className="inline-flex items-center gap-1.5 text-left disabled:cursor-default"
          >
            {hasChildren ? (
              isExpanded ? (
                <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
              )
            ) : (
              <span className="inline-block size-3.5 shrink-0" />
            )}
            {title}
          </button>
        </TableCell>
        {node.values.map((v, i) => (
          <ValueCell key={i} value={v} kind={kind} />
        ))}
      </TableRow>
      {rows.map((row) => (
        <TableRow key={row.path}>
          <TableCell
            className="sticky left-0 z-10 bg-background whitespace-nowrap"
            style={{ paddingLeft: `${12 + row.level * 20}px` }}
          >
            <button
              type="button"
              onClick={() => row.hasChildren && toggle(row.path)}
              disabled={!row.hasChildren}
              className="inline-flex items-center gap-1.5 text-left disabled:cursor-default"
            >
              {row.hasChildren ? (
                row.isExpanded ? (
                  <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
                ) : (
                  <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
                )
              ) : (
                <span className="inline-block size-3.5 shrink-0" />
              )}
              {row.node.color && (
                <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: row.node.color }} aria-hidden />
              )}
              <span>{row.node.name}</span>
            </button>
          </TableCell>
          {row.node.values.map((v, i) => (
            <ValueCell key={i} value={v} kind={row.kind} />
          ))}
        </TableRow>
      ))}
    </>
  );
}

export function FluxoCaixaTable({ data }: { data: FluxoCaixaResult }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  function toggle(path: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        // Ao recolher, esquece também tudo que estava aberto por baixo desse
        // nível, para que ele sempre volte fechado da próxima vez que abrir.
        next.delete(path);
        const prefix = `${path}>`;
        for (const p of next) {
          if (p.startsWith(prefix)) next.delete(p);
        }
      } else {
        // Ao abrir um ramo, fecha os irmãos do mesmo nível (mesmo pai) para
        // não poluir a visualização com vários ramos abertos ao mesmo tempo.
        const lastSep = path.lastIndexOf(">");
        if (lastSep !== -1) {
          const parent = path.slice(0, lastSep);
          for (const p of Array.from(next)) {
            const pSep = p.lastIndexOf(">");
            const pParent = pSep === -1 ? "" : p.slice(0, pSep);
            if (pParent === parent) {
              next.delete(p);
              const pPrefix = `${p}>`;
              for (const q of Array.from(next)) {
                if (q.startsWith(pPrefix)) next.delete(q);
              }
            }
          }
        }
        next.add(path);
      }
      return next;
    });
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="sticky left-0 z-10 min-w-[220px] bg-background">Conta</TableHead>
            {data.months.map((m) => (
              <TableHead key={`${m.year}-${m.month}`} className="min-w-[140px] text-right">
                {m.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          <AccountBlock title="Receitas" node={data.receitas} kind="receita" expanded={expanded} toggle={toggle} />
          <AccountBlock title="Despesas Fixas" node={data.despesasFixas} kind="despesa" expanded={expanded} toggle={toggle} />
          <AccountBlock
            title="Despesas Variáveis"
            node={data.despesasVariaveis}
            kind="despesa"
            expanded={expanded}
            toggle={toggle}
          />
          <TableRow className="border-t-2">
            <TableCell className="sticky left-0 z-10 bg-background font-semibold">Saldo</TableCell>
            {data.saldo.values.map((v, i) => (
              <ValueCell key={i} value={v} kind="saldo" />
            ))}
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}
