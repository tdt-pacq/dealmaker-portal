import React from 'react';
import { LOGO_SRC } from '../../assets/logo';
import { fmtMoney, fmtParen, fmtPct } from '@shared/dealReport.mjs';
import './dealReport.css';

const neg = v => typeof v === 'string' && (v.startsWith('-') || v.startsWith('('));

function Table({ columns, rows }) {
  return (
    <div className="deal-report-table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map(col => <th key={col}>{col}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.label} className={row.isSde ? 'deal-report-sde' : undefined}>
              <td>{row.label}</td>
              {row.cells.map((cell, i) => (
                <td key={i} className={neg(cell) ? 'num-neg' : undefined}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Bars({ chart }) {
  const points = chart.points || [];
  const W = 420;
  const H = 220;
  const pad = { t: 16, r: 10, b: 28, l: 46 };
  const vals = points.map(p => p.value);
  const max = Math.max(...vals, 0);
  const min = Math.min(...vals, 0);
  const range = max - min || 1;
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const yAt = v => pad.t + innerH * (1 - (v - min) / range);
  const gap = points.length ? innerW / points.length : innerW;
  const bw = Math.max(10, gap * 0.55);
  const ticks = [0, 1, 2, 3].map(t => min + (range / 3) * t);
  const tick = v => chart.format === 'pct'
    ? `${v.toFixed(0)}%`
    : (Math.abs(v) >= 1000000 ? `$${(v / 1000000).toFixed(1)}M` : Math.abs(v) >= 1000 ? `$${Math.round(v / 1000)}k` : `$${Math.round(v)}`);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={chart.title}>
      {ticks.map(v => (
        <g key={v}>
          <line x1={pad.l} x2={pad.l + innerW} y1={yAt(v)} y2={yAt(v)} stroke="#e7e5e4" />
          <text x={pad.l - 4} y={yAt(v) + 3} textAnchor="end" fontSize="11" fill="#57534e">{tick(v)}</text>
        </g>
      ))}
      {points.map((p, i) => {
        const x = pad.l + gap * i + (gap - bw) / 2;
        const y = yAt(p.value);
        const zero = yAt(0);
        const top = Math.min(y, zero);
        const h = Math.max(Math.abs(y - zero), 1);
        return (
          <g key={p.label}>
            <rect x={x} y={top} width={bw} height={h} rx="2" fill={chart.color || '#C4592F'} />
            <text x={pad.l + gap * i + gap / 2} y={H - 8} textAnchor="middle" fontSize="12" fill="#57534e">{p.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

function Waterfall({ steps }) {
  let running = 0;
  const bars = steps.map(s => {
    let lo;
    let hi;
    if (s.type === 'start') { lo = 0; hi = s.value; running = s.value; }
    else if (s.type === 'step') {
      if (s.value >= 0) { lo = running; hi = running + s.value; }
      else { hi = running; lo = running + s.value; }
      running += s.value;
    } else { lo = 0; hi = running; }
    return { ...s, lo: Math.min(lo, hi), hi: Math.max(lo, hi), running };
  });
  const W = 860;
  const H = 230;
  const pad = { t: 18, r: 8, b: 36, l: 48 };
  const max = Math.max(...bars.map(b => b.hi), 1);
  const min = Math.min(...bars.map(b => b.lo), 0);
  const range = max - min || 1;
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const yAt = v => pad.t + innerH * (1 - (v - min) / range);
  const gap = innerW / bars.length;
  const bw = Math.max(12, gap * 0.6);
  const color = b => b.label === 'SDE' ? '#C4592F' : b.label === 'EBITDA' ? '#6d28d9' : (b.value < 0 ? '#b91c1c' : '#1d4ed8');
  const tick = v => {
    const a = Math.abs(v);
    const sign = v < 0 ? '-' : '';
    if (a >= 1000000) return `${sign}$${(a / 1000000).toFixed(1)}M`;
    if (a >= 1000) return `${sign}$${Math.round(a / 1000)}k`;
    return `${sign}$${Math.round(a)}`;
  };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Revenue to SDE">
      {bars.map((b, i) => {
        const x = pad.l + gap * i + (gap - bw) / 2;
        const top = yAt(b.hi);
        const bot = yAt(b.lo);
        return (
          <g key={b.label}>
            <rect x={x} y={top} width={bw} height={Math.max(bot - top, 1)} rx="2" fill={color(b)} />
            <text x={x + bw / 2} y={top - 4} textAnchor="middle" fontSize="11" fill={color(b)}>{tick(b.type === 'step' ? b.value : b.running)}</text>
            <text x={pad.l + gap * i + gap / 2} y={H - 10} textAnchor="middle" fontSize="11" fill="#57534e">{b.label}</text>
          </g>
        );
      })}
    </svg>
  );
}

function Section({ section, children }) {
  return (
    <section className="deal-report-section">
      <header className="deal-report-h">
        <p className="deal-report-kicker">Section {section.number}</p>
        <h2>{section.title}</h2>
      </header>
      {children}
    </section>
  );
}

function Kv({ label, value }) {
  return (
    <div className="deal-report-kv">
      <span>{label}</span>
      <span className={neg(value) ? 'num-neg' : undefined}>{value}</span>
    </div>
  );
}

export default function DealReportView({ report, onDownload, downloading, downloadError }) {
  const section = id => report.sections.find(s => s.id === id);
  const spread = section('spread');
  const fmv = section('fmv');
  const industry = section('industry');
  const dscr = section('dscr');
  const seller = section('seller');
  const roi = section('roi');
  const sources = section('sources');
  const proceeds = section('proceeds');
  const nlb = section('nlb');
  const narrative = section('narrative');
  const s = report.sources;
  const p = report.proceeds;
  const n = report.nlb;
  const r = report.roi;

  return (
    <article className="deal-report">
      <div className="deal-report-toolbar">
        <div>
          <p>
            Download PDF builds the letter-size report in the app, with page numbers and without the browser’s date, title, or web address.
            The print dialog adds those itself. This page cannot turn them off.
          </p>
          {downloadError && <p className="deal-report-error">The PDF could not be built. The figures on this page are unchanged.</p>}
        </div>
        <div className="deal-report-actions">
          <button type="button" className="deal-report-download" onClick={onDownload} disabled={downloading}>
            {downloading ? 'Building PDF…' : 'Download PDF'}
          </button>
          <button type="button" className="deal-report-print" onClick={() => window.print()}>Print</button>
        </div>
      </div>

      <header className="deal-report-mast">
        <div className="deal-report-brand">
          <img className="deal-report-phoenix" src="/phoenix-icon.svg" alt="" />
          <span className="deal-report-wordmark" role="img" aria-label="Peterson Acquisitions">
            <img src={LOGO_SRC} alt="" />
          </span>
        </div>
        <p className="deal-report-kicker">Confidential · QSI™ Market Price Analyzer</p>
        <h1>{report.meta.dealName}</h1>
        <p className="deal-report-meta">
          {report.meta.advisorName ? `Prepared by ${report.meta.advisorName} · ` : ''}
          {report.meta.prepared}
        </p>
        <hr className="deal-report-rule" />
        <p>{report.disclaimer}</p>
        {report.summary.length > 0 && (
          <div className="deal-report-summary">
            {report.summary.map(fig => (
              <div className="deal-report-fig" key={fig.label}>
                <span>{fig.label}</span>
                <strong>{fig.value}</strong>
                {fig.note ? <small>{fig.note}</small> : null}
              </div>
            ))}
          </div>
        )}
      </header>

      {spread && (
        <Section section={spread}>
          <p>Seller’s discretionary earnings start from net operating income and add back interest, taxes, depreciation, amortization, owner’s compensation, and legitimate add-backs. {report.salaryNote}</p>
          {report.spread.groups.map((group, idx) => (
            <div key={idx}>
              {report.spread.groups.length > 1 && (
                <div className="deal-report-table-title">{idx === 0 ? 'Historical years' : 'Historical years, continued'}</div>
              )}
              <Table columns={['Metric', ...group.columns]} rows={group.rows} />
            </div>
          ))}
          {report.spread.ytd && (
            <>
              <div className="deal-report-table-title">Year to date and annualized</div>
              <Table columns={['Metric', ...report.spread.ytd.columns]} rows={report.spread.ytd.rows} />
            </>
          )}
          <p className="deal-report-note">
            Weighted average SDE {fmtMoney(report.sde.rawWeighted)}
            {' · '}Most recent SDE {fmtMoney(report.sde.rawRecent)}
            {report.spread.ytd?.annualizedSde != null ? ` · Annualized YTD SDE ${fmtMoney(report.spread.ytd.annualizedSde)} (before buyer salary)` : ''}
            {' · '}Valuation basis: {report.sde.basisName} {fmtMoney(report.sde.rawBasis)}
          </p>
        </Section>
      )}

      {fmv && (
        <Section section={fmv}>
          <p>Multiples apply to {report.basisName.toLowerCase()} SDE of {fmtMoney(report.sde.rawBasis)}, before buyer salary. The selected market price is the figure carried into Sources &amp; Uses.</p>
          <div className="deal-report-cards">
            {report.multiples.map(card => (
              <div key={card.multiple} className={card.selected ? 'deal-report-card is-selected' : 'deal-report-card'}>
                <span>{card.multiple.toFixed(1)}× SDE</span>
                <b>{fmtMoney(card.price)}</b>
                {card.selected && <small>Selected</small>}
              </div>
            ))}
          </div>
          {report.marketPrice > 0 && (
            <p>
              Market price {fmtMoney(report.marketPrice)}{report.marketMultiple != null ? ` (${report.marketMultiple.toFixed(2)}× ${report.basisName.toLowerCase()} SDE)` : ''}.
              {report.marketPriceSource === 'auto' ? ' Assumed from gross SDE × 3 because no market price is saved.' : ''}
            </p>
          )}
          {report.marketPriceDrift && (
            <p>
              Saved market price {fmtMoney(report.marketPriceDrift.stored)} is {report.marketPriceDrift.multiple.toFixed(2)}× SDE ({fmtMoney(report.marketPriceDrift.sde)}). It does not match a listed multiple, and it was left as entered.
            </p>
          )}
        </Section>
      )}

      {industry && (
        <Section section={industry}>
          {report.industry.empty ? (
            <p>No industry benchmarks are imported. This section stays blank rather than filling in comparison figures.</p>
          ) : (
            <>
              <p>{[report.industry.name, report.industry.naics ? `NAICS ${report.industry.naics}` : '', report.industry.citation].filter(Boolean).join(' · ')}</p>
              {Array.from({ length: Math.ceil(Math.max(report.industry.years.length, 1) / 3) }, (_, chunk) => {
                const slice = report.industry.years.slice(chunk * 3, chunk * 3 + 3);
                return (
                  <Table
                    key={chunk}
                    columns={['Metric', 'Industry', ...slice.map(y => String(y.year))]}
                    rows={[
                      {
                        label: 'Gross margin',
                        cells: [
                          report.industry.grossBenchmark == null ? '—' : `${Number(report.industry.grossBenchmark).toFixed(1)}%`,
                          ...slice.map(y => y.grossMargin == null ? '—' : `${y.grossMargin.toFixed(1)}%${report.industry.grossBenchmark == null ? '' : (y.grossMargin >= report.industry.grossBenchmark ? ' up' : ' down')}`),
                        ],
                      },
                      { label: 'EBITDA', cells: ['—', ...slice.map(y => y.ebitda == null ? '—' : `${y.ebitda.toFixed(1)}%`)] },
                      { label: 'Net income', cells: ['—', ...slice.map(y => y.net == null ? '—' : `${y.net.toFixed(1)}%`)] },
                    ]}
                  />
                );
              })}
              <Table
                columns={['Multiple', 'Industry', 'This deal', 'Implied value']}
                rows={[
                  {
                    label: `MVIC/SDE (${report.industry.tierLabel})`,
                    cells: [
                      report.industry.tierMult > 0 ? `${report.industry.tierMult.toFixed(2)}×` : '—',
                      report.industry.dealMult == null ? '—' : `${report.industry.dealMult.toFixed(2)}×`,
                      report.industry.tierMult > 0 ? fmtMoney(report.industry.recSde * report.industry.tierMult) : '—',
                    ],
                  },
                  {
                    label: 'Rules of thumb — × SDE',
                    cells: [
                      report.industry.ruleSde ? `${report.industry.ruleSde.toFixed(1)}×` : '—',
                      report.industry.dealMult == null ? '—' : `${report.industry.dealMult.toFixed(2)}×`,
                      report.industry.ruleSde ? fmtMoney(report.industry.recSde * report.industry.ruleSde) : '—',
                    ],
                  },
                  {
                    label: 'Rules of thumb — % of revenue',
                    cells: [
                      report.industry.ruleRevenue ? `${report.industry.ruleRevenue}%` : '—',
                      report.industry.dealRevPct == null ? '—' : `${report.industry.dealRevPct.toFixed(1)}%`,
                      report.industry.ruleRevenue ? fmtMoney(report.industry.recRev * report.industry.ruleRevenue / 100) : '—',
                    ],
                  },
                ]}
              />
              {report.industry.marketPrice > 0 && <p>Market price {fmtMoney(report.industry.marketPrice)}.</p>}
            </>
          )}
        </Section>
      )}

      {dscr && (
        <Section section={dscr}>
          {report.dscr.mode === 'deal' ? (
            <p>
              Annual debt service is the payment on the Sources &amp; Uses loan of {fmtMoney(report.dscr.deal.loanAmount)} ({report.dscr.deal.detail}).
              Each year&apos;s SDE is before buyer salary. Strong means at least {(report.dscr.rows[0]?.strongAt ?? report.dscr.minimum + 0.25).toFixed(2)}×.
              The required minimum is {report.dscr.minimum.toFixed(2)}×.
            </p>
          ) : !report.dscr.sizing.usable ? (
            <p>No market price is selected, and SDE after buyer salary is not positive, so no debt service is calculated. Required minimum {report.dscr.minimum.toFixed(2)}×.</p>
          ) : (
            <p>No market price is selected, so this table uses only the 3× after-salary sizing reference. It is not a financed Sources &amp; Uses loan. Required minimum {report.dscr.minimum.toFixed(2)}×.</p>
          )}
          <Table
            columns={['Year', 'SDE (before salary)', 'Annual debt service', 'DSCR', 'Assessment']}
            rows={report.dscr.rows.map(row => ({
              label: row.year,
              cells: [fmtMoney(row.sde), row.annualDebtService > 0 ? fmtMoney(row.annualDebtService) : '—', row.ratio == null ? '—' : row.ratio.toFixed(2), row.assessment],
            }))}
          />
          <p className="deal-report-note">{report.dscr.sizing.note}</p>
          {report.dscr.roiContrast && <p className="deal-report-note">{report.dscr.roiContrast}</p>}
        </Section>
      )}

      {seller && report.seller && (
        <Section section={seller}>
          <p>
            Compares prices using SDE of {fmtMoney(report.seller.rawBasis)} before the {fmtMoney(report.seller.buyerSalary)} buyer salary.
            Payments here are on price × (1 − down payment), not the fee-financed Sources &amp; Uses loan.
            Contingency is {report.seller.contingencyPct}% of SDE.
          </p>
          <Table
            columns={['', ...report.seller.columns.map(c => c.label)]}
            rows={[
              ['Price', c => c.price == null ? '—' : fmtMoney(c.price)],
              ['Down payment', c => c.price == null ? '—' : fmtMoney(c.down)],
              ['Loan before fees', c => c.price == null ? '—' : fmtMoney(c.loan)],
              ['Annual debt service', c => c.price == null ? '—' : fmtMoney(c.annual)],
              ['Raw DSCR', c => c.rawDscr == null ? '—' : c.rawDscr.toFixed(2)],
              ['DSCR after salary', c => c.adjDscr == null ? '—' : c.adjDscr.toFixed(2)],
              ['Cash left', c => c.price == null ? '—' : fmtMoney(c.cashLeft)],
            ].map(([label, pick]) => ({ label, cells: report.seller.columns.map(pick) }))}
          />
        </Section>
      )}

      {roi && r && (
        <Section section={roi}>
          <p>
            Cash flow uses SDE after buyer salary ({fmtMoney(r.sde)}), not the {fmtMoney(report.sde.rawBasis)} valuation SDE.
            The loan payment is on {fmtMoney(r.sbaLoan)} at {fmtPct(r.rate, 2)} / {r.years} years.
            Guarantee fee and closing costs are in cash to close, not inside this payment.
          </p>
          <div className="deal-report-cards">
            <div className="deal-report-card"><span>Cash to close</span><b>{fmtMoney(r.cashToClose)}</b></div>
            <div className="deal-report-card"><span>Cash-on-cash</span><b>{r.cashOnCash == null ? '—' : fmtPct(r.cashOnCash, 1)}</b></div>
            <div className="deal-report-card"><span>Leverage</span><b>{r.leverage == null ? '—' : `${r.leverage.toFixed(1)}:1`}</b></div>
          </div>
          <Table
            columns={['Year 1', 'Annual', 'Monthly']}
            rows={[
              { label: 'SDE after buyer salary', isSde: true, cells: [fmtMoney(r.sde), fmtMoney(r.sde / 12)] },
              { label: 'SBA payment on market-price loan', cells: [fmtParen(r.sbaAnnual), fmtParen(r.sbaMonthly)] },
              ...(r.sellerAnnual > 0 ? [{ label: 'Seller financing', cells: [fmtParen(r.sellerAnnual), fmtParen(r.sellerAnnual / 12)] }] : []),
              { label: 'Net cash flow', cells: [fmtMoney(r.netCashFlow), fmtMoney(r.netCashFlow / 12)] },
            ]}
          />
          <p className="deal-report-note">Exit year {r.exitYears}. Exit SDE {fmtMoney(r.exitSde)} after {(r.growth * 100).toFixed(1)}% annual growth. Exit multiple source: {r.exitMultipleSource}.</p>
          <Table
            columns={['Scenario', ...r.scenarioLabels]}
            rows={[
              { label: 'Multiple', cells: r.scenarios.map(sc => `${sc.multiple.toFixed(1)}×`) },
              { label: 'Total return', cells: r.scenarios.map(sc => fmtMoney(sc.total)) },
              { label: 'Total ROI', cells: r.scenarios.map(sc => sc.roiPct == null ? '—' : `${sc.roiPct.toFixed(0)}%`) },
              { label: 'CAGR', cells: r.scenarios.map(sc => sc.cagr == null ? '—' : fmtPct(sc.cagr * 100, 1)) },
            ]}
          />
        </Section>
      )}

      {sources && (
        <Section section={sources}>
          <p>
            The SBA loan finances {fmtPct(100 - s.downPct, 0)} of the project plus the guarantee fee and closing costs.
            Buyer cash at closing in this section is the {fmtPct(s.downPct, 0)} down payment.
            Fee and closing costs are uses, not extra cash, here.
          </p>
          <div className="deal-report-split">
            <div>
              <h3>Sources</h3>
              <Kv label={`SBA loan (${fmtPct(100 - s.downPct, 0)} + fee + closing)`} value={fmtMoney(s.sbaLoan)} />
              <Kv label={`Buyer down payment (${fmtPct(s.downPct, 0)})`} value={fmtMoney(s.downPayment)} />
              {s.sellerNote > 0 && <Kv label="Seller financing note" value={fmtMoney(s.sellerNote)} />}
              <Kv label="Total sources" value={fmtMoney(s.sourcesTotal)} />
            </div>
            <div>
              <h3>Uses</h3>
              <Kv label="Market price" value={fmtMoney(s.marketPrice)} />
              {s.reVal > 0 && <Kv label="Real estate" value={fmtMoney(s.reVal)} />}
              {s.wc > 0 && <Kv label="Working capital" value={fmtMoney(s.wc)} />}
              {s.arVal > 0 && <Kv label="Accounts receivable" value={fmtMoney(s.arVal)} />}
              {s.invVal > 0 && <Kv label="Inventory" value={fmtMoney(s.invVal)} />}
              <Kv label="SBA guarantee fee" value={fmtMoney(s.guaranteeFee)} />
              <Kv label="Closing costs" value={fmtMoney(s.closing)} />
              <Kv label="Total uses" value={fmtMoney(s.usesTotal)} />
            </div>
          </div>
          {s.sellerNote > 0 && <p className="deal-report-note">The seller note is an additional source here and is not subtracted from the SBA loan. Buyer ROI does subtract a seller note from the loan it amortizes.</p>}
          {!s.balanced && <p className="deal-report-note">Sources {fmtMoney(s.sourcesTotal)} and uses {fmtMoney(s.usesTotal)} do not match.</p>}
        </Section>
      )}

      {proceeds && (
        <Section section={proceeds}>
          <p>
            Seller proceeds deduct debt, commission, legal fees, tax, and a seller closing cost only when one is entered.
            The buyer SBA guarantee fee and buyer closing costs stay in Sources &amp; Uses and buyer cash to close.
            A missing sale price is not reported as $0.
          </p>
          {p.available ? (
            <>
              {p.lines.map(line => (
                <Kv key={line.label} label={line.label} value={line.sign === '-' ? fmtParen(line.amount) : fmtMoney(line.amount)} />
              ))}
              <div className="deal-report-total">
                <span>Estimated net proceeds</span>
                <strong>{fmtMoney(p.net)}</strong>
              </div>
            </>
          ) : <p>Sale price is not entered, so net proceeds are not calculated.</p>}
        </Section>
      )}

      {nlb && (
        <Section section={nlb}>
          <p>
            Illustration only. The down payment is the NLB tab’s percent of net proceeds.
            Target price assumes that down payment is 10% of the next acquisition.
            Estimated SDE is the target price divided by 3 unless a next-business SDE was entered.
            This is not a valuation and not a listing.
          </p>
          {n.available ? (
            <>
              <Kv label="Net proceeds from sale" value={fmtMoney(n.net)} />
              <Kv label={`Down payment for the next acquisition (${fmtPct(n.pct, 0)} of proceeds)`} value={fmtMoney(n.downPayment)} />
              <Kv label="Proceeds left after that down payment" value={fmtMoney(n.remaining)} />
              <Kv label="Current business SDE (before buyer salary)" value={fmtMoney(n.curSDE)} />
              <Kv label="Target price (down payment ÷ 10%)" value={fmtMoney(n.target)} />
              <Kv label={n.nextSdeEstimated ? 'Estimated next SDE (target price ÷ 3)' : 'Next business SDE (entered)'} value={fmtMoney(n.nextSDE)} />
              <div className="deal-report-total">
                <span>Illustrated income difference</span>
                <strong className={n.incomeIncrease < 0 ? 'num-neg' : undefined}>{fmtMoney(n.incomeIncrease)}</strong>
              </div>
            </>
          ) : (
            <>
              <p>{n.reason}</p>
              {n.curSDE ? <p>Current business SDE (most recent, before buyer salary): {fmtMoney(n.curSDE)}.</p> : null}
            </>
          )}
        </Section>
      )}

      {narrative && (
        <Section section={narrative}>
          {!report.narrative.hasFinancials ? (
            <p>No completed year with revenue is entered, so trend charts are omitted.</p>
          ) : (
            <>
              <p>Most recent year with revenue: {report.narrative.year}. Charts use completed years only.</p>
              <div className="deal-report-kpis">
                {report.narrative.kpis.map(kpi => (
                  <div className="deal-report-fig" key={kpi.label}>
                    <span>{kpi.label}</span>
                    <strong>{kpi.value}</strong>
                    {kpi.detail ? <small>{kpi.detail}</small> : null}
                  </div>
                ))}
              </div>
              <div className="deal-report-charts">
                {report.narrative.charts.map(chart => (
                  <div className="deal-report-chart" key={chart.title}>
                    <h3>{chart.title}</h3>
                    <Bars chart={chart} />
                  </div>
                ))}
              </div>
              <div className="deal-report-chart" style={{ marginTop: 16 }}>
                <h3>Revenue to SDE — {report.narrative.year}</h3>
                <Waterfall steps={report.narrative.waterfall} />
              </div>
            </>
          )}
          {report.narrative.text ? report.narrative.text.split('\n').map((line, i) => {
            const heading = line.match(/^\*\*(.+?)\*\*$/);
            if (!line.trim()) return <div key={i} style={{ height: 8 }} />;
            if (heading) return <h3 key={i} style={{ margin: '16px 0 6px', fontSize: 15 }}>{heading[1]}</h3>;
            return <p key={i}>{line.replace(/\*\*(.+?)\*\*/g, '$1')}</p>;
          }) : null}
        </Section>
      )}
    </article>
  );
}
