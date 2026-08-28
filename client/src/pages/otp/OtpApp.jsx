/**
 * OTP — Offer To Purchase
 * Form UI for collecting deal details → generates PDF via server/routes/otp.js
 */

import React, { useState, useCallback } from 'react';
import { getAuth } from '../../api';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function authHeaders() {
  const auth = getAuth();
  return auth ? { Authorization: `Basic ${auth}` } : {};
}

function parseMoney(val) {
  return String(val || '').replace(/[^0-9.]/g, '');
}

function formatMoneyInput(val) {
  const n = parseFloat(parseMoney(val));
  if (isNaN(n) || val === '') return '';
  return n.toLocaleString('en-US');
}

function parseNum(val) {
  const n = parseFloat(String(val || '').replace(/[^0-9.]/g, ''));
  return isNaN(n) ? 0 : n;
}

function fmtDisplay(val) {
  const n = parseNum(val);
  if (n === 0) return '—';
  return '$' + n.toLocaleString('en-US');
}

// ─── Form Field Components ────────────────────────────────────────────────────

function FieldGroup({ label, children, hint }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{
        display: 'block',
        fontSize: 11,
        fontWeight: 600,
        color: '#94a3b8',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginBottom: 5,
        fontFamily: 'system-ui, sans-serif',
      }}>
        {label}
      </label>
      {children}
      {hint && (
        <div style={{ fontSize: 10.5, color: '#475569', marginTop: 3, fontStyle: 'italic' }}>
          {hint}
        </div>
      )}
    </div>
  );
}

const inputStyle = {
  width: '100%',
  background: '#0f172a',
  border: '1px solid #1e2d45',
  borderRadius: 5,
  color: '#e2e8f0',
  padding: '8px 11px',
  fontSize: 13,
  fontFamily: 'system-ui, sans-serif',
  outline: 'none',
  transition: 'border-color 0.15s',
};

function TextInput({ value, onChange, placeholder, type = 'text', onFocus, onBlur }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder || ''}
      style={inputStyle}
      onFocus={e => { e.target.style.borderColor = '#2eb860'; if (onFocus) onFocus(e); }}
      onBlur={e => { e.target.style.borderColor = '#1e2d45'; if (onBlur) onBlur(e); }}
    />
  );
}

function TextArea({ value, onChange, placeholder, rows = 3 }) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder || ''}
      rows={rows}
      style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
      onFocus={e => { e.target.style.borderColor = '#2eb860'; }}
      onBlur={e => { e.target.style.borderColor = '#1e2d45'; }}
    />
  );
}

function MoneyInput({ value, onChange, placeholder }) {
  const [raw, setRaw] = useState(value || '');

  const handleChange = (v) => {
    const cleaned = v.replace(/[^0-9.]/g, '');
    setRaw(cleaned);
    onChange(cleaned);
  };

  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
        color: '#64748b', fontSize: 13, pointerEvents: 'none',
      }}>$</div>
      <input
        type="text"
        inputMode="numeric"
        value={raw ? Number(raw.replace(/[^0-9]/g, '')).toLocaleString('en-US') : ''}
        onChange={e => handleChange(e.target.value)}
        placeholder={placeholder || '0'}
        style={{ ...inputStyle, paddingLeft: 22 }}
        onFocus={e => { e.target.style.borderColor = '#2eb860'; }}
        onBlur={e => { e.target.style.borderColor = '#1e2d45'; }}
      />
    </div>
  );
}

function CheckToggle({ label, checked, onChange, hint }) {
  return (
    <label style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
      cursor: 'pointer',
      marginBottom: hint ? 2 : 8,
    }}>
      <div
        onClick={() => onChange(!checked)}
        style={{
          width: 18,
          height: 18,
          borderRadius: 3,
          border: checked ? '2px solid #2eb860' : '2px solid #2d3f57',
          background: checked ? '#2eb860' : 'transparent',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          marginTop: 1,
          cursor: 'pointer',
          transition: 'all 0.15s',
        }}
      >
        {checked && <span style={{ color: '#fff', fontSize: 11, lineHeight: 1 }}>✓</span>}
      </div>
      <span style={{ fontSize: 12.5, color: '#94a3b8', fontFamily: 'system-ui, sans-serif' }}>
        {label}
      </span>
    </label>
  );
}

