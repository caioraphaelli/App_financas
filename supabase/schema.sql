-- ============================================================================
-- Finanças Pessoais — schema do banco de dados (Supabase / PostgreSQL)
-- Rode este arquivo no SQL Editor do seu projeto Supabase (uma única vez).
-- ============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------------
-- Categorias e subcategorias (dados de referência, compartilhados por todos
-- os usuários autenticados; não há CRUD de categorias no app, apenas seed).
-- ----------------------------------------------------------------------------
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('receita', 'despesa')),
  color text not null default '#64748b',
  icon text not null default 'circle',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.subcategories (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.categories(id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Compras parceladas (cartão ou boleto). Cada compra gera N transações
-- (uma por parcela), permitindo saber quanto da renda futura já está
-- comprometido mês a mês.
-- ----------------------------------------------------------------------------
create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  description text not null,
  category_id uuid references public.categories(id),
  subcategory_id uuid references public.subcategories(id),
  total_amount numeric(12, 2) not null check (total_amount > 0),
  installments_total int not null check (installments_total > 0),
  payment_method text not null check (payment_method in ('cartao', 'boleto')),
  first_due_date date not null,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Transações: receitas e despesas. Despesas podem ser variáveis, fixas ou
-- parcelas de uma compra parcelada (cartão/boleto), ligadas via purchase_id.
-- ----------------------------------------------------------------------------
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('receita', 'despesa')),
  description text not null,
  amount numeric(12, 2) not null check (amount > 0),
  date date not null,
  category_id uuid references public.categories(id),
  subcategory_id uuid references public.subcategories(id),
  expense_kind text check (expense_kind in ('variavel', 'fixa', 'parcelada_cartao', 'parcelada_boleto')),
  purchase_id uuid references public.purchases(id) on delete cascade,
  installment_number int,
  installments_total int,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists transactions_user_date_idx on public.transactions (user_id, date desc);
create index if not exists transactions_purchase_idx on public.transactions (purchase_id);
create index if not exists purchases_user_idx on public.purchases (user_id);
create index if not exists subcategories_category_idx on public.subcategories (category_id);

-- ----------------------------------------------------------------------------
-- updated_at automático em transactions
-- ----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_transactions_updated_at on public.transactions;
create trigger set_transactions_updated_at
  before update on public.transactions
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------------------
alter table public.categories enable row level security;
alter table public.subcategories enable row level security;
alter table public.purchases enable row level security;
alter table public.transactions enable row level security;

-- Categorias/subcategorias: leitura para qualquer usuário autenticado.
drop policy if exists "categories_select_authenticated" on public.categories;
create policy "categories_select_authenticated"
  on public.categories for select
  to authenticated
  using (true);

drop policy if exists "subcategories_select_authenticated" on public.subcategories;
create policy "subcategories_select_authenticated"
  on public.subcategories for select
  to authenticated
  using (true);

-- Purchases: cada usuário só vê/gerencia as próprias compras parceladas.
drop policy if exists "purchases_select_own" on public.purchases;
create policy "purchases_select_own"
  on public.purchases for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "purchases_insert_own" on public.purchases;
create policy "purchases_insert_own"
  on public.purchases for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "purchases_update_own" on public.purchases;
create policy "purchases_update_own"
  on public.purchases for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "purchases_delete_own" on public.purchases;
create policy "purchases_delete_own"
  on public.purchases for delete
  to authenticated
  using (auth.uid() = user_id);

-- Transactions: cada usuário só vê/gerencia as próprias transações.
drop policy if exists "transactions_select_own" on public.transactions;
create policy "transactions_select_own"
  on public.transactions for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "transactions_insert_own" on public.transactions;
create policy "transactions_insert_own"
  on public.transactions for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "transactions_update_own" on public.transactions;
create policy "transactions_update_own"
  on public.transactions for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "transactions_delete_own" on public.transactions;
create policy "transactions_delete_own"
  on public.transactions for delete
  to authenticated
  using (auth.uid() = user_id);
