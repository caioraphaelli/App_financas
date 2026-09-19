"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { updateForecastGroup } from "@/lib/actions/forecasts";
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
import type { Category, ForecastWithRelations, PaymentMethod, Subcategory } from "@/lib/types/database";

export function ForecastGroupEditDialog({
  forecast,
  categories,
  subcategoriesByCategory,
  paymentMethods,
  open,
  onOpenChange,
}: {
  forecast: ForecastWithRelations;
  categories: Category[];
  subcategoriesByCategory: Record<string, Subcategory[]>;
  paymentMethods: PaymentMethod[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [categoryId, setCategoryId] = useState(forecast.category_id ?? "");
  const [paymentMethodId, setPaymentMethodId] = useState(forecast.payment_method_id ?? "");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const filteredCategories = useMemo(
    () => categories.filter((c) => c.type === forecast.type),
    [categories, forecast.type]
  );
  const subcategories = categoryId ? subcategoriesByCategory[categoryId] ?? [] : [];

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await updateForecastGroup({}, formData);
      if (result.error) {
        setError(result.error);
      } else {
        setError(undefined);
        onOpenChange(false);
        toast.success("Série de previsões atualizada.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar série de previsões</DialogTitle>
          <DialogDescription>
            As alterações serão aplicadas a todas as ocorrências desta previsão repetida que ainda não
            foram convertidas. A data prevista de cada ocorrência não muda.
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="grid gap-4">
          <input type="hidden" name="group_id" value={forecast.group_id ?? ""} />

          <div className="grid gap-2">
            <Label htmlFor="group-description">Descrição</Label>
            <Input id="group-description" name="description" required defaultValue={forecast.description} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="group-amount">Valor (R$)</Label>
            <Input
              id="group-amount"
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              required
              defaultValue={forecast.amount}
            />
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
                defaultValue={forecast.subcategory_id ?? ""}
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
          </div>

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
