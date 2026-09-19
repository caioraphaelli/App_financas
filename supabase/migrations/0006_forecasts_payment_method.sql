-- ============================================================================
-- Migração 0006 — adiciona forma de pagamento às previsões (forecasts).
-- ============================================================================

alter table public.forecasts
  add column if not exists payment_method_id uuid references public.payment_methods(id) on delete set null;
