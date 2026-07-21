import React, { useEffect, useMemo, useState } from 'react';
import { History, User, Calendar, Search, Download, RefreshCw, ArrowRight } from 'lucide-react';
import { ChangeHistoryEntry } from '../types';
import { changeHistoryService } from '../services/changeHistoryService';
import { usePermissions } from '../hooks/usePermissions';
import { exportListPDF, exportListExcel } from '../utils/listExport';

const ENTITY_LABELS: Record<string, string> = {
  grant: 'Subvention',
  budget_line: 'Ligne budgétaire',
  sub_budget_line: 'Sous-ligne budgétaire',
  engagement: 'Engagement',
  payment: 'Paiement',
  prefinancing: 'Préfinancement',
  employee_loan: 'Prêt employé',
};

const ENTITY_BADGE: Record<string, string> = {
  grant: 'bg-blue-100 text-blue-700',
  budget_line: 'bg-indigo-100 text-indigo-700',
  sub_budget_line: 'bg-violet-100 text-violet-700',
  engagement: 'bg-orange-100 text-orange-700',
  payment: 'bg-green-100 text-green-700',
  prefinancing: 'bg-teal-100 text-teal-700',
  employee_loan: 'bg-pink-100 text-pink-700',
};

const FIELD_LABELS: Record<string, string> = {
  amount: 'Montant', description: 'Description', supplier: 'Fournisseur', status: 'Statut',
  date: 'Date', invoiceNumber: 'N° facture', name: 'Nom', code: 'Code', reference: 'Référence',
  notifiedAmount: 'Budget notifié', plannedAmount: 'Budget planifié', totalAmount: 'Montant total',
  quoteReference: 'Réf. devis', paymentMethod: 'Mode de paiement', checkNumber: 'N° chèque',
  bankReference: 'Réf. virement', grantingOrganization: 'Organisme', year: 'Année',
  startDate: 'Date de début', endDate: 'Date de fin', currency: 'Devise', purpose: 'Objet',
  expectedRepaymentDate: 'Remboursement prévu', engagementNumber: 'N° engagement',
  paymentNumber: 'N° paiement', prefinancingNumber: 'N° préfinancement', loanNumber: 'N° prêt',
  invoiceAmount: 'Montant facture', controlNotes: 'Notes de contrôle',
};

const fieldLabel = (f: string) => FIELD_LABELS[f] || f;

const ACTION_META: Record<string, { label: string; cls: string }> = {
  create: { label: 'Création', cls: 'bg-green-100 text-green-700' },
  update: { label: 'Modification', cls: 'bg-amber-100 text-amber-700' },
  delete: { label: 'Suppression', cls: 'bg-red-100 text-red-700' },
};

const formatValue = (v: any): string => {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Oui' : 'Non';
  if (typeof v === 'number') return v.toLocaleString('fr-FR');
  if (typeof v === 'object') {
    if (Array.isArray(v)) return `${v.length} élément(s)`;
    return 'objet modifié';
  }
  return String(v);
};

