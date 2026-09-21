"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { createInstallmentPurchase, createTransaction, updateTransaction } from "@/lib/actions/transactions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
  PurchasePaymentType,
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
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: {
  categories: Category[];
  subcategoriesByCategory: Record<string, Subcategory[]>;
  paymentMethods: PaymentMethod[];
  transaction?: TransactionWithRelations;
  trigger?: React.ReactNode | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const isEdit = Boolean(transaction);
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;
  const [type, setType] = useState<"receita" | "despesa">(transaction?.type ?? "despesa");
  const [expenseKind, setExpenseKind] = useState<ExpenseKind>(transaction?.expense_kind ?? "variavel");
  const [categoryId, setCategoryId] = useState(transaction?.category_id ?? "");
  const [paymentMethodId, setPaymentMethodId] = useState(transaction?.payment_method_id ?? "");
  const [dateValue, setDateValue] = useState(transaction?.date ?? toDateInputValue(new Date()));
  const [recorrente, setRecorrente] = useState(false);
  const [periodType, setPeriodType] = useState<RecurringPeriodType | "unico">("unico");
  const [mode, setMode] = useState<"transacao" | "parcelada">("transacao");
  const [purchasePaymentMethod, setPurchasePaymentMethod] = useState<PurchasePaymentType>("cartao");
  const [purchasePaymentMethodId, setPurchasePaymentMethodId] = useState("");
  const [installmentsTotal, setInstallmentsTotal] = useState(2);
  const [startingInstallment, setStartingInstallment] = useState(1);
  const [purchaseDate, setPurchaseDate] = useState(toDateInputValue(new Date()));
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const action = mode === "parcelada" ? createInstallmentPurchase : isEdit ? updateTransaction : createTransaction;
  const isParcela = Boolean(transaction?.installment_number);
  const originalExpenseKind = transaction?.expense_kind ?? "variavel";
  const switchingToFixa = isEdit && originalExpenseKind !== "fixa" && expenseKind === "fixa";
  const switchingToVariavel = isEdit && originalExpenseKind === "fixa" && expenseKind !== "fixa";
  const needsRecurringChoice = switchingToVariavel && Boolean(transaction?.recurring_series_id);

  const [pendingFormData, setPendingFormData] = useState<FormData | null>(null);

  const filteredCategories = useMemo(
    () => categories.filter((c) => c.type === type),
    [categories, type]
  );
  const subcategories = categoryId ? subcategoriesByCategory[categoryId] ?? [] : [];

  const showRecurrence =
    mode === "transacao" && ((!isEdit && (type === "despesa" ? expenseKind === "fixa" : recorrente)) || switchingToFixa);

  const selectedPaymentMethod = paymentMethods.find((pm) => pm.id === paymentMethodId);
  // Despesa fixa tem vencimento próprio (ex: seguro, assinatura), então não
  // usa o ciclo de fatura do cartão como uma compra avulsa/parcelada usaria.
  const isCard = type === "despesa" && expenseKind !== "fixa" && selectedPaymentMethod?.kind === "cartao";
  const cardCycleReady = isCard && Boolean(selectedPaymentMethod?.closing_day && selectedPaymentMethod?.due_day);
  const previewDueDate =
    cardCycleReady && dateValue
      ? computeCardDueDate(dateValue, selectedPaymentMethod!.closing_day!, selectedPaymentMethod!.due_day!)
      : null;

  const occurrences = Math.max(installmentsTotal - startingInstallment + 1, 0);
  const filteredPurchasePaymentMethods = useMemo(
    () => paymentMethods.filter((pm) => pm.kind === purchasePaymentMethod),
    [paymentMethods, purchasePaymentMethod]
  );
  const selectedPurchaseCard = filteredPurchasePaymentMethods.find((pm) => pm.id === purchasePaymentMethodId);
  const purchaseCardCycleReady =
    purchasePaymentMethod === "cartao" && Boolean(selectedPurchaseCard?.closing_day && selectedPurchaseCard?.due_day);
  const purchasePreviewDueDate =
    purchaseCardCycleReady && purchaseDate
      ? computeCardDueDate(purchaseDate, selectedPurchaseCard!.closing_day!, selectedPurchaseCard!.due_day!)
      : null;

  function resetState() {
    setType(transaction?.type ?? "despesa");
    setExpenseKind(transaction?.expense_kind ?? "variavel");
    setCategoryId(transaction?.category_id ?? "");
    setPaymentMethodId(transaction?.payment_method_id ?? "");
    setDateValue(transaction?.date ?? toDateInputValue(new Date()));
    setRecorrente(false);
    setPeriodType("unico");
    setMode("transacao");
    setPurchasePaymentMethod("cartao");
    setPurchasePaymentMethodId("");
    setInstallmentsTotal(2);
    setStartingInstallment(1);
    setPurchaseDate(toDateInputValue(new Date()));
  }

  function submitForm(formData: FormData) {
    startTransition(async () => {
      const result = await action({}, formData);
      if (result.error) {
        setError(result.error);
      } else {
        setError(undefined);
        setOpen(false);
        toast.success(
          isEdit ? "Transação atualizada." : mode === "parcelada" ? "Compra parcelada criada." : "Transação criada."
        );
      }
    });
  }

  function handleSubmit(formData: FormData) {
    if (needsRecurringChoice) {
      setPendingFormData(formData);
      return;
    }
    submitForm(formData);
  }

  function handleRecurringChoice(choice: "delete_others" | "keep_others") {
    if (!pendingFormData) return;
    pendingFormData.set("recurring_action", choice);
    submitForm(pendingFormData);
    setPendingFormData(null);
  }

  return (
    <>
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setError(undefined);
        setPendingFormData(null);
        if (next) resetState();
      }}
    >
      {trigger !== null && (
        <DialogTrigger asChild>
          {trigger ?? (
            <Button>
              <Plus className="size-4" />
              Nova transação
            </Button>
          )}
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Editar transação" : mode === "parcelada" ? "Nova compra parcelada" : "Nova transação"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Atualize os dados da transação."
              : mode === "parcelada"
                ? "Cria automaticamente uma transação de despesa para cada parcela, nos meses seguintes."
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
                  setMode("transacao");
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
                  name={mode === "parcelada" ? undefined : "expense_kind"}
                  value={mode === "parcelada" ? "parcelada" : expenseKind}
                  onValueChange={(v) => {
                    if (v === "parcelada") {
                      setMode("parcelada");
                      return;
                    }
                    setMode("transacao");
                    setExpenseKind(v as ExpenseKind);
                    if (v !== "fixa") setPeriodType("unico");
                  }}
                  disabled={isParcela}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="variavel">{EXPENSE_KIND_LABELS.variavel}</SelectItem>
                    <SelectItem value="fixa">{EXPENSE_KIND_LABELS.fixa}</SelectItem>
                    {!isEdit && <SelectItem value="parcelada">Parcelada</SelectItem>}
                  </SelectContent>
                </Select>
                {isParcela && <input type="hidden" name="expense_kind" value={expenseKind} />}
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
              {type === "despesa" && (
                <div className="grid gap-2">
                  <Label htmlFor="data_fim_contrato">Fim do contrato (opcional)</Label>
                  <Input id="data_fim_contrato" name="data_fim_contrato" type="date" />
                  <p className="text-xs text-muted-foreground">
                    Preencha se essa despesa tem fidelidade com prazo definido (ex: plano de celular
                    de 12 meses). Deixe em branco se for indefinida (ex: aluguel).
                  </p>
                </div>
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

          {type === "despesa" && mode === "transacao" && (
            <div className="grid gap-2">
              <Label>Forma de pagamento</Label>
              <Select name="payment_method_id" value={paymentMethodId} onValueChange={setPaymentMethodId} required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
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
              {cardCycleReady && (
                <p className="text-xs text-muted-foreground">
                  Fechamento dia {selectedPaymentMethod!.closing_day} · Vencimento dia{" "}
                  {selectedPaymentMethod!.due_day}
                </p>
              )}
            </div>
          )}

          {mode === "transacao" && (
            <div className="grid gap-2">
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
                </div>
              </div>
              {previewDueDate && (
                <p className="text-xs text-muted-foreground">
                  Cai na fatura com vencimento em{" "}
                  <span className="font-medium">{formatDate(previewDueDate)}</span>
                </p>
              )}
            </div>
          )}

          {mode === "parcelada" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="total_amount">Valor total (R$)</Label>
                  <Input
                    id="total_amount"
                    name="total_amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="installments_total">Nº total de parcelas</Label>
                  <Input
                    id="installments_total"
                    name="installments_total"
                    type="number"
                    min={1}
                    max={120}
                    step={1}
                    required
                    value={installmentsTotal}
                    onChange={(e) => {
                      const value = Number(e.target.value) || 1;
                      setInstallmentsTotal(value);
                      if (startingInstallment > value) setStartingInstallment(value);
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="starting_installment">Começar a partir da parcela</Label>
                  <Input
                    id="starting_installment"
                    name="starting_installment"
                    type="number"
                    min={1}
                    max={installmentsTotal}
                    step={1}
                    required
                    value={startingInstallment}
                    onChange={(e) =>
                      setStartingInstallment(Math.min(Number(e.target.value) || 1, installmentsTotal))
                    }
                  />
                </div>
                <div className="grid gap-2 self-end pb-2">
                  <p className="text-xs text-muted-foreground">
                    {startingInstallment > 1
                      ? `As parcelas 1 a ${startingInstallment - 1} não serão lançadas (já pagas). Serão criadas ${occurrences} parcela${occurrences === 1 ? "" : "s"}.`
                      : `Serão criadas todas as ${occurrences} parcelas.`}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label>Forma de pagamento</Label>
                  <Select
                    name="payment_method"
                    value={purchasePaymentMethod}
                    onValueChange={(v) => {
                      setPurchasePaymentMethod(v as PurchasePaymentType);
                      setPurchasePaymentMethodId("");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cartao">Cartão de crédito</SelectItem>
                      <SelectItem value="boleto">Boleto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="first_due_date">
                    {purchaseCardCycleReady ? "Data da compra" : `Vencimento da ${startingInstallment}ª parcela`}
                  </Label>
                  <Input
                    id="first_due_date"
                    name="first_due_date"
                    type="date"
                    required
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                  />
                  {purchasePreviewDueDate && (
                    <p className="text-xs text-muted-foreground">
                      Vencimento da {startingInstallment}ª parcela:{" "}
                      <span className="font-medium">{formatDate(purchasePreviewDueDate)}</span>
                    </p>
                  )}
                </div>
              </div>

              {purchasePaymentMethod === "cartao" && (
                <div className="grid gap-2">
                  <Label>Cartão utilizado</Label>
                  <Select
                    name="payment_method_id"
                    value={purchasePaymentMethodId}
                    onValueChange={setPurchasePaymentMethodId}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={filteredPurchasePaymentMethods.length ? "Selecione" : "Nenhum cartão cadastrado"}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredPurchasePaymentMethods.map((pm) => (
                        <SelectItem key={pm.id} value={pm.id}>
                          {pm.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {purchasePaymentMethodId && !purchaseCardCycleReady && (
                    <p className="text-xs text-muted-foreground">
                      Cadastre o dia de fechamento e vencimento deste cartão em Cadastros para o vencimento
                      ser calculado automaticamente.
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Categoria</Label>
              <Select name="category_id" value={categoryId} onValueChange={setCategoryId} required>
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
                required={subcategories.length > 0}
                key={categoryId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={subcategories.length > 0 ? "Selecione" : "Sem subcategorias"} />
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

          {mode === "transacao" && (
            <div className="grid gap-2">
              <Label htmlFor="notes">Observações (opcional)</Label>
              <Textarea id="notes" name="notes" rows={2} defaultValue={transaction?.notes ?? ""} />
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? "Salvar alterações" : mode === "parcelada" ? "Criar compra parcelada" : "Criar transação"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    <AlertDialog open={Boolean(pendingFormData)} onOpenChange={(next) => !next && setPendingFormData(null)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Essa despesa fixa tem outras ocorrências</AlertDialogTitle>
          <AlertDialogDescription>
            Essa transação faz parte de uma recorrência. Ao mudar a natureza dela para variável, o
            que você quer fazer com os lançamentos gerados nos outros meses?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
          <Button variant="outline" disabled={pending} onClick={() => handleRecurringChoice("keep_others")}>
            Manter os outros como fixos
          </Button>
          <AlertDialogAction
            disabled={pending}
            onClick={() => handleRecurringChoice("delete_others")}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Excluir os outros
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
