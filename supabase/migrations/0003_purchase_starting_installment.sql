-- ============================================================================
-- Migração 0003 — permite registrar uma compra parcelada a partir de uma
-- parcela específica (ex.: compra em 10x, mas já pagando a 6ª — lança-se
-- apenas as parcelas 6 a 10, sem recriar as que já foram pagas antes de
-- o usuário começar a usar o app).
-- ============================================================================

alter table public.purchases
  add column if not exists starting_installment int not null default 1;

alter table public.purchases
  drop constraint if exists purchases_starting_installment_check;

alter table public.purchases
  add constraint purchases_starting_installment_check
  check (starting_installment >= 1 and starting_installment <= installments_total);
