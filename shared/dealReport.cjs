/**
 * Deal report figures for the Market Price Analyzer.
 * One calculation feeds the on-screen report and the PDF, so a section
 * cannot show a stale total or a different loan than the tab it claims to match.
 *
 * SDE helpers match client/src/pages/analyzer/sdeBasis.js. A parity test locks that.
 */

const pn = s => { const n = parseFloat(String(s ?? '').replace(/[$,]/g, '')); return Number.isNaN(n) ? 0 : n; };
const isPT = et => ['1120-S', '1065', 'Schedule C'].includes(et);

function calcSDE(yd) {
  const rev = pn(yd.revenue), cogs = pn(yd.cogs), opx = pn(yd.opx);
  const otherInc = pn(yd.otherIncome || 0);
  const int = pn(yd.interest), dep = pn(yd.depreciation), amor = pn(yd.amortization);
  const taxes = isPT(yd.entityType) ? 0 : pn(yd.taxes);
  const oc = pn(yd.ownerComp);
  const ab = (yd.addBacks || []).reduce((s, a) => s + pn(a.amount), 0);
  const rentAB = pn(yd.rent || 0) + pn(yd.rentAdj || 0);
  const gp = rev - cogs, noi = gp + otherInc - opx;
  const ebitda = noi + int + taxes + dep + amor;
  const adjE = ebitda + oc;
  const sde = adjE + ab + rentAB;
  return { rev, cogs, gp, opx, otherInc, noi, int, taxes, dep, amor, ebitda, oc, adjE, ab, rentAB, sde };
}

const isYtdYear = y => String(y?.year).toUpperCase() === 'YTD';
const yearNum = y => {
  if (isYtdYear(y)) return Infinity;
  const n = Number(y?.year);
  return Number.isFinite(n) ? n : -Infinity;
};
const sortedByYear = yrs => [...(yrs || [])].filter(y => !isYtdYear(y)).map((y, i) => ({ y, i })).sort((a, b) => {
  const d = yearNum(b.y) - yearNum(a.y);
  return d !== 0 ? d : b.i - a.i;
}).map(x => x.y);

function wtdSDE(yrs) {
  const s = sortedByYear(yrs).map(y => calcSDE(y).sde);
  if (!s.length) return 0;
  if (s.length === 1) return s[0];
  if (s.length === 2) return (s[0] * 2 + s[1] * 1) / 3;
  return (s[0] * 3 + s[1] * 2 + s[2] * 1) / 6;
}
function recentSDE(yrs) {
  for (const y of sortedByYear(yrs || [])) {
    if (pn(y.revenue) || calcSDE(y).sde) return calcSDE(y).sde;
  }
  return 0;
}
const fairMarketSde = (years, sdeBasis) => (
  sdeBasis === 'weighted' ? wtdSDE(years) : recentSDE(years)
);

function numOr(v, fallback) {
  if (v === '' || v == null) return fallback;
  const n = pn(v);
  return Number.isFinite(n) ? n : fallback;
}

function fmtMoney(n, digits = 0) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  const s = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return v < 0 ? `-$${s}` : `$${s}`;
}
function fmtParen(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return `(${fmtMoney(Math.abs(v))})`;
}
function fmtPct(n, digits = 1) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '—';
  return `${v.toFixed(digits)}%`;
}
function pctOf(part, whole, isRevenue) {
  if (isRevenue) return whole ? '100%' : '—';
  if (!whole) return '—';
  const n = part / whole * 100;
  return `${n < 0 ? '-' : ''}${Math.abs(n).toFixed(1)}%`;
}

function monthlyPayment(principal, annualRatePct, years) {
  const n = (years || 0) * 12;
  if (!(principal > 0) || !(n > 0)) return 0;
  const r = (annualRatePct / 100) / 12;
  if (r === 0) return principal / n;
  const pow = Math.pow(1 + r, n);
  return principal * r * pow / (pow - 1);
}

function remainingBalance(principal, annualRatePct, monthly, years) {
  if (!(principal > 0) || !(monthly > 0)) return 0;
  const r = (annualRatePct / 100) / 12;
  let bal = principal;
  const months = Math.round(years * 12);
  for (let m = 0; m < months; m++) {
    const interest = bal * r;
    bal -= (monthly - interest);
    if (bal <= 0) return 0;
  }
  return Math.max(0, bal);
}

function ytdMonths(through) {
  if (!through) return 0;
  const m = Number(String(through).split('-')[1]);
  return (m >= 1 && m <= 11) ? m : 0;
}

function annualizeYear(yd, months) {
  if (!months) return yd;
  const f = 12 / months;
  const sc = v => String(Math.round(pn(v) * f));
  return {
    ...yd,
    revenue: sc(yd.revenue), cogs: sc(yd.cogs), opx: sc(yd.opx),
    otherIncome: sc(yd.otherIncome || 0), interest: sc(yd.interest),
    taxes: sc(yd.taxes), depreciation: sc(yd.depreciation),
    amortization: sc(yd.amortization), ownerComp: sc(yd.ownerComp),
    addBacks: (yd.addBacks || []).map(ab => ({ ...ab, amount: sc(ab.amount) })),
    rent: sc(yd.rent || 0), rentAdj: sc(yd.rentAdj || 0),
  };
}

