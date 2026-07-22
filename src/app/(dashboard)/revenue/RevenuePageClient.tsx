'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Panel, PanelHead, formatLKR } from '@/components/workspace/primitives';
import type { MonthlyRevenueResponse } from '@/features/revenue/types';

interface CollectedPayment {
  planType: string;
  amountPaid: number;
}
interface CollectedResponse {
  payments: CollectedPayment[];
  summary: { totalRevenue: number; paymentCount: number };
}

const PLAN_LABEL: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
  '3-months': '3 Months',
  '6-months': '6 Months',
  annual: 'Annual',
};

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/**
 * Revenue — App Workspace design. Stat tiles + a trailing monthly bar chart +
 * a plan-type breakdown table. All live: metrics/history come from
 * /api/revenue/monthly, the breakdown is aggregated from
 * /api/payment-collection/collected. A compact year/month selector preserves
 * period navigation from the original screen.
 */
export default function RevenuePageClient() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const yearOptions = Array.from({ length: 6 }, (_, i) => today.getFullYear() - i);

  const { data, isLoading } = useQuery<MonthlyRevenueResponse>({
    queryKey: ['revenue', 'monthly', year, month],
    queryFn: async () => {
      const response = await fetch(`/api/revenue/monthly?year=${year}&month=${month}`);
      if (!response.ok) throw new Error('Failed to fetch monthly revenue');
      const result = await response.json();
      return result.data;
    },
  });

  const { data: collected } = useQuery<CollectedResponse>({
    queryKey: ['revenue', 'collected', year, month],
    queryFn: async () => {
      const m = `${year}-${String(month).padStart(2, '0')}`;
      const response = await fetch(`/api/payment-collection/collected?month=${m}`);
      if (!response.ok) throw new Error('Failed to fetch collected payments');
      const result = await response.json();
      return result.data;
    },
    staleTime: 60_000,
  });

  const cur = data?.currentMonth;
  const metrics = data?.metrics;
  const collectedRate = cur && cur.projectedRevenue > 0
    ? Math.round((cur.collectedRevenue / cur.projectedRevenue) * 100)
    : null;

  const tiles = [
    { label: `Collected · ${MONTHS[month - 1].slice(0, 3)}`, value: cur ? formatLKR(cur.collectedRevenue, { prefix: false }) : '—', delta: collectedRate !== null ? `${collectedRate}% of billed` : ' ', deltaC: 'var(--mws-t2)' },
    { label: `Projected · ${MONTHS[month - 1].slice(0, 3)}`, value: cur ? formatLKR(cur.projectedRevenue, { prefix: false }) : '—', delta: cur?.hasOverduePayments ? 'Outstanding dues remain' : 'Fully collected', deltaC: cur?.hasOverduePayments ? 'var(--mws-warn)' : 'var(--mws-ok)' },
    { label: 'Active members', value: metrics ? metrics.totalActiveMembers.toLocaleString('en-US') : '—', delta: 'Currently active', deltaC: 'var(--mws-t2)' },
    { label: 'Avg / member', value: metrics ? formatLKR(metrics.averageRevenuePerMember, { prefix: false }) : '—', delta: 'Lifetime value', deltaC: 'var(--mws-ok)' },
  ];

  const history = data?.historicalData ?? [];
  const maxRev = Math.max(1, ...history.map((h) => h.collectedRevenue));

  // Aggregate collected payments by plan type for the breakdown table.
  const byPlan = new Map<string, { amount: number; count: number }>();
  for (const p of collected?.payments ?? []) {
    const cur2 = byPlan.get(p.planType) ?? { amount: 0, count: 0 };
    cur2.amount += p.amountPaid;
    cur2.count += 1;
    byPlan.set(p.planType, cur2);
  }
  const totalCollected = collected?.summary.totalRevenue ?? 0;
  const breakdown = Array.from(byPlan.entries())
    .map(([plan, v]) => ({ plan, ...v, share: totalCollected > 0 ? Math.round((v.amount / totalCollected) * 100) : 0 }))
    .sort((a, b) => b.amount - a.amount);

  return (
    <div className="flex flex-col gap-4" style={{ maxWidth: 1200 }}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h1 className="mws-h1">Revenue</h1>
        <div className="flex gap-2">
          <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="mws-select">
            {MONTHS.map((label, i) => <option key={label} value={i + 1}>{label}</option>)}
          </select>
          <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="mws-select">
            {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* Tiles */}
      <div className="mws-stat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {tiles.map((t) => (
          <div key={t.label} className="mws-stat">
            <div className="mws-label">{t.label}</div>
            <div className="mws-stat-value">{isLoading ? '—' : t.value}</div>
            <div className="mws-mono" style={{ fontSize: 12, color: t.deltaC }}>{t.delta}</div>
          </div>
        ))}
      </div>

      {/* Chart */}
      <Panel style={{ padding: 16 }} className="flex flex-col gap-3">
        <div className="mws-label">Monthly collected revenue · LKR ×1,000</div>
        <div className="flex items-end" style={{ gap: 12, height: 180, paddingTop: 8 }}>
          {history.length === 0
            ? <div style={{ color: 'var(--mws-t3)', fontSize: 13 }}>No revenue history for this period.</div>
            : history.map((h, i) => {
                const barH = Math.max(2, Math.round((h.collectedRevenue / maxRev) * 150));
                const isCurrent = i === history.length - 1;
                return (
                  <div key={h.monthLabel} className="flex-1 flex flex-col items-center justify-end" style={{ gap: 6, height: '100%' }}>
                    <span className="mws-mono" style={{ fontSize: 11, color: 'var(--mws-t2)' }}>{Math.round(h.collectedRevenue / 1000)}</span>
                    <div style={{ width: '100%', height: barH, background: isCurrent ? 'var(--mws-accent)' : 'rgba(0,0,0,0.14)', borderRadius: '2px 2px 0 0' }} />
                    <span className="mws-mono" style={{ fontSize: 10, color: 'var(--mws-t3)', textTransform: 'uppercase' }}>{h.monthLabel.split(' ')[0]}</span>
                  </div>
                );
              })}
        </div>
      </Panel>

      {/* Breakdown by plan type */}
      <Panel style={{ overflow: 'hidden' }}>
        <PanelHead label="Breakdown by plan type" />
        <div className="mws-table-scroll">
          <table className="mws-table">
            <thead>
              <tr>
                <th>Plan</th>
                <th style={{ textAlign: 'right' }}>Payments</th>
                <th style={{ textAlign: 'right' }}>Collected (LKR)</th>
                <th style={{ textAlign: 'right' }}>Share</th>
              </tr>
            </thead>
            <tbody>
              {breakdown.length === 0 && (
                <tr><td colSpan={4} style={{ padding: 16, textAlign: 'center', color: 'var(--mws-t3)' }}>No payments collected this period.</td></tr>
              )}
              {breakdown.map((p) => (
                <tr key={p.plan}>
                  <td style={{ fontWeight: 500 }}>{PLAN_LABEL[p.plan] ?? p.plan}</td>
                  <td className="mws-num" style={{ color: 'var(--mws-t2)' }}>{p.count}</td>
                  <td className="mws-num">{formatLKR(p.amount, { prefix: false })}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="flex items-center justify-end" style={{ gap: 8 }}>
                      <div style={{ width: 80, height: 4, background: 'rgba(0,0,0,0.09)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: 'var(--mws-accent-tint)', width: `${p.share}%` }} />
                      </div>
                      <span className="mws-mono" style={{ fontSize: 12, color: 'var(--mws-t2)', minWidth: 36, textAlign: 'right' }}>{p.share}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
