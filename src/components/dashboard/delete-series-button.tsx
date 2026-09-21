"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { ActionResult } from "@/lib/actions/transactions";

/** Botão de excluir que, quando o item faz parte de uma série (recorrência
 * fixa ou previsão repetida), pergunta antes se é para excluir só esta
 * ocorrência ou a série inteira. Fora de uma série, é uma confirmação
 * simples como antes. */
export function DeleteSeriesButton({
  title,
  description,
  hasSeries,
  seriesDescription,
  onDeleteSingle,
  onDeleteSeries,
}: {
  title: string;
  description: string;
  hasSeries: boolean;
  seriesDescription?: string;
  onDeleteSingle: () => Promise<ActionResult>;
  onDeleteSeries?: () => Promise<ActionResult>;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function run(action: () => Promise<ActionResult>) {
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Excluído com sucesso.");
        setOpen(false);
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" title={title}>
          <Trash2 className="size-4" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            {hasSeries ? (seriesDescription ?? description) : description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
          {hasSeries ? (
            <>
              <Button variant="outline" disabled={pending} onClick={() => run(onDeleteSingle)}>
                Só esta
              </Button>
              <AlertDialogAction disabled={pending} onClick={() => run(onDeleteSeries!)}>
                Toda a série
              </AlertDialogAction>
            </>
          ) : (
            <AlertDialogAction disabled={pending} onClick={() => run(onDeleteSingle)}>
              Excluir
            </AlertDialogAction>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
