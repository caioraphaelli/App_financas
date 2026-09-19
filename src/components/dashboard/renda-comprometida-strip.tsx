import { cn } from "@/lib/utils";
import type { MonthlyInstallmentsSummary } from "@/lib/data/transactions";

export function RendaComprometidaStrip({ data }: { data: MonthlyInstallmentsSummary[] }) {
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
      {data.map((m) => {
        const despesas = m.parcelamentos + m.outrasDespesas;
        const percent = m.receitas > 0 ? (despesas / m.receitas) * 100 : null;
        const rounded = percent === null ? null : Math.round(percent);
        return (
          <div key={m.month} className="rounded-md border p-2 text-center">
            <p className="text-xs text-muted-foreground">{m.label}</p>
            <p
              className={cn(
                "text-lg font-semibold tabular-nums",
                rounded === null
                  ? "text-muted-foreground"
                  : rounded >= 100
                    ? "text-[#d03b3b]"
                    : rounded >= 70
                      ? "text-[#eda100]"
                      : "text-[#006300]"
              )}
            >
              {rounded === null ? "—" : `${rounded}%`}
            </p>
            <p className="text-[11px] text-muted-foreground">renda comprometida</p>
          </div>
        );
      })}
    </div>
  );
}
