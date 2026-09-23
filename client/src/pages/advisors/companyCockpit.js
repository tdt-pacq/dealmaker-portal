/**
 * Company-cockpit rollup for Annual Success Plans.
 *
 * Targets come from the year view's WTF KPIs (same math as the roster).
 * Actuals are the manual YTD fields already stored on each plan:
 *   actual_gci, deals_closed, active_pipeline.
 * Signed engagements are not a field, so that actual stays 0.
 */

function num(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

function sumField(people, field) {
  return (people || []).reduce((total, person) => total + num(person?.[field]), 0);
}

/** Fraction of the calendar plan year that has passed. 0 before Jan 1, 1 after Dec 31. */
export function yearElapsedFraction(year, now = new Date()) {
  const y = Number(year);
  if (!Number.isInteger(y)) return 0;
  const start = new Date(y, 0, 1).getTime();
  const end = new Date(y + 1, 0, 1).getTime();
  const t = now instanceof Date ? now.getTime() : new Date(now).getTime();
  if (!Number.isFinite(t) || !(end > start)) return 0;
  if (t <= start) return 0;
  if (t >= end) return 1;
  return (t - start) / (end - start);
}

/**
 * Engagement-weighted average of the close ratios the plans assume.
 * People who do not need any engagements drop out so a default 20% on a
 * blank leadership tab does not drag the team number down.
 */
export function assumedCloseRatio(people) {
  let weight = 0;
  let weighted = 0;
  for (const person of people || []) {
    const w = num(person.engagements_needed);
    const ratio = Number(person.close_ratio);
    if (w <= 0 || !Number.isFinite(ratio) || ratio <= 0) continue;
    weight += w;
    weighted += ratio * w;
  }
  if (!weight) return null;
  return weighted / weight;
}

const BASIS = {
  gci_actual: 'GCI actual',
  deals_closed: 'Deals closed',
  income_target: 'GCI target',
};

function leaderSnapshot(person, value) {
  return {
    id: person.id,
    name: person.name || 'Unnamed',
    role: person.role || '',
    value,
    incomeTarget: num(person.personal_income_target),
    actualGci: num(person.actual_gci),
    dealsClosed: num(person.deals_closed),
    dealsToClose: num(person.deals_to_close),
  };
}

/**
 * Who is leading. Prefer any booked GCI. If nobody has booked GCI, use deals
 * closed. If those are empty too, fall back to the personal income target.
 */
export function pickLeaders(people) {
  const list = people || [];
  const anyGci = list.some((person) => num(person.actual_gci) > 0);
  const anyDeals = list.some((person) => num(person.deals_closed) > 0);
  const basis = anyGci ? 'gci_actual' : anyDeals ? 'deals_closed' : 'income_target';
  const field = basis === 'gci_actual'
    ? 'actual_gci'
    : basis === 'deals_closed'
      ? 'deals_closed'
      : 'personal_income_target';

  const ranked = list
    .map((person) => ({ person, value: num(person[field]) }))
    .filter((row) => row.value > 0)
    .sort((a, b) => b.value - a.value || a.person.name.localeCompare(b.person.name));

  if (!ranked.length) {
    return { basis: 'none', basisLabel: '', tied: false, value: 0, leaders: [] };
  }

  const value = ranked[0].value;
  const leaders = ranked
    .filter((row) => row.value === value)
    .map((row) => leaderSnapshot(row.person, row.value));

  return {
    basis,
    basisLabel: BASIS[basis],
    tied: leaders.length > 1,
    value,
    leaders,
  };
}

function paceStatus({ year, elapsed, goal, hasTarget }) {
  if (!hasTarget) return { code: 'no_target', label: 'No income target yet' };
  if (goal >= 1) return { code: 'met', label: 'Goal met' };
  if (elapsed <= 0) return { code: 'not_started', label: `${year} has not started` };
  if (elapsed >= 1) return { code: 'behind', label: 'Behind the clock' };
  if (goal >= elapsed + 0.02) return { code: 'ahead', label: 'Ahead of the clock' };
  if (goal <= elapsed - 0.02) return { code: 'behind', label: 'Behind the clock' };
  return { code: 'even', label: 'On pace' };
}

export function buildCompanyCockpit({ year, people = [], kpis = {}, now = new Date() } = {}) {
  const roster = people.length;
  const withIncomeTarget = people.filter((person) => num(person.personal_income_target) > 0).length;
  const gciTarget = num(kpis.team_committed_gci_income);
  const gciActual = sumField(people, 'actual_gci');
  const dealsTarget = num(kpis.deals_to_close);
  const dealsActual = sumField(people, 'deals_closed');
  const elapsed = yearElapsedFraction(year, now);
  const hasTarget = gciTarget > 0;
  const goal = hasTarget ? gciActual / gciTarget : null;
  const dealsClosed = dealsActual;

  return {
    year,
    engagements: {
      actual: 0,
      target: num(kpis.engagements_needed),
      tracked: false,
    },
    pipeline: {
      actual: sumField(people, 'active_pipeline'),
      target: num(kpis.pipeline_commission),
      dealVolumeTarget: num(kpis.pipeline_deal_volume),
    },
    gci: {
      actual: gciActual,
      target: gciTarget,
    },
    deals: {
      actual: dealsActual,
      target: dealsTarget,
    },
    pace: {
      elapsed,
      goal,
      ...paceStatus({ year, elapsed, goal: goal || 0, hasTarget }),
    },
    closeRatio: {
      assumed: assumedCloseRatio(people),
      implied: null,
      dealsClosed,
    },
    roster: {
      withPlan: roster,
      withIncomeTarget,
    },
    leader: pickLeaders(people),
  };
}
