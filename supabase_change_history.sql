-- ============================================================
-- BudgetFlow — Historique des modifications (journal d'audit)
-- À exécuter dans l'éditeur SQL de Supabase (une seule fois).
-- ============================================================

-- 1) Table d'historique (append-only)
create table if not exists public.change_history (
  id            uuid primary key default gen_random_uuid(),
  entity_type   text not null,            -- grant | budget_line | sub_budget_line | engagement | payment | prefinancing | employee_loan
  entity_id     text not null,
  entity_label  text,                     -- libellé lisible (n° engagement, nom subvention…)
  grant_id      text,                     -- pour filtrer par subvention
  action        text not null default 'update',
  changes       jsonb not null default '[]'::jsonb,  -- [{ field, oldValue, newValue }]
  changed_by    uuid,                     -- id de l'utilisateur (auth.users)
  changed_by_name text,                   -- nom lisible de l'auteur
  created_at    timestamptz not null default now()
);

create index if not exists idx_change_history_grant   on public.change_history(grant_id);
create index if not exists idx_change_history_created  on public.change_history(created_at desc);
create index if not exists idx_change_history_entity   on public.change_history(entity_type, entity_id);

-- 2) RLS : lecture + insertion pour les utilisateurs connectés.
--    Pas de UPDATE/DELETE : l'historique est immuable (append-only).
alter table public.change_history enable row level security;

drop policy if exists "change_history_read"   on public.change_history;
drop policy if exists "change_history_insert" on public.change_history;

create policy "change_history_read"
  on public.change_history for select
  to authenticated
  using (true);

create policy "change_history_insert"
  on public.change_history for insert
  to authenticated
  with check (true);

-- ============================================================
-- Fin. Rechargez l'application après exécution.
-- ============================================================
