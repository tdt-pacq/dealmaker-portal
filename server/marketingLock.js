'use strict';

const crypto = require('crypto');
const { getDb } = require('./database');
const { textFromMessage, generationBody } = require('./marketingText');

const SUMMARY_FIELDS = [
  ['business_type', 'Business type / industry', 'basics'],
  ['year_established', 'Year established', 'basics'],
  ['location_region', 'Region (blind location)', 'basics'],
  ['location_state', 'State', 'basics'],
  ['hours', 'Hours of operation', 'basics'],
  ['entity_type', 'Entity type', 'basics'],
  ['licenses', 'Licenses or permits', 'basics'],
  ['description', 'What the business does', 'basics'],
  ['asking_price', 'Asking / listing price', 'financials'],
  ['owner_comp', 'Owner compensation (annual $)', 'financials'],
  ['sba_bank', 'SBA lender (term sheet)', 'financials'],
  ['sba_term_notes', 'Term sheet rate and terms', 'financials'],
  ['employees', 'Employees (count and roles)', 'operations'],
  ['owner_role', "Owner's daily role", 'operations'],
  ['real_estate', 'Real estate', 'assets'],
  ['real_estate_value', 'Real estate value', 'assets'],
  ['ffe_value', 'FF&E value', 'assets'],
  ['inventory_value', 'Inventory value', 'assets'],
  ['reason_for_selling', 'Reason for selling', 'sale'],
  ['transition', 'Training / transition', 'sale'],
  ['sale_type', 'Asset or stock sale', 'sale'],
  ['financing', 'Financing available', 'sale'],
  ['sba_preapproved', 'SBA pre-qualified in the documents', 'sale'],
];

const REQUIRED_KEYS = [
  'business_type', 'year_established', 'location_region', 'location_state',
  'asking_price', 'employees', 'real_estate',
];

const FIELD_LABEL = Object.fromEntries(SUMMARY_FIELDS.map(([key, label]) => [key, label]));

function httpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function parseMoney(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const cleaned = String(value).replace(/[$,\s]/g, '').replace(/[^0-9.-]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '.') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function formatMoney(value) {
  const n = typeof value === 'number' ? value : parseMoney(value);
  if (n == null) return '';
  return `$${Math.round(n).toLocaleString('en-US')}`;
}

function formatPct(value) {
  if (value == null || !Number.isFinite(value)) return '';
  return `${(value * 100).toFixed(1)}%`;
}

function blankSummary() {
  return Object.fromEntries(SUMMARY_FIELDS.map(([key]) => [key, '']));
}

function splitLocation(cityState) {
  const raw = String(cityState || '').trim();
  if (!raw) return { region: '', state: '' };
  const parts = raw.split(',').map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return { region: parts.slice(0, -1).join(', '), state: parts[parts.length - 1] };
  }
  return { region: raw, state: '' };
}

function includedInPrice(text) {
  const value = String(text || '');
  if (!value.trim()) return false;
  if (/not included|separate purchase|available separately|leased/i.test(value)) return false;
  return /included in (the )?(asking|listing|purchase) price/i.test(value);
}

function collectSdeYears(interview) {
  const years = [];
  for (let i = 1; i <= 4; i += 1) {
    const rawSde = interview[`fin_year${i}_sde`] || (i === 1 ? interview.sde_year1 : '');
    const sde = parseMoney(rawSde);
    if (!(sde > 0)) continue;
    const year = String(
      interview[`fin_year${i}_label`]
      || interview[`sde_year${i}_label`]
      || (i === 1 ? interview.sde_year1_label : '')
      || ''
    ).trim() || `Year ${i}`;
    years.push({
      year,
      sde,
      revenue: parseMoney(interview[`fin_year${i}_revenue`] || (i === 1 ? interview.revenue_year1 : '')),
    });
  }
  return years;
}

function weightedAverage321(years) {
  if (!Array.isArray(years) || years.length < 3) return null;
  const [recent, prior, oldest] = years;
  if (!(recent.sde > 0) || !(prior.sde > 0) || !(oldest.sde > 0)) return null;
  return (recent.sde * 3 + prior.sde * 2 + oldest.sde * 1) / 6;
}

