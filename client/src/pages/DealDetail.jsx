import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import {
  fetchDeal, updateDeal,
  generateBlindAd, generateFlyer, generateCbr,
  exportFlyer, exportCbr,
  downloadDealPdf, fetchDealEvents
} from '../api';

const PIPELINE_STAGES = ['draft', 'active', 'under_contract', 'closed'];
const STAGE_LABELS = { draft: 'Draft', active: 'Active', under_contract: 'Under Contract', closed: 'Closed' };

function PipelineBar({ status, dealId, onUpdate }) {
  const [saving, setSaving] = useState(false);
  const isWithdrawn = status === 'withdrawn';

  const handleStageClick = async (stage) => {
    if (stage === status || saving) return;
    setSaving(true);
    try {
      await updateDeal(dealId, { status: stage });
      onUpdate();
    } finally {
      setSaving(false);
    }
  };

  const activeIdx = PIPELINE_STAGES.indexOf(status);

  return (
    <div className="pipeline-bar-wrap" style={{ background: 'rgba(255,255,255,0.94)', border: '1px solid #e4dcd2', borderRadius: 8, padding: '14px 20px', marginBottom: 20 }}>
      {isWithdrawn ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%' }}>
          <span style={{ fontSize: 13, color: '#dc2626', fontWeight: 600 }}>⊗ Withdrawn</span>
          <button className="btn-ghost btn-sm" style={{ marginLeft: 'auto' }} onClick={() => handleStageClick('draft')}>
            Reactivate as Draft
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: 0, minWidth: 480 }}>
          {PIPELINE_STAGES.map((stage, i) => {
            const isPast = i < activeIdx;
            const isCurrent = i === activeIdx;
            return (
              <React.Fragment key={stage}>
                <button
                  onClick={() => handleStageClick(stage)}
                  disabled={saving}
                  style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                    background: 'none', border: 'none', cursor: isCurrent ? 'default' : 'pointer',
                    padding: '4px 12px', borderRadius: 6, transition: 'background 0.15s',
                    opacity: saving ? 0.6 : 1,
                  }}
                  title={isCurrent ? `Current stage: ${STAGE_LABELS[stage]}` : `Move to ${STAGE_LABELS[stage]}`}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', border: `2px solid ${isCurrent || isPast ? '#C4592F' : '#e4dcd2'}`,
                    background: isCurrent || isPast ? '#C4592F' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, color: isCurrent || isPast ? '#fff' : '#44403c',
                    fontWeight: 700,
                  }}>
                    {isPast ? '✓' : i + 1}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: isCurrent ? 700 : 400, color: isCurrent ? '#1c1917' : isPast ? '#A34826' : '#44403c', whiteSpace: 'nowrap' }}>
                    {STAGE_LABELS[stage]}
                  </span>
                </button>
                {i < PIPELINE_STAGES.length - 1 && (
                  <div style={{ flex: 1, height: 2, background: isPast ? '#C4592F' : '#e6dfd6', minWidth: 20 }} />
                )}
              </React.Fragment>
            );
          })}
          <button
            className="btn-ghost btn-sm"
            onClick={() => handleStageClick('withdrawn')}
            disabled={saving}
            style={{ marginLeft: 16, color: '#dc2626', flexShrink: 0 }}
            title="Mark as withdrawn"
          >
            ✕ Withdraw
          </button>
        </div>
      )}
    </div>
  );
}

const EVENT_ICONS = {
  deal_created: '🆕',
  status_changed: '🔄',
  blind_ad_generated: '📋',
  flyer_generated: '🗂️',
  cbr_generated: '📊',
  pdf_exported: '↓',
};

