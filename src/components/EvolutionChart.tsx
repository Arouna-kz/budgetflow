import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { BudgetLine, SubBudgetLine, Engagement, Payment, Grant } from '../types';

// Palette catégorielle CVD-safe (ordre fixe, jamais cyclé) — 1 couleur par entité.
const PALETTE = ['#2a78d6', '#1baf7a', '#eda100', '#008300', '#4a3aa7', '#e34948', '#e87ba4', '#eb6834'];
const OTHER_COLOR = '#898781';

interface Props {
  grant?: Grant | null;
  budgetLines: BudgetLine[];
  subBudgetLines: SubBudgetLine[];
  engagements: Engagement[];
  payments: Payment[];
}

const monthKey = (d: string) => (d || '').slice(0, 7); // YYYY-MM
const monthLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number);
  if (!y || !m) return key;
  return new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
};
const fmt = (n: number) => (Number(n) || 0).toLocaleString('fr-FR');

const EvolutionChart: React.FC<Props> = ({ grant, budgetLines, subBudgetLines, engagements, payments }) => {
  const [dimension, setDimension] = useState<'lines' | 'sublines'>('lines');
  const [metric, setMetric] = useState<'engaged' | 'disbursed'>('engaged');

  const { data, series, empty } = useMemo(() => {
    // 1) Entités (lignes ou sous-lignes)
    const entities = dimension === 'lines'
      ? budgetLines.map(l => ({ id: l.id, name: `${l.code} — ${l.name}` }))
      : subBudgetLines.map(s => ({ id: s.id, name: `${s.code} — ${s.name}` }));
    if (entities.length === 0) return { data: [] as any[], series: [] as any[], empty: true };

    const entityOf = (e: { subBudgetLineId?: string; budgetLineId?: string }) =>
      dimension === 'lines' ? e.budgetLineId : e.subBudgetLineId;

    // 2) Contributions datées (montant, date, entité)
    const contribs: { id?: string; date: string; amount: number }[] = [];
    if (metric === 'engaged') {
      engagements
        .filter(e => e.status === 'approved' || e.status === 'paid')
        .forEach(e => contribs.push({ id: entityOf(e), date: e.date, amount: e.amount }));
    } else {
      payments.forEach(p => {
        if (p.partialPayments && p.partialPayments.length > 0) {
          p.partialPayments.forEach(pp => contribs.push({ id: entityOf(p), date: pp.date, amount: pp.amount }));
        } else if (p.status === 'paid') {
          contribs.push({ id: entityOf(p), date: p.date, amount: p.amount });
        }
      });
    }
    const valid = contribs.filter(c => c.id && c.date);
    if (valid.length === 0) return { data: [], series: [], empty: true };

    // 3) Classement des entités par total (top 8, reste = « Autres »)
    const totals = new Map<string, number>();
    valid.forEach(c => totals.set(c.id!, (totals.get(c.id!) || 0) + c.amount));
    const ranked = entities
      .filter(e => (totals.get(e.id) || 0) > 0)
      .sort((a, b) => (totals.get(b.id) || 0) - (totals.get(a.id) || 0));
    const kept = ranked.slice(0, 8);
    const keptIds = new Set(kept.map(k => k.id));
    const hasOther = ranked.length > 8;

    const series = kept.map((k, i) => ({ key: k.id, name: k.name, color: PALETTE[i] }));
    if (hasOther) series.push({ key: '__other__', name: 'Autres', color: OTHER_COLOR });

    // 4) Axe temporel (mois) : du 1er mouvement à aujourd'hui
    const months = Array.from(new Set(valid.map(c => monthKey(c.date)))).sort();
    const start = months[0];
    const end = monthKey(new Date().toISOString());
    const allMonths: string[] = [];
    let [sy, sm] = start.split('-').map(Number);
    const [ey, em] = (end >= start ? end : months[months.length - 1]).split('-').map(Number);
    while (sy < ey || (sy === ey && sm <= em)) {
      allMonths.push(`${sy}-${String(sm).padStart(2, '0')}`);
      sm++; if (sm > 12) { sm = 1; sy++; }
      if (allMonths.length > 240) break; // garde-fou
    }

    // 5) Cumul par mois et par série
    const data = allMonths.map(mk => {
      const row: any = { month: monthLabel(mk) };
      series.forEach(s => { row[s.key] = 0; });
      valid.forEach(c => {
        if (monthKey(c.date) <= mk) {
          const bucket = keptIds.has(c.id!) ? c.id! : (hasOther ? '__other__' : null);
          if (bucket && row[bucket] !== undefined) row[bucket] += c.amount;
        }
      });
      return row;
    });

    return { data, series, empty: false };
  }, [dimension, metric, budgetLines, subBudgetLines, engagements, payments]);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Graphique d'évolution</h3>
          <p className="text-sm text-gray-500">
            Progression cumulée de l'{metric === 'engaged' ? 'engagement' : 'utilisation (décaissement)'} par {dimension === 'lines' ? 'ligne' : 'sous-ligne'} budgétaire
            {grant ? ` — ${grant.name}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
            <button onClick={() => setDimension('lines')} className={`px-3 py-1.5 text-sm ${dimension === 'lines' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700'}`}>Lignes</button>
            <button onClick={() => setDimension('sublines')} className={`px-3 py-1.5 text-sm ${dimension === 'sublines' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700'}`}>Sous-lignes</button>
          </div>
          <div className="inline-flex rounded-lg border border-gray-200 overflow-hidden">
            <button onClick={() => setMetric('engaged')} className={`px-3 py-1.5 text-sm ${metric === 'engaged' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700'}`}>Engagé</button>
            <button onClick={() => setMetric('disbursed')} className={`px-3 py-1.5 text-sm ${metric === 'disbursed' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-700'}`}>Décaissé</button>
          </div>
        </div>
      </div>

      {empty ? (
        <div className="text-center py-16 text-gray-500">
          <p className="font-medium">Aucune donnée à afficher</p>
          <p className="text-sm">Aucun mouvement {metric === 'engaged' ? 'd\'engagement' : 'de décaissement'} enregistré pour cette sélection.</p>
        </div>
      ) : (
        <>
          <div style={{ width: '100%', height: 420 }}>
            <ResponsiveContainer>
              <LineChart data={data} margin={{ top: 8, right: 24, left: 8, bottom: 8 }}>
                <CartesianGrid stroke="#e1e0d9" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fill: '#898781', fontSize: 12 }} tickLine={false} axisLine={{ stroke: '#c3c2b7' }} />
                <YAxis tick={{ fill: '#898781', fontSize: 12 }} tickLine={false} axisLine={false}
                  tickFormatter={(v) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))} width={48} />
                <Tooltip
                  formatter={(value: any, name: any) => [`${fmt(value)} ${grant?.currency || ''}`, name]}
                  labelStyle={{ color: '#0b0b0b', fontWeight: 600 }}
                  contentStyle={{ borderRadius: 8, border: '1px solid rgba(11,11,11,0.1)', fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {series.map(s => (
                  <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color}
                    strokeWidth={2} dot={false} activeDot={{ r: 5 }} isAnimationActive={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Chaque {dimension === 'lines' ? 'ligne' : 'sous-ligne'} budgétaire a sa propre couleur. Les valeurs sont cumulées mois après mois.
            {series.some(s => s.key === '__other__') ? ' Au-delà de 8 séries, les moins importantes sont regroupées dans « Autres ».' : ''}
          </p>
        </>
      )}
    </div>
  );
};

export default EvolutionChart;
