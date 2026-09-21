import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcSDE, fairMarketSde, mostRecentYearData, recentSDE, uniquifyYears } from './sdeBasis.js';

// Line items from Robin McIntire's Good Hair Days QSI workbook
// "Good Hair Days Inc - QSI™ Market Price Analysis 2022-2024 9.17.26".
// SDE totals in that workbook: 2022 $203,081.80, 2023 $248,092.38, 2024 $300,276.50.
const year = (yr, fields) => ({
  entityType: '1120',
  revenue: '',
  cogs: '',
  opx: '',
  otherIncome: '',
  interest: '',
  taxes: '',
  depreciation: '',
  amortization: '',
  ownerComp: '',
  addBacks: [],
  rent: '',
  rentAdj: '',
  ...fields,
  year: yr,
});

const y2022 = year(2022, {
  revenue: 468153, cogs: 133949, opx: 290779, depreciation: 1196, ownerComp: 147200,
  addBacks: [{ amount: 11260.80 }], rent: 6600, rentAdj: -6600,
});
const y2023 = year(2023, {
  revenue: 838360, cogs: 274261, opx: 573999, depreciation: 25526, ownerComp: 206750,
  addBacks: [{ amount: 15816.38 }, { amount: 9900 }], rent: 6600, rentAdj: -6600,
});
const y2024 = year(2024, {
  revenue: 883347, cogs: 124959, opx: 776376, depreciation: 27369, ownerComp: 247000,
  addBacks: [{ amount: 18895.50 }, { amount: 25000 }], rent: 6600, rentAdj: -6600,
});

const BUYER_SALARY = 75000;

test('Good Hair Days year columns match the workbook SDE totals', () => {
  assert.equal(calcSDE(y2022).sde, 203081.80);
  assert.equal(calcSDE(y2023).sde, 248092.38);
  assert.equal(calcSDE(y2024).sde, 300276.50);
  assert.equal(Math.round(calcSDE(y2024).sde), 300277);
});

test('Fair market most recent SDE is the latest year column, not SDE minus buyer salary', () => {
  const years = [y2022, y2023, y2024];
  const latest = mostRecentYearData(years);
  assert.equal(latest.year, 2024);
  assert.equal(recentSDE(years), 300276.50);
  assert.equal(fairMarketSde(years, 'recent'), 300276.50);
  // What the Deal Report used to print: latest SDE − $75,000 buyer's salary.
  assert.equal(Math.round(fairMarketSde(years, 'recent') - BUYER_SALARY), 225277);
  assert.notEqual(Math.round(fairMarketSde(years, 'recent')), 225277);
  // Sep 17 screenshot ($173,092) was the 2023 column after the same salary haircut.
  assert.equal(Math.round(calcSDE(y2023).sde - BUYER_SALARY), 173092);
});

test('duplicate 2024 headers still value the later column, including after year labels are uniquified', () => {
  // Columns Robin saw: 2024 shown twice. The rightmost duplicate holds the 2024 return.
  const duplicated = [year(2023, y2023), year(2024, y2023), year(2024, y2024)];
  assert.equal(fairMarketSde(duplicated, 'recent'), 300276.50);
  const labeled = uniquifyYears(duplicated);
  assert.deepEqual(labeled.map(y => y.year), [2023, 2024, 2025]);
  assert.equal(mostRecentYearData(labeled).year, 2025);
  assert.equal(fairMarketSde(labeled, 'recent'), 300276.50);
  assert.equal(calcSDE(labeled[2]).sde, 300276.50);
});

test('an empty later year and YTD do not replace the latest completed column', () => {
  const years = [
    y2023,
    y2024,
    year(2025, {}),
    year('YTD', { revenue: 900000, ownerComp: 400000 }),
  ];
  assert.equal(mostRecentYearData(years).year, 2024);
  assert.equal(fairMarketSde(years, 'recent'), 300276.50);
});
