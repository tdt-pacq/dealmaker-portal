import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcSDE, preserveRentModel, rentFieldsFromImport, rentNormalization } from './sdeBasis.js';
import { calcSDE as reportCalc, rentNormalization as reportNorm, stressPrices, computeNetProceeds } from '../../../../shared/dealReport.mjs';
import { willowAshSampleState } from '../../../../shared/willowAshSample.cjs';

const round = n => Math.round(n);

const year = (fields) => ({
  entityType: '1120-S',
  revenue: 500000,
  cogs: 200000,
  opx: 150000,
  otherIncome: '',
  interest: '',
  taxes: '',
  depreciation: '',
  amortization: '',
  ownerComp: '',
  addBacks: [],
  rent: '',
  rentAdj: '',
  year: 2025,
  ...fields,
});

function both(yd) {
  const app = rentNormalization(yd);
  const report = reportNorm(yd);
  assert.equal(report.adjustment, app.adjustment);
  assert.equal(reportCalc(yd).sde, calcSDE(yd).sde);
  assert.equal(reportCalc(yd).rentAB, app.adjustment);
  return app;
}

test('above-market rent is a positive add-back', () => {
  const adj = both(year({
    rentNormMode: 'rule', rent: 24000, rentNormMethod: 'fmr', fairMarketRent: 12000,
  }));
  assert.equal(adj.adjustment, 12000);
  const base = calcSDE(year({ rentNormMode: 'rule', rent: 24000, fairMarketRent: 24000 }));
  const above = calcSDE(year({ rentNormMode: 'rule', rent: 24000, fairMarketRent: 12000 }));
  assert.equal(round(above.sde - base.sde), 12000);
});

test('below-market rent is a negative adjustment', () => {
  const adj = both(year({
    rentNormMode: 'rule', rent: 12000, rentNormMethod: 'fmr', fairMarketRent: 24000,
  }));
  assert.equal(adj.adjustment, -12000);
});

test('real estate included in the sale adds the full rent back', () => {
  const adj = both(year({
    rentNormMode: 'rule', rent: 24000, reIncluded: true, fairMarketRent: 10000, rentNormMethod: 'cap', reNormValue: 500000, capRate: 8,
  }));
  assert.equal(adj.includedInSale, true);
  assert.equal(adj.adjustment, 24000);
});

test('cap rate sets occupancy cost to value times the percent', () => {
  const matched = both(year({
    rentNormMode: 'rule', rentNormMethod: 'cap', rent: 24000, reNormValue: 300000, capRate: 8,
  }));
  assert.equal(matched.normalizedCost, 24000);
  assert.equal(matched.adjustment, 0);
  const above = both(year({
    rentNormMode: 'rule', rentNormMethod: 'cap', rent: 36000, reNormValue: 300000, capRate: 8,
  }));
  assert.equal(above.adjustment, 12000);
  const below = both(year({
    rentNormMode: 'rule', rentNormMethod: 'cap', rent: 12000, reNormValue: 300000, capRate: 8,
  }));
  assert.equal(below.adjustment, -12000);
});

test('a tax-return import sets fair market rent equal to actual rent', () => {
  const fields = rentFieldsFromImport(24000);
  const adj = both(year(fields));
  assert.equal(fields.rentNormMode, 'rule');
  assert.equal(fields.fairMarketRent, 24000);
  assert.equal(adj.adjustment, 0);
  assert.equal(both(year({ rentNormMode: 'rule', rent: 24000, fairMarketRent: '' })).adjustment, 0);
});

test('a saved deal keeps its current rent adjustment', () => {
  const legacy = year({ rent: 6600, rentAdj: -3000 });
  const kept = both(legacy);
  assert.equal(kept.mode, 'manual');
  assert.equal(kept.adjustment, 3600);
  const migrated = preserveRentModel(legacy);
  assert.equal(migrated.rentNormMode, 'manual');
  assert.equal(migrated.rentAdj, -3000);
  assert.equal(calcSDE(migrated).rentAB, calcSDE(legacy).rentAB);
  const cancelled = year({ rent: 6600, rentAdj: -6600 });
  assert.equal(both(cancelled).adjustment, 0);
  assert.equal(preserveRentModel({ ...cancelled, rentNormMode: 'rule' }).rentNormMode, 'rule');
});

test('coverage at a gross-SDE multiple moves when buyer salary changes and the price does not', () => {
  const base = willowAshSampleState();
  const at = salary => stressPrices({ ...base, buyerSalary: salary }).rows.find(row => row.multiple === 3);
  const low = at(60000);
  const mid = at(75000);
  const high = at(90000);
  assert.equal(round(low.price), round(mid.price));
  assert.equal(round(mid.price), round(high.price));
  assert.equal(round(mid.price), 458709);
  assert.ok(low.dscrAfterSalary > mid.dscrAfterSalary);
  assert.ok(mid.dscrAfterSalary > high.dscrAfterSalary);
  assert.ok(low.cashLeft > mid.cashLeft);
  assert.ok(mid.cashLeft > high.cashLeft);
  const stress = stressPrices(base);
  assert.equal(round(stress.maxPrice), 363884);
});

test('an empty market price uses gross SDE times 3 and ignores buyer salary', () => {
  const state = willowAshSampleState();
  state.su = { ...state.su, marketPrice: '' };
  const at75 = computeNetProceeds(state);
  const at90 = computeNetProceeds({ ...state, buyerSalary: 90000 });
  assert.equal(at75.grossAssumed, true);
  assert.equal(round(at75.gross), 458709);
  assert.equal(round(at90.gross), round(at75.gross));
  assert.equal(round(at75.net), round(at75.gross - at75.commissionAmt));
  assert.equal(at75.lines.some(line => /SBA|buyer closing/i.test(line.label)), false);
});
