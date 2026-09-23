/**
 * Annual Success Plans persistence.
 *
 * Access: any signed-in portal user can read and edit plans and company
 * strategy. The users table only distinguishes admin vs advisor, and
 * leadership (Chad, Lance, Lee, Michael) is not all in the admin role.
 * That matches the other internal broker tools (Deal Marketing, Commission
 * Calc), which are not admin-gated. Documented on the route as well.
 */

const { v4: uuidv4 } = require('uuid');
const { getDb } = require('./database');
const { calcWtf, rollupPlans } = require('../shared/wtfMath.mjs');

const STATUSES = new Set(['', 'not_started', 'in_progress', 'done', 'blocked']);
const ID_RE = /^[A-Za-z0-9_-]{1,80}$/;

function bad(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

function cleanText(value, max) {
  if (value == null) return '';
  return String(value).trim().slice(0, max);
}

function cleanMoney(value, field) {
  if (value === '' || value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 1e12) throw bad(`${field} must be a non-negative number`);
  return Math.round(n * 100) / 100;
}

function cleanCount(value, field) {
  if (value === '' || value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 1e7) throw bad(`${field} must be a non-negative number`);
  return Math.round(n * 100) / 100;
}

function cleanRate(value, field) {
  if (value === '' || value == null) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 1) throw bad(`${field} must be between 0 and 1`);
  return n;
}

function parseYear(value) {
  const year = Number(value);
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw bad('Year must be between 2000 and 2100');
  return year;
}

function assertId(id) {
  if (!id) return null;
  const text = String(id);
  if (!ID_RE.test(text)) throw bad('Invalid id');
  return text;
}

function listYears(db) {
  return db.prepare('SELECT year FROM success_plan_company ORDER BY year').all().map((row) => row.year);
}

function latestYear(db) {
  const row = db.prepare('SELECT year FROM success_plan_company ORDER BY year DESC LIMIT 1').get();
  return row ? row.year : null;
}

function priorityRow(row) {
  return {
    id: row.id,
    body: row.body,
    owner_name: row.owner_name || '',
    ladders_to: row.ladders_to || '',
    company_priority_id: row.company_priority_id || null,
    due_date: row.due_date || '',
    status: row.status || '',
    sort_order: row.sort_order,
  };
}

