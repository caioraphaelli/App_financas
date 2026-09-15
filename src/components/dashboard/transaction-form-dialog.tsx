"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { createTransaction, updateTransaction } from "@/lib/actions/transactions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type {
  Category,
  ExpenseKind,
  PaymentMethod,
  RecurringPeriodType,
  Subcategory,
  TransactionWithRelations,
} from "@/lib/types/database";
import { computeCardDueDate, formatDate, toDateInputValue } from "@/lib/format";

const EXPENSE_KIND_LABELS: Record<ExpenseKind, string> = {
  variavel: "Variável",
  fixa: "Fixa",
  parcelada_cartao: "Parcelada (cartão)",
  parcelada_boleto: "Parcelada (boleto)",
};

export function TransactionFormDialog({
  categories,
  subcategoriesByCategory,
  paymentMethods,
  transaction,
  trigger,
}: {
  categories: Category[];
  subcategoriesByCategory: Record<string, Subcategory[]>;
  paymentMethods: PaymentMethod[];
  transaction?: TransactionWithRelations;
  trigger?: React.ReactNode;
}) {
  const isEdit = Boolean(transaction);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"receita" | "despesa">(transaction?.type ?? "despesa");
  const [expenseKind, setExpenseKind] = useState<ExpenseKind>(transaction?.expense_kind ?? "variavel");
  const [categoryId, setCategoryId] = useState(transaction?.category_id ?? "");
  const [paymentMethodId, setPaymentMethodId] = useState(transaction?.payment_method_id ?? "");
  const [dateValue, setDateValue] = useState(transaction?.date ?? toDateInputValue(new Date()));
  const [recorrente, setRecorrente] = useState(false);
  const [periodType, setPeriodType] = useState<RecurringPeriodType | "unico">("unico");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const action = isEdit ? updateTransaction : createTransaction;

  const filteredCategories = useMemo(
    () => categories.filter((c) => c.type === type),
    [categories, type]
  );
  const subcategories = categoryId ? subcategoriesByCategory[categoryId] ?? [] : [];

  const showRecurrence = !isEdit && (type === "despesa" ? expenseKind === "fixa" : recorrente);

  const selectedPaymentMethod = paymentMethods.find((pm) => pm.id === paymentMethodId);
  const isCard = type === "despesa" && selectedPaymentMethod?.kind === "cartao";
  const cardCycleReady = isCard && Boolean(selectedPaymentMethod?.closing_day && selectedPaymentMethod?.due_day);
  const previewDueDate =
    cardCycleReady && dateValue
      ? computeCardDueDate(dateValue, selectedPaymentMethod!.closing_day!, selectedPaymentMethod!.due_day!)
      : null;

  function resetState() {
    setType(transaction?.type ?? "despesa");
    setExpenseKind(transaction?.expense_kind ?? "variavel");
    setCategoryId(transaction?.category_id ?? "");
    setPaymentMethodId(transaction?.payment_method_id ?? "");
    setDateValue(transaction?.date ?? toDateInputValue(new Date()));
    setRecorrente(false);
    setPeriodType("unico");
  }

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await action({}, formData);
      if (result.error) {
        setError(result.error);
      } else {
        setError(undefined);
        setOpen(false);
        toast.success(isEdit ? "Transação atualizada." : "Transação criada.");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setError(undefined);
        if (next) resetState();
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Plus className="size-4" />
            Nova transação
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar transação" : "Nova transação"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Atualize os dados da transação."
              : "Registre uma receita ou despesa avulsa, fixa ou variável."}
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="grid gap-4">
          {isEdit && <input type="hidden" name="id" value={transaction!.id} />}

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Tipo</Label>
              <Select
                name="type"
                value={type}
                onValueChange={(v) => {
                  setType(v as "receita" | "despesa");
                  setCategoryId("");
                  setRecorrente(false);
                  setPeriodType("unico");
                }}
                disabled={isEdit}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="receita">Receita</SelectItem>
                  <SelectItem value="despesa">Despesa</SelectItem>
                </SelectContent>
              </Select>
              {isEdit && <input type="hidden" name="type" value={type} />}
            </div>

            {type === "despesa" && (
              <div className="grid gap-2">
                <Label>Natureza</Label>
                <Select
                  name="expense_kind"
                  value={expenseKind}
                  onValueChange={(v) => {
                    setExpenseKind(v as ExpenseKind);
                    if (v !== "fixa") setPeriodType("unico");
                  }}
                  disabled={isEdit}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="variavel">{EXPENSE_KIND_LABELS.variavel}</SelectItem>
                    <SelectItem value="fixa">{EXPENSE_KIND_LABELS.fixa}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          {!isEdit && type === "receita" && (
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={recorrente}
                onCheckedChange={(checked) => {
                  setRecorrente(checked === true);
                  if (!checked) setPeriodType("unico");
                  else setPeriodType("meses");
                }}
              />
              Receita fixa (se repete todo mês)
            </label>
          )}

          {showRecurrence && (
            <div className="grid gap-3 rounded-md border bg-muted/30 p-3">
              <div className="grid gap-2">
                <Label>Repetição</Label>
                <Select
                  value={periodType}
                  onValueChange={(v) => setPeriodType(v as RecurringPeriodType | "unico")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unico">Somente este mês</SelectItem>
                    <SelectItem value="meses">Por um número de meses</SelectItem>
                    <SelectItem value="indeterminado">Por tempo indeterminado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {periodType !== "unico" && <input type="hidden" name="period_type" value={periodType} />}
              {periodType === "meses" && (
                <div className="grid gap-2">
                  <Label htmlFor="months_count">Quantos meses?</Label>
                  <Input
                    id="months_count"
                    name="months_count"
                    type="number"
                    min={1}
                    max={360}
                    defaultValue={12}
                    required
                  />
                </div>
              )}
              {periodType === "indeterminado" && (
                <p className="text-xs text-muted-foreground">
                  Serão lançadas as próximas 36 parcelas mensais a partir da data escolhida.
                </p>
              )}
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="description">Descrição</Label>
            <Input
              id="description"
              name="description"
              required
              defaultValue={transaction?.description}
              placeholder="Ex: Supermercado do mês"
            />
          </div>

          {type === "despesa" && (
            <div className="grid gap-2">
              <Label>Forma de pagamento</Label>
              <Select name="payment_method_id" value={paymentMethodId} onValueChange={setPaymentMethodId}>
                <SelectTrigger>
                  <SelectValue placeholder="Opcional" />
                </SelectTrigger>
                <SelectContent>
                  {paymentMethods.map((pm) => (
                    <SelectItem key={pm.id} value={pm.id}>
                      {pm.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isCard && !cardCycleReady && (
                <p className="text-xs text-muted-foreground">
                  Cadastre o dia de fechamento e vencimento deste cartão em Cadastros para o vencimento
                  ser calculado automaticamente.
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="amount">Valor (R$)</Label>
              <Input
                id="amount"
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                required
                defaultValue={transaction?.amount}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="date">
                {cardCycleReady ? "Data da compra" : showRecurrence ? "1º lançamento em" : "Data"}
              </Label>
              <Input
                id="date"
                name="date"
                type="date"
                required
                value={dateValue}
                onChange={(e) => setDateValue(e.target.value)}
              />
              {previewDueDate && (
                <p className="text-xs text-muted-foreground">
                  Vencimento da fatura: <span className="font-medium">{formatDate(previewDueDate)}</span>
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Categoria</Label>
              <Select name="category_id" value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {filteredCategories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Subcategoria</Label>
              <Select
                name="subcategory_id"
                defaultValue={transaction?.subcategory_id ?? ""}
                disabled={!categoryId}
                key={categoryId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Opcional" />
                </SelectTrigger>
                <SelectContent>
                  {subcategories.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="notes">Observações (opcional)</Label>
            <Textarea id="notes" name="notes" rows={2} defaultValue={transaction?.notes ?? ""} />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? "Salvar alterações" : "Criar transação"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
