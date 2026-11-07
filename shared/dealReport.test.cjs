const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildDealReport, computeNetProceeds, fmtMoney } = require('./dealReport.cjs');
const { willowAshSampleState } = require('./willowAshSample.cjs');

const round = n => Math.round(n);

test('Willow Ash sample keeps the two SDE figures distinct', () => {
  const report = buildDealReport(willowAshSampleState(), { preparedDate: '2026-11-07' });
  assert.equal(round(report.sde.rawRecent), 152903);
  assert.equal(round(report.sde.rawWeighted), 111623);
  assert.equal(round(report.sde.afterSalary), 77903);
  assert.notEqual(round(report.sde.rawRecent), round(report.sde.afterSalary));
  assert.match(report.salaryNote, /152,903/);
  assert.match(report.salaryNote, /77,903/);
  assert.match(report.salaryNote, /75,000/);
});

test('Willow Ash debt service is three labeled loans, not one silent number', () => {
  const report = buildDealReport(willowAshSampleState(), { preparedDate: '2026-11-07' });
  const dealAnnual = report.dscr.deal.annual;
  const sizingAnnual = report.dscr.sizing.annual;
  const roiAnnual = report.roi.sbaAnnual;
  assert.equal(round(dealAnnual), 69565);
  assert.equal(round(sizingAnnual), 33356);
  assert.equal(round(roiAnnual), 65468);
  assert.equal(round(report.dscr.deal.loanAmount), 438674);
  assert.equal(round(report.dscr.sizing.loan), 210338);
  assert.equal(round(report.roi.sbaLoan), 412837);
  assert.equal(report.dscr.mode, 'deal');
  assert.match(report.dscr.sizing.note, /Sizing reference only/);
  assert.match(report.dscr.roiContrast, /cash to close/);
  const y2025 = report.dscr.rows.find(r => r.year === '2025');
  assert.equal(y2025.ratio.toFixed(2), '2.20');
  assert.equal(y2025.assessment, 'Strong');
  assert.equal(round(y2025.sde), 152903);
  const y2023 = report.dscr.rows.find(r => r.year === '2023');
  assert.equal(y2023.assessment, 'Below minimum');
});

test('Willow Ash net proceeds follow the Net Proceeds tab and ignore stale _net', () => {
  const state = willowAshSampleState();
  const proceeds = computeNetProceeds(state);
  assert.equal(round(proceeds.gross), 458708);
  assert.equal(round(proceeds.commissionAmt), 45871);
  assert.equal(round(proceeds.sbaFee), 10837);
  assert.equal(round(proceeds.closing), 15000);
  assert.equal(round(proceeds.net), 387000);
  assert.notEqual(proceeds.net, 0);
  assert.equal(state._net, 0);
  const signed = proceeds.lines.reduce((s, line) => s + (line.sign === '-' ? -line.amount : line.amount), 0);
  assert.ok(Math.abs(signed - proceeds.net) < 0.01);
  state._net = 999999;
  assert.equal(round(buildDealReport(state).proceeds.net), 387000);
});

test('Willow Ash NLB uses the computed proceeds and does not print a loss of current SDE', () => {
  const report = buildDealReport(willowAshSampleState(), { preparedDate: '2026-11-07' });
  assert.equal(report.nlb.available, true);
  assert.equal(report.nlb.pct, 100);
  assert.equal(round(report.nlb.target), 3870002);
  assert.equal(round(report.nlb.nextSDE), 1290001);
  assert.equal(round(report.nlb.incomeIncrease), 1137098);
  assert.ok(report.nlb.incomeIncrease > 0);
  assert.notEqual(round(report.nlb.incomeIncrease), -152903);
});

test('Willow Ash market price, industry citation, and section numbers match the export', () => {
  const report = buildDealReport(willowAshSampleState(), { preparedDate: '2026-11-07' });
  assert.equal(report.meta.prepared, 'November 7, 2026');
  assert.equal(report.marketPrice, 458708);
  const selected = report.multiples.find(m => m.selected);
  assert.equal(selected.multiple, 3);
  assert.equal(round(selected.price), 458708);
  assert.equal(report.industry.citation, 'Business Brokerage Press 2026');
  assert.equal((report.industry.citation.match(/2026/g) || []).length, 1);
  assert.equal(report.industry.tierMult, 2.07);
  assert.equal(report.industry.dealMult.toFixed(2), '3.00');
  assert.equal(report.industry.dealRevPct.toFixed(1), '35.2');
  const numbers = report.sections.map(s => s.number);
  assert.deepEqual(numbers, numbers.map((_, i) => i + 1));
  assert.equal(report.sections.some(s => s.id === 'seller'), false);
  assert.equal(report.sources.balanced, true);
  assert.equal(round(report.sources.sourcesTotal), 484545);
  assert.equal(round(report.roi.cashToClose), 71708);
  assert.equal(report.roi.cashOnCash.toFixed(1), '17.3');
  assert.equal(fmtMoney(report.roi.netCashFlow), '$12,435');
});

