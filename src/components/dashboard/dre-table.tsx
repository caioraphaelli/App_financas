"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { DreAccount, DreLineValue, DreResult } from "@/lib/data/dre";

type Kind = "receita" | "despesa" | "saldo";

interface FlatRow {
  path: string;
  account: DreAccount;
  level: number;
  kind: Kind;
  hasChildren: boolean;
  isExpanded: boolean;
}

function flatten(
  accounts: DreAccount[],
  expanded: Set<string>,
  parentPath: string,
  level: number,
  kind: Kind | null
): FlatRow[] {
  const rows: FlatRow[] = [];
  for (const account of accounts) {
    const path = parentPath ? `${parentPath}>${account.key}` : account.key;
    const rowKind: Kind = kind ?? (account.key === "saldo" ? "saldo" : account.key === "receitas" ? "receita" : "despesa");
    const hasChildren = Boolean(account.children && account.children.length > 0);
    const isExpanded = expanded.has(path);
    rows.push({ path, account, level, kind: rowKind, hasChildren, isExpanded });
    if (hasChildren && isExpanded) {
      rows.push(...flatten(account.children!, expanded, path, level + 1, rowKind));
    }
  }
  return rows;
}

function formatPercent(value: number | null): string {
  if (value === null) return "—";
  const rounded = Math.round(value * 10) / 10;
  return `${rounded}%`;
}

function ValueCell({ value, kind }: { value: DreLineValue; kind: Kind }) {
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

export function DreTable({ data }: { data: DreResult }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const rows = useMemo(
    () => flatten(data.accounts, expanded, "", 0, null),
    [data.accounts, expanded]
  );

  function toggle(path: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
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
          {rows.map((row) => {
            const isTopLevel = row.level === 0;
            const isSaldo = row.account.key === "saldo";
            return (
              <TableRow key={row.path} className={cn(isSaldo && "border-t-2")}>
                <TableCell
                  className={cn(
                    "sticky left-0 z-10 bg-background whitespace-nowrap",
                    isTopLevel && "font-semibold"
                  )}
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
                    {row.account.color && (
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{ backgroundColor: row.account.color }}
                        aria-hidden
                      />
                    )}
                    <span>{row.account.name}</span>
                  </button>
                </TableCell>
                {row.account.values.map((v, i) => (
                  <ValueCell key={i} value={v} kind={row.kind} />
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
