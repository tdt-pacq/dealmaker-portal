const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const dbFile = path.join(os.tmpdir(), `pacq-lock-${process.pid}.db`);
for (const suffix of ['', '-shm', '-wal']) {
  try { fs.unlinkSync(dbFile + suffix); } catch (_) { /* fresh file */ }
}
process.env.DB_PATH = dbFile;
process.env.NODE_ENV = 'test';

const { getDb } = require('./database');
const {
  weightedAverage321,
  resolveValuation,
  sbaEstimates,
  confirmMarketing,
  buildReview,
  formatLockedBlock,
} = require('./marketingLock');

test('3-2-1 weighting uses three years and refuses fewer', () => {
  const years = [
    { year: '2024', sde: 180000 },
    { year: '2023', sde: 150000 },
    { year: '2022', sde: 120000 },
  ];
  assert.equal(weightedAverage321(years), 160000);
  assert.equal(weightedAverage321(years.slice(0, 2)), null);
  assert.throws(() => resolveValuation(years.slice(0, 2), 'weighted_321'), /three years/);
  const recent = resolveValuation(years.slice(0, 1), 'most_recent');
  assert.equal(recent.valuation_sde, 180000);
  assert.equal(recent.valuation_basis_label, 'most recent year 2024');
});

test('SBA estimate blends a 10-year business loan and a 25-year real estate loan', () => {
  const est = sbaEstimates({
    askingPrice: 1000000,
    realEstateValue: 400000,
    realEstateIncluded: true,
    rate: 10,
    valuationSde: 250000,
    ownerComp: 80000,
  });
  assert.equal(est.blended, true);
  assert.equal(est.business_loan, 540000);
  assert.equal(est.real_estate_loan, 360000);
  assert.equal(est.business_term_years, 10);
  assert.equal(est.real_estate_term_years, 25);
  assert.ok(est.monthly_payment > 0);
  assert.equal(est.dscr, 250000 / est.annual_debt_service);
  assert.ok(est.cash_on_cash_pre != null);
  assert.ok(est.cash_on_cash_after < est.cash_on_cash_pre);
});

test('confirm locks one Valuation SDE and a later document change asks again', () => {
  const id = 'deal-pinetop';
  const now = new Date().toISOString();
  const interview = {
    asking_price: '450000',
    fin_year1_label: '2024',
    fin_year1_sde: '180000',
    fin_year2_label: '2023',
    fin_year2_sde: '150000',
    fin_year3_label: '2022',
    fin_year3_sde: '120000',
    business_type: 'Coffeehouse',
    year_founded: '1998',
    business_city_state: 'White Mountains, AZ',
    employees_count: '4 baristas',
    real_estate_situation: 'Leased cafe',
    sba_preapproved: 'No',
  };
  getDb().prepare(`
    INSERT INTO deals (id, deal_name, status, created_at, updated_at, advisor_name, interview_data)
    VALUES (?, 'Pinetop Coffee House', 'active', ?, ?, 'Alisha', ?)
  `).run(id, now, now, JSON.stringify(interview));

  const lock = confirmMarketing(id, {
    sba_rate: 10.5,
    sde_basis: 'weighted_321',
    real_estate_included: false,
    summary: interview,
  });
  assert.equal(lock.valuation_sde, 160000);
  assert.equal(lock.valuation_basis_label, 'weighted avg 3-2-1');
  assert.equal(lock.sba_rate, 10.5);
  assert.match(formatLockedBlock(lock), /Valuation SDE: \$160,000 \(basis: weighted avg 3-2-1\)/);
  assert.match(formatLockedBlock(lock), /SBA rate confirmed: 10\.5%/);

  const quiet = buildReview(id);
  assert.equal(quiet.needs_review, false);

  getDb().prepare('UPDATE deals SET interview_data = ? WHERE id = ?').run(
    JSON.stringify({ ...interview, asking_price: '475000' }),
    id
  );
  const changed = buildReview(id);
  assert.equal(changed.needs_review, true);
});
