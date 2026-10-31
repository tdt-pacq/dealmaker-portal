import { createRequire } from 'node:module';
import test from 'node:test';
import assert from 'node:assert/strict';

const require = createRequire(import.meta.url);
const { industryExtractionIsUseful, INDUSTRY_EXTRACT_FAILED } = require('../../../../shared/industryBenchmarks.cjs');

test('footer-only industry JSON is rejected before the review form opens', () => {
  assert.equal(industryExtractionIsUseful({
    name: null,
    naics: null,
    source: 'Business Brokerage Press 2026',
    reportYear: 2026,
    grossMarginPct: null,
    sdeMultUnder1M: null,
  }), false);
  assert.equal(industryExtractionIsUseful({
    name: 'Roofing Contractors',
    naics: '238160',
    grossMarginPct: 32.8,
    sdeMultUnder1M: 1.66,
  }), true);
  assert.match(INDUSTRY_EXTRACT_FAILED, /enter the values manually/i);
});