function sellerNote(su) {
  const amount = pn(su?.sellerFin);
  const rate = pn(su?.sfRate);
  const years = pn(su?.sfAmort);
  const monthly = (amount > 0 && rate > 0 && years > 0) ? monthlyPayment(amount, rate, years) : 0;
  return { amount, rate, years, monthly, annual: monthly * 12 };
}

function loanContext(state) {
  const su = state.su || {};
  const dpPct = numOr(state.dpPct, 10);
  const dp = dpPct / 100;
  const rate = numOr(state.loanRate, 10.75);
  const amort = numOr(state.loanAmort, 10);
  const reAmort = numOr(state.reAmort, 25);
  const re504Rate = numOr(state.re504Rate, 6.5);
  const structure = state.loanStructure || '7a';
  const reVal = pn(su.reVal);
  const marketPrice = pn(su.marketPrice);
  const wc = pn(su.wc);
  const arVal = pn(su.arVal);
  const invVal = pn(su.invVal);
  const totalProject = marketPrice + reVal + wc + arVal + invVal;
  const closing = (su.closing === '' || su.closing === undefined) ? 15000 : pn(su.closing);
  const baseLoan = totalProject * (1 - dp);
  const guaranteeFee = baseLoan * 0.75 * 0.035;
  const sbaLoan = baseLoan + guaranteeFee + closing;
  let blended = amort;
  if (!(structure === '504' && reVal > 0) && reVal > 0 && totalProject > 0) {
    blended = Math.min(25, Math.max(10, Math.round(
      (reVal / totalProject) * reAmort + ((totalProject - reVal) / totalProject) * amort
    )));
  }
  const ppLoan = pn(state.ppLoan);
  const ppMonthly = ppLoan > 0 ? monthlyPayment(ppLoan, numOr(state.ppRate, 7.5), numOr(state.ppAmort, 10)) : 0;
  return {
    dpPct, dp, rate, amort, reAmort, re504Rate, structure, reVal, marketPrice,
    wc, arVal, invVal, totalProject, closing, baseLoan, guaranteeFee, sbaLoan, blended,
    ppMonthly, ppLoan, sf: sellerNote(su),
    downPayment: totalProject * dp,
  };
}

function dealDebt(ctx) {
  if (!(ctx.totalProject > 0)) return null;
  let monthly;
  let termYears = ctx.amort;
  let detail;
  if (ctx.structure === '504' && ctx.reVal > 0) {
    const biz = monthlyPayment((ctx.totalProject - ctx.reVal) * (1 - ctx.dp) + ctx.guaranteeFee + ctx.closing, ctx.rate, ctx.amort);
    const re = monthlyPayment(ctx.reVal * (1 - ctx.dp), ctx.re504Rate, ctx.reAmort);
    monthly = biz + re + ctx.ppMonthly;
    detail = `7(a) at ${fmtPct(ctx.rate, 2)} / ${ctx.amort} years plus 504 at ${fmtPct(ctx.re504Rate, 2)} / ${ctx.reAmort} years. Guarantee fee and closing costs are financed in the 7(a) portion.`;
  } else {
    termYears = ctx.blended;
    monthly = monthlyPayment(ctx.sbaLoan, ctx.rate, termYears) + ctx.ppMonthly;
    detail = `${fmtPct(ctx.rate, 2)} / ${termYears} years. Guarantee fee and closing costs are financed in this loan.`;
  }
  const annual = monthly * 12 + ctx.sf.annual;
  return { monthly, annual, termYears, detail, loanAmount: ctx.sbaLoan };
}

function sizingDebt(ctx, afterSalary) {
  const price = afterSalary * 3;
  const loan = price * (1 - ctx.dp);
  const monthly = monthlyPayment(loan, ctx.rate, ctx.amort);
  const annual = monthly * 12 + ctx.sf.annual;
  return { price, loan, monthly, annual, rate: ctx.rate, years: ctx.amort, downPct: ctx.dpPct };
}

function monthlyAtPrice(ctx, price) {
  if (!(price > 0)) return ctx.ppMonthly;
  if (ctx.structure === '504' && ctx.reVal > 0) {
    const reComp = Math.min(ctx.reVal, price);
    const bizComp = price - reComp;
    return monthlyPayment(bizComp * (1 - ctx.dp), ctx.rate, ctx.amort)
      + monthlyPayment(reComp * (1 - ctx.dp), ctx.re504Rate, ctx.reAmort)
      + ctx.ppMonthly;
  }
  return monthlyPayment(price * (1 - ctx.dp), ctx.rate, ctx.blended) + ctx.ppMonthly;
}

