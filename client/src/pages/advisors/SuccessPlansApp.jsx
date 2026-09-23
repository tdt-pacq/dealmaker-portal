import React, { useEffect, useRef, useState } from 'react';
import { calcWtf } from '@shared/wtfMath.mjs';
import CompanyCockpit from './CompanyCockpit';
import {
  archiveSuccessPlanPerson,
  createSuccessPlanPerson,
  createSuccessPlanYear,
  fetchSuccessPlans,
  restoreSuccessPlanPerson,
  saveSuccessPlanCompany,
  saveSuccessPlanPerson,
} from '../../api';

const STATUS_OPTIONS = [
  ['', '—'],
  ['not_started', 'Not started'],
  ['in_progress', 'In progress'],
  ['done', 'Done'],
  ['blocked', 'Blocked'],
];

function money(n) {
  if (n == null || n === '' || !Number.isFinite(Number(n))) return '—';
  return `$${Math.round(Number(n)).toLocaleString('en-US')}`;
}

function pctLabel(n) {
  if (!Number.isFinite(Number(n))) return '—';
  return `${(Number(n) * 100).toFixed(1)}%`;
}

function formatPctInput(fraction) {
  if (fraction == null || fraction === '') return '';
  const n = Number(fraction);
  if (!Number.isFinite(n)) return '';
  return String(Math.round(n * 1000) / 10);
}

function toCompanyDraft(company) {
  return {
    vision: company.vision || '',
    mission: company.mission || '',
    deal_values: company.deal_values || '',
    wtf_number: company.wtf_number || '',
    priorities: (company.priorities || []).map((p) => ({
      id: p.id,
      body: p.body || '',
      owner_name: p.owner_name || '',
      ladders_to: p.ladders_to || '',
      due_date: p.due_date || '',
      status: p.status || '',
    })),
    five_year_goals: (company.five_year_goals || []).map((g) => ({
      goal_year: g.goal_year,
      gci_target: g.gci_target,
      ebitda_target: g.ebitda_target,
    })),
  };
}

function toPersonDraft(person) {
  return {
    name: person.name || '',
    role: person.role || '',
    commission_split: person.commission_split,
    personal_income_target: person.personal_income_target,
    avg_deal_size: person.avg_deal_size,
    commission_rate: person.commission_rate,
    close_ratio: person.close_ratio,
    dealmaker_edge: person.dealmaker_edge || '',
    stop_delegate: person.stop_delegate || '',
    notes: person.notes || '',
    actual_gci: person.actual_gci,
    deals_closed: person.deals_closed,
    active_pipeline: person.active_pipeline,
    priorities: (person.priorities || []).map((p) => ({
      id: p.id,
      body: p.body || '',
      due_date: p.due_date || '',
      status: p.status || '',
      company_priority_id: p.company_priority_id || '',
    })),
  };
}

function same(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function errText(err, fallback) {
  return err?.response?.data?.error || err?.message || fallback;
}

function Field({ label, hint, children }) {
  return (
    <div className="field-group" style={{ marginBottom: 0 }}>
      <label>{label}</label>
      {children}
      {hint ? <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>{hint}</div> : null}
    </div>
  );
}

function MoneyInput({ value, onChange }) {
  return (
    <input
      type="number"
      min="0"
      step="any"
      value={value ?? ''}
      placeholder="0"
      onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
    />
  );
}

function PercentInput({ value, onChange }) {
  const [text, setText] = useState(() => formatPctInput(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(formatPctInput(value));
  }, [value]);

  return (
    <input
      type="number"
      min="0"
      max="100"
      step="0.1"
      value={text}
      placeholder="0"
      onFocus={() => { focused.current = true; }}
      onBlur={() => { focused.current = false; setText(formatPctInput(value)); }}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        if (raw.trim() === '') onChange(null);
        else if (Number.isFinite(Number(raw))) onChange(Number(raw) / 100);
      }}
    />
  );
}

