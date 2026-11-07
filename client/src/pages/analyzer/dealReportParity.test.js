import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcSDE, fairMarketSde, recentSDE, wtdSDE } from './sdeBasis.js';
import { calcSDE as reportCalc, fairMarketSde as reportFair, recentSDE as reportRecent, wtdSDE as reportWtd } from '../../../../shared/dealReport.mjs';
import { willowAshSampleState } from '../../../../shared/willowAshSample.cjs';

test('deal report SDE helpers match sdeBasis on the Willow Ash sample', () => {
  const years = willowAshSampleState().years;
  for (const year of years) assert.deepEqual(reportCalc(year), calcSDE(year));
  assert.equal(reportWtd(years), wtdSDE(years));
  assert.equal(reportRecent(years), recentSDE(years));
  assert.equal(reportFair(years, 'recent'), fairMarketSde(years, 'recent'));
  assert.equal(reportFair(years, 'weighted'), fairMarketSde(years, 'weighted'));
});