function resolveValuation(years, basis) {
  const list = (Array.isArray(years) ? years : [])
    .map((year) => ({
      year: String(year.year || '').trim() || 'Year',
      sde: parseMoney(year.sde),
      revenue: parseMoney(year.revenue),
    }))
    .filter((year) => year.sde > 0);
  if (!list.length) {
    throw httpError(400, 'At least one year of SDE is required before marketing can be confirmed.');
  }
  if (basis === 'weighted_321') {
    if (list.length < 3) {
      throw httpError(400, '3-2-1 weighting needs three years of SDE. Choose the most recent year, or add the missing year.');
    }
    return {
      years: list,
      valuation_sde: weightedAverage321(list),
      valuation_basis: 'weighted_321',
      valuation_basis_label: 'weighted avg 3-2-1',
      valuation_year: list[0].year,
    };
  }
  return {
    years: list,
    valuation_sde: list[0].sde,
    valuation_basis: 'most_recent',
    valuation_basis_label: `most recent year ${list[0].year}`,
    valuation_year: list[0].year,
  };
}

function monthlyPayment(principal, annualRatePct, years) {
  const n = years * 12;
  if (!(principal > 0) || !(n > 0)) return 0;
  const monthlyRate = (Number(annualRatePct) / 100) / 12;
  if (!(monthlyRate > 0)) return principal / n;
  const factor = (1 + monthlyRate) ** n;
  return principal * monthlyRate * factor / (factor - 1);
}

function sbaEstimates({ askingPrice, realEstateValue, realEstateIncluded, rate, valuationSde, ownerComp }) {
  const price = askingPrice > 0 ? askingPrice : 0;
  const re = realEstateIncluded && realEstateValue > 0 ? Math.min(realEstateValue, price) : 0;
  const business = Math.max(0, price - re);
  const businessLoan = business * 0.9;
  const realEstateLoan = re * 0.9;
  const businessMonthly = monthlyPayment(businessLoan, rate, 10);
  const realEstateMonthly = monthlyPayment(realEstateLoan, rate, 25);
  const monthly = businessMonthly + realEstateMonthly;
  const annual = monthly * 12;
  const down = price * 0.1;
  const dscr = annual > 0 ? valuationSde / annual : null;
  const cocPre = down > 0 ? (valuationSde - annual) / down : null;
  const cocAfter = down > 0 && ownerComp != null
    ? (valuationSde - annual - ownerComp) / down
    : null;
  return {
    rate,
    financed_pct: 90,
    down_payment: down,
    business_loan: businessLoan,
    real_estate_loan: realEstateLoan,
    business_term_years: 10,
    real_estate_term_years: re > 0 ? 25 : null,
    monthly_payment: monthly,
    annual_debt_service: annual,
    dscr,
    cash_on_cash_pre: cocPre,
    cash_on_cash_after: cocAfter,
    blended: re > 0,
    owner_comp: ownerComp,
  };
}

function summaryFromInterview(interview, deal) {
  const summary = blankSummary();
  const location = splitLocation(interview.business_city_state);
  summary.business_type = String(interview.business_type || interview.industry || '').trim();
  summary.year_established = String(interview.year_founded || '').trim();
  summary.location_region = location.region;
  summary.location_state = location.state;
  summary.hours = String(interview.hours_of_operation || '').trim();
  summary.entity_type = String(interview.entity_type || '').trim();
  summary.licenses = String(interview.licenses_held || '').trim();
  summary.description = String(interview.business_description || '').trim();
  summary.asking_price = String(interview.asking_price || interview.listing_price || '').trim();
  summary.owner_comp = String(interview.owner_comp || interview.fin_year1_owner_salary || '').trim();
  summary.employees = [interview.employees_count, interview.employee_detail].filter(Boolean).join(' — ');
  summary.owner_role = String(interview.primary_roles || interview.typical_day || '').trim();
  summary.real_estate = String(interview.real_estate_situation || '').trim();
  summary.real_estate_value = String(interview.real_estate_value || interview.land_value || '').trim();
  summary.ffe_value = String(interview.ffe_value || '').trim();
  summary.inventory_value = String(interview.inventory_value || '').trim();
  summary.reason_for_selling = String(interview.reason_for_selling || '').trim();
  summary.transition = String(interview.transition_plan || '').trim();
  summary.sale_type = String(interview.deal_structure || '').trim();
  summary.financing = String(interview.financing_available || interview.financing_type || '').trim();
  summary.sba_preapproved = String(interview.sba_preapproved || '').trim();
  if (deal?.advisor_name && !summary.advisor_name) {
    summary.advisor_name = deal.advisor_name;
  }
  return summary;
}

