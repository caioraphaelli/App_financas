"use client";

import { useMemo, useState, useTransition } from "react";
import { ChevronDown, ChevronRight, Loader2, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DeleteButton } from "@/components/dashboard/delete-button";
import {
  createCategory,
  createSubcategory,
  deleteCategory,
  deleteSubcategory,
  updateCategory,
  updateSubcategory,
} from "@/lib/actions/categories";
import type { Category, Subcategory, TransactionType } from "@/lib/types/database";

const CATEGORY_COLORS = [
  "#2a78d6",
  "#eb6834",
  "#1baf7a",
  "#eda100",
  "#e87ba4",
  "#008300",
  "#4a3aa7",
  "#e34948",
];

export function CategoriesManager({
  categories,
  subcategoriesByCategory,
}: {
  categories: Category[];
  subcategoriesByCategory: Record<string, Subcategory[]>;
}) {
  const [type, setType] = useState<TransactionType>("despesa");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => categories.filter((c) => c.type === type), [categories, type]);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs value={type} onValueChange={(v) => setType(v as TransactionType)}>
          <TabsList>
            <TabsTrigger value="despesa">Despesas</TabsTrigger>
            <TabsTrigger value="receita">Receitas</TabsTrigger>
          </TabsList>
        </Tabs>
        <NewCategoryDialog type={type} />
      </div>

      {filtered.length === 0 ? (
        <div className="flex h-32 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
          Nenhuma categoria de {type === "despesa" ? "despesa" : "receita"} ainda.
        </div>
      ) : (
        <div className="grid gap-2">
          {filtered.map((category) => {
            const isOwn = category.user_id !== null;
            const subs = subcategoriesByCategory[category.id] ?? [];
            const isOpen = expanded.has(category.id);
            return (
              <div key={category.id} className="rounded-md border">
                <div className="flex items-center gap-2 p-3">
                  <button
                    type="button"
                    onClick={() => toggle(category.id)}
                    className="flex flex-1 items-center gap-2 text-left"
                  >
                    {isOpen ? (
                      <ChevronDown className="size-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="size-4 text-muted-foreground" />
                    )}
                    <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: category.color }} />
                    <span className="font-medium">{category.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {subs.length} subcategoria{subs.length === 1 ? "" : "s"}
                    </span>
                  </button>
                  {!isOwn && (
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      Padrão
                    </Badge>
                  )}
                  {isOwn && (
                    <EditCategoryDialog category={category} />
                  )}
                  <DeleteButton
                    title="Excluir categoria"
                    description={
                      isOwn
                        ? `Tem certeza que deseja excluir "${category.name}"? Isso só é possível se não houver transações usando essa categoria.`
                        : `"${category.name}" é uma categoria padrão do sistema. Ela será ocultada apenas para a sua conta — outras contas continuam vendo normalmente.`
                    }
                    onDelete={() => deleteCategory(category.id)}
                  />
                </div>
                {isOpen && (
                  <div className="border-t bg-muted/30 p-3">
                    <div className="grid gap-2">
                      {subs.map((sub) => (
                        <div key={sub.id} className="flex items-center gap-2 text-sm">
                          <span className="flex-1">{sub.name}</span>
                          {sub.user_id === null && (
                            <Badge variant="outline" className="text-xs text-muted-foreground">
                              Padrão
                            </Badge>
                          )}
                          {sub.user_id !== null && <EditSubcategoryDialog subcategory={sub} />}
                          <DeleteButton
                            title="Excluir subcategoria"
                            description={
                              sub.user_id !== null
                                ? `Excluir "${sub.name}"? Isso só é possível se não houver transações usando essa subcategoria.`
                                : `"${sub.name}" é uma subcategoria padrão do sistema. Ela será ocultada apenas para a sua conta.`
                            }
                            onDelete={() => deleteSubcategory(sub.id)}
                            trigger={
                              <Button variant="ghost" size="sm" className="h-7 text-destructive">
                                Excluir
                              </Button>
                            }
                          />
                        </div>
                      ))}
                      {subs.length === 0 && (
                        <p className="text-sm text-muted-foreground">Nenhuma subcategoria.</p>
                      )}
                    </div>
                    <NewSubcategoryForm categoryId={category.id} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NewCategoryDialog({ type }: { type: TransactionType }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createCategory({}, formData);
      if (result.error) {
        setError(result.error);
      } else {
        setError(undefined);
        setOpen(false);
        toast.success("Categoria criada.");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setError(undefined);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" />
          Nova categoria
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Nova categoria</DialogTitle>
          <DialogDescription>
            Será criada como categoria de {type === "despesa" ? "despesa" : "receita"}.
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="grid gap-4">
          <input type="hidden" name="type" value={type} />
          <div className="grid gap-2">
            <Label htmlFor="name">Nome</Label>
            <Input id="name" name="name" required placeholder="Ex: Pets" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Criar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditCategoryDialog({ category }: { category: Category }) {
  const [open, setOpen] = useState(false);
  const [color, setColor] = useState(category.color);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await updateCategory({}, formData);
      if (result.error) {
        setError(result.error);
      } else {
        setError(undefined);
        setOpen(false);
        toast.success("Categoria atualizada.");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setError(undefined);
        if (next) setColor(category.color);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="size-7" title="Editar categoria">
          <Pencil className="size-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Editar categoria</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="grid gap-4">
          <input type="hidden" name="id" value={category.id} />
          <input type="hidden" name="color" value={color} />
          <div className="grid gap-2">
            <Label htmlFor="edit-category-name">Nome</Label>
            <Input id="edit-category-name" name="name" required defaultValue={category.name} />
          </div>
          <div className="grid gap-2">
            <Label>Cor</Label>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    "size-7 rounded-full border-2",
                    color === c ? "border-foreground" : "border-transparent"
                  )}
                  style={{ backgroundColor: c }}
                  aria-label={c}
                />
              ))}
            </div>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditSubcategoryDialog({ subcategory }: { subcategory: Subcategory }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await updateSubcategory({}, formData);
      if (result.error) {
        setError(result.error);
      } else {
        setError(undefined);
        setOpen(false);
        toast.success("Subcategoria atualizada.");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        setError(undefined);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="size-7" title="Editar subcategoria">
          <Pencil className="size-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Editar subcategoria</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="grid gap-4">
          <input type="hidden" name="id" value={subcategory.id} />
          <div className="grid gap-2">
            <Label htmlFor="edit-subcategory-name">Nome</Label>
            <Input id="edit-subcategory-name" name="name" required defaultValue={subcategory.name} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="size-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function NewSubcategoryForm({ categoryId }: { categoryId: string }) {
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      const result = await createSubcategory({}, formData);
      if (result.error) {
        toast.error(result.error);
      } else {
        setName("");
        toast.success("Subcategoria criada.");
      }
    });
  }

  return (
    <form action={handleSubmit} className="mt-3 flex gap-2">
      <input type="hidden" name="category_id" value={categoryId} />
      <Input
        name="name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nova subcategoria"
        className="h-8"
        required
      />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
        Adicionar
      </Button>
    </form>
  );
}