test('financial spread stacks history and YTD and keeps negative NOI', () => {
  const report = buildDealReport(willowAshSampleState());
  assert.equal(report.spread.groups.length, 1);
  assert.deepEqual(report.spread.groups[0].columns, ['2023', '% Rev', '2024', '% Rev', '2025', '% Rev']);
  const noi = report.spread.groups[0].rows.find(r => r.label === 'Net Operating Income');
  assert.equal(noi.cells[0], '-$22,162');
  assert.equal(noi.cells[1], '-2.9%');
  const sde = report.spread.groups[0].rows.find(r => r.isSde);
  assert.equal(sde.cells[4], '$152,903');
  assert.equal(sde.cells[5], '11.7%');
  assert.ok(report.spread.ytd);
  assert.deepEqual(report.spread.ytd.columns, ['YTD (9 mo)', '% Rev', 'Annualized', '% Rev']);
  const ytdRev = report.spread.ytd.rows[0];
  assert.equal(ytdRev.cells[0], '$906,261');
  assert.equal(ytdRev.cells[1], '100%');
  assert.equal(ytdRev.cells[2], '$1,208,348');
  assert.equal(ytdRev.cells[3], '100%');
});

test('many years split into tables of at most three, and long names do not change the math', () => {
  const state = willowAshSampleState();
  state.dealName = 'Willow Ash Roofing and Exterior Services of the Greater Southeast';
  state.advisorName = 'Alexandria Montgomery-Harrington, CBI, M&A Advisor';
  state.years = [2019, 2020, 2021, 2022, 2023, 2024].map((yr, i) => ({
    year: yr, entityType: '1120-S', revenue: 100000 * (i + 1), cogs: 40000, opx: 20000,
    interest: i === 3 ? -500 : 0, depreciation: 0, amortization: 0, ownerComp: 0, addBacks: [],
  }));
  const report = buildDealReport(state);
  assert.equal(report.spread.groups.length, 2);
  report.spread.groups.forEach(g => assert.ok(g.columns.length <= 8));
  assert.equal(report.meta.dealName.includes('Greater Southeast'), true);
  const interest = report.spread.groups[1].rows.find(r => r.label === '+ Interest');
  assert.equal(interest.cells[0], '-$500');
});

test('missing sale price does not masquerade as zero proceeds or a negative NLB outcome', () => {
  const state = willowAshSampleState();
  state.su.marketPrice = '';
  state.np.gross = '';
  state.years = state.years.map(y => ({ ...y, revenue: '', cogs: '', opx: '', interest: '', depreciation: '', ownerComp: '', addBacks: [] }));
  state.ytdEnabled = false;
  const report = buildDealReport(state);
  assert.equal(report.proceeds.available, false);
  assert.equal(report.proceeds.lines.length, 0);
  assert.equal(report.nlb.available, false);
  assert.equal(report.nlb.incomeIncrease, null);
  assert.match(report.nlb.reason, /not calculated|not positive|sale price/i);
  assert.equal(report.summary.some(f => f.label === 'Net proceeds to seller'), false);
  assert.equal(report.dscr.mode, 'sizing');
});

test('a blank optional section list stays contiguous and zero cash flow is not a projection', () => {
  const state = willowAshSampleState();
  state.seller.askingPrice = 500000;
  const full = buildDealReport(state);
  assert.equal(full.sections.some(s => s.id === 'seller'), true);
  const buyer = buildDealReport(state, { sections: { proceeds: false, nlb: false, seller: false } });
  const nums = buyer.sections.map(s => s.number);
  assert.deepEqual(nums, nums.map((_, i) => i + 1));
  assert.equal(buyer.sections.some(s => s.id === 'proceeds'), false);
});

test('explicit zero debt stays visible and does not get replaced with an invented payoff', () => {
  const state = willowAshSampleState();
  state.np.mortgage = 0;
  state.np.legal = 0;
  state.np.taxRate = 0;
  const debt = computeNetProceeds(state).lines.find(l => l.label.startsWith('Debt'));
  assert.equal(debt.amount, 0);
  assert.equal(round(computeNetProceeds(state).net), 387000);
});
