"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { updateUserSettings } from "@/lib/actions/user-settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { UserSettings } from "@/lib/types/database";

export function PrazoSettingsForm({ settings }: { settings: UserSettings }) {
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await updateUserSettings({}, formData);
      if (result.error) {
        setError(result.error);
      } else {
        setError(undefined);
        toast.success("Configurações de prazo salvas.");
      }
    });
  }

  return (
    <form action={handleSubmit} className="grid max-w-md gap-4">
      <p className="text-sm text-muted-foreground">
        Define o que conta como despesa de curto ou longo prazo em todo o app (Fluxo de Caixa,
        Transações e Parcelamentos), a partir do número de parcelas ou meses de contrato restantes.
        A faixa entre os dois limites é tratada como longo prazo.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label htmlFor="limite_curto_prazo_meses">Curto prazo até (meses)</Label>
          <Input
            id="limite_curto_prazo_meses"
            name="limite_curto_prazo_meses"
            type="number"
            min={1}
            max={360}
            required
            defaultValue={settings.limite_curto_prazo_meses}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="limite_longo_prazo_meses">Longo prazo acima de (meses)</Label>
          <Input
            id="limite_longo_prazo_meses"
            name="limite_longo_prazo_meses"
            type="number"
            min={1}
            max={360}
            required
            defaultValue={settings.limite_longo_prazo_meses}
          />
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="size-4 animate-spin" />}
          Salvar
        </Button>
      </div>
    </form>
  );
}