function listMissing(summary, years) {
  const missing = [];
  for (const key of REQUIRED_KEYS) {
    if (!String(summary[key] || '').trim()) missing.push(FIELD_LABEL[key]);
  }
  if (!years.length) missing.push('At least one year of SDE');
  missing.push('SBA 7(a) rate — confirm the current rate');
  const pre = String(summary.sba_preapproved || '').trim();
  if (!/^(yes|no)$/i.test(pre)) missing.push('SBA pre-qualified status is not explicitly confirmed in the documents');
  return missing;
}

function sourceRows(dealId) {
  return getDb().prepare(`
    SELECT kind, text_extract FROM deal_documents
    WHERE deal_id = ? AND kind IN ('interview', 'ea', 'mpa', 'termsheet', 'discovery')
    ORDER BY kind
  `).all(dealId);
}

function sourceFingerprint(interview, rows) {
  const body = JSON.stringify(interview || {}) + '\n' + rows.map((row) => (
    `${row.kind}\n${row.text_extract || ''}`
  )).join('\n---\n');
  return crypto.createHash('sha256').update(body).digest('hex');
}

function loadInterview(deal) {
  try { return JSON.parse(deal.interview_data || '{}'); } catch { return {}; }
}

function parseLock(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(raw); } catch { return null; }
}

function buildReview(dealId) {
  const deal = getDb().prepare('SELECT * FROM deals WHERE id = ?').get(dealId);
  if (!deal) throw httpError(404, 'Deal not found');
  const interview = loadInterview(deal);
  const rows = sourceRows(dealId);
  const summary = summaryFromInterview(interview, deal);
  const sdeYears = collectSdeYears(interview);
  const fingerprint = sourceFingerprint(interview, rows);
  const lock = parseLock(deal.marketing_lock);
  const needsReview = !lock?.confirmed_at || lock.source_fingerprint !== fingerprint;
  const termSheet = rows.find((row) => row.kind === 'termsheet');
  return {
    summary,
    fields: SUMMARY_FIELDS.map(([key, label, group]) => ({
      key,
      label,
      group,
      value: summary[key] || '',
      missing: REQUIRED_KEYS.includes(key) && !String(summary[key] || '').trim(),
    })),
    sde_years: sdeYears,
    suggested_basis: sdeYears.length >= 3 ? 'weighted_321' : 'most_recent',
    weighted_available: sdeYears.length >= 3,
    weighted_sde: weightedAverage321(sdeYears),
    most_recent_sde: sdeYears[0] ? sdeYears[0].sde : null,
    real_estate_included: includedInPrice(summary.real_estate),
    missing: listMissing(summary, sdeYears),
    notes: sdeYears.length > 0 && sdeYears.length < 3
      ? ['Fewer than 3 years of SDE, so 3-2-1 weighting is not available. The Valuation SDE is the most recent year.']
      : [],
    source_fingerprint: fingerprint,
    has_sources: rows.some((row) => String(row.text_extract || '').trim()),
    term_sheet_excerpt: termSheet?.text_extract ? String(termSheet.text_extract).slice(0, 700) : '',
    needs_review: needsReview,
    confirmed: needsReview ? null : {
      valuation_sde: lock.valuation_sde,
      valuation_sde_display: formatMoney(lock.valuation_sde),
      valuation_basis: lock.valuation_basis,
      valuation_basis_label: lock.valuation_basis_label,
      sba_rate: lock.sba_rate,
      confirmed_at: lock.confirmed_at,
      summary: lock.summary || summary,
      sde_years: lock.sde_years || sdeYears,
      real_estate_included: Boolean(lock.real_estate_included),
    },
    source_text: rows.map((row) => (
      String(row.text_extract || '').trim() ? `${row.kind}:\n${String(row.text_extract).slice(0, 12000)}` : ''
    )).filter(Boolean).join('\n\n'),
  };
}

function fillBlanks(summary, incoming) {
  const next = { ...summary };
  if (!incoming || typeof incoming !== 'object') return next;
  for (const [key] of SUMMARY_FIELDS) {
    if (key === 'asking_price' && String(next.asking_price || '').trim()) continue;
    if (String(next[key] || '').trim()) continue;
    const value = incoming[key];
    if (value == null || typeof value === 'object') continue;
    const text = String(value).trim();
    if (text) next[key] = text;
  }
  return next;
}

