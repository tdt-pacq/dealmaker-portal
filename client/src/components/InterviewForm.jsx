import React, { useState, useCallback, useRef, useEffect } from 'react';
import { updateDeal } from '../api';

const TEAM_MEMBERS = [
  { name: 'Michael', role: 'Lead Broker | Deal Structure | Strategy | Negotiations' },
  { name: 'Robin', role: 'Acquisition Advisor | Operations | Due Diligence | Buyer Success' },
  { name: 'Alisha', role: 'Acquisition Advisor | Seller Success' },
  { name: 'Lee', role: 'Lender Liaison | SBA Lending Expert' },
  { name: 'Lance', role: 'Operations | Business Listings | Leads' },
];

const REQUIRED_FIELDS = [
  'business_description', 'year_founded', 'business_city_state',
  'revenue_year1', 'sde_year1', 'asking_price', 'employees_count',
  'financing_type', 'down_payment_required'
];

function Field({ label, name, value, onChange, onBlur, type = 'text', rows = 3, required, hint, placeholder }) {
  const isTextarea = type === 'textarea';
  return (
    <div className="field-group">
      <label>
        {label}
        {required && <span className="required"> *</span>}
      </label>
      {isTextarea ? (
        <textarea
          name={name}
          value={value || ''}
          onChange={onChange}
          onBlur={onBlur}
          rows={rows}
          placeholder={placeholder}
        />
      ) : type === 'color' ? (
        <div className="color-input-wrap">
          <input type="color" name={name + '_picker'} value={value || '#2D5016'}
            onChange={e => onChange({ target: { name, value: e.target.value } })}
            onBlur={onBlur}
          />
          <input type="text" name={name} value={value || ''} onChange={onChange} onBlur={onBlur}
            placeholder="#2D5016" style={{ maxWidth: 120 }}
          />
        </div>
      ) : (
        <input
          type={type}
          name={name}
          value={value || ''}
          onChange={onChange}
          onBlur={onBlur}
          placeholder={placeholder}
        />
      )}
      {hint && <div style={{ fontSize: 11, color: '#888', marginTop: 3 }}>{hint}</div>}
    </div>
  );
}

function Section({ num, title, children, id }) {
  const [open, setOpen] = useState(num <= 2);
  return (
    <div className="form-section" id={id}>
      <div className={`form-section-header ${open ? 'open' : ''}`} onClick={() => setOpen(!open)}>
        <span className="section-num">{num < 10 ? `0${num}` : num}</span>
        <span className="form-section-title">{title}</span>
        <span className={`section-chevron ${open ? 'open' : ''}`}>▾</span>
      </div>
      {open && <div className="form-section-body">{children}</div>}
    </div>
  );
}

function FinancialYear({ yearNum, data, onChange, onBlur }) {
  const prefix = `fin_year${yearNum}_`;
  const f = (field) => data[prefix + field] || '';
  const h = (field) => e => onChange({ target: { name: prefix + field, value: e.target.value } });

  return (
    <tr>
      <td className="row-label" style={{ fontWeight: 700 }}>
        <input type="text" name={prefix + 'label'} value={f('label')} onChange={h('label')} onBlur={onBlur}
          placeholder="Year" style={{ width: 70, fontSize: 13, padding: '4px 6px' }} />
      </td>
      {['revenue','cogs','gross_profit','operating_exp','net_income','depreciation',
        'amortization','interest','ebitda','owner_salary','sde'].map(field => (
        <td key={field}>
          <input type="text" name={prefix + field} value={f(field)} onChange={h(field)} onBlur={onBlur}
            placeholder="$" style={{ width: 100, fontSize: 12 }} />
        </td>
      ))}
    </tr>
  );
}

const DRAFT_KEY = id => `interview_draft_${id}`;

function saveDraft(id, data) {
  try { localStorage.setItem(DRAFT_KEY(id), JSON.stringify(data)); } catch { /* storage full */ }
}

function loadDraft(id) {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY(id)) || 'null'); } catch { return null; }
}

