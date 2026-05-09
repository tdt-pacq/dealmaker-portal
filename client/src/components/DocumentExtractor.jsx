import React, { useState, useRef, useCallback } from 'react';
import { extractInterview } from '../api';

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

function labelFor(key) {
  if (FIELD_LABELS[key]) return FIELD_LABELS[key];
  // Financial year fields
  const finMatch = key.match(/^fin_year(\d)_(.+)$/);
  if (finMatch) {
    const yr = finMatch[1];
    const metric = finMatch[2].replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return `Year ${yr} — ${metric}`;
  }
  // Revenue segments
  const segMatch = key.match(/^rev_segment(\d)_(name|pct)$/);
  if (segMatch) return `Segment ${segMatch[1]} ${segMatch[2] === 'pct' ? '%' : 'Name'}`;
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function truncate(val, max = 90) {
  const s = String(val);
  return s.length > max ? s.slice(0, max) + '…' : s;
}

export default function DocumentExtractor({ deal, currentInterviewData, onApply }) {
  const [open, setOpen] = useState(true);
  const [mode, setMode] = useState('upload'); // 'upload' | 'paste'
  const [file, setFile] = useState(null);
  const [pastedText, setPastedText] = useState('');
  const [dragging, setDragging] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null); // { extracted, field_count, fields_found }
  const [deselected, setDeselected] = useState(new Set());
  const [overwrite, setOverwrite] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyMsg, setApplyMsg] = useState('');
  const fileInputRef = useRef();

  const canExtract = mode === 'upload' ? !!file : pastedText.trim().length > 20;

  const handleFile = useCallback((f) => {
    if (!f) return;
    const ext = f.name.toLowerCase();
    if (!ext.endsWith('.docx') && !ext.endsWith('.txt')) {
      setError('Only .docx and .txt files are supported. For PDFs, copy and paste the text instead.');
      return;
    }
    setError('');
    setFile(f);
    setResult(null);
    setApplyMsg('');
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  }, [handleFile]);

  const handleExtract = async () => {
    setExtracting(true);
    setError('');
    setResult(null);
    setApplyMsg('');
    const fd = new FormData();
    if (mode === 'upload' && file) fd.append('file', file);
    if (mode === 'paste' && pastedText.trim()) fd.append('text', pastedText.trim());
    try {
      const res = await extractInterview(fd);
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

  const handleReset = () => {
    setResult(null);
    setFile(null);
    setPastedText('');
    setError('');
    setApplyMsg('');
    setDeselected(new Set());
  };

  const alreadyFilled = (key) => {
    const v = currentInterviewData[key];
    return v && String(v).trim().length > 0;
  };

  return (
    <div style={{
      background: '#1e293b', borderRadius: 8,
      marginBottom: 20, overflow: 'hidden', border: '1px solid #2d3748'
    }}>
      {/* Header */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '13px 20px',
          cursor: 'pointer', background: '#161f2e', borderBottom: open ? '1px solid #1a2235' : 'none'
        }}
      >
        <span style={{ fontSize: 18 }}>✨</span>
        <div style={{ flex: 1 }}>
          <div style={{
            fontFamily: 'Oswald, sans-serif', fontWeight: 700, fontSize: 14,
            textTransform: 'uppercase', letterSpacing: '.8px', color: '#e2e8f0'
          }}>
            AI Interview Extraction
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 1 }}>
            Upload your Google Doc or paste interview notes to auto-populate the form
          </div>
        </div>
        <span style={{ color: '#2eb860', fontSize: 16, transition: 'transform .2s', transform: open ? 'rotate(180deg)' : 'none' }}>▾</span>
      </div>

      {open && (
        <div style={{ padding: 20 }}>
          {/* ── INPUT STATE ── */}
          {!result && (
            <>
              {/* Mode tabs */}
              <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderRadius: 6, overflow: 'hidden', border: '1px solid #334155', width: 'fit-content' }}>
                {[['upload', '📎 Upload File'], ['paste', '📋 Paste Text']].map(([m, label]) => (
                  <button
                    key={m}
                    onClick={() => { setMode(m); setError(''); }}
                    style={{
                      padding: '7px 18px', fontSize: 13, fontWeight: 600, border: 'none',
                      borderRadius: 0, cursor: 'pointer',
                      background: mode === m ? '#2eb860' : '#0d1117',
                      color: mode === m ? '#fff' : '#94a3b8',
                      transition: 'background .15s, color .15s'
                    }}
                  >{label}</button>
                ))}
              </div>

              {/* Upload mode */}
              {mode === 'upload' && (
                <div
                  onDragOver={e => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: `2px dashed ${dragging ? '#2eb860' : file ? '#2eb860' : '#334155'}`,
                    borderRadius: 8, padding: '28px 20px', textAlign: 'center',
                    cursor: 'pointer',
                    background: dragging ? 'rgba(46,184,96,0.08)' : file ? 'rgba(46,184,96,0.06)' : '#0d1117',
                    transition: 'all .15s', marginBottom: 12
                  }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".docx,.txt"
                    style={{ display: 'none' }}
                    onChange={e => handleFile(e.target.files[0])}
                  />
                  {file ? (
                    <>
                      <div style={{ fontSize: 28, marginBottom: 6 }}>✅</div>
                      <div style={{ fontWeight: 600, color: '#2eb860', fontSize: 14 }}>{file.name}</div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>
                        {(file.size / 1024).toFixed(0)} KB — click to change
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 32, marginBottom: 8 }}>📄</div>
                      <div style={{ fontWeight: 600, color: '#94a3b8', fontSize: 14 }}>
                        Drop your interview doc here, or click to browse
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>
                        Supports .docx (Google Doc export) and .txt · Max 20MB
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Paste mode */}
              {mode === 'paste' && (
                <textarea
                  value={pastedText}
                  onChange={e => setPastedText(e.target.value)}
                  placeholder="Paste your interview notes or Google Doc text here…&#10;&#10;The more complete the document, the more fields Claude can extract."
                  style={{
                    width: '100%', minHeight: 180, fontFamily: 'system-ui, sans-serif',
                    fontSize: 13, padding: 12, border: '1px solid #334155',
                    borderRadius: 6, resize: 'vertical', lineHeight: 1.6,
                    marginBottom: 12, background: '#0d1117', color: '#e2e8f0',
                    outline: 'none', boxSizing: 'border-box'
                  }}
                />
              )}

              {error && (
                <div style={{
                  padding: '10px 14px', borderRadius: 6, fontSize: 13,
                  background: 'rgba(220,38,38,0.1)', color: '#f87171', borderLeft: '4px solid #ef4444',
                  marginBottom: 12
                }}>{error}</div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <button
                  className="btn-primary"
                  onClick={handleExtract}
                  disabled={!canExtract || extracting}
                  style={{ minWidth: 160 }}
                >
                  {extracting
                    ? <><span className="spinner" />Analyzing…</>
                    : '⚡ Extract Fields →'}
                </button>
                {extracting && (
                  <span style={{ fontSize: 12, color: '#64748b' }}>
                    Claude is reading the document — usually 10–30 seconds
                  </span>
                )}
              </div>
            </>
          )}

          {/* ── RESULTS STATE ── */}
          {result && (
            <>
              {/* Summary bar */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14,
                padding: '10px 16px', background: 'rgba(46,184,96,0.1)', borderRadius: 6,
                border: '1px solid rgba(46,184,96,0.3)'
              }}>
                <span style={{ fontSize: 22 }}>🎯</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15, color: '#2eb860' }}>
                    {result.field_count} field{result.field_count !== 1 ? 's' : ''} extracted
                  </div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 1 }}>
                    Review below, deselect any you don't want, then click Apply.
                  </div>
                </div>
                <label style={{
                  display: 'flex', alignItems: 'center', gap: 7, marginLeft: 'auto',
                  cursor: 'pointer', fontSize: 13, color: '#94a3b8', fontWeight: 500, whiteSpace: 'nowrap'
                }}>
                  <input
                    type="checkbox"
                    checked={overwrite}
                    onChange={e => setOverwrite(e.target.checked)}
                    style={{ width: 14, height: 14, accentColor: '#2eb860', cursor: 'pointer' }}
                  />
                  Overwrite existing values
                </label>
              </div>

              {/* Field checklist */}
              <div style={{
                maxHeight: 320, overflowY: 'auto', border: '1px solid #2d3748',
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
                        background: checked ? '#1e293b' : '#161f2e',
                        borderBottom: i < result.fields_found.length - 1 ? '1px solid #1a2235' : 'none',
                        opacity: checked ? 1 : 0.5,
                        transition: 'opacity .15s, background .15s'
                      }}
                    >
                      <div style={{
                        width: 18, height: 18, borderRadius: 3, flexShrink: 0, marginTop: 1,
                        border: `2px solid ${checked ? '#2eb860' : '#334155'}`,
                        background: checked ? '#2eb860' : '#0d1117',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        {checked && <span style={{ color: '#fff', fontSize: 11, fontWeight: 700, lineHeight: 1 }}>✓</span>}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>
                            {labelFor(key)}
                          </span>
                          {filled && !overwrite && (
                            <span style={{
                              fontSize: 10, padding: '1px 6px', borderRadius: 10,
                              background: 'rgba(251,191,36,0.15)', color: '#fbbf24', fontWeight: 600
                            }}>will skip</span>
                          )}
                          {filled && overwrite && (
                            <span style={{
                              fontSize: 10, padding: '1px 6px', borderRadius: 10,
                              background: 'rgba(239,68,68,0.15)', color: '#f87171', fontWeight: 600
                            }}>will overwrite</span>
                          )}
                          {!filled && (
                            <span style={{
                              fontSize: 10, padding: '1px 6px', borderRadius: 10,
                              background: 'rgba(46,184,96,0.15)', color: '#2eb860', fontWeight: 600
                            }}>new</span>
                          )}
                        </div>
                        <div style={{
                          fontSize: 12, color: '#94a3b8', marginTop: 2,
                          fontFamily: typeof val === 'string' && val.includes('\n') ? 'monospace' : 'inherit',
                          whiteSpace: 'pre-wrap', wordBreak: 'break-word'
                        }}>
                          {truncate(val)}
                        </div>
                      </div>
                    </label>
                  );
                })}
              </div>

              {/* Selected count */}
              <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
                {result.field_count - deselected.size} of {result.field_count} fields selected
              </div>

              {/* Apply message */}
              {applyMsg && (
                <div style={{
                  padding: '10px 14px', borderRadius: 6, fontSize: 13, marginBottom: 12,
                  background: applyMsg.startsWith('✓') ? 'rgba(46,184,96,0.1)' : 'rgba(239,68,68,0.1)',
                  color: applyMsg.startsWith('✓') ? '#2eb860' : '#f87171',
                  borderLeft: `4px solid ${applyMsg.startsWith('✓') ? '#2eb860' : '#ef4444'}`
                }}>{applyMsg}</div>
              )}

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  className="btn-primary"
                  onClick={handleApply}
                  disabled={applying || deselected.size === result.field_count}
                >
                  {applying
                    ? <><span className="spinner" />Applying…</>
                    : '✓ Apply to Form'}
                </button>
                <button className="btn-ghost" onClick={handleReset}>
                  ↺ Discard &amp; Try Again
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
