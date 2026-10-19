import React, { useEffect, useMemo, useState } from 'react';
import {
  LEVERS,
  SCENARIO_NAMES,
  SCENARIO_PRESETS,
  clampLever,
  cloneLevers,
  compareScenarios,
  fmtCompact,
  fmtLever,
  fmtMoney,
  fmtMultiple,
  fmtSigned,
  isScenarioEdited,
  leverImpacts,
  normalizeProjections,
  project,
  projectionBaseline,
  rankedImpacts,
} from './projections.js';

const YEARS = ['Today', 'Year 1', 'Year 2', 'Year 3'];

function tone(n) {
  const v = Math.round(Number(n) || 0);
  if (v > 0) return 'proj-pos';
  if (v < 0) return 'proj-neg';
  return 'proj-muted';
}

function parseMoney(text) {
  const cleaned = String(text).replace(/[$,\s]/g, '').replace(/−/g, '-');
  if (cleaned === '' || cleaned === '-' || cleaned === '.' || cleaned === '-.') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function MoneyField({ value, label, onChange }) {
  const [text, setText] = useState(() => Math.round(Number(value) || 0).toLocaleString('en-US'));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(Math.round(Number(value) || 0).toLocaleString('en-US'));
  }, [value, focused]);
  return (
    <input
      className="input-field proj-money"
      type="text"
      inputMode="decimal"
      aria-label={label}
      autoComplete="off"
      value={text}
      onFocus={e => { setFocused(true); e.target.select(); }}
      onChange={e => setText(e.target.value)}
      onBlur={e => {
        setFocused(false);
        const n = parseMoney(e.target.value);
        if (n != null) onChange(n);
        else setText(Math.round(Number(value) || 0).toLocaleString('en-US'));
      }}
      onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
    />
  );
}

function sdeFormula(base) {
  const parts = ['Owner comp', 'Add-backs'];
  if (base.otherInc) parts.push('Other income');
  if (base.int) parts.push('Interest');
  if (base.taxes) parts.push('Taxes');
  if (base.dep) parts.push('Depreciation');
  if (base.amor) parts.push('Amortization');
  if (base.rentAB) parts.push('Rent adjustment');
  let text = `SDE = Revenue − Cost of goods − Operating expenses + ${parts.join(' + ')}  ·  Implied value = SDE × multiple`;
  if (base.basisKey === 'weighted') {
    text += '. The multiple is market price ÷ weighted SDE and stays constant. Earnings start from the most recent year.';
  } else if (base.multipleSource === 'default') {
    text += '. The multiple is 3.00× until a market price is set on Sources & Uses.';
  }
  return text;
}

function baselineKpis(base) {
  const kpis = [
    { k: 'Revenue', v: fmtMoney(base.rev), s: '' },
    { k: 'Cost of goods', v: fmtMoney(base.cogs), s: base.rev ? `${(base.cogs / base.rev * 100).toFixed(1)}% of revenue` : '' },
    { k: 'Operating expenses', v: fmtMoney(base.opx), s: base.rev ? `${(base.opx / base.rev * 100).toFixed(1)}% of revenue` : '' },
    { k: 'Owner comp', v: fmtMoney(base.oc), s: 'Added back' },
    { k: 'Add-backs', v: fmtMoney(base.ab), s: base.addBackNote || 'Added back' },
  ];
  if (base.otherInc) kpis.push({ k: 'Other income', v: fmtMoney(base.otherInc), s: 'Included in SDE' });
  if (base.int) kpis.push({ k: 'Interest', v: fmtMoney(base.int), s: 'Added back' });
  if (base.taxes) kpis.push({ k: 'Taxes', v: fmtMoney(base.taxes), s: 'Added back' });
  if (base.dep) kpis.push({ k: 'Depreciation', v: fmtMoney(base.dep), s: 'Added back' });
  if (base.amor) kpis.push({ k: 'Amortization', v: fmtMoney(base.amor), s: 'Added back' });
  if (base.rentAB) kpis.push({ k: 'Rent adjustment', v: fmtMoney(base.rentAB), s: 'Added back' });
  kpis.push(
    { k: 'Current SDE', v: fmtMoney(base.sde), s: base.rev ? `${(base.sde / base.rev * 100).toFixed(1)}% SDE margin` : '', hl: true },
    { k: 'Multiple in use', v: fmtMultiple(base.multiple), s: base.multipleSource === 'market' ? 'From Fair Market Value' : 'Default 3.0× SDE' },
    { k: 'Implied value', v: fmtMoney(base.sde * base.multiple), s: `SDE × ${Number(base.multiple).toFixed(2)}`, hl: true },
  );
  return kpis;
}

