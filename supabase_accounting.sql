-- ============================================================================
-- Export comptable : numéro de compte comptable sur les lignes / sous-lignes
-- ----------------------------------------------------------------------------
-- Ajoute une colonne `accounting_account` (texte) permettant de rattacher chaque
-- (sous-)ligne budgétaire à un compte comptable de charge (ex. 60, 61, 62… en
-- plan OHADA/SYSCOHADA, ou 6xx en PCG français). Ce compte est utilisé par le
-- module Rapports → « Export comptable » pour générer les écritures (FEC,
-- Journal, Grand livre, Balance).
--
-- La sous-ligne est prioritaire sur la ligne parente ; à défaut, l'export
-- utilise le « compte de charge par défaut » paramétré dans l'écran d'export.
--
-- À exécuter UNE SEULE FOIS dans l'éditeur SQL de Supabase.
-- ============================================================================

ALTER TABLE sub_budget_lines
  ADD COLUMN IF NOT EXISTS accounting_account text;

ALTER TABLE budget_lines
  ADD COLUMN IF NOT EXISTS accounting_account text;

-- (Optionnel) Pré-remplir un compte de charge par défaut sur les sous-lignes
-- qui n'en ont pas encore (exemple OHADA 60 « Achats » — adaptez à votre plan) :
--   UPDATE sub_budget_lines SET accounting_account = '60'
--   WHERE accounting_account IS NULL;

-- Vérification :
-- SELECT code, name, accounting_account FROM sub_budget_lines ORDER BY code;
