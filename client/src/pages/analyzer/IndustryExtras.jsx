import React, { useState } from 'react';
import industryBenchmarks from '../../../../shared/industryBenchmarks.cjs';

const { dealRatioActual, fmtRatio } = industryBenchmarks;

const cell = {
  padding: '8px 12px',
  fontVariantNumeric: 'tabular-nums',
  minWidth: 0,
  overflowWrap: 'anywhere',
  verticalAlign: 'top',
};

function hasRatioTable(ind) {
  return !!(ind && ind.financialRatios && Array.isArray(ind.financialRatios.rows) && ind.financialRatios.rows.length);
}

function ScoreBar({ score }) {
  const n = Math.max(0, Math.min(4, Number(score) || 0));
  return (
    <div style={{ padding: '2px 8px 0' }}>
      <div style={{ position: 'relative', height: 8, borderRadius: 99, background: '#f4efe9', border: '1px solid #e6dfd6' }}>
        <div style={{ position: 'absolute', left: `${(n / 4) * 100}%`, top: '50%', width: 10, height: 10, borderRadius: '50%', background: '#C4592F', transform: 'translate(-50%, -50%)' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#78716c', marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>
        <span>0</span>
        <span>4</span>
      </div>
    </div>
  );
}

function YearSwitch({ years, yearIdx, setYearIdx }) {
  if (!years || years.length < 2) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
      {years.map((year, index) => (
        <button
          key={year || index}
          type="button"
          onClick={() => setYearIdx(index)}
          style={{
            fontSize: 11,
            padding: '6px 10px',
            borderRadius: 6,
            border: '1px solid #e6dfd6',
            background: index === yearIdx ? 'rgba(196,89,47,0.12)' : '#fff',
            color: index === yearIdx ? '#C4592F' : '#57534e',
            cursor: 'pointer',
            fontWeight: 700,
          }}
        >
          {year}
        </button>
      ))}
    </div>
  );
}

export function IndustryExtraSections({ ind, fin }) {
  const ratios = hasRatioTable(ind) ? ind.financialRatios : null;
  const years = ratios ? (ratios.years || []) : [];
  const [yearIdx, setYearIdx] = useState(Math.max(0, years.length - 1));
  const safeIdx = Math.min(yearIdx, Math.max(0, years.length - 1));
  const ratings = Array.isArray(ind?.expertRatings) ? ind.expertRatings : [];
  const expenses = ind?.expertExpenses;
  const hasExpenses = !!(expenses && [expenses.cogsPct, expenses.occupancyPct, expenses.payrollPct, expenses.preTaxProfitPct].some((v) => v != null && v !== ''));
  const benchmarks = Array.isArray(ind?.expertBenchmarks) ? ind.expertBenchmarks.filter((item) => String(item || '').trim()) : [];
  const insights = Array.isArray(ind?.expertInsights) ? ind.expertInsights.filter((section) => section && String(section.text || '').trim()) : [];
  const dealValues = ratios ? ratios.rows.map((row) => dealRatioActual(row.label, fin)) : [];
  const showDeal = dealValues.some((v) => v != null);

  return (
    <>
      {ratios && (
        <div className="card p-4 mb-4">
          <h3 className="text-sm font-bold text-gray-300" style={{ marginBottom: 8 }}>Financial Ratio Benchmarks</h3>
          <p style={{ fontSize: 11, color: '#57534e', margin: '0 0 12px', lineHeight: 1.5 }}>
            Upper quartile, median, and lower quartile{years[safeIdx] ? ` for ${years[safeIdx]}` : ''}. Upper is the stronger quartile in this report, which is not always the larger number.
          </p>
          <YearSwitch years={years} yearIdx={safeIdx} setYearIdx={setYearIdx} />
          <table className="w-full" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e6dfd6' }}>
                {['Metric', 'Upper quartile', 'Median', 'Lower quartile', ...(showDeal ? ['This deal'] : [])].map((heading, index) => (
                  <th key={heading} style={{ ...cell, textAlign: index === 0 ? 'left' : 'right', fontSize: 10, color: index === 0 ? '#44403c' : '#6d28d9', fontWeight: 700 }}>
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ratios.rows.map((row, index) => (
                <tr key={`${row.label}-${index}`} style={{ borderBottom: '1px solid #f0eae3' }}>
                  <td style={{ ...cell, fontSize: 12, color: '#44403c' }}>{row.label}</td>
                  {['upper', 'median', 'lower'].map((key) => (
                    <td key={key} style={{ ...cell, textAlign: 'right', fontSize: 12, color: '#1c1917', fontFamily: 'monospace' }}>{fmtRatio(row[key] && row[key][safeIdx])}</td>
                  ))}
                  {showDeal && (
                    <td style={{ ...cell, textAlign: 'right', fontSize: 12, color: '#1d4ed8', fontFamily: 'monospace' }}>{fmtRatio(dealValues[index])}</td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {ratings.length > 0 && (
        <div className="card p-4 mb-4">
          <h3 className="text-sm font-bold text-gray-300" style={{ marginBottom: 8 }}>Expert Ratings</h3>
          <p style={{ fontSize: 11, color: '#57534e', margin: '0 0 12px', lineHeight: 1.5 }}>
            Scores use this report&apos;s 0 to 4 scale. What 0 and 4 mean is different on each row.
          </p>
          <div style={{ display: 'grid', gap: 12 }}>
            {ratings.map((rating) => (
              <div key={rating.label} style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12, color: '#1c1917' }}>
                  <span style={{ minWidth: 0 }}>{rating.label}</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#C4592F', fontVariantNumeric: 'tabular-nums' }}>{Number(rating.score).toFixed(1)}</span>
                </div>
                <ScoreBar score={rating.score} />
                {rating.scale && <div style={{ fontSize: 10, color: '#78716c', padding: '0 8px' }}>{rating.scale}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {(hasExpenses || benchmarks.length > 0) && (
        <div className="card p-4 mb-4">
          <h3 className="text-sm font-bold text-gray-300" style={{ marginBottom: 8 }}>Expert Expense Benchmarks</h3>
          {hasExpenses && (
            <table className="w-full" style={{ borderCollapse: 'collapse', marginBottom: benchmarks.length ? 16 : 0 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e6dfd6' }}>
                  {['Cost of goods', 'Occupancy', 'Payroll / labor', 'Profit before tax'].map((heading) => (
                    <th key={heading} style={{ ...cell, textAlign: 'right', fontSize: 10, color: '#44403c', fontWeight: 700 }}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {[expenses.cogsPct, expenses.occupancyPct, expenses.payrollPct, expenses.preTaxProfitPct].map((value, index) => (
                    <td key={index} style={{ ...cell, textAlign: 'right', fontSize: 13, fontFamily: 'monospace', color: '#1c1917' }}>
                      {value == null || value === '' ? '—' : `${fmtRatio(value)}%`}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          )}
          {benchmarks.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#57534e', marginBottom: 8 }}>Expert benchmarks</div>
              <ul style={{ margin: 0, padding: '0 0 0 18px', display: 'grid', gap: 8 }}>
                {benchmarks.map((item, index) => (
                  <li key={index} style={{ fontSize: 12, color: '#44403c', lineHeight: 1.5, minWidth: 0, overflowWrap: 'anywhere' }}>{item}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {insights.length > 0 && (
        <div className="card p-4 mb-4">
          <h3 className="text-sm font-bold text-gray-300" style={{ marginBottom: 8 }}>Expert Insights</h3>
          <p style={{ fontSize: 11, color: '#57534e', margin: '0 0 12px', lineHeight: 1.5 }}>
            Summary of the narrative sections in the imported report.
          </p>
          <div style={{ display: 'grid', gap: 16 }}>
            {insights.map((section) => (
              <div key={section.heading} style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#1c1917', marginBottom: 6 }}>{section.heading}</div>
                <ul style={{ margin: 0, padding: '0 0 0 18px', display: 'grid', gap: 6 }}>
                  {String(section.text).split('\n').map((line) => line.replace(/^[-•]\s*/, '').trim()).filter(Boolean).map((line, index) => (
                    <li key={index} style={{ fontSize: 12, color: '#44403c', lineHeight: 1.5, minWidth: 0, overflowWrap: 'anywhere' }}>{line}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function setPath(vals, setVals, patch) {
  setVals({ ...vals, ...patch });
}

export function IndustryReviewExtras({ vals, setVals }) {
  const ratios = hasRatioTable(vals) ? vals.financialRatios : null;
  const years = ratios ? (ratios.years || []) : [];
  const [yearIdx, setYearIdx] = useState(Math.max(0, years.length - 1));
  const safeIdx = Math.min(yearIdx, Math.max(0, years.length - 1));
  const ratings = Array.isArray(vals.expertRatings) ? vals.expertRatings : [];
  const expenses = vals.expertExpenses;
  const benchmarks = Array.isArray(vals.expertBenchmarks) ? vals.expertBenchmarks : null;
  const insights = Array.isArray(vals.expertInsights) ? vals.expertInsights : [];

  const updateRatio = (rowIndex, key, raw) => {
    const rows = ratios.rows.map((row, index) => {
      if (index !== rowIndex) return row;
      const next = { ...row, [key]: [...(row[key] || [null, null, null])] };
      const trimmed = String(raw).trim();
      next[key][safeIdx] = trimmed === '' ? null : (Number.isFinite(Number(trimmed)) ? Number(trimmed) : null);
      return next;
    });
    setPath(vals, setVals, { financialRatios: { ...ratios, rows } });
  };

  const heading = (text) => (
    <div style={{ fontSize: 12, fontWeight: 700, color: '#6d28d9', margin: '16px 0 10px', paddingBottom: 6, borderBottom: '1px solid #e6dfd6' }}>{text}</div>
  );

  return (
    <>
      {ratios && (
        <>
          {heading('Financial ratios — upper / median / lower')}
          <YearSwitch years={years} yearIdx={safeIdx} setYearIdx={setYearIdx} />
          <div style={{ display: 'grid', gap: 12 }}>
            {ratios.rows.map((row, index) => (
              <div key={`${row.label}-${index}`} style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, color: '#57534e', marginBottom: 6 }}>{row.label}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
                  {[['upper', 'Upper'], ['median', 'Median'], ['lower', 'Lower']].map(([key, label]) => (
                    <label key={key} style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 10, color: '#78716c', marginBottom: 4 }}>{label}</div>
                      <input
                        className="input-field"
                        style={{ fontSize: 12 }}
                        value={row[key] && row[key][safeIdx] != null ? row[key][safeIdx] : ''}
                        onChange={(event) => updateRatio(index, key, event.target.value)}
                      />
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {ratings.length > 0 && (
        <>
          {heading('Expert ratings (0 to 4)')}
          <div style={{ display: 'grid', gap: 12 }}>
            {ratings.map((rating, index) => (
              <div key={`${rating.label}-${index}`} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 88px', gap: 8, alignItems: 'end' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 11, color: '#57534e', marginBottom: 4 }}>{rating.label}</div>
                  <div style={{ fontSize: 10, color: '#78716c', overflowWrap: 'anywhere' }}>{rating.scale}</div>
                </div>
                <input
                  className="input-field"
                  style={{ fontSize: 12 }}
                  value={rating.score ?? ''}
                  onChange={(event) => {
                    const next = ratings.map((item, itemIndex) => itemIndex === index ? { ...item, score: event.target.value } : item);
                    setPath(vals, setVals, { expertRatings: next });
                  }}
                />
              </div>
            ))}
          </div>
        </>
      )}

      {expenses && (
        <>
          {heading('Expert expenses (% of sales)')}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
            {[
              ['cogsPct', 'Cost of goods'],
              ['occupancyPct', 'Occupancy'],
              ['payrollPct', 'Payroll / labor'],
              ['preTaxProfitPct', 'Profit before tax'],
            ].map(([key, label]) => (
              <label key={key} style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, color: '#57534e', marginBottom: 4 }}>{label}</div>
                <input
                  className="input-field"
                  style={{ fontSize: 12 }}
                  value={expenses[key] ?? ''}
                  onChange={(event) => setPath(vals, setVals, { expertExpenses: { ...expenses, [key]: event.target.value } })}
                />
              </label>
            ))}
          </div>
        </>
      )}

      {benchmarks && (
        <>
          {heading('Expert benchmarks')}
          <textarea
            className="input-field"
            rows={6}
            style={{ fontSize: 12, lineHeight: 1.45, resize: 'vertical' }}
            value={benchmarks.join('\n')}
            onChange={(event) => setPath(vals, setVals, { expertBenchmarks: event.target.value.split('\n') })}
          />
        </>
      )}

      {insights.length > 0 && (
        <>
          {heading('Expert insights')}
          <div style={{ display: 'grid', gap: 12 }}>
            {insights.map((section, index) => (
              <label key={`${section.heading}-${index}`} style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, color: '#57534e', marginBottom: 4 }}>{section.heading}</div>
                <textarea
                  className="input-field"
                  rows={4}
                  style={{ fontSize: 12, lineHeight: 1.45, resize: 'vertical' }}
                  value={section.text || ''}
                  onChange={(event) => {
                    const next = insights.map((item, itemIndex) => itemIndex === index ? { ...item, text: event.target.value } : item);
                    setPath(vals, setVals, { expertInsights: next });
                  }}
                />
              </label>
            ))}
          </div>
        </>
      )}
    </>
  );
}
