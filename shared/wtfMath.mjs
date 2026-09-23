/**
 * WTF (Wealth / Time / Freedom) production math.
 * Same formulas as the 2027 Annual Success Plan workbook:
 *
 *   Gross = Personal Income / Split
 *   Deals to Close = ROUNDUP(Gross / (Avg Deal Size * Commission Rate))
 *   Engagement Pipeline (commission) = (Deals / Close Ratio) * (Avg Deal Size * Commission Rate)
 *   Target Engagement Pipeline (deal volume) = (Deals / Close Ratio) * Avg Deal Size
 *   Engagements Needed = ROUNDUP(Deals / Close Ratio)
 *
 * Divide-by-zero matches the sheet's IFERROR(..., 0).
 */

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function roundMoney(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Excel ROUNDUP for non-negative numbers, tolerant of binary float noise. */
function roundUp(n) {
  if (!Number.isFinite(n) || n <= 0) return 0;
  const nearest = Math.round(n);
  if (Math.abs(n - nearest) < 1e-6) return nearest;
  return Math.ceil(n - 1e-8);
}

function safeDiv(a, b) {
  if (!b) return 0;
  const n = a / b;
  return Number.isFinite(n) ? n : 0;
}

export function calcWtf(input = {}) {
  const income = num(input.personalIncome);
  const split = num(input.split);
  const deal = num(input.avgDealSize);
  const rate = num(input.commissionRate);
  const close = num(input.closeRatio);

  const grossProduction = roundMoney(safeDiv(income, split));
  const commissionPerDeal = roundMoney(deal * rate);
  const dealsToClose = roundUp(safeDiv(grossProduction, commissionPerDeal));
  const perClose = safeDiv(dealsToClose, close);

  return {
    grossProduction,
    dealsToClose,
    pipelineCommission: roundMoney(perClose * commissionPerDeal),
    pipelineDealVolume: roundMoney(perClose * deal),
    engagementsNeeded: roundUp(perClose),
  };
}

export function rollupPlans(plans) {
  const rows = (plans || []).map((plan) => ({ ...plan, ...calcWtf(plan) }));
  const kpis = {
    teamCommittedGciIncome: 0,
    grossProductionRequired: 0,
    dealsToClose: 0,
    pipelineCommission: 0,
    pipelineDealVolume: 0,
    engagementsNeeded: 0,
  };

  for (const row of rows) {
    kpis.teamCommittedGciIncome += num(row.personalIncome);
    kpis.grossProductionRequired += row.grossProduction;
    kpis.dealsToClose += row.dealsToClose;
    kpis.pipelineCommission += row.pipelineCommission;
    kpis.pipelineDealVolume += row.pipelineDealVolume;
    kpis.engagementsNeeded += row.engagementsNeeded;
  }

  kpis.teamCommittedGciIncome = roundMoney(kpis.teamCommittedGciIncome);
  kpis.grossProductionRequired = roundMoney(kpis.grossProductionRequired);
  kpis.pipelineCommission = roundMoney(kpis.pipelineCommission);
  kpis.pipelineDealVolume = roundMoney(kpis.pipelineDealVolume);

  const team = kpis.teamCommittedGciIncome;
  for (const row of rows) {
    row.pctOfTeam = team ? num(row.personalIncome) / team : 0;
  }

  return { rows, kpis };
}
