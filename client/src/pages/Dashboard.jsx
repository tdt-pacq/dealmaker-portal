import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchDeals, deleteDeal } from '../api';

const ADVISORS = ['Michael', 'Robin', 'Alisha', 'Lee', 'Lance'];

function StatusBadge({ status }) {
  return <span className={`badge badge-${status}`}>{status}</span>;
}

function fmt(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function Dashboard() {
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterAdvisor, setFilterAdvisor] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filterStatus) params.status = filterStatus;
      if (filterAdvisor) params.advisor = filterAdvisor;
      const res = await fetchDeals(params);
      setDeals(res.data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load deals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [filterStatus, filterAdvisor]);

  const handleDelete = async (id) => {
    try {
      await deleteDeal(id);
      setDeleteConfirm(null);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Delete failed');
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Deal Dashboard</div>
          <div className="page-subtitle">{deals.length} deal{deals.length !== 1 ? 's' : ''} total</div>
        </div>
        <Link to="/marketing/deals/new">
          <button className="btn-primary btn-lg">+ New Deal</button>
        </Link>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <div className="card-header">
          <span className="card-title">All Deals</span>
          <div style={{ display: 'flex', gap: 10 }}>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              style={{ width: 130 }}
            >
              <option value="">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="under_contract">Under Contract</option>
              <option value="closed">Closed</option>
              <option value="withdrawn">Withdrawn</option>
            </select>
            <select
              value={filterAdvisor}
              onChange={e => setFilterAdvisor(e.target.value)}
              style={{ width: 140 }}
            >
              <option value="">All Advisors</option>
              {ADVISORS.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#64748b' }}>
            <div className="spinner spinner-dark" style={{ width: 24, height: 24, borderWidth: 3, display: 'inline-block' }} />
            <div style={{ marginTop: 10, fontSize: 14 }}>Loading deals…</div>
          </div>
        ) : deals.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <div className="empty-state-title">No Deals Yet</div>
            <p>Create your first deal to get started building marketing materials.</p>
            <div style={{ marginTop: 20 }}>
              <Link to="/marketing/deals/new">
                <button className="btn-primary">Create First Deal</button>
              </Link>
            </div>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Deal Name</th>
                <th>Advisor</th>
                <th>Status</th>
                <th>Created</th>
                <th>Last Updated</th>
                <th>Outputs</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {deals.map(deal => (
                <tr key={deal.id}>
                  <td>
                    <Link to={`/marketing/deals/${deal.id}`} style={{ fontWeight: 600, color: '#e2e8f0' }}>
                      {deal.deal_name}
                    </Link>
                  </td>
                  <td>{deal.advisor_name || '—'}</td>
                  <td><StatusBadge status={deal.status} /></td>
                  <td style={{ color: '#888', fontSize: 13 }}>{fmt(deal.created_at)}</td>
                  <td style={{ color: '#888', fontSize: 13 }}>{fmt(deal.updated_at)}</td>
                  <td>
                    <OutputDots dealId={deal.id} />
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn-ghost btn-sm" onClick={() => navigate(`/marketing/deals/${deal.id}`)}>
                        View
                      </button>
                      <button className="btn-ghost btn-sm" onClick={() => navigate(`/marketing/deals/${deal.id}/edit`)}>
                        Edit
                      </button>
                      <button className="btn-danger btn-sm" onClick={() => setDeleteConfirm(deal)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Delete confirm modal */}
      {deleteConfirm && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-title">Delete Deal?</div>
            <p style={{ fontSize: 13, color: '#94a3b8', marginBottom: 20, lineHeight: 1.6 }}>
              Are you sure you want to delete <strong style={{ color: '#e2e8f0' }}>{deleteConfirm.deal_name}</strong>?
              This will permanently remove the deal and all generated files.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn-ghost" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="btn-danger" onClick={() => handleDelete(deleteConfirm.id)}>
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function OutputDots({ dealId }) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <DotLink to={`/marketing/deals/${dealId}`} label="Ad" />
      <DotLink to={`/marketing/deals/${dealId}`} label="Flyer" />
      <DotLink to={`/marketing/deals/${dealId}`} label="CBR" />
    </div>
  );
}

function DotLink({ to, label }) {
  return (
    <Link to={to} style={{ fontSize: 11, padding: '2px 7px', background: '#1e293b', borderRadius: 10, color: '#64748b', fontWeight: 500, border: '1px solid #2d3748' }}>
      {label}
    </Link>
  );
}
