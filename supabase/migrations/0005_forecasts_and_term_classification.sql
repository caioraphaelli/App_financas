-- ============================================================================
-- Migração 0005 — Fase 2 (FinControl): previsões (forecasts), configurações
-- de prazo curto/longo do usuário, e contrato com fim definido em despesas
-- fixas recorrentes (para permitir classificação de prazo também nelas).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Configurações de prazo por usuário (padrão: curto <= 3 meses, longo > 10).
--    A faixa entre os dois limites é tratada como longo prazo (ver camada de
--    aplicação — não existe uma 3ª categoria "médio prazo" nesta fase).
-- ----------------------------------------------------------------------------
create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  limite_curto_prazo_meses int not null default 3 check (limite_curto_prazo_meses >= 1),
  limite_longo_prazo_meses int not null default 10 check (limite_longo_prazo_meses >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

drop policy if exists "user_settings_select_own" on public.user_settings;
create policy "user_settings_select_own"
  on public.user_settings for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "user_settings_insert_own" on public.user_settings;
create policy "user_settings_insert_own"
  on public.user_settings for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "user_settings_update_own" on public.user_settings;
create policy "user_settings_update_own"
  on public.user_settings for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_user_settings_updated_at on public.user_settings;
create trigger set_user_settings_updated_at
  before update on public.user_settings
  for each row execute function public.set_updated_at();

-- Cria a configuração padrão automaticamente para todo novo usuário.
create or replace function public.handle_new_user_settings()
returns trigger as $$
begin
  insert into public.user_settings (user_id) values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created_settings on auth.users;
create trigger on_auth_user_created_settings
  after insert on auth.users
  for each row execute function public.handle_new_user_settings();

-- Backfill para usuários que já existiam antes desta migração.
insert into public.user_settings (user_id)
select u.id from auth.users u
where not exists (select 1 from public.user_settings s where s.user_id = u.id);

-- ----------------------------------------------------------------------------
-- 2. Despesas fixas/recorrentes podem ter um contrato com fim definido
--    (ex.: plano de celular de 12 meses). Quando preenchido, a despesa fixa
--    também entra na classificação dinâmica de prazo (curto/longo) por tempo
--    restante até o fim do contrato; quando nulo, é indefinida (ex.: aluguel).
-- ----------------------------------------------------------------------------
alter table public.recurring_series
  add column if not exists data_fim_contrato date;

-- ----------------------------------------------------------------------------
-- 3. Previsões (forecasts): estimativa manual de receita/despesa futura,
--    ainda não confirmada. Pode repetir por N meses consecutivos (cada mês
--    vira uma linha própria, agrupadas por group_id, cada uma com status
--    independente). Ao expirar (data prevista no passado e ainda pendente),
--    o status "não_realizada" é calculado na leitura (não há job/cron nesta
--    fase) — ver camada de aplicação.
-- ----------------------------------------------------------------------------
create table if not exists public.forecasts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  group_id uuid,
  type text not null check (type in ('receita', 'despesa')),
  description text not null,
  amount numeric(12, 2) not null check (amount > 0),
  category_id uuid references public.categories(id),
  subcategory_id uuid references public.subcategories(id),
  data_prevista date not null,
  meses_repeticao int check (meses_repeticao between 1 and 360),
  status text not null default 'pendente' check (status in ('pendente', 'convertida', 'nao_realizada')),
  transaction_id uuid references public.transactions(id) on delete set null,
  purchase_id uuid references public.purchases(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists forecasts_user_idx on public.forecasts (user_id);
create index if not exists forecasts_user_date_idx on public.forecasts (user_id, data_prevista);
create index if not exists forecasts_group_idx on public.forecasts (group_id);

alter table public.forecasts enable row level security;

drop trigger if exists set_forecasts_updated_at on public.forecasts;
create trigger set_forecasts_updated_at
  before update on public.forecasts
  for each row execute function public.set_updated_at();

drop policy if exists "forecasts_select_own" on public.forecasts;
create policy "forecasts_select_own"
  on public.forecasts for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "forecasts_insert_own" on public.forecasts;
create policy "forecasts_insert_own"
  on public.forecasts for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "forecasts_update_own" on public.forecasts;
create policy "forecasts_update_own"
  on public.forecasts for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "forecasts_delete_own" on public.forecasts;
create policy "forecasts_delete_own"
  on public.forecasts for delete
  to authenticated
  using (auth.uid() = user_id);
