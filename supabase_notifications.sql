-- ============================================================
-- BudgetFlow — Traçabilité des notifications & transferts
-- À exécuter dans l'éditeur SQL de Supabase (une seule fois).
-- ============================================================

-- 1) Historique des tranches de montant notifié (une subvention peut être
--    notifiée en plusieurs tranches).
create table if not exists public.notification_tranches (
  id                uuid primary key default gen_random_uuid(),
  grant_id          uuid not null references public.grants(id) on delete cascade,
  amount            numeric not null,
  date              date not null default now(),
  distribution_mode text not null default 'same',           -- 'same' | 'custom'
  distribution      jsonb not null default '[]'::jsonb,      -- [{subBudgetLineId, amount}]
  note              text,
  created_by        text,
  created_at        timestamptz not null default now()
);

-- 2) Historique des transferts de fonds entre sous-lignes budgétaires.
create table if not exists public.subline_transfers (
  id                    uuid primary key default gen_random_uuid(),
  grant_id              uuid not null references public.grants(id) on delete cascade,
  from_sub_budget_line_id uuid not null references public.sub_budget_lines(id) on delete cascade,
  to_sub_budget_line_id   uuid not null references public.sub_budget_lines(id) on delete cascade,
  amount                numeric not null,
  date                  date not null default now(),
  reason                text,
  created_by            text,
  created_at            timestamptz not null default now()
);

-- 3) RLS : lecture/écriture réservées aux utilisateurs authentifiés.
alter table public.notification_tranches enable row level security;
alter table public.subline_transfers     enable row level security;

drop policy if exists "notif_tranches_all_auth" on public.notification_tranches;
create policy "notif_tranches_all_auth"
  on public.notification_tranches for all to authenticated
  using (true) with check (true);

drop policy if exists "subline_transfers_all_auth" on public.subline_transfers;
create policy "subline_transfers_all_auth"
  on public.subline_transfers for all to authenticated
  using (true) with check (true);

-- ============================================================
-- Fin. Rechargez l'application après exécution.
-- ============================================================