function ActivityTab({ dealId }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDealEvents(dealId)
      .then(r => setEvents(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [dealId]);

  function fmtTime(iso) {
    const d = new Date(iso);
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  }

  return (
    <div className="output-panel" style={{ padding: 24 }}>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#57534e' }}>
          <div className="spinner spinner-dark" style={{ width: 24, height: 24, borderWidth: 3, display: 'inline-block' }} />
        </div>
      ) : events.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <div className="empty-state-title">No Activity Yet</div>
          <p>Events are logged when documents are generated, PDFs exported, or the deal status changes.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {events.map((ev, i) => (
            <div key={ev.id} style={{ display: 'flex', gap: 16, paddingBottom: 20, position: 'relative' }}>
              {/* Connector line */}
              {i < events.length - 1 && (
                <div style={{ position: 'absolute', left: 14, top: 30, bottom: 0, width: 2, background: 'rgba(255,255,255,0.94)' }} />
              )}
              <div style={{
                width: 30, height: 30, borderRadius: '50%', background: 'rgba(255,255,255,0.94)', border: '1px solid #e4dcd2',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, flexShrink: 0, zIndex: 1,
              }}>
                {EVENT_ICONS[ev.event_type] || '•'}
              </div>
              <div style={{ paddingTop: 4 }}>
                <div style={{ fontSize: 14, color: '#1c1917', fontWeight: 500 }}>{ev.description}</div>
                <div style={{ fontSize: 12, color: '#57534e', marginTop: 2 }}>
                  {ev.user_display_name} · {fmtTime(ev.created_at)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function friendlyError(err) {
  const status = err.response?.status;
  const msg = (typeof err.response?.data?.error === 'string' && err.response.data.error)
    || err.message
    || '';
  if (status === 401) return 'Session expired — reload the page to log back in.';
  if (status === 429) return msg || 'Rate limit reached — wait a minute then retry.';
  if (status === 504 || err.code === 'ECONNABORTED' || /timeout/i.test(msg))
    return 'Request timed out — the AI service was slow. Try again.';
  if (!navigator.onLine) return 'No internet connection — check your network and retry.';
  if (msg) return msg;
  if (status >= 500) return `Server error (${status}). Try again in a moment.`;
  return 'Generation failed. Please try again.';
}

function useElapsedTimer(running) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!running) { setElapsed(0); return; }
    setElapsed(0);
    const t = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [running]);
  return elapsed;
}

function ErrorAlert({ message, onRetry }) {
  return (
    <div className="alert alert-error" style={{ margin: '16px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
      <span>{message}</span>
      {onRetry && (
        <button className="btn-ghost btn-sm" onClick={onRetry} style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
          ↺ Retry
        </button>
      )}
    </div>
  );
}

function fmt(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit'
  });
}

function fmtMoney(val) {
  if (!val) return '';
  const n = parseFloat(String(val).replace(/[^0-9.]/g, ''));
  if (isNaN(n)) return val;
  return '$' + n.toLocaleString('en-US');
}

// ─── BLIND AD TAB ─────────────────────────────────────────────────────────────
function BlindAdTab({ deal, onUpdate }) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [text, setText] = useState(deal.blind_ad_text || '');

  useEffect(() => setText(deal.blind_ad_text || ''), [deal.blind_ad_text]);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setError('');
    try {
      const res = await generateBlindAd(deal.id);
      setText(res.data.blind_ad_text);
      onUpdate();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setGenerating(false);
    }
  }, [deal.id, onUpdate]);

  const handleSaveEdit = async () => {
    await updateDeal(deal.id, { blind_ad_text: text });
    onUpdate();
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadTxt = () => {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(deal.deal_name || 'blind_ad').replace(/[^a-z0-9]/gi, '_')}_blind_ad.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="output-panel">
      <div className="output-toolbar">
        <button className="btn-primary" onClick={handleGenerate} disabled={generating}>
          {generating
            ? <><span className="spinner" />{text ? 'Regenerating…' : 'Generating…'}</>
            : text ? '↺ Regenerate Blind Ad' : '⚡ Generate Blind Ad'}
        </button>
        {text && (
          <>
            <button className="btn-ghost btn-sm" onClick={handleCopy}>
              {copied ? '✓ Copied!' : 'Copy to Clipboard'}
            </button>
            <button className="btn-ghost btn-sm" onClick={handleDownloadTxt}>
              ↓ Download .txt
            </button>
          </>
        )}
        {deal.updated_at && text && (
          <span className="gen-time">Last generated: {fmt(deal.updated_at)}</span>
        )}
      </div>
      {error && <ErrorAlert message={error} onRetry={handleGenerate} />}

      {!text && !generating && !error && (
        <div className="empty-state">
          <div className="empty-state-icon">📝</div>
          <div className="empty-state-title">No Blind Ad Yet</div>
          <p>Fill out the interview form, then click <strong>Generate Blind Ad</strong>. Copy or Download .txt appears after generation — copy is not created automatically.</p>
        </div>
      )}

      {!text && !generating && error && (
        <div className="empty-state">
          <div className="empty-state-icon">⚠️</div>
          <div className="empty-state-title">Blind ad was not created</div>
          <p>Nothing was saved for this tab. The message above is the reason. Use Retry after it is fixed.</p>
        </div>
      )}

      {generating && !text && (
        <div style={{ padding: 60, textAlign: 'center', color: '#57534e' }}>
          <div className="spinner spinner-dark" style={{ width: 32, height: 32, borderWidth: 4, display: 'inline-block' }} />
          <div style={{ marginTop: 14, fontSize: 14 }}>Generating blind ad copy…</div>
          <div style={{ fontSize: 12, color: '#57534e', marginTop: 6 }}>This usually takes 10–20 seconds</div>
        </div>
      )}

      {text && (
        <textarea
          className="blind-ad-textarea"
          value={text}
          onChange={e => setText(e.target.value)}
          onBlur={handleSaveEdit}
          spellCheck
        />
      )}
    </div>
  );
}

