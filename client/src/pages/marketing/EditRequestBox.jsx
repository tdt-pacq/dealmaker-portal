import React, { useCallback, useEffect, useState } from 'react';
import { fetchMarketingVersions, restoreMarketingVersion, reviseMarketing } from '../../api';

const FIELD = {
  blind_ad: 'blind_ad_text',
  flyer: 'flyer_html',
  cbr: 'cbr_html',
};

function when(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

export default function EditRequestBox({ dealId, kind, needsReview, onApplied }) {
  const [request, setRequest] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [versions, setVersions] = useState([]);

  const loadVersions = useCallback(() => {
    fetchMarketingVersions(dealId, kind)
      .then((res) => setVersions(res.data.versions || []))
      .catch(() => setVersions([]));
  }, [dealId, kind]);

  useEffect(() => { loadVersions(); }, [loadVersions]);

  async function applyChange() {
    const instruction = request.trim();
    if (instruction.length < 3) {
      setError('Describe the change you want.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await reviseMarketing({ deal_id: dealId, kind, request: instruction });
      setRequest('');
      onApplied?.(res.data[FIELD[kind]]);
      loadVersions();
    } catch (err) {
      setError(err.response?.data?.error || 'The edit did not apply.');
    } finally {
      setBusy(false);
    }
  }

  async function restore(versionId) {
    setBusy(true);
    setError('');
    try {
      const res = await restoreMarketingVersion(dealId, versionId);
      onApplied?.(res.data[FIELD[kind]]);
      loadVersions();
    } catch (err) {
      setError(err.response?.data?.error || 'Could not restore that version.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="edit-request">
      <label htmlFor={`edit-${kind}`}>Tell it what to change</label>
      <textarea
        id={`edit-${kind}`}
        value={request}
        placeholder="Example: replace Upside with Growth Roadmap"
        onChange={(e) => setRequest(e.target.value)}
        disabled={busy || needsReview}
      />
      <div className="cluster">
        <button type="button" className="btn-primary btn-sm" onClick={applyChange} disabled={busy || needsReview || request.trim().length < 3}>
          {busy ? 'Applying…' : 'Apply change'}
        </button>
        {versions.length > 1 && (
          <button type="button" className="btn-ghost btn-sm" onClick={() => restore(versions[1].id)} disabled={busy}>
            Undo
          </button>
        )}
      </div>
      {needsReview && (
        <p style={{ margin: 0, color: 'var(--text-secondary)' }}>
          Confirm the summary before editing so the locked Valuation SDE stays in place.
        </p>
      )}
      {error && <div className="alert alert-error">{error}</div>}
      {versions.length > 0 && (
        <div>
          <div className="section-label">Recent versions</div>
          <div className="version-list">
            {versions.map((version, index) => (
              <div className="version-row" key={version.id}>
                <span>{when(version.created_at)} · {version.source}{version.note ? ` · ${version.note}` : ''}</span>
                {index > 0 && (
                  <button type="button" className="btn-ghost btn-sm" onClick={() => restore(version.id)} disabled={busy}>
                    Restore
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
