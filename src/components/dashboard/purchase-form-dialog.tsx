"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { createInstallmentPurchase } from "@/lib/actions/transactions";
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
import type { Category, Subcategory } from "@/lib/types/database";
import { toDateInputValue } from "@/lib/format";

export function PurchaseFormDialog({
  categories,
  subcategoriesByCategory,
}: {
  categories: Category[];
  subcategoriesByCategory: Record<string, Subcategory[]>;
}) {
  const [open, setOpen] = useState(false);
  const [categoryId, setCategoryId] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const despesaCategories = useMemo(() => categories.filter((c) => c.type === "despesa"), [categories]);
  const subcategories = categoryId ? subcategoriesByCategory[categoryId] ?? [] : [];

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createInstallmentPurchase({}, formData);
      if (result.error) {
        setError(result.error);
      } else {
        setError(undefined);
        setOpen(false);
        toast.success("Compra parcelada criada.");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setError(undefined);
        if (next) setCategoryId("");
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" />
          Nova compra parcelada
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova compra parcelada</DialogTitle>
          <DialogDescription>
            Cria automaticamente uma transação de despesa para cada parcela, nos meses seguintes.
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="description">Descrição</Label>
            <Input id="description" name="description" required placeholder="Ex: Notebook novo" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="total_amount">Valor total (R$)</Label>
              <Input id="total_amount" name="total_amount" type="number" step="0.01" min="0.01" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="installments_total">Nº de parcelas</Label>
              <Input
                id="installments_total"
                name="installments_total"
                type="number"
                min={1}
                max={120}
                step={1}
                required
                defaultValue={2}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Forma de pagamento</Label>
              <Select name="payment_method" defaultValue="cartao">
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
              <Label htmlFor="first_due_date">1ª parcela em</Label>
              <Input
                id="first_due_date"
                name="first_due_date"
                type="date"
                required
                defaultValue={toDateInputValue(new Date())}
              />
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
              <Select name="subcategory_id" disabled={!categoryId} key={categoryId}>
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
              Criar parcelamento
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