function getYearView(yearInput) {
  const db = getDb();
  const years = listYears(db);
  if (!years.length) return null;
  const year = yearInput == null || yearInput === '' ? years[years.length - 1] : parseYear(yearInput);
  const company = db.prepare('SELECT * FROM success_plan_company WHERE year = ?').get(year);
  if (!company) return null;

  const goals = db.prepare(`
    SELECT goal_year, gci_target, ebitda_target, sort_order
    FROM success_plan_five_year WHERE plan_year = ? ORDER BY sort_order, goal_year
  `).all(year);
  const allPriorities = db.prepare(`
    SELECT * FROM success_plan_priorities WHERE year = ? ORDER BY sort_order, id
  `).all(year);
  const people = db.prepare('SELECT * FROM success_plan_people ORDER BY sort_order, name').all();
  const plans = db.prepare('SELECT * FROM success_plans WHERE year = ?').all(year);
  const planByPerson = new Map(plans.map((plan) => [plan.person_id, plan]));

  const active = people.filter((person) => person.active);
  const rolled = rollupPlans(active.map((person) => {
    const plan = planByPerson.get(person.id) || {};
    return {
      id: person.id,
      personalIncome: plan.personal_income_target,
      split: plan.commission_split,
      avgDealSize: plan.avg_deal_size,
      commissionRate: plan.commission_rate,
      closeRatio: plan.close_ratio,
    };
  }));
  const calcById = new Map(rolled.rows.map((row) => [row.id, row]));

  function shape(person) {
    const plan = planByPerson.get(person.id) || {};
    const calc = calcById.get(person.id) || calcWtf({
      personalIncome: plan.personal_income_target,
      split: plan.commission_split,
      avgDealSize: plan.avg_deal_size,
      commissionRate: plan.commission_rate,
      closeRatio: plan.close_ratio,
    });
    const income = Number(plan.personal_income_target) || 0;
    const team = rolled.kpis.teamCommittedGciIncome;
    return {
      id: person.id,
      name: person.name,
      role: person.role || '',
      active: person.active ? 1 : 0,
      sort_order: person.sort_order,
      commission_split: plan.commission_split ?? null,
      personal_income_target: plan.personal_income_target ?? null,
      avg_deal_size: plan.avg_deal_size ?? null,
      commission_rate: plan.commission_rate ?? null,
      close_ratio: plan.close_ratio ?? null,
      dealmaker_edge: plan.dealmaker_edge || '',
      stop_delegate: plan.stop_delegate || '',
      notes: plan.notes || '',
      actual_gci: plan.actual_gci ?? null,
      deals_closed: plan.deals_closed ?? null,
      active_pipeline: plan.active_pipeline ?? null,
      updated_at: plan.updated_at || null,
      updated_by: plan.updated_by || null,
      gross_production: calc.grossProduction || 0,
      deals_to_close: calc.dealsToClose || 0,
      pipeline_commission: calc.pipelineCommission || 0,
      pipeline_deal_volume: calc.pipelineDealVolume || 0,
      engagements_needed: calc.engagementsNeeded || 0,
      pct_of_team: person.active && team ? income / team : 0,
      priorities: allPriorities.filter((row) => row.person_id === person.id).map(priorityRow),
    };
  }

  return {
    year,
    years,
    company: {
      year,
      vision: company.vision || '',
      mission: company.mission || '',
      deal_values: company.deal_values || '',
      wtf_number: company.wtf_number || '',
      updated_at: company.updated_at || null,
      updated_by: company.updated_by || null,
      priorities: allPriorities.filter((row) => row.person_id == null).map(priorityRow),
      five_year_goals: goals.map((goal) => ({
        goal_year: goal.goal_year,
        gci_target: goal.gci_target ?? null,
        ebitda_target: goal.ebitda_target ?? null,
      })),
    },
    kpis: {
      team_committed_gci_income: rolled.kpis.teamCommittedGciIncome,
      gross_production_required: rolled.kpis.grossProductionRequired,
      deals_to_close: rolled.kpis.dealsToClose,
      pipeline_commission: rolled.kpis.pipelineCommission,
      pipeline_deal_volume: rolled.kpis.pipelineDealVolume,
      engagements_needed: rolled.kpis.engagementsNeeded,
    },
    people: active.map(shape),
    inactive: people.filter((person) => !person.active).map(shape),
  };
}

function normalizePriorities(list, { company }) {
  if (list == null) return [];
  if (!Array.isArray(list)) throw bad('priorities must be an array');
  const cleaned = [];
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') throw bad('Invalid priority');
    const body = cleanText(raw.body, 500);
    const ownerName = cleanText(raw.owner_name, 120);
    const laddersTo = cleanText(raw.ladders_to, 200);
    const dueDate = raw.due_date == null ? '' : String(raw.due_date).trim();
    const status = raw.status == null ? '' : String(raw.status).trim();
    const companyPriorityId = raw.company_priority_id ? assertId(raw.company_priority_id) : null;
    const id = raw.id ? assertId(raw.id) : null;
    const hasAny = body || ownerName || laddersTo || dueDate || status || companyPriorityId;
    if (!hasAny) continue;
    if (!body) throw bad('Each priority needs text');
    if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) throw bad('Due date must be YYYY-MM-DD');
    if (!STATUSES.has(status)) throw bad('Invalid priority status');
    cleaned.push({
      id,
      body,
      owner_name: company ? ownerName : '',
      ladders_to: company ? laddersTo : '',
      company_priority_id: company ? null : companyPriorityId,
      due_date: dueDate || null,
      status,
    });
  }
  if (cleaned.length > 5) throw bad('At most 5 priorities');
  return cleaned;
}

