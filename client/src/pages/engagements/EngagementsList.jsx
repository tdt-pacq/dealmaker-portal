import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  fetchProposals,
  createProposal,
  deleteProposal,
  fetchDeals,
  fetchDiscoveryRecent,
  fetchCurrentUser,
} from '../../api';

function fmt(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const emptyForm = {
  sellerNames: '',
  spouseName: '',
  brokerName: '',
  blindCompanyLabel: '',
  deal_id: '',
  discovery_report_id: '',
  analyzer_deal_slug: '',
};

export default function EngagementsList() {
  const navigate = useNavigate();
  const [proposals, setProposals] = useState([]);
  const [deals, setDeals] = useState([]);
  const [reports, setReports] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [p, d, r, me] = await Promise.all([
        fetchProposals(),
        fetchDeals().catch(() => ({ data: [] })),
        fetchDiscoveryRecent().catch(() => ({ data: [] })),
        fetchCurrentUser().catch(() => ({ data: null })),
      ]);
      setProposals(p.data);
      setDeals(d.data || []);
      setReports(r.data || []);
      if (me.data?.display_name) {
        setForm(f => f.brokerName ? f : { ...f, brokerName: me.data.display_name });
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load proposals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }));

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      const res = await createProposal({
        deal_id: form.deal_id || null,
        discovery_report_id: form.discovery_report_id || null,
        analyzer_deal_slug: form.analyzer_deal_slug.trim(),
        packet: {
          cover: {
            sellerNames: form.sellerNames.trim(),
            spouseName: form.spouseName.trim(),
            brokerName: form.brokerName.trim(),
            blindCompanyLabel: form.blindCompanyLabel.trim(),
          },
        },
      });
      navigate(`/engagements/${res.data.share_token}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not create proposal');
      setCreating(false);
    }
  };

  const copyUrl = async (token, id) => {
    const url = `${window.location.origin}/engagements/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      setTimeout(() => setCopiedId(''), 2000);
    } catch {
      window.prompt('Copy private URL', url);
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteProposal(id);
      setDeleteConfirm(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Delete failed');
    }
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <div className="page-title">Seller Engagement Proposal</div>
          <div className="page-subtitle">
            Post–MPA + BIR private walkthrough page. Discovery-only is not the full proposal moment.
          </div>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <span className="card-title">New proposal</span>
          <span style={{ fontSize: 11, color: '#64748b' }}>Creates an unguessable private URL</span>
        </div>
        <form onSubmit={handleCreate} className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
            <div className="field-group" style={{ marginBottom: 0 }}>
              <label>Seller name(s)</label>
              <input value={form.sellerNames} onChange={e => set('sellerNames', e.target.value)} placeholder="Seller / owners" />
            </div>
            <div className="field-group" style={{ marginBottom: 0 }}>
              <label>Spouse</label>
              <input value={form.spouseName} onChange={e => set('spouseName', e.target.value)} placeholder="If applicable" />
            </div>
            <div className="field-group" style={{ marginBottom: 0 }}>
              <label>Broker / advisor</label>
              <input value={form.brokerName} onChange={e => set('brokerName', e.target.value)} placeholder="Advisor name" />
            </div>
            <div className="field-group" style={{ marginBottom: 0 }}>
              <label>Blind company label</label>
              <input value={form.blindCompanyLabel} onChange={e => set('blindCompanyLabel', e.target.value)} placeholder="e.g. Specialty manufacturer — SE" />
            </div>
            <div className="field-group" style={{ marginBottom: 0 }}>
              <label>MPA hook (analyzer deal slug)</label>
              <input value={form.analyzer_deal_slug} onChange={e => set('analyzer_deal_slug', e.target.value)} placeholder="firestore deal slug — no invented numbers" />
            </div>
            <div className="field-group" style={{ marginBottom: 0 }}>
              <label>BIR / Business Intel hook</label>
              <select value={form.discovery_report_id} onChange={e => set('discovery_report_id', e.target.value)}>
                <option value="">None — fill later</option>
                {reports.map(r => (
                  <option key={r.id} value={r.id}>
                    {(r.business_name || r.industry || 'Report')} {r.seller_name ? `· ${r.seller_name}` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="field-group" style={{ marginBottom: 0, gridColumn: '1 / 3' }}>
              <label>Deal Marketing hook</label>
              <select value={form.deal_id} onChange={e => set('deal_id', e.target.value)}>
                <option value="">None — fill later</option>
                {deals.map(d => (
                  <option key={d.id} value={d.id}>{d.deal_name} {d.advisor_name ? `· ${d.advisor_name}` : ''}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ marginTop: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: 12, color: '#64748b', maxWidth: 640 }}>
              Per-seller packet only. Firmwide 12-section skeleton is fixed. MPA sellability / FMV stay blank until sourced — no invented numbers.
            </div>
            <button type="submit" className="btn-primary btn-lg" disabled={creating}>
              {creating ? 'Creating…' : 'Create private proposal →'}
            </button>
          </div>
        </form>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Proposals</span>
          <span style={{ fontSize: 12, color: '#64748b' }}>{proposals.length} total</span>
        </div>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
            <div className="spinner spinner-dark" style={{ width: 24, height: 24, borderWidth: 3, display: 'inline-block' }} />
            <div style={{ marginTop: 10, fontSize: 14 }}>Loading…</div>
          </div>
        ) : proposals.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🤝</div>
            <div className="empty-state-title">No proposals yet</div>
            <p>Create a private URL after Trifecta Market Price and BIR are in hand.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Blind label</th>
                <th>Seller</th>
                <th>Advisor</th>
                <th>Hooks</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {proposals.map(p => {
                const cover = p.packet?.cover || {};
                const hooks = [];
                if (p.analyzer_deal_slug) hooks.push('MPA');
                if (p.discovery_report_id) hooks.push('BIR');
                if (p.deal_id) hooks.push('Deal');
                return (
                  <tr key={p.id}>
                    <td>
                      <Link to={`/engagements/${p.share_token}`} style={{ fontWeight: 600, color: '#e2e8f0' }}>
                        {cover.blindCompanyLabel || cover.proposalId || 'Untitled proposal'}
                      </Link>
                      <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{cover.proposalId}</div>
                    </td>
                    <td>{cover.sellerNames || '—'}</td>
                    <td>{cover.brokerName || p.created_by_display_name || '—'}</td>
                    <td style={{ color: '#94a3b8', fontSize: 12 }}>{hooks.length ? hooks.join(' · ') : '—'}</td>
                    <td>{fmt(p.updated_at)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Link to={`/engagements/${p.share_token}`}>
                          <button className="btn-ghost btn-sm">Open</button>
                        </Link>
                        <button className="btn-ghost btn-sm" onClick={() => copyUrl(p.share_token, p.id)}>
                          {copiedId === p.id ? 'Copied' : 'Copy URL'}
                        </button>
                        {deleteConfirm === p.id ? (
                          <>
                            <button className="btn-danger btn-sm" onClick={() => handleDelete(p.id)}>Confirm</button>
                            <button className="btn-ghost btn-sm" onClick={() => setDeleteConfirm(null)}>Cancel</button>
                          </>
                        ) : (
                          <button className="btn-ghost btn-sm" onClick={() => setDeleteConfirm(p.id)}>Delete</button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