function ProjectionTable({ rows, multiple, showAdj }) {
  const line = (label, key, opts = {}) => (
    <tr key={key} className={opts.row || ''}>
      <th scope="row">{label}</th>
      {rows.map((row, i) => {
        const delta = row[key] - rows[0][key];
        return (
          <td key={YEARS[i]}>
            <span className="proj-num">{fmtMoney(row[key])}</span>
            {i > 0 && (
              <span className={`proj-delta ${opts.mute ? 'proj-muted' : tone(delta)}`}>{fmtSigned(delta)}</span>
            )}
          </td>
        );
      })}
    </tr>
  );
  return (
    <div className="proj-table-scroll">
      <table className="proj-table">
        <thead>
          <tr>
            <th scope="col">Metric</th>
            {YEARS.map(year => <th key={year} scope="col">{year}</th>)}
          </tr>
        </thead>
        <tbody>
          {line('Revenue', 'rev')}
          {line('Gross profit', 'gp')}
          {line('Operating expenses', 'opx', { mute: true })}
          {line('SDE', 'sde', { row: 'proj-row-sde' })}
          {showAdj && line('Adj. EBITDA (market owner comp)', 'adj')}
          {line(`Implied value (${fmtMultiple(multiple)})`, 'val', { row: 'proj-row-val' })}
        </tbody>
      </table>
    </div>
  );
}

function SdeChart({ projected, baseline }) {
  const W = 760;
  const H = 268;
  const L = 76;
  const R = 20;
  const T = 32;
  const B = 40;
  const labels = YEARS;
  const values = [...projected.map(r => r.sde), ...baseline.map(r => r.sde)];
  const minRaw = Math.min(0, ...values);
  const maxRaw = Math.max(0, ...values, 1);
  const rough = Math.max(maxRaw, 1) * 1.18;
  const step = Math.pow(10, Math.floor(Math.log10(rough / 4)));
  const tick = Math.max(step, Math.ceil((rough / 4) / step) * step);
  const top = tick * 4;
  const minV = minRaw < 0 ? minRaw * 1.12 : 0;
  const domain = (top - minV) || 1;
  const iw = W - L - R;
  const ih = H - T - B;
  const yOf = v => T + ih * (1 - (v - minV) / domain);
  const zeroY = yOf(0);
  const gw = iw / 4;
  const bw = Math.min(48, gw * 0.28);
  const grid = [];
  for (let i = 0; i <= 4; i++) {
    const v = minV < 0 && i === 0 ? minV : (minV < 0 ? minV + (top - minV) * (i / 4) : tick * i);
    grid.push(v);
  }
  return (
    <svg className="proj-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Baseline SDE compared with projected SDE for today and the next three years">
      {grid.map((v, i) => {
        const y = yOf(minV < 0 ? v : Math.min(v, top));
        return (
          <g key={i}>
            <line x1={L} x2={W - R} y1={y} y2={y} stroke="#e6dfd6" strokeDasharray={i === 0 ? undefined : '3 3'} />
            <text x={L - 12} y={y + 4} textAnchor="end" fontSize="11" fill="#57534e">{v === 0 ? '$0' : fmtCompact(v)}</text>
          </g>
        );
      })}
      {projected.map((row, i) => {
        const baseRow = baseline[i];
        const cx = L + gw * i + gw / 2;
        const hb = Math.max(0, zeroY - yOf(Math.max(0, baseRow.sde)));
        const hp = Math.max(0, zeroY - yOf(Math.max(0, row.sde)));
        const yb = zeroY - hb;
        const yp = zeroY - hp;
        return (
          <g key={labels[i]}>
            <rect x={cx - bw - 3} y={yb} width={bw} height={hb} rx="4" fill="#d6cec5" />
            <rect x={cx + 3} y={yp} width={bw} height={hp} rx="4" fill="#C4592F" />
            <text x={cx + 3 + bw / 2} y={Math.max(14, yp - 8)} textAnchor="middle" fontSize="11" fontWeight="700" fill="#9A4022">{fmtCompact(row.sde)}</text>
            <text x={cx} y={H - 14} textAnchor="middle" fontSize="12" fill="#44403c">{labels[i]}</text>
          </g>
        );
      })}
    </svg>
  );
}

