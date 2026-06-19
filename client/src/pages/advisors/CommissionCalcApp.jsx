import React, { useState } from 'react';

// ─── Helpers ──────────────────────────────────────────────────────────────────
let _nextId = 1;
const uid = () => _nextId++;

const pn = v => { const n = parseFloat(String(v).replace(/,/g, '')); return isNaN(n) ? 0 : n; };
const fmtD = n => n === 0 ? '—' : '$' + Math.abs(Math.round(n)).toLocaleString();
const fmtDSigned = n => n === 0 ? '—' : (n < 0 ? '-' : '') + '$' + Math.abs(Math.round(n)).toLocaleString();
const fmtPct = n => n.toFixed(1) + '%';

const blankExpense  = () => ({ id: uid(), label: '', amount: '' });
const blankReferral = () => ({ id: uid(), label: '', type: 'pct', value: '' });
const blankTeam     = () => ({ id: uid(), label: '', pct: '' });

const initState = () => ({
  dealName:   '',
  salePrice:  '',
  commRate:   10,
  minComm:    '',
  expenses:   [],
  referrals:  [],
  advisorPct: 100,
  teamSplits: [],
});

// ─── Styled helpers ───────────────────────────────────────────────────────────
const inp = {
  background: '#0d1117', border: '1px solid #1e2d3d', borderRadius: 5,
  color: '#e2e8f0', padding: '7px 10px', fontSize: 13, width: '100%',
  fontFamily: 'system-ui, sans-serif', outline: 'none', boxSizing: 'border-box',
};
const lbl = { display: 'block', fontSize: 11, color: '#64748b', marginBottom: 4,
  textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'system-ui, sans-serif' };
const card = { background: '#0d1117', border: '1px solid #1a2235', borderRadius: 8,
  padding: '18px 20px', marginBottom: 16 };
const mono = { fontFamily: 'monospace', fontWeight: 700 };

function NI({ value, onChange, placeholder = '0', prefix = '$', style = {} }) {
  return (
    <div style={{ position: 'relative' }}>
      {prefix && <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: '#475569', fontSize: 13, pointerEvents: 'none' }}>{prefix}</span>}
      <input
        type="number"
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        style={{ ...inp, paddingLeft: prefix ? 20 : 10, ...style }}
      />
    </div>
  );
}

function PctFlatToggle({ type, onChange }) {
  return (
    <div style={{ display: 'flex', borderRadius: 4, overflow: 'hidden', border: '1px solid #1e2d3d', flexShrink: 0 }}>
      {[['pct', '%'], ['flat', '$']].map(([v, l]) => (
        <button key={v} onClick={() => onChange(v)}
          style={{ padding: '6px 10px', fontSize: 12, border: 'none', cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
            background: type === v ? '#1e3a5f' : '#0d1117', color: type === v ? '#60a5fa' : '#475569' }}>
          {l}
        </button>
      ))}
    </div>
  );
}

