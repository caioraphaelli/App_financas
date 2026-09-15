-- ============================================================================
-- Migração 0002 — Formas de pagamento/cartões, categorias editáveis pelo
-- usuário e lançamentos recorrentes (despesa/receita fixa por período).
-- Rode este arquivo no SQL Editor do seu projeto Supabase, depois do
-- schema.sql + seed.sql originais. Seguro para rodar mais de uma vez.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Categorias/subcategorias passam a poder ser criadas pelo usuário.
--    user_id = null continua sendo as categorias padrão (globais, somente
--    leitura); user_id = auth.uid() são categorias/subcategorias próprias,
--    que o dono pode editar/excluir.
-- ----------------------------------------------------------------------------
alter table public.categories
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

alter table public.subcategories
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists categories_user_idx on public.categories (user_id);
create index if not exists subcategories_user_idx on public.subcategories (user_id);

-- ----------------------------------------------------------------------------
-- 2. Formas de pagamento (Dinheiro, PIX, Boleto, Cartão de crédito, Outro).
--    Um "cartão de crédito" é uma forma de pagamento do tipo 'cartao', com
--    campos extras (bandeira, dia de fechamento/vencimento, limite).
-- ----------------------------------------------------------------------------
create table if not exists public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('dinheiro', 'pix', 'boleto', 'cartao', 'outro')),
  card_brand text,
  card_last_digits text,
  closing_day int check (closing_day between 1 and 31),
  due_day int check (due_day between 1 and 31),
  credit_limit numeric(12, 2),
  color text not null default '#2a78d6',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists payment_methods_user_idx on public.payment_methods (user_id);

alter table public.payment_methods enable row level security;

drop policy if exists "payment_methods_select_own" on public.payment_methods;
create policy "payment_methods_select_own"
  on public.payment_methods for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "payment_methods_insert_own" on public.payment_methods;
create policy "payment_methods_insert_own"
  on public.payment_methods for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "payment_methods_update_own" on public.payment_methods;
create policy "payment_methods_update_own"
  on public.payment_methods for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "payment_methods_delete_own" on public.payment_methods;
create policy "payment_methods_delete_own"
  on public.payment_methods for delete
  to authenticated
  using (auth.uid() = user_id);

-- Cria Dinheiro/PIX/Boleto automaticamente para todo novo usuário.
create or replace function public.handle_new_user_payment_methods()
returns trigger as $$
begin
  insert into public.payment_methods (user_id, name, kind, color) values
    (new.id, 'Dinheiro', 'dinheiro', '#008300'),
    (new.id, 'PIX', 'pix', '#2a78d6'),
    (new.id, 'Boleto', 'boleto', '#eda100');
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created_payment_methods on auth.users;
create trigger on_auth_user_created_payment_methods
  after insert on auth.users
  for each row execute function public.handle_new_user_payment_methods();

-- Backfill: usuários que já existiam antes desta migração também recebem
-- as formas de pagamento padrão (só se ainda não tiverem nenhuma).
insert into public.payment_methods (user_id, name, kind, color)
select u.id, v.name, v.kind, v.color
from auth.users u
cross join (values
  ('Dinheiro', 'dinheiro', '#008300'),
  ('PIX', 'pix', '#2a78d6'),
  ('Boleto', 'boleto', '#eda100')
) as v(name, kind, color)
where not exists (
  select 1 from public.payment_methods pm where pm.user_id = u.id
);

-- ----------------------------------------------------------------------------
-- 3. Lançamentos recorrentes (despesa ou receita fixa repetida por um
--    período de meses, ou por tempo indeterminado). Cada série gera uma
--    transação por mês, mesmo valor em todas as ocorrências.
-- ----------------------------------------------------------------------------
create table if not exists public.recurring_series (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('receita', 'despesa')),
  description text not null,
  amount numeric(12, 2) not null check (amount > 0),
  category_id uuid references public.categories(id),
  subcategory_id uuid references public.subcategories(id),
  payment_method_id uuid references public.payment_methods(id) on delete set null,
  start_date date not null,
  period_type text not null check (period_type in ('meses', 'indeterminado')),
  months_count int check (months_count between 1 and 360),
  created_at timestamptz not null default now()
);

create index if not exists recurring_series_user_idx on public.recurring_series (user_id);

alter table public.recurring_series enable row level security;

drop policy if exists "recurring_series_select_own" on public.recurring_series;
create policy "recurring_series_select_own"
  on public.recurring_series for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "recurring_series_insert_own" on public.recurring_series;
create policy "recurring_series_insert_own"
  on public.recurring_series for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "recurring_series_update_own" on public.recurring_series;
create policy "recurring_series_update_own"
  on public.recurring_series for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "recurring_series_delete_own" on public.recurring_series;
create policy "recurring_series_delete_own"
  on public.recurring_series for delete
  to authenticated
  using (auth.uid() = user_id);

-- ----------------------------------------------------------------------------
-- 4. Transações e compras parceladas passam a referenciar forma de
--    pagamento (cartão cadastrado, dinheiro, PIX, boleto...) e transações
--    passam a poder pertencer a uma série recorrente.
-- ----------------------------------------------------------------------------
alter table public.transactions
  add column if not exists payment_method_id uuid references public.payment_methods(id) on delete set null;

alter table public.transactions
  add column if not exists recurring_series_id uuid references public.recurring_series(id) on delete cascade;

create index if not exists transactions_recurring_series_idx on public.transactions (recurring_series_id);

alter table public.purchases
  add column if not exists payment_method_id uuid references public.payment_methods(id) on delete set null;

-- ----------------------------------------------------------------------------
-- 5. RLS de categorias/subcategorias: continuam visíveis as globais
--    (user_id nulo) + as próprias; só o dono edita/exclui as próprias.
-- ----------------------------------------------------------------------------
drop policy if exists "categories_select_authenticated" on public.categories;
create policy "categories_select_own_or_global"
  on public.categories for select
  to authenticated
  using (user_id is null or user_id = auth.uid());

drop policy if exists "categories_insert_own" on public.categories;
create policy "categories_insert_own"
  on public.categories for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "categories_update_own" on public.categories;
create policy "categories_update_own"
  on public.categories for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "categories_delete_own" on public.categories;
create policy "categories_delete_own"
  on public.categories for delete
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "subcategories_select_authenticated" on public.subcategories;
create policy "subcategories_select_own_or_global"
  on public.subcategories for select
  to authenticated
  using (user_id is null or user_id = auth.uid());

drop policy if exists "subcategories_insert_own" on public.subcategories;
create policy "subcategories_insert_own"
  on public.subcategories for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "subcategories_update_own" on public.subcategories;
create policy "subcategories_update_own"
  on public.subcategories for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "subcategories_delete_own" on public.subcategories;
create policy "subcategories_delete_own"
  on public.subcategories for delete
  to authenticated
  using (user_id = auth.uid());