function SellerSheet({ state, base, view, rows, edited, impacts }) {
  const onLevers = LEVERS.filter(lever => view.levers[lever.id].on);
  const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  return (
    <section className="proj-seller-sheet" aria-hidden="true">
      <div className="proj-seller-kicker">QSI™ Market Price Analyzer · Seller view</div>
      <h1 className="proj-seller-title">{state.dealName?.trim() || 'Projections'}</h1>
      <p className="proj-seller-meta">
        {state.advisorName?.trim() ? `Prepared by ${state.advisorName.trim()} · ` : ''}
        {view.scenario} scenario{edited ? ' (edited)' : ''} · {today}
      </p>
      <p className="proj-seller-lead">
        Illustrative operating changes over three years, starting from FY {base.year}, the most recent year on the income statement.
        Seller&apos;s discretionary earnings use the analyzer&apos;s SDE. The {fmtMultiple(base.multiple)} multiple is held constant.
      </p>
      <h2>Baseline</h2>
      <table className="proj-seller-table">
        <tbody>
          <tr><th scope="row">Revenue</th><td>{fmtMoney(base.rev)}</td><th scope="row">SDE</th><td>{fmtMoney(base.sde)}</td></tr>
          <tr><th scope="row">Multiple</th><td>{fmtMultiple(base.multiple)}</td><th scope="row">Implied value</th><td>{fmtMoney(base.sde * base.multiple)}</td></tr>
        </tbody>
      </table>
      <h2>Three-year projection</h2>
      <table className="proj-seller-table">
        <thead>
          <tr>
            <th scope="col">Metric</th>
            {YEARS.map(year => <th key={year} scope="col">{year}</th>)}
          </tr>
        </thead>
        <tbody>
          {[['Revenue', 'rev'], ['SDE', 'sde'], [`Implied value (${fmtMultiple(base.multiple)})`, 'val']].map(([label, key]) => (
            <tr key={key}>
              <th scope="row">{label}</th>
              {rows.map((row, i) => <td key={YEARS[i]}>{fmtMoney(row[key])}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      <h2>Assumptions included · {view.scenario}{edited ? ' (edited)' : ''}</h2>
      {onLevers.length ? (
        <ul className="proj-seller-list">
          {onLevers.map(lever => {
            const impact = impacts.find(item => item.id === lever.id);
            return (
              <li key={lever.id}>
                <span>{lever.name}: {fmtLever(lever.id, view.levers[lever.id].value)}</span>
                <span>{lever.id === 'ownerComp' ? 'SDE-neutral' : `Year 3 SDE ${fmtSigned(impact?.delta || 0)}`}</span>
              </li>
            );
          })}
        </ul>
      ) : <p className="proj-seller-lead">No levers are turned on. The projection stays at the baseline.</p>}
      <p className="proj-seller-disclaimer">
        <strong>Illustrative only.</strong> These projections are hypothetical examples based on the assumptions shown. They are not a forecast, appraisal, or guarantee of future results or sale price. Actual results depend on market conditions, execution, and buyer and lender review. The multiple is held constant across years.
      </p>
    </section>
  );
}

export default function ProjectionsTab({ state, set, onSave }) {
  const view = useMemo(() => normalizeProjections(state.projections), [state.projections]);
  const base = useMemo(() => projectionBaseline(state), [state]);
  const edited = isScenarioEdited(view);
  const [compareOpen, setCompareOpen] = useState(false);
  const [note, setNote] = useState('');
  const [saveTick, setSaveTick] = useState(0);

  useEffect(() => {
    if (!saveTick) return undefined;
    let cancelled = false;
    (async () => {
      const named = String(state.dealName || '').trim() && String(state.advisorName || '').trim();
      if (!named) {
        if (!cancelled) setNote('Add a deal name and advisor to sync this scenario.');
        return;
      }
      try {
        await onSave?.();
        if (!cancelled) setNote('Scenario saved with this deal.');
      } catch {
        if (!cancelled) setNote('Could not sync. The scenario is still stored on this deal.');
      }
    })();
    return () => { cancelled = true; };
  }, [saveTick]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectScenario = name => {
    setNote('');
    setCompareOpen(false);
    set(prev => ({
      ...prev,
      projections: { scenario: name, levers: cloneLevers(SCENARIO_PRESETS[name]) },
    }));
  };

  const patchLever = (id, patch) => {
    setNote('');
    set(prev => {
      const current = normalizeProjections(prev.projections);
      const setting = current.levers[id];
      const value = patch.value === undefined ? setting.value : clampLever(id, patch.value);
      const on = patch.on === undefined ? setting.on : !!patch.on;
      return {
        ...prev,
        projections: {
          scenario: current.scenario,
          levers: { ...current.levers, [id]: { on, value } },
        },
      };
    });
  };

  const saveScenario = () => {
    set(prev => {
      const current = normalizeProjections(prev.projections);
      return {
        ...prev,
        projections: { scenario: current.scenario, levers: cloneLevers(current.levers) },
      };
    });
    setNote('Saving scenario…');
    setSaveTick(tick => tick + 1);
  };

  const rows = base ? project(base, view.levers) : [];
  const quiet = base ? project(base, Object.fromEntries(LEVERS.map(lever => [lever.id, { on: false, value: 0 }]))) : [];
  const impacts = base ? leverImpacts(base, view.levers) : [];
  const ranked = base ? rankedImpacts(base, view.levers) : [];
  const y3 = rows[3];
  const maxAbs = Math.max(1, ...ranked.map(item => Math.abs(item.delta)));
  const totalDelta = y3 ? y3.sde - base.sde : 0;
  const dealLabel = state.dealName?.trim() || 'Untitled deal';

  return (
    <div className="proj-root">
      <div className="proj-screen">
        <header className="proj-page-head">
          <div className="proj-page-copy">
            <div className="proj-eyebrow">{dealLabel}</div>
            <h1 className="proj-title">Projections</h1>
            <p className="proj-sub">Show the seller how specific operating tweaks could change SDE and value over the next three years, starting from the deal&apos;s most recent year.</p>
          </div>
          <div className="proj-actions">
            <button type="button" className="btn-dark" data-testid="proj-save" onClick={saveScenario}>Save scenario</button>
            <button type="button" className="btn-ghost" data-testid="proj-compare" disabled={!base} onClick={() => setCompareOpen(true)}>Compare</button>
            <button type="button" className="btn-primary" data-testid="proj-export" disabled={!base} onClick={() => window.print()}>Export seller PDF</button>
            {note ? <p className="proj-save-note" role="status">{note}</p> : null}
          </div>
        </header>

        <div className="card proj-card proj-scen-card">
          <div className="proj-scen-bar">
            <div className="proj-seg" role="tablist" aria-label="Projection scenarios">
              {SCENARIO_NAMES.map(name => (
                <button
                  key={name}
                  type="button"
                  role="tab"
                  aria-selected={view.scenario === name}
                  data-testid={`proj-scenario-${name}`}
                  className={view.scenario === name ? 'is-active' : undefined}
                  onClick={() => selectScenario(name)}
                >
                  {name}
                  {view.scenario === name && edited ? <span className="proj-edited"> · edited</span> : null}
                </button>
              ))}
            </div>
            <p className="proj-scen-note">Scenario sets every lever at once. Adjust any lever to customize.</p>
          </div>
        </div>

        {!base ? (
          <section className="card proj-card">
            <div className="card-body">
              <h2 className="proj-empty-title">Add the most recent year on the Income Statement</h2>
              <p className="proj-sub">Projections start from that year&apos;s revenue and SDE, and from the fair-market multiple already used on this deal. Levers you set here are kept with the deal once you save the scenario.</p>
            </div>
          </section>
        ) : (
          <>
            <section className="card proj-card">
              <div className="card-header">
                <div className="card-title">Baseline · FY {base.year} (most recent year)</div>
                <div className="proj-card-note">From the Income Statement tab</div>
              </div>
              <div className="card-body">
                <div className="proj-kpis">
                  {baselineKpis(base).map(item => (
                    <div key={item.k} className={item.hl ? 'proj-kpi is-hl' : 'proj-kpi'}>
                      <div className="k">{item.k}</div>
                      <div className="v">{item.v}</div>
                      {item.s ? <div className="s">{item.s}</div> : null}
                    </div>
                  ))}
                </div>
                <p className="proj-formula">{sdeFormula(base)}</p>
              </div>
            </section>

            <div className="proj-grid">
              <section className="card proj-card">
                <div className="card-header">
                  <div className="card-title">Levers</div>
                  <div className="proj-card-note">Toggle to include</div>
                </div>
                <div className="card-body proj-levers">
                  {LEVERS.map(lever => {
                    const setting = view.levers[lever.id];
                    const impact = impacts.find(item => item.id === lever.id);
                    const help = typeof lever.help === 'function' ? lever.help(base) : lever.help;
                    const dollars = lever.unit.startsWith('$');
                    return (
                      <div key={lever.id} className={setting.on ? 'proj-lever' : 'proj-lever is-off'} data-testid={`proj-lever-${lever.id}`}>
                        <div className="proj-lever-top">
                          <label className="proj-tog">
                            <input
                              type="checkbox"
                              checked={setting.on}
                              aria-label={`Include ${lever.name}`}
                              onChange={e => patchLever(lever.id, { on: e.target.checked })}
                            />
                            <span />
                          </label>
                          <div className="proj-lever-name">{lever.name}</div>
                          <div className="proj-lever-val">{fmtLever(lever.id, setting.value)}</div>
                        </div>
                        <p className="proj-lever-help">{help}</p>
                        <div className="proj-lever-ctrl">
                          <input
                            type="range"
                            min={lever.min}
                            max={lever.max}
                            step={lever.step}
                            value={setting.value}
                            aria-label={lever.name}
                            onChange={e => patchLever(lever.id, { value: e.target.value })}
                          />
                          {dollars ? (
                            <MoneyField
                              value={setting.value}
                              label={`${lever.name} amount`}
                              onChange={value => patchLever(lever.id, { value })}
                            />
                          ) : null}
                        </div>
                        <p className="proj-lever-impact">
                          {setting.on
                            ? <>Year 3 SDE <b className={tone(impact?.delta || 0)}>{fmtSigned(impact?.delta || 0)}</b></>
                            : 'Not included'}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </section>

              <div className="proj-stack">
                <div className="proj-heads">
                  <div className="proj-head-card">
                    <div className="k">Year 3 revenue</div>
                    <div className="v">{fmtCompact(y3.rev)}</div>
                    <div className={`d ${tone(y3.rev - base.rev)}`}>{fmtSigned(y3.rev - base.rev)} vs today</div>
                  </div>
                  <div className="proj-head-card" data-testid="proj-y3-sde">
                    <div className="k">Year 3 SDE</div>
                    <div className="v">{fmtCompact(y3.sde)}</div>
                    <div className={`d ${tone(totalDelta)}`}>
                      {fmtSigned(totalDelta)}{base.sde ? ` (${Math.round(totalDelta / base.sde * 100)}%)` : ''}
                    </div>
                  </div>
                  <div className="proj-head-card is-accent">
                    <div className="k">Year 3 implied value</div>
                    <div className="v">{fmtCompact(y3.val)}</div>
                    <div className={`d ${tone(y3.val - base.sde * base.multiple)}`}>{fmtSigned(y3.val - base.sde * base.multiple)} added value</div>
                  </div>
                </div>

                <section className="card proj-card">
                  <div className="card-header">
                    <div className="card-title">3-year projection</div>
                    <div className="proj-card-note">{view.scenario} scenario{edited ? ' (edited)' : ''}</div>
                  </div>
                  <div className="card-body">
                    <ProjectionTable rows={rows} multiple={base.multiple} showAdj={!!view.levers.ownerComp.on} />
                  </div>
                </section>

                <section className="card proj-card">
                  <div className="card-header">
                    <div className="card-title">SDE: baseline vs projected</div>
                    <div className="proj-legend">
                      <span><i className="is-base" />Baseline (no changes)</span>
                      <span><i className="is-proj" />With levers</span>
                    </div>
                  </div>
                  <div className="card-body">
                    <SdeChart projected={rows} baseline={quiet} />
                  </div>
                </section>

                <section className="card proj-card">
                  <div className="card-header">
                    <div className="card-title">Lever impact · Year 3</div>
                    <div className="proj-card-note">Ranked by SDE added. Value = SDE × multiple.</div>
                  </div>
                  <div className="card-body">
                    <div className="proj-imp-wrap">
                      <div className="proj-imp is-hdr">
                        <div>Lever</div>
                        <div />
                        <div className="r">SDE</div>
                        <div className="r">Value</div>
                      </div>
                      {ranked.map(item => (
                        <div key={item.id} className={item.on ? 'proj-imp' : 'proj-imp is-off'}>
                          <div>
                            {item.name}
                            {!item.on ? <span className="proj-tag">Off</span> : item.id === 'ownerComp' ? <span className="proj-tag">SDE-neutral</span> : null}
                          </div>
                          <div className="proj-bar-track">
                            <div
                              className="proj-bar"
                              style={{
                                width: `${Math.abs(item.delta) / maxAbs * 100}%`,
                                background: item.delta < 0 ? '#b91c1c' : '#C4592F',
                              }}
                            />
                          </div>
                          <div className={`r ${tone(item.delta)}`}>{fmtSigned(item.delta)}</div>
                          <div className={`r ${tone(item.delta)}`}>{fmtSigned(item.delta * base.multiple)}</div>
                        </div>
                      ))}
                      <div className="proj-imp is-total">
                        <div>Total vs today</div>
                        <div className="proj-total-note">Includes interaction between levers</div>
                        <div className={`r ${tone(totalDelta)}`}>{fmtSigned(totalDelta)}</div>
                        <div className={`r ${tone(totalDelta)}`}>{fmtSigned(totalDelta * base.multiple)}</div>
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>

            <p className="proj-disclaimer">
              <strong>Illustrative only.</strong> These projections are hypothetical examples based on the assumptions shown. They are not a forecast, appraisal, or guarantee of future results or sale price. Actual results depend on market conditions, execution, and buyer and lender review. The multiple is held constant across years.
            </p>
          </>
        )}

        {compareOpen && base && (
          <div className="proj-modal" role="presentation" onClick={() => setCompareOpen(false)}>
            <div
              className="card proj-card proj-modal-card"
              role="dialog"
              aria-modal="true"
              aria-labelledby="proj-compare-title"
              data-testid="proj-compare-dialog"
              onClick={e => e.stopPropagation()}
            >
              <div className="card-header">
                <div className="card-title" id="proj-compare-title">Compare scenarios · Year 3</div>
                <button type="button" className="btn-ghost" onClick={() => setCompareOpen(false)}>Close</button>
              </div>
              <div className="card-body">
                <div className="proj-table-scroll">
                  <table className="proj-table proj-compare-table">
                    <thead>
                      <tr>
                        <th scope="col">Metric</th>
                        {compareScenarios(base, view).map(col => (
                          <th key={col.name} scope="col" className={col.name === view.scenario ? 'is-current' : undefined}>
                            {col.name}{col.edited ? ' · edited' : ''}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        ['Year 3 revenue', 'rev'],
                        ['Year 3 SDE', 'sde'],
                        ['Year 3 value', 'val'],
                      ].map(([label, key]) => (
                        <tr key={key}>
                          <th scope="row">{label}</th>
                          {compareScenarios(base, view).map(col => (
                            <td key={col.name} className={col.name === view.scenario ? 'is-current' : undefined}>
                              <span className="proj-num">{fmtMoney(col[key])}</span>
                              <span className={`proj-delta ${tone(col[key] - (key === 'val' ? base.sde * base.multiple : base[key === 'rev' ? 'rev' : 'sde']))}`}>
                                {fmtSigned(col[key] - (key === 'val' ? base.sde * base.multiple : base[key === 'rev' ? 'rev' : 'sde']))}
                              </span>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="proj-scen-note">The open scenario includes your current lever edits. The other two columns use that scenario&apos;s preset.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {base ? <SellerSheet state={state} base={base} view={view} rows={rows} edited={edited} impacts={impacts} /> : null}
    </div>
  );
}