// ─── Section Wrapper ──────────────────────────────────────────────────────────

function FormSection({ title, icon, children }) {
  return (
    <div style={{
      background: '#111827',
      border: '1px solid #1e2d45',
      borderRadius: 8,
      marginBottom: 16,
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '10px 18px',
        background: '#0d1526',
        borderBottom: '1px solid #1e2d45',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <span style={{ fontSize: 15 }}>{icon}</span>
        <span style={{
          fontFamily: 'system-ui, sans-serif',
          fontWeight: 700,
          fontSize: 11.5,
          color: '#cbd5e1',
          textTransform: 'uppercase',
          letterSpacing: 1,
        }}>{title}</span>
      </div>
      <div style={{ padding: '16px 18px' }}>{children}</div>
    </div>
  );
}

function TwoCol({ children }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 16px' }}>
      {children}
    </div>
  );
}

function ThreeCol({ children }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0 12px' }}>
      {children}
    </div>
  );
}

// ─── Price Summary Card ───────────────────────────────────────────────────────

function PriceSummary({ f }) {
  const depInitial = parseNum(f.depositInitial);
  const depAdditional = parseNum(f.depositAdditional);
  const depBalance = parseNum(f.depositBalance);
  const totalDown = depInitial + depAdditional + depBalance;
  const bankFin = parseNum(f.bankFinancing);
  const sellerFin = parseNum(f.sellerFinancing);
  const addlAmt = parseNum(f.additionalTermsAmount);
  const totalPurchase = totalDown + bankFin + sellerFin + addlAmt;

  const row = (label, val, bold, accent) => (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '4px 0',
      borderBottom: '1px solid #1a2535',
      color: accent ? '#2eb860' : bold ? '#e2e8f0' : '#94a3b8',
      fontWeight: bold ? 700 : 400,
      fontSize: accent ? 13 : 12,
    }}>
      <span>{label}</span>
      <span style={{ fontFamily: 'monospace' }}>{fmtDisplay(val)}</span>
    </div>
  );

  return (
    <div style={{
      background: '#0a1220',
      border: '1px solid #1e2d45',
      borderRadius: 6,
      padding: '12px 14px',
      marginTop: 8,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
        Price Structure Preview
      </div>
      {row('a. Initial Deposit', depInitial)}
      {row('b. Additional Deposit', depAdditional)}
      {row('c. Balance at Closing', depBalance)}
      {row('d. Total Down Payment', totalDown, true)}
      {row('e. Bank Financing', bankFin)}
      {row('f. Seller Financing', sellerFin)}
      {row('g. Additional Terms', addlAmt)}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '6px 0 0',
        marginTop: 4,
        borderTop: '2px solid #2eb860',
        color: '#2eb860',
        fontWeight: 700,
        fontSize: 13.5,
      }}>
        <span>Total Purchase Price</span>
        <span style={{ fontFamily: 'monospace' }}>{fmtDisplay(totalPurchase)}</span>
      </div>
    </div>
  );
}

// ─── Default Form State ───────────────────────────────────────────────────────

