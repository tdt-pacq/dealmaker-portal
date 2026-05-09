import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { fetchDeal, createDeal, updateDeal } from '../api';
import InterviewForm from '../components/InterviewForm';
import DocumentExtractor from '../components/DocumentExtractor';

const ADVISORS = ['Michael', 'Robin', 'Alisha', 'Lee', 'Lance'];

export default function NewDeal() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [deal, setDeal] = useState(null);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // New deal form state
  const [dealName, setDealName] = useState('');
  const [advisorName, setAdvisorName] = useState('');
  const [status, setStatus] = useState('draft');
  const [step, setStep] = useState(isEdit ? 'form' : 'meta');

  useEffect(() => {
    if (isEdit) {
      fetchDeal(id).then(res => {
        setDeal(res.data);
        setDealName(res.data.deal_name);
        setAdvisorName(res.data.advisor_name || '');
        setStatus(res.data.status || 'draft');
        setLoading(false);
      }).catch(() => {
        setError('Deal not found');
        setLoading(false);
      });
    }
  }, [id]);

  const handleCreateDeal = async (e) => {
    e.preventDefault();
    if (!dealName.trim()) { setError('Deal name is required'); return; }
    setSaving(true);
    try {
      const res = await createDeal({ deal_name: dealName, advisor_name: advisorName, status });
      navigate(`/marketing/deals/${res.data.id}/edit`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create deal');
      setSaving(false);
    }
  };

  const handleMetaUpdate = async () => {
    if (!deal) return;
    try {
      await updateDeal(deal.id, { deal_name: dealName, advisor_name: advisorName, status });
    } catch { /* autosave — silent fail */ }
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <div className="spinner spinner-dark" style={{ width: 32, height: 32, borderWidth: 4, display: 'inline-block' }} />
        <div style={{ marginTop: 12, color: '#64748b' }}>Loading deal…</div>
      </div>
    );
  }

  // Step 1: Create new deal (meta info)
  if (!isEdit && step === 'meta') {
    return (
      <>
        <div className="page-header">
          <div>
            <div className="page-title">New Deal</div>
            <div className="page-subtitle">Start by naming this deal and assigning an advisor</div>
          </div>
          <Link to="/marketing"><button className="btn-ghost">← Back to Dashboard</button></Link>
        </div>
        <div style={{ maxWidth: 520 }}>
          <div className="card">
            <div className="card-header"><span className="card-title">Deal Information</span></div>
            <div className="card-body">
              <form onSubmit={handleCreateDeal}>
                {error && <div className="alert alert-error">{error}</div>}
                <div className="field-group">
                  <label>Deal Name <span className="required">*</span></label>
                  <input type="text" value={dealName} onChange={e => setDealName(e.target.value)}
                    placeholder="e.g. Nursery - NC - 2025" autoFocus />
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>
                    Internal reference only. Not shown in any marketing outputs.
                  </div>
                </div>
                <div className="field-group">
                  <label>Assigned Advisor</label>
                  <select value={advisorName} onChange={e => setAdvisorName(e.target.value)}>
                    <option value="">Unassigned</option>
                    {ADVISORS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div className="field-group">
                  <label>Status</label>
                  <select value={status} onChange={e => setStatus(e.target.value)}>
                    <option value="draft">Draft</option>
                    <option value="active">Active</option>
                    <option value="closed">Closed</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                  <button type="submit" className="btn-primary btn-lg" disabled={saving}>
                    {saving ? <><span className="spinner" />Creating…</> : 'Create Deal & Start Interview →'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Step 2: Edit mode — show interview form
  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title" style={{ fontSize: 22 }}>
            {deal?.deal_name || dealName}
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 4 }}>
            <span className={`badge badge-${deal?.status || status}`}>{deal?.status || status}</span>
            {deal?.advisor_name && <span style={{ fontSize: 13, color: '#64748b' }}>Advisor: {deal.advisor_name}</span>}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link to={`/marketing/deals/${id}`}>
            <button className="btn-ghost">View Outputs →</button>
          </Link>
          <Link to="/marketing">
            <button className="btn-ghost">← Dashboard</button>
          </Link>
        </div>
      </div>

      {/* Meta info strip */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ padding: '14px 20px' }}>
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <label>Deal Name</label>
              <input type="text" value={dealName} onChange={e => setDealName(e.target.value)} onBlur={handleMetaUpdate} />
            </div>
            <div style={{ width: 160 }}>
              <label>Advisor</label>
              <select value={advisorName} onChange={e => setAdvisorName(e.target.value)} onBlur={handleMetaUpdate}>
                <option value="">Unassigned</option>
                {ADVISORS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div style={{ width: 130 }}>
              <label>Status</label>
              <select value={status} onChange={e => setStatus(e.target.value)} onBlur={handleMetaUpdate}>
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="closed">Closed</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {deal && (() => {
        let currentInterviewData = {};
        try { currentInterviewData = JSON.parse(deal.interview_data || '{}'); } catch { /* */ }
        return (
          <>
            <DocumentExtractor
              deal={deal}
              currentInterviewData={currentInterviewData}
              onApply={async (merged) => {
                await updateDeal(deal.id, { interview_data: JSON.stringify(merged) });
                const r = await fetchDeal(deal.id);
                setDeal(r.data);
              }}
            />
            <InterviewForm
              deal={deal}
              onUpdate={() => fetchDeal(deal.id).then(r => setDeal(r.data))}
            />
          </>
        );
      })()}
    </>
  );
}
