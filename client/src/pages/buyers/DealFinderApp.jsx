/**
 * DealFinderApp.jsx
 * Deal Finder — Buyer's Academy automated deal search
 * Peterson Acquisitions | The Deal Team
 *
 * Advisors configure saved search profiles per buyer (industry, location, price range).
 * Each profile runs daily via server cron and emails results to the buyer.
 * "Run Now" previews results immediately in the portal.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { getAuth } from '../../api';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function authHeaders() {
  const a = getAuth();
  return a ? { Authorization: `Basic ${a}` } : {};
}

const fmtPrice = v => {
  if (!v && v !== 0) return '';
  return '$' + Number(v).toLocaleString();
};

const pn = v => {
  const n = parseInt(String(v).replace(/[^0-9]/g, ''), 10);
  return isNaN(n) ? 0 : n;
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function Spinner({ size = 20 }) {
  return (
    <span style={{
      display: 'inline-block', width: size, height: size, borderRadius: '50%',
      border: `${Math.max(2, size / 8)}px solid rgba(46,184,96,.2)`,
      borderTopColor: '#2eb860', animation: 'df-spin .7s linear infinite',
      verticalAlign: 'middle', flexShrink: 0,
    }} />
  );
}

function Badge({ children, color = '#2eb860', bg = 'rgba(46,184,96,.12)' }) {
  return (
    <span style={{
      fontSize: 9, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase',
      color, background: bg, border: `1px solid ${color}33`, borderRadius: 3,
      padding: '2px 7px', flexShrink: 0,
    }}>{children}</span>
  );
}

function PriceInput({ label, value, onChange, placeholder }) {
  const [raw, setRaw] = useState(value ? String(value) : '');

  useEffect(() => { setRaw(value ? String(value) : ''); }, [value]);

  return (
    <div>
      <label style={S.label}>{label}</label>
      <input
        type="text"
        value={raw ? fmtPrice(pn(raw)) : ''}
        onChange={e => {
          const digits = e.target.value.replace(/[^0-9]/g, '');
          setRaw(digits);
          onChange(digits ? parseInt(digits, 10) : 0);
        }}
        placeholder={placeholder || '$0'}
        style={S.input}
      />
    </div>
  );
}

// ─── Listing Cards ────────────────────────────────────────────────────────────

function OnMarketCard({ listing: l }) {
  return (
    <div style={S.resultCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#e2e8f0', marginBottom: 3 }}>{l.name || 'Confidential Listing'}</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>{l.location || ''}{l.location && l.source_platform ? ' · ' : ''}{l.source_platform || ''}</div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#2eb860' }}>{l.asking_price || 'N/A'}</div>
          <div style={{ fontSize: 11, color: '#64748b' }}>Asking Price</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 20, marginBottom: 10, flexWrap: 'wrap' }}>
        {[['Revenue', l.gross_revenue], ['Cash Flow', l.cash_flow], ['Broker', l.broker_name]].map(([lbl, val]) => val && val !== 'N/A' && val !== 'Not Disclosed' ? (
          <div key={lbl}>
            <div style={S.metaLbl}>{lbl}</div>
            <div style={S.metaVal}>{val}</div>
          </div>
        ) : null)}
      </div>

      {l.description && <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.65, marginBottom: 12 }}>{l.description}</div>}

      {l.listing_url && l.listing_url !== 'N/A' && (
        <a href={l.listing_url} target="_blank" rel="noopener noreferrer" style={S.linkBtn}>
          View Listing →
        </a>
      )}
    </div>
  );
}

function OffMarketCard({ prospect: p }) {
  return (
    <div style={S.resultCard}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10, gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#e2e8f0', marginBottom: 3 }}>{p.name || 'Unknown Business'}</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>{p.address || ''}</div>
        </div>
        <Badge color="#94a3b8" bg="rgba(148,163,184,.1)">Off-Market</Badge>
      </div>

      <div style={{ display: 'flex', gap: 20, marginBottom: 10, flexWrap: 'wrap' }}>
        {p.google_rating && p.google_rating !== 'Not Found' && (
          <div><div style={S.metaLbl}>Rating</div><div style={S.metaVal}>{p.google_rating}</div></div>
        )}
        {p.years_in_business && p.years_in_business !== 'Unknown' && (
          <div><div style={S.metaLbl}>In Business</div><div style={S.metaVal}>{p.years_in_business}</div></div>
        )}
        {p.estimated_revenue_range && (
          <div><div style={S.metaLbl}>Est. Revenue</div><div style={S.metaVal}>{p.estimated_revenue_range}</div></div>
        )}
        {p.owner_name && p.owner_name !== 'Not Found' && (
          <div><div style={S.metaLbl}>Owner</div><div style={S.metaVal}>{p.owner_name}</div></div>
        )}
      </div>

      {p.why_good_prospect && (
        <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.65, padding: '9px 13px', background: 'rgba(46,184,96,.06)', borderLeft: '3px solid #2eb860', borderRadius: '0 4px 4px 0', marginBottom: 10 }}>
          {p.why_good_prospect}
        </div>
      )}

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        {p.phone && p.phone !== 'Not Found' && <span style={{ fontSize: 13, color: '#64748b' }}>📞 {p.phone}</span>}
        {p.website && p.website !== 'Not Found' && (
          <a href={p.website.startsWith('http') ? p.website : `https://${p.website}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: '#2eb860', textDecoration: 'none' }}>🌐 Website</a>
        )}
      </div>
    </div>
  );
}

// ─── Results Panel ────────────────────────────────────────────────────────────

function ResultsPanel({ results, profile, buyerEmail, emailStatus, emailError, onClose }) {
  const onMarket  = results?.onMarket  || [];
  const offMarket = results?.offMarket || [];

  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#e2e8f0' }}>Search Results</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>
            {onMarket.length} on-market listing{onMarket.length !== 1 ? 's' : ''} · {offMarket.length} off-market prospect{offMarket.length !== 1 ? 's' : ''}
          </div>
        </div>
        <button onClick={onClose} style={{ ...S.ghostBtn, padding: '5px 12px', fontSize: 12 }}>✕ Close</button>
      </div>

      {/* Email status banner */}
      {emailStatus === 'sent' && (
        <div style={{ background: 'rgba(46,184,96,.08)', border: '1px solid rgba(46,184,96,.25)', borderRadius: 6, padding: '9px 14px', marginBottom: 14, fontSize: 13, color: '#2eb860' }}>
          ✓ Email delivered to <strong>{buyerEmail}</strong>
        </div>
      )}
      {emailStatus === 'failed' && (
        <div style={{ background: 'rgba(220,38,38,.08)', border: '1px solid rgba(239,68,68,.3)', borderRadius: 6, padding: '9px 14px', marginBottom: 14, fontSize: 13, color: '#f87171' }}>
          ✗ Email not sent — {emailError || 'unknown error'}
        </div>
      )}

      {/* On-Market */}
      <div style={{ marginBottom: 24 }}>
        <div style={S.sectionHd}>
          <span style={S.sectionNum}>01</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>On-Market Listings</span>
          <span style={{ fontSize: 12, color: '#64748b', marginLeft: 8 }}>BizBuySell · BizQuest · Sunbelt · Murphy Business · more</span>
        </div>
        {onMarket.length ? (
          onMarket.map((l, i) => <OnMarketCard key={i} listing={l} />)
        ) : (
          <div style={{ padding: '16px', background: '#161b27', border: '1px solid #1e2d45', borderRadius: 8 }}>
            <div style={S.emptyNote}>No on-market listings could be extracted for these criteria — listing sites require login for full details.</div>
            <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
              {[
                { label: 'Search BizBuySell', url: `https://www.bizbuysell.com/businesses-for-sale/?q=${encodeURIComponent(profile?.industry || '')}` },
                { label: 'Search BizQuest', url: `https://www.bizquest.com/business-for-sale/?kw=${encodeURIComponent(profile?.industry || '')}` },
                { label: 'Search BusinessBroker.net', url: `https://www.businessbroker.net/businesses/for-sale/?q=${encodeURIComponent(profile?.industry || '')}` },
              ].map(({ label, url }) => (
                <a key={label} href={url} target="_blank" rel="noopener noreferrer"
                  style={{ fontSize: 12, color: '#2eb860', border: '1px solid rgba(46,184,96,.3)', borderRadius: 4, padding: '6px 12px', textDecoration: 'none' }}>
                  {label} →
                </a>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Off-Market */}
      <div>
        <div style={S.sectionHd}>
          <span style={{ ...S.sectionNum, color: '#94a3b8', background: 'rgba(148,163,184,.1)' }}>02</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>Off-Market Prospects</span>
          <span style={{ fontSize: 12, color: '#64748b', marginLeft: 8 }}>Outreach candidates — not currently listed for sale</span>
        </div>
        {offMarket.length ? (
          offMarket.map((p, i) => <OffMarketCard key={i} prospect={p} />)
        ) : (
          <div style={S.emptyNote}>No off-market prospects found. Try broadening the location or industry description.</div>
        )}
      </div>
    </div>
  );
}

// ─── Profile Form ─────────────────────────────────────────────────────────────

function ProfileForm({ onSave, onCancel, profile }) {
  const isEdit = !!profile;
  const [form, setForm] = useState({
    buyer_name:  profile?.buyer_name  ?? '',
    buyer_email: profile?.buyer_email ?? '',
    industry:    profile?.industry    ?? '',
    location:    profile?.location    ?? '',
    price_min:   profile?.price_min   ?? 500000,
    price_max:   profile?.price_max   ?? 3000000,
    revenue_min: profile?.revenue_min ?? 0,
    revenue_max: profile?.revenue_max ?? 0,
    active:      profile ? !!profile.active : true,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const upd = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.buyer_name.trim() || !form.buyer_email.trim() || !form.industry.trim() || !form.location.trim()) {
      setErr('Buyer name, email, industry, and location are required.');
      return;
    }
    setSaving(true);
    setErr('');
    try {
      const url    = isEdit ? `/api/deal-finder/${profile.id}` : '/api/deal-finder';
      const method = isEdit ? 'PATCH' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(form),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Save failed'); }
      const updated = await res.json();
      onSave(updated);
    } catch (e) {
      setErr(e.message);
      setSaving(false);
    }
  };

  return (
    <div style={{ ...S.card, marginBottom: 20 }}>
      <div style={S.cardHd}>
        <span style={S.cardTitle}>{isEdit ? 'Edit Search Profile' : 'New Search Profile'}</span>
      </div>
      <div style={{ padding: '20px 20px 8px' }}>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div>
            <label style={S.label}>Buyer Name <span style={{ color: '#2eb860' }}>*</span></label>
            <input style={S.input} value={form.buyer_name} onChange={e => upd('buyer_name', e.target.value)} placeholder="e.g. Alex Johnson" />
          </div>
          <div>
            <label style={S.label}>Buyer Email <span style={{ color: '#2eb860' }}>*</span></label>
            <input style={S.input} type="email" value={form.buyer_email} onChange={e => upd('buyer_email', e.target.value)} placeholder="alex@email.com" />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div>
            <label style={S.label}>Industry / Keywords <span style={{ color: '#2eb860' }}>*</span></label>
            <input style={S.input} value={form.industry} onChange={e => upd('industry', e.target.value)} placeholder="e.g. HVAC contractors, auto repair shops" />
          </div>
          <div>
            <label style={S.label}>Location <span style={{ color: '#2eb860' }}>*</span></label>
            <input style={S.input} value={form.location} onChange={e => upd('location', e.target.value)} placeholder="e.g. Phoenix, AZ metro" />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 14, marginBottom: 16 }}>
          <PriceInput label="Min Ask Price" value={form.price_min} onChange={v => upd('price_min', v)} />
          <PriceInput label="Max Ask Price" value={form.price_max} onChange={v => upd('price_max', v)} />
          <PriceInput label="Min Revenue (opt)" value={form.revenue_min} onChange={v => upd('revenue_min', v)} placeholder="$0" />
          <PriceInput label="Max Revenue (opt)" value={form.revenue_max} onChange={v => upd('revenue_max', v)} placeholder="No max" />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
          <label style={{ ...S.label, margin: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={form.active} onChange={e => upd('active', e.target.checked)}
              style={{ width: 15, height: 15, accentColor: '#2eb860', cursor: 'pointer' }} />
            Include in daily automated search (7am MT)
          </label>
        </div>

        {err && <div style={S.error}>{err}</div>}

        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          <button onClick={handleSave} disabled={saving} style={{ ...S.primaryBtn, opacity: saving ? .6 : 1 }}>
            {saving ? <><Spinner size={14} /> &nbsp;Saving…</> : 'Save Profile'}
          </button>
          <button onClick={onCancel} style={S.ghostBtn}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ─── Profile Card ─────────────────────────────────────────────────────────────

function ProfileCard({ profile, onDelete, onToggle, onRunResult, onEdit, onViewLastResults }) {
  const [running, setRunning]   = useState(false);
  const [runPhase, setRunPhase] = useState('');
  const [deleting, setDeleting] = useState(false);

  const priceRange = [
    profile.price_min ? fmtPrice(profile.price_min) : '$0',
    profile.price_max ? fmtPrice(profile.price_max) : 'No max',
  ].join(' – ');

  const lastRun = profile.last_run_at
    ? new Date(profile.last_run_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Never';

  const handleRun = async () => {
    setRunning(true);
    setRunPhase('Starting search…');
    try {
      const startRes = await fetch(`/api/deal-finder/${profile.id}/run`, {
        method: 'POST', headers: authHeaders(),
      });
      if (!startRes.ok) throw new Error('Failed to start search');
      const { jobId } = await startRes.json();

      // Poll every 5s — max 3 min
      setRunPhase('Searching on-market listings…');
      const start = Date.now();
      for (let i = 0; i < 36; i++) {
        await new Promise(r => setTimeout(r, 5000));
        const elapsed = Math.round((Date.now() - start) / 1000);
        if (elapsed > 60) setRunPhase(`Finding off-market prospects… (${elapsed}s)`);
        const pollRes = await fetch(`/api/deal-finder/jobs/${jobId}`, { headers: authHeaders() });
        const job = await pollRes.json();
        if (job.status === 'complete') {
          onRunResult(profile.id, job.results, profile.buyer_email, job.emailStatus, job.emailError);
          return;
        }
        if (job.status === 'error') throw new Error(job.error || 'Search failed');
      }
      throw new Error('Search timed out — please try again');
    } catch (e) {
      alert('Search failed: ' + e.message);
    } finally {
      setRunning(false);
      setRunPhase('');
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`Delete search profile for ${profile.buyer_name}? This cannot be undone.`)) return;
    setDeleting(true);
    try {
      await fetch(`/api/deal-finder/${profile.id}`, { method: 'DELETE', headers: authHeaders() });
      onDelete(profile.id);
    } catch { setDeleting(false); }
  };

  return (
    <div style={{ ...S.card, marginBottom: 12 }}>
      <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'flex-start', gap: 14 }}>

        {/* Active dot */}
        <div style={{ flexShrink: 0, marginTop: 3 }}>
          <div style={{
            width: 10, height: 10, borderRadius: '50%',
            background: profile.active ? '#2eb860' : '#334155',
            boxShadow: profile.active ? '0 0 6px rgba(46,184,96,.5)' : 'none',
          }} />
        </div>

        {/* Main info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0' }}>{profile.buyer_name}</span>
            <Badge color={profile.active ? '#2eb860' : '#64748b'} bg={profile.active ? 'rgba(46,184,96,.1)' : 'rgba(100,116,139,.1)'}>
              {profile.active ? 'Active — Daily 7am MT' : 'Paused'}
            </Badge>
          </div>
          <div style={{ fontSize: 13, color: '#64748b', marginBottom: 2 }}>{profile.buyer_email}</div>
          <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 6 }}>
            <span style={{ color: '#2eb860', fontWeight: 600 }}>{profile.industry}</span>
            <span style={{ color: '#334155', margin: '0 6px' }}>·</span>
            {profile.location}
            <span style={{ color: '#334155', margin: '0 6px' }}>·</span>
            {priceRange}
          </div>
          <div style={{ fontSize: 11, color: '#334155', marginTop: 6 }}>
            Last run: {lastRun}
            {profile.last_results && (
              <button
                onClick={() => onViewLastResults(profile)}
                style={{ marginLeft: 10, background: 'transparent', border: 'none', color: '#2eb860', fontSize: 11, fontWeight: 600, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
              >
                View Results
              </button>
            )}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0, alignItems: 'flex-end' }}>
          <button
            onClick={handleRun}
            disabled={running}
            style={{ ...S.primaryBtn, padding: '6px 14px', fontSize: 12, minWidth: 100, opacity: running ? .7 : 1 }}
          >
            {running ? <><Spinner size={12} />&nbsp;{runPhase || 'Running…'}</> : '▶ Run Now'}
          </button>
          <button
            onClick={() => onEdit(profile)}
            style={{ ...S.ghostBtn, padding: '5px 10px', fontSize: 11 }}
          >
            ✏ Edit
          </button>
          <button
            onClick={() => onToggle(profile.id)}
            style={{ ...S.ghostBtn, padding: '5px 10px', fontSize: 11 }}
          >
            {profile.active ? '⏸ Pause' : '▶ Activate'}
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            style={{ ...S.dangerBtn, padding: '5px 10px', fontSize: 11, opacity: deleting ? .6 : 1 }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = {
  card:      { background: '#1e293b', borderRadius: 8, border: '1px solid #2d3748', overflow: 'hidden' },
  cardHd:    { padding: '13px 18px', borderBottom: '1px solid #1a2235', background: '#161f2e', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: { fontFamily: 'Oswald, sans-serif', fontWeight: 600, fontSize: 13, textTransform: 'uppercase', letterSpacing: .5, color: '#e2e8f0' },
  label:     { display: 'block', fontSize: 11, fontWeight: 500, color: '#94a3b8', marginBottom: 5, letterSpacing: .3 },
  input:     { fontFamily: 'inherit', fontSize: 14, padding: '8px 11px', border: '1.5px solid #334155', borderRadius: 4, width: '100%', background: '#0d1117', color: '#e2e8f0', boxSizing: 'border-box', outline: 'none' },
  primaryBtn: { background: '#2eb860', color: '#fff', border: 'none', borderRadius: 4, fontSize: 13, fontWeight: 600, padding: '8px 18px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 },
  ghostBtn:  { background: 'transparent', color: '#64748b', border: '1px solid #2d3748', borderRadius: 4, fontSize: 13, fontWeight: 500, padding: '7px 14px', cursor: 'pointer' },
  dangerBtn: { background: 'transparent', color: '#ef4444', border: '1px solid rgba(239,68,68,.3)', borderRadius: 4, fontSize: 13, fontWeight: 500, padding: '7px 14px', cursor: 'pointer' },
  linkBtn:   { display: 'inline-block', background: '#2eb860', color: '#fff', textDecoration: 'none', fontSize: 12, fontWeight: 600, padding: '6px 14px', borderRadius: 4 },
  error:     { background: 'rgba(220,38,38,.1)', color: '#f87171', borderLeft: '4px solid #ef4444', padding: '10px 14px', borderRadius: '0 6px 6px 0', fontSize: 13, marginBottom: 14 },
  resultCard: { background: '#161b27', border: '1px solid #1e2d45', borderRadius: 8, padding: '16px 18px', marginBottom: 10 },
  sectionHd: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, paddingBottom: 10, borderBottom: '1px solid #1a2235' },
  sectionNum: { fontFamily: 'Oswald, sans-serif', fontSize: 10, fontWeight: 700, color: '#2eb860', background: 'rgba(46,184,96,.1)', borderRadius: 3, padding: '2px 7px' },
  metaLbl:   { fontSize: 10, color: '#64748b', textTransform: 'uppercase', letterSpacing: .5, marginBottom: 2 },
  metaVal:   { fontSize: 13, color: '#94a3b8' },
  emptyNote: { color: '#64748b', fontStyle: 'italic', fontSize: 13, padding: '18px 0', textAlign: 'center' },
};

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function DealFinderApp() {
  const [profiles, setProfiles]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [editingProfile, setEditingProfile] = useState(null); // profile object being edited
  const [activeResult, setActiveResult] = useState(null); // { profileId, results, buyerEmail, emailStatus, emailError }

  const fetchProfiles = useCallback(async () => {
    try {
      const res = await fetch('/api/deal-finder', { headers: authHeaders() });
      const data = await res.json();
      setProfiles(Array.isArray(data) ? data : []);
    } catch { /* ignore */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

  const handleSave = (updated) => {
    if (editingProfile) {
      // Merge updated profile back into list without a full refetch
      setProfiles(prev => prev.map(p => p.id === updated.id ? updated : p));
      setEditingProfile(null);
    } else {
      setShowForm(false);
      fetchProfiles();
    }
  };

  const handleEdit = (profile) => {
    setShowForm(false);
    setEditingProfile(profile);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (id) => {
    setProfiles(prev => prev.filter(p => p.id !== id));
    if (activeResult?.profileId === id) setActiveResult(null);
  };

  const handleToggle = async (id) => {
    try {
      const res = await fetch(`/api/deal-finder/${id}/toggle`, { method: 'PATCH', headers: authHeaders() });
      const { active } = await res.json();
      setProfiles(prev => prev.map(p => p.id === id ? { ...p, active } : p));
    } catch { /* ignore */ }
  };

  const handleRunResult = (profileId, results, buyerEmail, emailStatus, emailError) => {
    const profile = profiles.find(p => p.id === profileId);
    // Also update the profile's last_results in local state
    setProfiles(prev => prev.map(p => p.id === profileId ? { ...p, last_results: results, last_run_at: new Date().toISOString() } : p));
    setActiveResult({ profileId, results, profile, buyerEmail, emailStatus, emailError });
    setTimeout(() => document.getElementById('df-results')?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  const handleViewLastResults = (profile) => {
    setActiveResult({ profileId: profile.id, results: profile.last_results, profile, buyerEmail: profile.buyer_email, emailStatus: null, emailError: null });
    setTimeout(() => document.getElementById('df-results')?.scrollIntoView({ behavior: 'smooth' }), 100);
  };

  return (
    <>
      <style>{`
        @keyframes df-spin { to { transform: rotate(360deg); } }
        input:focus { border-color: #2eb860 !important; }
        input::placeholder { color: #334155; }
      `}</style>

      <div style={{ padding: 28, fontFamily: 'system-ui, -apple-system, sans-serif' }}>

        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#e2e8f0', marginBottom: 4 }}>Deal Finder</div>
          <div style={{ fontSize: 13, color: '#64748b' }}>
            Buyer's Academy — automated deal search emailed daily to each buyer
          </div>
        </div>

        {/* Info banner */}
        <div style={{ background: 'rgba(46,184,96,.07)', border: '1px solid rgba(46,184,96,.2)', borderRadius: 8, padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#94a3b8', lineHeight: 1.6 }}>
          <strong style={{ color: '#2eb860' }}>How it works:</strong> Create a search profile for each Buyer's Academy member. The system runs every morning at 7am MT, searches on-market listings (BizBuySell, BizQuest, Sunbelt, Murphy Business, etc.) and off-market prospects, then emails a formatted report to the buyer. Use <strong style={{ color: '#e2e8f0' }}>Run Now</strong> to preview results immediately.
        </div>

        {/* Edit form — shown inline above the list when editing */}
        {editingProfile && (
          <ProfileForm
            profile={editingProfile}
            onSave={handleSave}
            onCancel={() => setEditingProfile(null)}
          />
        )}

        {/* New profile button / form */}
        {!editingProfile && (
          !showForm ? (
            <button onClick={() => setShowForm(true)} style={{ ...S.primaryBtn, marginBottom: 20 }}>
              + New Search Profile
            </button>
          ) : (
            <ProfileForm onSave={handleSave} onCancel={() => setShowForm(false)} />
          )
        )}

        {/* Profile list */}
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#64748b', padding: '32px 0' }}>
            <Spinner /> Loading profiles…
          </div>
        ) : profiles.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: '#64748b' }}>
            <div style={{ fontSize: 36, marginBottom: 14 }}>🔍</div>
            <div style={{ fontSize: 17, fontWeight: 600, color: '#94a3b8', marginBottom: 8 }}>No search profiles yet</div>
            <div style={{ fontSize: 13, marginBottom: 20 }}>Create your first profile to start finding deals for Buyer's Academy members.</div>
            <button onClick={() => setShowForm(true)} style={S.primaryBtn}>+ Create First Profile</button>
          </div>
        ) : (
          profiles.map(p => (
            <ProfileCard
              key={p.id}
              profile={p}
              onDelete={handleDelete}
              onToggle={handleToggle}
              onRunResult={handleRunResult}
              onEdit={handleEdit}
              onViewLastResults={handleViewLastResults}
            />
          ))
        )}

        {/* Results panel */}
        {activeResult && (
          <div id="df-results">
            <ResultsPanel
              results={activeResult.results}
              profile={activeResult.profile}
              buyerEmail={activeResult.buyerEmail}
              emailStatus={activeResult.emailStatus}
              emailError={activeResult.emailError}
              onClose={() => setActiveResult(null)}
            />
          </div>
        )}

      </div>
    </>
  );
}