// ─── FLYER TAB ────────────────────────────────────────────────────────────────
function FlyerTab({ deal, onUpdate }) {
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [html, setHtml] = useState(deal.flyer_html || '');
  const iframeRef = useRef();

  useEffect(() => setHtml(deal.flyer_html || ''), [deal.flyer_html]);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setError('');
    try {
      const res = await generateFlyer(deal.id);
      setHtml(res.data.flyer_html);
      onUpdate();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setGenerating(false);
    }
  }, [deal.id, onUpdate]);

  const handleExportPdf = async () => {
    setExporting(true);
    setError('');
    try {
      await exportFlyer(deal.id);
      await downloadDealPdf(deal.id, 'flyer');
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="output-panel">
      <div className="output-toolbar">
        <button className="btn-primary" onClick={handleGenerate} disabled={generating}>
          {generating
            ? <><span className="spinner" />{html ? 'Regenerating…' : 'Generating…'}</>
            : html ? '↺ Regenerate Flyer' : '⚡ Generate Flyer'}
        </button>
        {html && (
          <button className="btn-dark btn-sm" onClick={handleExportPdf} disabled={exporting}>
            {exporting ? <><span className="spinner" />Exporting…</> : '↓ Download PDF'}
          </button>
        )}
        {deal.updated_at && html && (
          <span className="gen-time">Last generated: {fmt(deal.updated_at)}</span>
        )}
      </div>
      {error && <ErrorAlert message={error} onRetry={!exporting ? handleGenerate : undefined} />}

      {!html && !generating && !error && (
        <div className="empty-state">
          <div className="empty-state-icon">🗂️</div>
          <div className="empty-state-title">No Flyer Yet</div>
          <p>Fill out the interview form, then click <strong>Generate Flyer</strong>. The Download PDF button appears after generation — materials are not created automatically.</p>
        </div>
      )}

      {!html && !generating && error && (
        <div className="empty-state">
          <div className="empty-state-icon">⚠️</div>
          <div className="empty-state-title">One-page flyer was not created</div>
          <p>Nothing was saved for this tab. The message above is the reason. Use Retry after it is fixed.</p>
        </div>
      )}

      {generating && !html && (
        <div style={{ padding: 60, textAlign: 'center', color: '#57534e' }}>
          <div className="spinner spinner-dark" style={{ width: 32, height: 32, borderWidth: 4, display: 'inline-block' }} />
          <div style={{ marginTop: 14, fontSize: 14 }}>Generating flyer HTML…</div>
          <div style={{ fontSize: 12, color: '#57534e', marginTop: 6 }}>This usually takes 15–30 seconds</div>
        </div>
      )}

      {html && (
        <iframe
          ref={iframeRef}
          className="preview-iframe"
          style={{ height: 800 }}
          srcDoc={html}
          title="Flyer Preview"
          sandbox="allow-same-origin"
        />
      )}
    </div>
  );
}

