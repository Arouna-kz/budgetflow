# BudgetFlow — Feuille de route des améliorations

Backlog issu de l'audit complet de la plateforme (couverture « gestion budgétaire à 100 % »).
On avance dessus **au fur et à mesure**. Cocher au fil de l'eau.

Légende : 🔴 critique · 🟠 majeur · 🟡 complément · ✅ fait

---

## ✅ Fait

- [x] **Export comptable (passerelle compta)** — compte comptable sur les sous-lignes budgétaires + génération d'écritures en partie double + exports **FEC**, **Journal**, **Grand livre**, **Balance**. _(voir module Rapports → « Export comptable » et `supabase_accounting.sql`)_

---

## 🔴 Priorité 1 — Sécurité & intégrité des données

> À traiter en priorité : ces points exposent des données financières ou fragilisent la fiabilité des montants.

- [ ] **Sortir la clé `service_role` du front** (`adminService.ts` / `VITE_SUPABASE_SERVICE_ROLE_KEY`). La déplacer dans une **Edge Function** Supabase (création d'utilisateur, changement de mot de passe côté serveur). La clé actuelle contourne la RLS et est embarquée dans le bundle navigateur.
- [ ] **Écrire les policies RLS des tables financières** (grants, budget_lines, sub_budget_lines, engagements, payments, prefinancings, employee_loans, bank_transactions…) et les versionner en SQL. Aujourd'hui l'autorisation repose uniquement sur le contrôle côté client.
- [ ] **Restreindre le bucket `attachments`** : lecture non publique (URLs signées), cloisonnement par subvention/propriétaire, suppression réservée au propriétaire.
- [ ] **Fiabiliser le solde bancaire** : recalcul depuis les mouvements (`BankTransaction` avec solde d'ouverture + solde courant), et **mouvement compensatoire** lors de la suppression d'un préfinancement/prêt déjà décaissé.
- [ ] **Bloquer l'authentification des comptes désactivés** (au niveau Auth, pas seulement applicatif) ; politique de mot de passe renforcée ; envisager MFA + anti-bruteforce.
- [ ] **Atomicité des opérations à écritures multiples via RPC Supabase** : notifications (répartition sur sous-lignes + lignes + total subvention) et transferts entre sous-lignes s'exécutent aujourd'hui en écritures séquentielles côté client — durcies (réessai réseau, ordre montants→historique, recalcul idempotent du total, anti double-envoi, erreur remontée à la modale), mais **sans transaction serveur**. Créer une **fonction RPC (procédure stockée)** appliquant toute la répartition en une seule transaction pour une atomicité stricte (tout ou rien). _Idem à prévoir pour les mouvements bancaires liés aux préfinancements/prêts._

## 🟠 Priorité 2 — Fonctions budgétaires majeures

- [ ] **Référentiel fournisseurs** : entité `Supplier` (nom normalisé, coordonnées, RIB/IBAN, NIF/identifiant fiscal, contact) + rattachement des engagements/paiements + compte de tiers comptable. Supprime les doublons dus au champ texte libre.
- [ ] **Révisions / budget rectificatif** : versions du budget planifié (initial vs révisé), historique des versions, motif.
- [ ] **Exercice fiscal & clôture** : notion d'exercice, procédure de clôture, **report à nouveau** des soldes (report des disponibles), gel des écritures d'un exercice clôturé.
- [ ] **Analyse d'écart & prévisionnel dans le temps** : budget périodisé de référence, **variance prévu/réalisé**, **burn rate**, projection d'atterrissage (date d'épuisement), avancement vs temps écoulé (exploiter `startDate`/`endDate`).
- [ ] **Rapprochement bancaire** : import de relevé, pointage, statut « rapproché », exploitation de `cashedDate` (chèques en circulation).
- [ ] **Prévision de trésorerie** : échéancier consolidé des entrées/sorties ; matérialiser `repaymentSchedule` (prêts) en échéances datées et les rapprocher des remboursements réels.
- [ ] **Consolidation multi-subventions** : vue portefeuille agrégée (tous bailleurs), comparaison inter-subventions, gestion multi-devises (taux de change + consolidation).
- [ ] **Rapport bailleur** : canevas financier au format attendu (budget approuvé / dépenses période / cumul / disponible par ligne, par période de reporting).

## 🟡 Priorité 3 — Compléments & qualité

- [ ] **Fiscalité** : TVA (HT/TTC), retenue à la source, décomposition des montants.
- [ ] **Import de données Excel** (lignes/sous-lignes, engagements…) — actuellement flux XLSX en écriture seule.
- [ ] **Sauvegarde / restauration** (export JSON complet + réimport), archivage.
- [ ] **Alertes proactives** : échéances de subvention et de remboursement, dépassement budgétaire ; **notifications par email** (Edge Function/SMTP).
- [ ] **Audit étendu** : tracer connexions, exports, gestion utilisateurs/rôles/**permissions**, changements de mot de passe, activation/désactivation, signatures.
- [ ] **Workflow** : lier signatures et statut (empêcher « approuvé » sans signatures) ; autoriser plusieurs paiements/factures par engagement ; rapprocher `invoiceAmount` (détection d'écart/sur-facturation) ; approbation des transferts entre sous-lignes (seuil paramétrable, non contournable).
- [ ] **Comptabilité — compléments** : intégrer préfinancements & prêts (décaissements/remboursements) aux écritures ; comptes de tiers fournisseurs ; lettrage ; report à nouveau comptable.
- [ ] **Plateforme** : internationalisation (i18n), PWA/hors-ligne, accessibilité (ARIA/contrastes), historique des connexions (IP/appareil).

## 🧹 Dette technique / cohérences

- [ ] Uniformiser le symbole **XOF** (`FCFA` vs `CFA` selon les modules).
- [ ] `getUncashedPaymentsForGrant` en placeholder `0` côté préfinancement (vs calcul réel côté prêt) — aligner.
- [ ] Numéro d'engagement généré en double (`EngagementForm` **et** `EngagementManager`) — centraliser.
- [ ] Deux composants de saisie fournisseur divergents (`input` brut vs `SupplierSelector`) — unifier (idéalement via le futur référentiel fournisseurs).
- [ ] Numérotation des pièces basée sur un timestamp tronqué (risque de collision) — passer à une séquence persistante.