function replacePriorities(db, { year, personId, priorities }) {
  const existing = db.prepare(`
    SELECT id FROM success_plan_priorities
    WHERE year = ? AND ((? IS NULL AND person_id IS NULL) OR person_id = ?)
  `).all(year, personId, personId);
  const existingIds = new Set(existing.map((row) => row.id));
  const keep = [];

  const update = db.prepare(`
    UPDATE success_plan_priorities
    SET sort_order = ?, body = ?, owner_name = ?, ladders_to = ?, company_priority_id = ?, due_date = ?, status = ?
    WHERE id = ?
  `);
  const insert = db.prepare(`
    INSERT INTO success_plan_priorities (
      id, year, person_id, sort_order, body, owner_name, ladders_to, company_priority_id, due_date, status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  priorities.forEach((priority, index) => {
    let id = priority.id;
    if (id && !existingIds.has(id)) {
      const taken = db.prepare('SELECT id, year, person_id FROM success_plan_priorities WHERE id = ?').get(id);
      if (taken) throw bad('Priority id belongs to another plan');
    }
    if (!id || !existingIds.has(id)) {
      id = id && !existingIds.has(id) ? id : uuidv4();
      const taken = db.prepare('SELECT id FROM success_plan_priorities WHERE id = ?').get(id);
      if (taken) id = uuidv4();
      insert.run(
        id, year, personId, index, priority.body, priority.owner_name, priority.ladders_to,
        priority.company_priority_id, priority.due_date, priority.status,
      );
    } else {
      update.run(
        index, priority.body, priority.owner_name, priority.ladders_to,
        priority.company_priority_id, priority.due_date, priority.status, id,
      );
    }
    keep.push(id);
  });

  const remove = db.prepare('DELETE FROM success_plan_priorities WHERE id = ?');
  for (const row of existing) {
    if (!keep.includes(row.id)) remove.run(row.id);
  }
}

function saveCompany(body, user) {
  const db = getDb();
  const year = parseYear(body.year);
  const current = db.prepare('SELECT year FROM success_plan_company WHERE year = ?').get(year);
  if (!current) throw Object.assign(new Error('Plan year not found'), { status: 404 });

  const vision = cleanText(body.vision, 2000);
  const mission = cleanText(body.mission, 2000);
  const dealValues = cleanText(body.deal_values, 1000);
  const wtfNumber = cleanText(body.wtf_number, 200);
  const priorities = normalizePriorities(body.priorities, { company: true });
  const goals = normalizeGoals(body.five_year_goals);
  const now = new Date().toISOString();
  const who = user?.display_name || 'Team';

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE success_plan_company
      SET vision = ?, mission = ?, deal_values = ?, wtf_number = ?, updated_at = ?, updated_by = ?
      WHERE year = ?
    `).run(vision, mission, dealValues, wtfNumber, now, who, year);

    db.prepare('DELETE FROM success_plan_five_year WHERE plan_year = ?').run(year);
    const insertGoal = db.prepare(`
      INSERT INTO success_plan_five_year (id, plan_year, goal_year, gci_target, ebitda_target, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    goals.forEach((goal, index) => {
      insertGoal.run(uuidv4(), year, goal.goal_year, goal.gci_target, goal.ebitda_target, index);
    });
    replacePriorities(db, { year, personId: null, priorities });
  });
  tx();
  return getYearView(year);
}

function normalizeGoals(list) {
  if (list == null) return [];
  if (!Array.isArray(list)) throw bad('five_year_goals must be an array');
  if (list.length > 8) throw bad('At most 8 five-year rows');
  const seen = new Set();
  return list.map((raw) => {
    if (!raw || typeof raw !== 'object') throw bad('Invalid five-year row');
    const goalYear = parseYear(raw.goal_year);
    if (seen.has(goalYear)) throw bad('Duplicate year in the five-year table');
    seen.add(goalYear);
    return {
      goal_year: goalYear,
      gci_target: cleanMoney(raw.gci_target, 'GCI target'),
      ebitda_target: cleanMoney(raw.ebitda_target, 'EBITDA target'),
    };
  });
}

function savePerson(personId, body, user) {
  const db = getDb();
  const id = assertId(personId);
  const person = db.prepare('SELECT * FROM success_plan_people WHERE id = ?').get(id);
  if (!person) throw Object.assign(new Error('Person not found'), { status: 404 });
  const year = parseYear(body.year);
  const company = db.prepare('SELECT year FROM success_plan_company WHERE year = ?').get(year);
  if (!company) throw Object.assign(new Error('Plan year not found'), { status: 404 });

  const name = cleanText(body.name, 120);
  const role = cleanText(body.role, 160);
  if (!name) throw bad('Name is required');

  const priorities = normalizePriorities(body.priorities, { company: false });
  const companyIds = new Set(
    db.prepare('SELECT id FROM success_plan_priorities WHERE year = ? AND person_id IS NULL').all(year).map((row) => row.id),
  );
  for (const priority of priorities) {
    if (priority.company_priority_id && !companyIds.has(priority.company_priority_id)) {
      throw bad('Linked company priority was not found for this year');
    }
  }

  const fields = {
    commission_split: cleanRate(body.commission_split, 'Commission split'),
    personal_income_target: cleanMoney(body.personal_income_target, 'Personal income target'),
    avg_deal_size: cleanMoney(body.avg_deal_size, 'Avg deal size'),
    commission_rate: cleanRate(body.commission_rate, 'Commission rate'),
    close_ratio: cleanRate(body.close_ratio, 'Close ratio'),
    dealmaker_edge: cleanText(body.dealmaker_edge, 2000),
    stop_delegate: cleanText(body.stop_delegate, 2000),
    notes: cleanText(body.notes, 4000),
    actual_gci: cleanMoney(body.actual_gci, 'Actual GCI'),
    deals_closed: cleanCount(body.deals_closed, 'Deals closed'),
    active_pipeline: cleanMoney(body.active_pipeline, 'Active pipeline'),
  };
  const now = new Date().toISOString();
  const who = user?.display_name || 'Team';

  const tx = db.transaction(() => {
    db.prepare(`
      UPDATE success_plan_people SET name = ?, role = ?, updated_at = ? WHERE id = ?
    `).run(name, role, now, id);

    const existing = db.prepare('SELECT id FROM success_plans WHERE person_id = ? AND year = ?').get(id, year);
    if (existing) {
      db.prepare(`
        UPDATE success_plans SET
          commission_split = @commission_split,
          personal_income_target = @personal_income_target,
          avg_deal_size = @avg_deal_size,
          commission_rate = @commission_rate,
          close_ratio = @close_ratio,
          dealmaker_edge = @dealmaker_edge,
          stop_delegate = @stop_delegate,
          notes = @notes,
          actual_gci = @actual_gci,
          deals_closed = @deals_closed,
          active_pipeline = @active_pipeline,
          updated_at = @updated_at,
          updated_by = @updated_by
        WHERE person_id = @person_id AND year = @year
      `).run({ ...fields, updated_at: now, updated_by: who, person_id: id, year });
    } else {
      db.prepare(`
        INSERT INTO success_plans (
          id, person_id, year, commission_split, personal_income_target, avg_deal_size,
          commission_rate, close_ratio, dealmaker_edge, stop_delegate, notes,
          actual_gci, deals_closed, active_pipeline, updated_at, updated_by
        ) VALUES (
          @id, @person_id, @year, @commission_split, @personal_income_target, @avg_deal_size,
          @commission_rate, @close_ratio, @dealmaker_edge, @stop_delegate, @notes,
          @actual_gci, @deals_closed, @active_pipeline, @updated_at, @updated_by
        )
      `).run({ id: uuidv4(), person_id: id, year, ...fields, updated_at: now, updated_by: who });
    }
    replacePriorities(db, { year, personId: id, priorities });
  });
  tx();
  return getYearView(year);
}

function addPerson(body, user) {
  const db = getDb();
  const year = parseYear(body.year);
  if (!db.prepare('SELECT year FROM success_plan_company WHERE year = ?').get(year)) {
    throw Object.assign(new Error('Plan year not found'), { status: 404 });
  }
  const name = cleanText(body.name, 120);
  const role = cleanText(body.role, 160);
  if (!name) throw bad('Name is required');
  const split = body.commission_split == null || body.commission_split === ''
    ? null
    : cleanRate(body.commission_split, 'Commission split');
  const now = new Date().toISOString();
  const who = user?.display_name || 'Team';
  const id = uuidv4();
  const sort = (db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS n FROM success_plan_people').get().n || 0) + 1;
  const years = listYears(db);

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO success_plan_people (id, name, role, sort_order, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, 1, ?, ?)
    `).run(id, name, role, sort, now, now);
    const insert = db.prepare(`
      INSERT INTO success_plans (
        id, person_id, year, commission_split, personal_income_target, avg_deal_size,
        commission_rate, close_ratio, dealmaker_edge, stop_delegate, notes,
        actual_gci, deals_closed, active_pipeline, updated_at, updated_by
      ) VALUES (?, ?, ?, ?, NULL, NULL, NULL, NULL, '', '', '', NULL, NULL, NULL, ?, ?)
    `);
    for (const planYear of years) {
      insert.run(uuidv4(), id, planYear, split, now, who);
    }
  });
  tx();
  return { id, view: getYearView(year) };
}

