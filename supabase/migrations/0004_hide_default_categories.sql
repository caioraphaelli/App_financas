-- ============================================================================
-- Migração 0004 — permite ao usuário "excluir" uma categoria ou subcategoria
-- Padrão (global, compartilhada entre todos os usuários). Como excluir a
-- linha de verdade afetaria todo mundo, guardamos apenas que aquele usuário
-- não quer mais ver aquele item — ele some da lista dele, sem tocar nos
-- dados de mais ninguém. Categorias/subcategorias próprias do usuário
-- continuam sendo excluídas de verdade (comportamento já existente).
-- ============================================================================

create table if not exists public.hidden_categories (
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, category_id)
);

create table if not exists public.hidden_subcategories (
  user_id uuid not null references auth.users(id) on delete cascade,
  subcategory_id uuid not null references public.subcategories(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, subcategory_id)
);

alter table public.hidden_categories enable row level security;
alter table public.hidden_subcategories enable row level security;

drop policy if exists "hidden_categories_all_own" on public.hidden_categories;
create policy "hidden_categories_all_own"
  on public.hidden_categories for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "hidden_subcategories_all_own" on public.hidden_subcategories;
create policy "hidden_subcategories_all_own"
  on public.hidden_subcategories for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
