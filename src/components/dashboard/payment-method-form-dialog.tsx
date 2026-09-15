"use client";

import { useState, useTransition } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { createPaymentMethod, updatePaymentMethod } from "@/lib/actions/payment-methods";
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
import type { PaymentMethod, PaymentMethodKind } from "@/lib/types/database";

const KIND_LABELS: Record<PaymentMethodKind, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  boleto: "Boleto",
  cartao: "Cartão de crédito",
  outro: "Outro",
};

export function PaymentMethodFormDialog({
  method,
  trigger,
}: {
  method?: PaymentMethod;
  trigger?: React.ReactNode;
}) {
  const isEdit = Boolean(method);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<PaymentMethodKind>(method?.kind ?? "cartao");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  const action = isEdit ? updatePaymentMethod : createPaymentMethod;

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await action({}, formData);
      if (result.error) {
        setError(result.error);
      } else {
        setError(undefined);
        setOpen(false);
        toast.success(isEdit ? "Forma de pagamento atualizada." : "Forma de pagamento criada.");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setError(undefined);
        if (next) setKind(method?.kind ?? "cartao");
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus className="size-4" />
            Nova forma de pagamento
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar forma de pagamento" : "Nova forma de pagamento"}</DialogTitle>
          <DialogDescription>
            Cadastre cartões de crédito, PIX, boleto, dinheiro ou outras formas usadas nos seus lançamentos.
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="grid gap-4">
          {isEdit && <input type="hidden" name="id" value={method!.id} />}

          <div className="grid gap-2">
            <Label>Tipo</Label>
            <Select name="kind" value={kind} onValueChange={(v) => setKind(v as PaymentMethodKind)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(KIND_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              name="name"
              required
              defaultValue={method?.name}
              placeholder={kind === "cartao" ? "Ex: Nubank Platinum" : "Ex: Carteira"}
            />
          </div>

          {kind === "cartao" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="card_brand">Bandeira</Label>
                  <Input
                    id="card_brand"
                    name="card_brand"
                    defaultValue={method?.card_brand ?? ""}
                    placeholder="Visa, Master..."
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="card_last_digits">Final do cartão</Label>
                  <Input
                    id="card_last_digits"
                    name="card_last_digits"
                    maxLength={4}
                    defaultValue={method?.card_last_digits ?? ""}
                    placeholder="1234"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="closing_day">Fechamento</Label>
                  <Input
                    id="closing_day"
                    name="closing_day"
                    type="number"
                    min={1}
                    max={31}
                    defaultValue={method?.closing_day ?? ""}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="due_day">Vencimento</Label>
                  <Input
                    id="due_day"
                    name="due_day"
                    type="number"
                    min={1}
                    max={31}
                    defaultValue={method?.due_day ?? ""}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="credit_limit">Limite (R$)</Label>
                  <Input
                    id="credit_limit"
                    name="credit_limit"
                    type="number"
                    step="0.01"
                    min="0"
                    defaultValue={method?.credit_limit ?? ""}
                  />
                </div>
              </div>
            </>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? "Salvar alterações" : "Criar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
