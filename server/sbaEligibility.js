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
 * the $5 million 7(a) loan is no longer the primary financing: 10% cash equity
 * on $7.5 million is $750,000, which still leaves a gap a max 7(a) loan cannot
 * cover as the lead source.
 */

const SIZE_STANDARDS = require('./data/sbaSizeStandards.json');

const SBA_7A_MAX_LOAN = 5_000_000;
const SBA_504_MAX_PORTION = 5_500_000;
const ALT_TANGIBLE_NET_WORTH_MAX = 20_000_000;
const ALT_AVG_NET_INCOME_MAX = 6_500_000;
const SBA_PRIMARY_DEAL_CEILING = 7_500_000;
const EBITDA_MULTIPLE = 4;
const SDE_MULTIPLE = 3;

const UNCONFIRMED_LINE = 'SBA Eligibility: Unconfirmed - depends on size standard and deal size';
const NOT_PRIMARY_LABEL = 'Likely not SBA eligible / SBA not the primary financing path';

const SBA_SYSTEM_RULES = `SBA ELIGIBILITY RULES (mandatory):
- SBA eligibility is decided from size and deal economics: revenue, EBITDA or SDE, asking price or deal size, employees, tangible net worth, and average net income after tax. It is never decided from the NAICS sector or from the fact that an industry is manufacturing, services, or another "SBA-friendly" category.
- Never state that a business is "fully qualifying for SBA programs" from its NAICS code or industry sector. Never write SBA Eligibility: Yes, Likely, or any equivalent from industry research alone.
- SBA 7(a) maximum loan is $5 million. The 504 program's SBA portion is about $5.5 million and finances fixed assets; it does not finance goodwill on a going-concern acquisition and does not make a larger business purchase an SBA deal.
- NAICS size standards are employee-based or receipts-based. Use the NAICS-specific standard when it is known. When the code is missing, or the standard is known but the metric it uses (employees or receipts) was not provided, say the size standard needs verification. Do not treat an unknown standard as a pass.
- Alternative size test for 7(a) and 504 (13 CFR 121.301(b)): tangible net worth not more than $20 million AND average net income after federal income taxes (excluding carryover losses) for the two completed fiscal years not more than $6.5 million. Meeting either the NAICS standard or this alternative test can satisfy size. Failing a size test is not, by itself, a reason to claim the deal is financeable with SBA.
- Implied deal size is the asking price when one is provided. Otherwise use EBITDA × 4.0 (low end of a typical lower-middle-market multiple) or, if there is no EBITDA, SDE × 3.0. If that deal size is above $7.5 million, SBA cannot cover it as the primary financing. Say "Likely not SBA eligible / SBA not the primary financing path" and write the lender section around conventional senior debt, mezzanine or unitranche, a seller note, and PE equity. Give overall lender appetite and typical structures for a lower-middle-market deal of that size. Do not prescribe an SBA 7(a) loan as the structure.
- If revenue, EBITDA/SDE, and asking price are all missing, write exactly: "${UNCONFIRMED_LINE}". Do not guess Yes.
- Do not add generic SBA marketing claims (fee waivers, a higher guarantee percentage, "lowest-cost financing," "98% of manufacturers," or a named SBA program as proof of eligibility) unless you cite a primary source and the claim still fits inside the loan caps above. Those claims never override this determination.
- Apply the same rule in buyer appetite and in deal structure. When SBA is not the primary path, or eligibility is unconfirmed, do not present an SBA-financed owner-operator as the buyer who can finance the deal, and do not assume an SBA 7(a) structure, 10% SBA down payment, or SBA pre-qualification in the deal-structure questions.`;

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
      'Pivot the Lender & SBA Appetite section off SBA. Overall lender appetite is about conventional senior lenders, mezzanine or unitranche providers, and lower-middle-market equity sponsors.',
      'Typical structure for this size: conventional senior debt, mezzanine or unitranche, a seller note, and PE equity. Do not set the loan type to SBA 7(a). Do not title a subsection "Top SBA Lenders."',
      'Buyer appetite: strategic buyers, private equity, and independent sponsors are the realistic set. Do not present an SBA-financed owner-operator as the buyer who can finance this acquisition.',
      'Deal structure questions: do not assume an SBA 7(a) loan, 10% SBA down payment, or SBA pre-qualification.',
    );
  } else if (assessment.status === 'unconfirmed') {
    lines.push(
      'Do not default the section to an SBA 7(a) structure, Top SBA Lenders, or an owner-operator SBA buyer. Say which figure is missing (size standard metric and/or deal size) and what would change the answer.',
      'If research later in this same report states an asking price, EBITDA, or SDE that you did not have above, apply the deal-size rules and use the not-primary line when implied deal size is above the ceiling. If the new figures are still not enough to size the deal, keep the Unconfirmed line. Never upgrade to Yes from NAICS alone.',
      'Deal structure questions must not assume SBA financing while eligibility is unconfirmed.',
    );
  } else {
    lines.push(
      'An SBA 7(a) discussion is appropriate only because the implied deal size fits under the $5 million loan cap. State the size-standard finding, including when headcount or receipts still need verification.',
      'Do not describe the company as eligible merely because of its industry.',
    );
  }
  return lines.join('\n');
}

