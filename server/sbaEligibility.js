'use strict';

/**
 * SBA eligibility for the Business Intelligence report.
 *
 * Industry / NAICS fit is not eligibility. A 7(a) loan stops at $5 million and
 * the 504 program's SBA portion is about $5.5 million (fixed assets, not a
 * going-concern purchase of goodwill). Size standards are NAICS-specific
 * (13 CFR 121.201). For 7(a) and 504, the alternative test in 13 CFR 121.301(b)
 * is tangible net worth <= $20 million AND average net income after federal
 * income taxes <= $6.5 million.
 *
 * Deal size uses asking price when the advisor supplied one. Otherwise it uses
 * EBITDA × 4.0 (low end of a typical lower-middle-market multiple) or, if there
 * is no EBITDA, SDE × 3.0 (a typical main-street multiple). Above $7.5 million
 * the $5 million 7(a) loan is no longer the lead financing: 10% cash equity
 * on $7.5 million is $750,000, which still leaves a gap a max 7(a) loan cannot
 * cover. Revenue above $15 million is treated as M&A even when EBITDA is unknown,
 * including revenue the research pass finds in the report.
 */

const SIZE_STANDARDS = require('./data/sbaSizeStandards.json');

const SBA_7A_MAX_LOAN = 5_000_000;
const SBA_504_MAX_PORTION = 5_500_000;
const ALT_TANGIBLE_NET_WORTH_MAX = 20_000_000;
const ALT_AVG_NET_INCOME_MAX = 6_500_000;
const SBA_PRIMARY_DEAL_CEILING = 7_500_000;
const SBA_REVENUE_MA_THRESHOLD = 15_000_000;
const EBITDA_MULTIPLE = 4;
const SDE_MULTIPLE = 3;

const UNCONFIRMED_LINE = 'SBA Eligibility: Unconfirmed - Likely M&A (to be confirmed with the business owner)';
const NOT_PRIMARY_LABEL = 'Not likely - Likely M&A';
const SBA_LIKELY_LABEL = 'Likely - SBA';

const SBA_SYSTEM_RULES = `SBA ELIGIBILITY RULES (mandatory):
- SBA eligibility is decided from size and deal economics: revenue, EBITDA or SDE, asking price or deal size, employees, tangible net worth, and average net income after tax. It is never decided from the NAICS sector or from the fact that an industry is manufacturing, services, or another "SBA-friendly" category.
- Deals fall into two arenas: SBA or M&A. Never state that a business is "fully qualifying for SBA programs" from its NAICS code or industry sector. Never write SBA Eligibility: Yes from industry research alone.
- SBA 7(a) maximum loan is $5 million. The 504 program's SBA portion is about $5.5 million and finances fixed assets; it does not finance goodwill on a going-concern acquisition and does not make a larger business purchase an SBA deal.
- NAICS size standards are employee-based or receipts-based. Use the NAICS-specific standard when it is known. When the code is missing, or the standard is known but the metric it uses (employees or receipts) was not provided, say the size standard needs verification. Do not treat an unknown standard as a pass.
- Alternative size test for 7(a) and 504 (13 CFR 121.301(b)): tangible net worth not more than $20 million AND average net income after federal income taxes (excluding carryover losses) for the two completed fiscal years not more than $6.5 million. Meeting either the NAICS standard or this alternative test can satisfy size. Failing a size test is not, by itself, a reason to call the deal SBA.
- Use revenue, EBITDA or SDE, and asking price from the advisor AND from figures you find in research. Implied deal size is the asking price when one is known. Otherwise use EBITDA × 4.0 (low end of a typical lower-middle-market multiple) or, if there is no EBITDA, SDE × 3.0.
- If that deal size is above $7.5 million, or revenue is above $15 million even without EBITDA, the arena is M&A. Write exactly "SBA Eligibility: Not likely - Likely M&A" followed by a brief rationale comparing the deal or the revenue with the SBA caps. Label the structure "M&A Financing Path" and describe conventional senior debt, mezzanine or unitranche, a seller note, and PE equity. Do not prescribe an SBA 7(a) loan.
- If the implied deal size fits under the $5 million 7(a) cap and revenue is not above $15 million, write "SBA Eligibility: Likely - SBA" and say it is pending confirmation with the business owner.
- If revenue, EBITDA/SDE, and asking price are all missing, or the figures are not enough to choose an arena, write exactly: "${UNCONFIRMED_LINE}". The working assumption is still an M&A financing path until the owner confirms otherwise. Do not guess SBA.
- Do not add generic SBA marketing claims (fee waivers, a higher guarantee percentage, "lowest-cost financing," "98% of manufacturers," or a named SBA program as proof of eligibility) unless you cite a primary source and the claim still fits inside the loan caps above. Those claims never override this determination.
- Apply the same rule in buyer appetite and in deal structure. On an M&A financing path, or when eligibility is unconfirmed, do not present an SBA-financed owner-operator as the buyer who can finance the deal, and do not assume an SBA 7(a) structure, 10% SBA down payment, or SBA pre-qualification.`;