function ProgressRow({ label, actual, target, format }) {
  const a = Number(actual) || 0;
  const t = Number(target) || 0;
  const pct = t > 0 ? Math.min(100, (a / t) * 100) : 0;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13, marginBottom: 6 }}>
        <span>{label}</span>
        <span style={{ color: '#94a3b8' }}>
          {t > 0 ? `${format(a)} of ${format(t)} · ${pct.toFixed(0)}%` : 'No target yet'}
        </span>
      </div>
      <div style={{ height: 8, background: '#0d1117', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{
          width: `${pct}%`,
          height: '100%',
          background: pct >= 100 ? '#2eb860' : '#C1622F',
          borderRadius: 99,
        }} />
      </div>
    </div>
  );
}

function Kpi({ label, value, detail }) {
  return (
    <div className="card" style={{ padding: '16px 18px' }}>
      <div style={{ fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase', color: '#64748b', fontWeight: 700 }}>
        {label}
      </div>
      <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 28, color: '#e2e8f0', marginTop: 6, lineHeight: 1.1 }}>
        {value}
      </div>
      <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 6 }}>{detail}</div>
    </div>
  );
}

function CalcRow({ label, value, last }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      gap: 12,
      padding: '10px 0',
      borderBottom: last ? 'none' : '1px solid #1e2d45',
    }}>
      <span style={{ color: '#94a3b8', fontSize: 13 }}>{label}</span>
      <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#4ade80' }}>{value}</span>
    </div>
  );
}