function setActive(personId, active, yearInput) {
  const db = getDb();
  const id = assertId(personId);
  const person = db.prepare('SELECT id FROM success_plan_people WHERE id = ?').get(id);
  if (!person) throw Object.assign(new Error('Person not found'), { status: 404 });
  const now = new Date().toISOString();
  db.prepare('UPDATE success_plan_people SET active = ?, updated_at = ? WHERE id = ?').run(active ? 1 : 0, now, id);
  return getYearView(yearInput);
}

function addYear(body, user) {
  const db = getDb();
  const year = parseYear(body.year);
  if (db.prepare('SELECT year FROM success_plan_company WHERE year = ?').get(year)) {
    throw Object.assign(new Error('That plan year already exists'), { status: 409 });
  }
  const sourceYear = latestYear(db);
  const source = sourceYear
    ? db.prepare('SELECT * FROM success_plan_company WHERE year = ?').get(sourceYear)
    : null;
  const now = new Date().toISOString();
  const who = user?.display_name || 'Team';
  const people = db.prepare('SELECT id FROM success_plan_people WHERE active = 1').all();

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO success_plan_company (year, vision, mission, deal_values, wtf_number, updated_at, updated_by)
      VALUES (?, ?, ?, ?, '', ?, ?)
    `).run(year, source?.vision || '', source?.mission || '', source?.deal_values || '', now, who);

    const insertGoal = db.prepare(`
      INSERT INTO success_plan_five_year (id, plan_year, goal_year, gci_target, ebitda_target, sort_order)
      VALUES (?, ?, ?, NULL, NULL, ?)
    `);
    for (let i = 0; i < 5; i += 1) insertGoal.run(uuidv4(), year, year + i, i);

    const insertPlan = db.prepare(`
      INSERT INTO success_plans (
        id, person_id, year, commission_split, personal_income_target, avg_deal_size,
        commission_rate, close_ratio, dealmaker_edge, stop_delegate, notes,
        actual_gci, deals_closed, active_pipeline, updated_at, updated_by
      ) VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, '', NULL, NULL, NULL, ?, ?)
    `);
    const sourcePlan = db.prepare('SELECT * FROM success_plans WHERE person_id = ? AND year = ?');
    for (const person of people) {
      const prior = sourceYear ? sourcePlan.get(person.id, sourceYear) : null;
      insertPlan.run(
        uuidv4(), person.id, year,
        prior?.commission_split ?? null,
        prior?.avg_deal_size ?? null,
        prior?.commission_rate ?? null,
        prior?.close_ratio ?? null,
        prior?.dealmaker_edge || '',
        prior?.stop_delegate || '',
        now, who,
      );
    }
  });
  tx();
  return getYearView(year);
}

module.exports = {
  getYearView,
  saveCompany,
  savePerson,
  addPerson,
  setActive,
  addYear,
  parseYear,
};