function formatMoney(n) {
  if (n == null || !Number.isFinite(n)) return 'n/a';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1e9) {
    const v = abs / 1e9;
    return `${sign}$${trimNumber(v)} billion`;
  }
  if (abs >= 1e6) {
    const v = abs / 1e6;
    return `${sign}$${trimNumber(v)} million`;
  }
  return `${sign}$${Math.round(abs).toLocaleString('en-US')}`;
}

function trimNumber(v) {
  const fixed = v >= 10 ? v.toFixed(1) : v.toFixed(2);
  return fixed.replace(/\.0+$/, '').replace(/(\.\d)0$/, '$1');
}

function applyUnit(n, unit) {
  const u = (unit || '').toLowerCase();
  if (u === 'm' || u === 'million') return n * 1e6;
  if (u === 'b' || u === 'billion') return n * 1e9;
  if (u === 'k' || u === 'thousand') return n * 1e3;
  return n;
}

function parseMoney(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  let s = String(raw).trim().toLowerCase();
  if (!s || /^(not provided|unknown|n\/a|na|none|tbd)$/.test(s)) return null;
  s = s.replace(/,/g, '').replace(/\$/g, '');
  const range = s.match(/(\d+(?:\.\d+)?)\s*(million|billion|thousand|m|b|k)?\s*(?:-|–|—|\bto\b)\s*(\d+(?:\.\d+)?)\s*(million|billion|thousand|m|b|k)?/i);
  if (range) {
    const unit = range[4] || range[2] || '';
    const low = applyUnit(Number(range[1]), range[2] || unit);
    const high = applyUnit(Number(range[3]), range[4] || unit);
    if (!Number.isFinite(low) || !Number.isFinite(high)) return null;
    // Low end: only call the deal "clearly" over the cap when the whole range is.
    return Math.min(low, high);
  }
  const single = s.match(/(\d+(?:\.\d+)?)\s*(million|billion|thousand|m|b|k)?/i);
  if (!single) return null;
  const n = applyUnit(Number(single[1]), single[2] || '');
  return Number.isFinite(n) ? n : null;
}

function parseEmployees(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? Math.round(raw) : null;
  const s = String(raw).trim().toLowerCase();
  if (!s || /^(not provided|unknown|n\/a|na|none|tbd)$/.test(s)) return null;
  const m = s.replace(/,/g, '').match(/(\d+(?:\.\d+)?)/);
  return m ? Math.round(Number(m[1])) : null;
}

function parseNaics(raw) {
  if (raw == null || raw === '') return null;
  const m = String(raw).match(/\b(\d{6})\b/);
  return m ? m[1] : null;
}

function lookupSizeStandard(naics) {
  if (!naics) return null;
  return SIZE_STANDARDS[naics] || null;
}

function normalizeInput(raw = {}) {
  const naics = parseNaics(raw.naics) || parseNaics(raw.industryDescription) || parseNaics(raw.industry);
  return {
    revenue: parseMoney(raw.revenue),
    ebitda: parseMoney(raw.ebitda),
    sde: parseMoney(raw.sde),
    askingPrice: parseMoney(raw.askingPrice ?? raw.asking_price ?? raw.dealSize),
    employees: parseEmployees(raw.employees),
    tangibleNetWorth: parseMoney(raw.tangibleNetWorth ?? raw.tangible_net_worth),
    avgNetIncome: parseMoney(raw.avgNetIncome ?? raw.avg_net_income ?? raw.netIncome),
    naics,
  };
}

