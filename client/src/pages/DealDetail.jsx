import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  fetchDeal, updateDeal,
  generateBlindAd, generateFlyer, generateCbr,
  exportFlyer, exportCbr,
  downloadUrl, getAuth
} from '../api';

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

  const handleGenerate = async () => {
    setGenerating(true);
    setError('');
    try {
      const res = await generateBlindAd(deal.id);
      setText(res.data.blind_ad_text);
      onUpdate();
    } catch (err) {
      setError(err.response?.data?.error || 'Generation failed. Check your API key.');
    } finally {
      setGenerating(false);
    }
  };

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
      {error && <div className="alert alert-error" style={{ margin: '16px 20px 0' }}>{error}</div>}

      {!text && !generating && (
        <div className="empty-state">
          <div className="empty-state-icon">📝</div>
          <div className="empty-state-title">No Blind Ad Yet</div>
          <p>Fill out the interview form, then click "Generate Blind Ad" to create your BizBuySell listing copy.</p>
        </div>
      )}

      {generating && !text && (
        <div style={{ padding: 60, textAlign: 'center', color: '#888' }}>
          <div className="spinner spinner-dark" style={{ width: 32, height: 32, borderWidth: 4, display: 'inline-block' }} />
          <div style={{ marginTop: 14, fontSize: 14 }}>Generating blind ad copy…</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>This usually takes 10–20 seconds</div>
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

  const handleGenerate = async () => {
    setGenerating(true);
    setError('');
    try {
      const res = await generateFlyer(deal.id);
      setHtml(res.data.flyer_html);
      onUpdate();
    } catch (err) {
      setError(err.response?.data?.error || 'Generation failed. Check your API key.');
    } finally {
      setGenerating(false);
    }
  };

  const handleExportPdf = async () => {
    setExporting(true);
    setError('');
    try {
      await exportFlyer(deal.id);
      // Download
      const auth = getAuth();
      const link = document.createElement('a');
      link.href = downloadUrl(deal.id, 'flyer');
      link.setAttribute('download', '');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      setError(err.response?.data?.error || 'PDF export failed');
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
      {error && <div className="alert alert-error" style={{ margin: '16px 20px 0' }}>{error}</div>}

      {!html && !generating && (
        <div className="empty-state">
          <div className="empty-state-icon">🗂️</div>
          <div className="empty-state-title">No Flyer Yet</div>
          <p>Fill out the interview form, then click "Generate Flyer" to create a branded one-page PDF flyer.</p>
        </div>
      )}

      {generating && !html && (
        <div style={{ padding: 60, textAlign: 'center', color: '#888' }}>
          <div className="spinner spinner-dark" style={{ width: 32, height: 32, borderWidth: 4, display: 'inline-block' }} />
          <div style={{ marginTop: 14, fontSize: 14 }}>Generating flyer HTML…</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>This usually takes 15–30 seconds</div>
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

  useEffect(() => setHtml(deal.cbr_html || ''), [deal.cbr_html]);

  const handleGenerate = async () => {
    setGenerating(true);
    setError('');
    try {
      const res = await generateCbr(deal.id);
      setHtml(res.data.cbr_html);
      onUpdate();
    } catch (err) {
      setError(err.response?.data?.error || 'Generation failed. Check your API key.');
    } finally {
      setGenerating(false);
    }
  };

  const handleExportPdf = async () => {
    setExporting(true);
    setError('');
    try {
      await exportCbr(deal.id);
      const link = document.createElement('a');
      link.href = downloadUrl(deal.id, 'cbr');
      link.setAttribute('download', '');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      setError(err.response?.data?.error || 'PDF export failed');
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
      {error && <div className="alert alert-error" style={{ margin: '16px 20px 0' }}>{error}</div>}

      {!html && !generating && (
        <div className="empty-state">
          <div className="empty-state-icon">📊</div>
          <div className="empty-state-title">No CBR Yet</div>
          <p>Complete the interview form, then click "Generate CBR" to create the full Confidential Business Review.</p>
          <div className="alert alert-info" style={{ maxWidth: 400, margin: '16px auto 0', textAlign: 'left' }}>
            <strong>Note:</strong> CBR generation uses more AI tokens and may take 30–60 seconds. Ensure the interview form is thoroughly filled out for best results.
          </div>
        </div>
      )}

      {generating && !html && (
        <div style={{ padding: 60, textAlign: 'center', color: '#888' }}>
          <div className="spinner spinner-dark" style={{ width: 32, height: 32, borderWidth: 4, display: 'inline-block' }} />
          <div style={{ marginTop: 14, fontSize: 14 }}>Generating Confidential Business Review…</div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 6 }}>Generating 30 slides — this takes 30–90 seconds</div>
          <div style={{ marginTop: 20, background: '#1e293b', borderRadius: 8, padding: '12px 20px', display: 'inline-block', fontSize: 12, color: '#64748b' }}>
            Cover → TOC → Executive Summary → Products → Marketing → Sales → Customers → Employees → Financials → Growth → Transaction → Deal Team
          </div>
        </div>
      )}

      {html && (
        <div style={{ position: 'relative' }}>
          <div style={{
            background: '#0a0e18', color: '#2eb860', padding: '8px 16px',
            fontSize: 11, fontFamily: 'Oswald, sans-serif', letterSpacing: 1,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            borderBottom: '1px solid #1e2d45',
          }}>
            <span>CBR PREVIEW — CONFIDENTIAL</span>
            <span style={{ color: '#475569' }}>Scroll to view all slides • Download PDF for print-quality output</span>
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
export default function DealDetail() {
  const { id } = useParams();
  const [deal, setDeal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('blind-ad');

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
    <>
      <div className="page-header">
        <div>
          <div className="page-title" style={{ fontSize: 22 }}>{deal.deal_name}</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 4 }}>
            <span className={`badge badge-${deal.status}`}>{deal.status}</span>
            {deal.advisor_name && <span style={{ fontSize: 13, color: '#64748b' }}>Advisor: {deal.advisor_name}</span>}
            {interviewData.business_city_state && (
              <span style={{ fontSize: 13, color: '#64748b' }}>📍 {interviewData.business_city_state}</span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
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
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
                  <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Oswald, sans-serif', color: '#e2e8f0', marginTop: 2 }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Output tabs */}
      <div className="tabs">
        {[
          { id: 'blind-ad', label: '📋 Blind Ad', hasContent: !!deal.blind_ad_text },
          { id: 'flyer', label: '🗂️ One-Page Flyer', hasContent: !!deal.flyer_html },
          { id: 'cbr', label: '📊 CBR', hasContent: !!deal.cbr_html },
        ].map(tab => (
          <button
            key={tab.id}
            className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {tab.hasContent && (
              <span style={{
                marginLeft: 6, fontSize: 10, background: 'rgba(46,184,96,0.15)', color: '#4ade80',
                borderRadius: 10, padding: '1px 6px', fontWeight: 600
              }}>✓</span>
            )}
          </button>
        ))}
      </div>

      {activeTab === 'blind-ad' && <BlindAdTab deal={deal} onUpdate={loadDeal} />}
      {activeTab === 'flyer' && <FlyerTab deal={deal} onUpdate={loadDeal} />}
      {activeTab === 'cbr' && <CbrTab deal={deal} onUpdate={loadDeal} />}
    </>
  );
}
