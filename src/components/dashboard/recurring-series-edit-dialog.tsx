"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { updateRecurringSeries } from "@/lib/actions/transactions";
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
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Category, PaymentMethod, Subcategory, TransactionWithRelations } from "@/lib/types/database";

export function RecurringSeriesEditDialog({
  transaction,
  categories,
  subcategoriesByCategory,
  paymentMethods,
  open,
  onOpenChange,
}: {
  transaction: TransactionWithRelations;
  categories: Category[];
  subcategoriesByCategory: Record<string, Subcategory[]>;
  paymentMethods: PaymentMethod[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [categoryId, setCategoryId] = useState(transaction.category_id ?? "");
  const [paymentMethodId, setPaymentMethodId] = useState(transaction.payment_method_id ?? "");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const filteredCategories = useMemo(
    () => categories.filter((c) => c.type === transaction.type),
    [categories, transaction.type]
  );
  const subcategories = categoryId ? subcategoriesByCategory[categoryId] ?? [] : [];

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await updateRecurringSeries({}, formData);
      if (result.error) {
        setError(result.error);
      } else {
        setError(undefined);
        onOpenChange(false);
        toast.success("Série de lançamentos atualizada.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar série de lançamentos</DialogTitle>
          <DialogDescription>
            As alterações serão aplicadas a todos os lançamentos gerados por essa recorrência. A data
            de cada um não muda.
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="grid gap-4">
          <input type="hidden" name="recurring_series_id" value={transaction.recurring_series_id ?? ""} />

          <div className="grid gap-2">
            <Label htmlFor="series-description">Descrição</Label>
            <Input id="series-description" name="description" required defaultValue={transaction.description} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="series-amount">Valor (R$)</Label>
            <Input
              id="series-amount"
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              required
              defaultValue={transaction.amount}
            />
          </div>

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
                defaultValue={transaction.subcategory_id ?? ""}
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

          {transaction.type === "despesa" && (
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
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Salvar em toda a série
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
