/**
 * Seller projections for the Market Price Analyzer.
 *
 * Baseline earnings are the most recent year's SDE from calcSDE (the same
 * figure the Income Statement and Fair Market range use). The multiple is the
 * deal's fair-market multiple — market price ÷ the valuation SDE — or 3.0×
 * when no market price has been chosen, which is what Sources & Uses applies
 * by default. It is held constant across the three years.
 *
 * Operating levers follow the approved model: a price increase lifts revenue
 * with costs held, volume growth compounds, COGS scales with volume (not
 * price), operating expenses grow at half the volume rate, and the dollar
 * levers are a flat amount each year. Interest, taxes, depreciation,
 * amortization, owner comp, add-backs, other income, and the rent adjustment
 * stay in SDE as a fixed bridge so a year with no levers equals calcSDE.
 * Normalizing owner comp does not change SDE; it only changes Adj. EBITDA.
 */

import { pn, calcSDE, mostRecentYearData, fairMarketSde } from './sdeBasis.js';

export const LEVERS = [
  { id: 'price', name: 'Price increase', unit: '%', min: 0, max: 12, step: 0.5,
    help: 'Raises revenue with costs held. Applied from Year 1.' },
  { id: 'growth', name: 'Revenue growth per year', unit: '%/yr', min: 0, max: 20, step: 0.5,
    help: 'Volume growth. COGS scales with volume; opex grows at half the rate.' },
  { id: 'cogs', name: 'Cost of goods reduction', unit: 'pts', min: 0, max: 6, step: 0.25,
    help: base => `Lower COGS as % of revenue (baseline ${base && base.rev ? (base.cogs / base.rev * 100).toFixed(1) : '0.0'}%).` },
  { id: 'opex', name: 'Operating expense cuts', unit: '$', min: 0, max: 120000, step: 2500,
    help: 'Recurring annual savings, e.g. software, fleet, insurance.' },
  { id: 'ownerComp', name: 'Normalize owner comp to market', unit: '$', min: 60000, max: 200000, step: 5000,
    help: 'Market salary to replace the owner. SDE-neutral; shown as Adj. EBITDA for buyers.' },
  { id: 'gm', name: 'Hire a general manager', unit: '$', min: 50000, max: 150000, step: 5000,
    help: 'Fully loaded cost, subtracted from SDE. Frees the owner from day-to-day work.' },
  { id: 'rent', name: 'Rent change', unit: '$/yr', min: -60000, max: 60000, step: 2000,
    help: 'Negative = savings (renegotiate or move to market rent).' },
];

const leverById = Object.fromEntries(LEVERS.map(l => [l.id, l]));

function leverSetting(on, value) {
  return { on: !!on, value: Number(value) || 0 };
}

export const SCENARIO_NAMES = ['Conservative', 'Base', 'Aggressive'];

export const SCENARIO_PRESETS = {
  Conservative: {
    price: leverSetting(1, 2),
    growth: leverSetting(1, 3),
    cogs: leverSetting(1, 1),
    opex: leverSetting(1, 15000),
    ownerComp: leverSetting(0, 110000),
    gm: leverSetting(0, 85000),
    rent: leverSetting(0, 0),
  },
  Base: {
    price: leverSetting(1, 4),
    growth: leverSetting(1, 6),
    cogs: leverSetting(1, 2),
    opex: leverSetting(1, 30000),
    ownerComp: leverSetting(1, 110000),
    gm: leverSetting(0, 85000),
    rent: leverSetting(1, -12000),
  },
  Aggressive: {
    price: leverSetting(1, 6),
    growth: leverSetting(1, 10),
    cogs: leverSetting(1, 3.5),
    opex: leverSetting(1, 50000),
    ownerComp: leverSetting(1, 110000),
    gm: leverSetting(1, 85000),
    rent: leverSetting(1, -24000),
  },
};

export function cloneLevers(levers) {
  const next = {};
  for (const lever of LEVERS) {
    const src = levers?.[lever.id] || {};
    next[lever.id] = { on: !!src.on, value: Number(src.value) || 0 };
  }
  return next;
}

export function clampLever(id, value) {
  const lever = leverById[id];
  const n = Number(value);
  if (!lever || !Number.isFinite(n)) return lever ? lever.min : 0;
  return Math.min(lever.max, Math.max(lever.min, n));
}

