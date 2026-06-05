/**
 * BuyerStrategyApp.jsx
 * Buyer Intelligence — AI-powered buyer research & call prep
 *
 * Generates a structured intelligence report (personality, hot points, things to avoid,
 * and customized questions + talking points for each of the 5 call stages) by researching
 * the buyer online and synthesising everything with Claude.
 *
 * All buyer profiles stored in localStorage. Report generation calls the backend
 * async job pattern: POST /api/buyer-intel/research → { jobId }, then polls
 * GET /api/buyer-intel/jobs/:jobId every 5s.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { getAuth } from '../../api';
import './buyer-strategy.css';

// ─── Copy-to-clipboard button ─────────────────────────────────────────────────

function CopyBtn({ text, title = 'Copy' }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // fallback for older browsers
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  }, [text]);
  return (
    <button
      className={`bs-copy-btn${copied ? ' bs-copy-btn--copied' : ''}`}
      onClick={handleCopy}
      title={title}
    >
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  );
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LS_KEY = 'dealteam_buyer_intel_v2';
const newId   = () => 'bi_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const FRAMEWORK_STAGES = [
  { key: 'desire',   label: 'Desire',   emoji: '🔥', color: '#e05c5c' },
  { key: 'identity', label: 'Identity', emoji: '🪞', color: '#7b7fef' },
  { key: 'block',    label: 'Block',    emoji: '🧱', color: '#e09a2a' },
  { key: 'capacity', label: 'Capacity', emoji: '💰', color: '#2eb860' },
  { key: 'future',   label: 'Future',   emoji: '🚀', color: '#C9A84C' },
];

const PERSONALITY_ICONS = {
  'The Operator':       '⚙️',
  'The Investor':       '📈',
  'The Escape Artist':  '🚪',
  'The Legacy Builder': '🏛️',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const defForm = () => ({
  buyer_name: '', email: '', phone: '', company: '',
  linkedin: '', website: '', buybox_notes: '', additional_context: '',
});

const defData = () => ({ buyers: {} });

function loadData() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || defData(); }
  catch { return defData(); }
}

function authHeaders() {
  const creds = getAuth();
  return creds ? { Authorization: `Basic ${creds}` } : {};
}

// ─── BsField helper ───────────────────────────────────────────────────────────

function BsField({ label, children, span2 = false }) {
  return (
    <div style={{ marginBottom: 14, gridColumn: span2 ? '1 / -1' : undefined }}>
      <label className="bs-label">{label}</label>
      {children}
    </div>
  );
}

// ─── FrameworkStage accordion ─────────────────────────────────────────────────

function FrameworkStage({ stage, data, open, onToggle }) {
  if (!data) return null;
  const { label, emoji, color } = stage;
  const allQuestions = (data.questions || []).map((q, i) => `${i + 1}. ${q}`).join('\n');
  const allPoints    = (data.talking_points || []).map((tp, i) => `${i + 1}. ${tp}`).join('\n');

  return (
    <div className="bs-accordion" style={{ borderColor: open ? color : undefined, marginBottom: 8 }}>
      <button className="bs-accordion-header" onClick={onToggle}>
        <span style={{ fontSize: 18 }}>{emoji}</span>
        <span className="bs-accordion-title">{label}</span>
        <span style={{ color, fontSize: 16, transition: 'transform 0.2s', transform: open ? 'rotate(90deg)' : 'none', display: 'inline-block' }}>▸</span>
      </button>
      {open && (
        <div className="bs-accordion-body">
          {/* Overview */}
          <div style={{ marginBottom: 18 }}>
            <div className="bs-label" style={{ color, marginBottom: 8 }}>Stage Overview</div>
            <p style={{ margin: 0, color: '#cbd5e1', fontSize: 14, lineHeight: 1.75 }}>{data.overview}</p>
          </div>

          {/* Questions */}
          {data.questions?.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div className="bs-label" style={{ margin: 0 }}>Questions to Ask</div>
                <CopyBtn text={allQuestions} title="Copy all questions" />
              </div>
              {data.questions.map((q, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'flex-start' }}>
                  <span style={{
                    width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                    background: `${color}22`, border: `1px solid ${color}55`,
                    color, fontWeight: 700, fontSize: 11,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>{i + 1}</span>
                  <span style={{ color: '#e2e8f0', fontSize: 14, lineHeight: 1.65, flex: 1, paddingTop: 2 }}>{q}</span>
                  <CopyBtn text={q} title="Copy question" />
                </div>
              ))}
            </div>
          )}

          {/* Talking Points */}
          {data.talking_points?.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div className="bs-label" style={{ margin: 0 }}>Advisor Talking Points</div>
                <CopyBtn text={allPoints} title="Copy all talking points" />
              </div>
              {data.talking_points.map((tp, i) => (
                <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'flex-start' }}>
                  <span style={{ color: '#2eb860', flexShrink: 0, fontSize: 16, lineHeight: 1, marginTop: 2 }}>◆</span>
                  <span style={{ color: '#e2e8f0', fontSize: 14, lineHeight: 1.65, flex: 1 }}>{tp}</span>
                  <CopyBtn text={tp} title="Copy talking point" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── ReportView ───────────────────────────────────────────────────────────────

function buildPlainTextReport(report) {
  const lines = [];
  lines.push(`BUYER INTELLIGENCE REPORT`);
  lines.push(`Generated: ${new Date(report.generatedAt).toLocaleString()}`);
  lines.push('');
  lines.push(`BACKGROUND SUMMARY`);
  lines.push(report.summary || '');
  if (report.personality_type) {
    lines.push('');
    lines.push(`PERSONALITY TYPE: ${report.personality_type}`);
    lines.push(report.personality_rationale || '');
  }
  if (report.online_presence) {
    lines.push('');
    lines.push(`ONLINE PRESENCE`);
    lines.push(report.online_presence);
  }
  if (report.hot_points?.length) {
    lines.push('');
    lines.push('HOT POINTS');
    report.hot_points.forEach((p, i) => lines.push(`${i + 1}. ${p}`));
  }
  if (report.things_to_avoid?.length) {
    lines.push('');
    lines.push('THINGS TO AVOID');
    report.things_to_avoid.forEach((p, i) => lines.push(`${i + 1}. ${p}`));
  }
  FRAMEWORK_STAGES.forEach(({ key, label }) => {
    const s = report.framework?.[key];
    if (!s) return;
    lines.push('');
    lines.push(`── ${label.toUpperCase()} ──`);
    lines.push(s.overview || '');
    if (s.questions?.length) {
      lines.push('');
      lines.push('Questions:');
      s.questions.forEach((q, i) => lines.push(`  ${i + 1}. ${q}`));
    }
    if (s.talking_points?.length) {
      lines.push('');
      lines.push('Talking Points:');
      s.talking_points.forEach((tp, i) => lines.push(`  ${i + 1}. ${tp}`));
    }
  });
  return lines.join('\n');
}

function ReportView({ report, onBack, onRerun }) {
  const [openStage, setOpenStage] = useState('desire');
  const toggle = (key) => setOpenStage(prev => prev === key ? null : key);

  const personalityIcon = PERSONALITY_ICONS[report.personality_type] || '🎯';
  const plainTextReport = buildPlainTextReport(report);

  return (
    <div>
      {/* Report top bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ color: '#2eb860', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 3 }}>
            Buyer Intelligence Report
          </div>
          <div style={{ color: '#64748b', fontSize: 12 }}>
            Generated {new Date(report.generatedAt).toLocaleString()}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <CopyBtn text={plainTextReport} title="Copy full report as plain text" />
          <button className="bs-btn bs-btn-secondary bs-btn-sm" onClick={() => window.print()}>🖨️ Print</button>
          <button className="bs-btn bs-btn-secondary bs-btn-sm" onClick={onRerun}>🔄 Re-run</button>
          <button className="bs-btn bs-btn-secondary bs-btn-sm" onClick={onBack}>← Back</button>
        </div>
      </div>

      {/* Summary card */}
      <div className="bs-card" style={{ marginBottom: 14 }}>
        <div className="bs-card-header">
          <span className="bs-card-title">Background Summary</span>
          {report.personality_type && (
            <span className="bs-archetype-badge">
              {personalityIcon} {report.personality_type}
            </span>
          )}
        </div>
        <div className="bs-card-body">
          <p style={{ margin: '0 0 14px', color: '#cbd5e1', fontSize: 14, lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>
            {report.summary}
          </p>
          {report.personality_rationale && (
            <div className="bs-prompt" style={{ margin: 0 }}>
              <strong style={{ color: '#2eb860' }}>Why this archetype: </strong>
              {report.personality_rationale}
            </div>
          )}
        </div>
      </div>

      {/* Online Presence */}
      {report.online_presence && (
        <div className="bs-card" style={{ marginBottom: 14 }}>
          <div className="bs-card-header"><span className="bs-card-title">🌐 Online Presence</span></div>
          <div className="bs-card-body">
            <p style={{ margin: 0, color: '#cbd5e1', fontSize: 14, lineHeight: 1.7 }}>{report.online_presence}</p>
          </div>
        </div>
      )}

      {/* Hot Points + Things to Avoid */}
      <div className="bs-grid-2" style={{ marginBottom: 14 }}>
        <div className="bs-card">
          <div className="bs-card-header"><span className="bs-card-title">🎯 Hot Points</span></div>
          <div className="bs-card-body">
            {(report.hot_points || []).map((pt, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start' }}>
                <span style={{ color: '#2eb860', fontWeight: 700, fontSize: 15, flexShrink: 0, lineHeight: 1, marginTop: 2 }}>✓</span>
                <span style={{ color: '#e2e8f0', fontSize: 14, lineHeight: 1.65 }}>{pt}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="bs-card">
          <div className="bs-card-header"><span className="bs-card-title">⚠️ Things to Avoid</span></div>
          <div className="bs-card-body">
            {(report.things_to_avoid || []).map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, marginBottom: 10, alignItems: 'flex-start' }}>
                <span style={{ color: '#ef4444', fontWeight: 700, fontSize: 15, flexShrink: 0, lineHeight: 1, marginTop: 2 }}>✗</span>
                <span style={{ color: '#e2e8f0', fontSize: 14, lineHeight: 1.65 }}>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Framework — Call Prep Stages */}
      <div className="bs-card" style={{ marginBottom: 14 }}>
        <div className="bs-card-header">
          <span className="bs-card-title">📋 Call Prep Framework</span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#64748b' }}>Click a stage to expand</span>
            <button
              className="bs-btn bs-btn-secondary bs-btn-sm"
              style={{ fontSize: 10, padding: '3px 9px' }}
              onClick={() => setOpenStage(openStage ? null : 'desire')}
            >
              {openStage ? 'Collapse' : 'Expand All'}
            </button>
          </div>
        </div>
        <div style={{ padding: '12px 12px 4px' }}>
          {FRAMEWORK_STAGES.map(stage => (
            <FrameworkStage
              key={stage.key}
              stage={stage}
              data={report.framework?.[stage.key]}
              open={openStage === stage.key}
              onToggle={() => toggle(stage.key)}
            />
          ))}
        </div>
      </div>

      {/* Raw Research — collapsible */}
      {report.rawResearch && (
        <details style={{ marginBottom: 14 }}>
          <summary style={{ cursor: 'pointer', color: '#64748b', fontSize: 12, userSelect: 'none', padding: '6px 0' }}>
            📄 View Raw Research Data
          </summary>
          <div className="bs-card" style={{ marginTop: 8 }}>
            <div className="bs-card-body">
              <pre style={{ margin: 0, color: '#94a3b8', fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre-wrap', fontFamily: 'monospace', overflowX: 'auto' }}>
                {report.rawResearch}
              </pre>
            </div>
          </div>
        </details>
      )}
    </div>
  );
}

// ─── Loading Screen ───────────────────────────────────────────────────────────

function LoadingScreen({ msg }) {
  return (
    <div style={{ textAlign: 'center', padding: '80px 0' }}>
      <div style={{ fontSize: 40, marginBottom: 18 }}>🔍</div>
      <div style={{ color: '#e2e8f0', fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{msg}</div>
      <div style={{ color: '#64748b', fontSize: 13, marginBottom: 32 }}>This takes 60–120 seconds — Claude is searching the web and building your report</div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            width: 10, height: 10, borderRadius: '50%', background: '#2eb860',
            animation: `bi-pulse 1.4s ${i * 0.22}s ease-in-out infinite`,
          }} />
        ))}
      </div>
      <style>{`
        @keyframes bi-pulse {
          0%, 80%, 100% { opacity: 0.2; transform: scale(0.75); }
          40% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}

// ─── InputForm ────────────────────────────────────────────────────────────────

function InputForm({ form, setForm, onSubmit, onCancel, hasExistingReport, onViewReport, error, loading }) {
  return (
    <div className="bs-card">
      <div className="bs-card-header">
        <span className="bs-card-title">Buyer Info</span>
        {hasExistingReport && (
          <button className="bs-btn bs-btn-secondary bs-btn-sm" onClick={onViewReport}>
            View Last Report →
          </button>
        )}
      </div>
      <div className="bs-card-body">
        {error && <div className="bs-error" style={{ marginBottom: 16 }}>{error}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 20px' }}>
          <BsField label="Buyer Name *">
            <input className="bs-input" placeholder="Full name" value={form.buyer_name}
              onChange={e => setForm(f => ({ ...f, buyer_name: e.target.value }))} />
          </BsField>
          <BsField label="Email">
            <input className="bs-input" type="email" placeholder="buyer@email.com" value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          </BsField>
          <BsField label="Phone">
            <input className="bs-input" placeholder="(555) 555-5555" value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          </BsField>
          <BsField label="Company / Employer">
            <input className="bs-input" placeholder="Current company or employer" value={form.company}
              onChange={e => setForm(f => ({ ...f, company: e.target.value }))} />
          </BsField>
          <BsField label="LinkedIn URL">
            <input className="bs-input" placeholder="https://linkedin.com/in/..." value={form.linkedin}
              onChange={e => setForm(f => ({ ...f, linkedin: e.target.value }))} />
          </BsField>
          <BsField label="Website">
            <input className="bs-input" placeholder="https://..." value={form.website}
              onChange={e => setForm(f => ({ ...f, website: e.target.value }))} />
          </BsField>
          <BsField label="Buy Box Notes" span2>
            <textarea className="bs-textarea" rows={3}
              placeholder="Industry preferences, deal size, geography, must-haves, deal-breakers, target SDE…"
              value={form.buybox_notes}
              onChange={e => setForm(f => ({ ...f, buybox_notes: e.target.value }))} />
          </BsField>
          <BsField label="Additional Context" span2>
            <textarea className="bs-textarea" rows={3}
              placeholder="Anything known about this buyer — background, goals, concerns, prior conversation notes, referral source…"
              value={form.additional_context}
              onChange={e => setForm(f => ({ ...f, additional_context: e.target.value }))} />
          </BsField>
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 6 }}>
          {onCancel && (
            <button className="bs-btn bs-btn-secondary" onClick={onCancel}>Cancel</button>
          )}
          <button
            className="bs-btn bs-btn-primary"
            onClick={onSubmit}
            disabled={loading || !form.buyer_name.trim()}
          >
            🔬 Generate Buyer Intel Report
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function BuyerStrategyApp() {
  const [data, setData]           = useState(loadData);
  const [view, setView]           = useState('list'); // 'list' | 'form' | 'loading' | 'report'
  const [form, setForm]           = useState(defForm());
  const [activeBuyerId, setActiveBuyerId] = useState(null);
  const [report, setReport]       = useState(null);
  const [loadingMsg, setLoadingMsg] = useState('');
  const [error, setError]         = useState('');

  // Persist to localStorage whenever data changes
  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  }, [data]);

  const buyers = Object.values(data.buyers).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const activeBuyer = activeBuyerId ? data.buyers[activeBuyerId] : null;

  // ── Actions ────────────────────────────────────────────────────────────────

  function startNew() {
    setForm(defForm());
    setActiveBuyerId(null);
    setReport(null);
    setError('');
    setView('form');
  }

  function openBuyer(buyer) {
    setForm({ ...defForm(), ...buyer.formData });
    setActiveBuyerId(buyer.id);
    setReport(buyer.lastReport || null);
    setError('');
    setView('form');
  }

  function viewExistingReport(buyer) {
    setForm({ ...defForm(), ...buyer.formData });
    setActiveBuyerId(buyer.id);
    setReport(buyer.lastReport);
    setView('report');
  }

  function deleteBuyer(id) {
    if (!confirm('Delete this buyer profile and report?')) return;
    setData(prev => {
      const next = { ...prev, buyers: { ...prev.buyers } };
      delete next.buyers[id];
      return next;
    });
    if (activeBuyerId === id) {
      setActiveBuyerId(null);
      setView('list');
    }
  }

  async function handleGenerate() {
    setError('');
    setLoadingMsg('Researching buyer online…');
    setView('loading');

    // Upsert buyer record
    const id = activeBuyerId || newId();
    const buyerRecord = {
      id,
      formData: { ...form },
      displayName: form.buyer_name || 'Unknown Buyer',
      createdAt: data.buyers[id]?.createdAt || new Date().toISOString(),
      lastReport: data.buyers[id]?.lastReport || null,
    };
    setData(prev => ({ ...prev, buyers: { ...prev.buyers, [id]: buyerRecord } }));
    setActiveBuyerId(id);

    try {
      // Kick off async research
      const startRes = await fetch('/api/buyer-intel/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(form),
      });
      if (!startRes.ok) {
        const errData = await startRes.json().catch(() => ({}));
        throw new Error(errData.error || `Request failed (${startRes.status})`);
      }
      const { jobId } = await startRes.json();

      // Poll until done (6 min timeout — two sequential web-search calls can take 3-4 min)
      const maxWait  = 6 * 60 * 1000;
      const started  = Date.now();
      let result     = null;

      while (Date.now() - started < maxWait) {
        await new Promise(r => setTimeout(r, 5000));

        // Switch message at ~60s (web search call alone can take 60-90s)
        if (Date.now() - started > 60_000) {
          setLoadingMsg('Generating intelligence report…');
        }

        const pollRes = await fetch(`/api/buyer-intel/jobs/${jobId}`, { headers: authHeaders() });

        // Back off if we hit the rate limiter on the poll endpoint
        if (pollRes.status === 429) {
          await new Promise(r => setTimeout(r, 15000));
          continue;
        }
        if (!pollRes.ok) throw new Error(`Poll failed (${pollRes.status})`);

        const pollData = await pollRes.json();

        if (pollData.status === 'complete') { result = pollData.report; break; }
        if (pollData.status === 'error')    { throw new Error(pollData.error || 'Research failed'); }
      }

      if (!result) throw new Error('Research timed out. Please try again.');

      // Save report to buyer record
      setData(prev => ({
        ...prev,
        buyers: { ...prev.buyers, [id]: { ...prev.buyers[id], lastReport: result } },
      }));
      setReport(result);
      setView('report');
    } catch (e) {
      setError(e.message);
      setView('form');
    }
  }

  // ── Header (shared across views) ───────────────────────────────────────────

  function AppHeader({ showBack = false, onBack }) {
    return (
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 2 }}>
          {showBack && (
            <button className="bs-btn bs-btn-secondary bs-btn-sm" onClick={onBack}>← Back</button>
          )}
          <h2 style={{ fontFamily: 'Playfair Display, serif', color: '#2eb860', margin: 0, fontSize: 24 }}>
            Buyer Intelligence
          </h2>
        </div>
        <p style={{ color: '#64748b', fontSize: 14, margin: 0, paddingLeft: showBack ? 70 : 0 }}>
          AI-powered buyer research & call prep reports
        </p>
      </div>
    );
  }

  // ── Views ──────────────────────────────────────────────────────────────────

  if (view === 'loading') {
    return (
      <div className="bs-root">
        <AppHeader />
        <LoadingScreen msg={loadingMsg} />
      </div>
    );
  }

  if (view === 'report' && report) {
    return (
      <div className="bs-root">
        <AppHeader showBack onBack={() => setView('list')} />
        <ReportView
          report={report}
          onBack={() => setView('list')}
          onRerun={() => setView('form')}
        />
      </div>
    );
  }

  if (view === 'form') {
    return (
      <div className="bs-root">
        <AppHeader showBack onBack={() => setView('list')} />
        <InputForm
          form={form}
          setForm={setForm}
          onSubmit={handleGenerate}
          onCancel={() => setView('list')}
          hasExistingReport={!!(activeBuyer?.lastReport)}
          onViewReport={() => { setReport(activeBuyer.lastReport); setView('report'); }}
          error={error}
          loading={false}
        />
      </div>
    );
  }

  // ── List view ──────────────────────────────────────────────────────────────
  return (
    <div className="bs-root">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontFamily: 'Playfair Display, serif', color: '#2eb860', margin: '0 0 4px', fontSize: 24 }}>
            Buyer Intelligence
          </h2>
          <p style={{ color: '#64748b', fontSize: 14, margin: 0 }}>
            AI-powered buyer research & call prep reports
          </p>
        </div>
        <button className="bs-btn bs-btn-primary" onClick={startNew}>+ New Buyer</button>
      </div>

      {buyers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '70px 20px', color: '#64748b' }}>
          <div style={{ fontSize: 44, marginBottom: 16 }}>🎯</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#94a3b8', marginBottom: 8 }}>No buyer profiles yet</div>
          <div style={{ fontSize: 13, marginBottom: 28, maxWidth: 340, margin: '0 auto 28px' }}>
            Add a buyer to generate an AI-powered intelligence report — personality type, hot points, objection prep, and customised call questions.
          </div>
          <button className="bs-btn bs-btn-primary" onClick={startNew}>+ Add First Buyer</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {buyers.map(buyer => (
            <div key={buyer.id} className="bs-card">
              <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                {/* Avatar / icon */}
                <div style={{
                  width: 42, height: 42, borderRadius: '50%',
                  background: 'rgba(46,184,96,0.12)', border: '1px solid rgba(46,184,96,0.3)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, flexShrink: 0,
                }}>
                  {buyer.lastReport
                    ? (PERSONALITY_ICONS[buyer.lastReport.personality_type] || '👤')
                    : '👤'}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#e2e8f0', fontWeight: 600, fontSize: 15, marginBottom: 3 }}>
                    {buyer.displayName}
                  </div>
                  <div style={{ color: '#64748b', fontSize: 12 }}>
                    {[buyer.formData?.email, buyer.formData?.company].filter(Boolean).join(' · ')}
                    {buyer.lastReport && (
                      <>
                        {buyer.formData?.email || buyer.formData?.company ? ' · ' : ''}
                        <span style={{ color: '#2eb860' }}>
                          ✓ Report {new Date(buyer.lastReport.generatedAt).toLocaleDateString()}
                        </span>
                      </>
                    )}
                  </div>
                  {buyer.lastReport?.personality_type && (
                    <div style={{ marginTop: 5 }}>
                      <span className="bs-archetype-badge" style={{ fontSize: 11, padding: '3px 10px' }}>
                        {PERSONALITY_ICONS[buyer.lastReport.personality_type]} {buyer.lastReport.personality_type}
                      </span>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  {buyer.lastReport && (
                    <button className="bs-btn bs-btn-gold bs-btn-sm" onClick={() => viewExistingReport(buyer)}>
                      View Report
                    </button>
                  )}
                  <button className="bs-btn bs-btn-secondary bs-btn-sm" onClick={() => openBuyer(buyer)}>
                    {buyer.lastReport ? 'Re-run' : '🔬 Research'}
                  </button>
                  <button className="bs-btn bs-btn-danger bs-btn-sm" onClick={() => deleteBuyer(buyer.id)}>
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