function impliedDeal(input) {
  if (input.askingPrice != null) {
    return {
      amount: input.askingPrice,
      basis: `asking price of ${formatMoney(input.askingPrice)}`,
    };
  }
  if (input.ebitda != null) {
    return {
      amount: input.ebitda * EBITDA_MULTIPLE,
      basis: `EBITDA of ${formatMoney(input.ebitda)} × ${EBITDA_MULTIPLE.toFixed(1)}x, the low end of a typical lower-middle-market multiple`,
    };
  }
  if (input.sde != null) {
    return {
      amount: input.sde * SDE_MULTIPLE,
      basis: `SDE of ${formatMoney(input.sde)} × ${SDE_MULTIPLE.toFixed(1)}x, a typical main-street multiple`,
    };
  }
  return null;
}

function evaluateAlternative(input) {
  const tnw = input.tangibleNetWorth;
  const niat = input.avgNetIncome;
  if (tnw == null && niat == null) return 'unverified';
  if (tnw == null || niat == null) return 'unverified';
  if (tnw <= ALT_TANGIBLE_NET_WORTH_MAX && niat <= ALT_AVG_NET_INCOME_MAX) return 'pass';
  return 'fail';
}

function evaluateSize(input) {
  const standard = lookupSizeStandard(input.naics);
  const alternative = evaluateAlternative(input);
  if (!input.naics) {
    return {
      naicsResult: 'unknown',
      alternative,
      detail: 'No NAICS code was provided, so the NAICS-specific size standard needs verification.',
      standard: null,
    };
  }
  if (!standard) {
    return {
      naicsResult: 'unknown',
      alternative,
      detail: `NAICS ${input.naics} is not in the size-standard table used here, so the NAICS-specific size standard needs verification.`,
      standard: null,
    };
  }
  if (standard.employees != null) {
    const cap = standard.employees;
    const detail = `NAICS ${input.naics} (${standard.title}) uses an employee size standard of ${cap.toLocaleString('en-US')}.`;
    if (input.employees == null) {
      return { naicsResult: 'unverified', alternative, detail: `${detail} Headcount was not provided and needs verification.`, standard };
    }
    const naicsResult = input.employees <= cap ? 'pass' : 'fail';
    return { naicsResult, alternative, detail, standard };
  }
  const cap = standard.receiptsMillions * 1e6;
  const detail = `NAICS ${input.naics} (${standard.title}) uses a receipts size standard of ${formatMoney(cap)}.`;
  if (input.revenue == null) {
    return { naicsResult: 'unverified', alternative, detail: `${detail} Revenue was not provided and needs verification.`, standard };
  }
  const naicsResult = input.revenue <= cap ? 'pass' : 'fail';
  return { naicsResult, alternative, detail, standard };
}

function hasAnyEconomics(input) {
  return [input.revenue, input.ebitda, input.sde, input.askingPrice, input.employees, input.tangibleNetWorth, input.avgNetIncome]
    .some(v => v != null);
}

function financingCapsSentence() {
  return `SBA 7(a) max loan is ${formatMoney(SBA_7A_MAX_LOAN)}. The 504 program's SBA portion is about ${formatMoney(SBA_504_MAX_PORTION)} and finances fixed assets, not goodwill on a going-concern purchase.`;
}

