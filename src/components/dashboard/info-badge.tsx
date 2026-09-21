"use client";

import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { ComponentProps } from "react";

/** Um Badge clicável que explica o que aquele termo significa, pra não
 * depender do usuário já conhecer o vocabulário do app (Recorrente,
 * Previsão, Pendente, Curto/Longo Prazo etc.). */
export function InfoBadge({
  label,
  explanation,
  variant = "secondary",
  className,
}: {
  label: string;
  explanation: string;
  variant?: ComponentProps<typeof Badge>["variant"];
  className?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Badge variant={variant} className={cn("w-fit cursor-pointer text-xs font-normal italic", className)}>
          {label}
        </Badge>
      </PopoverTrigger>
      <PopoverContent className="w-64 text-sm">
        <p className="font-medium">{label}</p>
        <p className="text-muted-foreground">{explanation}</p>
      </PopoverContent>
    </Popover>
  );
}