function clearDraft(id) {
  try { localStorage.removeItem(DRAFT_KEY(id)); } catch {}
}

export default function InterviewForm({ deal, onUpdate }) {
  const serverData = (() => { try { return JSON.parse(deal.interview_data || '{}'); } catch { return {}; } })();
  const [data, setData] = useState(() => {
    const draft = loadDraft(deal.id);
    // Restore draft if it has content the server doesn't
    if (draft && JSON.stringify(draft) !== JSON.stringify(serverData)) return draft;
    return serverData;
  });
  const [saveStatus, setSaveStatus] = useState('');
  const [draftRestored, setDraftRestored] = useState(() => {
    const draft = loadDraft(deal.id);
    return !!(draft && JSON.stringify(draft) !== JSON.stringify(serverData));
  });
  const saveTimeout = useRef(null);

  // When the deal prop updates from server (after save), sync only if no pending draft
  useEffect(() => {
    try {
      const fresh = JSON.parse(deal.interview_data || '{}');
      // Don't overwrite if user has a draft in progress
      if (!loadDraft(deal.id)) setData(fresh);
    } catch { /* */ }
  }, [deal.interview_data]);

  const handleChange = useCallback((e) => {
    const { name, value } = e.target;
    setData(prev => {
      const next = { ...prev, [name]: value };
      saveDraft(deal.id, next);
      return next;
    });
  }, [deal.id]);

  const handleCheckbox = useCallback((name, checked) => {
    setData(prev => {
      const arr = prev[name] ? [...prev[name]] : [];
      const next = checked
        ? { ...prev, [name]: [...arr, name.startsWith('deal_team') ? checked : checked] }
        : prev;
      saveDraft(deal.id, next);
      return next;
    });
  }, [deal.id]);

  const handleTeamToggle = useCallback((memberName) => {
    setData(prev => {
      const current = prev.deal_team_members || [];
      const updated = current.includes(memberName)
        ? current.filter(m => m !== memberName)
        : [...current, memberName];
      const next = { ...prev, deal_team_members: updated };
      saveDraft(deal.id, next);
      return next;
    });
  }, [deal.id]);

  const triggerSave = useCallback(async (latestData) => {
    setSaveStatus('saving');
    try {
      await updateDeal(deal.id, { interview_data: JSON.stringify(latestData) });
      clearDraft(deal.id);
      setDraftRestored(false);
      setSaveStatus('saved');
      if (onUpdate) onUpdate();
      setTimeout(() => setSaveStatus(''), 2500);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus(''), 3000);
    }
  }, [deal.id, onUpdate]);

  const handleBlur = useCallback(() => {
    clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      setData(current => {
        triggerSave(current);
        return current;
      });
    }, 300);
  }, [triggerSave]);

  const f = name => data[name] || '';
  const F = (props) => <Field {...props} value={f(props.name)} onChange={handleChange} onBlur={handleBlur} />;

  const sectionComplete = (fields) => fields.every(f => data[f]);
  const completedSections = [
    sectionComplete(['business_description', 'year_founded', 'business_city_state']),
    sectionComplete(['core_products', 'pricing_strategy']),
    sectionComplete(['branding_strategy', 'marketing_channels']),
    sectionComplete(['sales_process', 'sales_trends']),
    sectionComplete(['total_customers', 'repeat_customer_pct']),
    sectionComplete(['employees_count', 'org_structure']),
    sectionComplete(['fin_year1_revenue', 'fin_year1_sde']),
    sectionComplete(['growth_opportunities']),
    sectionComplete(['asking_price', 'financing_type']),
    sectionComplete(['deal_team_members']),
  ].filter(Boolean).length;

  const sections = [
    'Executive Summary', 'Products & Services', 'Marketing', 'Sales',
    'Customers', 'Employees', 'Financials', 'Growth Opportunities',
    'Transaction Details', 'Deal Team'
  ];

  return (
    <div className="interview-layout">
      {/* Sidebar nav */}
      <div className="section-nav">
        <div className="section-nav-header">Sections</div>
        {sections.map((s, i) => (
          <div
            key={s}
            className="section-nav-item"
            onClick={() => document.getElementById(`section-${i + 1}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          >
            <span style={{ fontSize: 12, color: '#999', minWidth: 20 }}>{String(i + 1).padStart(2, '0')}</span>
            {s}
          </div>
        ))}
        <div className="section-nav-progress">
          <div style={{ fontWeight: 600, color: '#333' }}>{completedSections} / {sections.length} sections</div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${(completedSections / sections.length) * 100}%` }} />
          </div>
        </div>
      </div>

      {/* Form sections */}
      <div>
        {/* SECTION 1: EXECUTIVE SUMMARY */}
        <Section num={1} title="Executive Summary" id="section-1">
          <h4 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#C1622F', marginBottom: 14 }}>
            Business Identification
          </h4>
          <div className="field-row">
            <F label="Business Legal Name (including DBAs)" name="business_legal_name" type="text" hint="Used internally only — not shown in blind outputs" />
            <F label="Business Website" name="business_website" type="url" />
          </div>
          <div className="field-row-3">
            <F label="Year Founded" name="year_founded" type="text" placeholder="e.g. 2003" required />
            <F label="Year Owner Took Over" name="year_owner_took_over" type="text" placeholder="e.g. 2003" />
            <F label="City, State" name="business_city_state" type="text" placeholder="e.g. Greensboro, NC" required hint="City + State only — used for blind location" />
          </div>
          <div className="field-row">
            <F label="Hours of Operation" name="hours_of_operation" placeholder="e.g. Mon-Fri 8am-5pm" />
            <F label="Business Entity Type" name="entity_type" placeholder="e.g. S-Corp, LLC" />
          </div>
          <F label="General Business Description" name="business_description" type="textarea" rows={4}
            required hint="Describe the business without revealing its name — used in blind ad and CBR" />

          <div style={{ height: 1, background: '#eee', margin: '20px 0' }} />
          <h4 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#C1622F', marginBottom: 14 }}>
            Owner Background (CBR Only)
          </h4>
          <F label="Origin Story of the Business" name="origin_story" type="textarea" rows={3} />
          <div className="field-row">
            <F label="Owner's Skills & Experience" name="owner_skills" type="textarea" rows={3} />
            <F label="Typical Day for the Owner" name="typical_day" type="textarea" rows={3} />
          </div>
          <div className="field-row">
            <F label="Primary Roles & Responsibilities" name="primary_roles" type="textarea" rows={3} />
            <F label="How Business Operates Without Owner (2 Weeks)" name="owner_absent" type="textarea" rows={3} />
          </div>
          <div className="field-row">
            <F label="Vision & Mission" name="vision_mission" type="textarea" rows={2} />
            <F label="Core Values" name="core_values" type="textarea" rows={2} />
          </div>
          <F label="Reason for Selling" name="reason_for_selling" type="textarea" rows={2} hint="Used in blind ad" />
          <div className="field-row">
            <F label="Top 5 Growth Strategies (if Owner Kept Business)" name="top_5_growth" type="textarea" rows={4} />
            <div>
              <F label="What Makes Owner Optimistic?" name="owner_optimistic" type="textarea" rows={2} />
              <F label="What Concerns Owner Most?" name="owner_concerns" type="textarea" rows={2} />
            </div>
          </div>
          <div className="field-row">
            <F label="#1 Advice for New Buyer" name="advice_for_buyer" type="textarea" rows={2} />
            <F label="#1 Warning for New Buyer" name="warning_for_buyer" type="textarea" rows={2} />
          </div>

          <div style={{ height: 1, background: '#eee', margin: '20px 0' }} />
          <h4 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#C1622F', marginBottom: 14 }}>
            Business Model Overview
          </h4>
          <div className="field-row">
            <F label="Owner Compensation Method" name="owner_compensation_method" placeholder="e.g. S-Corp distribution + W-2" />
            <F label="Licenses Held" name="licenses_held" type="textarea" rows={2} />
          </div>
          <F label="Key Systems, Technology & SOPs" name="key_systems" type="textarea" rows={3} />
          <div className="field-row">
            <F label="Intellectual Property Owned?" name="intellectual_property" type="textarea" rows={2} />
            <F label="Current Litigation Status" name="litigation_status" placeholder="None / describe" />
          </div>

          <div style={{ height: 1, background: '#eee', margin: '20px 0' }} />
          <h4 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#C1622F', marginBottom: 14 }}>
            Industry
          </h4>
          <div className="field-row">
            <F label="Key Industry Highlights" name="industry_highlights" type="textarea" rows={3} />
            <F label="Current Trends Shaping the Industry" name="industry_trends" type="textarea" rows={3} />
          </div>
          <div className="field-row">
            <F label="Primary Industry Challenges" name="industry_challenges" type="textarea" rows={3} />
            <F label="Opportunities Within the Industry" name="industry_opportunities" type="textarea" rows={3} />
          </div>
          <div className="field-row">
            <F label="Main Profit Drivers" name="profit_drivers" type="textarea" rows={2} />
            <F label="Political / Regulatory Factors" name="regulatory_factors" type="textarea" rows={2} />
          </div>

          <div style={{ height: 1, background: '#eee', margin: '20px 0' }} />
          <h4 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#C1622F', marginBottom: 14 }}>
            Key Highlights (Blind Ad + Flyer + CBR)
          </h4>
          <div className="field-row">
            <F label="Number of Employees" name="employees_count" placeholder="e.g. 12 FT, 4 PT" required />
            <F label="Asking Price" name="asking_price" placeholder="e.g. 1750000" required hint="Numbers only, no $ or commas" />
          </div>
          <div className="field-row-3">
            <div>
              <F label="Revenue — Most Recent Full Year" name="revenue_year1" placeholder="e.g. 2850000" required hint="No $ or commas" />
              <Field label="Year Label" name="revenue_year1_label" placeholder="e.g. 2024"
                value={f('revenue_year1_label')} onChange={handleChange} onBlur={handleBlur} />
            </div>
            <div>
              <F label="SDE / Seller Discretionary Earnings" name="sde_year1" placeholder="e.g. 485000" required />
              <Field label="SDE Year Label" name="sde_year1_label" placeholder="e.g. 2024"
                value={f('sde_year1_label')} onChange={handleChange} onBlur={handleBlur} />
            </div>
            <div>
              <F label="EBITDA" name="ebitda_year1" placeholder="e.g. 420000" />
              <Field label="EBITDA Year Label" name="ebitda_year1_label" placeholder="e.g. 2024"
                value={f('ebitda_year1_label')} onChange={handleChange} onBlur={handleBlur} />
            </div>
          </div>
          <div className="field-row">
            <F label="Real Estate Situation" name="real_estate_situation" type="textarea" rows={2} hint="Owned / Leased / Included in price?" />
            <F label="Real Estate Value (if known)" name="real_estate_value" placeholder="e.g. 850000" />
          </div>
          <div className="field-row-3">
            <F label="FF&E Value" name="ffe_value" placeholder="e.g. 320000" />
            <F label="Inventory Value" name="inventory_value" placeholder="e.g. 175000" />
            <F label="Down Payment Required" name="down_payment_required" placeholder="e.g. 10% ($175,000)" required />
          </div>
          <div className="field-row">
            <div className="field-group">
              <label>SBA Pre-Approved?</label>
              <select name="sba_preapproved" value={f('sba_preapproved')} onChange={handleChange} onBlur={handleBlur}>
                <option value="">Select…</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
                <option value="In process">In process</option>
              </select>
            </div>
            <F label="Financing Available (describe)" name="financing_available" type="textarea" rows={2} />
          </div>
        </Section>

        {/* SECTION 2: PRODUCTS & SERVICES */}
        <Section num={2} title="Products & Services" id="section-2">
          <F label="Core Products or Services Offered" name="core_products" type="textarea" rows={4}
            hint="List each product/service line" />
          <div className="field-row">
            <F label="Pricing Strategy" name="pricing_strategy" type="textarea" rows={3} />
            <F label="Delivery / Fulfillment Process" name="delivery_process" type="textarea" rows={3} />
          </div>
          <div className="field-row">
            <F label="What Makes Offerings Unique vs. Competitors?" name="unique_offerings" type="textarea" rows={3} />
            <F label="Diversification of Products / Services" name="product_diversification" type="textarea" rows={3} />
          </div>
          <div className="field-row">
            <F label="Supplier / Vendor Diversification" name="supplier_diversification" type="textarea" rows={3} />
            <F label="Products / Services Currently in Development" name="products_in_development" type="textarea" rows={3} />
          </div>
          <F label="Future Product / Service Potential" name="future_product_potential" type="textarea" rows={3} />
        </Section>

        {/* SECTION 3: MARKETING */}
        <Section num={3} title="Marketing" id="section-3">
          <div className="field-row">
            <F label="Branding Strategy" name="branding_strategy" type="textarea" rows={3} />
            <F label="Social Reputation / Online Reviews" name="social_reputation" type="textarea" rows={3} hint="Include star ratings, platforms, review counts" />
          </div>
          <div className="field-row">
            <F label="Marketing Channels Used" name="marketing_channels" type="textarea" rows={3} />
            <F label="Metrics Used to Measure Marketing ROI" name="marketing_roi_metrics" type="textarea" rows={3} />
          </div>
          <div className="field-row">
            <F label="Primary Marketing Strengths" name="marketing_strengths" type="textarea" rows={3} />
            <F label="Primary Marketing Weaknesses" name="marketing_weaknesses" type="textarea" rows={3} />
          </div>
          <div className="field-row">
            <F label="Market Positioning" name="market_positioning" type="textarea" rows={3} />
            <F label="Why Customers Choose This Business Over Competitors" name="why_customers_choose" type="textarea" rows={3} />
          </div>
        </Section>

        {/* SECTION 4: SALES */}
        <Section num={4} title="Sales" id="section-4">
          <div className="field-row">
            <F label="Sales Process Description" name="sales_process" type="textarea" rows={4} />
            <F label="Sales Trends Observed" name="sales_trends" type="textarea" rows={4} />
          </div>
          <div className="field-row">
            <F label="Sales Channels" name="sales_channels" type="textarea" rows={3} />
            <F label="Who Is Responsible for Sales?" name="sales_responsible" type="textarea" rows={3} />
          </div>
          <div className="field-row">
            <F label="Any Sales Superstars on the Team?" name="sales_superstars" type="textarea" rows={3} />
            <F label="Growth Opportunities in Sales" name="sales_growth_opportunities" type="textarea" rows={3} />
          </div>
          <div className="field-row">
            <F label="Seasonality or Cyclical Trends" name="seasonality" type="textarea" rows={3} />
            <div className="field-group">
              <label>Monthly Recurring Revenue (MRR)</label>
              <input type="text" name="mrr_amount" value={f('mrr_amount')} onChange={handleChange} onBlur={handleBlur} placeholder="e.g. $65,000/month" />
              <div style={{ marginTop: 8 }}>
                <label>MRR Description</label>
                <textarea name="mrr" value={f('mrr')} onChange={handleChange} onBlur={handleBlur} rows={2} />
              </div>
            </div>
          </div>
        </Section>

        {/* SECTION 5: CUSTOMERS */}
        <Section num={5} title="Customers" id="section-5">
          <div className="field-row">
            <F label="Total Number of Customers" name="total_customers" placeholder="e.g. ~850 active accounts" />
            <F label="% Repeat / Long-Term Clients" name="repeat_customer_pct" placeholder="e.g. 68% repeat revenue" />
          </div>
          <div className="field-row">
            <F label="Customer Satisfaction Approach" name="customer_satisfaction" type="textarea" rows={3} />
            <F label="Customer Service Strengths" name="customer_service_strengths" type="textarea" rows={3} />
          </div>
          <div className="field-row">
            <F label="Customer Service Improvement Areas" name="customer_service_improvements" type="textarea" rows={3} />
            <F label="Average Revenue Per Customer" name="avg_revenue_per_customer" placeholder="e.g. $3,350/year" />
          </div>
          <div className="field-row">
            <F label="Customer Segmentation" name="customer_segmentation" type="textarea" rows={3} hint="Describe main customer types and % of revenue" />
            <F label="Geographic Distribution of Customers" name="customer_geography" type="textarea" rows={3} />
          </div>
          <F label="Size of Customer Database" name="customer_database_size" placeholder="e.g. 850 active, 2,400+ historical" />
        </Section>

        {/* SECTION 6: EMPLOYEES */}
        <Section num={6} title="Employees" id="section-6">
          <div className="field-row">
            <F label="Total Employees (FT / PT / Seasonal breakdown)" name="employee_detail" placeholder="e.g. 12 FT, 8 PT seasonal" />
            <F label="Organizational Structure" name="org_structure" type="textarea" rows={3} hint="Describe reporting hierarchy — used to generate org chart" />
          </div>
          <F label="Key Employees / Management / Leadership" name="key_employees" type="textarea" rows={4}
            hint="Name, role, tenure. Do NOT include in blind ad — CBR only." />
          <div className="field-row">
            <F label="Employee Challenges" name="employee_challenges" type="textarea" rows={3} />
            <F label="Regulatory or Compliance Issues" name="compliance_issues" type="textarea" rows={3} />
          </div>
          <div className="field-row">
            <F label="Hiring Challenges" name="hiring_challenges" type="textarea" rows={3} />
            <F label="HR Systems Used" name="hr_systems" placeholder="e.g. Gusto, ADP" />
          </div>
          <div className="field-row">
            <F label="Benefits Offered" name="benefits" type="textarea" rows={3} />
            <F label="Compensation Approach" name="compensation_approach" type="textarea" rows={3} />
          </div>
          <F label="Expected Employee Transitions Post-Sale" name="post_sale_transitions" type="textarea" rows={3} />
        </Section>

        {/* SECTION 7: FINANCIALS */}
        <Section num={7} title="Financials" id="section-7">
          <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
            Enter financial data for up to 4 years (most recent first). Leave unused years blank.
          </p>
          <div style={{ overflowX: 'auto', marginBottom: 24 }}>
            <table className="fin-table">
              <thead>
                <tr>
                  <th style={{ minWidth: 180 }}>Metric</th>
                  {[1,2,3,4].map(y => (
                    <th key={y} style={{ minWidth: 110 }}>Year {y}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ['Revenue', 'revenue'],
                  ['COGS', 'cogs'],
                  ['Gross Profit', 'gross_profit', true],
                  ['Operating Expenses', 'operating_exp'],
                  ['Net Income / Pre-Tax Profit', 'net_income'],
                  ['Depreciation', 'depreciation'],
                  ['Amortization', 'amortization'],
                  ['Interest', 'interest'],
                  ['EBITDA', 'ebitda', true],
                  ['Owner Salary / Comp Addback', 'owner_salary'],
                  ['Other Addbacks', 'other_addbacks'],
                  ['SDE / Adjusted Cash Flow', 'sde', true],
                ].map(([label, field, bold]) => (
                  <tr key={field} className={bold ? 'bold-row' : ''}>
                    <td className="row-label">{label}</td>
                    {[1,2,3,4].map(y => (
                      <td key={y}>
                        <input
                          type="text"
                          name={`fin_year${y}_${field}`}
                          value={data[`fin_year${y}_${field}`] || ''}
                          onChange={handleChange}
                          onBlur={handleBlur}
                          placeholder={y === 1 ? '$' : ''}
                          style={{ width: 100, fontSize: 12 }}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
                <tr style={{ background: '#fff8f0' }}>
                  <td className="row-label" style={{ fontStyle: 'italic', color: '#888', fontSize: 12 }}>Other Addbacks Detail</td>
                  {[1,2,3,4].map(y => (
                    <td key={y}>
                      <textarea
                        name={`fin_year${y}_other_addbacks_detail`}
                        value={data[`fin_year${y}_other_addbacks_detail`] || ''}
                        onChange={handleChange}
                        onBlur={handleBlur}
                        rows={2}
                        style={{ width: 100, fontSize: 11, padding: 4, border: '1px solid #eee' }}
                        placeholder="itemize..."
                      />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>

          <h4 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#C1622F', marginBottom: 14 }}>
            Financial Context
          </h4>
          <div className="field-row">
            <F label="Fiscal Year End" name="fiscal_year_end" placeholder="e.g. December 31" />
            <F label="Financial Record System" name="financial_record_system" placeholder="e.g. QuickBooks Online, CPA-reviewed" />
          </div>
          <div className="field-row-3">
            <div className="field-group">
              <label>Accuracy Rating (1–10)</label>
              <select name="accuracy_rating" value={f('accuracy_rating')} onChange={handleChange} onBlur={handleBlur}>
                <option value="">Select…</option>
                {[10,9,8,7,6,5,4,3,2,1].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>
            <div className="field-group">
              <label>Records Current?</label>
              <select name="records_current" value={f('records_current')} onChange={handleChange} onBlur={handleBlur}>
                <option value="">Select…</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </div>
            <div className="field-group">
              <label>Strong Asset List Available?</label>
              <select name="asset_list_available" value={f('asset_list_available')} onChange={handleChange} onBlur={handleBlur}>
                <option value="">Select…</option>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
                <option value="In progress">In progress</option>
              </select>
            </div>
          </div>
          <div className="field-row">
            <F label="Assets Not Conveyed in Sale" name="assets_not_conveyed" type="textarea" rows={2} />
            <F label="Current Cash Flow Status" name="cash_flow_status" type="textarea" rows={2} />
          </div>
          <div className="field-row">
            <F label="Any Cash Flow Decline Causes?" name="cash_flow_decline" type="textarea" rows={2} />
            <F label="How Business Compares to Industry Benchmarks" name="industry_benchmarks" type="textarea" rows={2} />
          </div>
          <div className="field-group">
            <label>Five-Year Projections Available?</label>
            <select name="five_year_projections" value={f('five_year_projections')} onChange={handleChange} onBlur={handleBlur} style={{ width: 200 }}>
              <option value="">Select…</option>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
              <option value="In development">In development</option>
            </select>
          </div>

          <h4 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#C1622F', marginBottom: 14, marginTop: 20 }}>
            Revenue by Segment / Division (up to 5)
          </h4>
          {[1,2,3,4,5].map(n => (
            <div className="field-row" key={n} style={{ gap: 12, alignItems: 'flex-end' }}>
              <Field label={n === 1 ? 'Segment Name' : ''} name={`rev_segment${n}_name`}
                value={f(`rev_segment${n}_name`)} onChange={handleChange} onBlur={handleBlur}
                placeholder={`Segment ${n} name`} />
              <div style={{ maxWidth: 120 }}>
                {n === 1 && <label>% of Revenue</label>}
                <input type="text" name={`rev_segment${n}_pct`} value={f(`rev_segment${n}_pct`)}
                  onChange={handleChange} onBlur={handleBlur} placeholder="0%" />
              </div>
            </div>
          ))}

          <h4 style={{ fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, color: '#C1622F', marginBottom: 14, marginTop: 20 }}>
            Assets
          </h4>
          <F label="FF&E Description & Appraised Value" name="ffe_description" type="textarea" rows={3} />
          <div className="field-row">
            <F label="Land / Real Estate Value" name="land_value" placeholder="e.g. 850000" />
            <F label="Inventory Value (note seasonal variability)" name="inventory_appraised" type="textarea" rows={2} />
          </div>
          <F label="Total Appraised Asset Value" name="total_appraised_assets" placeholder="e.g. 1345000" />
        </Section>

        {/* SECTION 8: GROWTH OPPORTUNITIES */}
        <Section num={8} title="Growth Opportunities" id="section-8">
          <p style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>
            Enter up to 8 growth opportunities. Aim for brief, compelling bullet-style descriptions.
          </p>
          <F label="Growth Opportunities (one per line, or numbered list)" name="growth_opportunities"
            type="textarea" rows={10}
            placeholder="1. Launch irrigation installation division — equipment purchased, licensing in progress&#10;2. Expand commercial HOA contracts — only 12% market penetration in target counties&#10;3. Online plant retail store — ship specialty plants regionally"
            hint="Minimum 2 recommended" />
        </Section>

        {/* SECTION 9: TRANSACTION DETAILS */}
        <Section num={9} title="Transaction Details" id="section-9">
          <div className="field-row">
            <F label="Asking / Listing Price" name="listing_price" placeholder="e.g. 1750000" />
            <F label="Down Payment %" name="down_payment_pct" placeholder="e.g. 10% SBA / 20-25% conventional" />
          </div>
          <div className="field-row">
            <F label="Deal Structure Preference" name="deal_structure" type="textarea" rows={3}
              hint="Asset purchase vs. stock sale, real estate included/excluded, etc." />
            <F label="Financing Type" name="financing_type" type="textarea" rows={3}
              placeholder="SBA 7(a), seller carry, conventional, etc." required />
          </div>
          <F label="Transition Plan" name="transition_plan" type="textarea" rows={3}
            hint="Will seller stay on? Duration? Training offered?" />
          <F label="Buyer Process Notes" name="buyer_process_notes" type="textarea" rows={3}
            hint="Preferred buyer profile, special requirements, etc." />
        </Section>

        {/* SECTION 10: DEAL TEAM */}
        <Section num={10} title="Deal Team" id="section-10">
          <p style={{ fontSize: 13, color: '#666', marginBottom: 16 }}>
            Select team members to include in this deal's CBR. All Peterson Acquisitions team members shown below.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
            {TEAM_MEMBERS.map(member => {
              const selected = (data.deal_team_members || []).includes(member.name);
              return (
                <div
                  key={member.name}
                  onClick={() => handleTeamToggle(member.name)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 16px', border: `2px solid ${selected ? '#C1622F' : '#e0e0e0'}`,
                    borderRadius: 6, cursor: 'pointer', background: selected ? '#fff0ea' : 'white',
                    transition: 'all 0.15s'
                  }}
                >
                  <div style={{
                    width: 20, height: 20, borderRadius: 4,
                    border: `2px solid ${selected ? '#C1622F' : '#ccc'}`,
                    background: selected ? '#C1622F' : 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    {selected && <span style={{ color: 'white', fontSize: 12, fontWeight: 700 }}>✓</span>}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#1A1A1A' }}>{member.name}</div>
                    <div style={{ fontSize: 12, color: '#666' }}>{member.role}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <F label="Seller Brand Color (for CBR section accents)" name="seller_brand_color" type="color"
            hint="Pulled from seller's branding. Defaults to dark green #2D5016 if not specified." />
        </Section>

        {/* Draft restored banner */}
        {draftRestored && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: '#fff8e1', border: '1px solid #f59e0b', borderRadius: 6,
            padding: '10px 16px', margin: '16px 0', fontSize: 13, gap: 12,
          }}>
            <span>
              <strong>Draft restored</strong> — you have unsaved edits from your last session.
              Click any field and tab away to sync to the server.
            </span>
            <button
              className="btn-ghost btn-sm"
              style={{ flexShrink: 0 }}
              onClick={() => {
                clearDraft(deal.id);
                setDraftRestored(false);
                try { setData(JSON.parse(deal.interview_data || '{}')); } catch { /* */ }
              }}
            >
              Discard draft
            </button>
          </div>
        )}

        {/* Autosave indicator */}
        <div className={`autosave-indicator ${saveStatus ? 'visible' : ''}`}>
          {saveStatus === 'saving' && <><span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} />Saving…</>}
          {saveStatus === 'saved' && <>✓ Saved</>}
          {saveStatus === 'error' && <>⚠ Save failed</>}
        </div>
      </div>
    </div>
  );
}
