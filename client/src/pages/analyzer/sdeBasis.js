/**
 * Year and SDE selection for the Market Price Analyzer.
 * Pure functions so Fair Market "most recent SDE" can be tested without Firebase.
 *
 * Fair market multiples use the SDE of the latest completed year column
 * (or the weighted average of those columns). Buyer's salary is a DSCR /
 * cash-flow adjustment and is not part of this figure.
 */

export const pn = s => { const n = parseFloat(String(s||'').replace(/[$,]/g,'')); return isNaN(n)?0:n; };
export const isPT = et => ['1120-S','1065','Schedule C'].includes(et);

/**
 * Rent adjustment added to SDE.
 * Keep this in sync with rentNormalization in shared/dealReport.mjs.
 *
 * Rule mode: the adjustment is the net difference between actual rent
 * (already inside operating expenses) and a normalized occupancy cost.
 * Above-market rent is a positive add-back. Below-market rent is negative.
 * Real estate included in the sale adds the full rent back.
 * A blank fair-market rent, or an incomplete cap-rate pair, nets to zero
 * so recording actual rent does not inflate SDE.
 *
 * Any other mode is a saved deal. The adjustment stays rent + rentAdj,
 * which is what SDE used before this rule, so loading a deal does not
 * change its SDE.
 */
export const rentNormalization = yd => {
  const rent = pn(yd?.rent);
  const savedAdj = pn(yd?.rentAdj);
  if (yd?.rentNormMode !== 'rule') {
    return {
      mode: 'manual',
      rent,
      normalizedCost: null,
      adjustment: rent + savedAdj,
      includedInSale: false,
      method: null,
      complete: true,
    };
  }
  const included = yd.reIncluded === true || yd.reIncluded === 'true' || yd.reIncluded === 1;
  const method = yd.rentNormMethod === 'cap' ? 'cap' : 'fmr';
  if (included) {
    return { mode: 'rule', rent, normalizedCost: 0, adjustment: rent, includedInSale: true, method, complete: true };
  }
  if (method === 'cap') {
    const value = pn(yd.reNormValue);
    const cap = pn(yd.capRate);
    if (!(value > 0) || !(cap > 0)) {
      return { mode: 'rule', rent, normalizedCost: rent, adjustment: 0, includedInSale: false, method, complete: false };
    }
    const normalizedCost = value * (cap / 100);
    return { mode: 'rule', rent, normalizedCost, adjustment: rent - normalizedCost, includedInSale: false, method, complete: true };
  }
  const fmrBlank = yd.fairMarketRent === '' || yd.fairMarketRent == null;
  const normalizedCost = fmrBlank ? rent : pn(yd.fairMarketRent);
  return { mode: 'rule', rent, normalizedCost, adjustment: rent - normalizedCost, includedInSale: false, method, complete: !fmrBlank };
};

export const preserveRentModel = yd => {
  if (!yd || yd.rentNormMode === 'rule' || yd.rentNormMode === 'manual') return yd;
  return { ...yd, rentNormMode: 'manual' };
};

/** Tax-return import: fair market rent starts equal to actual rent, so the add-back is zero. */
export const rentFieldsFromImport = extractedRent => {
  const rent = extractedRent == null || extractedRent === '' ? '' : extractedRent;
  return {
    rent,
    rentAdj: '',
    rentNormMode: 'rule',
    rentNormMethod: 'fmr',
    reIncluded: false,
    fairMarketRent: rent === '' ? '' : pn(rent),
    reNormValue: '',
    capRate: '',
  };
};

export const calcSDE = yd => {
  const rev=pn(yd.revenue), cogs=pn(yd.cogs), opx=pn(yd.opx);
  const otherInc=pn(yd.otherIncome||0);
  const int=pn(yd.interest), dep=pn(yd.depreciation), amor=pn(yd.amortization);
  const taxes=isPT(yd.entityType)?0:pn(yd.taxes);
  const oc=pn(yd.ownerComp);
  const ab=(yd.addBacks||[]).reduce((s,a)=>s+pn(a.amount),0);
  const rentAB=rentNormalization(yd).adjustment;
  const gp=rev-cogs, noi=gp+otherInc-opx;
  const ebitda=noi+int+taxes+dep+amor;
  const adjE=ebitda+oc;
  const sde=adjE+ab+rentAB;
  return {rev,cogs,gp,opx,otherInc,noi,int,taxes,dep,amor,ebitda,oc,adjE,ab,rentAB,sde};
};

export const isYtdYear = y => String(y?.year).toUpperCase() === 'YTD';
export const isCompletedTaxYear = y => !isYtdYear(y) && Number.isFinite(Number(y?.year));
export const yearNum = y => {
  if (isYtdYear(y)) return Infinity;
  const n = Number(y?.year);
  return Number.isFinite(n) ? n : -Infinity;
};

// Newest calendar year first. Equal years keep the later column (rightmost slot)
// so a duplicate "2024" header on the third column still loses to that column's data.
export const sortedByYear = yrs => [...(yrs||[])].filter(y=>!isYtdYear(y)).map((y,i)=>({y,i})).sort((a,b)=>{
  const d = yearNum(b.y) - yearNum(a.y);
  return d !== 0 ? d : b.i - a.i;
}).map(x=>x.y);

// Keep column years unique by bumping later duplicates forward (2023, 2024, 2024 → 2023, 2024, 2025).
export const uniquifyYears = yrs => {
  const used = new Set();
  return (yrs||[]).map(y => {
    if (isYtdYear(y)) return {...y, year:'YTD'};
    let n = Number(y.year);
    if (!Number.isFinite(n)) return y;
    while (used.has(n)) n += 1;
    used.add(n);
    return {...y, year:n};
  });
};

export const dedupeYearLabels = (years, preferIdx=null) => uniquifyYears(years); // preferIdx unused; uniquify always bumps later dups

export const mostRecentYearData = yrs => {
  for (const y of sortedByYear(yrs||[])) {
    if (pn(y.revenue) || calcSDE(y).sde) return y;
  }
  return null;
};
export const mostRecentYear = mostRecentYearData;

export const wtdSDE = yrs => {
  const s=sortedByYear(yrs).map(y=>calcSDE(y).sde);
  if(!s.length) return 0;
  if(s.length===1) return s[0];
  if(s.length===2) return (s[0]*2+s[1]*1)/3;
  return (s[0]*3+s[1]*2+s[2]*1)/6;
};

export const recentSDE = yrs => { const y=mostRecentYearData(yrs); return y ? calcSDE(y).sde : 0; };

/**
 * SDE the Fair Market range is based on.
 * "Most recent" is the latest year column the analyzer shows (highest year
 * with revenue or SDE), not that figure minus buyer's salary.
 */
export const fairMarketSde = (years, sdeBasis) => (
  sdeBasis === 'weighted' ? wtdSDE(years) : recentSDE(years)
);
