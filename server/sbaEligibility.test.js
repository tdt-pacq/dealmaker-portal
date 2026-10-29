const { test } = require('node:test');
const assert = require('node:assert/strict');

const {
  UNCONFIRMED_LINE,
  NOT_PRIMARY_LABEL,
  lookupSizeStandard,
  assessSbaEligibility,
  extractFinancials,
  applySbaGuardrail,
  renderLenderSection,
} = require('./sbaEligibility');
const { buildDiscoveryUserPrompt, SYSTEM_PROMPT } = require('./discoveryPrompt');

const OXCO_BEFORE = `
LENDER AND SBA APPETITE ASSESSMENT
SBA Eligibility: Yes - Eligibility tied to NAICS Sectors 31–33, which the SBA notes covers roughly 98% of all U.S. manufacturers, from food processing to precision machining to furniture and textiles. OXCO operates under NAICS 313230, fully qualifying for SBA programs.
Overall Lender Appetite: High
Lender Appetite Rationale:
SBA loans are often among the lowest-cost financing available to manufacturers that qualify.
Typical SBA Deal Structure for This Industry:
Loan Type: SBA 7(a) or Made in America Loan Guarantee
Typical Down Payment: 10-15% equity injection
Lender Red Flags for This Industry:
- Customer concentration exceeding 20% in any single account
Top SBA Lenders for This Industry:
1. Lender Name: Live Oak Bank — largest SBA 7(a) lender
Owner-Operator Buyer Potential: High - an SBA buyer can finance this with 10% down.
`;

test('NAICS 313230 is the employee standard for nonwoven fabric mills', () => {
  const standard = lookupSizeStandard('313230');
  assert.equal(standard.title, 'Nonwoven Fabric Mills');
  assert.equal(standard.employees, 850);
  assert.equal(standard.receiptsMillions, undefined);
});

