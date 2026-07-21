import React, { useMemo, useState } from 'react';
import { Calculator, Download, Info, Settings } from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import { Grant, BudgetLine, SubBudgetLine, Payment, NotificationTranche } from '../types';
import { usePermissions } from '../hooks/usePermissions';
import { exportListExcel, fmtAmount } from '../utils/listExport';
import { styleTitle, styleHeaderRow, styleDataRows, styleTotalRow, styleSectionRow } from '../utils/excelStyle';
import { showSuccess, showWarning } from '../utils/alerts';

interface Props {
  grant: Grant | null;
  budgetLines: BudgetLine[];
  subBudgetLines: SubBudgetLine[];
  payments: Payment[];
  notificationTranches: NotificationTranche[];
}

// Configuration comptable par subvention (persistée en localStorage)
interface AcctConfig {
  bankAccount: string; bankLabel: string;
  fundingAccount: string; fundingLabel: string;
  defaultChargeAccount: string; defaultChargeLabel: string;
  journalBank: string;
  includeNotifications: boolean;
}

const DEFAULT_CFG: AcctConfig = {
  bankAccount: '521', bankLabel: 'Banque',
  fundingAccount: '74', fundingLabel: 'Subventions reçues',
  defaultChargeAccount: '60', defaultChargeLabel: 'Charges',
  journalBank: 'BQ',
  includeNotifications: true,
};

const cfgKey = (grantId?: string) => `bf_accounting_cfg_${grantId || 'global'}`;

