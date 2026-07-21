import { supabase } from '../lib/supabase';
import { ChangeHistoryEntry } from '../types';

// Champs auto-calculés à ignorer (bruit système, pas des modifications utilisateur)
const IGNORED_FIELDS = new Set([
  'engagedAmount', 'availableAmount', 'spentAmount', 'remainingAmount',
  'updatedAt', 'updated_at', 'createdAt', 'created_at', 'id',
]);

export interface ChangeInput {
  entityType: ChangeHistoryEntry['entityType'];
  entityId: string;
  entityLabel: string;
  grantId?: string;
  action?: 'create' | 'update' | 'delete';
  changes: { field: string; oldValue: any; newValue: any }[];
  changedById?: string;
  changedByName: string;
}

// Champs « lisibles » retenus dans le snapshot d'un élément supprimé (ce qui existait)
const SNAPSHOT_FIELDS = [
  'name', 'code', 'reference', 'engagementNumber', 'paymentNumber', 'prefinancingNumber', 'loanNumber',
  'amount', 'totalAmount', 'notifiedAmount', 'plannedAmount', 'status', 'supplier', 'description',
  'invoiceNumber', 'date', 'grantingOrganization', 'year',
];

/** Instantané des champs importants d'un objet supprimé (oldValue = valeur, newValue = null). */
export const buildDeleteSnapshot = (obj: any): { field: string; oldValue: any; newValue: any }[] => {
  if (!obj) return [];
  const snap: { field: string; oldValue: any; newValue: any }[] = [];
  SNAPSHOT_FIELDS.forEach((f) => {
    if (obj[f] !== undefined && obj[f] !== null && obj[f] !== '') {
      snap.push({ field: f, oldValue: obj[f], newValue: null });
    }
  });
  return snap;
};

/** Instantané des champs importants d'un objet créé (oldValue = null, newValue = valeur). */
export const buildCreateSnapshot = (obj: any): { field: string; oldValue: any; newValue: any }[] => {
  if (!obj) return [];
  const snap: { field: string; oldValue: any; newValue: any }[] = [];
  SNAPSHOT_FIELDS.forEach((f) => {
    if (obj[f] !== undefined && obj[f] !== null && obj[f] !== '') {
      snap.push({ field: f, oldValue: null, newValue: obj[f] });
    }
  });
  return snap;
};

/**
 * Calcule le diff entre l'objet existant et les mises à jour appliquées.
 * Ne retient que les champs réellement modifiés et non auto-calculés.
 */
export const computeChanges = (oldObj: any, updates: any): { field: string; oldValue: any; newValue: any }[] => {
  const changes: { field: string; oldValue: any; newValue: any }[] = [];
  if (!updates) return changes;
  Object.keys(updates).forEach((k) => {
    if (IGNORED_FIELDS.has(k)) return;
    const oldV = oldObj ? oldObj[k] : undefined;
    const newV = updates[k];
    try {
      if (JSON.stringify(oldV) !== JSON.stringify(newV)) {
        changes.push({ field: k, oldValue: oldV ?? null, newValue: newV ?? null });
      }
    } catch {
      // valeurs non sérialisables : ignorer
    }
  });
  return changes;
};

export const changeHistoryService = {
  /** Enregistre une modification ou suppression (silencieux en cas d'échec). */
  async record(input: ChangeInput): Promise<void> {
    const action = input.action || 'update';
    if (action === 'update' && (!input.changes || input.changes.length === 0)) return;
    try {
      await supabase.from('change_history').insert({
        entity_type: input.entityType,
        entity_id: input.entityId,
        entity_label: input.entityLabel,
        grant_id: input.grantId || null,
        action,
        changes: input.changes || [],
        changed_by: input.changedById || null,
        changed_by_name: input.changedByName || 'Inconnu',
      });
    } catch (e) {
      console.warn('Historique : enregistrement échoué', e);
    }
  },

  /** Récupère l'historique (optionnellement filtré par subvention). */
  async getAll(grantId?: string): Promise<ChangeHistoryEntry[]> {
    try {
      let query = supabase
        .from('change_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1000);
      if (grantId) query = query.eq('grant_id', grantId);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map((r: any) => ({
        id: r.id,
        entityType: r.entity_type,
        entityId: r.entity_id,
        entityLabel: r.entity_label,
        grantId: r.grant_id || undefined,
        action: r.action,
        changes: r.changes || [],
        changedById: r.changed_by || undefined,
        changedByName: r.changed_by_name || 'Inconnu',
        createdAt: r.created_at,
      }));
    } catch (e) {
      console.warn('Historique : lecture échouée', e);
      return [];
    }
  },
};
