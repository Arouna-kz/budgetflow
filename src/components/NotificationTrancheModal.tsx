import React, { useMemo, useState } from 'react';
import { X, Info, Search } from 'lucide-react';
import { Grant, SubBudgetLine, NotificationTranche } from '../types';
import { showValidationError } from '../utils/alerts';

interface Props {
  grant: Grant;
  /** Sous-lignes budgétaires de la subvention concernée */
  subBudgetLines: SubBudgetLine[];
  onSubmit: (tranche: Omit<NotificationTranche, 'id' | 'createdAt'>) => void | Promise<void>;
  onClose: () => void;
}

const fmt = (n: number) => (Number(n) || 0).toLocaleString('fr-FR');

/**
 * Modale « Nouvelle tranche de notification ».
 * Composant partagé : page Planification ET carte d'une subvention (Gestion des subventions).
 *
 * Deux façons de notifier :
 *  - « Montant global » : un montant ajouté au prorata de la répartition notifiée existante.
 *  - « Par sous-ligne » : on part des montants notifiés actuels et on ajuste ceux qu'on veut
 *    (ajouter à certaines sous-lignes sans écraser les autres, ou corriger un montant existant).
 *    Seul l'écart (delta) constitue la tranche.
 */
const NotificationTrancheModal: React.FC<Props> = ({ grant, subBudgetLines, onSubmit, onClose }) => {
  const todayStr = new Date().toISOString().split('T')[0];
  const [form, setForm] = useState({ amount: '', date: todayStr, mode: 'custom' as 'same' | 'custom', note: '' });
  // dist = nouveau montant notifié cible saisi par sous-ligne (mode « par sous-ligne »)
  const [dist, setDist] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const totalNotified = subBudgetLines.reduce((s, sl) => s + (sl.notifiedAmount || 0), 0);
  const isFirstNotification = totalNotified <= 0;
  // Pour la 1ère notification, la répartition proportionnelle n'a pas de base → mode par sous-ligne forcé
  const mode = isFirstNotification ? 'custom' : form.mode;

  // Valeur affichée dans l'input d'une sous-ligne (repli sur le notifié actuel si non touchée)
  const cibleFor = (sl: SubBudgetLine) =>
    dist[sl.id] !== undefined ? dist[sl.id] : String(sl.notifiedAmount || 0);
  const deltaFor = (sl: SubBudgetLine) => (parseFloat(cibleFor(sl)) || 0) - (sl.notifiedAmount || 0);

  const netDelta = useMemo(
    () => subBudgetLines.reduce((s, sl) => s + deltaFor(sl), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [subBudgetLines, dist]
  );

  const filteredSubLines = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return subBudgetLines;
    return subBudgetLines.filter(sl => `${sl.code} ${sl.name}`.toLowerCase().includes(q));
  }, [subBudgetLines, search]);

  const submit = async () => {
    if (submitting) return; // empêche les doubles envois (double-clic)
    if (subBudgetLines.length === 0) {
      showValidationError('Structure budgétaire manquante', "Créez d'abord des lignes et sous-lignes budgétaires dans la page Planification avant de notifier un montant.");
      return;
    }

    let distribution: { subBudgetLineId: string; amount: number }[] = [];
    let trancheAmount = 0;

    if (mode === 'same') {
      const amount = parseFloat(form.amount);
      if (isNaN(amount) || amount <= 0) {
        showValidationError('Montant invalide', 'Veuillez saisir un montant de notification valide.');
        return;
      }
      distribution = subBudgetLines.map(sl => ({
        subBudgetLineId: sl.id,
        amount: Math.round(amount * (sl.notifiedAmount || 0) / totalNotified),
      }));
      const diff = amount - distribution.reduce((s, d) => s + d.amount, 0);
      if (diff !== 0 && distribution.length) distribution[0].amount += diff;
      trancheAmount = amount;
    } else {
      // Mode par sous-ligne : on ne garde que les écarts (deltas) non nuls
      for (const sl of subBudgetLines) {
        const cible = parseFloat(cibleFor(sl));
        if (isNaN(cible) || cible < 0) {
          showValidationError('Montant invalide', `Le montant notifié de « ${sl.code} - ${sl.name} » doit être positif ou nul.`);
          return;
        }
        const delta = cible - (sl.notifiedAmount || 0);
        if (Math.abs(delta) > 0.0001) distribution.push({ subBudgetLineId: sl.id, amount: delta });
      }
      trancheAmount = distribution.reduce((s, d) => s + d.amount, 0);
      if (distribution.length === 0 || Math.abs(trancheAmount) < 0.0001) {
        showValidationError('Aucune modification', "Ajoutez un montant à au moins une sous-ligne, ou modifiez un montant existant.");
        return;
      }
    }

    setSubmitting(true);
    try {
      await onSubmit({
        grantId: grant.id, amount: trancheAmount, date: form.date,
        distributionMode: mode, distribution, note: form.note || undefined,
      });
      onClose();
    } catch {
      // Le gestionnaire affiche déjà un message d'erreur ; on garde la fenêtre ouverte
      // pour permettre un nouvel essai (les montants déjà appliqués ne seront pas re-comptés).
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Nouvelle notification de montant</h3>
            <p className="text-sm text-gray-500">{grant.name} — {grant.reference}</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 rounded-full"><X className="w-5 h-5" /></button>
        </div>

        {isFirstNotification && (
          <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-800">
              Première notification pour cette subvention : le budget notifié part de 0.
              Saisissez le montant notifié de chaque sous-ligne ci-dessous.
            </p>
          </div>
        )}

        {subBudgetLines.length === 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4">
            <p className="text-xs text-orange-800">
              Aucune sous-ligne budgétaire pour cette subvention. Créez d'abord la structure
              (lignes et sous-lignes) dans la page <strong>Planification</strong>.
            </p>
          </div>
        )}

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
              <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Note (optionnel)</label>
              <input type="text" value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="Ex: 1ère tranche du bailleur" />
            </div>
          </div>

          {/* Choix du mode (uniquement si une notification existe déjà) */}
          {!isFirstNotification && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Méthode de notification</label>
              <div className="flex flex-col sm:flex-row gap-2">
                <label className={`flex-1 border rounded-lg p-3 cursor-pointer text-sm ${form.mode === 'custom' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300'}`}>
                  <input type="radio" className="mr-2" checked={form.mode === 'custom'} onChange={() => setForm(f => ({ ...f, mode: 'custom' }))} />
                  Par sous-ligne (ajouter / modifier)
                </label>
                <label className={`flex-1 border rounded-lg p-3 cursor-pointer text-sm ${form.mode === 'same' ? 'border-indigo-500 bg-indigo-50' : 'border-gray-300'}`}>
                  <input type="radio" className="mr-2" checked={form.mode === 'same'} onChange={() => setForm(f => ({ ...f, mode: 'same' }))} />
                  Montant global (réparti au prorata)
                </label>
              </div>
            </div>
          )}

          {/* Mode « montant global » */}
          {mode === 'same' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Montant notifié à ajouter *</label>
              <input type="number" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg" placeholder="0" />
              <p className="text-xs text-gray-400 mt-1">Ce montant est ajouté aux sous-lignes proportionnellement à leur montant notifié actuel. La répartition existante n'est pas écrasée.</p>
            </div>
          )}

          {/* Mode « par sous-ligne » */}
          {mode === 'custom' && subBudgetLines.length > 0 && (
            <div className="border border-gray-200 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-2">
                Saisissez le <strong>nouveau montant notifié</strong> de chaque sous-ligne. Les sous-lignes non modifiées sont conservées ;
                seul l'écart avec l'existant constitue la tranche.
              </p>
              {subBudgetLines.length > 6 && (
                <div className="relative mb-2">
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher une sous-ligne (code, nom)…"
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg" />
                </div>
              )}
              <div className="max-h-72 overflow-y-auto divide-y divide-gray-100">
                {filteredSubLines.map(sl => {
                  const delta = deltaFor(sl);
                  return (
                    <div key={sl.id} className="flex items-center justify-between gap-2 py-2">
                      <div className="min-w-0">
                        <p className="text-sm text-gray-800 truncate">{sl.code} - {sl.name}</p>
                        <p className="text-xs text-gray-400">
                          Notifié actuel : {fmt(sl.notifiedAmount || 0)}
                          {Math.abs(delta) > 0.0001 && (
                            <span className={`ml-2 font-medium ${delta > 0 ? 'text-green-600' : 'text-orange-600'}`}>
                              ({delta > 0 ? '+' : ''}{fmt(delta)})
                            </span>
                          )}
                        </p>
                      </div>
                      <input type="number" min="0" value={cibleFor(sl)}
                        onChange={e => setDist(d => ({ ...d, [sl.id]: e.target.value }))}
                        className="w-32 px-2 py-1 border border-gray-300 rounded text-right" />
                    </div>
                  );
                })}
                {filteredSubLines.length === 0 && (
                  <p className="text-xs text-gray-400 py-3 text-center">Aucune sous-ligne ne correspond à la recherche.</p>
                )}
              </div>
              <div className="flex items-center justify-between mt-3 pt-2 border-t border-gray-200">
                <span className="text-sm text-gray-600">Montant de la tranche (net)</span>
                <span className={`text-sm font-semibold ${netDelta > 0 ? 'text-green-600' : netDelta < 0 ? 'text-orange-600' : 'text-gray-500'}`}>
                  {netDelta > 0 ? '+' : ''}{fmt(netDelta)}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} disabled={submitting} className="flex-1 px-4 py-2 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 disabled:opacity-50">Annuler</button>
          <button onClick={submit} disabled={submitting || subBudgetLines.length === 0}
            className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            {submitting && <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
            {submitting ? 'Traitement…' : 'Enregistrer'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationTrancheModal;
