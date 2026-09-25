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
  background: '#ffffff', border: '1px solid #e6dfd6', borderRadius: 5,
  color: '#1c1917', padding: '10px 12px', fontSize: 13, width: '100%',
  fontFamily: 'system-ui, sans-serif', outline: 'none', boxSizing: 'border-box',
};
const lbl = { display: 'block', fontSize: 11, color: '#57534e', marginBottom: 6,
  textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'system-ui, sans-serif' };
const card = { background: '#ffffff', border: '1px solid #e6dfd6', borderRadius: 8,
  padding: '20px 24px', marginBottom: 16 };
const mono = { fontFamily: 'monospace', fontWeight: 700 };

function NI({ value, onChange, placeholder = '0', prefix = '$', style = {} }) {
  return (
    <div style={{ position: 'relative' }}>
      {prefix && <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#44403c', fontSize: 13, pointerEvents: 'none' }}>{prefix}</span>}
      <input
        type="number"
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        style={{ ...inp, paddingLeft: prefix ? 28 : 12, ...style }}
      />
    </div>
  );
}

function PctFlatToggle({ type, onChange }) {
  return (
    <div style={{ display: 'flex', borderRadius: 4, overflow: 'hidden', border: '1px solid #e6dfd6', flexShrink: 0 }}>
      {[['pct', '%'], ['flat', '$']].map(([v, l]) => (
        <button key={v} onClick={() => onChange(v)}
          style={{ padding: '6px 10px', fontSize: 12, border: 'none', cursor: 'pointer', fontFamily: 'system-ui, sans-serif',
            background: type === v ? '#1e3a5f' : '#ffffff', color: type === v ? '#1d4ed8' : '#44403c' }}>
          {l}
        </button>
      ))}
    </div>
  );
}

// ─── Waterfall row ────────────────────────────────────────────────────────────
function WRow({ label, sub, amount, color = '#1c1917', bold = false, indent = false, borderTop = false, note }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12,
      borderTop: borderTop ? '1px solid #e6dfd6' : 'none', paddingTop: borderTop ? 10 : 0, marginTop: borderTop ? 4 : 0 }}>
      <div style={{ minWidth: 0 }}>
        <span style={{ fontSize: bold ? 13 : 12, color: bold ? '#1c1917' : '#57534e',
          fontWeight: bold ? 700 : 400, fontFamily: 'system-ui, sans-serif',
          paddingLeft: indent ? 12 : 0 }}>
          {label}
        </span>
        {sub && <span style={{ fontSize: 10, color: '#44403c', marginLeft: 6, fontFamily: 'system-ui, sans-serif' }}>{sub}</span>}
        {note && <div style={{ fontSize: 10, color: '#44403c', paddingLeft: indent ? 12 : 0, fontFamily: 'system-ui, sans-serif' }}>{note}</div>}
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

  // ── PDF Export ────────────────────────────────────────────────────────────
  const exportPDF = () => {
    const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const f = n => n === 0 ? '—' : '$' + Math.abs(Math.round(n)).toLocaleString();
    const fp = n => n.toFixed(1) + '%';

    const waterfallRows = [];
    waterfallRows.push(`<tr class="gci"><td>Gross Commission (GCI)</td><td class="sub">${fp(commRate)} × ${f(salePrice)}${minComm > 0 && rawGCI < minComm ? ' (floor)' : ''}</td><td class="amt green">${f(grossGCI)}</td></tr>`);
    if (totalExpenses > 0) {
      s.expenses.filter(e => pn(e.amount) > 0).forEach(e => {
        waterfallRows.push(`<tr class="indent"><td colspan="2">${e.label || 'Expense'}</td><td class="amt red">(${f(pn(e.amount))})</td></tr>`);
      });
      waterfallRows.push(`<tr class="subtotal"><td colspan="2">Net GCI After Expenses</td><td class="amt">${f(netAfterExp)}</td></tr>`);
    }
    if (totalReferrals > 0) {
      s.referrals.forEach((r, i) => {
        const amt = referralAmounts[i];
        if (!amt) return;
        const sub = r.type === 'pct' ? ` (${pn(r.value)}% of GCI)` : ' (flat)';
        waterfallRows.push(`<tr class="indent"><td colspan="2">${r.label || 'Referral'}${sub}</td><td class="amt red">(${f(amt)})</td></tr>`);
      });
      waterfallRows.push(`<tr class="subtotal"><td colspan="2">Net GCI After Referrals</td><td class="amt">${f(netAfterRef)}</td></tr>`);
    }
    if (pn(s.advisorPct) < 100) {
      waterfallRows.push(`<tr class="indent"><td colspan="2">Brokerage Retention (${fp(100 - pn(s.advisorPct))})</td><td class="amt red">(${f(brokerRetain)})</td></tr>`);
      waterfallRows.push(`<tr class="subtotal"><td colspan="2">Advisor Share (${fp(pn(s.advisorPct))})</td><td class="amt">${f(advisorShare)}</td></tr>`);
    }
    if (totalTeam > 0) {
      s.teamSplits.forEach((t, i) => {
        const amt = teamAmounts[i];
        if (!amt) return;
        waterfallRows.push(`<tr class="indent"><td colspan="2">${t.label || 'Team Member'} (${pn(t.pct)}%)</td><td class="amt red">(${f(amt)})</td></tr>`);
      });
    }
    waterfallRows.push(`<tr class="final"><td colspan="2">Advisor Net Commission</td><td class="amt green">${f(advisorNet)}</td></tr>`);

    const sensitivityRows = [-20, -10, 0, 10, 20].map(d => {
      const p = salePrice * (1 + d / 100);
      const g = minComm > 0 ? Math.max(p * (commRate / 100), minComm) : p * (commRate / 100);
      const netE = g - totalExpenses;
      const refs = s.referrals.reduce((sum, r) => sum + (r.type === 'pct' ? g * (pn(r.value) / 100) : pn(r.value)), 0);
      const netR = netE - refs;
      const advS = netR * (pn(s.advisorPct) / 100);
      const net  = advS - s.teamSplits.reduce((sum, t) => sum + advS * (pn(t.pct) / 100), 0);
      const cls  = d === 0 ? ' class="base"' : '';
      return `<tr${cls}><td>${f(p)}${d !== 0 ? ` <span class="delta">(${d > 0 ? '+' : ''}${d}%)</span>` : ''}</td><td>${f(g)}</td><td class="${net >= 0 ? 'green' : 'red'}">${f(net)}</td></tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Commission Summary${s.dealName ? ' — ' + s.dealName : ''}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,-apple-system,sans-serif;color:#44403c;background:#fff;padding:48px;max-width:680px;margin:0 auto}
h1{font-size:22px;font-weight:700;letter-spacing:0.3px;margin-bottom:2px}
.subtitle{font-size:12px;color:#57534e;margin-bottom:28px}
.hero{background:#fff7f3;border:1px solid #f6ddd2;border-radius:8px;padding:18px 22px;margin-bottom:24px;display:flex;justify-content:space-between;align-items:center}
.hero-label{font-size:11px;text-transform:uppercase;letter-spacing:0.08em;color:#57534e;margin-bottom:4px}
.hero-amount{font-size:30px;font-weight:700;color:#C4592F;font-family:monospace}
.hero-meta{text-align:right;font-size:12px;color:#57534e}
.section{margin-bottom:22px}
.section-title{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;color:#57534e;border-bottom:1px solid #e2e8f0;padding-bottom:6px;margin-bottom:10px}
table{width:100%;border-collapse:collapse;font-size:13px}
td,th{padding:5px 0;vertical-align:baseline}
th{color:#57534e;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;padding-bottom:7px;border-bottom:1px solid #e2e8f0}
td:last-child,th:last-child{text-align:right;font-family:monospace}
td:nth-child(2){color:#57534e;font-size:11px;padding:0 12px}
tr.gci td{font-weight:600;font-size:14px;padding-top:0}
tr.gci td:last-child{color:#C4592F}
tr.indent td{padding-left:14px;color:#57534e}
tr.subtotal td{font-weight:600;border-top:1px solid #e2e8f0;padding-top:7px;padding-bottom:7px}
tr.final td{font-weight:700;font-size:15px;border-top:2px solid #C4592F;padding-top:10px;color:#44403c}
tr.final td:last-child{color:#C4592F}
.amt{font-family:monospace}
.green{color:#C4592F}
.red{color:#dc2626}
tr.base td{background:#fff7f3;font-weight:700}
.delta{font-size:10px;color:#57534e;font-family:system-ui,sans-serif}
.footer{margin-top:32px;font-size:10px;color:#57534e;text-align:center;border-top:1px solid #f1f5f9;padding-top:14px}
@media print{body{padding:24px}@page{margin:0.5in;size:letter portrait}}
</style></head><body>
<h1>Commission Summary${s.dealName ? ' — ' + s.dealName : ''}</h1>
<p class="subtitle">Generated ${date} · Peterson Acquisitions / The Deal Team</p>
<div class="hero">
  <div>
    <div class="hero-label">Advisor Net Commission</div>
    <div class="hero-amount">${f(advisorNet)}</div>
  </div>
  <div class="hero-meta">
    <div>${f(salePrice)} sale price</div>
    <div>${fp(commRate)} commission rate</div>
    ${salePrice > 0 ? `<div>${fp(effectivePct)} effective rate</div>` : ''}
  </div>
</div>
<div class="section">
  <div class="section-title">Commission Waterfall</div>
  <table><tbody>${waterfallRows.join('')}</tbody></table>
</div>
${salePrice > 0 ? `<div class="section">
  <div class="section-title">Price Sensitivity</div>
  <table><thead><tr><th>Sale Price</th><th>GCI</th><th>Advisor Net</th></tr></thead>
  <tbody>${sensitivityRows}</tbody></table>
</div>` : ''}
<div class="footer">QSI™ Commission Calculator · The Deal Team · Peterson Acquisitions</div>
<script>window.onload=()=>{window.print();}</script>
</body></html>`;

    const win = window.open('', '_blank', 'width=820,height=1000');
    if (!win) { alert('Allow pop-ups for this site to export PDF.'); return; }
    win.document.write(html);
    win.document.close();
  };

  const btnAdd = { background: 'transparent', border: '1px dashed #e6dfd6', borderRadius: 5,
    color: '#57534e', fontSize: 12, padding: '6px 12px', cursor: 'pointer',
    fontFamily: 'system-ui, sans-serif', width: '100%', textAlign: 'left' };
  const btnDel = { background: 'transparent', border: 'none', color: '#57534e',
    fontSize: 16, cursor: 'pointer', lineHeight: 1, padding: '2px 4px', flexShrink: 0 };
  const hdr = { fontSize: 11, fontWeight: 700, color: '#57534e', textTransform: 'uppercase',
    letterSpacing: '0.08em', marginBottom: 14, fontFamily: 'system-ui, sans-serif' };

  return (
    <div className="page-content" style={{ fontFamily: 'system-ui, sans-serif' }}>

      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ fontWeight: 700, fontSize: 20, color: '#1c1917', margin: 0, letterSpacing: 0.2 }}>
            💰 Commission Calculator
          </h2>
          <p style={{ color: '#57534e', fontSize: 13, marginTop: 5, marginBottom: 0 }}>
            Calculate advisor net from GCI after expenses, referrals, and brokerage splits.
          </p>
        </div>
        <button
          onClick={exportPDF}
          disabled={grossGCI === 0}
          style={{
            background: grossGCI > 0 ? '#1e3a5f' : 'transparent',
            border: `1px solid ${grossGCI > 0 ? '#2563eb' : '#e6dfd6'}`,
            borderRadius: 6, color: grossGCI > 0 ? '#1d4ed8' : '#44403c',
            fontSize: 13, fontWeight: 600, padding: '8px 16px', cursor: grossGCI > 0 ? 'pointer' : 'default',
            fontFamily: 'system-ui, sans-serif', flexShrink: 0, marginTop: 2,
          }}
        >
          ⬇ Export PDF
        </button>
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
                <div style={{ fontSize: 11, color: '#b45309', marginTop: 4 }}>
                  Minimum applied — rate would yield {fmtD(rawGCI)}, floor raises to {fmtD(minComm)}
                </div>
              )}
            </div>
          </div>

          {/* Deal Expenses */}
          <div style={card}>
            <div style={hdr}>Deal Expenses</div>
            {s.expenses.length === 0 && (
              <div style={{ fontSize: 12, color: '#57534e', marginBottom: 10 }}>
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
            <div style={{ fontSize: 11, color: '#57534e', marginBottom: 10 }}>
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
                <div style={{ fontSize: 11, color: '#57534e', marginTop: 4 }}>
                  Brokerage retains {(100 - pn(s.advisorPct)).toFixed(1)}% — {fmtD(brokerRetain)}
                </div>
              )}
            </div>
          </div>

          {/* Team Splits */}
          <div style={card}>
            <div style={hdr}>Team Splits <span style={{ fontWeight: 400, color: '#57534e', textTransform: 'none', letterSpacing: 0 }}>(% of advisor's net)</span></div>
            {s.teamSplits.length === 0 && (
              <div style={{ fontSize: 12, color: '#57534e', marginBottom: 10 }}>
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
            <div style={{ background: 'rgba(196,89,47,0.07)', border: '1px solid rgba(196,89,47,0.2)',
              borderRadius: 8, padding: '16px 20px', marginBottom: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#57534e', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                Advisor Net Commission
              </div>
              <div style={{ ...mono, fontSize: 32, color: advisorNet > 0 ? '#C4592F' : '#dc2626' }}>
                {fmtD(advisorNet)}
              </div>
              {salePrice > 0 && (
                <div style={{ fontSize: 12, color: '#57534e', marginTop: 4 }}>
                  {fmtPct(effectivePct)} of {fmtD(salePrice)} sale price
                </div>
              )}
            </div>
          )}

          {/* Waterfall */}
          <div style={{ ...card, padding: '18px 20px' }}>
            <div style={hdr}>Commission Waterfall</div>

            {grossGCI === 0 ? (
              <div style={{ fontSize: 13, color: '#57534e', textAlign: 'center', padding: '20px 0' }}>
                Enter a sale price to see the breakdown.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

                {/* GCI */}
                <WRow label="Gross Commission (GCI)" bold
                  sub={`${fmtPct(commRate)} × ${fmtD(salePrice)}${minComm > 0 && rawGCI < minComm ? ' (floor)' : ''}`}
                  amount={fmtD(grossGCI)} color="#C4592F" />

                {/* Expenses */}
                {totalExpenses > 0 && (
                  <>
                    <WRow label="Deal Expenses" sub="itemized" amount={`(${fmtD(totalExpenses)})`} color="#dc2626" indent />
                    {s.expenses.filter(e => pn(e.amount) > 0).map(e => (
                      <WRow key={e.id} label={e.label || 'Expense'} indent
                        amount={`(${fmtD(pn(e.amount))})`} color="#44403c" />
                    ))}
                    <WRow label="Net GCI After Expenses" bold borderTop
                      amount={fmtD(netAfterExp)} color={netAfterExp >= 0 ? '#1c1917' : '#dc2626'} />
                  </>
                )}

                {/* Referrals */}
                {totalReferrals > 0 && (
                  <>
                    <WRow label="Referral / Co-Broker Fees" sub="itemized" amount={`(${fmtD(totalReferrals)})`} color="#dc2626" indent />
                    {s.referrals.map((r, i) => {
                      const amt = referralAmounts[i];
                      if (!amt) return null;
                      const sub = r.type === 'pct' ? `${pn(r.value)}% of GCI` : 'flat';
                      return <WRow key={r.id} label={r.label || 'Referral'} sub={sub} indent amount={`(${fmtD(amt)})`} color="#44403c" />;
                    })}
                    <WRow label="Net GCI After Referrals" bold borderTop
                      amount={fmtD(netAfterRef)} color={netAfterRef >= 0 ? '#1c1917' : '#dc2626'} />
                  </>
                )}

                {/* Brokerage split */}
                {pn(s.advisorPct) < 100 && (
                  <>
                    <WRow label="Brokerage Retention" sub={`${(100 - pn(s.advisorPct)).toFixed(1)}%`} indent
                      amount={`(${fmtD(brokerRetain)})`} color="#44403c" />
                    <WRow label="Advisor Share" bold borderTop
                      sub={`${pn(s.advisorPct).toFixed(1)}% of net`}
                      amount={fmtD(advisorShare)} color="#1c1917" />
                  </>
                )}

                {/* Team splits */}
                {totalTeam > 0 && (
                  <>
                    <WRow label="Team Splits" sub="itemized" amount={`(${fmtD(totalTeam)})`} color="#dc2626" indent />
                    {s.teamSplits.map((t, i) => {
                      const amt = teamAmounts[i];
                      if (!amt) return null;
                      return <WRow key={t.id} label={t.label || 'Team Member'} sub={`${pn(t.pct)}%`} indent amount={`(${fmtD(amt)})`} color="#44403c" />;
                    })}
                  </>
                )}

                {/* Final advisor net */}
                <div style={{ borderTop: '2px solid #C4592F', paddingTop: 12, marginTop: 4,
                  display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#1c1917', fontFamily: 'system-ui, sans-serif' }}>
                    Advisor Net
                  </span>
                  <span style={{ ...mono, fontSize: 20, color: advisorNet > 0 ? '#C4592F' : '#dc2626' }}>
                    {fmtD(advisorNet)}
                  </span>
                </div>

                {/* Effective rate */}
                {salePrice > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                    <span style={{ fontSize: 11, color: '#44403c', fontFamily: 'system-ui, sans-serif' }}>Effective rate on sale price</span>
                    <span style={{ ...mono, fontSize: 11, color: '#44403c' }}>{fmtPct(effectivePct)}</span>
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
                  <tr style={{ borderBottom: '1px solid #e6dfd6' }}>
                    <th style={{ textAlign: 'left', padding: '4px 0 6px', color: '#44403c' }}>Price</th>
                    <th style={{ textAlign: 'right', padding: '4px 0 6px', color: '#44403c' }}>GCI</th>
                    <th style={{ textAlign: 'right', padding: '4px 0 6px', color: '#44403c' }}>Advisor Net</th>
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
                      <tr key={pctDelta} style={{ borderBottom: '1px solid #efe8e0',
                        background: isBase ? 'rgba(196,89,47,0.05)' : 'transparent' }}>
                        <td style={{ padding: '5px 0', color: isBase ? '#C4592F' : '#57534e', fontFamily: 'monospace' }}>
                          {fmtD(p)}{pctDelta !== 0 && <span style={{ color: '#44403c', fontSize: 10 }}> ({pctDelta > 0 ? '+' : ''}{pctDelta}%)</span>}
                        </td>
                        <td style={{ textAlign: 'right', padding: '5px 0', color: '#57534e', fontFamily: 'monospace' }}>{fmtD(g)}</td>
                        <td style={{ textAlign: 'right', padding: '5px 0', color: advNet >= 0 ? '#C4592F' : '#dc2626', fontFamily: 'monospace', fontWeight: 700 }}>
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
            style={{ background: 'transparent', border: '1px solid #e6dfd6', borderRadius: 6,
              color: '#44403c', fontSize: 12, padding: '8px 16px', cursor: 'pointer',
              fontFamily: 'system-ui, sans-serif', width: '100%' }}>
            Reset Calculator
          </button>

        </div>
      </div>
    </div>
  );
}
