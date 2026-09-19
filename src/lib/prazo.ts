import type { PrazoClassificacao } from "@/lib/types/database";

export const PRAZO_LABELS: Record<PrazoClassificacao, string> = {
  curto: "Curto Prazo",
  longo: "Longo Prazo",
};

/**
 * Classifica em curto/longo prazo a partir de "unidades restantes" (parcelas
 * restantes de uma compra parcelada, ou meses restantes até o fim de um
 * contrato). A faixa entre o limite de curto e o de longo prazo é tratada
 * como longo prazo (não existe uma 3ª categoria "médio prazo" nesta fase).
 * Sempre computado on-the-fly — nunca armazenado, porque muda conforme as
 * parcelas/meses vão passando.
 */
export function classificarPrazo(
  unidadesRestantes: number,
  limiteCurtoPrazoMeses: number
): PrazoClassificacao {
  return unidadesRestantes <= limiteCurtoPrazoMeses ? "curto" : "longo";
}

/**
 * Meses restantes (arredondados para cima) entre a data de referência e uma
 * data-limite (ex.: fim de contrato de uma despesa fixa). Retorna 0 se a
 * data-limite já passou.
 */
export function mesesRestantesAteData(dataFimStr: string, referencia: Date = new Date()): number {
  const [y, m, d] = dataFimStr.split("-").map(Number);
  const fim = new Date(y, m - 1, d);
  const diffMs = fim.getTime() - referencia.getTime();
  if (diffMs <= 0) return 0;
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return Math.ceil(diffDays / 30.44);
}