export default function SuccessPlansApp() {
  const [year, setYear] = useState(2027);
  const [data, setData] = useState(null);
  const [mode, setMode] = useState('company');
  const [companyDraft, setCompanyDraft] = useState(null);
  const [personDrafts, setPersonDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [roster, setRoster] = useState({ name: '', role: '', split: '50' });
  const [showYear, setShowYear] = useState(false);
  const [yearInput, setYearInput] = useState('');
  const [confirmArchive, setConfirmArchive] = useState(false);
  const serverCompany = useRef(null);
  const serverPeople = useRef({});

  const applyView = (view, savedKey) => {
    const company = toCompanyDraft(view.company);
    const people = {};
    for (const person of [...view.people, ...view.inactive]) people[person.id] = toPersonDraft(person);

    setCompanyDraft((prev) => {
      if (savedKey === 'company' || savedKey === 'reload') return company;
      if (prev && serverCompany.current && !same(prev, serverCompany.current)) return prev;
      return company;
    });
    setPersonDrafts((prev) => {
      const next = {};
      for (const [id, fresh] of Object.entries(people)) {
        if (savedKey === id || savedKey === 'reload') {
          next[id] = fresh;
          continue;
        }
        const local = prev[id];
        const baseline = serverPeople.current[id];
        next[id] = local && baseline && !same(local, baseline) ? local : fresh;
      }
      return next;
    });
    serverCompany.current = company;
    serverPeople.current = people;
    setData(view);
    if (!view.years.includes(year)) setYear(view.year);
  };

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    fetchSuccessPlans(year)
      .then((res) => {
        if (cancelled) return;
        applyView(res.data, 'reload');
      })
      .catch((err) => {
        if (!cancelled) setError(errText(err, 'Could not load success plans'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
    // applyView closes over year only to correct a missing year; reload is keyed by year.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year]);

  useEffect(() => {
    if (!notice) return undefined;
    const t = setTimeout(() => setNotice(''), 2500);
    return () => clearTimeout(t);
  }, [notice]);

  const personIsDirty = (id) => {
    const baseline = serverPeople.current[id];
    return !!(baseline && personDrafts[id] && !same(personDrafts[id], baseline));
  };
  const companyDirty = !!(companyDraft && serverCompany.current && !same(companyDraft, serverCompany.current));
  const anyDirty = companyDirty || Object.keys(personDrafts).some((id) => personIsDirty(id));

  const askYear = (next) => {
    if (next === year) return;
    if (anyDirty && !window.confirm('You have unsaved changes. Switch year anyway?')) return;
    setMode('company');
    setYear(next);
  };

  const saveCompany = async () => {
    setSaving(true);
    setError('');
    try {
      const res = await saveSuccessPlanCompany({ year, ...companyDraft });
      applyView(res.data, 'company');
      setNotice('Company strategy saved');
    } catch (err) {
      setError(errText(err, 'Could not save company strategy'));
    } finally {
      setSaving(false);
    }
  };

  const savePerson = async (personId) => {
    const draft = personDrafts[personId];
    if (!draft) return;
    if (draft.priorities.some((p) => !String(p.body || '').trim() && (p.status || p.due_date || p.company_priority_id))) {
      setError('Each strategic priority needs text.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await saveSuccessPlanPerson(personId, {
        ...draft,
        year,
        priorities: draft.priorities.map((p) => ({
          ...p,
          company_priority_id: p.company_priority_id || null,
          due_date: p.due_date || null,
        })),
      });
      applyView(res.data, personId);
      setNotice('Plan saved');
      setConfirmArchive(false);
    } catch (err) {
      setError(errText(err, 'Could not save this plan'));
    } finally {
      setSaving(false);
    }
  };

  const addPerson = async () => {
    if (!roster.name.trim()) {
      setError('Name is required to add someone.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const split = roster.split.trim() === '' ? null : Number(roster.split) / 100;
      const res = await createSuccessPlanPerson({
        year,
        name: roster.name.trim(),
        role: roster.role.trim(),
        commission_split: split,
      });
      applyView(res.data.view, 'reload');
      setRoster({ name: '', role: '', split: '50' });
      setMode(res.data.id);
      setNotice('Added to the roster');
    } catch (err) {
      setError(errText(err, 'Could not add this person'));
    } finally {
      setSaving(false);
    }
  };

  const addYear = async () => {
    const next = Number(yearInput);
    if (!Number.isInteger(next)) {
      setError('Enter a plan year, such as 2028.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await createSuccessPlanYear(next);
      setShowYear(false);
      setYearInput('');
      setMode('company');
      setYear(res.data.year);
      setNotice(`Opened ${res.data.year}`);
    } catch (err) {
      setError(errText(err, 'Could not add that year'));
    } finally {
      setSaving(false);
    }
  };

  const archivePerson = async (personId) => {
    setSaving(true);
    setError('');
    try {
      const res = await archiveSuccessPlanPerson(personId, year);
      applyView(res.data, 'reload');
      setMode('company');
      setConfirmArchive(false);
      setNotice('Removed from this year’s rollup');
    } catch (err) {
      setError(errText(err, 'Could not archive this person'));
    } finally {
      setSaving(false);
    }
  };

  const restorePerson = async (personId) => {
    setSaving(true);
    setError('');
    try {
      const res = await restoreSuccessPlanPerson(personId, year);
      applyView(res.data, 'reload');
      setMode(personId);
      setNotice('Restored to the roster');
    } catch (err) {
      setError(errText(err, 'Could not restore this person'));
    } finally {
      setSaving(false);
    }
  };

  const people = data?.people || [];
  const selected = mode === 'company' ? null : people.find((p) => p.id === mode) || (data?.inactive || []).find((p) => p.id === mode);
  const draft = selected ? personDrafts[selected.id] : null;
  const calc = draft ? calcWtf({
    personalIncome: draft.personal_income_target,
    split: draft.commission_split,
    avgDealSize: draft.avg_deal_size,
    commissionRate: draft.commission_rate,
    closeRatio: draft.close_ratio,
  }) : null;

  const ranked = [...people].sort((a, b) => {
    const byIncome = (b.personal_income_target || 0) - (a.personal_income_target || 0);
    if (byIncome) return byIncome;
    return a.name.localeCompare(b.name);
  });

  const patchCompany = (patch) => setCompanyDraft((prev) => ({ ...prev, ...patch }));
  const patchPerson = (personId, patch) => setPersonDrafts((prev) => ({
    ...prev,
    [personId]: { ...prev[personId], ...patch },
  }));

  return (
    <div className="page-content" style={{ maxWidth: 1180 }}>
      <div className="page-header" style={{ position: 'sticky', top: 0, zIndex: 4, background: '#0f1117', paddingTop: 4, paddingBottom: 12, alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div className="page-title">Annual Success Plans</div>
          <div className="page-subtitle">
            Bottom-up income commitments roll into the company plan. You are only one deal away from the wealth, time, and freedom you deserve.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <select aria-label="Plan year" value={year} onChange={(e) => askYear(Number(e.target.value))} style={{ width: 110 }}>
            {(data?.years || [year]).map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <button type="button" className="btn-ghost btn-sm" onClick={() => setShowYear((v) => !v)}>Add year</button>
          {mode !== 'company' && draft && (
            <button type="button" className="btn-primary btn-sm" disabled={saving || !personIsDirty(selected.id)} onClick={() => savePerson(selected.id)}>
              {saving ? 'Saving…' : 'Save plan'}
            </button>
          )}
          {mode === 'company' && (
            <button type="button" className="btn-primary btn-sm" disabled={saving || !companyDirty} onClick={saveCompany}>
              {saving ? 'Saving…' : 'Save strategy'}
            </button>
          )}
        </div>
      </div>

      {showYear && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-body" style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <Field label="New plan year">
              <input type="number" value={yearInput} placeholder="2028" onChange={(e) => setYearInput(e.target.value)} style={{ width: 140 }} />
            </Field>
            <button type="button" className="btn-primary btn-sm" disabled={saving} onClick={addYear}>Open year</button>
            <span style={{ fontSize: 12, color: '#64748b' }}>Copies the roster and assumptions. Income targets start blank.</span>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 18 }}>
        <div className="tabs" style={{ marginBottom: 0 }}>
          <button type="button" className={`tab-btn${mode === 'company' ? ' active' : ''}`} onClick={() => setMode('company')}>Company</button>
        </div>
        <select
          aria-label="Person"
          value={mode === 'company' ? '' : mode}
          onChange={(e) => setMode(e.target.value || 'company')}
          style={{ width: 280, maxWidth: '100%' }}
        >
          <option value="">Select a person…</option>
          {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}

      {loading && !data ? (
        <div style={{ padding: 40, color: '#64748b' }}>
          <span className="spinner spinner-dark" style={{ width: 22, height: 22, borderWidth: 3 }} /> Loading plans…
        </div>
      ) : null}

      {data && mode === 'company' && companyDraft && (
        <>
          <CompanyCockpit
            year={data.year}
            people={people}
            kpis={data.kpis}
            onSelect={setMode}
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 10 }}>
            <Kpi label="Team committed GCI income" value={money(data.kpis.team_committed_gci_income)} detail="Sum of personal income targets" />
            <Kpi label="Gross production required" value={money(data.kpis.gross_production_required)} detail="Personal income ÷ commission split" />
            <Kpi label="Deals to close" value={data.kpis.deals_to_close.toLocaleString('en-US')} detail="Rounded up from production math" />
            <Kpi label="Pipeline committed" value={money(data.kpis.pipeline_commission)} detail="Engagement pipeline, commission basis" />
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginBottom: 18 }}>
            Target engagement pipeline (deal volume) {money(data.kpis.pipeline_deal_volume)}
            {' · '}
            Engagements needed {data.kpis.engagements_needed.toLocaleString('en-US')}
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <span className="card-title">Roster</span>
              <span style={{ fontSize: 12, color: '#64748b' }}>{people.length} active</span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Role</th>
                    <th style={{ textAlign: 'right' }}>Personal income target</th>
                    <th style={{ textAlign: 'right' }}>Gross production</th>
                    <th style={{ textAlign: 'right' }}>Deals to close</th>
                    <th style={{ textAlign: 'right' }}>% of team</th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((person) => (
                    <tr key={person.id} onClick={() => setMode(person.id)} style={{ cursor: 'pointer' }}>
                      <td style={{ color: '#4ade80', fontWeight: 600 }}>{person.name}</td>
                      <td style={{ color: '#94a3b8' }}>{person.role || '—'}</td>
                      <td style={{ textAlign: 'right' }}>{money(person.personal_income_target)}</td>
                      <td style={{ textAlign: 'right' }}>{money(person.gross_production)}</td>
                      <td style={{ textAlign: 'right' }}>{person.deals_to_close}</td>
                      <td style={{ textAlign: 'right' }}>{pctLabel(person.pct_of_team)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={2} style={{ fontWeight: 700 }}>Team</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{money(data.kpis.team_committed_gci_income)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{money(data.kpis.gross_production_required)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{data.kpis.deals_to_close}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>100%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header">
              <span className="card-title">Company strategy</span>
              <button type="button" className="btn-primary btn-sm" disabled={saving || !companyDirty} onClick={saveCompany}>
                {saving ? 'Saving…' : 'Save strategy'}
              </button>
            </div>
            <div className="card-body" style={{ display: 'grid', gap: 16 }}>
              <p style={{ fontSize: 13, color: '#94a3b8', margin: 0 }}>
                Five-year direction for {year}, plus this year&apos;s D.E.A.L. priorities. Individual plans roll up into this.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
                <Field label="Vision">
                  <textarea rows={3} value={companyDraft.vision} onChange={(e) => patchCompany({ vision: e.target.value })} />
                </Field>
                <Field label="Mission">
                  <textarea rows={3} value={companyDraft.mission} onChange={(e) => patchCompany({ mission: e.target.value })} />
                </Field>
              </div>
              <Field label="D.E.A.L. values">
                <textarea rows={2} value={companyDraft.deal_values} onChange={(e) => patchCompany({ deal_values: e.target.value })} />
              </Field>
              <Field label="This year's WTF number" hint="Left blank in the workbook. Add the number leadership wants the team chasing.">
                <input
                  type="text"
                  value={companyDraft.wtf_number}
                  placeholder="Not set"
                  onChange={(e) => patchCompany({ wtf_number: e.target.value })}
                />
              </Field>

              <div>
                <div className="card-title" style={{ marginBottom: 10 }}>This year&apos;s D.E.A.L. priorities</div>
                <div style={{ display: 'grid', gap: 10 }}>
                  {companyDraft.priorities.map((priority, index) => (
                    <div key={priority.id || index} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
                      <input
                        type="text"
                        aria-label={`Priority ${index + 1}`}
                        value={priority.body}
                        placeholder="Priority"
                        onChange={(e) => {
                          const priorities = companyDraft.priorities.map((row, i) => i === index ? { ...row, body: e.target.value } : row);
                          patchCompany({ priorities });
                        }}
                      />
                      <input
                        type="text"
                        aria-label={`Owner ${index + 1}`}
                        value={priority.owner_name}
                        placeholder="Owner"
                        onChange={(e) => {
                          const priorities = companyDraft.priorities.map((row, i) => i === index ? { ...row, owner_name: e.target.value } : row);
                          patchCompany({ priorities });
                        }}
                      />
                      <input
                        type="text"
                        aria-label={`Ladders to ${index + 1}`}
                        value={priority.ladders_to}
                        placeholder="Ladders to"
                        onChange={(e) => {
                          const priorities = companyDraft.priorities.map((row, i) => i === index ? { ...row, ladders_to: e.target.value } : row);
                          patchCompany({ priorities });
                        }}
                      />
                      <input
                        type="date"
                        aria-label={`Due ${index + 1}`}
                        value={priority.due_date || ''}
                        style={{ colorScheme: 'dark' }}
                        onChange={(e) => {
                          const priorities = companyDraft.priorities.map((row, i) => i === index ? { ...row, due_date: e.target.value } : row);
                          patchCompany({ priorities });
                        }}
                      />
                      <select
                        aria-label={`Status ${index + 1}`}
                        value={priority.status || ''}
                        onChange={(e) => {
                          const priorities = companyDraft.priorities.map((row, i) => i === index ? { ...row, status: e.target.value } : row);
                          patchCompany({ priorities });
                        }}
                      >
                        {STATUS_OPTIONS.map(([value, label]) => <option key={value || 'none'} value={value}>{label}</option>)}
                      </select>
                      <button
                        type="button"
                        className="btn-ghost btn-sm"
                        onClick={() => patchCompany({ priorities: companyDraft.priorities.filter((_, i) => i !== index) })}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                  {companyDraft.priorities.length === 0 && (
                    <div style={{ fontSize: 13, color: '#64748b' }}>No company priorities yet. The workbook left these open.</div>
                  )}
                  <div>
                    <button
                      type="button"
                      className="btn-ghost btn-sm"
                      disabled={companyDraft.priorities.length >= 5}
                      onClick={() => patchCompany({
                        priorities: [...companyDraft.priorities, { body: '', owner_name: '', ladders_to: '', due_date: '', status: '' }],
                      })}
                    >
                      Add priority
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <div className="card-title" style={{ marginBottom: 10 }}>Five-year WTF goals</div>
                <p style={{ fontSize: 12, color: '#64748b', margin: '0 0 10px' }}>
                  Years {companyDraft.five_year_goals[0]?.goal_year || year}–{companyDraft.five_year_goals.at(-1)?.goal_year || year} were listed in the workbook. Targets were not filled in.
                </p>
                <div style={{ overflowX: 'auto' }}>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Year</th>
                        <th>GCI target</th>
                        <th>EBITDA target</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {companyDraft.five_year_goals.map((goal, index) => (
                        <tr key={`${goal.goal_year}-${index}`}>
                          <td style={{ width: 120 }}>
                            <input
                              type="number"
                              aria-label={`Goal year ${index + 1}`}
                              value={goal.goal_year}
                              onChange={(e) => {
                                const five_year_goals = companyDraft.five_year_goals.map((row, i) => (
                                  i === index ? { ...row, goal_year: Number(e.target.value) } : row
                                ));
                                patchCompany({ five_year_goals });
                              }}
                            />
                          </td>
                          <td>
                            <MoneyInput
                              value={goal.gci_target}
                              onChange={(gci_target) => {
                                const five_year_goals = companyDraft.five_year_goals.map((row, i) => i === index ? { ...row, gci_target } : row);
                                patchCompany({ five_year_goals });
                              }}
                            />
                          </td>
                          <td>
                            <MoneyInput
                              value={goal.ebitda_target}
                              onChange={(ebitda_target) => {
                                const five_year_goals = companyDraft.five_year_goals.map((row, i) => i === index ? { ...row, ebitda_target } : row);
                                patchCompany({ five_year_goals });
                              }}
                            />
                          </td>
                          <td style={{ width: 90 }}>
                            <button
                              type="button"
                              className="btn-ghost btn-sm"
                              onClick={() => patchCompany({ five_year_goals: companyDraft.five_year_goals.filter((_, i) => i !== index) })}
                            >
                              Remove
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  style={{ marginTop: 10 }}
                  disabled={companyDraft.five_year_goals.length >= 8}
                  onClick={() => {
                    const last = companyDraft.five_year_goals.at(-1)?.goal_year || year;
                    patchCompany({
                      five_year_goals: [...companyDraft.five_year_goals, { goal_year: last + 1, gci_target: null, ebitda_target: null }],
                    });
                  }}
                >
                  Add year row
                </button>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header"><span className="card-title">Add to roster</span></div>
            <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, alignItems: 'end' }}>
              <Field label="Name">
                <input type="text" value={roster.name} onChange={(e) => setRoster((r) => ({ ...r, name: e.target.value }))} />
              </Field>
              <Field label="Role">
                <input type="text" value={roster.role} onChange={(e) => setRoster((r) => ({ ...r, role: e.target.value }))} />
              </Field>
              <Field label="Commission split (%)" hint="Income target stays blank until you set it on their plan.">
                <input type="number" min="0" max="100" step="0.1" value={roster.split} onChange={(e) => setRoster((r) => ({ ...r, split: e.target.value }))} />
              </Field>
              <button type="button" className="btn-primary" disabled={saving} onClick={addPerson}>Add person</button>
            </div>
          </div>

          {data.inactive.length > 0 && (
            <details className="card" style={{ marginBottom: 16, padding: '14px 18px' }}>
              <summary style={{ cursor: 'pointer', color: '#94a3b8', fontSize: 13 }}>Archived ({data.inactive.length})</summary>
              <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
                {data.inactive.map((person) => (
                  <div key={person.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                    <span>{person.name} <span style={{ color: '#64748b' }}>{person.role}</span></span>
                    <button type="button" className="btn-ghost btn-sm" disabled={saving} onClick={() => restorePerson(person.id)}>Restore</button>
                  </div>
                ))}
              </div>
            </details>
          )}
        </>
      )}

      {data && selected && draft && calc && (
        <>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, alignItems: 'end' }}>
              <Field label="Name">
                <input type="text" value={draft.name} onChange={(e) => patchPerson(selected.id, { name: e.target.value })} />
              </Field>
              <Field label="Role">
                <input type="text" value={draft.role} onChange={(e) => patchPerson(selected.id, { role: e.target.value })} />
              </Field>
              <div style={{ fontSize: 13, color: '#94a3b8', paddingBottom: 8 }}>
                Commission split {pctLabel(draft.commission_split || 0)}
                {selected.active ? '' : ' · Archived'}
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                {!confirmArchive ? (
                  <button type="button" className="btn-ghost btn-sm" onClick={() => setConfirmArchive(true)}>Archive</button>
                ) : (
                  <>
                    <button type="button" className="btn-danger btn-sm" disabled={saving} onClick={() => archivePerson(selected.id)}>Archive</button>
                    <button type="button" className="btn-ghost btn-sm" onClick={() => setConfirmArchive(false)}>Cancel</button>
                  </>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginBottom: 16 }}>
            <div className="card">
              <div className="card-header"><span className="card-title">WTF Goals</span></div>
              <div className="card-body" style={{ display: 'grid', gap: 14 }}>
                <Field label="Personal Income Target">
                  <MoneyInput value={draft.personal_income_target} onChange={(personal_income_target) => patchPerson(selected.id, { personal_income_target })} />
                </Field>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <Field label="Commission split (%)">
                    <PercentInput value={draft.commission_split} onChange={(commission_split) => patchPerson(selected.id, { commission_split })} />
                  </Field>
                  <Field label="Avg. deal size">
                    <MoneyInput value={draft.avg_deal_size} onChange={(avg_deal_size) => patchPerson(selected.id, { avg_deal_size })} />
                  </Field>
                  <Field label="Commission rate (%)">
                    <PercentInput value={draft.commission_rate} onChange={(commission_rate) => patchPerson(selected.id, { commission_rate })} />
                  </Field>
                  <Field label="Close ratio (%)">
                    <PercentInput value={draft.close_ratio} onChange={(close_ratio) => patchPerson(selected.id, { close_ratio })} />
                  </Field>
                </div>
                {(Number(draft.personal_income_target) > 0 && !(Number(draft.commission_split) > 0)) && (
                  <div className="alert alert-info" style={{ marginBottom: 0 }}>
                    Set a commission split above zero to calculate gross production.
                  </div>
                )}
              </div>
            </div>

            <div className="card">
              <div className="card-header"><span className="card-title">Production math</span></div>
              <div className="card-body">
                <CalcRow label="Gross Production Required" value={money(calc.grossProduction)} />
                <CalcRow label="Deals to Close" value={calc.dealsToClose ? String(calc.dealsToClose) : '—'} />
                <CalcRow label="Engagement Pipeline Needed (commission)" value={money(calc.pipelineCommission)} />
                <CalcRow label="Target Engagement Pipeline (deal volume)" value={money(calc.pipelineDealVolume)} />
                <CalcRow label="Engagements Needed" value={calc.engagementsNeeded ? String(calc.engagementsNeeded) : '—'} last />
                <p style={{ fontSize: 11, color: '#64748b', margin: '12px 0 0' }}>
                  Gross = income ÷ split. Deals round up from gross ÷ (deal size × commission rate). Pipeline and engagements use deals ÷ close ratio.
                </p>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header"><span className="card-title">Strategic Priorities</span></div>
            <div className="card-body" style={{ display: 'grid', gap: 10 }}>
              {draft.priorities.map((priority, index) => (
                <div key={priority.id || index} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8 }}>
                  <input
                    type="text"
                    aria-label={`Strategic priority ${index + 1}`}
                    value={priority.body}
                    placeholder="Priority"
                    onChange={(e) => {
                      const priorities = draft.priorities.map((row, i) => i === index ? { ...row, body: e.target.value } : row);
                      patchPerson(selected.id, { priorities });
                    }}
                  />
                  <select
                    aria-label={`Company priority ${index + 1}`}
                    value={priority.company_priority_id || ''}
                    onChange={(e) => {
                      const priorities = draft.priorities.map((row, i) => i === index ? { ...row, company_priority_id: e.target.value } : row);
                      patchPerson(selected.id, { priorities });
                    }}
                  >
                    <option value="">Company priority</option>
                    {(data.company.priorities || []).map((p) => (
                      <option key={p.id} value={p.id}>{p.body}</option>
                    ))}
                  </select>
                  <input
                    type="date"
                    aria-label={`Priority due ${index + 1}`}
                    value={priority.due_date || ''}
                    style={{ colorScheme: 'dark' }}
                    onChange={(e) => {
                      const priorities = draft.priorities.map((row, i) => i === index ? { ...row, due_date: e.target.value } : row);
                      patchPerson(selected.id, { priorities });
                    }}
                  />
                  <select
                    aria-label={`Priority status ${index + 1}`}
                    value={priority.status || ''}
                    onChange={(e) => {
                      const priorities = draft.priorities.map((row, i) => i === index ? { ...row, status: e.target.value } : row);
                      patchPerson(selected.id, { priorities });
                    }}
                  >
                    {STATUS_OPTIONS.map(([value, label]) => <option key={value || 'none'} value={value}>{label}</option>)}
                  </select>
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    onClick={() => patchPerson(selected.id, { priorities: draft.priorities.filter((_, i) => i !== index) })}
                  >
                    Remove
                  </button>
                </div>
              ))}
              {draft.priorities.length === 0 && (
                <div style={{ fontSize: 13, color: '#64748b' }}>No strategic priorities yet.</div>
              )}
              <div>
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  disabled={draft.priorities.length >= 5}
                  onClick={() => patchPerson(selected.id, {
                    priorities: [...draft.priorities, { body: '', due_date: '', status: '', company_priority_id: '' }],
                  })}
                >
                  Add priority
                </button>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-body" style={{ display: 'grid', gap: 14 }}>
              <Field label="Dealmaker Edge">
                <textarea rows={2} value={draft.dealmaker_edge} onChange={(e) => patchPerson(selected.id, { dealmaker_edge: e.target.value })} />
              </Field>
              <Field label="Stop / delegate">
                <textarea rows={2} value={draft.stop_delegate} onChange={(e) => patchPerson(selected.id, { stop_delegate: e.target.value })} />
              </Field>
              <Field label="Notes">
                <textarea rows={3} value={draft.notes} onChange={(e) => patchPerson(selected.id, { notes: e.target.value })} />
              </Field>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header"><span className="card-title">Progress (YTD)</span></div>
            <div className="card-body" style={{ display: 'grid', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                <Field label="Actual GCI">
                  <MoneyInput value={draft.actual_gci} onChange={(actual_gci) => patchPerson(selected.id, { actual_gci })} />
                </Field>
                <Field label="Deals closed">
                  <MoneyInput value={draft.deals_closed} onChange={(deals_closed) => patchPerson(selected.id, { deals_closed })} />
                </Field>
                <Field label="Active pipeline ($)">
                  <MoneyInput value={draft.active_pipeline} onChange={(active_pipeline) => patchPerson(selected.id, { active_pipeline })} />
                </Field>
              </div>
              <ProgressRow label="GCI vs personal income target" actual={draft.actual_gci} target={draft.personal_income_target} format={money} />
              <ProgressRow label="Deals closed vs deals to close" actual={draft.deals_closed} target={calc.dealsToClose} format={(n) => String(Math.round(n))} />
              <ProgressRow label="Active pipeline vs commission pipeline" actual={draft.active_pipeline} target={calc.pipelineCommission} format={money} />
              <div>
                <button type="button" className="btn-primary" disabled={saving || !personIsDirty(selected.id)} onClick={() => savePerson(selected.id)}>
                  {saving ? 'Saving…' : 'Save plan'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
