import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  assumedCloseRatio,
  buildCompanyCockpit,
  pickLeaders,
  yearElapsedFraction,
} from './companyCockpit.js';

const kpis = {
  team_committed_gci_income: 5600000,
  deals_to_close: 68,
  pipeline_commission: 14800000,
  pipeline_deal_volume: 148000000,
  engagements_needed: 89,
};

function person(overrides) {
  return {
    id: 'p',
    name: 'Pat',
    role: 'Broker',
    personal_income_target: null,
    actual_gci: null,
    deals_closed: null,
    active_pipeline: null,
    engagements_needed: 0,
    deals_to_close: 0,
    close_ratio: null,
    ...overrides,
  };
}

test('year fraction is 0 before the plan year and 1 after it', () => {
  assert.equal(yearElapsedFraction(2027, new Date(2026, 8, 23)), 0);
  assert.equal(yearElapsedFraction(2027, new Date(2028, 0, 1)), 1);
  const mid = yearElapsedFraction(2027, new Date(2027, 6, 2, 12));
  assert.ok(mid > 0.45 && mid < 0.6, `expected mid-year, got ${mid}`);
});

test('empty actuals rest at zero and targets come from the WTF rollup', () => {
  const people = [
    person({ id: 'david', name: 'David P.', personal_income_target: 1000000, engagements_needed: 13, close_ratio: 0.8, deals_to_close: 10 }),
    person({ id: 'jamie', name: 'Jamie', personal_income_target: 1000000, engagements_needed: 9, close_ratio: 0.8, deals_to_close: 7 }),
    person({ id: 'robin', name: 'Robin McIntire', role: 'Sr. Acquisition Advisor', personal_income_target: 1000000, engagements_needed: 9, close_ratio: 0.8, deals_to_close: 7 }),
    person({ id: 'mark', name: 'Mark', personal_income_target: 300000, engagements_needed: 5, close_ratio: 0.6, deals_to_close: 3 }),
    person({ id: 'chad', name: 'Chad Peterson', role: 'Founder & CEO', close_ratio: 0.2 }),
  ];
  const cockpit = buildCompanyCockpit({
    year: 2027,
    people,
    kpis,
    now: new Date(2026, 8, 23),
  });

  assert.deepEqual(cockpit.engagements, { actual: 0, target: 89, tracked: false });
  assert.equal(cockpit.pipeline.actual, 0);
  assert.equal(cockpit.pipeline.target, 14800000);
  assert.equal(cockpit.pipeline.dealVolumeTarget, 148000000);
  assert.deepEqual(cockpit.gci, { actual: 0, target: 5600000 });
  assert.deepEqual(cockpit.deals, { actual: 0, target: 68 });
  assert.equal(cockpit.pace.elapsed, 0);
  assert.equal(cockpit.pace.goal, 0);
  assert.equal(cockpit.pace.code, 'not_started');
  assert.equal(cockpit.closeRatio.implied, null);
  assert.equal(cockpit.roster.withPlan, 5);
  assert.equal(cockpit.roster.withIncomeTarget, 4);
  assert.equal(cockpit.leader.basis, 'income_target');
  assert.equal(cockpit.leader.tied, true);
  assert.deepEqual(cockpit.leader.leaders.map((row) => row.name), ['David P.', 'Jamie', 'Robin McIntire']);
});

test('assumed close ratio is weighted by engagements needed', () => {
  const ratio = assumedCloseRatio([
    person({ engagements_needed: 84, close_ratio: 0.8 }),
    person({ engagements_needed: 5, close_ratio: 0.6 }),
    person({ engagements_needed: 0, close_ratio: 0.2 }),
  ]);
  assert.ok(Math.abs(ratio - (70.2 / 89)) < 1e-12);
  assert.equal(assumedCloseRatio([]), null);
});

test('GCI actual outranks a larger income target, then deals closed', () => {
  const booked = pickLeaders([
    person({ id: 'a', name: 'Alex', personal_income_target: 900000, actual_gci: 10000 }),
    person({ id: 'b', name: 'Blair', personal_income_target: 2000000, actual_gci: null }),
  ]);
  assert.equal(booked.basis, 'gci_actual');
  assert.equal(booked.leaders[0].name, 'Alex');
  assert.equal(booked.tied, false);

  const closers = pickLeaders([
    person({ id: 'a', name: 'Alex', personal_income_target: 900000, deals_closed: 2 }),
    person({ id: 'b', name: 'Blair', personal_income_target: 2000000, deals_closed: 5 }),
  ]);
  assert.equal(closers.basis, 'deals_closed');
  assert.equal(closers.leaders[0].name, 'Blair');
  assert.equal(closers.leaders[0].value, 5);
});

test('pace compares percent of goal with percent of the year', () => {
  const people = [person({ id: 'a', name: 'Alex', personal_income_target: 100, actual_gci: 80 })];
  const ahead = buildCompanyCockpit({
    year: 2027,
    people,
    kpis: { ...kpis, team_committed_gci_income: 100 },
    now: new Date(2027, 2, 1),
  });
  assert.equal(ahead.pace.code, 'ahead');
  assert.equal(ahead.gci.actual, 80);
  assert.ok(ahead.pace.elapsed < 0.3);

  const met = buildCompanyCockpit({
    year: 2027,
    people: [person({ actual_gci: 100 })],
    kpis: { ...kpis, team_committed_gci_income: 100 },
    now: new Date(2027, 3, 1),
  });
  assert.equal(met.pace.code, 'met');

  const behind = buildCompanyCockpit({
    year: 2027,
    people: [person({ actual_gci: 0 })],
    kpis: { ...kpis, team_committed_gci_income: 100 },
    now: new Date(2027, 8, 1),
  });
  assert.equal(behind.pace.code, 'behind');

  const none = buildCompanyCockpit({
    year: 2027,
    people: [],
    kpis: { ...kpis, team_committed_gci_income: 0 },
    now: new Date(2027, 6, 1),
  });
  assert.equal(none.pace.code, 'no_target');
  assert.equal(none.pace.goal, null);
  assert.equal(none.leader.basis, 'none');
  assert.equal(none.roster.withPlan, 0);
});

test('pipeline and deals sum the manual YTD fields', () => {
  const cockpit = buildCompanyCockpit({
    year: 2027,
    people: [
      person({ active_pipeline: 250000, deals_closed: 1, actual_gci: 40000 }),
      person({ active_pipeline: null, deals_closed: 2.2, actual_gci: 10000 }),
    ],
    kpis,
    now: new Date(2027, 5, 1),
  });
  assert.equal(cockpit.pipeline.actual, 250000);
  assert.equal(cockpit.deals.actual, 3.2);
  assert.equal(cockpit.gci.actual, 50000);
  assert.equal(cockpit.engagements.actual, 0);
  assert.equal(cockpit.leader.basis, 'gci_actual');
});
