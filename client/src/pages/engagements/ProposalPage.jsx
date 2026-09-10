import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fetchProposalByToken, updateProposal } from '../../api';

const SECTIONS = [
  { id: 'cover', n: '01', label: 'Cover' },
  { id: 'why', n: '02', label: 'Why we’re here' },
  { id: 'exit', n: '03', label: 'Exit Strong' },
  { id: 'sellability', n: '04', label: 'Sellability' },
  { id: 'trifecta', n: '05', label: 'Trifecta Market Price' },
  { id: 'bir', n: '06', label: 'BIR highlights' },
  { id: 'odds', n: '07', label: 'Stack the odds' },
  { id: 'stack', n: '08', label: 'Engagement stack' },
  { id: 'invest', n: '09', label: 'Investment' },
  { id: 'nobs', n: '10', label: 'No-BS' },
  { id: 'next', n: '11', label: 'Next step' },
  { id: 'footer', n: '12', label: 'Confidentiality' },
];

const EXIT_PILLARS = [
  { title: 'Confidentiality', body: 'The process stays private. Blind labels, controlled buyer access, and no public listing until you choose it.' },
  { title: 'Control', body: 'You decide pace, who sees what, and when a conversation becomes a negotiation.' },
  { title: 'Certainty', body: 'Buyer, bank, and terms are pressure-tested before you are asked to commit to a path you cannot unwind cleanly.' },
  { title: 'Legacy', body: 'People, culture, and what you built are part of the outcome — not an afterthought at closing.' },
];

const FOUR_LOCKS = [
  { title: 'Lock 1 — Confidentiality', body: 'Information moves on a need-to-know basis. The company is never the public headline.' },
  { title: 'Lock 2 — Process control', body: 'One advisor-led sequence. No parallel shop, no surprise inbound, no lost leverage.' },
  { title: 'Lock 3 — Buyer / bank fitness', body: 'Vetted capital and operator fit before you spend emotional or legal energy.' },
  { title: 'Lock 4 — Terms & close path', body: 'Structure, timing, and transition are designed so a “yes” can actually close.' },
];

const fmtMoney = (n) => {
  const v = Number(n);
  if (!v && v !== 0) return '—';
  return `$${Math.abs(v).toLocaleString('en-US')}`;
};

function Placeholder({ children }) {
  return (
    <div style={{
      border: '1px dashed #2d3f57',
      background: '#0d1117',
      borderRadius: 6,
      padding: '12px 14px',
      color: '#64748b',
      fontSize: 13,
      lineHeight: 1.55,
      fontStyle: 'italic',
    }}>
      {children}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, multiline, hint }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label>{label}</label>
      {multiline ? (
        <textarea value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={4} />
      ) : (
        <input value={value || ''} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
      )}
      {hint && <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>{hint}</div>}
    </div>
  );
}

function Section({ id, n, title, kicker, children }) {
  return (
    <section id={id} style={{
      scrollMarginTop: 24,
      background: '#1e293b',
      border: '1px solid #1e2d45',
      borderRadius: 10,
      padding: '28px 32px',
      marginBottom: 18,
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 18 }}>
        <div style={{
          fontFamily: 'Oswald, sans-serif',
          fontSize: 12,
          fontWeight: 700,
          letterSpacing: 2,
          color: '#2eb860',
        }}>{n}</div>
        <div>
          {kicker && (
            <div style={{ fontSize: 10, letterSpacing: 1.6, textTransform: 'uppercase', color: '#475569', marginBottom: 2 }}>
              {kicker}
            </div>
          )}
          <h2 style={{
            fontFamily: 'Oswald, sans-serif',
            fontWeight: 600,
            fontSize: 22,
            color: '#e2e8f0',
            letterSpacing: 0.4,
            textTransform: 'uppercase',
            margin: 0,
          }}>{title}</h2>
        </div>
      </div>
      {children}
    </section>
  );
}