test('large deal (rev $21M, EBITDA $3M) is Not likely - Likely M&A', () => {
  const result = assessSbaEligibility({ revenue: 21_000_000, ebitda: 3_000_000, naics: '313230' });
  assert.equal(result.status, 'not_primary');
  assert.match(result.eligibilityLine, /^SBA Eligibility: Not likely - Likely M&A - /);
  assert.match(result.eligibilityLine, new RegExp(NOT_PRIMARY_LABEL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(result.eligibilityLine, /\$12 million/);
  assert.match(result.eligibilityLine, /\$5 million/);
  assert.match(result.rationale, /850/);
  assert.match(result.rationale, /needs verification/);
  assert.match(result.structureText, /^M&A Financing Path:/);
  assert.match(result.structureText, /conventional/i);
  assert.match(result.structureText, /Mezzanine or unitranche/);
  assert.match(result.structureText, /Seller note/);
  assert.match(result.structureText, /PE equity/);
  assert.doesNotMatch(result.eligibilityLine, /fully qualifying/i);
  assert.doesNotMatch(result.eligibilityLine, /Likely not SBA eligible/);
  assert.doesNotMatch(result.eligibilityLine, /SBA Eligibility: Yes/);

  const fromStrings = assessSbaEligibility({ revenue: '$21M', ebitda: '$3 million', industryDescription: 'NAICS 313230' });
  assert.equal(fromStrings.status, 'not_primary');
  assert.match(fromStrings.eligibilityLine, /^SBA Eligibility: Not likely - Likely M&A - /);
});

test('small deal (rev $2M, SDE $400K) is Likely - SBA, pending the owner', () => {
  const result = assessSbaEligibility({ revenue: 2_000_000, sde: 400_000 });
  assert.equal(result.status, 'eligible');
  assert.match(result.eligibilityLine, /^SBA Eligibility: Likely - SBA - /);
  assert.match(result.eligibilityLine, /Pending confirmation with the business owner/);
  assert.match(result.eligibilityLine, /\$1\.2 million/);
  assert.match(result.eligibilityLine, /\$5 million/);
  assert.match(result.rationale, /needs verification/);
  assert.doesNotMatch(result.eligibilityLine, /fully qualifying/i);
  assert.equal(result.structureText, null);

  const fromStrings = assessSbaEligibility({ revenue: '$2M', sde: '$400K' });
  assert.equal(fromStrings.status, 'eligible');
  assert.match(fromStrings.eligibilityLine, /^SBA Eligibility: Likely - SBA - /);
});

test('missing financials stay unconfirmed instead of Yes', () => {
  const missing = assessSbaEligibility({});
  assert.equal(missing.status, 'unconfirmed');
  assert.equal(missing.eligibilityLine, UNCONFIRMED_LINE);

  const industryOnly = assessSbaEligibility({ industryDescription: '313230 Nonwoven Fabric Mills' });
  assert.equal(industryOnly.status, 'unconfirmed');
  assert.equal(industryOnly.eligibilityLine, UNCONFIRMED_LINE);
  assert.match(industryOnly.rationale, /850/);
  assert.doesNotMatch(industryOnly.eligibilityLine, /Yes/);
});

test('revenue above $15M with no EBITDA is Not likely - Likely M&A', () => {
  const result = assessSbaEligibility({ revenue: 21_000_000, naics: '313230' });
  assert.equal(result.status, 'not_primary');
  assert.match(result.eligibilityLine, /^SBA Eligibility: Not likely - Likely M&A - /);
  assert.match(result.eligibilityLine, /\$21 million/);
  assert.match(result.eligibilityLine, /\$15 million/);
  assert.match(result.eligibilityLine, /\$5 million/);
  assert.match(result.rationale, /850/);
  assert.match(result.structureText, /M&A Financing Path/);
  assert.doesNotMatch(result.eligibilityLine, /Unconfirmed/);

  const atThreshold = assessSbaEligibility({ revenue: 15_000_000 });
  assert.equal(atThreshold.status, 'unconfirmed');
  assert.equal(atThreshold.eligibilityLine, UNCONFIRMED_LINE);
});

test('failing both the NAICS standard and the alternative test is not SBA eligible', () => {
  const result = assessSbaEligibility({
    revenue: 2_000_000,
    sde: 400_000,
    naics: '313230',
    employees: 2000,
    tangibleNetWorth: 25_000_000,
    avgNetIncome: 8_000_000,
  });
  assert.equal(result.status, 'not_primary');
  assert.match(result.eligibilityLine, /^SBA Eligibility: Not likely - Likely M&A - /);
  assert.match(result.rationale, /alternative test/);
});

test('alternative size test can save a company over the employee standard when the deal fits', () => {
  const result = assessSbaEligibility({
    revenue: 2_000_000,
    sde: 400_000,
    naics: '313230',
    employees: 2000,
    tangibleNetWorth: 10_000_000,
    avgNetIncome: 1_000_000,
  });
  assert.equal(result.status, 'eligible');
});

test('receipts over a known NAICS cap are not called SBA without the alternative test', () => {
  const result = assessSbaEligibility({
    revenue: 3_000_000,
    ebitda: 200_000,
    naics: '111110',
  });
  assert.equal(result.impliedDealSize, 800_000);
  assert.equal(result.status, 'unconfirmed');
  assert.equal(result.eligibilityLine, UNCONFIRMED_LINE);
  assert.match(result.rationale, /\$2\.25 million/);
});

test('asking price controls deal size when it is provided', () => {
  const priced = assessSbaEligibility({ askingPrice: '$15M', sde: '$400K' });
  assert.equal(priced.status, 'not_primary');
  assert.equal(priced.impliedDealSize, 15_000_000);
});

test('guardrail rewrites the OXCO SBA section for a $21M / $3M EBITDA deal', () => {
  const { text, assessment } = applySbaGuardrail(OXCO_BEFORE, {
    revenue: 21_000_000,
    ebitda: 3_000_000,
    naics: '313230',
  });
  assert.equal(assessment.status, 'not_primary');
  assert.match(text, /SBA Eligibility: Not likely - Likely M&A - /);
  assert.match(text, /\$12 million/);
  assert.doesNotMatch(text, /fully qualifying/i);
  assert.doesNotMatch(text, /Likely not SBA eligible/);
  assert.doesNotMatch(text, /Loan Type: SBA 7\(a\)/);
  assert.match(text, /M&A Financing Path/);
  assert.match(text, /Mezzanine or unitranche/);
  assert.match(text, /Seller note/);
  assert.match(text, /PE equity/);
  assert.match(text, /conventional/i);
  assert.match(text, /maximum loan \$5 million|max loan is \$5 million/);
  assert.match(text, /Lender Red Flags for This Industry/);
  assert.match(text, /Capital sources \(M&A financing path\)/);
  assert.doesNotMatch(text, /Top SBA Lenders for This Industry/);
});

test('guardrail turns a NAICS-only Yes into Unconfirmed when financials are missing', () => {
  const { text, assessment } = applySbaGuardrail(OXCO_BEFORE, {});
  assert.equal(assessment.status, 'unconfirmed');
  assert.match(text, new RegExp(UNCONFIRMED_LINE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(text, /SBA Eligibility: Yes/);
  assert.doesNotMatch(text, /fully qualifying/i);
  assert.doesNotMatch(text, /Loan Type: SBA 7\(a\)/);
  assert.match(text, /M&A Financing Path \(to be confirmed with the business owner\)/);
  assert.doesNotMatch(text, /Likely not SBA eligible/);
});

test('guardrail keeps a small deal on Likely - SBA and strips the NAICS-only claim', () => {
  const { text, assessment } = applySbaGuardrail(OXCO_BEFORE, {
    revenue: 2_000_000,
    sde: 400_000,
  });
  assert.equal(assessment.status, 'eligible');
  assert.match(text, /SBA Eligibility: Likely - SBA - /);
  assert.match(text, /Pending confirmation with the business owner/);
  assert.doesNotMatch(text, /fully qualifying/i);
  assert.match(text, /Loan Type: SBA 7\(a\)/);
  assert.doesNotMatch(text, /M&A financing path, not SBA/);
});

test('researched EBITDA and revenue in the report override a NAICS-only Yes', () => {
  const researched = `
SBA Eligibility: Yes - NAICS 313230, fully qualifying for SBA programs.
The business does about $20-22M revenue with EBITDA of $3 million.
Typical SBA Deal Structure for This Industry:
Loan Type: SBA 7(a)
`;
  const extracted = extractFinancials(researched);
  assert.equal(extracted.revenue, 20_000_000);
  assert.equal(extracted.ebitda, 3_000_000);
  assert.equal(extracted.naics, '313230');
  const { assessment, text } = applySbaGuardrail(researched, {});
  assert.equal(assessment.status, 'not_primary');
  assert.match(text, /SBA Eligibility: Not likely - Likely M&A - /);
  assert.match(text, /\$12 million/);
  assert.match(text, /M&A Financing Path/);
  assert.doesNotMatch(text, /fully qualifying/i);
  assert.doesNotMatch(text, /Likely not SBA eligible/);
});

test('research-only revenue above $15M with no EBITDA is Not likely - Likely M&A', () => {
  const researched = `
SBA Eligibility: Yes - NAICS 313230, fully qualifying for SBA programs.
OXCO revenue is about $21 million.
Typical SBA Deal Structure for This Industry:
Loan Type: SBA 7(a)
`;
  const extracted = extractFinancials(researched);
  assert.equal(extracted.revenue, 21_000_000);
  assert.equal(extracted.ebitda, null);
  const { assessment, text } = applySbaGuardrail(researched, {});
  assert.equal(assessment.status, 'not_primary');
  assert.equal(assessment.input.ebitda, null);
  assert.match(assessment.eligibilityLine, /^SBA Eligibility: Not likely - Likely M&A - /);
  assert.match(assessment.eligibilityLine, /\$21 million/);
  assert.match(assessment.eligibilityLine, /\$15 million/);
  assert.match(text, /M&A Financing Path:/);
  assert.doesNotMatch(text, /SBA Eligibility: Unconfirmed/);
  assert.doesNotMatch(text, /Loan Type: SBA 7\(a\)/);
});

test('discovery prompt locks the determination and does not allow a NAICS-only Yes', () => {
  const large = buildDiscoveryUserPrompt({
    businessName: 'OXCO',
    industryDescription: '313230 Nonwoven Fabric Mills',
    revenue: '$21M',
    ebitda: '$3M',
  });
  assert.match(large, /REVENUE: \$21M/);
  assert.match(large, /EBITDA: \$3M/);
  assert.match(large, /SBA Eligibility: Not likely - Likely M&A - /);
  assert.match(large, /M&A Financing Path/);
  assert.match(large, /Never state that a business is "fully qualifying for SBA programs"/);
  assert.match(large, /conventional senior debt, mezzanine or unitranche, a seller note, and PE equity/i);
  assert.match(large, /do not describe an SBA-financed owner-operator/i);
  assert.match(large, /Do not assume an SBA 7\(a\) loan/);
  assert.doesNotMatch(large, /Likely not SBA eligible \/ SBA not the primary financing path/);
  assert.doesNotMatch(large, /SBA Eligibility: \[Yes \/ Likely \/ Unlikely \/ No\]/);
  assert.doesNotMatch(large, /Loan Type: SBA 7\(a\)\nTypical Down Payment/);

  const missing = buildDiscoveryUserPrompt({ businessName: 'OXCO', industryDescription: '313230' });
  assert.match(missing, new RegExp(UNCONFIRMED_LINE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.match(missing, /Never upgrade to SBA from NAICS alone/);
  assert.match(missing, /M&A Financing Path \(to be confirmed with the business owner\)/);

  const small = buildDiscoveryUserPrompt({ businessName: 'Main Street Co', revenue: '$2M', sde: '$400K' });
  assert.match(small, /SBA Eligibility: Likely - SBA - /);
  assert.match(small, /Pending confirmation with the business owner/);
  assert.match(small, /needs verification/);

  assert.match(SYSTEM_PROMPT, /Never state that a business is "fully qualifying for SBA programs"/);
  assert.match(SYSTEM_PROMPT, /If revenue, EBITDA\/SDE, and asking price are all missing/);
});

test('OXCO lender section after the fix pivots off SBA', () => {
  const after = renderLenderSection({
    revenue: 21_000_000,
    ebitda: 3_000_000,
    naics: '313230',
  });
  assert.match(after, /SBA Eligibility: Not likely - Likely M&A - /);
  assert.match(after, /M&A Financing Path:/);
  assert.match(after, /\$12 million/);
  assert.match(after, /\$21 million/);
  assert.match(after, /850/);
  assert.match(after, /conventional senior/i);
  assert.match(after, /Mezzanine or unitranche/);
  assert.match(after, /Seller note/);
  assert.match(after, /PE equity/);
  assert.match(after, /Overall Lender Appetite:/);
  assert.doesNotMatch(after, /fully qualifying for SBA programs/i);
  assert.doesNotMatch(after, /SBA Eligibility: Yes/);
});