function conventionalStructure(deal, reason) {
  const lead = reason === 'deal_size' && deal
    ? `On an implied deal size of ${formatMoney(deal.amount)} (${deal.basis}), SBA is not the primary financing path.`
    : 'SBA is not the primary financing path on the size tests provided.';
  return [
    'Typical Deal Structure for This Size:',
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
  let rationale = '';

  if (!hasAnyEconomics(input)) {
    status = 'unconfirmed';
    rationale = 'Revenue, EBITDA/SDE, and asking price were not provided, so deal size cannot be compared with SBA loan caps. ' +
      financingCapsSentence() + ' ' + size.detail +
      ' The alternative test (tangible net worth not more than $20 million and average net income after tax not more than $6.5 million) was not provided. Industry alone is not eligibility.';
  } else if (deal && deal.amount > SBA_PRIMARY_DEAL_CEILING) {
    status = 'not_primary';
    reason = 'deal_size';
    const revenueBit = input.revenue != null ? ` Revenue is ${formatMoney(input.revenue)}.` : '';
    rationale = `Implied deal size is ${formatMoney(deal.amount)} (${deal.basis}). That is above ${formatMoney(SBA_PRIMARY_DEAL_CEILING)}, the level at which an SBA 7(a) loan (maximum ${formatMoney(SBA_7A_MAX_LOAN)}) can still be the primary financing. ${financingCapsSentence()}${revenueBit} ${size.detail} The size standard does not change the financing conclusion when the deal is larger than SBA can cover.`;
  } else if (hardSizeFail) {
    status = 'not_primary';
    reason = 'size_standard';
    rationale = `${size.detail} The business fails that NAICS standard on the figures provided, and it also fails the alternative test (tangible net worth ${formatMoney(input.tangibleNetWorth)} vs ${formatMoney(ALT_TANGIBLE_NET_WORTH_MAX)}, average net income after tax ${formatMoney(input.avgNetIncome)} vs ${formatMoney(ALT_AVG_NET_INCOME_MAX)}). ${financingCapsSentence()}`;
  } else if (deal && deal.amount <= SBA_PRIMARY_DEAL_CEILING && !sizeBlocksYes) {
    status = 'eligible';
    const revenueBit = input.revenue != null ? ` Revenue is ${formatMoney(input.revenue)}.` : '';
    const altBit = size.alternative === 'pass'
      ? ' The alternative size test is met on the tangible net worth and average net income provided.'
      : ' Tangible net worth and average net income after tax were not both provided, so the alternative test was not used.';
    const verifyBit = (size.naicsResult === 'unknown' || size.naicsResult === 'unverified')
      ? ' The NAICS-specific size standard still needs verification before a lender commits.'
      : '';
    rationale = `Implied deal size is ${formatMoney(deal.amount)} (${deal.basis}), which fits within SBA 7(a) capacity (maximum loan ${formatMoney(SBA_7A_MAX_LOAN)}).${revenueBit} ${size.detail}${verifyBit}${altBit}`;
  } else if (sizeBlocksYes) {
    status = 'unconfirmed';
    rationale = `${size.detail} Revenue or headcount is over that NAICS standard, and the alternative test (tangible net worth not more than $20 million and average net income after tax not more than $6.5 million) is not confirmed. Do not call the company SBA eligible from the industry code. ${financingCapsSentence()}`;
  } else {
    status = 'unconfirmed';
    const revenueBit = input.revenue != null ? ` Revenue of ${formatMoney(input.revenue)} is not a deal size.` : '';
    rationale = `Deal size is not known, so SBA cannot be confirmed or ruled out as the financing path.${revenueBit} ${size.detail} ${financingCapsSentence()} Eligibility stays unconfirmed until an asking price, EBITDA, or SDE is available.`;
  }

  const eligibilityLine = status === 'not_primary'
    ? `SBA Eligibility: ${NOT_PRIMARY_LABEL} - ${rationale}`
    : status === 'eligible'
      ? `SBA Eligibility: Yes - ${rationale}`
      : UNCONFIRMED_LINE;

  const assessment = {
    status,
    eligibilityLine,
    rationale,
    input,
    impliedDealSize: deal ? deal.amount : null,
    dealBasis: deal ? deal.basis : null,
    size,
    structureText: status === 'not_primary' ? conventionalStructure(deal, reason) : null,
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
  'Typical Deal Structure:',
  'Not selected. SBA eligibility is unconfirmed until deal size (asking price, or EBITDA or SDE times a typical multiple) and the NAICS size standard are known. Do not assume an SBA 7(a) loan, a 10% SBA down payment, or that this business qualifies for SBA programs.',
].join('\n');

function scrubUnsupportedClaims(text) {
  return text
    .replace(/fully qualifying for SBA programs/gi, 'which does not establish SBA eligibility')
    .replace(/fully qualif(?:y|ies|ying) for SBA(?: programs)?/gi, 'which does not establish SBA eligibility');
}

function guardBuyerAndStructure(text, assessment) {
  if (assessment.status === 'eligible') return text;
  let out = text.replace(/(Owner-Operator Buyer Potential:[^\n]*)/i, (line) => {
    if (!/SBA/i.test(line) || /not the primary financing path/i.test(line)) return line;
    return `${line} SBA is not the primary financing path at this deal size; buyer fit here is strategic, private equity, or an independent sponsor using conventional debt, mezzanine or unitranche, a seller note, and equity.`;
  });
  if (assessment.status === 'not_primary') {
    out = out.replace(/Top SBA Lenders for This Industry:/gi, 'Capital sources (SBA is not the primary financing path):');
  } else {
    out = out.replace(/Top SBA Lenders for This Industry:/gi, 'Financing sources (SBA eligibility is unconfirmed):');
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
      ? 'Overall Lender Appetite: Moderate to High for conventional senior credit and lower-middle-market sponsors. SBA appetite is not the relevant rating, because SBA is not the primary financing path.'
      : assessment.status === 'eligible'
        ? 'Overall Lender Appetite: Rate SBA 7(a) appetite only because the deal size fits under the $5 million loan cap. Confirm the NAICS size standard before a lender application.'
        : 'Overall Lender Appetite: Unrated for SBA. Do not describe SBA appetite as high or as established.',
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
      'Typical SBA Deal Structure:',
      `Loan Type: SBA 7(a), only because implied deal size fits under the ${formatMoney(SBA_7A_MAX_LOAN)} maximum loan.`,
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
  EBITDA_MULTIPLE,
  SDE_MULTIPLE,
  UNCONFIRMED_LINE,
  NOT_PRIMARY_LABEL,
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
