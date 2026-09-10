/**
 * Seller Engagement Proposal — data packet defaults.
 *
 * §8 stack: Lead Engine reconciled 13-item firm list (Michael Decide).
 * Still editable per proposal. Representation term on item 13 is a fill-in.
 *
 * §9 engagement fee: fill-in only — do not default $2,500 or $23,000.
 * Success commission % is fill-in; $25,000 floor is the EA template pattern.
 */

const ENGAGEMENT_STACK_LABELS = [
  'QSI Discovery Experience',
  'Trifecta Market Price Analysis',
  'PFAScore',
  'Business Intelligence Report',
  'Complete QSI Business Model Review',
  'BVO',
  'QSI Seller Mastery (Seller’s Club)',
  'Confidential Business Review (CBR)',
  'Confidentiality Protection',
  'Market Launch & Targeted Buyer Outreach',
  'Buyer Qualification & Buyer Intelligence Report',
  'Lender Positioning, Offer & Structure Support',
  'Dedicated Deal Team through Close (DD + representation term fill-in)',
];

function defaultStackItems() {
  return ENGAGEMENT_STACK_LABELS.map((label, i) => (
    i === 12
      ? { label, representationTermMonths: '' }
      : { label }
  ));
}

const COMMERCIAL_PACKET = {
  status: 'lead_engine_reconciled',
  source: 'Lead Engine reconciled firm stack (Michael Decide)',
  launchFee: '',
  marketValueSum: '',
  successCommissionPct: '',
  successCommissionFloor: 25000,
  engagementStackItems: ENGAGEMENT_STACK_LABELS,
};

function emptyCover() {
  return {
    sellerNames: '',
    spouseName: '',
    brokerName: '',
    proposalId: '',
    date: '',
    blindCompanyLabel: '',
  };
}

function normalizeStackItem(item, index) {
  if (typeof item === 'string') {
    return index === 12
      ? { label: item, representationTermMonths: '' }
      : { label: item };
  }
  if (item && typeof item === 'object') {
    const label = item.label || '';
    const isCloseItem = index === 12 || /dedicated deal team through close/i.test(label);
    if (isCloseItem) {
      return {
        label,
        representationTermMonths: item.representationTermMonths ?? '',
      };
    }
    return { label };
  }
  return { label: '' };
}

function defaultPacket(overrides = {}) {
  return mergePacket({
    cover: emptyCover(),
    whyHere: { situationFrame: '' },
    sellability: { pfa: '', cashFlow: '', passionCycle: '' },
    trifecta: { fmvLow: '', fmvHigh: '', supportNotes: '' },
    bir: { highlights: '' },
    engagementStack: {
      source: COMMERCIAL_PACKET.source,
      items: defaultStackItems(),
    },
    investment: {
      source: 'Per-deal fill-in',
      launchFee: '',
      marketValueSum: '',
      successCommissionPct: '',
      successCommissionFloor: COMMERCIAL_PACKET.successCommissionFloor,
      marketingExpense: '',
      thirdPartyCosts: '',
      termsNotes: '',
    },
    noBs: { engage: '', prepareThenEngage: '', wait: '' },
    nextStep: { ask: '' },
    hooks: {
      dealId: null,
      discoveryReportId: null,
      analyzerDealSlug: '',
    },
  }, overrides);
}

function mergePacket(base, incoming) {
  if (!incoming || typeof incoming !== 'object') return base;
  const out = { ...base };
  for (const key of Object.keys(incoming)) {
    const val = incoming[key];
    if (val && typeof val === 'object' && !Array.isArray(val) && base[key] && typeof base[key] === 'object' && !Array.isArray(base[key])) {
      out[key] = { ...base[key], ...val };
    } else if (val !== undefined) {
      out[key] = val;
    }
  }
  if (Array.isArray(out.engagementStack?.items)) {
    out.engagementStack = {
      ...out.engagementStack,
      items: out.engagementStack.items.map(normalizeStackItem),
    };
  }
  return out;
}

function parsePacket(raw) {
  if (!raw) return defaultPacket();
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return mergePacket(defaultPacket(), parsed);
  } catch {
    return defaultPacket();
  }
}

function publicRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    share_token: row.share_token,
    status: row.status,
    created_by_user_id: row.created_by_user_id,
    created_by_display_name: row.created_by_display_name,
    deal_id: row.deal_id,
    discovery_report_id: row.discovery_report_id,
    analyzer_deal_slug: row.analyzer_deal_slug,
    packet: parsePacket(row.packet),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

// Seller/spouse/CPA share payload: packet only. No user ids, deal/marketing
// hooks, or other broker admin fields.
function shareViewRow(row) {
  if (!row) return null;
  return {
    share_token: row.share_token,
    status: row.status,
    packet: parsePacket(row.packet),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

module.exports = {
  COMMERCIAL_PACKET,
  ENGAGEMENT_STACK_LABELS,
  defaultStackItems,
  defaultPacket,
  mergePacket,
  parsePacket,
  publicRow,
  shareViewRow,
};