function maxSupportablePrice(adjustedSde, dscrMin, priceToMonthly) {
  if (!(adjustedSde > 0) || !(dscrMin > 0)) return 0;
  let lo = 0, hi = 20000000, iters = 0;
  while (hi - lo > 100 && iters++ < 60) {
    const mid = (lo + hi) / 2;
    if (priceToMonthly(mid) * 12 < adjustedSde / dscrMin) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

const SPREAD_LINES = [
  ['Revenue', 'rev', false, false],
  ['COGS / Cost of Sales', 'cogs', false, false],
  ['Gross Profit', 'gp', true, false],
  ['Operating Expenses', 'opx', false, false],
  ['Net Operating Income', 'noi', true, false],
  ['+ Interest', 'int', false, false],
  ['+ Taxes', 'taxes', false, false],
  ['+ Depreciation', 'dep', false, false],
  ['+ Amortization', 'amor', false, false],
  ['EBITDA', 'ebitda', true, false],
  ["Owner's Compensation", 'oc', false, false],
  ['Adjusted EBITDA', 'adjE', true, false],
  ['Add-Backs', 'ab', false, false],
  ["Seller's Discretionary Earnings", 'sde', true, true],
];

function yearHasFigures(yd) {
  const c = calcSDE(yd);
  return ['rev', 'cogs', 'opx', 'otherInc', 'int', 'taxes', 'dep', 'amor', 'oc', 'ab', 'rentAB', 'sde']
    .some(k => c[k] !== 0);
}

function spreadCells(yd, annualized) {
  const empty = !yearHasFigures(yd);
  const c = calcSDE(yd);
  const a = annualized ? calcSDE(annualized) : null;
  return SPREAD_LINES.map(([label, key, bold, isSde]) => {
    const isRevenue = key === 'rev';
    if (empty) {
      return {
        label, bold, isSde,
        amount: '—', pct: '—',
        annAmount: a ? '—' : null,
        annPct: a ? '—' : null,
        raw: 0,
      };
    }
    return {
      label, bold, isSde,
      amount: fmtMoney(c[key]),
      pct: pctOf(c[key], c.rev, isRevenue),
      annAmount: a ? fmtMoney(a[key]) : null,
      annPct: a ? pctOf(a[key], a.rev, isRevenue) : null,
      raw: c[key],
    };
  });
}

function historicalGroups(years) {
  const groups = [];
  for (let i = 0; i < years.length; i += 3) {
    const slice = years.slice(i, i + 3);
    const rows = SPREAD_LINES.map((_, lineIdx) => {
      const cells = [];
      slice.forEach(yd => {
        const row = spreadCells(yd, null)[lineIdx];
        cells.push(row.amount, row.pct);
      });
      const sample = spreadCells(slice[0], null)[lineIdx];
      return { label: sample.label, bold: sample.bold, isSde: sample.isSde, cells };
    });
    groups.push({
      columns: slice.flatMap(yd => [String(yd.year), '% Rev']),
      rows,
    });
  }
  return groups;
}

function ytdTable(state) {
  if (!state.ytdEnabled) return null;
  const months = ytdMonths(state.ytdThrough);
  const ytd = { ...(state.ytdData || {}), year: 'YTD' };
  const ann = months > 0 ? annualizeYear(ytd, months) : null;
  const rows = spreadCells(ytd, ann).map(row => ({
    label: row.label,
    bold: row.bold,
    isSde: row.isSde,
    cells: ann ? [row.amount, row.pct, row.annAmount, row.annPct] : [row.amount, row.pct],
  }));
  const ytdLabel = months > 0 ? `YTD (${months} mo)` : 'YTD';
  return {
    months,
    columns: ann ? [ytdLabel, '% Rev', 'Annualized', '% Rev'] : [ytdLabel, '% Rev'],
    rows,
    annualizedSde: ann ? calcSDE(ann).sde : null,
  };
}

function industryCitation(ind) {
  const source = String(ind?.source || '').trim();
  const year = ind?.reportYear == null || ind.reportYear === '' ? '' : String(ind.reportYear).trim();
  if (!source) return year;
  if (!year || source.endsWith(year)) return source;
  return `${source} ${year}`;
}

function dscrThresholds(count, dscrMin, hasSalary) {
  const yellow = dscrMin;
  if (hasSalary) return Array.from({ length: count }, () => ({ green: dscrMin + 0.25, yellow }));
  const scale = [
    { green: Math.max(1.5, dscrMin + 0.25), yellow },
    { green: Math.max(1.7, dscrMin + 0.45), yellow },
    { green: Math.max(2.0, dscrMin + 0.55), yellow },
  ];
  return Array.from({ length: count }, (_, i) => scale[Math.min(i, 2)]);
}

function assess(ratio, threshold) {
  if (ratio == null || !Number.isFinite(ratio)) return { label: '—', tone: 'muted' };
  if (ratio >= threshold.green) return { label: 'Strong', tone: 'good' };
  if (ratio >= threshold.yellow) return { label: 'Marginal', tone: 'warn' };
  return { label: 'Below minimum', tone: 'bad' };
}

/**
 * Seller net proceeds. Same formula as the Net Proceeds tab, including the
 * buyer SBA fee and closing costs that tab deducts when those fields are blank.
 * `state._net` is ignored — it stays 0 until that tab has been opened.
 */
function computeNetProceeds(state) {
  const np = state.np || {};
  const ctx = loanContext(state);
  const basisAfterSalary = fairMarketSde(state.years, state.sdeBasis === 'weighted' ? 'weighted' : 'recent') - pn(state.buyerSalary);
  const suPrice = ctx.marketPrice;
  const autoGross = suPrice > 0 ? suPrice : (basisAfterSalary > 0 ? basisAfterSalary * 3 : 0);
  const gross = autoGross > 0 ? autoGross : pn(np.gross);
  const grossAssumed = !(suPrice > 0) && autoGross > 0;
  const basisLabel = state.sdeBasis === 'weighted' ? 'weighted average' : 'most recent';
  const cash = pn(np.cash);
  const ap = pn(np.ap);
  const ltd = pn(np.ltd);
  const mortgage = pn(np.mortgage);
  const commissionRate = pn(np.commission) / 100;
  const commissionAmt = gross * commissionRate;
  const legal = pn(np.legal);
  const sbaFeeAuto = np.sbaFee === '' || np.sbaFee === undefined;
  const sbaFee = sbaFeeAuto ? ctx.guaranteeFee : pn(np.sbaFee);
  const closingAuto = np.closingCosts === '' || np.closingCosts === undefined;
  const closing = closingAuto ? ctx.closing : pn(np.closingCosts);
  const customDeds = np.customDeds || [];
  const customTotal = customDeds.reduce((s, d) => s + pn(d.amount), 0);
  const taxRate = pn(np.taxRate) / 100;
  const preTax = gross + cash - mortgage - ap - ltd - commissionAmt - legal - sbaFee - closing - customTotal;
  const taxAmt = preTax > 0 ? preTax * taxRate : 0;
  const net = preTax - taxAmt;
  const available = gross > 0;
  const lines = [];
  if (available) {
    lines.push({
      label: grossAssumed
        ? `Gross sale price (assumed 3× ${basisLabel} SDE after buyer salary — no market price entered)`
        : 'Gross sale price',
      amount: gross, sign: '+',
    });
    if (cash !== 0) lines.push({ label: 'Cash retained from the balance sheet', amount: cash, sign: cash >= 0 ? '+' : '-' });
    lines.push({ label: 'Debt / mortgage payoff', amount: mortgage, sign: '-' });
    if (ap !== 0) lines.push({ label: 'Accounts payable', amount: ap, sign: '-' });
    if (ltd !== 0) lines.push({ label: 'Long-term debt', amount: ltd, sign: '-' });
    lines.push({ label: `Broker commission (${fmtPct(commissionRate * 100, 0)})`, amount: commissionAmt, sign: '-' });
    lines.push({ label: 'Legal / attorney fees', amount: legal, sign: '-' });
    if (sbaFee !== 0 || sbaFeeAuto) {
      lines.push({
        label: sbaFeeAuto ? 'SBA guarantee fee (buyer cost, auto from Sources & Uses)' : 'SBA guarantee fee (buyer cost)',
        amount: sbaFee, sign: '-',
      });
    }
    if (closing !== 0 || closingAuto) {
      lines.push({
        label: closingAuto ? 'Closing costs (buyer cost, auto from Sources & Uses)' : 'Closing costs (buyer cost)',
        amount: closing, sign: '-',
      });
    }
    customDeds.forEach(d => {
      if (pn(d.amount) !== 0) lines.push({ label: d.label || 'Additional deduction', amount: pn(d.amount), sign: '-' });
    });
    lines.push({ label: `Estimated tax on gain (${fmtPct(taxRate * 100, 0)})`, amount: taxAmt, sign: '-' });
  }
  const basisLbl = state.sdeBasis === 'weighted' ? 'Weighted Avg' : 'Most Recent';
  return {
    available, gross, grossAssumed, net, preTax, taxAmt, taxRate, lines,
    grossIsAuto: autoGross > 0,
    grossLabel: suPrice > 0
      ? 'Auto from Sources & Uses market price'
      : (autoGross > 0 ? `Auto: ${basisLbl} SDE × 3.0×` : ''),
    sbaIsAuto: sbaFeeAuto && ctx.guaranteeFee > 0,
    closingIsAuto: closingAuto && ctx.closing > 0,
    cash, ap, ltd, mortgage, commissionRate, commissionAmt, legal,
    sbaFee, sbaFeeAuto, closing, closingAuto, customDeds, customTotal,
    autoSbaFee: ctx.guaranteeFee, autoClosing: ctx.closing,
  };
}

function buildNlb(state, proceeds) {
  const nlb = state.nlb || {};
  const pct = nlb.pct === '' || nlb.pct == null ? 20 : pn(nlb.pct);
  const curSDE = recentSDE(state.years);
  const base = { pct, curSDE, incomeIncrease: null, available: false };
  if (!proceeds.available) {
    return { ...base, reason: 'Net proceeds are not calculated until a sale price or market price is entered. No next acquisition is projected.' };
  }
  if (!(proceeds.net > 0)) {
    return { ...base, net: proceeds.net, reason: 'Net proceeds are not positive, so this report does not invent a down payment, a target price, or an income increase.' };
  }
  const downPayment = proceeds.net * (pct / 100);
  const target = downPayment / 0.10;
  const estimated = target / 3;
  const entered = pn(nlb.nextSDE) > 0;
  const nextSDE = entered ? pn(nlb.nextSDE) : estimated;
  return {
    available: true,
    reason: '',
    net: proceeds.net,
    pct,
    downPayment,
    remaining: proceeds.net - downPayment,
    curSDE,
    target,
    nextSDE,
    nextSdeEstimated: !entered,
    incomeIncrease: nextSDE - curSDE,
  };
}

function buildRoi(state, ctx, afterSalary) {
  if (!(ctx.marketPrice > 0) || afterSalary === 0) return null;
  const sbaLoan = Math.max(0, ctx.marketPrice * (1 - ctx.dp) - ctx.sf.amount);
  const sbaMonthly = monthlyPayment(sbaLoan, ctx.rate, ctx.amort);
  const sbaAnnual = sbaMonthly * 12;
  const totalDS = sbaAnnual + ctx.sf.annual;
  const fee = sbaLoan * 0.75 * 0.035;
  const cashToClose = ctx.marketPrice * ctx.dp + ctx.closing + fee + ctx.wc;
  const netCashFlow = afterSalary - totalDS;
  const cashOnCash = cashToClose > 0 ? netCashFlow / cashToClose * 100 : null;
  const leverage = cashToClose > 0 ? ctx.marketPrice / cashToClose : null;
  const roi = state.roi || {};
  const growth = pn(roi.growthPct || '0') / 100;
  const exitYears = Math.max(1, pn(roi.exitYears || '10'));
  const exitMultiple = pn(roi.exitMultiple) || pn(state.ind?.sdeMult) || 3.5;
  const exitMultipleSource = pn(roi.exitMultiple) ? 'Buyer ROI tab' : (pn(state.ind?.sdeMult) ? 'imported industry SDE multiple' : '3.5× default (no industry multiple imported)');
  let cumulative = 0;
  for (let y = 1; y <= exitYears; y++) cumulative += Math.max(0, afterSalary * Math.pow(1 + growth, y - 1) - totalDS);
  const exitSde = afterSalary * Math.pow(1 + growth, exitYears - 1);
  const sbaRemaining = remainingBalance(sbaLoan, ctx.rate, sbaMonthly, exitYears);
  const sfMonthly = ctx.sf.monthly;
  const sfRemaining = ctx.sf.amount > 0 && ctx.sf.rate > 0
    ? remainingBalance(ctx.sf.amount, ctx.sf.rate, sfMonthly, exitYears) : 0;
  const scenario = mult => {
    const total = cumulative + exitSde * mult - sbaRemaining - sfRemaining;
    const roiPct = cashToClose > 0 ? total / cashToClose * 100 : null;
    const cagr = cashToClose > 0 && total > 0 ? Math.pow(total / cashToClose, 1 / exitYears) - 1 : null;
    return { multiple: mult, total, roiPct, cagr };
  };
  return {
    cashToClose, cashOnCash, leverage,
    sde: afterSalary,
    sbaLoan, sbaAnnual, sbaMonthly,
    sellerAnnual: ctx.sf.annual,
    totalDebtService: totalDS,
    netCashFlow,
    rate: ctx.rate,
    years: ctx.amort,
    downPct: ctx.dpPct,
    exitYears, exitSde, growth, exitMultiple, exitMultipleSource,
    scenarios: [scenario(exitMultiple - 1), scenario(exitMultiple), scenario(exitMultiple + 1)],
    scenarioLabels: ['Conservative', 'Market', 'Premium'],
  };
}

function buildSeller(state, ctx, rawBasis, buyerSalary) {
  const asking = pn(state.seller?.askingPrice);
  if (!(asking > 0)) return null;
  const dscrMin = numOr(state.dscrMin, 1.25);
  const contPct = pn(state.seller?.contingencyPct) || 10;
  const at = price => monthlyAtPrice(ctx, price);
  const pack = price => {
    if (!(price > 0)) return null;
    const monthly = at(price);
    const annual = monthly * 12;
    return {
      price, down: price * ctx.dp, loan: price * (1 - ctx.dp), monthly, annual,
      rawDscr: annual > 0 ? rawBasis / annual : null,
      adjDscr: annual > 0 ? (rawBasis - buyerSalary) / annual : null,
      cashLeft: rawBasis - buyerSalary - annual - rawBasis * (contPct / 100),
    };
  };
  const maxPrice = maxSupportablePrice(rawBasis - buyerSalary, dscrMin, at);
  return {
    dscrMin, contingencyPct: contPct, rawBasis, buyerSalary,
    columns: [
      { label: "Seller's price", ...pack(asking) },
      { label: "Advisor's market price", ...pack(ctx.marketPrice) },
      { label: `Max at ${dscrMin}×`, ...pack(maxPrice) },
    ].map(col => col.price ? col : { label: col.label, price: null }),
  };
}

function buildIndustry(state, rawRecentSde) {
  const ind = state.ind || {};
  if (!ind.name) return { empty: true };
  const years = (state.years || []).filter(y => !isYtdYear(y));
  const actuals = years.map(yd => {
    const s = calcSDE(yd);
    return {
      year: yd.year,
      grossMargin: s.rev ? s.gp / s.rev * 100 : null,
      ebitda: s.rev ? s.ebitda / s.rev * 100 : null,
      net: s.rev ? s.noi / s.rev * 100 : null,
      rev: s.rev,
    };
  });
  const rec = [...sortedByYear(years)].find(y => pn(y.revenue) || calcSDE(y).sde) || null;
  const recRev = rec ? calcSDE(rec).rev : 0;
  const recSde = rec ? calcSDE(rec).sde : rawRecentSde;
  const tierMult = recRev > 5000000 ? pn(ind.sdeMultOver5M) : recRev > 1000000 ? pn(ind.sdeMult1to5M) : pn(ind.sdeMultUnder1M);
  const tierLabel = recRev > 5000000 ? 'Over $5M' : recRev > 1000000 ? '$1M–$5M' : 'Under $1M';
  const marketPrice = pn(state.su?.marketPrice);
  const dealMult = marketPrice > 0 && recSde > 0 ? marketPrice / recSde : null;
  const dealRevPct = marketPrice > 0 && recRev > 0 ? marketPrice / recRev * 100 : null;
  return {
    empty: false,
    name: ind.name,
    naics: ind.naics || '',
    citation: industryCitation(ind),
    grossBenchmark: ind.grossMarginPct === '' || ind.grossMarginPct == null ? null : pn(ind.grossMarginPct),
    years: actuals,
    tierLabel, tierMult, marketPrice, dealMult, dealRevPct, recSde, recRev,
    ruleSde: ind.sdeMult ? pn(ind.sdeMult) : null,
    ruleRevenue: ind.revenueMultPct ? pn(ind.revenueMultPct) : null,
  };
}

function buildNarrative(state, text) {
  const withData = sortedByYear(state.years).filter(y => pn(y.revenue) > 0);
  if (!withData.length) {
    return { hasFinancials: false, text: text || '', kpis: [], charts: [], waterfall: [] };
  }
  const latest = calcSDE(withData[0]);
  const prior = withData.length > 1 ? calcSDE(withData[1]) : null;
  const yoy = (cur, prev) => (prev && Math.abs(prev) > 0 ? (cur - prev) / Math.abs(prev) * 100 : null);
  const yoyLabel = (cur, prev) => {
    const v = yoy(cur, prev);
    if (v == null) return '';
    return `${v >= 0 ? 'up' : 'down'} ${Math.abs(v).toFixed(1)}% vs prior year`;
  };
  const kpis = [
    { label: 'Revenue', value: fmtMoney(latest.rev), detail: yoyLabel(latest.rev, prior?.rev) },
    { label: 'Gross profit', value: fmtMoney(latest.gp), detail: [latest.rev ? `${pctOf(latest.gp, latest.rev, false)} of revenue` : '', yoyLabel(latest.gp, prior?.gp)].filter(Boolean).join(' · ') },
    { label: 'EBITDA', value: fmtMoney(latest.ebitda), detail: [latest.rev ? `${pctOf(latest.ebitda, latest.rev, false)} of revenue` : '', yoyLabel(latest.ebitda, prior?.ebitda)].filter(Boolean).join(' · ') },
    { label: 'SDE', value: fmtMoney(latest.sde), detail: [latest.rev ? `${pctOf(latest.sde, latest.rev, false)} of revenue` : '', yoyLabel(latest.sde, prior?.sde)].filter(Boolean).join(' · ') },
  ];
  const points = [...withData].reverse().map(y => {
    const c = calcSDE(y);
    return {
      label: String(y.year),
      revenue: c.rev,
      gm: c.rev ? c.gp / c.rev * 100 : 0,
      em: c.rev ? c.ebitda / c.rev * 100 : 0,
      sde: c.sde,
    };
  });
  const charts = [
    { title: 'Revenue', key: 'revenue', format: 'money', color: '#1d4ed8' },
    { title: 'Gross margin', key: 'gm', format: 'pct', color: '#1d4ed8' },
    { title: 'EBITDA margin', key: 'em', format: 'pct', color: '#6d28d9' },
    { title: 'SDE', key: 'sde', format: 'money', color: '#C4592F' },
  ].map(ch => ({ ...ch, points: points.map(p => ({ label: p.label, value: p[ch.key] })) }));
  const ida = latest.int + latest.taxes + latest.dep + latest.amor;
  const adds = latest.ab + latest.rentAB;
  const waterfall = [{ label: 'Revenue', value: latest.rev, type: 'start' }];
  waterfall.push({ label: '- COGS', value: -latest.cogs, type: 'step' });
  waterfall.push({ label: 'Gross profit', value: latest.gp, type: 'total' });
  waterfall.push({ label: '- OpEx', value: -latest.opx, type: 'step' });
  waterfall.push({ label: 'NOI', value: latest.noi, type: 'total' });
  if (ida !== 0) waterfall.push({ label: '+ I/T/D&A', value: ida, type: 'step' });
  waterfall.push({ label: 'EBITDA', value: latest.ebitda, type: 'total' });
  if (latest.oc !== 0) waterfall.push({ label: '+ Owner comp', value: latest.oc, type: 'step' });
  if (adds !== 0) waterfall.push({ label: '+ Add-backs', value: adds, type: 'step' });
  waterfall.push({ label: 'SDE', value: latest.sde, type: 'total' });
  return { hasFinancials: true, year: withData[0].year, text: text || '', kpis, charts, waterfall };
}

function formatPrepared(input) {
  if (!input) {
    return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'America/New_York' });
  }
  if (typeof input === 'string' && /^[A-Za-z]+ \d{1,2}, \d{4}$/.test(input)) return input;
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return String(input);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

function buildDealReport(state, options = {}) {
  const safe = state || {};
  const years = Array.isArray(safe.years) ? safe.years.filter(y => !isYtdYear(y)) : [];
  const basisKey = safe.sdeBasis === 'weighted' ? 'weighted' : 'recent';
  const rawWeighted = wtdSDE(years);
  const rawRecent = recentSDE(years);
  const rawBasis = fairMarketSde(years, basisKey);
  const buyerSalary = pn(safe.buyerSalary);
  const afterSalary = rawBasis - buyerSalary;
  const ctx = loanContext(safe);
  const dscrMin = numOr(safe.dscrMin, 1.25);
  const hasSalary = buyerSalary > 0;
  const proceeds = computeNetProceeds(safe);
  const nlb = buildNlb(safe, proceeds);
  const roi = buildRoi(safe, ctx, afterSalary);
  const seller = buildSeller(safe, ctx, rawBasis, buyerSalary);
  const deal = dealDebt(ctx);
  const sizing = sizingDebt(ctx, afterSalary);
  const sizingUsable = afterSalary > 0;
  const thresholds = dscrThresholds(years.length, dscrMin, hasSalary);
  const debtAnnual = deal ? deal.annual : (sizingUsable ? sizing.annual : 0);
  const debtMode = deal ? 'deal' : 'sizing';
  const dscrRows = years.map((yd, i) => {
    const sde = calcSDE(yd).sde;
    const ratio = debtAnnual > 0 ? sde / debtAnnual : null;
    const judgment = assess(ratio, thresholds[i]);
    return {
      year: String(yd.year),
      sde,
      annualDebtService: debtAnnual,
      ratio,
      assessment: judgment.label,
      tone: judgment.tone,
      strongAt: thresholds[i].green,
      minimum: thresholds[i].yellow,
    };
  });
  const latestWithRev = sortedByYear(years).find(y => pn(y.revenue) > 0);
  const latestRev = latestWithRev ? calcSDE(latestWithRev).rev : 0;
  const marketMultiple = ctx.marketPrice > 0 && rawBasis !== 0 ? ctx.marketPrice / rawBasis : null;
  const mults = [2.5, 3.0, 3.5, ...(safe.customMults || []).map(m => parseFloat(m)).filter(m => m > 0)];
  const multiples = mults.map(m => {
    const computed = rawBasis * m;
    const selected = ctx.marketPrice > 0 && Math.abs(ctx.marketPrice - computed) <= 1;
    return { multiple: m, price: selected ? ctx.marketPrice : computed, computed, selected };
  });
  const ytd = ytdTable(safe);
  const spread = { groups: historicalGroups(years), ytd };
  const industry = buildIndustry(safe, rawRecent);
  const narrative = buildNarrative(safe, typeof options.narrative === 'string' ? options.narrative : '');

  const flags = options.sections || null;
  const on = id => !flags || flags[id] !== false;
  const catalog = [
    ['spread', "Financial Performance & Seller's Discretionary Earnings", true],
    ['fmv', 'Fair Market Value Range', true],
    ['industry', 'Industry Comparison', true],
    ['dscr', 'Debt Service Coverage Ratio (DSCR)', true],
    ['seller', 'Seller Reality Check', !!seller],
    ['roi', 'Buyer ROI Summary', !!roi],
    ['sources', 'Sources & Uses of Funds', true],
    ['proceeds', 'Net Proceeds to Seller', true],
    ['nlb', 'QSI™ Next Larger Business (NLB) Strategy', true],
    ['narrative', 'Financial Narrative Analysis', true],
  ];
  const sections = catalog.filter(([id, , present]) => on(id) && present).map(([id, title], i) => ({ id, title, number: i + 1 }));

  const basisName = basisKey === 'weighted' ? 'Weighted average' : 'Most recent';
  const summary = [];
  const pushFig = (label, value, note) => { if (value) summary.push({ label, value, note: note || '' }); };
  pushFig('Most recent SDE', rawRecent || latestRev ? fmtMoney(rawRecent) : '', 'Before buyer salary. Valuation basis when most recent is selected.');
  if (hasSalary) pushFig('SDE after buyer salary', fmtMoney(afterSalary), `${fmtMoney(buyerSalary)} replacement-owner cost. Used for buyer cash flow, not for the market-price multiple.`);
  if (ctx.marketPrice > 0) pushFig('Market price', fmtMoney(ctx.marketPrice), marketMultiple != null ? `${marketMultiple.toFixed(2)}× ${basisName.toLowerCase()} SDE` : '');
  if (latestRev) pushFig(`${latestWithRev.year} revenue`, fmtMoney(latestRev), '');
  const latestRow = [...dscrRows].reverse().find(r => r.ratio != null);
  if (latestRow && debtMode === 'deal') pushFig(`${latestRow.year} DSCR`, latestRow.ratio.toFixed(2), 'Year SDE before salary ÷ Sources & Uses debt service.');
  if (proceeds.available) pushFig('Net proceeds to seller', fmtMoney(proceeds.net), proceeds.grossAssumed ? 'Sale price was assumed. See the proceeds section.' : 'After the deductions listed in that section.');
  if (roi) pushFig('Cash to close', fmtMoney(roi.cashToClose), 'Down payment plus guarantee fee and closing costs.');
  if (roi && roi.cashOnCash != null) pushFig('Cash-on-cash', fmtPct(roi.cashOnCash, 1), 'After-salary cash flow ÷ cash to close.');

  const sourcesTotal = ctx.sbaLoan + ctx.downPayment + ctx.sf.amount;
  const usesTotal = ctx.totalProject + ctx.guaranteeFee + ctx.closing;

  return {
    meta: {
      dealName: (safe.dealName || '').trim() || 'Business acquisition analysis',
      advisorName: (safe.advisorName || '').trim(),
      prepared: formatPrepared(options.preparedDate),
      fileSlug: ((safe.dealName || 'deal-report').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'deal-report'),
    },
    disclaimer: 'Confidential discussion draft from the QSI™ Market Price Analyzer, using the financials entered for this deal. Lender terms, taxes, and the buyer’s actual salary will change the result.',
    summary,
    sde: {
      rawWeighted, rawRecent, rawBasis, afterSalary, buyerSalary, hasSalary, basisKey, basisName,
    },
    spread,
    salaryNote: hasSalary
      ? `${basisName} SDE of ${fmtMoney(rawBasis)} is before the ${fmtMoney(buyerSalary)} buyer salary. Year-by-year DSCR uses that before-salary SDE. Buyer cash flow uses ${fmtMoney(afterSalary)} after the salary.`
      : `${basisName} SDE of ${fmtMoney(rawBasis)} is the valuation basis. No buyer salary is entered, so cash flow is not reduced for a replacement owner.`,
    multiples, marketPrice: ctx.marketPrice, marketMultiple, basisName,
    industry,
    dscr: {
      mode: debtMode,
      minimum: dscrMin,
      hasSalary,
      rows: dscrRows,
      deal,
      sizing: {
        ...sizing,
        afterSalary,
        usable: sizingUsable,
      note: sizingUsable
        ? `Sizing reference only: 3× SDE after buyer salary (${fmtMoney(afterSalary)}) at ${fmtPct(ctx.dpPct, 0)} down, ${fmtPct(ctx.rate, 2)} / ${ctx.amort} years. Annual debt service ${fmtMoney(sizing.annual)} on a ${fmtMoney(sizing.loan)} loan. This is not the Sources & Uses loan.`
        : 'A 3× sizing reference is not shown because SDE after the buyer salary is not positive. No loan is invented for that reference.',
      },
      roiContrast: roi
        ? `Buyer ROI amortizes ${fmtMoney(roi.sbaLoan)} (market price × ${fmtPct(100 - ctx.dpPct, 0)}, minus any seller note) at about ${fmtMoney(roi.sbaAnnual)} per year. That payment leaves the guarantee fee and closing costs in cash to close instead of financing them.`
        : '',
    },
    seller,
    roi,
    sources: {
      downPct: ctx.dpPct,
      sbaLoan: ctx.sbaLoan,
      downPayment: ctx.downPayment,
      sellerNote: ctx.sf.amount,
      marketPrice: ctx.marketPrice,
      reVal: ctx.reVal,
      wc: ctx.wc,
      arVal: ctx.arVal,
      invVal: ctx.invVal,
      guaranteeFee: ctx.guaranteeFee,
      closing: ctx.closing,
      sourcesTotal,
      usesTotal,
      balanced: Math.abs(sourcesTotal - usesTotal) < 1,
      rate: ctx.rate,
      termYears: deal ? deal.termYears : ctx.amort,
    },
    proceeds,
    nlb,
    narrative,
    sections,
  };
}

module.exports = {
  pn, calcSDE, wtdSDE, recentSDE, fairMarketSde, sortedByYear,
  fmtMoney, fmtParen, fmtPct,
  computeNetProceeds, buildNlb, buildDealReport, monthlyPayment,
};