const DEFAULT_FORM = {
  // Meta
  date: '',
  managerInitials: '',
  // Deal
  businessName: '',
  businessLocation: '',
  advisorName: '',
  // Pricing
  purchasePrice: '',
  depositInitial: '',
  depositAdditional: '',
  depositBalance: '',
  bankFinancing: '',
  sellerFinancing: '',
  additionalTermsAmount: '',
  additionalTermsDescription: '',
  // Dates
  closingDate: '',
  // Inventory
  inventoryAmount: '',
  inventoryHasMinMax: false,
  inventoryMin: '',
  inventoryMax: '',
  inventoryPaidDirect: false,
  // Contingencies
  ataMinimum: '',
  contingencyK: '',
  contingencyL: '',
  expirationDate: '',
  // Buyer
  buyerName: '',
  buyerAddress: '',
  buyerCity: '',
  buyerState: '',
  buyerZip: '',
  buyerPhone: '',
  // Seller
  sellerBusinessName: '',
  sellerName: '',
  sellerAddress: '',
  sellerCity: '',
  sellerState: '',
  sellerZip: '',
  // Release
  releaseAdvisedBy: '',
  releaseBroker: '',
  // Addendum
  addendumItems: [],   // [{ id, title, body }]
};

// ─── Addendum Item Editor ─────────────────────────────────────────────────────