function parseModelJson(text) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(raw.slice(start, end + 1)); } catch { return null; }
}

const EXTRACT_SYSTEM = `You extract deal facts for Peterson Acquisitions marketing.
Return ONLY a JSON object. Use null for anything not stated. Never invent numbers.
Keys: business_type, year_established, location_region, location_state, hours, entity_type, licenses, description, asking_price, owner_comp, sba_bank, sba_term_notes, employees, owner_role, real_estate, real_estate_value, ffe_value, inventory_value, reason_for_selling, transition, sale_type, financing, sba_preapproved, sde_years.
sde_years is an array of { "year": "2024", "sde": 100000, "revenue": 200000 } with the most recent year first.
sba_preapproved is "Yes" only when the documents explicitly confirm SBA pre-qualification, otherwise "No" or null.
location_region is a broad region, not a street address.`;

async function extractReview(dealId, complete) {
  const review = buildReview(dealId);
  if (!review.needs_review || !review.has_sources || typeof complete !== 'function') return review;
  try {
    const text = await complete(review);
    const parsed = parseModelJson(text);
    if (!parsed) return review;
    review.summary = fillBlanks(review.summary, parsed);
    if (!review.sde_years.length && Array.isArray(parsed.sde_years)) {
      review.sde_years = parsed.sde_years
        .map((year) => ({
          year: String(year.year || '').trim(),
          sde: parseMoney(year.sde),
          revenue: parseMoney(year.revenue),
        }))
        .filter((year) => year.sde > 0);
    }
    review.fields = SUMMARY_FIELDS.map(([key, label, group]) => ({
      key,
      label,
      group,
      value: review.summary[key] || '',
      missing: REQUIRED_KEYS.includes(key) && !String(review.summary[key] || '').trim(),
    }));
    review.weighted_available = review.sde_years.length >= 3;
    review.weighted_sde = weightedAverage321(review.sde_years);
    review.most_recent_sde = review.sde_years[0] ? review.sde_years[0].sde : null;
    review.suggested_basis = review.weighted_available ? 'weighted_321' : 'most_recent';
    review.real_estate_included = includedInPrice(review.summary.real_estate);
    review.missing = listMissing(review.summary, review.sde_years);
    review.notes = review.sde_years.length > 0 && review.sde_years.length < 3
      ? ['Fewer than 3 years of SDE, so 3-2-1 weighting is not available. The Valuation SDE is the most recent year.']
      : [];
  } catch (err) {
    review.extract_note = 'Could not finish the document read. Correct the interview figures below before confirming.';
  }
  return review;
}

function summaryPrompt(review) {
  return generationBody(
    4500,
    EXTRACT_SYSTEM,
    `Interview and documents:\n${review.source_text}\n\nCurrent draft (keep its numbers when they are already filled):\n${JSON.stringify(review.summary)}\n\nReturn JSON only.`
  );
}

function confirmMarketing(dealId, body) {
  const deal = getDb().prepare('SELECT * FROM deals WHERE id = ?').get(dealId);
  if (!deal) throw httpError(404, 'Deal not found');
  const interview = loadInterview(deal);
  const rows = sourceRows(dealId);
  const currentSummary = summaryFromInterview(interview, deal);
  const incoming = body && typeof body.summary === 'object' ? body.summary : {};
  const summary = { ...currentSummary };
  for (const [key] of SUMMARY_FIELDS) {
    if (key in incoming && incoming[key] != null) summary[key] = String(incoming[key]).trim();
  }
  const asking = parseMoney(summary.asking_price);
  if (!(asking > 0)) throw httpError(400, 'Asking price is required. The Engagement Agreement figure wins when it is the saved price.');
  const rate = Number(body.sba_rate);
  if (!Number.isFinite(rate) || rate <= 0 || rate >= 30) {
    throw httpError(400, 'Enter the SBA 7(a) rate as a percent, for example 10.5.');
  }
  const basis = body.sde_basis === 'weighted_321' ? 'weighted_321' : 'most_recent';
  const submittedYears = Array.isArray(body.sde_years) && body.sde_years.length
    ? body.sde_years
    : collectSdeYears(interview);
  const valuation = resolveValuation(submittedYears, basis);
  const ownerComp = parseMoney(summary.owner_comp);
  const realEstateIncluded = Boolean(body.real_estate_included);
  const estimates = sbaEstimates({
    askingPrice: asking,
    realEstateValue: parseMoney(summary.real_estate_value),
    realEstateIncluded,
    rate,
    valuationSde: valuation.valuation_sde,
    ownerComp,
  });
  const lock = {
    confirmed_at: new Date().toISOString(),
    source_fingerprint: sourceFingerprint(interview, rows),
    valuation_sde: valuation.valuation_sde,
    valuation_basis: valuation.valuation_basis,
    valuation_basis_label: valuation.valuation_basis_label,
    valuation_year: valuation.valuation_year,
    sba_rate: rate,
    asking_price: asking,
    real_estate_included: realEstateIncluded,
    real_estate_value: parseMoney(summary.real_estate_value),
    owner_comp: ownerComp,
    sde_years: valuation.years,
    summary,
    estimates,
    sba_preapproved: /^yes$/i.test(summary.sba_preapproved),
  };
  getDb().prepare('UPDATE deals SET marketing_lock = ?, updated_at = ? WHERE id = ?')
    .run(JSON.stringify(lock), lock.confirmed_at, dealId);
  return lock;
}

