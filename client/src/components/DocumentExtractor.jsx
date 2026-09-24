import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  fetchDealDocuments,
  uploadDealDocuments,
  deleteDealDocument,
  extractStoredInterview,
  fetchDealDocumentObjectUrl,
} from '../api';

// Human-readable labels for field names shown in the results preview
const FIELD_LABELS = {
  business_legal_name: 'Business Legal Name', business_website: 'Website',
  year_founded: 'Year Founded', year_owner_took_over: 'Year Owner Took Over',
  business_city_state: 'City, State', hours_of_operation: 'Hours of Operation',
  entity_type: 'Entity Type', business_description: 'Business Description',
  origin_story: 'Origin Story', owner_skills: 'Owner Skills',
  typical_day: 'Typical Day', primary_roles: 'Primary Roles',
  owner_absent: 'Business Without Owner', vision_mission: 'Vision / Mission',
  core_values: 'Core Values', reason_for_selling: 'Reason for Selling',
  top_5_growth: 'Top 5 Growth Strategies', owner_optimistic: 'Owner Optimistic About',
  owner_concerns: 'Owner Concerns', advice_for_buyer: 'Advice for Buyer',
  warning_for_buyer: 'Warning for Buyer', owner_compensation_method: 'Owner Compensation',
  licenses_held: 'Licenses Held', key_systems: 'Key Systems / SOPs',
  intellectual_property: 'Intellectual Property', litigation_status: 'Litigation Status',
  industry_highlights: 'Industry Highlights', industry_trends: 'Industry Trends',
  industry_challenges: 'Industry Challenges', industry_opportunities: 'Industry Opportunities',
  profit_drivers: 'Profit Drivers', regulatory_factors: 'Regulatory Factors',
  employees_count: 'Employee Count', asking_price: 'Asking Price',
  revenue_year1: 'Revenue (Year 1)', revenue_year1_label: 'Revenue Year',
  sde_year1: 'SDE (Year 1)', sde_year1_label: 'SDE Year',
  ebitda_year1: 'EBITDA (Year 1)', real_estate_situation: 'Real Estate Situation',
  real_estate_value: 'Real Estate Value', ffe_value: 'FF&E Value',
  inventory_value: 'Inventory Value', down_payment_required: 'Down Payment',
  sba_preapproved: 'SBA Pre-Approved', financing_available: 'Financing Available',
  core_products: 'Core Products / Services', pricing_strategy: 'Pricing Strategy',
  delivery_process: 'Delivery Process', unique_offerings: 'Unique Offerings',
  product_diversification: 'Product Diversification', supplier_diversification: 'Supplier Diversification',
  products_in_development: 'In Development', future_product_potential: 'Future Potential',
  branding_strategy: 'Branding Strategy', social_reputation: 'Social / Reviews',
  marketing_channels: 'Marketing Channels', marketing_roi_metrics: 'Marketing ROI Metrics',
  marketing_strengths: 'Marketing Strengths', marketing_weaknesses: 'Marketing Weaknesses',
  market_positioning: 'Market Positioning', why_customers_choose: 'Why Customers Choose',
  sales_process: 'Sales Process', sales_trends: 'Sales Trends',
  sales_channels: 'Sales Channels', sales_responsible: 'Sales Responsible',
  sales_superstars: 'Sales Superstars', sales_growth_opportunities: 'Sales Growth Opps',
  seasonality: 'Seasonality', mrr_amount: 'MRR Amount', mrr: 'MRR Description',
  total_customers: 'Total Customers', repeat_customer_pct: 'Repeat Customer %',
  customer_satisfaction: 'Customer Satisfaction', customer_service_strengths: 'CS Strengths',
  customer_service_improvements: 'CS Improvements', avg_revenue_per_customer: 'Avg Revenue/Customer',
  customer_segmentation: 'Customer Segmentation', customer_geography: 'Customer Geography',
  customer_database_size: 'Customer Database Size', employee_detail: 'Employee Detail',
  org_structure: 'Org Structure', key_employees: 'Key Employees',
  employee_challenges: 'Employee Challenges', compliance_issues: 'Compliance Issues',
  hiring_challenges: 'Hiring Challenges', hr_systems: 'HR Systems',
  benefits: 'Benefits', compensation_approach: 'Compensation Approach',
  post_sale_transitions: 'Post-Sale Transitions', fiscal_year_end: 'Fiscal Year End',
  financial_record_system: 'Financial System', accuracy_rating: 'Accuracy Rating',
  records_current: 'Records Current', asset_list_available: 'Asset List Available',
  assets_not_conveyed: 'Assets Not Conveyed', cash_flow_status: 'Cash Flow Status',
  cash_flow_decline: 'Cash Flow Decline', industry_benchmarks: 'Industry Benchmarks',
  five_year_projections: '5-Year Projections',
  growth_opportunities: 'Growth Opportunities', listing_price: 'Listing Price',
  down_payment_pct: 'Down Payment %', deal_structure: 'Deal Structure',
  financing_type: 'Financing Type', transition_plan: 'Transition Plan',
  buyer_process_notes: 'Buyer Process Notes', seller_brand_color: 'Brand Color',
};

