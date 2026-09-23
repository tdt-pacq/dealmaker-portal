const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const dbFile = path.join(os.tmpdir(), `pacq-success-plans-${process.pid}.db`);
for (const suffix of ['', '-shm', '-wal']) {
  try { fs.unlinkSync(dbFile + suffix); } catch (_) { /* fresh file */ }
}
process.env.DB_PATH = dbFile;
process.env.NODE_ENV = 'test';

const { seedSuccessPlans } = require('./successPlanSeed');
const store = require('./successPlanStore');

test('2027 seed matches workbook targets and edits roll forward', () => {
  const seeded = seedSuccessPlans();
  assert.equal(seeded.seeded, true);
  assert.equal(seedSuccessPlans().seeded, false);

  const view = store.getYearView(2027);
  assert.deepEqual(view.years, [2027]);
  assert.equal(view.kpis.team_committed_gci_income, 5600000);
  assert.equal(view.kpis.gross_production_required, 11200000);
  assert.equal(view.kpis.deals_to_close, 68);
  assert.equal(view.kpis.pipeline_commission, 14800000);
  assert.equal(view.kpis.pipeline_deal_volume, 148000000);
  assert.match(view.company.vision, /#1 SBA acquisition deal team/);
  assert.match(view.company.deal_values, /Dominate with Discipline/);
  assert.equal(view.company.wtf_number, '');
  assert.equal(view.company.five_year_goals.length, 5);
  assert.deepEqual(view.company.five_year_goals.map((g) => g.goal_year), [2027, 2028, 2029, 2030, 2031]);
  assert.ok(view.company.five_year_goals.every((g) => g.gci_target == null && g.ebitda_target == null));

  const byName = Object.fromEntries(view.people.map((p) => [p.name, p]));
  assert.equal(byName['Robin McIntire'].personal_income_target, 1000000);
  assert.equal(byName['Robin McIntire'].gross_production, 2000000);
  assert.equal(byName['Robin McIntire'].deals_to_close, 7);
  assert.equal(byName['Robin McIntire'].engagements_needed, 9);
  assert.equal(byName['Betty Gales'].personal_income_target, 500000);
  assert.equal(byName['Betty Gales'].deals_to_close, 12);
  assert.equal(byName['Tim Moses'].personal_income_target, 300000);
  assert.equal(byName['Tim Moses'].gross_production, 600000);
  assert.equal(byName['Tim Moses'].role, 'Broker');
  assert.deepEqual(byName['Tim Moses'].priorities.map((p) => p.body), [
    'Lead generation', 'Broker training', "SOP's - for Tim",
  ]);
  assert.equal(byName['Fred'].priorities.length, 5);
  assert.equal(byName['David P.'].dealmaker_edge, 'Responsive; getting new business');
  assert.equal(byName['Chad Peterson'].personal_income_target, null);
  assert.equal(byName['Chad Peterson'].gross_production, 0);
  assert.equal(byName['Ken Ernewein'].commission_split, 0.425);
  assert.equal(view.people.length, 17);

  const robin = byName['Robin McIntire'];
  const edited = store.savePerson(robin.id, {
    ...robin,
    year: 2027,
    personal_income_target: 1100000,
  }, { display_name: 'Michael' });
  const robin2 = edited.people.find((p) => p.id === robin.id);
  assert.equal(robin2.personal_income_target, 1100000);
  assert.equal(robin2.gross_production, 2200000);
  assert.equal(robin2.updated_by, 'Michael');
  assert.equal(edited.kpis.team_committed_gci_income, 5700000);

  const withPriority = store.saveCompany({
    ...edited.company,
    year: 2027,
    wtf_number: '$14.8M commission pipeline',
    priorities: [{ body: 'Fill the producer roster', owner_name: 'Lance', status: 'in_progress' }],
  }, { display_name: 'Lance' });
  assert.equal(withPriority.company.wtf_number, '$14.8M commission pipeline');
  assert.equal(withPriority.company.priorities.length, 1);
  assert.equal(withPriority.company.priorities[0].owner_name, 'Lance');

  const linked = store.savePerson(robin.id, {
    ...robin2,
    year: 2027,
    personal_income_target: 1000000,
    priorities: [{
      body: 'Own seller meetings',
      company_priority_id: withPriority.company.priorities[0].id,
      status: 'not_started',
    }],
  }, { display_name: 'Michael' });
  const robin3 = linked.people.find((p) => p.id === robin.id);
  assert.equal(robin3.personal_income_target, 1000000);
  assert.equal(robin3.priorities[0].company_priority_id, withPriority.company.priorities[0].id);
  assert.equal(linked.kpis.team_committed_gci_income, 5600000);

  const added = store.addPerson({
    year: 2027, name: 'Alex Rivera', role: 'Broker', commission_split: 0.5,
  }, { display_name: 'Michael' });
  assert.ok(added.view.people.some((p) => p.name === 'Alex Rivera'));
  assert.equal(added.view.kpis.team_committed_gci_income, 5600000);

  const archived = store.setActive('betty', false);
  assert.equal(archived.kpis.team_committed_gci_income, 5100000);
  assert.ok(archived.inactive.some((p) => p.id === 'betty'));
  const restored = store.setActive('betty', true);
  assert.equal(restored.kpis.team_committed_gci_income, 5600000);

  assert.throws(() => store.savePerson(robin.id, {
    ...robin3, year: 2027, personal_income_target: -1,
  }, {}), /non-negative/);
});