const ChangeHistoryView: React.FC<{ selectedGrantId?: string }> = ({ selectedGrantId }) => {
  const { hasPermission } = usePermissions();
  const canExport = hasPermission('history', 'export');
  const [entries, setEntries] = useState<ChangeHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [search, setSearch] = useState('');

  const load = async () => {
    setLoading(true);
    const data = await changeHistoryService.getAll(selectedGrantId);
    setEntries(data);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [selectedGrantId]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return entries.filter(e => {
      if (entityFilter !== 'all' && e.entityType !== entityFilter) return false;
      if (actionFilter !== 'all' && e.action !== actionFilter) return false;
      const day = (e.createdAt || '').slice(0, 10);
      if (start && day < start) return false;
      if (end && day > end) return false;
      if (s) {
        const hay = `${e.entityLabel} ${e.changedByName} ${ENTITY_LABELS[e.entityType] || ''}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [entries, entityFilter, actionFilter, start, end, search]);

  const exportRows = () => filtered.flatMap(e =>
    (e.changes.length ? e.changes : [{ field: '—', oldValue: null, newValue: null }]).map(c => [
      new Date(e.createdAt).toLocaleString('fr-FR'),
      ACTION_META[e.action]?.label || e.action,
      ENTITY_LABELS[e.entityType] || e.entityType,
      e.entityLabel,
      e.changedByName,
      fieldLabel(c.field),
      formatValue(c.oldValue),
      e.action === 'delete' ? '(supprimé)' : formatValue(c.newValue),
    ])
  );

  const exportExcel = () => exportListExcel({
    title: 'HISTORIQUE DES MODIFICATIONS',
    subtitle: `Généré le ${new Date().toLocaleDateString('fr-FR')} — ${filtered.length} événement(s)`,
    headers: ['Date', 'Action', 'Type', 'Élément', 'Auteur', 'Champ', 'Ancienne valeur', 'Nouvelle valeur'],
    rows: exportRows(),
    colWidths: [22, 16, 20, 30, 24, 22, 26, 26],
    sheetName: 'Historique',
    filename: `historique-modifications-${new Date().toISOString().slice(0, 10)}.xlsx`,
  });

  const exportPDF = () => exportListPDF({
    title: 'Historique des modifications',
    subtitle: `Généré le ${new Date().toLocaleDateString('fr-FR')} — ${filtered.length} événement(s)`,
    columns: [
      { label: 'Date', width: 28, align: 'left' },
      { label: 'Action', width: 20, align: 'left' },
      { label: 'Type', width: 24, align: 'left' },
      { label: 'Élément', width: 36, align: 'left' },
      { label: 'Auteur', width: 28, align: 'left' },
      { label: 'Champ', width: 24, align: 'left' },
      { label: 'Avant', width: 28, align: 'left' },
      { label: 'Après', width: 28, align: 'left' },
    ],
    rows: exportRows(),
    filename: `historique-modifications-${new Date().toISOString().slice(0, 10)}.pdf`,
  });

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <History className="w-5 h-5 mr-2 text-indigo-600" />
            Historique des modifications
            <span className="ml-2 text-xs font-normal text-gray-500">({filtered.length})</span>
          </h3>
          <p className="text-sm text-gray-500">Toutes les modifications effectuées après la création d'un élément — auteur, valeur avant / après et date.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg" title="Actualiser">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {canExport && filtered.length > 0 && (
            <>
              <button onClick={exportPDF} className="bg-red-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-red-700 flex items-center gap-1">
                <Download className="w-4 h-4" /><span>PDF</span>
              </button>
              <button onClick={exportExcel} className="bg-green-700 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-green-800 flex items-center gap-1">
                <Download className="w-4 h-4" /><span>Excel</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Filtres */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-2 mb-4">
        <div className="relative md:col-span-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher (élément, auteur)…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg" />
        </div>
        <select value={actionFilter} onChange={e => setActionFilter(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg">
          <option value="all">Toutes les actions</option>
          <option value="create">Création</option>
          <option value="update">Modification</option>
          <option value="delete">Suppression</option>
        </select>
        <select value={entityFilter} onChange={e => setEntityFilter(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg">
          <option value="all">Tous les types</option>
          {Object.entries(ENTITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <input type="date" value={start} onChange={e => setStart(e.target.value)} title="Date de début"
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" />
        <input type="date" value={end} onChange={e => setEnd(e.target.value)} title="Date de fin"
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" />
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-500">Chargement de l'historique…</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <History className="w-10 h-10 mx-auto mb-2 text-gray-300" />
          <p className="font-medium">Aucune modification enregistrée</p>
          <p className="text-sm">Les modifications apparaîtront ici après édition d'un élément.</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[560px] overflow-y-auto pr-1">
          {filtered.map(e => (
            <div key={e.id} className="border border-gray-200 rounded-lg p-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${ACTION_META[e.action]?.cls || 'bg-gray-100 text-gray-700'}`}>
                    {ACTION_META[e.action]?.label || e.action}
                  </span>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${ENTITY_BADGE[e.entityType] || 'bg-gray-100 text-gray-700'}`}>
                    {ENTITY_LABELS[e.entityType] || e.entityType}
                  </span>
                  <span className="font-medium text-gray-900 text-sm">{e.entityLabel}</span>
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1"><User className="w-3.5 h-3.5" />{e.changedByName}</span>
                  <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{new Date(e.createdAt).toLocaleString('fr-FR')}</span>
                </div>
              </div>
              {e.action === 'delete' ? (
                <div className="text-xs bg-red-50 border border-red-100 rounded px-2 py-1.5">
                  <p className="text-red-700 font-medium mb-1">Élément supprimé — valeurs qui existaient :</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {e.changes.length === 0 && <span className="text-gray-500">(aucun détail conservé)</span>}
                    {e.changes.map((c, i) => (
                      <span key={i} className="text-gray-700">
                        <span className="font-medium">{fieldLabel(c.field)}:</span> {formatValue(c.oldValue)}
                      </span>
                    ))}
                  </div>
                </div>
              ) : e.action === 'create' ? (
                <div className="text-xs bg-green-50 border border-green-100 rounded px-2 py-1.5">
                  <p className="text-green-700 font-medium mb-1">Élément créé — valeurs initiales :</p>
                  <div className="flex flex-wrap gap-x-4 gap-y-1">
                    {e.changes.length === 0 && <span className="text-gray-500">(aucun détail conservé)</span>}
                    {e.changes.map((c, i) => (
                      <span key={i} className="text-gray-700">
                        <span className="font-medium">{fieldLabel(c.field)}:</span> {formatValue(c.newValue)}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  {e.changes.map((c, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-2 text-xs bg-gray-50 rounded px-2 py-1">
                      <span className="font-medium text-gray-700 min-w-[120px]">{fieldLabel(c.field)}</span>
                      <span className="text-red-600 line-through">{formatValue(c.oldValue)}</span>
                      <ArrowRight className="w-3 h-3 text-gray-400" />
                      <span className="text-green-700 font-medium">{formatValue(c.newValue)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ChangeHistoryView;