function requireConfirmed(deal) {
  const lock = parseLock(deal.marketing_lock);
  if (!lock?.confirmed_at || !(lock.valuation_sde > 0)) {
    throw httpError(409, 'Confirm the deal summary before generating. Review the extracted figures, choose the SDE basis, and enter the SBA rate.');
  }
  const interview = loadInterview(deal);
  const fingerprint = sourceFingerprint(interview, sourceRows(deal.id));
  if (lock.source_fingerprint !== fingerprint) {
    throw httpError(409, 'The interview or source documents changed after confirm. Review the summary and confirm again before generating.');
  }
  return lock;
}

function formatLockedBlock(lock) {
  const est = lock.estimates || {};
  const years = (lock.sde_years || [])
    .map((year) => `${year.year} ${formatMoney(year.sde)}`)
    .join('; ');
  const owner = lock.owner_comp != null
    ? formatMoney(lock.owner_comp)
    : 'not stated — if you estimate it, label the line "market-rate owner comp est. $X"';
  const blend = est.blended
    ? `Blended payment: business assets on a 10-year term plus real estate on a 25-year term. Est. monthly ${formatMoney(est.monthly_payment)}.`
    : 'Business assets on a 10-year term (no real estate in the financed price). Est. monthly ' + formatMoney(est.monthly_payment) + '.';
  return [
    `Valuation SDE: ${formatMoney(lock.valuation_sde)} (basis: ${lock.valuation_basis_label}).`,
    `Asking price: ${formatMoney(lock.asking_price)}. The Engagement Agreement / confirmed asking price is authoritative.`,
    `SBA rate confirmed: ${lock.sba_rate}%.`,
    `SBA structure: 90% financed, 10% down (${formatMoney(est.down_payment)}). ${blend}`,
    `Est. annual debt service: ${formatMoney(est.annual_debt_service)}.`,
    `Est. DSCR: ${est.dscr == null ? 'omit' : est.dscr.toFixed(2)} (SBA minimum 1.25).`,
    `Est. Cash-on-Cash (Pre-Owner Comp): ${formatPct(est.cash_on_cash_pre) || 'omit'}.`,
    `Est. Cash-on-Cash (After Owner Comp): ${formatPct(est.cash_on_cash_after) || 'compute with the owner comp note'}.`,
    `Owner comp: ${owner}.`,
    `SDE by year (most recent first): ${years || 'none'}.`,
    lock.sba_preapproved
      ? 'SBA Pre-Approved badge: allowed. The documents confirm pre-qualification.'
      : 'SBA Pre-Approved badge: do not include. Pre-qualification is not confirmed.',
    'Use this same Valuation SDE for every multiple, cash-on-cash return, and DSCR. Do not substitute another year.',
  ].join('\n');
}

module.exports = {
  SUMMARY_FIELDS,
  parseMoney,
  formatMoney,
  collectSdeYears,
  weightedAverage321,
  resolveValuation,
  monthlyPayment,
  sbaEstimates,
  summaryFromInterview,
  listMissing,
  sourceFingerprint,
  buildReview,
  fillBlanks,
  parseModelJson,
  extractReview,
  summaryPrompt,
  confirmMarketing,
  requireConfirmed,
  formatLockedBlock,
  parseLock,
};
