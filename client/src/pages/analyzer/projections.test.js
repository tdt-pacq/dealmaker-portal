import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calcSDE, fairMarketSde } from './sdeBasis.js';
import {
  LEVERS,
  SCENARIO_PRESETS,
  clampLever,
  compareScenarios,
  defaultProjections,
  fairMarketMultiple,
  fmtMoney,
  isScenarioEdited,
  leverImpacts,
  normalizeProjections,
  project,
  projectionBaseline,
  sampleHvacState,
} from './projections.js';

const round = n => Math.round(n);

test('HVAC sample baseline is the most recent year and the fair-market multiple', () => {
  const state = sampleHvacState();
  const base = projectionBaseline(state);
  assert.equal(base.year, 2025);
  assert.equal(base.rev, 2400000);
  assert.equal(base.cogs, 1104000);
  assert.equal(base.opx, 1020000);
  assert.equal(base.oc, 150000);
  assert.equal(base.ab, 54000);
  assert.equal(base.sde, 480000);
  assert.equal(base.sde, calcSDE(state.years[2]).sde);
  assert.equal(base.multiple, 2.8);
  assert.equal(base.multipleSource, 'market');
  assert.equal(round(base.sde * base.multiple), 1344000);
  assert.equal(base.addBackNote, 'Personal vehicle, One-time legal');
});

test('Base scenario matches the approved three-year model', () => {
  const base = projectionBaseline(sampleHvacState());
  const rows = project(base, SCENARIO_PRESETS.Base);
  assert.equal(rows.length, 4);
  assert.equal(round(rows[0].sde), 480000);
  assert.equal(round(rows[1].rev), 2645760);
  assert.equal(round(rows[1].sde), 721800);
  assert.equal(round(rows[1].sde - rows[0].sde), 241800);
  assert.equal(round(rows[3].rev), 2972776);
  assert.equal(round(rows[3].sde), 846482);
  assert.equal(round(rows[3].sde - rows[0].sde), 366482);
  assert.equal(round(rows[3].val), 2370148);
  assert.equal(round(rows[3].val - rows[0].val), 1026148);
  assert.equal(round((rows[3].sde - rows[0].sde) / rows[0].sde * 100), 76);
  // Owner-comp normalization is SDE-neutral and shows up only on Adj. EBITDA.
  assert.equal(round(rows[3].adj), 736482);
  assert.equal(round(rows[3].adj), round(rows[3].sde - 110000));
});

test('price does not change COGS, and opex grows at half the volume rate', () => {
  const base = projectionBaseline(sampleHvacState());
  const priceOnly = {
    price: { on: true, value: 4 },
    growth: { on: false, value: 0 },
    cogs: { on: false, value: 0 },
    opex: { on: false, value: 0 },
    ownerComp: { on: false, value: 110000 },
    gm: { on: false, value: 85000 },
    rent: { on: false, value: 0 },
  };
  const rows = project(base, priceOnly);
  assert.equal(round(rows[1].rev), round(2400000 * 1.04));
  assert.equal(round(rows[1].cogs), 1104000);
  assert.equal(round(rows[1].opx), 1020000);

  const growthOnly = { ...priceOnly, price: { on: false, value: 0 }, growth: { on: true, value: 6 } };
  const grown = project(base, growthOnly);
  const vol = 2400000 * 1.06;
  assert.equal(round(grown[1].cogs), round(vol * 0.46));
  assert.equal(round(grown[1].opx), round(1020000 * 1.03));
  assert.notEqual(round(grown[1].opx), round(1020000 * 1.06));
});

test('dollar levers stay flat and a turned-off lever does not apply', () => {
  const base = projectionBaseline(sampleHvacState());
  const levers = {
    price: { on: false, value: 4 },
    growth: { on: false, value: 6 },
    cogs: { on: false, value: 2 },
    opex: { on: true, value: 30000 },
    ownerComp: { on: false, value: 110000 },
    gm: { on: true, value: 85000 },
    rent: { on: true, value: -12000 },
  };
  const rows = project(base, levers);
  assert.equal(round(rows[1].opx), round(1020000 - 30000 + 85000 - 12000));
  assert.equal(round(rows[3].opx), round(1020000 - 30000 + 85000 - 12000));
  const off = project(base, { ...levers, opex: { on: false, value: 30000 } });
  assert.equal(round(off[3].opx - rows[3].opx), 30000);
});

test('a year with no levers equals calcSDE, including ITDA and rent adjustment', () => {
  const year = {
    year: 2024,
    entityType: '1120',
    revenue: 883347,
    cogs: 124959,
    opx: 776376,
    depreciation: 27369,
    ownerComp: 247000,
    interest: 1200,
    taxes: 4000,
    otherIncome: 500,
    addBacks: [{ amount: 18895.50 }, { label: 'One-time', amount: 25000 }],
    rent: 6600,
    rentAdj: -6600,
  };
  const state = { years: [year], sdeBasis: 'recent', su: { marketPrice: '' } };
  const base = projectionBaseline(state);
  assert.equal(base.sde, calcSDE(year).sde);
  assert.equal(base.multiple, 3);
  assert.equal(base.multipleSource, 'default');
  const rows = project(base, defaultProjections().levers);
  const quiet = project(base, Object.fromEntries(
    ['price', 'growth', 'cogs', 'opex', 'ownerComp', 'gm', 'rent'].map(id => [id, { on: false, value: 0 }]),
  ));
  assert.equal(quiet[0].sde, calcSDE(year).sde);
  assert.equal(quiet[3].sde, calcSDE(year).sde);
  assert.ok(rows[3].sde !== quiet[3].sde);
});