export function defaultProjections() {
  return { scenario: 'Base', levers: cloneLevers(SCENARIO_PRESETS.Base) };
}

/**
 * Accept a missing or partial projections blob from an older deal.
 * Unknown scenarios fall back to Base. Missing levers fill from that preset.
 */
export function normalizeProjections(raw) {
  const scenario = raw && SCENARIO_NAMES.includes(raw.scenario) ? raw.scenario : 'Base';
  const preset = SCENARIO_PRESETS[scenario];
  const saved = raw && raw.levers && typeof raw.levers === 'object' ? raw.levers : null;
  const levers = {};
  for (const lever of LEVERS) {
    const fromDeal = saved && saved[lever.id] && typeof saved[lever.id] === 'object' ? saved[lever.id] : null;
    const base = preset[lever.id];
    const on = fromDeal && typeof fromDeal.on === 'boolean' ? fromDeal.on : base.on;
    const value = fromDeal && Number.isFinite(Number(fromDeal.value)) ? Number(fromDeal.value) : base.value;
    levers[lever.id] = { on, value: clampLever(lever.id, value) };
  }
  return { scenario, levers };
}

export function isScenarioEdited(projections) {
  const view = projections?.levers ? projections : normalizeProjections(projections);
  const preset = SCENARIO_PRESETS[view.scenario] || SCENARIO_PRESETS.Base;
  return LEVERS.some(lever => {
    const a = view.levers[lever.id];
    const b = preset[lever.id];
    return !!a.on !== !!b.on || Math.abs(Number(a.value) - Number(b.value)) > 1e-9;
  });
}

/**
 * Fair-market multiple already used by the analyzer.
 * Selected market price ÷ valuation SDE when both exist; otherwise 3.0×,
 * the multiple Sources & Uses writes when the market price is still empty.
 */
export function fairMarketMultiple(state) {
  const basisKey = state?.sdeBasis === 'weighted' ? 'weighted' : 'recent';
  const basisSde = fairMarketSde(state?.years, basisKey);
  const marketPrice = pn(state?.su?.marketPrice);
  if (marketPrice > 0 && basisSde > 0) {
    return { multiple: marketPrice / basisSde, source: 'market', basisKey, basisSde };
  }
  return { multiple: 3, source: 'default', basisKey, basisSde };
}

export function projectionBaseline(state) {
  const year = mostRecentYearData(state?.years);
  if (!year) return null;
  const c = calcSDE(year);
  if (!c.rev && !c.sde) return null;
  const mult = fairMarketMultiple(state);
  const labels = (year.addBacks || [])
    .filter(a => pn(a.amount) && String(a.label || '').trim())
    .map(a => String(a.label).trim());
  const bridge = c.otherInc + c.int + c.taxes + c.dep + c.amor + c.oc + c.ab + c.rentAB;
  return {
    year: year.year,
    rev: c.rev,
    cogs: c.cogs,
    opx: c.opx,
    otherInc: c.otherInc,
    int: c.int,
    taxes: c.taxes,
    dep: c.dep,
    amor: c.amor,
    oc: c.oc,
    ab: c.ab,
    rentAB: c.rentAB,
    bridge,
    sde: c.sde,
    multiple: mult.multiple,
    multipleSource: mult.source,
    basisKey: mult.basisKey,
    basisSde: mult.basisSde,
    addBackNote: labels.join(', '),
  };
}

function rowFrom(base, rev, cogs, opx, levers) {
  const gp = rev - cogs;
  const sde = rev - cogs - opx + base.bridge;
  const marketOc = levers?.ownerComp?.on ? (Number(levers.ownerComp.value) || 0) : base.oc;
  return { rev, cogs, gp, opx, sde, adj: sde - marketOc, val: sde * base.multiple };
}

