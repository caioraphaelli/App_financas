export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(
    new Date(year, month - 1, day)
  );
}

export const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
] as const;

export function monthLabel(month: number, year: number): string {
  return `${MONTH_NAMES[month - 1]} de ${year}`;
}

export function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addMonths(dateStr: string, months: number): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  const d = new Date(year, month - 1 + months, day);
  return toDateInputValue(d);
}

/**
 * Calcula a data de vencimento da fatura em que uma compra no cartão cai,
 * a partir do dia de fechamento e do dia de vencimento cadastrados no
 * cartão. Compras até o dia de fechamento entram na fatura que fecha
 * naquele mês; depois disso, caem na fatura do mês seguinte. O vencimento
 * fica no mesmo mês do fechamento (se o dia de vencimento for maior que o
 * de fechamento) ou no mês seguinte (caso contrário).
 */
export function computeCardDueDate(purchaseDateStr: string, closingDay: number, dueDay: number): string {
  const [year, month, day] = purchaseDateStr.split("-").map(Number);
  let closingMonthIndex = month - 1;
  if (day > closingDay) {
    closingMonthIndex += 1;
  }
  let dueMonthIndex = closingMonthIndex;
  if (dueDay <= closingDay) {
    dueMonthIndex += 1;
  }
  const daysInDueMonth = new Date(year, dueMonthIndex + 1, 0).getDate();
  const cappedDueDay = Math.min(dueDay, daysInDueMonth);
  return toDateInputValue(new Date(year, dueMonthIndex, cappedDueDay));
}