export default function ProposalPage() {
  const { token } = useParams();
  const [proposal, setProposal] = useState(null);
  const [error, setError] = useState('');
  const [saveStatus, setSaveStatus] = useState('idle');
  const [copied, setCopied] = useState(false);
  const saveTimer = useRef(null);
  const skipSave = useRef(true);

  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow, noarchive';
    document.head.appendChild(meta);
    document.title = 'Private Seller Engagement Proposal — Dealmaker Portal';
    return () => { document.head.removeChild(meta); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchProposalByToken(token)
      .then(res => {
        if (!cancelled) {
          skipSave.current = true;
          setProposal(res.data);
        }
      })
      .catch(err => {
        if (!cancelled) setError(err.response?.status === 404 ? 'Proposal not found' : (err.response?.data?.error || 'Failed to load'));
      });
    return () => { cancelled = true; };
  }, [token]);

  const packet = proposal?.packet;
  const setPacket = (updater) => {
    setProposal(p => {
      const nextPacket = typeof updater === 'function' ? updater(p.packet) : updater;
      return { ...p, packet: nextPacket };
    });
  };
  const patchCover = (key, value) => setPacket(pk => ({ ...pk, cover: { ...pk.cover, [key]: value } }));

  useEffect(() => {
    if (!proposal?.id) return;
    if (skipSave.current) {
      skipSave.current = false;
      return;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        await updateProposal(proposal.id, {
          packet: proposal.packet,
          deal_id: proposal.deal_id,
          discovery_report_id: proposal.discovery_report_id,
          analyzer_deal_slug: proposal.analyzer_deal_slug,
        });
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch {
        setSaveStatus('error');
      }
    }, 900);
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current); };
  }, [proposal]);

  const copyUrl = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt('Copy private URL', url);
    }
  };

  if (error) {
    return (
      <div className="page-content">
        <div className="alert alert-error">{error}</div>
        <Link to="/engagements"><button className="btn-ghost">← Back to proposals</button></Link>
      </div>
    );
  }

  if (!proposal || !packet) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: '#64748b' }}>
        <div className="spinner spinner-dark" style={{ width: 24, height: 24, borderWidth: 3, display: 'inline-block' }} />
        <div style={{ marginTop: 10 }}>Loading private proposal…</div>
      </div>
    );
  }

  const cover = packet.cover || {};
  const inv = packet.investment || {};
  const stackItems = Array.isArray(packet.engagementStack?.items) ? packet.engagementStack.items : [];
  const setStackItems = (items) => setPacket(pk => ({
    ...pk,
    engagementStack: { ...pk.engagementStack, items },
  }));
  const stackLabel = (item) => (typeof item === 'string' ? item : (item?.label || ''));
  const stackTerm = (item) => (typeof item === 'object' && item ? (item.representationTermMonths || '') : '');
  const isCloseItem = (item, i) => i === 12 || /dedicated deal team through close/i.test(stackLabel(item));
  const hookBits = [
    proposal.analyzer_deal_slug && `MPA: ${proposal.analyzer_deal_slug}`,
    proposal.discovery_report_id && 'BIR linked',
    proposal.deal_id && 'Deal linked',
  ].filter(Boolean);

  return (
    <div style={{ maxWidth: 920, margin: '0 auto', padding: '28px 24px 80px' }}>
      <div className="no-print" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 18, gap: 12, flexWrap: 'wrap',
      }}>
        <Link to="/engagements" style={{ color: '#94a3b8', fontSize: 13, textDecoration: 'none' }}>← All proposals</Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: '#64748b' }}>
          <span>{saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved' : saveStatus === 'error' ? 'Save failed' : 'Private · noindex'}</span>
          <button className="btn-ghost btn-sm" onClick={copyUrl}>{copied ? 'Copied' : 'Copy private URL'}</button>
        </div>
      </div>

      <nav className="no-print" style={{
        display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 22,
      }}>
        {SECTIONS.map(s => (
          <a key={s.id} href={`#${s.id}`} style={{
            fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase',
            color: '#64748b', textDecoration: 'none',
            border: '1px solid #1e2d45', borderRadius: 99, padding: '4px 8px',
          }}>{s.n} {s.label}</a>
        ))}
      </nav>

      {/* 1 Cover */}
      <Section id="cover" n="01" kicker="Peterson Acquisitions · The Deal Team" title="QSI™ Seller Exit System">
        <div style={{
          fontFamily: 'Oswald, sans-serif', fontSize: 15, letterSpacing: 1.2,
          textTransform: 'uppercase', color: '#C1622F', marginBottom: 16,
        }}>
          Seller Engagement Proposal
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Field label="Seller name(s)" value={cover.sellerNames} onChange={v => patchCover('sellerNames', v)} placeholder="Per-seller packet" />
          <Field label="Spouse" value={cover.spouseName} onChange={v => patchCover('spouseName', v)} placeholder="If part of the decision" />
          <Field label="Broker / advisor" value={cover.brokerName} onChange={v => patchCover('brokerName', v)} />
          <Field label="Proposal ID" value={cover.proposalId} onChange={v => patchCover('proposalId', v)} />
          <Field label="Date" value={cover.date} onChange={v => patchCover('date', v)} placeholder="YYYY-MM-DD" />
          <Field label="Blind company label" value={cover.blindCompanyLabel} onChange={v => patchCover('blindCompanyLabel', v)} placeholder="Never the legal name on this page" />
        </div>
        {hookBits.length > 0 && (
          <div style={{ marginTop: 8, fontSize: 11, color: '#475569' }}>Data hooks: {hookBits.join(' · ')}</div>
        )}
      </Section>

      {/* 2 Why we’re here */}
      <Section id="why" n="02" title="Why we’re here" kicker="Situation frame">
        <Field
          label="From discovery notes"
          multiline
          value={packet.whyHere?.situationFrame}
          onChange={v => setPacket(pk => ({ ...pk, whyHere: { ...pk.whyHere, situationFrame: v } }))}
          placeholder="Advisor-sourced situation frame. Leave blank until discovery notes exist — do not invent."
          hint="Hook: discovery notes / BIR context. Empty is correct if this is not yet written."
        />
        {!packet.whyHere?.situationFrame && (
          <Placeholder>No situation frame on file yet. Fill from discovery notes after the call — this page is for the post–MPA + BIR engagement conversation.</Placeholder>
        )}
      </Section>

      {/* 3 Exit Strong */}
      <Section id="exit" n="03" title="What “Exit Strong” means" kicker="Firmwide skeleton">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {EXIT_PILLARS.map(p => (
            <div key={p.title} style={{ background: '#0d1117', border: '1px solid #1a2235', borderRadius: 8, padding: '16px 18px' }}>
              <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 14, letterSpacing: 1, textTransform: 'uppercase', color: '#2eb860', marginBottom: 8 }}>{p.title}</div>
              <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.55 }}>{p.body}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 14, fontSize: 13, color: '#94a3b8' }}>
          Confidentiality → Control → Certainty → Legacy. That is the order. We do not skip a lock to chase a faster “yes.”
        </div>
      </Section>

      {/* 4 Sellability */}
      <Section id="sellability" n="04" title="Sellability snapshot" kicker="From MPA — no invented numbers">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <Field
            label="PFA / PFAScore™"
            value={packet.sellability?.pfa}
            onChange={v => setPacket(pk => ({ ...pk, sellability: { ...pk.sellability, pfa: v } }))}
            placeholder="From MPA only"
            hint={proposal.analyzer_deal_slug ? `Hooked to MPA slug: ${proposal.analyzer_deal_slug}` : 'No MPA slug hooked yet'}
          />
          <Field
            label="Cash flow (SDE / basis)"
            value={packet.sellability?.cashFlow}
            onChange={v => setPacket(pk => ({ ...pk, sellability: { ...pk.sellability, cashFlow: v } }))}
            placeholder="From MPA only"
          />
          <Field
            label="Passion Cycle"
            value={packet.sellability?.passionCycle}
            onChange={v => setPacket(pk => ({ ...pk, sellability: { ...pk.sellability, passionCycle: v } }))}
            placeholder="From MPA only"
          />
        </div>
        {!packet.sellability?.pfa && !packet.sellability?.cashFlow && !packet.sellability?.passionCycle && (
          <Placeholder>MPA fields are empty on purpose. Pull PFA, cash flow, and Passion Cycle from the Market Price Analyzer — never estimate them here.</Placeholder>
        )}
      </Section>

      {/* 5 Trifecta */}
      <Section id="trifecta" n="05" title="Trifecta Market Price" kicker="FMV band from MPA">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field
            label="FMV low"
            value={packet.trifecta?.fmvLow}
            onChange={v => setPacket(pk => ({ ...pk, trifecta: { ...pk.trifecta, fmvLow: v } }))}
            placeholder="From MPA FMV range"
          />
          <Field
            label="FMV high"
            value={packet.trifecta?.fmvHigh}
            onChange={v => setPacket(pk => ({ ...pk, trifecta: { ...pk.trifecta, fmvHigh: v } }))}
            placeholder="From MPA FMV range"
          />
        </div>
        <Field
          label="Support notes"
          multiline
          value={packet.trifecta?.supportNotes}
          onChange={v => setPacket(pk => ({ ...pk, trifecta: { ...pk.trifecta, supportNotes: v } }))}
          placeholder="What the MPA actually supports — multiples, SDE basis, lender lens. Leave blank if not yet pulled."
        />
        {!packet.trifecta?.fmvLow && !packet.trifecta?.fmvHigh && (
          <Placeholder>No FMV band on this packet yet. Source from Trifecta Market Price Analysis™ — do not invent a range on the Zoom.</Placeholder>
        )}
      </Section>

      {/* 6 BIR */}
      <Section id="bir" n="06" title="BIR highlights" kicker="Buyer / bank view">
        <Field
          label="Highlights from Business Intelligence Report™"
          multiline
          value={packet.bir?.highlights}
          onChange={v => setPacket(pk => ({ ...pk, bir: { ...pk.bir, highlights: v } }))}
          placeholder="Buyer appetite, lender lens, transferability flags — from BIR, not from memory."
          hint={proposal.discovery_report_id ? 'BIR / discovery report is hooked on this proposal.' : 'No BIR report hooked yet — link one from the proposal list or paste sourced highlights.'}
        />
        {!packet.bir?.highlights && (
          <Placeholder>BIR highlights are a data hook. Discovery-only is not the full proposal moment — wait for the report, then fill.</Placeholder>
        )}
      </Section>

      {/* 7 Odds */}
      <Section id="odds" n="07" title="How we stack the odds" kicker="Four locks + FAILURE → HARVEST">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          {FOUR_LOCKS.map(lock => (
            <div key={lock.title} style={{ background: '#0d1117', border: '1px solid #1a2235', borderRadius: 8, padding: '14px 16px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 6 }}>{lock.title}</div>
              <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.5 }}>{lock.body}</div>
            </div>
          ))}
        </div>
        <div style={{ background: '#111827', border: '1px solid #C1622F', borderRadius: 8, padding: '16px 18px' }}>
          <div style={{ fontFamily: 'Oswald, sans-serif', letterSpacing: 1.4, fontSize: 13, color: '#C1622F', textTransform: 'uppercase', marginBottom: 6 }}>
            FAILURE → HARVEST
          </div>
          <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.55 }}>
            If the sale path is wrong, we do not force a listing. The work converts: you keep the intelligence, the model review, and a clearer harvest option — recast, rebuild, or wait — instead of a public failure.
          </div>
        </div>
      </Section>

      {/* 8 Stack */}
      <Section id="stack" n="08" title="Engagement stack" kicker="What’s in the fee · Lead Engine reconciled list">
        <div style={{ fontSize: 12, color: '#64748b', marginBottom: 14, lineHeight: 1.55 }}>
          Default seed is the 13-item firm stack from Lead Engine (Michael Decide). Editable per proposal. Item 13 representation term is a fill-in — not a hardcoded duration.
        </div>
        {stackItems.length === 0 && (
          <Placeholder>Stack is empty on this packet. Add items or recreate the proposal to load the 13-item default seed.</Placeholder>
        )}
        <ol style={{ margin: stackItems.length ? '0 0 12px' : '12px 0 12px', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {stackItems.map((item, i) => (
            <li key={i} style={{
              background: '#0d1117', border: '1px solid #1a2235', borderRadius: 8, padding: '10px 12px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  fontFamily: 'Oswald, sans-serif', fontSize: 13, color: '#2eb860', minWidth: 22,
                }}>{String(i + 1).padStart(2, '0')}</span>
                <input
                  value={stackLabel(item)}
                  onChange={e => {
                    const next = [...stackItems];
                    const cur = typeof item === 'object' && item ? { ...item } : { label: '' };
                    cur.label = e.target.value;
                    next[i] = cur;
                    setStackItems(next);
                  }}
                  placeholder="Stack item"
                />
                <button
                  type="button"
                  className="btn-ghost btn-sm"
                  onClick={() => setStackItems(stackItems.filter((_, idx) => idx !== i))}
                >
                  Remove
                </button>
              </div>
              {isCloseItem(item, i) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, paddingLeft: 32 }}>
                  <label style={{ marginBottom: 0, flexShrink: 0 }}>Representation term</label>
                  <input
                    value={stackTerm(item)}
                    onChange={e => {
                      const next = [...stackItems];
                      const cur = typeof item === 'object' && item ? { ...item } : { label: stackLabel(item) };
                      cur.representationTermMonths = e.target.value;
                      next[i] = cur;
                      setStackItems(next);
                    }}
                    placeholder="____ months"
                    style={{ maxWidth: 160 }}
                  />
                  <span style={{ fontSize: 12, color: '#64748b' }}>months (fill-in — not a firm claim)</span>
                </div>
              )}
            </li>
          ))}
        </ol>
        <button
          type="button"
          className="btn-ghost btn-sm"
          onClick={() => setStackItems([...stackItems, { label: '' }])}
        >
          + Add stack item
        </button>
      </Section>

      {/* 9 Investment */}
      <Section id="invest" n="09" title="Investment" kicker="Fee / terms / in-out — fill-in">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <div style={{ background: '#0d1117', border: '1px solid #1a5e35', borderRadius: 8, padding: '18px 20px' }}>
            <Field
              label="Engagement fee"
              value={inv.launchFee === 0 || inv.launchFee ? String(inv.launchFee) : ''}
              onChange={v => setPacket(pk => ({ ...pk, investment: { ...pk.investment, launchFee: v } }))}
              placeholder="TBD — enter fee"
              hint="Fill-in only. Do not assume $2,500 or $23,000 — enter the fee for this engagement."
            />
            {inv.launchFee !== '' && inv.launchFee != null && Number(String(inv.launchFee).replace(/[$,]/g, '')) > 0 && (
              <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 28, color: '#2eb860', marginTop: 4 }}>
                {fmtMoney(String(inv.launchFee).replace(/[$,]/g, ''))}
              </div>
            )}
          </div>
          <div style={{ background: '#0d1117', border: '1px solid #1a2235', borderRadius: 8, padding: '18px 20px' }}>
            <Field
              label="Optional market-value sum"
              value={inv.marketValueSum === 0 || inv.marketValueSum ? String(inv.marketValueSum) : ''}
              onChange={v => setPacket(pk => ({ ...pk, investment: { ...pk.investment, marketValueSum: v } }))}
              placeholder="Optional — leave blank"
              hint="Not an invoice line. Leave blank unless this deal has a labeled packet anchor."
            />
          </div>
        </div>
        <div style={{ background: '#0d1117', border: '1px solid #1e2d45', borderRadius: 8, padding: '16px 18px', marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#e2e8f0', marginBottom: 8 }}>Success commission</div>
          <div style={{ fontSize: 15, color: '#cbd5e1', lineHeight: 1.6 }}>
            <span style={{
              display: 'inline-block', minWidth: 56, borderBottom: '1px solid #475569',
              textAlign: 'center', color: '#94a3b8', marginRight: 4,
            }}>{inv.successCommissionPct || '____'}</span>
            % of purchase price, floor not less than {fmtMoney(inv.successCommissionFloor)}.
          </div>
          <div style={{ fontSize: 11, color: '#475569', marginTop: 8 }}>
            Fill-in from the Engagement Agreement template — no invented percentage.
          </div>
          <div style={{ marginTop: 12, maxWidth: 200 }}>
            <Field
              label="Commission % (fill-in)"
              value={inv.successCommissionPct}
              onChange={v => setPacket(pk => ({ ...pk, investment: { ...pk.investment, successCommissionPct: v } }))}
              placeholder="Leave blank until EA"
            />
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field
            label="Marketing expense (fill-in)"
            value={inv.marketingExpense}
            onChange={v => setPacket(pk => ({ ...pk, investment: { ...pk.investment, marketingExpense: v } }))}
            placeholder="Blank — do not invent an amount"
          />
          <Field
            label="Third-party costs (fill-in)"
            value={inv.thirdPartyCosts}
            onChange={v => setPacket(pk => ({ ...pk, investment: { ...pk.investment, thirdPartyCosts: v } }))}
            placeholder="Blank — do not invent an amount"
          />
        </div>
        <Field
          label="In / out notes"
          multiline
          value={inv.termsNotes}
          onChange={v => setPacket(pk => ({ ...pk, investment: { ...pk.investment, termsNotes: v } }))}
          placeholder="What’s in the launch fee vs. what is billed through. Leave empty if not yet specified."
        />
      </Section>

      {/* 10 No-BS */}
      <Section id="nobs" n="10" title="No-BS" kicker="Three honest paths">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          {[
            ['engage', 'Engage', 'Ready to retain and run the QSI™ Seller Exit System now.'],
            ['prepareThenEngage', 'Prepare, then engage', 'Work the gaps (books, owner role, timing) then sign — not a forever stall.'],
            ['wait', 'Wait', 'Stay independent. Keep the intel. Revisit when the harvest is actually available.'],
          ].map(([key, title, fallback]) => (
            <div key={key} style={{ background: '#0d1117', border: '1px solid #1a2235', borderRadius: 8, padding: '14px 16px' }}>
              <div style={{ fontFamily: 'Oswald, sans-serif', fontSize: 13, letterSpacing: 1, textTransform: 'uppercase', color: '#2eb860', marginBottom: 8 }}>{title}</div>
              <textarea
                value={packet.noBs?.[key] || ''}
                onChange={e => setPacket(pk => ({ ...pk, noBs: { ...pk.noBs, [key]: e.target.value } }))}
                placeholder={fallback}
                rows={4}
              />
            </div>
          ))}
        </div>
      </Section>

      {/* 11 Next step */}
      <Section id="next" n="11" title="Next step" kicker="One clear ask">
        <Field
          label="The ask"
          multiline
          value={packet.nextStep?.ask}
          onChange={v => setPacket(pk => ({ ...pk, nextStep: { ...pk.nextStep, ask: v } }))}
          placeholder="Default: decide on this Zoom — engage, prepare-then-engage, or wait. Leave the private URL for spouse / CPA."
        />
        {!packet.nextStep?.ask && (
          <div style={{ fontSize: 15, color: '#e2e8f0', lineHeight: 1.6, marginTop: 4 }}>
            Decide on this walkthrough: <strong style={{ color: '#2eb860' }}>engage</strong>, prepare-then-engage, or wait.
            This URL stays with you for spouse and CPA — it is not a public page.
          </div>
        )}
      </Section>

      {/* 12 Footer */}
      <Section id="footer" n="12" title="Confidentiality" kicker="Private link rules">
        <ul style={{ margin: 0, paddingLeft: 18, color: '#94a3b8', fontSize: 13, lineHeight: 1.7 }}>
          <li>This page is a private advisor URL. It is <strong style={{ color: '#e2e8f0' }}>noindex</strong> and is not a public marketing site.</li>
          <li>Do not forward the link beyond seller, spouse, and CPA without the advisor’s OK.</li>
          <li>The company appears only as a <strong style={{ color: '#e2e8f0' }}>blind label</strong>. Do not add the legal name to this page.</li>
          <li>Guessing or sharing the token is treated as a confidentiality break. Tokens are unguessable by design.</li>
          <li>Creation and sharing stay inside authenticated broker/advisor flows. Portal Basic Auth is unchanged.</li>
        </ul>
        <div style={{ marginTop: 16, fontSize: 11, color: '#334155', letterSpacing: 0.4 }}>
          {cover.proposalId || 'Proposal'} · {cover.date || ''} · Peterson Acquisitions — The Deal Team
        </div>
      </Section>
    </div>
  );
}
