import React, { useState, useEffect } from 'react';

const CALC_LS_KEY = 'dealteam_acqcalc_v2';

function loadCalcState() {
  try {
    const saved = localStorage.getItem(CALC_LS_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return null;
}

const fmtD = v => v == null ? '$—' : '$' + Math.round(v).toLocaleString();
const pn   = v => parseFloat(String(v).replace(/[^0-9.\-]/g,'')) || 0;

function NI({ value, onChange, style }) {
  return (
    <input
      type="text"
      className="input-field mono"
      value={value}
      onChange={e => onChange(e.target.value)}
      onBlur={e => onChange(pn(e.target.value) || value)}
      style={style}
    />
  );
}

const DEFAULT_CALC = {
  liquidity: 100000, sde: 0, dpPct: 10, carryPct: 0,
  carryRate: 0, carryTerm: 0, sbaRate: 10.75, sbaTerm: 10,
  multiple: 3.0, carryMode: 'standby', mode: 'liquidity',
};

export default function AcqCalcApp() {
  const [c, setC] = useState(() => ({ ...DEFAULT_CALC, ...(loadCalcState() || {}) }));

  // Persist to localStorage whenever inputs change
  useEffect(() => {
    localStorage.setItem(CALC_LS_KEY, JSON.stringify(c));
  }, [c]);

  const upd = (k, v) => setC(p => ({ ...p, [k]: v }));

  // Core calculations
  const dpFrac    = (c.dpPct || 10) / 100;
  const carryFrac = (c.carryPct || 0) / 100;
  const price     = c.mode === 'sde'
    ? (c.sde || 0) * (c.multiple || 3)
    : (c.liquidity || 0) / dpFrac;
  const sde       = c.mode === 'sde' ? (c.sde || 0) : price / (c.multiple || 3);
  const downAmt   = price * dpFrac;
  const sellerNote = price * carryFrac;
  const sbaLoanPct = Math.max(0, 100 - (c.dpPct || 10) - (c.carryPct || 0));
  const sbaLoan   = price * sbaLoanPct / 100;

  // SBA payment
  const r = (c.sbaRate || 10.75) / 100 / 12;
  const n = (c.sbaTerm || 10) * 12;
  const sbaMoPmt = r === 0 ? sbaLoan / n : sbaLoan * r * Math.pow(1 + r, n) / (Math.pow(1 + r, n) - 1);
  const sbaAnnual = sbaMoPmt * 12;

  // Seller carry payment
  let carryAnnual = 0;
  if (sellerNote > 0) {
    if (c.carryMode === 'standby') {
      carryAnnual = sellerNote * ((c.carryRate || 0) / 100);
    } else {
      const rc = (c.carryRate || 0) / 100 / 12;
      const nc = (c.carryTerm || 0) * 12;
      const cmo = rc === 0 ? sellerNote / nc : sellerNote * rc * Math.pow(1 + rc, nc) / (Math.pow(1 + rc, nc) - 1);
      carryAnnual = cmo * 12;
    }
  }

  const totalDS   = sbaAnnual + carryAnnual;
  const cfAfterDS = sde - totalDS;
  const cfPositive = cfAfterDS >= 0;

  // 5-year equity buildup
  const equityRows = [];
  let bal = sbaLoan;
  let cumPrin = 0;
  for (let y = 1; y <= 5; y++) {
    const balStart  = bal;
    const intPaid   = balStart * (c.sbaRate || 10.75) / 100 / 12 * 12;
    const principal = Math.max(0, sbaAnnual - intPaid);
    bal = Math.max(0, balStart - principal);
    cumPrin += principal;
    equityRows.push({ y, balStart, intPaid, principal, balEnd: bal, equity: downAmt + cumPrin });
  }

  const btnBase = {
    border: 'none', borderRadius: 5, padding: '7px 16px',
    fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.12s',
  };
  const modeBtn = (id, label) => (
    <button
      key={id}
      style={{ ...btnBase, background: c.mode === id ? '#2eb860' : '#1e2d45', color: c.mode === id ? '#fff' : '#94a3b8' }}
      onClick={() => upd('mode', id)}
    >{label}</button>
  );
  const carryBtn = (id, label) => (
    <button
      key={id}
      style={{ ...btnBase, background: c.carryMode === id ? '#2eb860' : '#1e2d45', color: c.carryMode === id ? '#fff' : '#94a3b8', padding: '5px 12px', fontSize: 12 }}
      onClick={() => upd('carryMode', id)}
    >{label}</button>
  );

  return (
    <div style={{ padding: 28, maxWidth: 1100, color: '#e2e8f0' }}>
      {/* Header */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>Acquisition Calculator</div>
          <div style={{ fontSize: 13, color: '#64748b' }}>
            SBA 7(a) — {c.sbaTerm}yr @ {c.sbaRate}% — {c.dpPct}% buyer down / {c.carryPct}% seller carry
          </div>
        </div>
        <button
          onClick={() => { if (confirm('Reset calculator to defaults?')) setC({ ...DEFAULT_CALC }); }}
          style={{ background: 'transparent', border: '1px solid #1e2d45', borderRadius: 5, color: '#64748b', fontSize: 11, padding: '5px 11px', cursor: 'pointer', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = '#ef4444'; e.currentTarget.style.color = '#ef4444'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = '#1e2d45'; e.currentTarget.style.color = '#64748b'; }}
        >
          Reset
        </button>
      </div>

      {/* Row 1 — Liquidity / SDE input + mode toggle */}
      <div className="card p-5" style={{ marginBottom: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 24, alignItems: 'start' }}>
          <div>
            {c.mode === 'liquidity' ? (
              <>
                <span className="lbl">Buyer Liquidity</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <input
                    type="text"
                    className="input-field mono"
                    style={{ width: 160, fontSize: 16, fontWeight: 600 }}
                    value={c.liquidity}
                    onChange={e => upd('liquidity', pn(e.target.value) || 0)}
                  />
                  <input
                    type="range" min={25000} max={500000} step={5000}
                    value={c.liquidity}
                    onChange={e => upd('liquidity', +e.target.value)}
                    style={{ flex: 1, accentColor: '#2eb860' }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748b', marginTop: 4 }}>
                  <span>$25k</span><span>$500k</span>
                </div>
              </>
            ) : (
              <>
                <span className="lbl">Annual SDE (Cash Flow)</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <input
                    type="text"
                    className="input-field mono"
                    style={{ width: 200, fontSize: 16, fontWeight: 600 }}
                    value={c.sde}
                    onChange={e => upd('sde', pn(e.target.value) || 0)}
                    placeholder="Enter SDE..."
                  />
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    Price = SDE × {(c.multiple || 3).toFixed(1)}× = {fmtD(price)}
                  </div>
                </div>
              </>
            )}
          </div>
          <div>
            <span className="lbl">Calculation Mode</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {modeBtn('liquidity', '💰 Liquidity')}
              {modeBtn('sde', '📊 SDE')}
            </div>
          </div>
        </div>
      </div>

      {/* Row 2 — Parameters */}
      <div className="card p-5" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: '#2eb860', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>Deal Parameters</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 14 }}>
          <div><span className="lbl">Buyer Down %</span><NI value={c.dpPct} onChange={v => upd('dpPct', v)} /></div>
          <div><span className="lbl">Seller Carry %</span><NI value={c.carryPct} onChange={v => upd('carryPct', v)} /></div>
          <div><span className="lbl">Carry Rate %</span><NI value={c.carryRate} onChange={v => upd('carryRate', v)} /></div>
          <div><span className="lbl">Carry Term (yr)</span><NI value={c.carryTerm} onChange={v => upd('carryTerm', v)} /></div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, alignItems: 'end' }}>
          <div><span className="lbl">SBA Rate %</span><NI value={c.sbaRate} onChange={v => upd('sbaRate', v)} /></div>
          <div><span className="lbl">SBA Term (yr)</span><NI value={c.sbaTerm} onChange={v => upd('sbaTerm', v)} /></div>
          <div><span className="lbl">SDE Multiple</span><NI value={c.multiple} onChange={v => upd('multiple', v)} /></div>
          <div>
            <span className="lbl">Seller Carry Type</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {carryBtn('standby', 'Standby')}
              {carryBtn('amortizing', 'Amortizing')}
            </div>
          </div>
        </div>
      </div>

      {/* Row 3 — Big metric cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        <div className="card p-5">
          <div className="lbl" style={{ marginBottom: 6 }}>Business Purchase Price</div>
          <div className="calc-field mono" style={{ fontSize: 24, fontWeight: 800, textAlign: 'right', marginBottom: 6 }}>{fmtD(price)}</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>Based on {c.dpPct}% buyer equity injection</div>
        </div>
        <div className="card p-5" style={{ borderColor: '#2eb860' }}>
          <div className="lbl" style={{ marginBottom: 6 }}>Annual Cash Flow (SDE)</div>
          <div className="calc-field mono" style={{ fontSize: 24, fontWeight: 800, textAlign: 'right', marginBottom: 6, color: '#2eb860' }}>{fmtD(sde)}</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>Valued at {(c.multiple || 3).toFixed(1)}× cash flow</div>
        </div>
      </div>

      {/* Row 4 — Four metric tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
        {/* SBA Loan */}
        <div className="card p-4">
          <div className="lbl" style={{ marginBottom: 3 }}>SBA Loan ({sbaLoanPct}%)</div>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>{c.sbaRate}% / {c.sbaTerm}yr — {fmtD(sbaMoPmt)}/mo</div>
          <div className="calc-field mono" style={{ fontSize: 18, fontWeight: 700, textAlign: 'right' }}>{fmtD(sbaLoan)}</div>
        </div>
        {/* Seller Note */}
        <div className="card p-4">
          <div className="lbl" style={{ marginBottom: 3 }}>Seller Note ({c.carryPct}%)</div>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>
            {c.carryMode === 'standby' ? 'Interest-only standby per SBA' : `Amortizing ${c.carryTerm}yr @ ${c.carryRate}%`}
          </div>
          <div className="calc-field mono" style={{ fontSize: 18, fontWeight: 700, textAlign: 'right' }}>{fmtD(sellerNote)}</div>
        </div>
        {/* Annual Debt Service */}
        <div className="card p-4">
          <div className="lbl" style={{ marginBottom: 3 }}>Annual Debt Service</div>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>SBA {fmtD(sbaAnnual)} + Carry {fmtD(carryAnnual)}</div>
          <div className="calc-field mono" style={{ fontSize: 18, fontWeight: 700, textAlign: 'right' }}>{fmtD(totalDS)}</div>
        </div>
        {/* Cash Flow After Debt */}
        <div className="card p-4" style={{ borderColor: cfPositive ? '#2eb860' : '#ef4444' }}>
          <div className="lbl" style={{ marginBottom: 3 }}>Cash Flow After Debt Service</div>
          <div style={{ fontSize: 11, color: '#64748b', marginBottom: 6 }}>&nbsp;</div>
          <div className="calc-field mono" style={{
            fontSize: 18, fontWeight: 700, textAlign: 'right',
            color: cfPositive ? '#2eb860' : '#ef4444',
            background: cfPositive ? undefined : '#1a0505',
            borderColor: cfPositive ? undefined : '#5e1a1a',
          }}>{fmtD(cfAfterDS)}</div>
        </div>
      </div>

      {/* Row 5 — Equity buildup table */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #1e2d45' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#2eb860', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            5-Year Equity Buildup — SBA Loan Amortization
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#0a1628' }}>
                {['Year', 'Loan Bal Start', 'Interest Paid', 'Principal Paid', 'Loan Bal End', 'Total Equity Built'].map(h => (
                  <th key={h} style={{ padding: '9px 14px', textAlign: 'right', fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap', borderBottom: '1px solid #1e2d45' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {equityRows.map((row, i) => (
                <tr key={row.y} style={{ background: i % 2 === 0 ? '#161b27' : '#0d1117' }}>
                  <td style={{ padding: '9px 14px', color: '#e2e8f0', fontWeight: 600, textAlign: 'right' }}>{row.y}</td>
                  <td style={{ padding: '9px 14px', color: '#e2e8f0', fontFamily: 'monospace', textAlign: 'right' }}>{fmtD(row.balStart)}</td>
                  <td style={{ padding: '9px 14px', color: '#94a3b8', fontFamily: 'monospace', textAlign: 'right' }}>{fmtD(row.intPaid)}</td>
                  <td style={{ padding: '9px 14px', color: '#2eb860', fontFamily: 'monospace', textAlign: 'right' }}>{fmtD(row.principal)}</td>
                  <td style={{ padding: '9px 14px', color: '#e2e8f0', fontFamily: 'monospace', textAlign: 'right' }}>{fmtD(row.balEnd)}</td>
                  <td style={{ padding: '9px 14px', color: '#2eb860', fontFamily: 'monospace', fontWeight: 700, textAlign: 'right' }}>{fmtD(row.equity)}</td>
                </tr>
              ))}
              <tr style={{ background: '#0a1628', borderTop: '1px solid #1e2d45' }}>
                <td colSpan={6} style={{ padding: '9px 14px', fontSize: 11, color: '#64748b', fontStyle: 'italic' }}>
                  Illustrative only. Actual SBA terms, multiples, and cash flow vary by deal. Equity buildup includes buyer down payment of {fmtD(downAmt)}.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
