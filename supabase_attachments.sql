-- ============================================================
-- BudgetFlow — Téléversement de fichiers physiques (pièces jointes)
-- À exécuter dans l'éditeur SQL de Supabase (une seule fois).
-- ============================================================

-- 1) Colonne "attachments" (JSONB, tableau) sur les tables concernées.
--    Les pièces jointes des paiements échelonnés sont stockées DANS le JSONB
--    "partial_payments" (aucune colonne supplémentaire nécessaire).
alter table public.engagements    add column if not exists attachments jsonb not null default '[]'::jsonb;
alter table public.payments        add column if not exists attachments jsonb not null default '[]'::jsonb;
alter table public.prefinancings   add column if not exists attachments jsonb not null default '[]'::jsonb;
alter table public.employee_loans  add column if not exists attachments jsonb not null default '[]'::jsonb;

-- 2) Bucket de stockage "attachments" (public en lecture pour permettre le
--    téléchargement via URL publique).
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', true)
on conflict (id) do nothing;

-- 3) Politiques d'accès (RLS) sur storage.objects pour ce bucket.
--    Lecture publique ; écriture/suppression réservées aux utilisateurs connectés.
drop policy if exists "attachments_read_public"  on storage.objects;
drop policy if exists "attachments_insert_auth"  on storage.objects;
drop policy if exists "attachments_update_auth"  on storage.objects;
drop policy if exists "attachments_delete_auth"  on storage.objects;

create policy "attachments_read_public"
  on storage.objects for select
  using ( bucket_id = 'attachments' );

create policy "attachments_insert_auth"
  on storage.objects for insert to authenticated
  with check ( bucket_id = 'attachments' );

create policy "attachments_update_auth"
  on storage.objects for update to authenticated
  using ( bucket_id = 'attachments' );

create policy "attachments_delete_auth"
  on storage.objects for delete to authenticated
  using ( bucket_id = 'attachments' );

-- ============================================================
-- Fin. Rechargez l'application après exécution.
-- ============================================================