function buildPromptBlock(assessment) {
  const lines = [
    'SBA ELIGIBILITY DETERMINATION (mandatory — do not override this with an industry-only conclusion):',
    `Copy this SBA Eligibility line exactly: ${assessment.eligibilityLine}`,
    assessment.rationale,
    'Never state that a business is "fully qualifying for SBA programs" from its NAICS code or industry sector.',
    'Do not add generic SBA marketing claims (fee waivers, guarantee boosts, "lowest-cost financing," or "98% of manufacturers") unless a primary source shows the claim applies inside the 7(a) and 504 caps, and never as a substitute for this determination.',
  ];
  if (assessment.status === 'not_primary') {
    lines.push(
      'Label the structure "M&A Financing Path". Overall lender appetite is about conventional senior lenders, mezzanine or unitranche providers, and lower-middle-market equity sponsors.',
      'M&A financing path: conventional senior debt, mezzanine or unitranche, a seller note, and PE equity. Do not set the loan type to SBA 7(a). Do not title a subsection "Top SBA Lenders."',
      'Buyer appetite: strategic buyers, private equity, and independent sponsors are the realistic set. Do not present an SBA-financed owner-operator as the buyer who can finance this acquisition.',
      'Deal structure questions: do not assume an SBA 7(a) loan, 10% SBA down payment, or SBA pre-qualification. Describe the M&A financing path.',
    );
  } else if (assessment.status === 'unconfirmed') {
    lines.push(
      'Label the structure "M&A Financing Path (to be confirmed with the business owner)". Do not default the section to an SBA 7(a) structure, Top SBA Lenders, or an owner-operator SBA buyer.',
      'If research in this same report states revenue above $15 million, or an asking price, EBITDA, or SDE that puts the deal above the ceiling, use "SBA Eligibility: Not likely - Likely M&A" instead of the Unconfirmed line. If the figures are still not enough, keep the Unconfirmed line. Never upgrade to SBA from NAICS alone.',
      'Deal structure questions must not assume SBA financing while eligibility is unconfirmed. The working assumption is an M&A financing path until the owner confirms.',
    );
  } else {
    lines.push(
      'Label the structure "SBA Financing Path (to be confirmed with the business owner)". An SBA 7(a) discussion is appropriate only because the implied deal size fits under the $5 million loan cap. Say it is pending confirmation with the business owner.',
      'State the size-standard finding, including when headcount or receipts still need verification. Do not describe the company as SBA merely because of its industry.',
    );
  }
  return lines.join('\n');
}

function conventionalStructure(deal, reason, revenue) {
  let lead = 'This is an M&A financing path.';
  if (reason === 'deal_size' && deal) {
    lead = `On an implied deal size of ${formatMoney(deal.amount)} (${deal.basis}), this is an M&A financing path.`;
  } else if (reason === 'revenue' && revenue != null) {
    lead = `Revenue of ${formatMoney(revenue)} is above ${formatMoney(SBA_REVENUE_MA_THRESHOLD)}, so this is an M&A financing path.`;
  } else if (reason === 'size_standard') {
    lead = 'The size tests provided put this outside SBA, so this is an M&A financing path.';
  }
  return [
    'M&A Financing Path:',
    `${lead} ${financingCapsSentence()}`,
    'Senior debt: a conventional bank or non-bank senior cash-flow loan. For a lower-middle-market manufacturer, senior leverage is often about 2.0–3.0x EBITDA, subject to credit, customer concentration, and capex. That range is typical market practice, not a quoted offer.',
    'Mezzanine or unitranche: subordinated debt or a single-tranche facility between senior debt and equity.',
    'Seller note: often a meaningful slice of price, commonly on the order of 10–30%, sometimes with standby terms, to bridge valuation and transition.',
    'PE equity: control or minority equity from a lower-middle-market sponsor or an independent sponsor. An SBA-financed owner-operator is not the primary buyer at this size.',
  ].join('\n');
}