// ─── CBR TAB ──────────────────────────────────────────────────────────────────
function CbrTab({ deal, onUpdate }) {
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');
  const [html, setHtml] = useState(deal.cbr_html || '');
  const elapsed = useElapsedTimer(generating);

  useEffect(() => setHtml(deal.cbr_html || ''), [deal.cbr_html]);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setError('');
    try {
      const res = await generateCbr(deal.id);
      setHtml(res.data.cbr_html);
      onUpdate();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setGenerating(false);
    }
  }, [deal.id, onUpdate]);

  const handleExportPdf = async () => {
    setExporting(true);
    setError('');
    try {
      await exportCbr(deal.id);
      await downloadDealPdf(deal.id, 'cbr');
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="output-panel">
      <div className="output-toolbar">
        <button className="btn-primary" onClick={handleGenerate} disabled={generating}>
          {generating
            ? <><span className="spinner" />{html ? `Regenerating… ${elapsed}s` : 'Generating…'}</>
            : html ? '↺ Regenerate CBR' : '⚡ Generate CBR'}
        </button>
        {html && (
          <button className="btn-dark btn-sm" onClick={handleExportPdf} disabled={exporting}>
            {exporting ? <><span className="spinner" />Exporting…</> : '↓ Download PDF'}
          </button>
        )}
        {deal.updated_at && html && (
          <span className="gen-time">Last generated: {fmt(deal.updated_at)}</span>
        )}
      </div>
      {error && <ErrorAlert message={error} onRetry={!exporting ? handleGenerate : undefined} />}

      {!html && !generating && !error && (
        <div className="empty-state">
          <div className="empty-state-icon">📊</div>
          <div className="empty-state-title">No CBR Yet</div>
          <p>Complete the interview form, then click <strong>Generate CBR</strong> (CIM). The Download PDF button appears after generation — materials are not created automatically.</p>
          <div className="alert alert-info" style={{ maxWidth: 400, margin: '16px auto 0', textAlign: 'left' }}>
            <strong>Note:</strong> CBR generation uses more AI tokens and may take 30–60 seconds. Ensure the interview form is thoroughly filled out for best results.
          </div>
        </div>
      )}

      {!html && !generating && error && (
        <div className="empty-state">
          <div className="empty-state-icon">⚠️</div>
          <div className="empty-state-title">CBR was not created</div>
          <p>Nothing was saved for this tab. The message above is the reason. Use Retry after it is fixed.</p>
        </div>
      )}

      {generating && !html && (
        <div style={{ padding: 60, textAlign: 'center', color: '#57534e' }}>
          <div className="spinner spinner-dark" style={{ width: 32, height: 32, borderWidth: 4, display: 'inline-block' }} />
          <div style={{ marginTop: 14, fontSize: 14 }}>Generating Confidential Business Review…</div>
          <div style={{ fontSize: 12, color: '#57534e', marginTop: 6 }}>
            {elapsed < 60
              ? `${elapsed}s elapsed — usually takes 30–90 seconds`
              : `${elapsed}s elapsed — still working, almost there…`}
          </div>
          <div style={{ marginTop: 20, background: 'rgba(255,255,255,0.94)', borderRadius: 8, padding: '12px 20px', display: 'inline-block', fontSize: 12, color: '#57534e' }}>
            Cover → TOC → Executive Summary → Products → Marketing → Sales → Customers → Employees → Financials → Growth → Transaction → Deal Team
          </div>
        </div>
      )}

      {html && (
        <div style={{ position: 'relative' }}>
          <div style={{
            background: 'rgba(255,255,255,0.72)', color: '#C4592F', padding: '8px 16px',
            fontSize: 11, fontFamily: 'Oswald, sans-serif', letterSpacing: 1,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            borderBottom: '1px solid #e6dfd6',
          }}>
            <span>CBR PREVIEW — CONFIDENTIAL</span>
            <span style={{ color: '#44403c' }}>Scroll to view all slides • Download PDF for print-quality output</span>
          </div>
          <iframe
            className="preview-iframe"
            style={{ height: 900 }}
            srcDoc={html}
            title="CBR Preview"
            sandbox="allow-same-origin"
          />
        </div>
      )}
    </div>
  );
}

// ─── MAIN DEAL DETAIL PAGE ────────────────────────────────────────────────────
const OUTPUT_TABS = ['blind-ad', 'flyer', 'cbr', 'activity'];