const loadCfg = (grantId?: string): AcctConfig => {
  try {
    const raw = localStorage.getItem(cfgKey(grantId));
    if (raw) return { ...DEFAULT_CFG, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT_CFG };
};

interface Leg { account: string; accountLabel: string; debit: number; credit: number; }
interface Entry {
  num: number;
  date: string;         // YYYY-MM-DD
  journal: string;
  piece: string;
  label: string;
  legs: [Leg, Leg];
}

const toFec = (isoDate: string) => (isoDate || '').replace(/-/g, '').slice(0, 8);
const frNum = (n: number) => (Number(n) || 0).toFixed(2).replace('.', ',');
const inRange = (d: string, start: string, end: string) => {
  const day = (d || '').slice(0, 10);
  if (start && day < start) return false;
  if (end && day > end) return false;
  return true;
};

const AccountingExport: React.FC<Props> = ({ grant, budgetLines, subBudgetLines, payments, notificationTranches }) => {
  const { hasPermission } = usePermissions();
  const canExport = hasPermission('reports', 'export');

  const [cfg, setCfg] = useState<AcctConfig>(() => loadCfg(grant?.id));
  const [showCfg, setShowCfg] = useState(false);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');

  const saveCfg = (next: AcctConfig) => {
    setCfg(next);
    try { localStorage.setItem(cfgKey(grant?.id), JSON.stringify(next)); } catch { /* ignore */ }
  };

  const currency = grant?.currency || 'EUR';
  const isForeign = currency !== 'EUR';

  // Résolution du compte de charge d'une sous-ligne (sous-ligne > ligne parente > défaut)
  const subLineById = useMemo(() => {
    const m = new Map<string, SubBudgetLine>();
    subBudgetLines.forEach(s => m.set(s.id, s));
    return m;
  }, [subBudgetLines]);
  const budgetLineById = useMemo(() => {
    const m = new Map<string, BudgetLine>();
    budgetLines.forEach(b => m.set(b.id, b));
    return m;
  }, [budgetLines]);

  const resolveCharge = (subLineId: string): { account: string; label: string } => {
    const sl = subLineById.get(subLineId);
    if (sl?.accountingAccount) return { account: sl.accountingAccount, label: sl.name };
    if (sl) {
      const bl = budgetLineById.get(sl.budgetLineId);
      if (bl?.accountingAccount) return { account: bl.accountingAccount, label: bl.name };
    }
    return { account: cfg.defaultChargeAccount, label: cfg.defaultChargeLabel };
  };

  // ---- Construction des écritures en partie double ----
  const entries = useMemo<Entry[]>(() => {
    const raw: Omit<Entry, 'num'>[] = [];

    // Recettes : notifications du bailleur (Débit banque / Crédit subvention)
    if (cfg.includeNotifications) {
      notificationTranches
        .filter(t => inRange(t.date, start, end))
        .forEach(t => {
          raw.push({
            date: t.date, journal: cfg.journalBank,
            piece: `NOTIF-${toFec(t.date)}`,
            label: `Notification de fonds${t.note ? ' — ' + t.note : ''}`,
            legs: [
              { account: cfg.bankAccount, accountLabel: cfg.bankLabel, debit: t.amount, credit: 0 },
              { account: cfg.fundingAccount, accountLabel: cfg.fundingLabel, debit: 0, credit: t.amount },
            ],
          });
        });
    }

    // Dépenses : décaissements des paiements (Débit charge / Crédit banque)
    payments.forEach(p => {
      const charge = resolveCharge(p.subBudgetLineId);
      const label = `${p.supplier || 'Fournisseur'} — ${p.description || 'Paiement'}`;
      const partials = p.partialPayments || [];
      if (partials.length > 0) {
        // Un décaissement par versement échelonné
        partials.filter(pp => inRange(pp.date, start, end)).forEach(pp => {
          raw.push({
            date: pp.date, journal: cfg.journalBank,
            piece: `${p.paymentNumber}${pp.reference ? '/' + pp.reference : ''}`,
            label,
            legs: [
              { account: charge.account, accountLabel: charge.label, debit: pp.amount, credit: 0 },
              { account: cfg.bankAccount, accountLabel: cfg.bankLabel, debit: 0, credit: pp.amount },
            ],
          });
        });
      } else if (p.status === 'paid' && inRange(p.date, start, end)) {
        // Paiement direct complet
        raw.push({
          date: p.date, journal: cfg.journalBank,
          piece: p.paymentNumber,
          label,
          legs: [
            { account: charge.account, accountLabel: charge.label, debit: p.amount, credit: 0 },
            { account: cfg.bankAccount, accountLabel: cfg.bankLabel, debit: 0, credit: p.amount },
          ],
        });
      }
    });

    raw.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    return raw.map((e, i) => ({ ...e, num: i + 1 }));
  }, [payments, notificationTranches, cfg, start, end, subLineById, budgetLineById]);

  const totals = useMemo(() => {
    let debit = 0, credit = 0;
    entries.forEach(e => e.legs.forEach(l => { debit += l.debit; credit += l.credit; }));
    return { debit, credit, count: entries.length };
  }, [entries]);

  // Agrégat par compte (grand livre / balance)
  const accounts = useMemo(() => {
    const map = new Map<string, { label: string; debit: number; credit: number; lines: { date: string; journal: string; piece: string; label: string; debit: number; credit: number }[] }>();
    entries.forEach(e => e.legs.forEach(l => {
      if (!map.has(l.account)) map.set(l.account, { label: l.accountLabel, debit: 0, credit: 0, lines: [] });
      const acc = map.get(l.account)!;
      acc.debit += l.debit; acc.credit += l.credit;
      acc.lines.push({ date: e.date, journal: e.journal, piece: e.piece, label: e.label, debit: l.debit, credit: l.credit });
    }));
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([account, v]) => ({ account, ...v }));
  }, [entries]);

  const guard = (): boolean => {
    if (!canExport) { showWarning('Permission refusée', "Vous n'avez pas la permission d'exporter."); return false; }
    if (entries.length === 0) { showWarning('Aucune écriture', 'Aucune écriture comptable à exporter pour la période/subvention sélectionnée.'); return false; }
    return true;
  };

  const stamp = new Date().toISOString().slice(0, 10);
  const ref = grant?.reference || 'global';

  // ---- Export FEC (Fichier des Écritures Comptables, .txt tabulé) ----
  const exportFEC = () => {
    if (!guard()) return;
    const cols = ['JournalCode', 'JournalLib', 'EcritureNum', 'EcritureDate', 'CompteNum', 'CompteLib', 'CompAuxNum', 'CompAuxLib', 'PieceRef', 'PieceDate', 'EcritureLib', 'Debit', 'Credit', 'EcritureLet', 'DateLet', 'ValidDate', 'Montantdevise', 'Idevise'];
    const lines = [cols.join('\t')];
    entries.forEach(e => {
      e.legs.forEach(l => {
        const montantDevise = isForeign ? frNum(l.debit || l.credit) : '';
        lines.push([
          e.journal, 'Journal Banque', String(e.num), toFec(e.date),
          l.account, l.accountLabel, '', '',
          e.piece, toFec(e.date), e.label.replace(/\t/g, ' '),
          l.debit ? frNum(l.debit) : '0,00',
          l.credit ? frNum(l.credit) : '0,00',
          '', '', toFec(e.date),
          montantDevise, isForeign ? currency : '',
        ].join('\t'));
      });
    });
    const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `FEC-${ref}-${stamp}.txt`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    showSuccess('Export FEC', 'Le Fichier des Écritures Comptables a été généré.');
  };

  // ---- Export Journal (Excel) ----
  const exportJournal = () => {
    if (!guard()) return;
    const rows = entries.flatMap(e => e.legs.map(l => [
      new Date(e.date).toLocaleDateString('fr-FR'),
      e.journal, String(e.num), e.piece, l.account, l.accountLabel, e.label,
      l.debit ? fmtAmount(l.debit) : '', l.credit ? fmtAmount(l.credit) : '',
    ]));
    exportListExcel({
      title: 'JOURNAL COMPTABLE',
      subtitle: `${grant?.name || ''} — Généré le ${new Date().toLocaleDateString('fr-FR')} — Devise ${currency}`,
      headers: ['Date', 'Journal', 'N°', 'Pièce', 'Compte', 'Libellé compte', 'Libellé écriture', 'Débit', 'Crédit'],
      rows,
      totalRow: ['TOTAUX', '', '', '', '', '', '', fmtAmount(totals.debit), fmtAmount(totals.credit)],
      colWidths: [12, 10, 8, 20, 12, 28, 40, 16, 16],
      sheetName: 'Journal',
      filename: `journal-comptable-${ref}-${stamp}.xlsx`,
    });
    showSuccess('Export Journal', 'Le journal comptable a été exporté.');
  };

  // ---- Export Balance (Excel) ----
  const exportBalance = () => {
    if (!guard()) return;
    const rows = accounts.map(a => {
      const solde = a.debit - a.credit;
      return [
        a.account, a.label, fmtAmount(a.debit), fmtAmount(a.credit),
        solde >= 0 ? fmtAmount(solde) : '', solde < 0 ? fmtAmount(-solde) : '',
      ];
    });
    const totalSolde = totals.debit - totals.credit;
    exportListExcel({
      title: 'BALANCE GÉNÉRALE',
      subtitle: `${grant?.name || ''} — Généré le ${new Date().toLocaleDateString('fr-FR')} — Devise ${currency}`,
      headers: ['Compte', 'Libellé', 'Total débit', 'Total crédit', 'Solde débiteur', 'Solde créditeur'],
      rows,
      totalRow: ['', 'TOTAUX', fmtAmount(totals.debit), fmtAmount(totals.credit), totalSolde >= 0 ? fmtAmount(totalSolde) : '', totalSolde < 0 ? fmtAmount(-totalSolde) : ''],
      colWidths: [12, 32, 18, 18, 18, 18],
      sheetName: 'Balance',
      filename: `balance-${ref}-${stamp}.xlsx`,
    });
    showSuccess('Export Balance', 'La balance générale a été exportée.');
  };

  // ---- Export Grand livre (Excel, sections par compte) ----
  const exportGrandLivre = () => {
    if (!guard()) return;
    const aoa: any[] = [];
    aoa.push(['GRAND LIVRE']);
    aoa.push([`${grant?.name || ''} — Généré le ${new Date().toLocaleDateString('fr-FR')} — Devise ${currency}`]);
    aoa.push([]);
    const NCOLS = 6;
    const headerIdx = aoa.length;
    aoa.push(['Date', 'Journal', 'Pièce', 'Libellé', 'Débit', 'Crédit']);
    const sectionRows: number[] = [];
    const dataRanges: [number, number][] = [];
    const totalRows: number[] = [];
    accounts.forEach(a => {
      sectionRows.push(aoa.length);
      aoa.push([`Compte ${a.account} — ${a.label}`, '', '', '', '', '']);
      const first = aoa.length;
      let running = 0;
      a.lines
        .slice()
        .sort((x, y) => (x.date < y.date ? -1 : x.date > y.date ? 1 : 0))
        .forEach(ln => {
          running += ln.debit - ln.credit;
          aoa.push([
            new Date(ln.date).toLocaleDateString('fr-FR'), ln.journal, ln.piece, ln.label,
            ln.debit ? fmtAmount(ln.debit) : '', ln.credit ? fmtAmount(ln.credit) : '',
          ]);
        });
      const last = aoa.length - 1;
      if (last >= first) dataRanges.push([first, last]);
      totalRows.push(aoa.length);
      aoa.push([`Solde compte ${a.account}`, '', '', '', fmtAmount(a.debit), fmtAmount(a.credit)]);
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = [{ wch: 14 }, { wch: 10 }, { wch: 22 }, { wch: 42 }, { wch: 16 }, { wch: 16 }];
    styleTitle(ws, 0, NCOLS);
    styleHeaderRow(ws, headerIdx, NCOLS);
    sectionRows.forEach(r => styleSectionRow(ws, r, NCOLS));
    dataRanges.forEach(([f, l]) => styleDataRows(ws, f, l, NCOLS));
    totalRows.forEach(r => styleTotalRow(ws, r, NCOLS));
    XLSX.utils.book_append_sheet(wb, ws, 'Grand livre');
    XLSX.writeFile(wb, `grand-livre-${ref}-${stamp}.xlsx`);
    showSuccess('Export Grand livre', 'Le grand livre a été exporté.');
  };

  const balanced = Math.abs(totals.debit - totals.credit) < 0.01;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 md:p-6 space-y-5">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Calculator className="w-5 h-5 mr-2 text-indigo-600" />
            Export comptable (passerelle vers une comptabilité)
          </h3>
          <p className="text-sm text-gray-500">
            Génère les écritures en partie double à partir des notifications (recettes) et des paiements décaissés (dépenses),
            puis exporte au format <strong>FEC</strong>, <strong>Journal</strong>, <strong>Grand livre</strong> et <strong>Balance</strong>.
          </p>
        </div>
        <button onClick={() => setShowCfg(v => !v)} className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 self-start">
          <Settings className="w-4 h-4" /> Paramètres des comptes
        </button>
      </div>

      {/* Bandeau d'info */}
      <div className="flex items-start gap-2 bg-indigo-50 border border-indigo-100 rounded-lg p-3">
        <Info className="w-4 h-4 text-indigo-600 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-indigo-800">
          Le compte de charge de chaque dépense provient de la <strong>sous-ligne budgétaire</strong> (champ « Compte comptable » en Planification),
          à défaut de la ligne parente, à défaut du <strong>compte de charge par défaut</strong> ci-dessous. Les comptes banque et subvention sont paramétrables.
        </p>
      </div>

      {/* Paramètres des comptes */}
      {showCfg && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Compte Banque</label>
            <input value={cfg.bankAccount} onChange={e => saveCfg({ ...cfg, bankAccount: e.target.value })} className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Libellé Banque</label>
            <input value={cfg.bankLabel} onChange={e => saveCfg({ ...cfg, bankLabel: e.target.value })} className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Journal (banque)</label>
            <input value={cfg.journalBank} onChange={e => saveCfg({ ...cfg, journalBank: e.target.value })} className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Compte Subvention (recette)</label>
            <input value={cfg.fundingAccount} onChange={e => saveCfg({ ...cfg, fundingAccount: e.target.value })} className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Libellé Subvention</label>
            <input value={cfg.fundingLabel} onChange={e => saveCfg({ ...cfg, fundingLabel: e.target.value })} className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Compte de charge par défaut</label>
            <input value={cfg.defaultChargeAccount} onChange={e => saveCfg({ ...cfg, defaultChargeAccount: e.target.value })} className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded" />
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-700 sm:col-span-2 lg:col-span-3">
            <input type="checkbox" checked={cfg.includeNotifications} onChange={e => saveCfg({ ...cfg, includeNotifications: e.target.checked })} />
            Inclure les notifications comme recettes (Débit {cfg.bankAccount} / Crédit {cfg.fundingAccount})
          </label>
          <p className="text-[11px] text-gray-400 sm:col-span-2 lg:col-span-3">Paramètres enregistrés localement par subvention.</p>
        </div>
      )}

      {/* Période */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Date de début (optionnel)</label>
          <input type="date" value={start} onChange={e => setStart(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Date de fin (optionnel)</label>
          <input type="date" value={end} onChange={e => setEnd(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg" />
        </div>
      </div>

      {/* Synthèse + contrôle d'équilibre */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
          <p className="text-xs text-gray-500">Écritures</p>
          <p className="text-lg font-bold text-gray-900">{totals.count}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
          <p className="text-xs text-gray-500">Total débit</p>
          <p className="text-lg font-bold text-indigo-700">{fmtAmount(totals.debit)}</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
          <p className="text-xs text-gray-500">Total crédit</p>
          <p className="text-lg font-bold text-indigo-700">{fmtAmount(totals.credit)}</p>
        </div>
        <div className={`rounded-lg p-3 border ${balanced ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
          <p className="text-xs text-gray-500">Équilibre</p>
          <p className={`text-lg font-bold ${balanced ? 'text-green-700' : 'text-red-700'}`}>{balanced ? 'Équilibré' : 'Déséquilibré'}</p>
        </div>
      </div>

      {/* Boutons d'export */}
      {canExport ? (
        <div className="flex flex-wrap gap-2">
          <button onClick={exportFEC} className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 flex items-center gap-2">
            <Download className="w-4 h-4" /> FEC (.txt)
          </button>
          <button onClick={exportJournal} className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-800 flex items-center gap-2">
            <Download className="w-4 h-4" /> Journal (Excel)
          </button>
          <button onClick={exportGrandLivre} className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-800 flex items-center gap-2">
            <Download className="w-4 h-4" /> Grand livre (Excel)
          </button>
          <button onClick={exportBalance} className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-800 flex items-center gap-2">
            <Download className="w-4 h-4" /> Balance (Excel)
          </button>
        </div>
      ) : (
        <p className="text-sm text-gray-500">Vous n'avez pas la permission d'exporter les données comptables.</p>
      )}

      {/* Aperçu de la balance */}
      {accounts.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-3 py-2 text-left">Compte</th>
                <th className="px-3 py-2 text-left">Libellé</th>
                <th className="px-3 py-2 text-right">Débit</th>
                <th className="px-3 py-2 text-right">Crédit</th>
                <th className="px-3 py-2 text-right">Solde</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {accounts.map(a => {
                const solde = a.debit - a.credit;
                return (
                  <tr key={a.account} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium">{a.account}</td>
                    <td className="px-3 py-2 text-gray-700">{a.label}</td>
                    <td className="px-3 py-2 text-right">{fmtAmount(a.debit)}</td>
                    <td className="px-3 py-2 text-right">{fmtAmount(a.credit)}</td>
                    <td className={`px-3 py-2 text-right font-medium ${solde >= 0 ? 'text-indigo-700' : 'text-orange-700'}`}>{fmtAmount(solde)}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 font-semibold">
                <td className="px-3 py-2" colSpan={2}>TOTAUX</td>
                <td className="px-3 py-2 text-right">{fmtAmount(totals.debit)}</td>
                <td className="px-3 py-2 text-right">{fmtAmount(totals.credit)}</td>
                <td className="px-3 py-2 text-right">{fmtAmount(totals.debit - totals.credit)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
};

export default AccountingExport;