test('weighted valuation still projects the most recent year at the fair-market multiple', () => {
  const state = sampleHvacState();
  state.sdeBasis = 'weighted';
  const basis = fairMarketSde(state.years, 'weighted');
  state.su.marketPrice = basis * 2.5;
  const base = projectionBaseline(state);
  assert.equal(base.year, 2025);
  assert.equal(base.sde, 480000);
  assert.ok(Math.abs(base.multiple - 2.5) < 1e-9);
  assert.equal(fairMarketMultiple(state).basisKey, 'weighted');
  assert.notEqual(basis, 480000);
});

test('sequential impact still applies price before growth', () => {
  assert.deepEqual(LEVERS.map(lever => lever.id), [
    'price', 'growth', 'cogs', 'opex', 'ownerComp', 'gm', 'rent',
  ]);
  const base = projectionBaseline(sampleHvacState());
  const impacts = leverImpacts(base, SCENARIO_PRESETS.Base);
  const delta = id => round(impacts.find(item => item.id === id).delta);
  assert.equal(delta('price'), 96000);
  assert.equal(delta('growth'), 171313);
  assert.equal(delta('cogs'), 57169);
  assert.equal(delta('opex'), 30000);
  assert.equal(delta('rent'), 12000);
  assert.deepEqual(SCENARIO_PRESETS.Base.growth, { on: true, value: 6 });
  assert.deepEqual(SCENARIO_PRESETS.Base.price, { on: true, value: 4 });
});

test('owner comp is SDE-neutral in the ranked impacts', () => {
  const base = projectionBaseline(sampleHvacState());
  const impacts = leverImpacts(base, SCENARIO_PRESETS.Base);
  const owner = impacts.find(i => i.id === 'ownerComp');
  assert.equal(owner.on, true);
  assert.equal(round(owner.delta), 0);
  const gm = impacts.find(i => i.id === 'gm');
  assert.equal(gm.on, false);
  assert.equal(round(gm.delta), 0);
  const total = impacts.reduce((sum, item) => sum + item.delta, 0);
  const y3 = project(base, SCENARIO_PRESETS.Base)[3].sde;
  assert.equal(round(total), round(y3 - base.sde));
});

test('deals with no projections data open on the Base preset', () => {
  for (const raw of [undefined, null, {}, { scenario: 'nope' }, { levers: null }]) {
    const view = normalizeProjections(raw);
    assert.equal(view.scenario, 'Base');
    assert.equal(view.levers.price.on, true);
    assert.equal(view.levers.price.value, 4);
    assert.equal(view.levers.gm.on, false);
    assert.equal(view.levers.rent.value, -12000);
    assert.equal(isScenarioEdited(view), false);
  }
});

test('saved lever settings round-trip and mark the scenario edited', () => {
  const saved = {
    scenario: 'Aggressive',
    levers: {
      price: { on: true, value: 7.5 },
      rent: { on: false, value: -8000 },
    },
  };
  const again = normalizeProjections(JSON.parse(JSON.stringify(saved)));
  assert.equal(again.scenario, 'Aggressive');
  assert.equal(again.levers.price.value, 7.5);
  assert.equal(again.levers.price.on, true);
  assert.equal(again.levers.rent.on, false);
  assert.equal(again.levers.rent.value, -8000);
  assert.equal(again.levers.growth.value, 10);
  assert.equal(again.levers.gm.on, true);
  assert.equal(isScenarioEdited(again), true);
  assert.equal(clampLever('price', 40), 12);
  assert.equal(clampLever('rent', -90000), -60000);
});

test('compare uses presets for the other scenarios and edits on the open one', () => {
  const base = projectionBaseline(sampleHvacState());
  const edited = normalizeProjections({
    scenario: 'Base',
    levers: { ...defaultProjections().levers, price: { on: true, value: 8 } },
  });
  const cols = compareScenarios(base, edited);
  assert.deepEqual(cols.map(c => c.name), ['Conservative', 'Base', 'Aggressive']);
  assert.equal(cols[1].edited, true);
  assert.equal(cols[0].edited, false);
  const basePreset = project(base, SCENARIO_PRESETS.Base)[3];
  const conservative = project(base, SCENARIO_PRESETS.Conservative)[3];
  assert.equal(round(cols[0].sde), round(conservative.sde));
  assert.notEqual(round(cols[1].sde), round(basePreset.sde));
  assert.equal(fmtMoney(-12000), '−$12,000');
  assert.equal(fmtMoney(480000), '$480,000');
});
