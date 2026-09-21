"use client";

import { useMemo, useState, useTransition } from "react";
import { CreditCard, Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { convertForecastToPurchase, convertForecastToTransaction } from "@/lib/actions/forecasts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  Category,
  ForecastWithRelations,
  PaymentMethod,
  PurchasePaymentType,
  Subcategory,
} from "@/lib/types/database";
import { toDateInputValue } from "@/lib/format";

/** Formulário de conversão de previsão em lançamento real (transação avulsa
 * ou compra parcelada). Não gerencia o próprio Dialog — é embutido como aba
 * dentro do diálogo de edição da previsão. */
export function ForecastConvertForm({
  forecast,
  categories,
  subcategoriesByCategory,
  paymentMethods,
  onSuccess,
}: {
  forecast: ForecastWithRelations;
  categories: Category[];
  subcategoriesByCategory: Record<string, Subcategory[]>;
  paymentMethods: PaymentMethod[];
  onSuccess: () => void;
}) {
  const [mode, setMode] = useState<"avista" | "parcelada">("avista");
  const [categoryId, setCategoryId] = useState(forecast.category_id ?? "");
  const [paymentMethodId, setPaymentMethodId] = useState(forecast.payment_method_id ?? "");
  const [purchasePaymentMethod, setPurchasePaymentMethod] = useState<PurchasePaymentType>(
    forecast.payment_method?.kind === "boleto" ? "boleto" : "cartao"
  );
  const [purchasePaymentMethodId, setPurchasePaymentMethodId] = useState(
    forecast.payment_method?.kind === "cartao" ? forecast.payment_method_id ?? "" : ""
  );
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const relevantCategories = useMemo(
    () => categories.filter((c) => c.type === forecast.type),
    [categories, forecast.type]
  );
  const subcategories = categoryId ? subcategoriesByCategory[categoryId] ?? [] : [];
  const filteredPurchasePaymentMethods = useMemo(
    () => paymentMethods.filter((pm) => pm.kind === purchasePaymentMethod),
    [paymentMethods, purchasePaymentMethod]
  );

  function handleSubmitTransaction(formData: FormData) {
    startTransition(async () => {
      const result = await convertForecastToTransaction({}, formData);
      if (result.error) {
        setError(result.error);
      } else {
        setError(undefined);
        onSuccess();
        toast.success("Previsão convertida em transação.");
      }
    });
  }

  function handleSubmitPurchase(formData: FormData) {
    startTransition(async () => {
      const result = await convertForecastToPurchase({}, formData);
      if (result.error) {
        setError(result.error);
      } else {
        setError(undefined);
        onSuccess();
        toast.success("Previsão convertida em compra parcelada.");
      }
    });
  }

  return (
    <Tabs value={mode} onValueChange={(v) => setMode(v as "avista" | "parcelada")}>
      <TabsList className="w-full">
        <TabsTrigger value="avista" className="flex-1 gap-1.5">
          <Wallet className="size-4" />
          Transação avulsa
        </TabsTrigger>
        <TabsTrigger value="parcelada" className="flex-1 gap-1.5" disabled={forecast.type !== "despesa"}>
          <CreditCard className="size-4" />
          Compra parcelada
        </TabsTrigger>
      </TabsList>

      <TabsContent value="avista" className="mt-4">
        <form action={handleSubmitTransaction} className="grid gap-4">
          <input type="hidden" name="forecast_id" value={forecast.id} />
          <div className="grid gap-2">
            <Label htmlFor="description-t">Descrição</Label>
            <Input id="description-t" name="description" required defaultValue={forecast.description} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="amount-t">Valor (R$)</Label>
              <Input
                id="amount-t"
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                required
                defaultValue={forecast.amount}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="date-t">Data</Label>
              <Input
                id="date-t"
                name="date"
                type="date"
                required
                defaultValue={forecast.data_prevista}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label>Categoria</Label>
              <Select name="category_id" value={categoryId} onValueChange={setCategoryId} required>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {relevantCategories.map((c) => (
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
          {forecast.type === "despesa" && (
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
          <Button type="submit" disabled={pending} className="w-full">
            {pending && <Loader2 className="size-4 animate-spin" />}
            Converter
          </Button>
        </form>
      </TabsContent>

      <TabsContent value="parcelada" className="mt-4">
        <form action={handleSubmitPurchase} className="grid gap-4">
          <input type="hidden" name="forecast_id" value={forecast.id} />
          <div className="grid gap-2">
            <Label htmlFor="description-p">Descrição</Label>
            <Input id="description-p" name="description" required defaultValue={forecast.description} />
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
                defaultValue={forecast.amount}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="installments_total">Nº de parcelas</Label>
              <Input id="installments_total" name="installments_total" type="number" min={1} max={120} required defaultValue={2} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-2">
              <Label htmlFor="starting_installment">Parcela inicial</Label>
              <Input id="starting_installment" name="starting_installment" type="number" min={1} defaultValue={1} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="first_due_date">Data da compra</Label>
              <Input
                id="first_due_date"
                name="first_due_date"
                type="date"
                required
                defaultValue={forecast.data_prevista ?? toDateInputValue(new Date())}
              />
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
            {purchasePaymentMethod === "cartao" && (
              <div className="grid gap-2">
                <Label>Cartão</Label>
                <Select
                  name="payment_method_id"
                  value={purchasePaymentMethodId}
                  onValueChange={setPurchasePaymentMethodId}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder={filteredPurchasePaymentMethods.length ? "Selecione" : "Nenhum cartão cadastrado"} />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredPurchasePaymentMethods.map((pm) => (
                      <SelectItem key={pm.id} value={pm.id}>
                        {pm.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <div className="grid gap-2">
            <Label>Categoria</Label>
            <Select name="category_id" value={categoryId} onValueChange={setCategoryId} required>
              <SelectTrigger>
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent>
                {relevantCategories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={pending} className="w-full">
            {pending && <Loader2 className="size-4 animate-spin" />}
            Converter
          </Button>
        </form>
      </TabsContent>
    </Tabs>
  );
}