function AddendumEditor({ items, onChange }) {
  const addItem = () => {
    onChange([
      ...items,
      { id: Date.now() + Math.random(), title: '', body: '' },
    ]);
  };

  const updateItem = (id, field, val) => {
    onChange(items.map(it => it.id === id ? { ...it, [field]: val } : it));
  };

  const removeItem = (id) => {
    onChange(items.filter(it => it.id !== id));
  };

  const moveItem = (idx, dir) => {
    const next = [...items];
    const swap = idx + dir;
    if (swap < 0 || swap >= next.length) return;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    onChange(next);
  };

  return (
    <div>
      {items.length === 0 ? (
        <div style={{
          background: '#0a1220',
          border: '1px dashed #1e2d45',
          borderRadius: 6,
          padding: '16px',
          textAlign: 'center',
          color: '#475569',
          fontSize: 12,
          marginBottom: 12,
        }}>
          No addendum items yet. Click "Add Item" to include custom terms, equipment lists, or special conditions.
        </div>
      ) : (
        <div>
          {items.map((item, idx) => (
            <div key={item.id} style={{
              background: '#0a1220',
              border: '1px solid #1e2d45',
              borderRadius: 6,
              marginBottom: 10,
              overflow: 'hidden',
            }}>
              {/* Item header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                background: '#0d1829',
                borderBottom: '1px solid #1e2d45',
              }}>
                <span style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: '#2eb860',
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                  minWidth: 60,
                }}>
                  Item {idx + 1}
                </span>
                <input
                  type="text"
                  value={item.title}
                  onChange={e => updateItem(item.id, 'title', e.target.value)}
                  placeholder="Title / Label (e.g. Equipment List, Special Terms)"
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    borderBottom: '1px solid #1e2d45',
                    color: '#e2e8f0',
                    fontSize: 12.5,
                    fontWeight: 600,
                    padding: '2px 6px',
                    outline: 'none',
                    fontFamily: 'system-ui, sans-serif',
                  }}
                  onFocus={e => e.target.style.borderBottomColor = '#2eb860'}
                  onBlur={e => e.target.style.borderBottomColor = '#1e2d45'}
                />
                {/* Move up/down */}
                <button
                  onClick={() => moveItem(idx, -1)}
                  disabled={idx === 0}
                  title="Move up"
                  style={{
                    background: 'transparent', border: 'none',
                    color: idx === 0 ? '#1e2d45' : '#64748b',
                    cursor: idx === 0 ? 'default' : 'pointer',
                    fontSize: 13, padding: '2px 4px',
                  }}
                >▲</button>
                <button
                  onClick={() => moveItem(idx, 1)}
                  disabled={idx === items.length - 1}
                  title="Move down"
                  style={{
                    background: 'transparent', border: 'none',
                    color: idx === items.length - 1 ? '#1e2d45' : '#64748b',
                    cursor: idx === items.length - 1 ? 'default' : 'pointer',
                    fontSize: 13, padding: '2px 4px',
                  }}
                >▼</button>
                <button
                  onClick={() => removeItem(item.id)}
                  title="Remove item"
                  style={{
                    background: 'transparent', border: 'none',
                    color: '#ef4444', cursor: 'pointer',
                    fontSize: 15, padding: '2px 4px', lineHeight: 1,
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = '#fca5a5'}
                  onMouseLeave={e => e.currentTarget.style.color = '#ef4444'}
                >✕</button>
              </div>

              {/* Body textarea */}
              <div style={{ padding: '10px 12px' }}>
                <textarea
                  value={item.body}
                  onChange={e => updateItem(item.id, 'body', e.target.value)}
                  placeholder="Enter the full text of this addendum item…"
                  rows={4}
                  style={{
                    width: '100%',
                    background: '#0f172a',
                    border: '1px solid #1e2d45',
                    borderRadius: 4,
                    color: '#e2e8f0',
                    fontSize: 12.5,
                    padding: '8px 10px',
                    resize: 'vertical',
                    fontFamily: 'system-ui, sans-serif',
                    lineHeight: 1.55,
                    outline: 'none',
                  }}
                  onFocus={e => e.target.style.borderColor = '#2eb860'}
                  onBlur={e => e.target.style.borderColor = '#1e2d45'}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={addItem}
        style={{
          background: 'transparent',
          border: '1px dashed #2eb860',
          borderRadius: 5,
          color: '#2eb860',
          padding: '7px 16px',
          fontSize: 12.5,
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'system-ui, sans-serif',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(46,184,96,0.07)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        + Add Addendum Item
      </button>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function OtpApp() {
  const [form, setForm] = useState({ ...DEFAULT_FORM });
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const set = useCallback((key, val) => {
    setForm(prev => ({ ...prev, [key]: val }));
  }, []);

  const handleGenerate = async () => {
    if (!form.businessName.trim()) {
      setError('Business Name is required.');
      return;
    }
    if (!form.buyerName.trim()) {
      setError('Buyer Name is required.');
      return;
    }

    setError('');
    setGenerating(true);

    try {
      const res = await fetch('/api/otp/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error || `Server error ${res.status}`);
      }

      // Stream PDF blob → trigger download
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safeName = (form.businessName || 'Business').replace(/[^a-zA-Z0-9 _-]/g, '').trim().replace(/\s+/g, '_').slice(0, 40);
      const dateStr = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `OTP_${safeName}_${dateStr}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

    } catch (e) {
      setError(e.message || 'PDF generation failed. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const handleReset = () => {
    if (window.confirm('Clear all form fields and start over?')) {
      setForm({ ...DEFAULT_FORM });
      setError('');
    }
  };

  return (
    <div style={{
      maxWidth: 820,
      margin: '0 auto',
      padding: '24px 20px 60px',
      fontFamily: 'system-ui, sans-serif',
    }}>

      {/* ── Page Header ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{
              fontFamily: 'Oswald, sans-serif',
              fontWeight: 700,
              fontSize: 22,
              color: '#e2e8f0',
              letterSpacing: 1.5,
              textTransform: 'uppercase',
              margin: 0,
            }}>
              Offer To Purchase
            </h1>
            <p style={{ color: '#64748b', fontSize: 12.5, margin: '4px 0 0', letterSpacing: 0.3 }}>
              Enter deal details below to generate a professional OTP PDF ready for DocuSign.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={handleReset}
              style={{
                background: 'transparent',
                border: '1px solid #1e2d45',
                borderRadius: 5,
                color: '#64748b',
                padding: '7px 14px',
                fontSize: 12,
                cursor: 'pointer',
                fontFamily: 'system-ui, sans-serif',
              }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#475569'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#1e2d45'}
            >
              🔄 Reset
            </button>
            <button
              onClick={handleGenerate}
              disabled={generating}
              style={{
                background: generating ? '#1e4530' : '#2eb860',
                border: 'none',
                borderRadius: 5,
                color: '#fff',
                padding: '8px 20px',
                fontSize: 13,
                fontWeight: 700,
                cursor: generating ? 'default' : 'pointer',
                fontFamily: 'system-ui, sans-serif',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                opacity: generating ? 0.7 : 1,
                transition: 'opacity 0.15s, background 0.15s',
              }}
              onMouseEnter={e => { if (!generating) e.currentTarget.style.background = '#25a050'; }}
              onMouseLeave={e => { if (!generating) e.currentTarget.style.background = '#2eb860'; }}
            >
              {generating ? (
                <>
                  <span style={{
                    width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: '#fff', borderRadius: '50%',
                    display: 'inline-block', animation: 'spin 0.8s linear infinite',
                  }} />
                  Generating PDF…
                </>
              ) : (
                <>📄 Generate PDF</>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div style={{
            marginTop: 12,
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 5,
            padding: '8px 14px',
            color: '#f87171',
            fontSize: 12.5,
          }}>
            ⚠ {error}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder, textarea::placeholder { color: #334155; }
      `}</style>

      {/* ══════════════════════════════════════════════════════════
          SECTION 1 — Agreement Info
          ══════════════════════════════════════════════════════════ */}
      <FormSection title="Agreement Info" icon="📋">
        <TwoCol>
          <FieldGroup label="Date of Agreement" hint="e.g. May 26, 2026">
            <TextInput value={form.date} onChange={v => set('date', v)} placeholder="May 26, 2026" />
          </FieldGroup>
          <FieldGroup label="Manager Initials" hint="Appears in top-right box">
            <TextInput value={form.managerInitials} onChange={v => set('managerInitials', v)} placeholder="MM" />
          </FieldGroup>
        </TwoCol>
        <FieldGroup label="Peterson Advisor Name" hint="Advisor acting as agent for Buyer">
          <TextInput value={form.advisorName} onChange={v => set('advisorName', v)} placeholder="John Smith" />
        </FieldGroup>
      </FormSection>

      {/* ══════════════════════════════════════════════════════════
          SECTION 2 — Business Being Purchased
          ══════════════════════════════════════════════════════════ */}
      <FormSection title="Business Being Purchased" icon="🏢">
        <FieldGroup label="Business Name *" hint="As it appears on official documents">
          <TextInput value={form.businessName} onChange={v => set('businessName', v)} placeholder="Acme HVAC Services, LLC" />
        </FieldGroup>
        <FieldGroup label="Business Location / Address" hint="City, state, or full street address">
          <TextInput value={form.businessLocation} onChange={v => set('businessLocation', v)} placeholder="4820 N. 34th St., Phoenix, AZ 85018" />
        </FieldGroup>
      </FormSection>

      {/* ══════════════════════════════════════════════════════════
          SECTION 3 — Purchase Price
          ══════════════════════════════════════════════════════════ */}
      <FormSection title="Purchase Price Structure" icon="💰">
        <FieldGroup label="Total Business Purchase Price" hint="The headline price stated in Section 2">
          <MoneyInput value={form.purchasePrice} onChange={v => set('purchasePrice', v)} placeholder="1,500,000" />
        </FieldGroup>

        <div style={{ marginBottom: 14, borderBottom: '1px solid #1a2535', paddingBottom: 14 }}>
          <div style={{ fontSize: 10.5, color: '#64748b', marginBottom: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8 }}>
            Payment Breakdown
          </div>
          <TwoCol>
            <FieldGroup label="a. Initial Deposit (on signing)" hint="Accompanies this OTP">
              <MoneyInput value={form.depositInitial} onChange={v => set('depositInitial', v)} placeholder="10,000" />
            </FieldGroup>
            <FieldGroup label="b. Additional Deposit (on acceptance)" hint="Due when Seller accepts">
              <MoneyInput value={form.depositAdditional} onChange={v => set('depositAdditional', v)} placeholder="40,000" />
            </FieldGroup>
            <FieldGroup label="c. Balance of Down Payment (at closing)" hint="Remaining cash at close">
              <MoneyInput value={form.depositBalance} onChange={v => set('depositBalance', v)} placeholder="200,000" />
            </FieldGroup>
            <FieldGroup label="e. Bank / SBA Financing" hint="Subject to lender approval">
              <MoneyInput value={form.bankFinancing} onChange={v => set('bankFinancing', v)} placeholder="1,000,000" />
            </FieldGroup>
            <FieldGroup label="f. Seller Financing" hint="Subject to terms to be negotiated">
              <MoneyInput value={form.sellerFinancing} onChange={v => set('sellerFinancing', v)} placeholder="250,000" />
            </FieldGroup>
            <FieldGroup label="g. Additional Terms Amount" hint="Other consideration (leave $0 if none)">
              <MoneyInput value={form.additionalTermsAmount} onChange={v => set('additionalTermsAmount', v)} placeholder="0" />
            </FieldGroup>
          </TwoCol>
          <FieldGroup label="g. Additional Terms Description" hint="Describe item g above (e.g. 'Earnout based on first-year revenue')">
            <TextInput value={form.additionalTermsDescription} onChange={v => set('additionalTermsDescription', v)} placeholder="Leave blank if no additional terms" />
          </FieldGroup>
        </div>

        <PriceSummary f={form} />
      </FormSection>

      {/* ══════════════════════════════════════════════════════════
          SECTION 4 — Dates
          ══════════════════════════════════════════════════════════ */}
      <FormSection title="Key Dates" icon="📅">
        <TwoCol>
          <FieldGroup label="Target Closing Date" hint="'On or before 5:00 PM' language will be added">
            <TextInput value={form.closingDate} onChange={v => set('closingDate', v)} placeholder="August 1, 2026" />
          </FieldGroup>
          <FieldGroup label="Offer Expiration Date / Time" hint="Seller must accept by this date/time">
            <TextInput value={form.expirationDate} onChange={v => set('expirationDate', v)} placeholder="May 30, 2026 at 5:00 PM MST" />
          </FieldGroup>
        </TwoCol>
      </FormSection>

      {/* ══════════════════════════════════════════════════════════
          SECTION 5 — Inventory
          ══════════════════════════════════════════════════════════ */}
      <FormSection title="Inventory" icon="📦">
        <FieldGroup label="Estimated Saleable Inventory (included in price)" hint="Approximate value included in purchase price">
          <MoneyInput value={form.inventoryAmount} onChange={v => set('inventoryAmount', v)} placeholder="50,000" />
        </FieldGroup>

        <div style={{ marginBottom: 10 }}>
          <CheckToggle
            label="Apply inventory floor / ceiling clause"
            checked={form.inventoryHasMinMax}
            onChange={v => set('inventoryHasMinMax', v)}
          />
          {form.inventoryHasMinMax && (
            <TwoCol>
              <FieldGroup label="Inventory Floor (minimum)" hint="If below floor, Seller restocks or reduces price">
                <MoneyInput value={form.inventoryMin} onChange={v => set('inventoryMin', v)} placeholder="40,000" />
              </FieldGroup>
              <FieldGroup label="Inventory Ceiling (maximum)" hint="Buyer purchases excess above ceiling at cost">
                <MoneyInput value={form.inventoryMax} onChange={v => set('inventoryMax', v)} placeholder="60,000" />
              </FieldGroup>
            </TwoCol>
          )}
        </div>

        <CheckToggle
          label="Saleable inventory paid directly to Seller at closing (separate from purchase price)"
          checked={form.inventoryPaidDirect}
          onChange={v => set('inventoryPaidDirect', v)}
        />
      </FormSection>

      {/* ══════════════════════════════════════════════════════════
          SECTION 6 — Contingencies
          ══════════════════════════════════════════════════════════ */}
      <FormSection title="Contingencies" icon="🔒">
        <div style={{
          background: '#0a1220',
          border: '1px solid #1e2d45',
          borderRadius: 5,
          padding: '10px 14px',
          marginBottom: 14,
          fontSize: 11.5,
          color: '#64748b',
          lineHeight: 1.6,
        }}>
          <span style={{ color: '#2eb860', fontWeight: 700 }}>Standard contingencies a–j</span> are included automatically on every OTP: financial records review, lease review, Asset Purchase Agreement, pending contracts, equipment inspection, employee review, ATA earnest money, financing, non-compete, and training/transition.
        </div>

        <FieldGroup label="g. ATA Earnest Money Minimum" hint="Minimum deposit into ATA National Title Group LLC escrow account">
          <MoneyInput value={form.ataMinimum} onChange={v => set('ataMinimum', v)} placeholder="10,000" />
        </FieldGroup>

        <FieldGroup label="k. Additional Contingency (Optional)" hint="Custom contingency — leave blank to omit">
          <TextArea
            value={form.contingencyK}
            onChange={v => set('contingencyK', v)}
            placeholder="e.g. This offer is contingent upon Buyer's attorney review of all existing franchise agreements..."
            rows={2}
          />
        </FieldGroup>

        <FieldGroup label="l. Additional Contingency (Optional)" hint="Custom contingency — leave blank to omit">
          <TextArea
            value={form.contingencyL}
            onChange={v => set('contingencyL', v)}
            placeholder="e.g. This offer is contingent upon the transfer of all existing vendor accounts at current pricing..."
            rows={2}
          />
        </FieldGroup>
      </FormSection>

      {/* ══════════════════════════════════════════════════════════
          SECTION 7 — Buyer Information
          ══════════════════════════════════════════════════════════ */}
      <FormSection title="Buyer Information" icon="👤">
        <FieldGroup label="Buyer Full Legal Name *" hint="Individual or entity name as it will appear on legal documents">
          <TextInput value={form.buyerName} onChange={v => set('buyerName', v)} placeholder="Alexander J. Johnson" />
        </FieldGroup>
        <FieldGroup label="Buyer Address">
          <TextInput value={form.buyerAddress} onChange={v => set('buyerAddress', v)} placeholder="1234 Main Street" />
        </FieldGroup>
        <ThreeCol>
          <FieldGroup label="City">
            <TextInput value={form.buyerCity} onChange={v => set('buyerCity', v)} placeholder="Scottsdale" />
          </FieldGroup>
          <FieldGroup label="State">
            <TextInput value={form.buyerState} onChange={v => set('buyerState', v)} placeholder="AZ" />
          </FieldGroup>
          <FieldGroup label="ZIP">
            <TextInput value={form.buyerZip} onChange={v => set('buyerZip', v)} placeholder="85251" />
          </FieldGroup>
        </ThreeCol>
        <FieldGroup label="Buyer Phone">
          <TextInput value={form.buyerPhone} onChange={v => set('buyerPhone', v)} placeholder="(602) 555-0100" type="tel" />
        </FieldGroup>
      </FormSection>

      {/* ══════════════════════════════════════════════════════════
          SECTION 8 — Seller Information
          ══════════════════════════════════════════════════════════ */}
      <FormSection title="Seller Information" icon="🏪">
        <TwoCol>
          <FieldGroup label="Seller's Business / Entity Name" hint="Legal entity selling the business">
            <TextInput value={form.sellerBusinessName} onChange={v => set('sellerBusinessName', v)} placeholder="Acme HVAC Services, LLC" />
          </FieldGroup>
          <FieldGroup label="Seller's Name (Authorized Signatory)" hint="Individual signing on behalf of the entity">
            <TextInput value={form.sellerName} onChange={v => set('sellerName', v)} placeholder="Robert A. Smith" />
          </FieldGroup>
        </TwoCol>
        <FieldGroup label="Seller's Address">
          <TextInput value={form.sellerAddress} onChange={v => set('sellerAddress', v)} placeholder="4820 N. 34th St." />
        </FieldGroup>
        <ThreeCol>
          <FieldGroup label="City">
            <TextInput value={form.sellerCity} onChange={v => set('sellerCity', v)} placeholder="Phoenix" />
          </FieldGroup>
          <FieldGroup label="State">
            <TextInput value={form.sellerState} onChange={v => set('sellerState', v)} placeholder="AZ" />
          </FieldGroup>
          <FieldGroup label="ZIP">
            <TextInput value={form.sellerZip} onChange={v => set('sellerZip', v)} placeholder="85018" />
          </FieldGroup>
        </ThreeCol>
      </FormSection>

      {/* ══════════════════════════════════════════════════════════
          SECTION 9 — Release of Liability
          ══════════════════════════════════════════════════════════ */}
      <FormSection title="Release of Liability" icon="⚖️">
        <div style={{
          background: '#0a1220',
          border: '1px solid #1e2d45',
          borderRadius: 5,
          padding: '10px 14px',
          marginBottom: 14,
          fontSize: 11.5,
          color: '#64748b',
          lineHeight: 1.6,
        }}>
          The Release of Liability page acknowledges that Peterson Acquisitions acts solely as Buyer's agent and is not liable for Seller's representations. Two fields are required for the release language.
        </div>
        <TwoCol>
          <FieldGroup label="Advised By (Advisor Name)" hint="The PA advisor who advised Buyer">
            <TextInput value={form.releaseAdvisedBy} onChange={v => set('releaseAdvisedBy', v)} placeholder="John Smith" />
          </FieldGroup>
          <FieldGroup label="Broker Reference Name" hint="Defaults to Business Name if left blank">
            <TextInput value={form.releaseBroker} onChange={v => set('releaseBroker', v)} placeholder="Acme HVAC Services, LLC" />
          </FieldGroup>
        </TwoCol>
      </FormSection>

      {/* ══════════════════════════════════════════════════════════
          SECTION 10 — Addendum
          ══════════════════════════════════════════════════════════ */}
      <FormSection title="Addendum Items" icon="📎">
        <div style={{
          background: '#0a1220',
          border: '1px solid #1e2d45',
          borderRadius: 5,
          padding: '10px 14px',
          marginBottom: 14,
          fontSize: 11.5,
          color: '#64748b',
          lineHeight: 1.6,
        }}>
          Add any additional terms, conditions, or disclosures that should appear as a <span style={{ color: '#94a3b8' }}>separate Addendum page</span> at the end of the OTP. Each item gets a numbered heading and its body text. Leave empty to generate a standard 4-page document.
        </div>
        <AddendumEditor
          items={form.addendumItems}
          onChange={items => set('addendumItems', items)}
        />
      </FormSection>

      {/* ── Bottom Generate Button ── */}
      <div style={{
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: 12,
        paddingTop: 8,
      }}>
        {error && (
          <span style={{ color: '#f87171', fontSize: 12 }}>⚠ {error}</span>
        )}
        <button
          onClick={handleGenerate}
          disabled={generating}
          style={{
            background: generating ? '#1e4530' : '#2eb860',
            border: 'none',
            borderRadius: 6,
            color: '#fff',
            padding: '10px 28px',
            fontSize: 14,
            fontWeight: 700,
            cursor: generating ? 'default' : 'pointer',
            fontFamily: 'system-ui, sans-serif',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            opacity: generating ? 0.7 : 1,
          }}
          onMouseEnter={e => { if (!generating) e.currentTarget.style.background = '#25a050'; }}
          onMouseLeave={e => { if (!generating) e.currentTarget.style.background = '#2eb860'; }}
        >
          {generating ? (
            <>
              <span style={{
                width: 15, height: 15, border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: '#fff', borderRadius: '50%',
                display: 'inline-block', animation: 'spin 0.8s linear infinite',
              }} />
              Generating PDF…
            </>
          ) : (
            <>📄 Generate OTP PDF</>
          )}
        </button>
      </div>

    </div>
  );
}
