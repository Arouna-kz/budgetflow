import React, { useMemo, useState } from 'react';
import { History, ArrowRightLeft, Bell, Download, FileClock } from 'lucide-react';
import { Grant, SubBudgetLine, NotificationTranche, SubLineTransfer } from '../types';
import { usePermissions } from '../hooks/usePermissions';
import { exportListPDF, exportListExcel, fmtAmount } from '../utils/listExport';
import ChangeHistoryView from './ChangeHistoryView';

const getCurrencySymbol = (currency?: Grant['currency']) =>
  currency === 'USD' ? '$' : currency === 'XOF' ? 'FCFA' : '€';

interface Props {
  selectedGrant?: Grant | null;
  notificationTranches: NotificationTranche[];
  subLineTransfers: SubLineTransfer[];
  subBudgetLines: SubBudgetLine[];
}

type Tab = 'changes' | 'notifications' | 'transfers';

/**
 * Centre d'historique : regroupe l'historique des modifications, des notifications
 * (tranches) et des transferts entre sous-lignes. Chaque onglet est exportable en Excel/PDF.
 */
const HistoryCenter: React.FC<Props> = ({ selectedGrant, notificationTranches, subLineTransfers, subBudgetLines }) => {
  const { hasPermission } = usePermissions();
  const canExport = hasPermission('history', 'export');
  const [tab, setTab] = useState<Tab>('changes');

  const symbol = selectedGrant ? getCurrencySymbol(selectedGrant.currency) : '';
  const today = new Date().toLocaleDateString('fr-FR');
  const stamp = new Date().toISOString().slice(0, 10);

  const subName = (id: string) => {
    const s = subBudgetLines.find(x => x.id === id);
    return s ? `${s.code} - ${s.name}` : '—';
  };

  // ---- Notifications ----
  const trancheRows = useMemo(() => notificationTranches.map(t => [
    new Date(t.date).toLocaleDateString('fr-FR'),
    `${fmtAmount(t.amount)} ${symbol}`.trim(),
    t.distributionMode === 'same' ? 'Même répartition' : 'Personnalisée',
    t.note || '',
    t.createdBy || '',
  ]), [notificationTranches, symbol]);
  const trancheTotal = notificationTranches.reduce((s, t) => s + t.amount, 0);

  const exportTranchesExcel = () => exportListExcel({
    title: 'HISTORIQUE DES NOTIFICATIONS (TRANCHES)',
    subtitle: `${selectedGrant?.name || ''} — Généré le ${today}`,
    headers: ['Date', 'Montant', 'Répartition', 'Note', 'Ajouté par'],
    rows: trancheRows,
    totalRow: ['TOTAL', `${fmtAmount(trancheTotal)} ${symbol}`.trim(), '', '', ''],
    colWidths: [14, 18, 20, 40, 22],
    sheetName: 'Notifications',
    filename: `historique-notifications-${stamp}.xlsx`,
  });
  const exportTranchesPDF = () => exportListPDF({
    title: 'Historique des notifications (tranches)',
    subtitle: `${selectedGrant?.name || ''} — Généré le ${today}`,
    columns: [
      { label: 'Date', width: 25 },
      { label: 'Montant', width: 30, align: 'right' },
      { label: 'Répartition', width: 35 },
      { label: 'Note', width: 70 },
      { label: 'Ajouté par', width: 40 },
    ],
    rows: trancheRows,
    totalRow: ['TOTAL', `${fmtAmount(trancheTotal)} ${symbol}`.trim(), '', '', ''],
    filename: `historique-notifications-${stamp}.pdf`,
  });

  // ---- Transferts ----
  const transferRows = useMemo(() => subLineTransfers.map(t => [
    new Date(t.date).toLocaleDateString('fr-FR'),
    subName(t.fromSubBudgetLineId),
    subName(t.toSubBudgetLineId),
    `${fmtAmount(t.amount)} ${symbol}`.trim(),
    t.reason || '',
    t.createdBy || '',
  ]), [subLineTransfers, subBudgetLines, symbol]);
  const transferTotal = subLineTransfers.reduce((s, t) => s + t.amount, 0);

  const exportTransfersExcel = () => exportListExcel({
    title: 'HISTORIQUE DES TRANSFERTS ENTRE SOUS-LIGNES',
    subtitle: `${selectedGrant?.name || ''} — Généré le ${today}`,
    headers: ['Date', 'Source', 'Destination', 'Montant', 'Motif', 'Ajouté par'],
    rows: transferRows,
    totalRow: ['TOTAL', '', '', `${fmtAmount(transferTotal)} ${symbol}`.trim(), '', ''],
    colWidths: [14, 32, 32, 18, 40, 22],
    sheetName: 'Transferts',
    filename: `historique-transferts-${stamp}.xlsx`,
  });
  const exportTransfersPDF = () => exportListPDF({
    title: 'Historique des transferts entre sous-lignes',
    subtitle: `${selectedGrant?.name || ''} — Généré le ${today}`,
    columns: [
      { label: 'Date', width: 22 },
      { label: 'Source', width: 55 },
      { label: 'Destination', width: 55 },
      { label: 'Montant', width: 28, align: 'right' },
      { label: 'Motif', width: 55 },
    ],
    rows: subLineTransfers.map(t => [
      new Date(t.date).toLocaleDateString('fr-FR'),
      subName(t.fromSubBudgetLineId),
      subName(t.toSubBudgetLineId),
      `${fmtAmount(t.amount)} ${symbol}`.trim(),
      t.reason || '',
    ]),
    totalRow: ['TOTAL', '', '', `${fmtAmount(transferTotal)} ${symbol}`.trim(), ''],
    filename: `historique-transferts-${stamp}.pdf`,
  });

  const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }>; count?: number }[] = [
    { id: 'changes', label: 'Modifications', icon: FileClock },
    { id: 'notifications', label: 'Notifications', icon: Bell, count: notificationTranches.length },
    { id: 'transfers', label: 'Transferts', icon: ArrowRightLeft, count: subLineTransfers.length },
  ];

  return (
    <div className="space-y-6">
      {/* En-tête */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 flex items-center">
          <History className="w-6 h-6 mr-2 text-indigo-600" />
          Historique
        </h2>
        <p className="text-gray-600 mt-1">
          Toutes les traces d'activité : modifications, notifications de montants et transferts entre sous-lignes.
          {selectedGrant && <> Subvention active : <span className="font-medium">{selectedGrant.name}</span>.</>}
        </p>
      </div>

      {/* Onglets */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200">
        {TABS.map(t => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                active ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {t.label}
              {typeof t.count === 'number' && (
                <span className={`px-1.5 py-0.5 rounded-full text-xs ${active ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-600'}`}>
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Contenu */}
      {tab === 'changes' && <ChangeHistoryView selectedGrantId={selectedGrant?.id} />}

      {tab === 'notifications' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Bell className="w-5 h-5 mr-2 text-indigo-600" />
              Historique des notifications ({notificationTranches.length})
            </h3>
            {canExport && notificationTranches.length > 0 && (
              <div className="flex items-center gap-2">
                <button onClick={exportTranchesPDF} className="bg-red-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-red-700 flex items-center gap-1">
                  <Download className="w-4 h-4" /><span>PDF</span>
                </button>
                <button onClick={exportTranchesExcel} className="bg-green-700 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-green-800 flex items-center gap-1">
                  <Download className="w-4 h-4" /><span>Excel</span>
                </button>
              </div>
            )}
          </div>
          {notificationTranches.length === 0 ? (
            <p className="text-sm text-gray-500">Aucune tranche enregistrée. Le montant notifié peut être reçu en une ou plusieurs tranches via le bouton « Notifier un montant » sur la carte de la subvention.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-right">Montant</th>
                    <th className="px-3 py-2 text-left">Répartition</th>
                    <th className="px-3 py-2 text-left">Note</th>
                    <th className="px-3 py-2 text-left">Ajouté par</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {notificationTranches.map(t => (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2">{new Date(t.date).toLocaleDateString('fr-FR')}</td>
                      <td className="px-3 py-2 text-right font-medium text-indigo-700">{fmtAmount(t.amount)} {symbol}</td>
                      <td className="px-3 py-2">{t.distributionMode === 'same' ? 'Même répartition' : 'Personnalisée'}</td>
                      <td className="px-3 py-2 text-gray-600">{t.note || '-'}</td>
                      <td className="px-3 py-2 text-gray-600">{t.createdBy || '-'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200 font-semibold text-gray-900">
                    <td className="px-3 py-2">TOTAL</td>
                    <td className="px-3 py-2 text-right text-indigo-700">{fmtAmount(trancheTotal)} {symbol}</td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'transfers' && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 md:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <ArrowRightLeft className="w-5 h-5 mr-2 text-violet-600" />
              Historique des transferts ({subLineTransfers.length})
            </h3>
            {canExport && subLineTransfers.length > 0 && (
              <div className="flex items-center gap-2">
                <button onClick={exportTransfersPDF} className="bg-red-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-red-700 flex items-center gap-1">
                  <Download className="w-4 h-4" /><span>PDF</span>
                </button>
                <button onClick={exportTransfersExcel} className="bg-green-700 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-green-800 flex items-center gap-1">
                  <Download className="w-4 h-4" /><span>Excel</span>
                </button>
              </div>
            )}
          </div>
          {subLineTransfers.length === 0 ? (
            <p className="text-sm text-gray-500">Aucun transfert enregistré.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-left">Source</th>
                    <th className="px-3 py-2 text-left">Destination</th>
                    <th className="px-3 py-2 text-right">Montant</th>
                    <th className="px-3 py-2 text-left">Motif</th>
                    <th className="px-3 py-2 text-left">Ajouté par</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {subLineTransfers.map(t => (
                    <tr key={t.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2">{new Date(t.date).toLocaleDateString('fr-FR')}</td>
                      <td className="px-3 py-2">{subName(t.fromSubBudgetLineId)}</td>
                      <td className="px-3 py-2">{subName(t.toSubBudgetLineId)}</td>
                      <td className="px-3 py-2 text-right font-medium text-violet-700">{fmtAmount(t.amount)} {symbol}</td>
                      <td className="px-3 py-2 text-gray-600">{t.reason || '-'}</td>
                      <td className="px-3 py-2 text-gray-600">{t.createdBy || '-'}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200 font-semibold text-gray-900">
                    <td className="px-3 py-2" colSpan={3}>TOTAL</td>
                    <td className="px-3 py-2 text-right text-violet-700">{fmtAmount(transferTotal)} {symbol}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default HistoryCenter;
