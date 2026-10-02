import React, { useEffect, useMemo, useState } from 'react';
import { fetchMarketingSummary, confirmMarketingSummary } from '../../api';

const GROUPS = [
  ['basics', 'Business basics'],
  ['financials', 'Financials'],
  ['operations', 'Operations'],
  ['assets', 'Assets and real estate'],
  ['sale', 'Sale details'],
];

function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

export default function MarketingConfirm({ deal, onUpdate, onReview }) {
  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState({});
  const [years, setYears] = useState([]);
  const [basis, setBasis] = useState('most_recent');
  const [rate, setRate] = useState('');
  const [realEstateIncluded, setRealEstateIncluded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    fetchMarketingSummary(deal.id)
      .then((res) => {
        if (cancelled) return;
        const data = res.data;
        setReview(data);
        const source = data.needs_review ? data.summary : (data.confirmed?.summary || data.summary);
        setSummary(source || {});
        setYears((data.needs_review ? data.sde_years : (data.confirmed?.sde_years || data.sde_years)) || []);
        setBasis(data.confirmed?.valuation_basis || data.suggested_basis || 'most_recent');
        setRate(data.confirmed?.sba_rate != null ? String(data.confirmed.sba_rate) : '');
        setRealEstateIncluded(Boolean(
          data.needs_review ? data.real_estate_included : data.confirmed?.real_estate_included
        ));
        setEditing(Boolean(data.needs_review));
        onReview?.(Boolean(data.needs_review));
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.response?.data?.error || 'Could not read the deal summary.');
        onReview?.(true);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [deal.id, deal.updated_at, deal.marketing_lock, onReview]);

  const shownMissing = useMemo(() => {
    const items = review?.missing || [];
    if (String(rate).trim()) return items.filter((item) => !/SBA 7\(a\) rate/i.test(item));
    return items;
  }, [review, rate]);

  const weightedOk = years.filter((year) => Number(String(year.sde).replace(/[^0-9.]/g, '')) > 0).length >= 3;

  async function handleConfirm() {
    setSaving(true);
    setError('');
    try {
      await confirmMarketingSummary({
        deal_id: deal.id,
        summary,
        sde_years: years,
        sde_basis: basis,
        sba_rate: rate,
        real_estate_included: realEstateIncluded,
      });
      setEditing(false);
      onReview?.(false);
      onUpdate?.();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not confirm the summary.');
    } finally {
      setSaving(false);
    }
  }

  if (loading && !review) {
    return (
      <div className="card marketing-review">
        <div className="card-body">Reading the interview and uploaded documents…</div>
      </div>
    );
  }

  const confirmed = review?.confirmed;
  if (confirmed && !editing) {
    return (
      <div className="card marketing-review">
        <div className="card-body lock-banner">
          <div className="stack">
            <div>
              <div className="section-label">Valuation SDE</div>
              <div className="num">Valuation SDE: {confirmed.valuation_sde_display || money(confirmed.valuation_sde)} (basis: {confirmed.valuation_basis_label})</div>
            </div>
            <div>
              <div className="section-label">SBA rate confirmed</div>
              <div className="num">{confirmed.sba_rate}%</div>
            </div>
            <div>
              <button type="button" className="btn-ghost btn-sm" onClick={() => { setEditing(true); onReview?.(true); }}>
                Edit confirmed values
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const fields = review?.fields || [];

  return (
    <div className="card marketing-review">
      <div className="card-body">
        <div>
          <h3>Confirm the deal before generating</h3>
          <p style={{ margin: 'var(--space-2) 0 0', color: 'var(--text-secondary)' }}>
            Check the figures pulled from the interview and uploaded documents. Choose the SDE basis, enter the SBA 7(a) rate, then confirm. Every marketing piece will use that locked Valuation SDE.
          </p>
        </div>
        {error && <div className="alert alert-error">{error}</div>}
        {review?.extract_note && <div className="alert alert-info">{review.extract_note}</div>}
        {shownMissing.length > 0 && (
          <div>
            <div className="section-label">Missing or unconfirmed</div>
            <ul className="missing-list">
              {shownMissing.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        )}
        {(review?.notes || []).map((note) => (
          <p key={note} style={{ margin: 0, color: 'var(--text-secondary)' }}>{note}</p>
        ))}

        {GROUPS.map(([group, title]) => {
          const groupFields = fields.filter((field) => field.group === group);
          if (!groupFields.length) return null;
          return (
            <div key={group}>
              <div className="section-label">{title}</div>
              <div className="field-row">
                {groupFields.map((field) => (
                  <div className="field-group" key={field.key} style={{ marginBottom: 0 }}>
                    <label htmlFor={`mkt-${field.key}`}>
                      {field.label}
                      {field.missing && !String(summary[field.key] || '').trim() && <span className="missing-pill">Missing</span>}
                    </label>
                    {field.key === 'description' || field.key === 'sba_term_notes' || field.key === 'owner_role' ? (
                      <textarea
                        id={`mkt-${field.key}`}
                        rows={3}
                        value={summary[field.key] || ''}
                        onChange={(e) => setSummary((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      />
                    ) : (
                      <input
                        id={`mkt-${field.key}`}
                        value={summary[field.key] || ''}
                        onChange={(e) => setSummary((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      />
                    )}
                  </div>
                ))}
              </div>
              {group === 'financials' && (
                <div className="stack" style={{ marginTop: 'var(--gap-field)' }}>
                  <div>
                    <div className="section-label">SDE by year</div>
                    <table className="sde-table">
                      <thead>
                        <tr>
                          <th>Year</th>
                          <th>SDE</th>
                          <th>Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(years.length ? years : [{ year: '', sde: '', revenue: '' }]).map((year, index) => (
                          <tr key={`${year.year}-${index}`}>
                            <td>
                              <input
                                aria-label={`SDE year ${index + 1}`}
                                value={year.year || ''}
                                onChange={(e) => setYears((prev) => {
                                  const next = prev.length ? [...prev] : [{ year: '', sde: '', revenue: '' }];
                                  next[index] = { ...next[index], year: e.target.value };
                                  return next;
                                })}
                              />
                            </td>
                            <td>
                              <input
                                className="num"
                                aria-label={`SDE amount ${index + 1}`}
                                value={year.sde ?? ''}
                                onChange={(e) => setYears((prev) => {
                                  const next = prev.length ? [...prev] : [{ year: '', sde: '', revenue: '' }];
                                  next[index] = { ...next[index], sde: e.target.value };
                                  return next;
                                })}
                              />
                            </td>
                            <td>
                              <input
                                className="num"
                                aria-label={`Revenue ${index + 1}`}
                                value={year.revenue ?? ''}
                                onChange={(e) => setYears((prev) => {
                                  const next = prev.length ? [...prev] : [{ year: '', sde: '', revenue: '' }];
                                  next[index] = { ...next[index], revenue: e.target.value };
                                  return next;
                                })}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      style={{ marginTop: 'var(--space-3)' }}
                      onClick={() => setYears((prev) => [...prev, { year: '', sde: '', revenue: '' }])}
                    >
                      Add year
                    </button>
                  </div>
                  <div>
                    <div className="section-label">Valuation SDE basis</div>
                    <div className="basis-choice">
                      <label>
                        <input
                          type="radio"
                          name="sde-basis"
                          checked={basis === 'weighted_321'}
                          disabled={!weightedOk}
                          onChange={() => setBasis('weighted_321')}
                        />
                        <span>
                          Weighted average 3-2-1
                          {review?.weighted_sde ? ` · ${money(review.weighted_sde)}` : ''}
                          {!weightedOk && ' · needs 3 years'}
                        </span>
                      </label>
                      <label>
                        <input
                          type="radio"
                          name="sde-basis"
                          checked={basis === 'most_recent'}
                          onChange={() => setBasis('most_recent')}
                        />
                        <span>
                          Most recent year
                          {years[0]?.sde ? ` · ${money(Number(String(years[0].sde).replace(/[^0-9.]/g, '')))}` : ''}
                        </span>
                      </label>
                    </div>
                  </div>
                  <div className="field-group" style={{ marginBottom: 0 }}>
                    <label htmlFor="sba-rate">
                      SBA 7(a) rate (%)
                      {!String(rate).trim() && <span className="missing-pill">Missing</span>}
                    </label>
                    <input
                      id="sba-rate"
                      className="num"
                      inputMode="decimal"
                      placeholder="10.5"
                      value={rate}
                      onChange={(e) => setRate(e.target.value)}
                    />
                  </div>
                  <label className="flex">
                    <input
                      type="checkbox"
                      checked={realEstateIncluded}
                      onChange={(e) => setRealEstateIncluded(e.target.checked)}
                      style={{ width: 'auto', marginRight: 'var(--space-2)' }}
                    />
                    Real estate is included in the asking price (25-year term on that portion)
                  </label>
                  {review?.term_sheet_excerpt && (
                    <div>
                      <div className="section-label">Term sheet excerpt</div>
                      <p className="term-sheet-note">{review.term_sheet_excerpt}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        <div className="cluster">
          <button type="button" className="btn-primary" onClick={handleConfirm} disabled={saving}>
            {saving ? 'Confirming…' : 'Confirm'}
          </button>
          {confirmed && (
            <button type="button" className="btn-ghost" onClick={() => { setEditing(false); onReview?.(false); }}>
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
