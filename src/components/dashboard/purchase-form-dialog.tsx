"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { createInstallmentPurchase, updateInstallmentPurchase } from "@/lib/actions/transactions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Category, PaymentMethod, Purchase, PurchasePaymentType, Subcategory } from "@/lib/types/database";
import { computeCardDueDate, formatDate, toDateInputValue } from "@/lib/format";

export function PurchaseFormDialog({
  categories,
  subcategoriesByCategory,
  paymentMethods,
  purchase,
  trigger,
}: {
  categories: Category[];
  subcategoriesByCategory: Record<string, Subcategory[]>;
  paymentMethods: PaymentMethod[];
  purchase?: Purchase;
  trigger?: React.ReactNode;
}) {
  const isEdit = Boolean(purchase);
  const [open, setOpen] = useState(false);
  const [categoryId, setCategoryId] = useState(purchase?.category_id ?? "");
  const [paymentMethod, setPaymentMethod] = useState<PurchasePaymentType>(purchase?.payment_method ?? "cartao");
  const [paymentMethodId, setPaymentMethodId] = useState(purchase?.payment_method_id ?? "");
  const [installmentsTotal, setInstallmentsTotal] = useState(purchase?.installments_total ?? 2);
  const [startingInstallment, setStartingInstallment] = useState(purchase?.starting_installment ?? 1);
  const [purchaseDate, setPurchaseDate] = useState(purchase?.first_due_date ?? toDateInputValue(new Date()));
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const action = isEdit ? updateInstallmentPurchase : createInstallmentPurchase;
  const occurrences = Math.max(installmentsTotal - startingInstallment + 1, 0);

  const despesaCategories = useMemo(() => categories.filter((c) => c.type === "despesa"), [categories]);
  const subcategories = categoryId ? subcategoriesByCategory[categoryId] ?? [] : [];
  const filteredPaymentMethods = useMemo(
    () => paymentMethods.filter((pm) => pm.kind === paymentMethod),
    [paymentMethods, paymentMethod]
  );
  const selectedCard = filteredPaymentMethods.find((pm) => pm.id === paymentMethodId);
  const cardCycleReady =
    paymentMethod === "cartao" && Boolean(selectedCard?.closing_day && selectedCard?.due_day);
  const previewDueDate =
    cardCycleReady && purchaseDate
      ? computeCardDueDate(purchaseDate, selectedCard!.closing_day!, selectedCard!.due_day!)
      : null;

  function resetState() {
    setCategoryId(purchase?.category_id ?? "");
    setPaymentMethod(purchase?.payment_method ?? "cartao");
    setPaymentMethodId(purchase?.payment_method_id ?? "");
    setInstallmentsTotal(purchase?.installments_total ?? 2);
    setStartingInstallment(purchase?.starting_installment ?? 1);
    setPurchaseDate(purchase?.first_due_date ?? toDateInputValue(new Date()));
  }

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await action({}, formData);
      if (result.error) {
        setError(result.error);
      } else {
        setError(undefined);
        setOpen(false);
        toast.success(isEdit ? "Compra parcelada atualizada." : "Compra parcelada criada.");
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
            Nova compra parcelada
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar compra parcelada" : "Nova compra parcelada"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "As parcelas já geradas serão recriadas com os novos valores."
              : "Cria automaticamente uma transação de despesa para cada parcela, nos meses seguintes."}
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="grid gap-4">
          {isEdit && <input type="hidden" name="id" value={purchase!.id} />}

          <div className="grid gap-2">
            <Label htmlFor="description">Descrição</Label>
            <Input
              id="description"
              name="description"
              required
              defaultValue={purchase?.description}
              placeholder="Ex: Notebook novo"
            />
          </div>

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
                defaultValue={purchase?.total_amount}
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
              <Label htmlFor="starting_installment">Começar a lançar a partir da parcela</Label>
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
                  ? `As parcelas 1 a ${startingInstallment - 1} não serão lançadas (já pagas). Serão criadas ${occurrences} parcela${occurrences === 1 ? "" : "s"}, da ${startingInstallment}ª à ${installmentsTotal}ª.`
                  : `Serão criadas todas as ${occurrences} parcelas.`}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Forma de pagamento</Label>
              <Select
                name="payment_method"
                value={paymentMethod}
                onValueChange={(v) => {
                  setPaymentMethod(v as PurchasePaymentType);
                  setPaymentMethodId("");
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
                {cardCycleReady ? "Data da compra" : `Vencimento da ${startingInstallment}ª parcela`}
              </Label>
              <Input
                id="first_due_date"
                name="first_due_date"
                type="date"
                required
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
              />
              {previewDueDate && (
                <p className="text-xs text-muted-foreground">
                  Vencimento da {startingInstallment}ª parcela:{" "}
                  <span className="font-medium">{formatDate(previewDueDate)}</span>
                </p>
              )}
            </div>
          </div>

          {paymentMethod === "cartao" && (
            <div className="grid gap-2">
              <Label>Cartão utilizado</Label>
              <Select
                name="payment_method_id"
                value={paymentMethodId}
                onValueChange={setPaymentMethodId}
              >
                <SelectTrigger>
                  <SelectValue placeholder={filteredPaymentMethods.length ? "Selecione" : "Nenhum cartão cadastrado"} />
                </SelectTrigger>
                <SelectContent>
                  {filteredPaymentMethods.map((pm) => (
                    <SelectItem key={pm.id} value={pm.id}>
                      {pm.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {paymentMethodId && !cardCycleReady && (
                <p className="text-xs text-muted-foreground">
                  Cadastre o dia de fechamento e vencimento deste cartão em Cadastros para o vencimento
                  ser calculado automaticamente.
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Categoria</Label>
              <Select name="category_id" value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {despesaCategories.map((c) => (
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
                defaultValue={purchase?.subcategory_id ?? ""}
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

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? "Salvar alterações" : "Criar parcelamento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
