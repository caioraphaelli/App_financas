"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const OPTIONS = [3, 6, 12];

export function DreFilter({ monthsCount }: { monthsCount: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  return (
    <Select
      value={String(monthsCount)}
      onValueChange={(v) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("dreMonths", v);
        router.push(`${pathname}?${params.toString()}`);
      }}
    >
      <SelectTrigger className="w-[170px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {OPTIONS.map((n) => (
          <SelectItem key={n} value={String(n)}>
            Comparar {n} meses
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