function assessSbaEligibility(raw = {}) {
  const input = normalizeInput(raw);
  const deal = impliedDeal(input);
  const size = evaluateSize(input);
  const sizeBlocksYes = size.naicsResult === 'fail' && size.alternative !== 'pass';
  const hardSizeFail = size.naicsResult === 'fail' && size.alternative === 'fail';

  let status = 'unconfirmed';
  let reason = null;
  let lineBrief = '';
  let rationale = '';

  if (!hasAnyEconomics(input)) {
    status = 'unconfirmed';
    rationale = 'Revenue, EBITDA/SDE, and asking price were not provided, so the arena cannot be confirmed. The working assumption is an M&A financing path until the business owner confirms otherwise. ' +
      financingCapsSentence() + ' ' + size.detail +
      ' The alternative test (tangible net worth not more than $20 million and average net income after tax not more than $6.5 million) was not provided. Industry alone is not eligibility.';
  } else if (deal && deal.amount > SBA_PRIMARY_DEAL_CEILING) {
    status = 'not_primary';
    reason = 'deal_size';
    lineBrief = `Implied deal size is ${formatMoney(deal.amount)} (${deal.basis}), above the ${formatMoney(SBA_7A_MAX_LOAN)} SBA 7(a) cap and the about ${formatMoney(SBA_504_MAX_PORTION)} 504 SBA portion.`;
    const revenueBit = input.revenue != null ? ` Revenue is ${formatMoney(input.revenue)}.` : '';
    rationale = `${lineBrief}${revenueBit} ${size.detail} The size standard does not change the M&A financing path when the deal is larger than SBA can cover.`;
  } else if (input.revenue != null && input.revenue > SBA_REVENUE_MA_THRESHOLD) {
    status = 'not_primary';
    reason = 'revenue';
    lineBrief = `Revenue of ${formatMoney(input.revenue)} is above ${formatMoney(SBA_REVENUE_MA_THRESHOLD)}, above SBA-typical levels. A 7(a) loan stops at ${formatMoney(SBA_7A_MAX_LOAN)} and the 504 SBA portion is about ${formatMoney(SBA_504_MAX_PORTION)}.`;
    rationale = `${lineBrief} EBITDA or asking price was not used to size the deal. ${size.detail} Treat this as an M&A financing path.`;
  } else if (hardSizeFail) {
    status = 'not_primary';
    reason = 'size_standard';
    lineBrief = `The business fails the NAICS size standard and the alternative test (tangible net worth ${formatMoney(input.tangibleNetWorth)} vs ${formatMoney(ALT_TANGIBLE_NET_WORTH_MAX)}, average net income after tax ${formatMoney(input.avgNetIncome)} vs ${formatMoney(ALT_AVG_NET_INCOME_MAX)}). ${financingCapsSentence()}`;
    rationale = `${size.detail} ${lineBrief}`;
  } else if (deal && deal.amount <= SBA_PRIMARY_DEAL_CEILING && !sizeBlocksYes) {
    status = 'eligible';
    lineBrief = `Implied deal size is ${formatMoney(deal.amount)} (${deal.basis}), inside the ${formatMoney(SBA_7A_MAX_LOAN)} SBA 7(a) cap. Pending confirmation with the business owner.`;
    const revenueBit = input.revenue != null ? ` Revenue is ${formatMoney(input.revenue)}.` : '';
    const altBit = size.alternative === 'pass'
      ? ' The alternative size test is met on the tangible net worth and average net income provided.'
      : ' Tangible net worth and average net income after tax were not both provided, so the alternative test was not used.';
    const verifyBit = (size.naicsResult === 'unknown' || size.naicsResult === 'unverified')
      ? ' The NAICS-specific size standard still needs verification before a lender commits.'
      : '';
    rationale = `${lineBrief}${revenueBit} ${size.detail}${verifyBit}${altBit}`;
  } else if (sizeBlocksYes) {
    status = 'unconfirmed';
    rationale = `${size.detail} Revenue or headcount is over that NAICS standard, and the alternative test (tangible net worth not more than $20 million and average net income after tax not more than $6.5 million) is not confirmed. The working assumption is an M&A financing path until the owner confirms. ${financingCapsSentence()}`;
  } else {
    status = 'unconfirmed';
    const revenueBit = input.revenue != null ? ` Revenue of ${formatMoney(input.revenue)} is not above ${formatMoney(SBA_REVENUE_MA_THRESHOLD)} and is not itself a deal size.` : '';
    rationale = `Deal size is not known, so the arena stays unconfirmed. The working assumption is an M&A financing path until the business owner confirms otherwise.${revenueBit} ${size.detail} ${financingCapsSentence()}`;
  }

  const eligibilityLine = status === 'not_primary'
    ? `SBA Eligibility: ${NOT_PRIMARY_LABEL} - ${lineBrief}`
    : status === 'eligible'
      ? `SBA Eligibility: ${SBA_LIKELY_LABEL} - ${lineBrief}`
      : UNCONFIRMED_LINE;

  const assessment = {
    status,
    eligibilityLine,
    rationale,
    input,
    impliedDealSize: deal ? deal.amount : null,
    dealBasis: deal ? deal.basis : null,
    size,
    structureText: status === 'not_primary' ? conventionalStructure(deal, reason, input.revenue) : null,
  };
  assessment.promptBlock = buildPromptBlock(assessment);
  return assessment;
}