// ─── Waterfall row ────────────────────────────────────────────────────────────
function WRow({ label, sub, amount, color = '#e2e8f0', bold = false, indent = false, borderTop = false, note }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12,
      borderTop: borderTop ? '1px solid #1e2d3d' : 'none', paddingTop: borderTop ? 10 : 0, marginTop: borderTop ? 4 : 0 }}>
      <div style={{ minWidth: 0 }}>
        <span style={{ fontSize: bold ? 13 : 12, color: bold ? '#e2e8f0' : '#94a3b8',
          fontWeight: bold ? 700 : 400, fontFamily: 'system-ui, sans-serif',
          paddingLeft: indent ? 12 : 0 }}>
          {label}
        </span>
        {sub && <span style={{ fontSize: 10, color: '#475569', marginLeft: 6, fontFamily: 'system-ui, sans-serif' }}>{sub}</span>}
        {note && <div style={{ fontSize: 10, color: '#475569', paddingLeft: indent ? 12 : 0, fontFamily: 'system-ui, sans-serif' }}>{note}</div>}
      </div>
      <span style={{ ...mono, fontSize: bold ? 14 : 12, color, flexShrink: 0 }}>{amount}</span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CommissionCalcApp() {
  const [s, setS] = useState(initState);
  const set = patch => setS(prev => ({ ...prev, ...patch }));

  // expense helpers
  const addExpense    = () => set({ expenses: [...s.expenses, blankExpense()] });
  const upExpense     = (id, patch) => set({ expenses: s.expenses.map(e => e.id === id ? { ...e, ...patch } : e) });
  const delExpense    = id => set({ expenses: s.expenses.filter(e => e.id !== id) });

  // referral helpers
  const addReferral   = () => set({ referrals: [...s.referrals, blankReferral()] });
  const upReferral    = (id, patch) => set({ referrals: s.referrals.map(r => r.id === id ? { ...r, ...patch } : r) });
  const delReferral   = id => set({ referrals: s.referrals.filter(r => r.id !== id) });

  // team helpers
  const addTeam       = () => set({ teamSplits: [...s.teamSplits, blankTeam()] });
  const upTeam        = (id, patch) => set({ teamSplits: s.teamSplits.map(t => t.id === id ? { ...t, ...patch } : t) });
  const delTeam       = id => set({ teamSplits: s.teamSplits.filter(t => t.id !== id) });

  // ── Calculations ─────────────────────────────────────────────────────────
  const salePrice  = pn(s.salePrice);
  const commRate   = pn(s.commRate);
  const minComm    = pn(s.minComm);
  const rawGCI     = salePrice * (commRate / 100);
  const grossGCI   = minComm > 0 ? Math.max(rawGCI, minComm) : rawGCI;

  const totalExpenses = s.expenses.reduce((sum, e) => sum + pn(e.amount), 0);
  const netAfterExp   = grossGCI - totalExpenses;

  const referralAmounts = s.referrals.map(r => {
    const val = pn(r.value);
    return r.type === 'pct' ? grossGCI * (val / 100) : val;
  });
  const totalReferrals = referralAmounts.reduce((a, b) => a + b, 0);
  const netAfterRef    = netAfterExp - totalReferrals;

  const advisorShare   = netAfterRef * ((pn(s.advisorPct)) / 100);
  const brokerRetain   = netAfterRef - advisorShare;

  const teamAmounts    = s.teamSplits.map(t => advisorShare * (pn(t.pct) / 100));
  const totalTeam      = teamAmounts.reduce((a, b) => a + b, 0);
  const advisorNet     = advisorShare - totalTeam;

  const effectivePct   = salePrice > 0 ? (advisorNet / salePrice) * 100 : 0;

  const btnAdd = { background: 'transparent', border: '1px dashed #1e2d3d', borderRadius: 5,
    color: '#475569', fontSize: 12, padding: '6px 12px', cursor: 'pointer',
    fontFamily: 'system-ui, sans-serif', width: '100%', textAlign: 'left' };
  const btnDel = { background: 'transparent', border: 'none', color: '#475569',
    fontSize: 16, cursor: 'pointer', lineHeight: 1, padding: '2px 4px', flexShrink: 0 };
  const hdr = { fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase',
    letterSpacing: '0.08em', marginBottom: 14, fontFamily: 'system-ui, sans-serif' };

  return (
    <div style={{ maxWidth: 840, margin: '0 auto', padding: '28px 24px', fontFamily: 'system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontWeight: 700, fontSize: 20, color: '#e2e8f0', margin: 0, letterSpacing: 0.2 }}>
          💰 Commission Calculator
        </h2>
        <p style={{ color: '#64748b', fontSize: 13, marginTop: 5, marginBottom: 0 }}>
          Calculate advisor net from GCI after expenses, referrals, and brokerage splits.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>

        {/* ── Left column: inputs ─────────────────────────────────────────── */}
        <div>

          {/* Deal Info */}
          <div style={card}>
            <div style={hdr}>Deal Info</div>
            <div style={{ marginBottom: 12 }}>
              <span style={lbl}>Deal Name (optional)</span>
              <input value={s.dealName} onChange={e => set({ dealName: e.target.value })}
                placeholder="e.g. La Baguette" style={inp} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <span style={lbl}>Sale Price</span>
                <NI value={s.salePrice} onChange={v => set({ salePrice: v })} placeholder="1,200,000" />
              </div>
              <div>
                <span style={lbl}>Commission Rate (%)</span>
                <NI value={s.commRate} onChange={v => set({ commRate: v })} placeholder="10" prefix="%" />
              </div>
            </div>
            <div style={{ marginTop: 12 }}>
              <span style={lbl}>Minimum Commission (optional floor)</span>
              <NI value={s.minComm} onChange={v => set({ minComm: v })} placeholder="15,000" />
              {minComm > 0 && rawGCI < minComm && (
                <div style={{ fontSize: 11, color: '#fbbf24', marginTop: 4 }}>
                  Minimum applied — rate would yield {fmtD(rawGCI)}, floor raises to {fmtD(minComm)}
                </div>
              )}
            </div>
          </div>

          {/* Deal Expenses */}
          <div style={card}>
            <div style={hdr}>Deal Expenses</div>
            {s.expenses.length === 0 && (
              <div style={{ fontSize: 12, color: '#334155', marginBottom: 10 }}>
                Marketing, travel, legal, due diligence, etc.
              </div>
            )}
            {s.expenses.map((e) => (
              <div key={e.id} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                <input value={e.label} onChange={ev => upExpense(e.id, { label: ev.target.value })}
                  placeholder="Expense description" style={{ ...inp, flex: 2 }} />
                <div style={{ flex: 1 }}>
                  <NI value={e.amount} onChange={v => upExpense(e.id, { amount: v })} placeholder="0" />
                </div>
                <button onClick={() => delExpense(e.id)} style={btnDel}>×</button>
              </div>
            ))}
            <button onClick={addExpense} style={btnAdd}>+ Add Expense</button>
          </div>

          {/* Referral / Co-Broker Splits */}
          <div style={card}>
            <div style={hdr}>Referral & Co-Broker Fees</div>
            <div style={{ fontSize: 11, color: '#475569', marginBottom: 10 }}>
              % of GCI or flat amount paid to referrers, buyer's agents, or support brokers.
            </div>
            {s.referrals.map((r, i) => (
              <div key={r.id} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                <input value={r.label} onChange={ev => upReferral(r.id, { label: ev.target.value })}
                  placeholder={i === 0 ? 'e.g. Seller Referral' : i === 1 ? "e.g. Buyer's Agent" : 'e.g. Support Broker'}
                  style={{ ...inp, flex: 2 }} />
                <PctFlatToggle type={r.type} onChange={v => upReferral(r.id, { type: v, value: '' })} />
                <div style={{ flex: 1 }}>
                  <NI value={r.value} onChange={v => upReferral(r.id, { value: v })}
                    placeholder={r.type === 'pct' ? '25' : '5,000'}
                    prefix={r.type === 'pct' ? '%' : '$'} />
                </div>
                <button onClick={() => delReferral(r.id)} style={btnDel}>×</button>
              </div>
            ))}
            <button onClick={addReferral} style={btnAdd}>+ Add Referral / Co-Broker</button>
          </div>

          {/* Brokerage Split */}
          <div style={card}>
            <div style={hdr}>Brokerage Split</div>
            <div>
              <span style={lbl}>Advisor Keeps (%)</span>
              <NI value={s.advisorPct} onChange={v => set({ advisorPct: Math.min(100, Math.max(0, pn(v))) })}
                placeholder="100" prefix="%" />
              {pn(s.advisorPct) < 100 && (
                <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>
                  Brokerage retains {(100 - pn(s.advisorPct)).toFixed(1)}% — {fmtD(brokerRetain)}
                </div>
              )}
            </div>
          </div>

          {/* Team Splits */}
          <div style={card}>
            <div style={hdr}>Team Splits <span style={{ fontWeight: 400, color: '#334155', textTransform: 'none', letterSpacing: 0 }}>(% of advisor's net)</span></div>
            {s.teamSplits.length === 0 && (
              <div style={{ fontSize: 12, color: '#334155', marginBottom: 10 }}>
                Split advisor's share with team members or partners.
              </div>
            )}
            {s.teamSplits.map((t, i) => (
              <div key={t.id} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                <input value={t.label} onChange={ev => upTeam(t.id, { label: ev.target.value })}
                  placeholder={i === 0 ? 'e.g. Listing Partner' : 'e.g. Buyer Rep'}
                  style={{ ...inp, flex: 2 }} />
                <div style={{ flex: 1 }}>
                  <NI value={t.pct} onChange={v => upTeam(t.id, { pct: v })} placeholder="25" prefix="%" />
                </div>
                <button onClick={() => delTeam(t.id)} style={btnDel}>×</button>
              </div>
            ))}
            <button onClick={addTeam} style={btnAdd}>+ Add Team Member</button>
          </div>

        </div>

        {/* ── Right column: waterfall ─────────────────────────────────────── */}
        <div style={{ position: 'sticky', top: 24 }}>

          {/* Summary card */}
          {grossGCI > 0 && (
            <div style={{ background: 'rgba(46,184,96,0.07)', border: '1px solid rgba(46,184,96,0.2)',
              borderRadius: 8, padding: '16px 20px', marginBottom: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                Advisor Net Commission
              </div>
              <div style={{ ...mono, fontSize: 32, color: advisorNet > 0 ? '#2eb860' : '#ef4444' }}>
                {fmtD(advisorNet)}
              </div>
              {salePrice > 0 && (
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                  {fmtPct(effectivePct)} of {fmtD(salePrice)} sale price
                </div>
              )}
            </div>
          )}

          {/* Waterfall */}
          <div style={{ ...card, padding: '18px 20px' }}>
            <div style={hdr}>Commission Waterfall</div>

            {grossGCI === 0 ? (
              <div style={{ fontSize: 13, color: '#334155', textAlign: 'center', padding: '20px 0' }}>
                Enter a sale price to see the breakdown.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

                {/* GCI */}
                <WRow label="Gross Commission (GCI)" bold
                  sub={`${fmtPct(commRate)} × ${fmtD(salePrice)}${minComm > 0 && rawGCI < minComm ? ' (floor)' : ''}`}
                  amount={fmtD(grossGCI)} color="#2eb860" />

                {/* Expenses */}
                {totalExpenses > 0 && (
                  <>
                    <WRow label="Deal Expenses" sub="itemized" amount={`(${fmtD(totalExpenses)})`} color="#f87171" indent />
                    {s.expenses.filter(e => pn(e.amount) > 0).map(e => (
                      <WRow key={e.id} label={e.label || 'Expense'} indent
                        amount={`(${fmtD(pn(e.amount))})`} color="#475569" />
                    ))}
                    <WRow label="Net GCI After Expenses" bold borderTop
                      amount={fmtD(netAfterExp)} color={netAfterExp >= 0 ? '#e2e8f0' : '#ef4444'} />
                  </>
                )}

                {/* Referrals */}
                {totalReferrals > 0 && (
                  <>
                    <WRow label="Referral / Co-Broker Fees" sub="itemized" amount={`(${fmtD(totalReferrals)})`} color="#f87171" indent />
                    {s.referrals.map((r, i) => {
                      const amt = referralAmounts[i];
                      if (!amt) return null;
                      const sub = r.type === 'pct' ? `${pn(r.value)}% of GCI` : 'flat';
                      return <WRow key={r.id} label={r.label || 'Referral'} sub={sub} indent amount={`(${fmtD(amt)})`} color="#475569" />;
                    })}
                    <WRow label="Net GCI After Referrals" bold borderTop
                      amount={fmtD(netAfterRef)} color={netAfterRef >= 0 ? '#e2e8f0' : '#ef4444'} />
                  </>
                )}

                {/* Brokerage split */}
                {pn(s.advisorPct) < 100 && (
                  <>
                    <WRow label="Brokerage Retention" sub={`${(100 - pn(s.advisorPct)).toFixed(1)}%`} indent
                      amount={`(${fmtD(brokerRetain)})`} color="#475569" />
                    <WRow label="Advisor Share" bold borderTop
                      sub={`${pn(s.advisorPct).toFixed(1)}% of net`}
                      amount={fmtD(advisorShare)} color="#e2e8f0" />
                  </>
                )}

                {/* Team splits */}
                {totalTeam > 0 && (
                  <>
                    <WRow label="Team Splits" sub="itemized" amount={`(${fmtD(totalTeam)})`} color="#f87171" indent />
                    {s.teamSplits.map((t, i) => {
                      const amt = teamAmounts[i];
                      if (!amt) return null;
                      return <WRow key={t.id} label={t.label || 'Team Member'} sub={`${pn(t.pct)}%`} indent amount={`(${fmtD(amt)})`} color="#475569" />;
                    })}
                  </>
                )}

                {/* Final advisor net */}
                <div style={{ borderTop: '2px solid #2eb860', paddingTop: 12, marginTop: 4,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#e2e8f0', fontFamily: 'system-ui, sans-serif' }}>
                    Advisor Net
                  </span>
                  <span style={{ ...mono, fontSize: 20, color: advisorNet > 0 ? '#2eb860' : '#ef4444' }}>
                    {fmtD(advisorNet)}
                  </span>
                </div>

                {/* Effective rate */}
                {salePrice > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                    <span style={{ fontSize: 11, color: '#475569', fontFamily: 'system-ui, sans-serif' }}>Effective rate on sale price</span>
                    <span style={{ ...mono, fontSize: 11, color: '#475569' }}>{fmtPct(effectivePct)}</span>
                  </div>
                )}

              </div>
            )}
          </div>

          {/* Scenario summary table */}
          {salePrice > 0 && (
            <div style={{ ...card, padding: '16px 20px' }}>
              <div style={hdr}>Sensitivity — Sale Price</div>
              <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #1e2d3d' }}>
                    <th style={{ textAlign: 'left', padding: '4px 0 6px', color: '#475569' }}>Price</th>
                    <th style={{ textAlign: 'right', padding: '4px 0 6px', color: '#475569' }}>GCI</th>
                    <th style={{ textAlign: 'right', padding: '4px 0 6px', color: '#475569' }}>Advisor Net</th>
                  </tr>
                </thead>
                <tbody>
                  {[-20, -10, 0, 10, 20].map(pctDelta => {
                    const p = salePrice * (1 + pctDelta / 100);
                    const g = minComm > 0 ? Math.max(p * (commRate / 100), minComm) : p * (commRate / 100);
                    const netExp = g - totalExpenses;
                    const refs = s.referrals.reduce((sum, r) => {
                      return sum + (r.type === 'pct' ? g * (pn(r.value) / 100) : pn(r.value));
                    }, 0);
                    const netRef = netExp - refs;
                    const advShare = netRef * (pn(s.advisorPct) / 100);
                    const advNet = advShare - s.teamSplits.reduce((sum, t) => sum + advShare * (pn(t.pct) / 100), 0);
                    const isBase = pctDelta === 0;
                    return (
                      <tr key={pctDelta} style={{ borderBottom: '1px solid #0d1117',
                        background: isBase ? 'rgba(46,184,96,0.05)' : 'transparent' }}>
                        <td style={{ padding: '5px 0', color: isBase ? '#2eb860' : '#94a3b8', fontFamily: 'monospace' }}>
                          {fmtD(p)}{pctDelta !== 0 && <span style={{ color: '#475569', fontSize: 10 }}> ({pctDelta > 0 ? '+' : ''}{pctDelta}%)</span>}
                        </td>
                        <td style={{ textAlign: 'right', padding: '5px 0', color: '#94a3b8', fontFamily: 'monospace' }}>{fmtD(g)}</td>
                        <td style={{ textAlign: 'right', padding: '5px 0', color: advNet >= 0 ? '#2eb860' : '#ef4444', fontFamily: 'monospace', fontWeight: 700 }}>
                          {fmtD(advNet)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Reset */}
          <button onClick={() => setS(initState())}
            style={{ background: 'transparent', border: '1px solid #1a2235', borderRadius: 6,
              color: '#475569', fontSize: 12, padding: '8px 16px', cursor: 'pointer',
              fontFamily: 'system-ui, sans-serif', width: '100%' }}>
            Reset Calculator
          </button>

        </div>
      </div>
    </div>
  );
}