const PDF_SECTIONS = [
  {
    kind: 'ea',
    label: 'Engagement Agreement',
    icon: '📄',
    sub: 'Engagement Agreement',
    hint: 'Authoritative for asking price and deal terms when marketing is generated.',
  },
  {
    kind: 'mpa',
    label: 'QSI MPA Report',
    icon: '📄',
    sub: 'QSI MPA Report',
    hint: 'Authoritative for financials, SDE, DSCR, and valuation.',
  },
  {
    kind: 'termsheet',
    label: 'Bank Term Sheet',
    optional: '(optional — SBA bank name & loan terms)',
    icon: '🏦',
    sub: 'Bank Term Sheet',
    hint: 'If uploaded, the bank name, rate, loan terms and payment will be extracted for the SBA section.',
  },
  {
    kind: 'discovery',
    label: 'Discovery Prep Report',
    optional: '(optional — seller & industry intel)',
    icon: '🔍',
    sub: 'Discovery Prep Report',
    hint: 'If uploaded, seller intel, industry context, and buyer profile will enrich outputs.',
  },
];

function labelFor(key) {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  const finMatch = key.match(/^fin_year(\d)_(.+)$/);
  if (finMatch) {
    const yr = finMatch[1];
    const metric = finMatch[2].replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return `Year ${yr} — ${metric}`;
  }
  const segMatch = key.match(/^rev_segment(\d)_(name|pct)$/);
  if (segMatch) return `Segment ${segMatch[1]} ${segMatch[2] === 'pct' ? '%' : 'Name'}`;
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function truncate(val, max = 90) {
  const s = String(val);
  return s.length > max ? s.slice(0, max) + '…' : s;
}

function fileMeta(doc) {
  const kb = doc.size_bytes ? `${Math.max(1, Math.round(doc.size_bytes / 1024))} KB` : '';
  const chars = doc.text_chars ? `${Number(doc.text_chars).toLocaleString()} chars` : '';
  return [kb, chars, 'Saved to this deal'].filter(Boolean).join(' · ');
}

function SectionError({ message }) {
  if (!message) return null;
  return (
    <div style={{
      marginTop: 8, padding: '8px 10px', borderRadius: 6, fontSize: 12,
      background: 'rgba(220,38,38,0.08)', color: '#dc2626', borderLeft: '3px solid #ef4444',
    }}>{message}</div>
  );
}

function DropZone({
  section, doc, busy, error, accept, multiple, emptyIcon, emptyTitle, emptySub, onUpload, onRemove, children,
}) {
  const inputRef = useRef(null);
  const [drag, setDrag] = useState(false);
  const openPicker = () => inputRef.current?.click();

  return (
    <div data-doc-section={section}>
      {children}
      <div
        className={`doc-drop${doc ? ' ready' : ''}${drag ? ' drag' : ''}${busy ? ' busy' : ''}`}
        onDragOver={e => { e.preventDefault(); if (!busy) setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => {
          e.preventDefault();
          setDrag(false);
          if (!busy) onUpload(e.dataTransfer.files);
        }}
        onClick={() => { if (!doc && !busy) openPicker(); }}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple || undefined}
          style={{ display: 'none' }}
          onChange={e => {
            const chosen = [...e.target.files];
            e.target.value = '';
            onUpload(chosen);
          }}
        />
        {busy ? (
          <div style={{ fontSize: 13, color: '#57534e', padding: '18px 0' }}>Saving…</div>
        ) : doc ? (
          <>
            <div style={{ fontSize: 22, marginBottom: 4 }}>✅</div>
            <div className="doc-file-name">{doc.filename}</div>
            <div className="doc-file-meta">{fileMeta(doc)}</div>
            <div className="doc-file-actions">
              <button type="button" onClick={e => { e.stopPropagation(); openPicker(); }}>Replace</button>
              <button type="button" onClick={e => { e.stopPropagation(); onRemove(doc); }}>Remove</button>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 26, marginBottom: 4 }}>{emptyIcon}</div>
            <div style={{ fontWeight: 650, color: '#57534e', fontSize: 13 }}>{emptyTitle}</div>
            <div className="doc-file-meta">{emptySub}</div>
          </>
        )}
      </div>
      <SectionError message={error} />
    </div>
  );
}