/** Four rows: today, then years 1–3. Today ignores levers so it stays the baseline. */
export function project(base, levers) {
  if (!base) return [];
  const on = id => (levers?.[id]?.on ? (Number(levers[id].value) || 0) : 0);
  const price = on('price') / 100;
  const gr = on('growth') / 100;
  const cogsPts = on('cogs') / 100;
  const opexCut = on('opex');
  const gm = on('gm');
  const rent = on('rent');
  const cogsPct = base.rev > 0 ? Math.max(0, base.cogs / base.rev - cogsPts) : 0;
  const rows = [rowFrom(base, base.rev, base.cogs, base.opx, levers)];
  for (let t = 1; t <= 3; t++) {
    const vol = base.rev * Math.pow(1 + gr, t);
    const rev = vol * (1 + price);
    const cogs = vol * cogsPct;
    const opx = base.opx * Math.pow(1 + gr / 2, t) - opexCut + gm + rent;
    rows.push(rowFrom(base, rev, cogs, opx, levers));
  }
  return rows;
}

export function leverImpacts(base, levers) {
  let running = {};
  for (const lever of LEVERS) running[lever.id] = { on: false, value: 0 };
  let prev = project(base, running)[3].sde;
  return LEVERS.map((lever, index) => {
    const current = levers?.[lever.id] || { on: false, value: 0 };
    running = {
      ...running,
      [lever.id]: { on: !!current.on, value: Number(current.value) || 0 },
    };
    const now = project(base, running)[3].sde;
    const delta = now - prev;
    prev = now;
    return { id: lever.id, name: lever.name, on: !!current.on, delta, index };
  });
}

export function rankedImpacts(base, levers) {
  return leverImpacts(base, levers)
    .slice()
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.index - b.index);
}

/** Year 3 of each named scenario. The open scenario keeps the advisor's edits. */
export function compareScenarios(base, projections) {
  const view = normalizeProjections(projections);
  return SCENARIO_NAMES.map(name => {
    const levers = name === view.scenario ? view.levers : SCENARIO_PRESETS[name];
    const y3 = project(base, levers)[3];
    return {
      name,
      edited: name === view.scenario && isScenarioEdited(view),
      rev: y3.rev,
      sde: y3.sde,
      val: y3.val,
    };
  });
}

export function fmtMoney(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '$0';
  const rounded = Math.round(v);
  const s = Math.abs(rounded).toLocaleString('en-US');
  return rounded < 0 ? `−$${s}` : `$${s}`;
}

export function fmtSigned(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || Math.round(v) === 0) return '$0';
  const rounded = Math.round(v);
  const s = Math.abs(rounded).toLocaleString('en-US');
  return rounded < 0 ? `−$${s}` : `+$${s}`;
}

export function fmtCompact(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '$0';
  const sign = v < 0 ? '−' : '';
  const a = Math.abs(v);
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(2)}M`;
  if (a >= 1000) return `${sign}$${Math.round(a / 1000)}k`;
  return `${sign}$${Math.round(a)}`;
}

export function fmtLever(id, value) {
  const lever = leverById[id];
  const v = Number(value) || 0;
  if (!lever) return String(v);
  if (lever.unit === '%') return `${v.toFixed(1)}%`;
  if (lever.unit === '%/yr') return `${v.toFixed(1)}% / yr`;
  if (lever.unit === 'pts') return `${v.toFixed(2)} pts`;
  if (id === 'rent') return `${fmtSigned(v)}/yr`;
  return fmtMoney(v);
}

export function fmtMultiple(multiple) {
  const n = Number(multiple);
  if (!Number.isFinite(n)) return '—';
  return `${n.toFixed(2)}×`;
}

/** Sample deal whose most recent year matches the approved projections mock. */
export function sampleHvacState() {
  return {
    dealName: 'Sample Co. HVAC Services',
    advisorName: 'Example Advisor',
    sdeBasis: 'recent',
    years: [
      { year: 2023, entityType: '1120-S', revenue: 2000000, cogs: 900000, opx: 800000, ownerComp: 140000, addBacks: [] },
      { year: 2024, entityType: '1120-S', revenue: 2200000, cogs: 1000000, opx: 900000, ownerComp: 145000, addBacks: [] },
      {
        year: 2025,
        entityType: '1120-S',
        revenue: 2400000,
        cogs: 1104000,
        opx: 1020000,
        ownerComp: 150000,
        addBacks: [
          { label: 'Personal vehicle', amount: 36000 },
          { label: 'One-time legal', amount: 18000 },
        ],
      },
    ],
    su: { marketPrice: 1344000 },
  };
}
