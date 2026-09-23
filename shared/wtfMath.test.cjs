const { test } = require('node:test');
const assert = require('node:assert/strict');
const { calcWtf, rollupPlans } = require('./wtfMath.mjs');

// Inputs and expected outputs taken from the 2027 person tabs
// (Personal Income, Split, Avg Deal Size, Commission Rate, Close Ratio
// and the formula cells for gross, deals, both pipelines, engagements).
const PRODUCERS = [
  ['Tim Moses',      300000,  0.5, 1500000, 0.1, 0.8, 600000,  4,  750000,  7500000,  5],
  ['David P.',      1000000,  0.5, 2000000, 0.1, 0.8, 2000000, 10, 2500000, 25000000, 13],
  ['Jamie',         1000000,  0.5, 3000000, 0.1, 0.8, 2000000,  7, 2625000, 26250000,  9],
  ['Ethan',          300000,  0.5, 1000000, 0.1, 0.8, 600000,  6,  750000,  7500000,  8],
  ['Jim',            300000,  0.5, 1100000, 0.1, 0.8, 600000,  6,  825000,  8250000,  8],
  ['Fred',           600000,  0.5, 1800000, 0.1, 0.8, 1200000,  7, 1575000, 15750000,  9],
  ['Mark',           300000,  0.5, 2000000, 0.1, 0.6, 600000,  3, 1000000, 10000000,  5],
  ['Robin McIntire',1000000,  0.5, 3000000, 0.1, 0.8, 2000000,  7, 2625000, 26250000,  9],
  ['Alisha Kaiser',  100000,  0.5, 1500000, 0.1, 0.8, 200000,  2,  375000,  3750000,  3],
  ['Macon Rudisill', 200000,  0.5, 1000000, 0.1, 0.8, 400000,  4,  500000,  5000000,  5],
  ['Betty Gales',    500000,  0.5,  850000, 0.1, 0.8, 1000000, 12, 1275000, 12750000, 15],
];

function input(row) {
  const [, income, split, deal, rate, close] = row;
  return { personalIncome: income, split, avgDealSize: deal, commissionRate: rate, closeRatio: close };
}

test('producer tabs match the workbook formula cells', () => {
  for (const row of PRODUCERS) {
    const [name, , , , , , gross, deals, pipe, volume, engagements] = row;
    const calc = calcWtf(input(row));
    assert.deepEqual(calc, {
      grossProduction: gross,
      dealsToClose: deals,
      pipelineCommission: pipe,
      pipelineDealVolume: volume,
      engagementsNeeded: engagements,
    }, name);
  }
});

test('team rollup matches the dashboard totals of $5.6M / $11.2M / 68 deals / $14.8M pipeline', () => {
  const { rows, kpis } = rollupPlans(PRODUCERS.map((row) => ({ name: row[0], ...input(row) })));
  assert.equal(kpis.teamCommittedGciIncome, 5600000);
  assert.equal(kpis.grossProductionRequired, 11200000);
  assert.equal(kpis.dealsToClose, 68);
  assert.equal(kpis.pipelineCommission, 14800000);
  assert.equal(kpis.pipelineDealVolume, 148000000);
  assert.equal(kpis.engagementsNeeded, 89);

  const robin = rows.find((r) => r.name === 'Robin McIntire');
  assert.equal(robin.pctOfTeam, 1000000 / 5600000);
  const sumPct = rows.reduce((s, r) => s + r.pctOfTeam, 0);
  assert.ok(Math.abs(sumPct - 1) < 1e-9);
});

test('a zero commission split follows IFERROR and does not divide', () => {
  assert.deepEqual(
    calcWtf({ personalIncome: 1000000, split: 0, avgDealSize: 2000000, commissionRate: 0.1, closeRatio: 0.8 }),
    { grossProduction: 0, dealsToClose: 0, pipelineCommission: 0, pipelineDealVolume: 0, engagementsNeeded: 0 },
  );
});

test('blank inputs and a zero close ratio resolve to zero', () => {
  assert.deepEqual(calcWtf({}), {
    grossProduction: 0, dealsToClose: 0, pipelineCommission: 0, pipelineDealVolume: 0, engagementsNeeded: 0,
  });
  assert.equal(calcWtf({
    personalIncome: 500000, split: 0.5, avgDealSize: 1000000, commissionRate: 0.1, closeRatio: 0,
  }).engagementsNeeded, 0);
});

test('deals round up, and an even division does not add an extra deal', () => {
  // 600,000 / (1,500,000 * 10%) = 4 exactly → 4, not 5.
  assert.equal(calcWtf({
    personalIncome: 300000, split: 0.5, avgDealSize: 1500000, commissionRate: 0.1, closeRatio: 0.8,
  }).dealsToClose, 4);
  // 2,000,000 / (3,000,000 * 10%) = 6.666… → 7.
  assert.equal(calcWtf({
    personalIncome: 1000000, split: 0.5, avgDealSize: 3000000, commissionRate: 0.1, closeRatio: 0.8,
  }).dealsToClose, 7);
});