function nearestMoney(text, index, labelLength) {
  const moneyRe = /\$\s*\d[\d,]*(?:\.\d+)?(?:\s*[-–—]\s*\$?\s*\d[\d,]*(?:\.\d+)?)?\s*(?:million|billion|thousand|[mbk])?/ig;
  const start = Math.max(0, index - 48);
  const end = Math.min(text.length, index + labelLength + 64);
  const slice = text.slice(start, end);
  const labelStart = index - start;
  const labelEnd = labelStart + labelLength;
  let best = null;
  let bestDist = Infinity;
  let match;
  while ((match = moneyRe.exec(slice))) {
    const moneyStart = match.index;
    const moneyEnd = match.index + match[0].length;
    const dist = moneyEnd <= labelStart
      ? labelStart - moneyEnd
      : moneyStart >= labelEnd
        ? moneyStart - labelEnd
        : 0;
    const value = parseMoney(match[0]);
    if (value != null && dist < bestDist) {
      best = value;
      bestDist = dist;
    }
  }
  return best;
}

function firstMoneyNear(text, labelRe) {
  const re = new RegExp(labelRe.source, 'ig');
  let match;
  while ((match = re.exec(text))) {
    const value = nearestMoney(text, match.index, match[0].length);
    if (value != null) return value;
  }
  return null;
}