export default function DealDetail() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get('tab');
  const [deal, setDeal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState(
    OUTPUT_TABS.includes(tabFromUrl) ? tabFromUrl : 'blind-ad'
  );

  const selectTab = (tabId) => {
    setActiveTab(tabId);
    setSearchParams(tabId === 'blind-ad' ? {} : { tab: tabId }, { replace: true });
  };

  const loadDeal = async () => {
    try {
      const res = await fetchDeal(id);
      setDeal(res.data);
    } catch {
      setError('Deal not found');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDeal(); }, [id]);

  useEffect(() => {
    if (OUTPUT_TABS.includes(tabFromUrl) && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
    if (!tabFromUrl && activeTab !== 'blind-ad') {
      setActiveTab('blind-ad');
    }
  }, [tabFromUrl]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 60 }}>
        <div className="spinner spinner-dark" style={{ width: 32, height: 32, borderWidth: 4, display: 'inline-block' }} />
      </div>
    );
  }

  if (error || !deal) {
    return <div className="alert alert-error">{error || 'Deal not found'}</div>;
  }

  let interviewData = {};
  try { interviewData = JSON.parse(deal.interview_data || '{}'); } catch {}

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <div className="page-title" style={{ fontSize: 22 }}>{deal.deal_name}</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 4, flexWrap: 'wrap' }}>
            <span className={`badge badge-${deal.status}`}>{deal.status}</span>
            {deal.advisor_name && <span style={{ fontSize: 13, color: '#57534e' }}>Advisor: {deal.advisor_name}</span>}
            {interviewData.business_city_state && (
              <span style={{ fontSize: 13, color: '#57534e' }}>📍 {interviewData.business_city_state}</span>
            )}
          </div>
          <div className="page-subtitle" style={{ marginTop: 8 }}>
            Generate each tab below, then Download. Files are not built automatically from the interview.
          </div>
        </div>
        <div className="page-header-actions">
          <Link to={`/marketing/deals/${id}/edit`}>
            <button className="btn-ghost">✎ Edit Interview</button>
          </Link>
          <Link to="/marketing">
            <button className="btn-ghost">← Dashboard</button>
          </Link>
        </div>
      </div>

      {/* Key stats bar */}
      {(interviewData.asking_price || interviewData.revenue_year1 || interviewData.sde_year1) && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div className="card-body" style={{ padding: '14px 20px' }}>
            <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
              {[
                ['Asking Price', fmtMoney(interviewData.asking_price || interviewData.listing_price)],
                ['Revenue', fmtMoney(interviewData.revenue_year1)],
                ['SDE', fmtMoney(interviewData.sde_year1)],
                ['EBITDA', fmtMoney(interviewData.ebitda_year1)],
                ['Down Payment', interviewData.down_payment_required],
                ['Employees', interviewData.employees_count],
              ].filter(([, v]) => v).map(([label, value]) => (
                <div key={label}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#57534e', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Oswald, sans-serif', color: '#1c1917', marginTop: 2 }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Pipeline stage bar */}
      <PipelineBar status={deal.status} dealId={deal.id} onUpdate={loadDeal} />

      {/* Output tabs */}
      <div className="tabs tabs-scroll">
        {[
          { id: 'blind-ad', label: '📋 Blind Ad', hasContent: !!deal.blind_ad_text },
          { id: 'flyer', label: '🗂️ One-Page Flyer', hasContent: !!deal.flyer_html },
          { id: 'cbr', label: '📊 CBR (CIM)', hasContent: !!deal.cbr_html },
          { id: 'activity', label: '🕐 Activity', hasContent: false },
        ].map(tab => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => selectTab(tab.id)}
          >
            {tab.label}
            {tab.hasContent && (
              <span style={{
                marginLeft: 6, fontSize: 10, background: 'rgba(196,89,47,0.15)', color: '#A34826',
                borderRadius: 10, padding: '1px 6px', fontWeight: 600
              }}>✓</span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'blind-ad' && <BlindAdTab deal={deal} onUpdate={loadDeal} />}
      {activeTab === 'flyer' && <FlyerTab deal={deal} onUpdate={loadDeal} />}
      {activeTab === 'cbr' && <CbrTab deal={deal} onUpdate={loadDeal} />}
      {activeTab === 'activity' && <ActivityTab dealId={deal.id} />}
    </div>
  );
}
