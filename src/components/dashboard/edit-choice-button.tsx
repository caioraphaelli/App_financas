"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** Botão de editar que, quando o item faz parte de uma série (recorrência
 * fixa ou previsão repetida), pergunta antes se é para editar só esta
 * ocorrência ou a série inteira. Fora de uma série, edita direto. */
export function EditChoiceButton({
  hasSeries,
  onChooseSingle,
  onChooseSeries,
}: {
  hasSeries: boolean;
  onChooseSingle: () => void;
  onChooseSeries: () => void;
}) {
  const [open, setOpen] = useState(false);

  if (!hasSeries) {
    return (
      <Button variant="ghost" size="icon" title="Editar" onClick={onChooseSingle}>
        <Pencil className="size-4" />
      </Button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" title="Editar">
          <Pencil className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-1" align="end">
        <button
          type="button"
          className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
          onClick={() => {
            setOpen(false);
            onChooseSingle();
          }}
        >
          Editar só esta
        </button>
        <button
          type="button"
          className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
          onClick={() => {
            setOpen(false);
            onChooseSeries();
          }}
        >
          Editar toda a série
        </button>
      </PopoverContent>
    </Popover>
  );
}
