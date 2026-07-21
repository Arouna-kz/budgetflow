-- ============================================================================
-- Permission dédiée « Historique » (module: history)
-- ----------------------------------------------------------------------------
-- Le menu « Historique » (modifications, notifications, transferts) et ses
-- exports sont désormais contrôlés par une permission dédiée `history`
-- (actions : view, export) au lieu de réutiliser la permission `reports`.
--
-- La colonne user_roles.permissions est un JSONB de type TABLEAU d'objets :
--   [ {"module":"dashboard","actions":["view"]},
--     {"module":"reports","actions":["view","export"]}, ... ]
--
-- Ce script ajoute un élément {"module":"history","actions":[...]} aux rôles
-- qui possèdent déjà l'accès aux rapports (pour refléter les mêmes droits).
-- À exécuter UNE SEULE FOIS dans l'éditeur SQL de Supabase.
-- ============================================================================

-- 1) Rôles ayant l'EXPORT des rapports → history avec view + export
UPDATE user_roles
SET permissions = permissions || '[{"module":"history","actions":["view","export"]}]'::jsonb
WHERE permissions @> '[{"module":"reports","actions":["export"]}]'::jsonb
  AND NOT (permissions @> '[{"module":"history"}]'::jsonb);

-- 2) Rôles ayant la VUE des rapports (mais pas l'export) → history avec view seul
UPDATE user_roles
SET permissions = permissions || '[{"module":"history","actions":["view"]}]'::jsonb
WHERE permissions @> '[{"module":"reports","actions":["view"]}]'::jsonb
  AND NOT (permissions @> '[{"module":"reports","actions":["export"]}]'::jsonb)
  AND NOT (permissions @> '[{"module":"history"}]'::jsonb);

-- ----------------------------------------------------------------------------
-- (Optionnel) Accorder l'historique complet à un rôle précis, ex. par code :
--   UPDATE user_roles
--   SET permissions = permissions || '[{"module":"history","actions":["view","export"]}]'::jsonb
--   WHERE code = 'ADMIN'
--     AND NOT (permissions @> '[{"module":"history"}]'::jsonb);
--
-- (Optionnel) Retirer l'historique d'un rôle (supprime l'élément du tableau) :
--   UPDATE user_roles
--   SET permissions = (
--     SELECT jsonb_agg(elem)
--     FROM jsonb_array_elements(permissions) elem
--     WHERE elem->>'module' <> 'history'
--   )
--   WHERE code = 'XXX';
-- ----------------------------------------------------------------------------

-- Vérification : lister l'élément history de chaque rôle
-- SELECT name, code,
--        (SELECT elem FROM jsonb_array_elements(permissions) elem
--         WHERE elem->>'module' = 'history') AS history_perm
-- FROM user_roles ORDER BY name;

-- NB : vous pouvez aussi gérer cette permission sans SQL, depuis la page
-- « Utilisateurs » → gestion des rôles : le module « Historique » y apparaît
-- désormais avec les cases « view » et « export ».