function extractFinancials(text) {
  const source = String(text || '');
  const naicsMatch = source.match(/NAICS(?:\s+code)?[:\s#-]*(\d{6})/i);
  return {
    revenue: firstMoneyNear(source, /revenue|annual sales|top[- ]line/),
    ebitda: firstMoneyNear(source, /EBITDA/),
    sde: firstMoneyNear(source, /SDE|seller'?s discretionary|discretionary earnings/),
    askingPrice: firstMoneyNear(source, /asking price|purchase price|enterprise value|deal size/),
    naics: naicsMatch ? naicsMatch[1] : null,
  };
}

function mergeInputs(explicit = {}, extracted = {}) {
  return {
    revenue: explicit.revenue != null && explicit.revenue !== '' ? explicit.revenue : extracted.revenue,
    ebitda: explicit.ebitda != null && explicit.ebitda !== '' ? explicit.ebitda : extracted.ebitda,
    sde: explicit.sde != null && explicit.sde !== '' ? explicit.sde : extracted.sde,
    askingPrice: explicit.askingPrice != null && explicit.askingPrice !== '' ? explicit.askingPrice : extracted.askingPrice,
    employees: explicit.employees != null && explicit.employees !== '' ? explicit.employees : extracted.employees,
    tangibleNetWorth: explicit.tangibleNetWorth != null && explicit.tangibleNetWorth !== '' ? explicit.tangibleNetWorth : extracted.tangibleNetWorth,
    avgNetIncome: explicit.avgNetIncome != null && explicit.avgNetIncome !== '' ? explicit.avgNetIncome : extracted.avgNetIncome,
    naics: explicit.naics || extracted.naics || null,
    industryDescription: explicit.industryDescription || explicit.industry || null,
  };
}

function replaceEligibilityLine(text, line) {
  if (/SBA Eligibility\s*:/i.test(text)) {
    return text.replace(/SBA Eligibility\s*:[^\n]*/i, () => line);
  }
  if (/LENDER AND SBA APPETITE ASSESSMENT/i.test(text)) {
    return text.replace(/(LENDER AND SBA APPETITE ASSESSMENT\s*\n)/i, (heading) => `${heading}${line}\n`);
  }
  return `${line}\n${text}`;
}

function replaceSbaStructure(text, replacement) {
  const re = /Typical SBA Deal Structure for This Industry:[\s\S]*?(?=\n\s*(?:Lender Red Flags|What Lenders|Top SBA Lenders|Financing Sources|Lender Notes)\b|$)/i;
  if (!re.test(text)) return text;
  const block = `${replacement.trim()}\n\n`;
  return text.replace(re, () => block);
}

const UNCONFIRMED_STRUCTURE = [
  'M&A Financing Path (to be confirmed with the business owner):',
  'Eligibility is unconfirmed. Until the owner confirms revenue, EBITDA or SDE, and deal size, treat this as an M&A financing path: conventional senior debt, mezzanine or unitranche, a seller note, and PE equity. Do not assume an SBA 7(a) loan, a 10% SBA down payment, or that this business qualifies for SBA programs.',
].join('\n');

function scrubUnsupportedClaims(text) {
  return text
    .replace(/fully qualifying for SBA programs/gi, 'which does not establish SBA eligibility')
    .replace(/fully qualif(?:y|ies|ying) for SBA(?: programs)?/gi, 'which does not establish SBA eligibility');
}

function guardBuyerAndStructure(text, assessment) {
  if (assessment.status === 'eligible') return text;
  let out = text.replace(/(Owner-Operator Buyer Potential:[^\n]*)/i, (line) => {
    if (!/SBA/i.test(line) || /M&A financing path/i.test(line)) return line;
    return `${line} This is an M&A financing path, not SBA; buyer fit is strategic, private equity, or an independent sponsor using conventional debt, mezzanine or unitranche, a seller note, and equity.`;
  });
  if (assessment.status === 'not_primary') {
    out = out.replace(/Top SBA Lenders for This Industry:/gi, 'Capital sources (M&A financing path):');
  } else {
    out = out.replace(/Top SBA Lenders for This Industry:/gi, 'Capital sources (M&A financing path, to be confirmed with the business owner):');
  }
  return out;
}

function applySbaGuardrail(reportText, explicit = {}) {
  const extracted = extractFinancials(reportText);
  const merged = mergeInputs(explicit, extracted);
  const assessment = assessSbaEligibility(merged);
  let text = scrubUnsupportedClaims(String(reportText || ''));
  text = replaceEligibilityLine(text, assessment.eligibilityLine);
  if (assessment.status === 'not_primary' && assessment.structureText) {
    text = replaceSbaStructure(text, assessment.structureText);
  } else if (assessment.status === 'unconfirmed') {
    text = replaceSbaStructure(text, UNCONFIRMED_STRUCTURE);
  }
  text = guardBuyerAndStructure(text, assessment);
  text = scrubUnsupportedClaims(text);
  return { text, assessment };
}

function renderLenderSection(raw) {
  const assessment = raw && raw.eligibilityLine ? raw : assessSbaEligibility(raw || {});
  const parts = [
    'LENDER AND SBA APPETITE ASSESSMENT',
    '',
    assessment.eligibilityLine,
    '',
    assessment.status === 'not_primary'
      ? 'Overall Lender Appetite: Moderate to High for conventional senior credit and lower-middle-market sponsors on an M&A financing path.'
      : assessment.status === 'eligible'
        ? 'Overall Lender Appetite: SBA financing path, pending confirmation with the business owner. The deal size fits under the $5 million 7(a) cap. Confirm the NAICS size standard before a lender application.'
        : 'Overall Lender Appetite: Working assumption is an M&A financing path, to be confirmed with the business owner. Do not describe SBA appetite as established.',
    '',
    'Lender Appetite Rationale:',
    assessment.rationale,
    '',
  ];
  if (assessment.status === 'not_primary') {
    parts.push(assessment.structureText, '');
  } else if (assessment.status === 'unconfirmed') {
    parts.push(UNCONFIRMED_STRUCTURE, '');
  } else {
    parts.push(
      'SBA Financing Path (to be confirmed with the business owner):',
      `Loan Type: SBA 7(a), because implied deal size fits under the ${formatMoney(SBA_7A_MAX_LOAN)} maximum loan. Pending confirmation with the business owner.`,
      'Down payment, term, rate, and DSCR come from the lender and the confirmed cash flow. Do not treat the NAICS code as the eligibility finding.',
      '',
    );
  }
  return parts.join('\n');
}

module.exports = {
  SBA_7A_MAX_LOAN,
  SBA_504_MAX_PORTION,
  ALT_TANGIBLE_NET_WORTH_MAX,
  ALT_AVG_NET_INCOME_MAX,
  SBA_PRIMARY_DEAL_CEILING,
  SBA_REVENUE_MA_THRESHOLD,
  EBITDA_MULTIPLE,
  SDE_MULTIPLE,
  UNCONFIRMED_LINE,
  NOT_PRIMARY_LABEL,
  SBA_LIKELY_LABEL,
  SBA_SYSTEM_RULES,
  SIZE_STANDARDS,
  formatMoney,
  parseMoney,
  lookupSizeStandard,
  assessSbaEligibility,
  extractFinancials,
  applySbaGuardrail,
  renderLenderSection,
};
