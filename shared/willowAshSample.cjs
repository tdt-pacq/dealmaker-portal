/**
 * SAMPLE ONLY. Reconstructed from the Willow Ash deal-report PDF exported
 * November 7, 2026 (QSI Market Price Analyzer). Not a production deal, not
 * loaded from Firestore, and not safe to treat as a live client file.
 * Dollar amounts are the figures printed in that PDF. Annualized YTD cents
 * follow the app's per-line rounding, which can differ by $1 from the PDF.
 */
function willowAshSampleState() {
  const year = (yr, fields) => ({
    year: yr,
    entityType: '1120-S',
    revenue: '', cogs: '', opx: '', otherIncome: '', interest: '', taxes: '',
    depreciation: '', amortization: '', ownerComp: '', addBacks: [], rent: '', rentAdj: '',
    ...fields,
  });
  return {
    dealName: 'Willow Ash',
    advisorName: 'Michael R. Moore',
    ytdEnabled: true,
    ytdThrough: '2026-09',
    years: [
      year(2023, { revenue: 761030, cogs: 478075, opx: 305117, depreciation: 30983 }),
      year(2024, { revenue: 1565547, cogs: 1079575, opx: 478877, interest: 5187, depreciation: 34244, ownerComp: 50700, addBacks: [{ amount: 3879 }] }),
      year(2025, { revenue: 1303393, cogs: 828737, opx: 429597, interest: 47990, depreciation: 5275, ownerComp: 50700, addBacks: [{ amount: 3879 }] }),
    ],
    ytdData: year('YTD', { revenue: 906261, cogs: 562232, opx: 321412, interest: 30239 }),
    sdeBasis: 'recent',
    customMults: [],
    dscrMin: 1.5,
    loanRate: 10,
    loanAmort: 10,
    dpPct: 10,
    reAmort: 25,
    loanStructure: '7a',
    buyerSalary: 75000,
    su: { marketPrice: 458708, sellerFin: '', sfRate: '', sfAmort: '', reVal: '', wc: '', arVal: '', invVal: '', closing: 15000 },
    np: { gross: '', cash: '', ap: '', ltd: '', mortgage: '', commission: '10', legal: '', sbaFee: '', closingCosts: '', taxRate: '', customDeds: [] },
    nlb: { pct: 100, nextSDE: '' },
    ind: {
      name: 'Roofing Contractors',
      naics: '238160',
      source: 'Business Brokerage Press 2026',
      reportYear: 2026,
      grossMarginPct: 32.8,
      sdeMult1to5M: 2.07,
    },
    roi: { growthPct: '0', exitYears: '10', exitMultiple: '' },
    seller: { askingPrice: '', contingencyPct: '10' },
    // Stale total the old report printed. The rebuilt report must ignore it.
    _net: 0,
  };
}

module.exports = { willowAshSampleState };
