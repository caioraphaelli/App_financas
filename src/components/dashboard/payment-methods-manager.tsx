"use client";

import { Banknote, CreditCard, Landmark, QrCode, Wallet, Pencil } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DeleteButton } from "@/components/dashboard/delete-button";
import { PaymentMethodFormDialog } from "@/components/dashboard/payment-method-form-dialog";
import { deletePaymentMethod } from "@/lib/actions/payment-methods";
import { formatCurrency } from "@/lib/format";
import type { PaymentMethod, PaymentMethodKind } from "@/lib/types/database";

const KIND_ICON: Record<PaymentMethodKind, typeof Wallet> = {
  dinheiro: Banknote,
  pix: QrCode,
  boleto: Landmark,
  cartao: CreditCard,
  outro: Wallet,
};

const KIND_LABELS: Record<PaymentMethodKind, string> = {
  dinheiro: "Dinheiro",
  pix: "PIX",
  boleto: "Boleto",
  cartao: "Cartão de crédito",
  outro: "Outro",
};

export function PaymentMethodsManager({ methods }: { methods: PaymentMethod[] }) {
  return (
    <div className="grid gap-4">
      <div className="flex justify-end">
        <PaymentMethodFormDialog />
      </div>

      {methods.length === 0 ? (
        <div className="flex h-32 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
          Nenhuma forma de pagamento cadastrada.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {methods.map((method) => {
            const Icon = KIND_ICON[method.kind];
            return (
              <Card key={method.id}>
                <CardContent className="grid gap-3 pt-6">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="flex size-8 shrink-0 items-center justify-center rounded-md"
                        style={{ backgroundColor: `${method.color}1a`, color: method.color }}
                      >
                        <Icon className="size-4" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{method.name}</p>
                        <p className="text-xs text-muted-foreground">{KIND_LABELS[method.kind]}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <PaymentMethodFormDialog
                        method={method}
                        trigger={
                          <Button variant="ghost" size="icon">
                            <Pencil className="size-4" />
                          </Button>
                        }
                      />
                      <DeleteButton
                        title="Excluir forma de pagamento"
                        description={`Tem certeza que deseja excluir "${method.name}"?`}
                        onDelete={() => deletePaymentMethod(method.id)}
                      />
                    </div>
                  </div>

                  {method.kind === "cartao" && (
                    <div className="flex flex-wrap gap-1.5 text-xs">
                      {method.card_brand && <Badge variant="outline">{method.card_brand}</Badge>}
                      {method.card_last_digits && (
                        <Badge variant="outline">•••• {method.card_last_digits}</Badge>
                      )}
                      {method.closing_day && (
                        <Badge variant="outline">Fecha dia {method.closing_day}</Badge>
                      )}
                      {method.due_day && <Badge variant="outline">Vence dia {method.due_day}</Badge>}
                      {method.credit_limit && (
                        <Badge variant="outline">Limite {formatCurrency(Number(method.credit_limit))}</Badge>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
