"use client";

import { useMemo, useState, useTransition } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { createForecast, updateForecast } from "@/lib/actions/forecasts";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Category, ForecastWithRelations, PaymentMethod, Subcategory } from "@/lib/types/database";
import { toDateInputValue } from "@/lib/format";

export function ForecastFormDialog({
  categories,
  subcategoriesByCategory,
  paymentMethods,
  forecast,
  trigger,
}: {
  categories: Category[];
  subcategoriesByCategory: Record<string, Subcategory[]>;
  paymentMethods: PaymentMethod[];
  forecast?: ForecastWithRelations;
  trigger?: React.ReactNode;
}) {
  const isEdit = Boolean(forecast);
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"receita" | "despesa">(forecast?.type ?? "despesa");
  const [categoryId, setCategoryId] = useState(forecast?.category_id ?? "");
  const [paymentMethodId, setPaymentMethodId] = useState(forecast?.payment_method_id ?? "");
  const [repeat, setRepeat] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const action = isEdit ? updateForecast : createForecast;
  const filteredCategories = useMemo(() => categories.filter((c) => c.type === type), [categories, type]);
  const subcategories = categoryId ? subcategoriesByCategory[categoryId] ?? [] : [];

  function resetState() {
    setType(forecast?.type ?? "despesa");
    setCategoryId(forecast?.category_id ?? "");
    setPaymentMethodId(forecast?.payment_method_id ?? "");
    setRepeat(false);
  }

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await action({}, formData);
      if (result.error) {
        setError(result.error);
      } else {
        setError(undefined);
        setOpen(false);
        toast.success(isEdit ? "Previsão atualizada." : "Previsão criada.");
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
          <Button variant="outline">
            <Plus className="size-4" />
            Nova previsão
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar previsão" : "Nova previsão"}</DialogTitle>
          <DialogDescription>
            Estimativa de receita ou despesa futura, ainda não confirmada. Você pode editá-la ou
            convertê-la em um lançamento real quando se concretizar.
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="grid gap-4">
          {isEdit && <input type="hidden" name="id" value={forecast!.id} />}

          <div className="grid gap-2">
            <Label>Natureza</Label>
            <Select
              name="type"
              value={type}
              onValueChange={(v) => {
                setType(v as "receita" | "despesa");
                setCategoryId("");
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

          <div className="grid gap-2">
            <Label htmlFor="description">Descrição</Label>
            <Input
              id="description"
              name="description"
              required
              defaultValue={forecast?.description}
              placeholder="Ex: Conserto do carro"
            />
          </div>

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
                defaultValue={forecast?.amount}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="data_prevista">Data prevista</Label>
              <Input
                id="data_prevista"
                name="data_prevista"
                type="date"
                required
                defaultValue={forecast?.data_prevista ?? toDateInputValue(new Date())}
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
                defaultValue={forecast?.subcategory_id ?? ""}
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

          {!isEdit && (
            <div className="grid gap-3 rounded-md border bg-muted/30 p-3">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={repeat} onCheckedChange={(c) => setRepeat(c === true)} />
                Repetir por vários meses consecutivos
              </label>
              {repeat && (
                <div className="grid gap-2">
                  <Label htmlFor="meses_repeticao">Quantos meses?</Label>
                  <Input
                    id="meses_repeticao"
                    name="meses_repeticao"
                    type="number"
                    min={2}
                    max={360}
                    defaultValue={6}
                    required
                  />
                </div>
              )}
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? "Salvar alterações" : "Criar previsão"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
