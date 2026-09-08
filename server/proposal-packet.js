/**
 * Seller Engagement Proposal — data packet + commercial defaults.
 *
 * Commercial figures are provisional-canonical from the PACQ Leader call
 * (Drive commercial packet). Overrideable later — do not invent new numbers.
 */

const ENGAGEMENT_STACK_ITEMS = [
  'QSI™ Discovery Experience',
  'Trifecta Market Price Analysis™',
  'PFAScore™ (Potential for Acquisition Self-Assessment)',
  'Business Intelligence Report™',
  'Complete QSI™ Business Model Review',
  'Business Value Optimization Report™ (BVO)',
  'QSI™ Confidential Buyer Network',
  'Buyer Intelligence Report™ (per vetted buyer)',
  'Dedicated Deal Team™',
  'QSI™ Seller Mastery Training',
];

const COMMERCIAL_PACKET = {
  status: 'provisional_canonical',
  source: 'Drive commercial packet (PACQ Leader call)',
  launchFee: 2500,
  marketValueSum: 22250,
  successCommissionPct: '', // fill-in — do not invent a %
  successCommissionFloor: 25000,
  engagementStackItems: ENGAGEMENT_STACK_ITEMS,
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

function defaultPacket(overrides = {}) {
  return mergePacket({
    cover: emptyCover(),
    whyHere: { situationFrame: '' },
    sellability: { pfa: '', cashFlow: '', passionCycle: '' },
    trifecta: { fmvLow: '', fmvHigh: '', supportNotes: '' },
    bir: { highlights: '' },
    engagementStack: {
      source: COMMERCIAL_PACKET.source,
      items: [...ENGAGEMENT_STACK_ITEMS],
    },
    investment: {
      source: COMMERCIAL_PACKET.source,
      launchFee: COMMERCIAL_PACKET.launchFee,
      marketValueSum: COMMERCIAL_PACKET.marketValueSum,
      successCommissionPct: COMMERCIAL_PACKET.successCommissionPct,
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

module.exports = {
  COMMERCIAL_PACKET,
  ENGAGEMENT_STACK_ITEMS,
  defaultPacket,
  mergePacket,
  parsePacket,
  publicRow,
};