export default function DocumentExtractor({ deal, currentInterviewData, onApply }) {
  const [open, setOpen] = useState(true);
  const [docs, setDocs] = useState([]);
  const [previews, setPreviews] = useState({});
  const [busy, setBusy] = useState({});
  const [sectionError, setSectionError] = useState({});
  const [mode, setMode] = useState('upload');
  const [pastedText, setPastedText] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [deselected, setDeselected] = useState(new Set());
  const [overwrite, setOverwrite] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyMsg, setApplyMsg] = useState('');
  const previewsRef = useRef({});
  const bizInputRef = useRef(null);

  const interviewDoc = docs.find(d => d.kind === 'interview') || null;
  const bizPhotos = docs.filter(d => d.kind === 'biz_photo');
  const advisorDoc = docs.find(d => d.kind === 'advisor_photo') || null;

  const refresh = useCallback(async () => {
    const res = await fetchDealDocuments(deal.id);
    const list = res.data.documents || [];
    setDocs(list);
    const imageDocs = list.filter(d => d.kind === 'biz_photo' || d.kind === 'advisor_photo');
    const next = {};
    for (const doc of imageDocs) {
      next[doc.id] = previewsRef.current[doc.id] || await fetchDealDocumentObjectUrl(deal.id, doc.id);
    }
    for (const [id, url] of Object.entries(previewsRef.current)) {
      if (!next[id]) URL.revokeObjectURL(url);
    }
    previewsRef.current = next;
    setPreviews(next);
  }, [deal.id]);

  useEffect(() => {
    let cancelled = false;
    refresh().catch(err => {
      if (!cancelled) setError(err.response?.data?.error || 'Could not load saved documents.');
    });
    return () => {
      cancelled = true;
      Object.values(previewsRef.current).forEach(url => URL.revokeObjectURL(url));
      previewsRef.current = {};
    };
  }, [refresh]);

  const uploadFiles = async (kind, fileList) => {
    const files = [...(fileList || [])].filter(Boolean);
    if (!files.length) return;
    setSectionError(prev => ({ ...prev, [kind]: '' }));
    setBusy(prev => ({ ...prev, [kind]: true }));
    try {
      const fd = new FormData();
      fd.append('kind', kind);
      if (kind === 'biz_photo') files.forEach(file => fd.append('files', file));
      else fd.append('file', files[0]);
      await uploadDealDocuments(deal.id, fd);
      await refresh();
    } catch (err) {
      setSectionError(prev => ({ ...prev, [kind]: err.response?.data?.error || 'Upload failed.' }));
    } finally {
      setBusy(prev => ({ ...prev, [kind]: false }));
    }
  };

  const removeDoc = async (doc) => {
    setSectionError(prev => ({ ...prev, [doc.kind]: '' }));
    setBusy(prev => ({ ...prev, [doc.kind]: true }));
    try {
      await deleteDealDocument(deal.id, doc.id);
      if (doc.kind === 'interview') {
        setResult(null);
        setApplyMsg('');
        setPastedText('');
      }
      await refresh();
    } catch (err) {
      setSectionError(prev => ({ ...prev, [doc.kind]: err.response?.data?.error || 'Could not remove that file.' }));
    } finally {
      setBusy(prev => ({ ...prev, [doc.kind]: false }));
    }
  };

  const canExtract = mode === 'upload' ? !!(interviewDoc && interviewDoc.text_chars > 0) : pastedText.trim().length > 20;

  const handleExtract = async () => {
    setExtracting(true);
    setError('');
    setResult(null);
    setApplyMsg('');
    try {
      if (mode === 'paste') {
        const fd = new FormData();
        fd.append('kind', 'interview');
        fd.append('text', pastedText.trim());
        await uploadDealDocuments(deal.id, fd);
        await refresh();
      }
      const res = await extractStoredInterview(deal.id);
      setResult(res.data);
      setDeselected(new Set());
    } catch (err) {
      setError(err.response?.data?.error || 'Extraction failed. Please try again.');
    } finally {
      setExtracting(false);
    }
  };

  const toggleField = (key) => {
    setDeselected(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const handleApply = async () => {
    if (!result) return;
    setApplying(true);
    setApplyMsg('');
    const base = { ...currentInterviewData };
    let applied = 0;
    let skipped = 0;
    for (const [key, value] of Object.entries(result.extracted)) {
      if (deselected.has(key)) continue;
      const existing = base[key] && String(base[key]).trim();
      if (!overwrite && existing) { skipped++; continue; }
      base[key] = value;
      applied++;
    }
    try {
      await onApply(base);
      setApplyMsg(
        applied === 0
          ? `No fields applied — all ${skipped} extracted fields already had values. Enable "Overwrite existing" to replace them.`
          : `✓ ${applied} field${applied !== 1 ? 's' : ''} applied to the form${skipped ? ` (${skipped} skipped — already filled)` : ''}.`
      );
    } catch {
      setApplyMsg('Error saving. Please try again.');
    } finally {
      setApplying(false);
    }
  };

  const alreadyFilled = (key) => {
    const v = currentInterviewData[key];
    return v && String(v).trim().length > 0;
  };

  const pdfZone = (section) => {
    const doc = docs.find(d => d.kind === section.kind) || null;
    return (
      <div key={section.kind}>
        <label className="doc-section-label">
          {section.label}{' '}
          {section.optional
            ? <span className="opt">{section.optional}</span>
            : <span className="req">*</span>}
        </label>
        <DropZone
          section={section.kind}
          doc={doc}
          busy={!!busy[section.kind]}
          error={sectionError[section.kind]}
          accept=".pdf,application/pdf"
          emptyIcon={section.icon}
          emptyTitle="Drop or click to upload"
          emptySub={section.sub}
          onUpload={files => uploadFiles(section.kind, files)}
          onRemove={removeDoc}
        />
        {section.hint && <div className="doc-hint">{section.hint}</div>}
      </div>
    );
  };

  return (
    <div style={{
      background: 'rgba(255,255,255,0.94)', borderRadius: 8,
      marginBottom: 20, overflow: 'hidden', border: '1px solid #e4dcd2'
    }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '13px 20px',
          cursor: 'pointer', background: '#faf8f5', borderBottom: open ? '1px solid #e6dfd6' : 'none'
        }}
      >
        <span style={{ fontSize: 18 }}>✨</span>
        <div style={{ flex: 1 }}>
          <div style={{
            fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: 14,
            textTransform: 'uppercase', letterSpacing: '.8px', color: '#1c1917'
          }}>
            Step 1 — Source Documents
          </div>
          <div style={{ fontSize: 12, color: '#57534e', marginTop: 1 }}>
            Upload each document in its own section. Files are saved on this deal and included when you generate the blind ad, one-page, and CBR.
          </div>
        </div>
        <span style={{ color: '#C4592F', fontSize: 16, transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'none' }}>▾</span>
      </div>

      {open && (
        <div style={{ padding: 20 }}>
          <div className="doc-upload-grid">
            <div>
              <label className="doc-section-label">
                Interview Doc <span className="req">*</span>
              </label>
              <div style={{ display: 'flex', marginBottom: 10, borderRadius: 6, overflow: 'hidden', border: '1px solid #e4dcd2', width: 'fit-content' }}>
                {[['upload', 'Upload File'], ['paste', 'Paste Text']].map(([m, label]) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => { setMode(m); setError(''); }}
                    style={{
                      padding: '6px 12px', fontSize: 12, fontWeight: 650, border: 'none', cursor: 'pointer',
                      background: mode === m ? '#C4592F' : '#ffffff',
                      color: mode === m ? '#fff' : '#57534e',
                    }}
                  >{label}</button>
                ))}
              </div>
              {mode === 'upload' ? (
                <DropZone
                  section="interview"
                  doc={interviewDoc}
                  busy={!!busy.interview}
                  error={sectionError.interview}
                  accept=".pdf,.docx,.txt,application/pdf,text/plain"
                  emptyIcon="📄"
                  emptyTitle="Drop or click to upload"
                  emptySub="PDF, .docx, or .txt"
                  onUpload={files => uploadFiles('interview', files)}
                  onRemove={removeDoc}
                />
              ) : (
                <textarea
                  value={pastedText}
                  onChange={e => setPastedText(e.target.value)}
                  placeholder="Paste your interview notes here. They are saved to this deal when you extract fields."
                  style={{
                    width: '100%', minHeight: 140, fontFamily: 'system-ui, sans-serif',
                    fontSize: 13, padding: 12, border: '1px solid #e4dcd2',
                    borderRadius: 6, resize: 'vertical', lineHeight: 1.6,
                    background: '#ffffff', color: '#1c1917', outline: 'none', boxSizing: 'border-box'
                  }}
                />
              )}
              <div className="doc-hint">
                Interview notes fill the form below. PDF, Word, text, and pasted notes all stay on this deal.
              </div>
              {error && (
                <div style={{
                  marginTop: 8, padding: '8px 10px', borderRadius: 6, fontSize: 12,
                  background: 'rgba(220,38,38,0.08)', color: '#dc2626', borderLeft: '3px solid #ef4444',
                }}>{error}</div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
                <button className="btn-primary" type="button" onClick={handleExtract} disabled={!canExtract || extracting}>
                  {extracting ? <><span className="spinner" />Analyzing…</> : 'Extract Fields'}
                </button>
              </div>
            </div>
            {pdfZone(PDF_SECTIONS[0])}
            {pdfZone(PDF_SECTIONS[1])}
          </div>

          {result && (
            <div style={{ marginTop: 16 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14,
                padding: '10px 16px', background: 'rgba(196,89,47,0.1)', borderRadius: 6,
                border: '1px solid rgba(196,89,47,0.3)'
              }}>
                <span style={{ fontSize: 22 }}>🎯</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#C4592F' }}>
                    {result.field_count} field{result.field_count !== 1 ? 's' : ''} extracted
                  </div>
                  <div style={{ fontSize: 12, color: '#57534e', marginTop: 1 }}>
                    Review below, deselect any you don't want, then click Apply.
                  </div>
                </div>
                <label style={{
                  display: 'flex', alignItems: 'center', gap: 7, marginLeft: 'auto',
                  cursor: 'pointer', fontSize: 13, color: '#57534e', fontWeight: 500, whiteSpace: 'nowrap'
                }}>
                  <input
                    type="checkbox"
                    checked={overwrite}
                    onChange={e => setOverwrite(e.target.checked)}
                    style={{ width: 14, height: 14, accentColor: '#C4592F', cursor: 'pointer' }}
                  />
                  Overwrite existing values
                </label>
              </div>
              <div style={{
                maxHeight: 320, overflowY: 'auto', border: '1px solid #e4dcd2',
                borderRadius: 6, marginBottom: 14
              }}>
                {result.fields_found.map((key, i) => {
                  const checked = !deselected.has(key);
                  const filled = alreadyFilled(key);
                  const val = result.extracted[key];
                  return (
                    <label
                      key={key}
                      onClick={() => toggleField(key)}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 10,
                        padding: '8px 14px', cursor: 'pointer',
                        background: checked ? 'rgba(255,255,255,0.94)' : '#faf8f5',
                        borderBottom: i < result.fields_found.length - 1 ? '1px solid #e6dfd6' : 'none',
                        opacity: checked ? 1 : 0.5,
                      }}
                    >
                      <div style={{
                        width: 18, height: 18, borderRadius: 3, flexShrink: 0, marginTop: 1,
                        border: `2px solid ${checked ? '#C4592F' : '#e4dcd2'}`,
                        background: checked ? '#C4592F' : '#ffffff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        {checked && <span style={{ color: '#fff', fontSize: 11, fontWeight: 700, lineHeight: 1 }}>✓</span>}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#1c1917' }}>{labelFor(key)}</span>
                          {filled && !overwrite && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: 'rgba(251,191,36,0.15)', color: '#b45309', fontWeight: 600 }}>will skip</span>}
                          {filled && overwrite && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: 'rgba(239,68,68,0.15)', color: '#dc2626', fontWeight: 600 }}>will overwrite</span>}
                          {!filled && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: 'rgba(196,89,47,0.15)', color: '#C4592F', fontWeight: 600 }}>new</span>}
                        </div>
                        <div style={{ fontSize: 12, color: '#57534e', marginTop: 2, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                          {truncate(val)}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>
              <div style={{ fontSize: 12, color: '#57534e', marginBottom: 12 }}>
                {result.field_count - deselected.size} of {result.field_count} fields selected
              </div>
              {applyMsg && (
                <div style={{
                  padding: '10px 14px', borderRadius: 6, fontSize: 13, marginBottom: 12,
                  background: applyMsg.startsWith('✓') ? 'rgba(196,89,47,0.1)' : 'rgba(239,68,68,0.1)',
                  color: applyMsg.startsWith('✓') ? '#C4592F' : '#dc2626',
                  borderLeft: `4px solid ${applyMsg.startsWith('✓') ? '#C4592F' : '#dc2626'}`
                }}>{applyMsg}</div>
              )}
              <button
                className="btn-primary"
                type="button"
                onClick={handleApply}
                disabled={applying || deselected.size === result.field_count}
              >
                {applying ? <><span className="spinner" />Applying…</> : 'Apply to Form'}
              </button>
            </div>
          )}

          <div className="doc-upload-grid two">
            {pdfZone(PDF_SECTIONS[2])}
            {pdfZone(PDF_SECTIONS[3])}
          </div>

          <div className="doc-upload-grid two">
            <div data-doc-section="biz_photo">
              <label className="doc-section-label">
                Business Photos <span className="opt">(optional · up to 5 · first used in flyer &amp; CIM cover)</span>
              </label>
              <div className={`doc-drop${busy.biz_photo ? ' busy' : ''}`} style={{ cursor: 'default', textAlign: 'left' }}>
                <input
                  ref={bizInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ display: 'none' }}
                  onChange={e => {
                    const chosen = [...e.target.files];
                    e.target.value = '';
                    uploadFiles('biz_photo', chosen);
                  }}
                />
                <div className="doc-photo-grid">
                  {bizPhotos.map((photo, index) => (
                    <div className="doc-thumb" key={photo.id}>
                      {previews[photo.id]
                        ? <img src={previews[photo.id]} alt={photo.filename || 'Business photo'} />
                        : <div style={{ width: 64, height: 64, borderRadius: 6, background: '#f3eee8' }} />}
                      <button type="button" className="remove" aria-label="Remove photo" onClick={() => removeDoc(photo)}>✕</button>
                      {index === 0 && <div className="cover-tag">cover</div>}
                    </div>
                  ))}
                  {bizPhotos.length < 5 && (
                    <button type="button" className="doc-add-photo" title="Add photo" onClick={() => bizInputRef.current?.click()}>+</button>
                  )}
                </div>
                {busy.biz_photo && <div className="doc-file-meta">Saving…</div>}
                {bizPhotos.length > 0 && (
                  <div className="doc-file-meta">
                    {bizPhotos.map(photo => photo.filename).filter(Boolean).join(', ')} · Saved to this deal
                  </div>
                )}
              </div>
              <SectionError message={sectionError.biz_photo} />
            </div>

            <div data-doc-section="advisor_photo">
              <label className="doc-section-label">
                Advisor Headshot <span className="req">*</span>
              </label>
              <DropZone
                section="advisor-photo"
                doc={advisorDoc ? { ...advisorDoc, text_chars: 0 } : null}
                busy={!!busy.advisor_photo}
                error={sectionError.advisor_photo}
                accept="image/jpeg,image/png,image/webp,image/gif"
                emptyIcon="👤"
                emptyTitle="Drop or click to upload"
                emptySub="JPG, PNG, WEBP"
                onUpload={files => uploadFiles('advisor_photo', files)}
                onRemove={removeDoc}
              />
              {advisorDoc && previews[advisorDoc.id] && (
                <div style={{ marginTop: 8 }}>
                  <img className="doc-advisor-preview" src={previews[advisorDoc.id]} alt="Advisor headshot" />
                </div>
              )}
              <div className="doc-hint">Shown as a circular photo on the one-page flyer.</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
