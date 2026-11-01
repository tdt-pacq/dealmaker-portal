// Industry-benchmark helpers shared by the PDF extractor and the analyzer review step.
// Pure functions only — no PDF or OCR dependencies.

const INDUSTRY_KEYS = [
  'name', 'naics', 'source', 'reportYear',
  'grossMarginPct', 'cogsPct', 'preTaxProfitPct', 'netMarginPct',
  'sdeMult', 'revenueMultPct', 'ebitMult', 'ebitdaMult',
  'sdeMultUnder1M', 'sdeMult1to5M', 'sdeMultOver5M',
  'ebitdaMultUnder1M', 'ebitdaMult1to5M', 'ebitdaMultOver5M',
];

// Source and year are printed in the copyright footer of image-only reports, so they
// do not prove the benchmark tables were read.
const INDUSTRY_SIGNAL_KEYS = INDUSTRY_KEYS.filter((key) => key !== 'source' && key !== 'reportYear');

const INDUSTRY_EXTRACT_FAILED = 'Could not find industry benchmarks in this PDF. The report looks image-only or the benchmark tables were not readable. Enter the values manually, or upload a text-based report.';

const FOOTER_LINE = /copyright|all rights reserved|https?:\/\/|business brokerage press|\bpage\s+\d+\s+of\s+\d+/i;

function isIndustryPrompt(prompt) {
  return /sdeMultUnder1M/.test(String(prompt || ''));
}

function emptyIndustry() {
  return Object.fromEntries(INDUSTRY_KEYS.map((key) => [key, null]));
}

function pdfTextIsSparse(text, pageCount) {
  const lines = String(text || '')
    .split(/\n+/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  if (!lines.length) return true;
  const pages = Math.max(1, Number(pageCount) || 1);
  const counts = new Map();
  for (const line of lines) {
    const key = line.toLowerCase();
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const repeatedThreshold = Math.max(3, Math.ceil(pages * 0.5));
  const substantive = [];
  for (const line of lines) {
    if ((counts.get(line.toLowerCase()) || 0) >= repeatedThreshold) continue;
    if (FOOTER_LINE.test(line)) continue;
    if (line.length < 3) continue;
    substantive.push(line.toLowerCase());
  }
  return [...new Set(substantive)].join(' ').length < 240;
}

function industryExtractionIsUseful(data) {
  if (!data || typeof data !== 'object') return false;
  let found = 0;
  for (const key of INDUSTRY_SIGNAL_KEYS) {
    const value = data[key];
    if (value === null || value === undefined) continue;
    if (typeof value === 'string' && !value.trim()) continue;
    found += 1;
  }
  return found >= 3;
}

function asPercent(value) {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return Math.round(n * 10) / 10;
}

function asMultiple(value) {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0 || n > 25) return null;
  return Math.round(n * 100) / 100;
}

function sectionFrom(text, startRe, endRe) {
  const startMatch = String(text || '').match(startRe);
  if (!startMatch) return '';
  const start = startMatch.index + startMatch[0].length;
  const rest = text.slice(start);
  const endMatch = rest.match(endRe);
  return endMatch ? rest.slice(0, endMatch.index) : rest.slice(0, 5000);
}

function lastNumberOnLine(block, labelRe) {
  if (!block) return null;
  for (const raw of block.split('\n')) {
    const line = raw.trim();
    if (!labelRe.test(line)) continue;
    const nums = line.match(/-?\d+(?:\.\d+)?/g);
    if (!nums || !nums.length) continue;
    const n = Number(nums[nums.length - 1]);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function metricIn(block, labelPattern) {
  if (!block) return null;
  const match = block.match(new RegExp(labelPattern + '\\s*[:\\-]?\\s*(-?\\d+(?:\\.\\d+)?)', 'i'));
  return match ? Number(match[1]) : null;
}

function tierSection(text, headingRe, otherHeadingRes) {
  const re = new RegExp(headingRe.source, headingRe.flags.includes('g') ? headingRe.flags : headingRe.flags + 'g');
  let match;
  while ((match = re.exec(text))) {
    const start = match.index + match[0].length;
    let end = text.length;
    for (const other of otherHeadingRes) {
      const nextRe = new RegExp(other.source, other.flags.includes('g') ? other.flags : other.flags + 'g');
      nextRe.lastIndex = start;
      const next = nextRe.exec(text);
      if (next && next.index < end) end = next.index;
    }
    const section = text.slice(start, Math.min(end, start + 2500));
    if (/MVIC\s*\/\s*(?:SDE|EBITDA|EBIT|Net\s*Sales)/i.test(section)) return section;
  }
  return '';
}

function singleTimes(block, unitPattern) {
  if (!block) return null;
  const range = new RegExp('\\d+(?:\\.\\d+)?\\s*(?:to|through|-)\\s*\\d+(?:\\.\\d+)?\\s*[x×]\\s*' + unitPattern, 'i');
  if (range.test(block)) return null;
  const match = block.match(new RegExp('(\\d+(?:\\.\\d+)?)\\s*[x×]\\s*' + unitPattern, 'i'));
  return match ? asMultiple(match[1]) : null;
}

function singlePercentOfSales(block) {
  if (!block) return null;
  if (/\d+(?:\.\d+)?\s*(?:to|through|-)\s*\d+(?:\.\d+)?\s*%\s*of\s+annual\s+sales/i.test(block)) return null;
  const match = block.match(/(\d+(?:\.\d+)?)\s*%\s*of\s+annual\s+sales/i);
  return match ? asPercent(match[1]) : null;
}

function parseIndustryName(text) {
  const idx = text.search(/Industry Quick View/i);
  const head = idx >= 0 ? text.slice(0, idx) : '';
  const lines = head.split('\n').map((line) => line.trim()).filter(Boolean);
  const skip = /copyright|all rights reserved|https?:\/\/|business brokerage press|confidential/i;
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].replace(/\s+/g, ' ');
    if (skip.test(line)) continue;
    if (line.length < 3 || line.length > 80) continue;
    if (/^[\d\W_]+$/.test(line)) continue;
    return line;
  }
  return null;
}

function parseNaics(text) {
  const nextLine = text.match(/NAICS[^\n]{0,60}\n\s*(\d{4,6})\b/i);
  if (nextLine) return nextLine[1];
  const inline = text.match(/NAICS(?:\s*\/\s*SIC)?(?:\s*Code)?\s*[:#\-]?\s*(\d{4,6})\b/i)
    || text.match(/\bSIC(?:\s*Code)?\s*[:#\-]?\s*(\d{4})\b/i);
  return inline ? inline[1] : null;
}

function parseReportMeta(text) {
  const copyright = text.match(/copyright\s+(20\d{2})/i);
  const updated = text.match(/last update:\s+[A-Za-z]+\s+(20\d{2})/i);
  const year = copyright ? Number(copyright[1]) : (updated ? Number(updated[1]) : null);
  const reportYear = year >= 1990 && year <= 2100 ? year : null;
  let source = null;
  if (/business brokerage press/i.test(text)) {
    source = reportYear ? `Business Brokerage Press ${reportYear}` : 'Business Brokerage Press';
  } else if (/bizminer/i.test(text)) {
    source = reportYear ? `BizMiner ${reportYear}` : 'BizMiner';
  } else if (/\bRMA\b|annual statement studies/i.test(text)) {
    source = reportYear ? `RMA Annual Statement Studies ${reportYear}` : 'RMA Annual Statement Studies';
  }
  return { source, reportYear };
}

function parseBrgIndustryReport(text) {
  const sourceText = String(text || '');
  if (!sourceText.trim()) return null;
  const data = emptyIndustry();
  data.name = parseIndustryName(sourceText);
  data.naics = parseNaics(sourceText);
  const meta = parseReportMeta(sourceText);
  data.source = meta.source;
  data.reportYear = meta.reportYear;

  const underRe = /Under\s+\$?\s*1\s*Million(?:\s+Net\s+Sales)?/i;
  const midRe = /\$?\s*1\s*Million\s*(?:-|–|—|to)\s*\$?\s*5\s*Million(?:\s+Net\s+Sales)?/i;
  const overRe = /Over\s+\$?\s*5\s*Million(?:\s+Net\s+Sales)?/i;
  const tiers = [
    ['sdeMultUnder1M', 'ebitdaMultUnder1M', underRe, [midRe, overRe]],
    ['sdeMult1to5M', 'ebitdaMult1to5M', midRe, [underRe, overRe]],
    ['sdeMultOver5M', 'ebitdaMultOver5M', overRe, [underRe, midRe]],
  ];
  for (const [sdeKey, ebitdaKey, heading, others] of tiers) {
    const section = tierSection(sourceText, heading, others);
    data[sdeKey] = asMultiple(metricIn(section, 'MVIC\\s*/\\s*SDE'));
    data[ebitdaKey] = asMultiple(metricIn(section, 'MVIC\\s*/\\s*EBITDA'));
  }

  const income = sectionFrom(
    sourceText,
    /Income Data\s*\(as a percentage of Net Sales\)/i,
    /\n\s*Ratios\b|\n\s*Type of Statement\b|\n\s*Expenses\b|\n\s*Industry Multiples\b/i
  );
  const bullet = '^(?:[+*•-]\\s*)?';
  data.grossMarginPct = asPercent(lastNumberOnLine(income, new RegExp(bullet + '(?:Gross Profit|Gross Margin)\\b', 'i')));
  data.preTaxProfitPct = asPercent(lastNumberOnLine(income, new RegExp(bullet + 'Profit Before Taxes\\b', 'i')));
  data.netMarginPct = asPercent(lastNumberOnLine(income, new RegExp(bullet + 'Net (?:Income|Profit)\\b(?!\\s*\\+)', 'i')));
  const cogsLine = asPercent(lastNumberOnLine(income, new RegExp(bullet + '(?:COGS|Cost of Goods(?: Sold)?|Cost of Sales)\\b', 'i')));
  data.cogsPct = cogsLine;

  const expenses = sectionFrom(
    sourceText,
    /Expenses\s*\(% of Annual Sales\)/i,
    /\n\s*Benchmarks\b|\n\s*Pricing Tips\b|\n\s*Questions\b|\n\s*General Information\b/i
  );
  if (data.cogsPct == null) {
    const expertCogs = expenses.match(/Cost of Goods\s*:\s*(\d+(?:\.\d+)?)\s*%/i);
    if (expertCogs && data.grossMarginPct == null) data.cogsPct = asPercent(expertCogs[1]);
  }
  if (data.preTaxProfitPct == null) {
    const expertPretax = expenses.match(/Profit\s*\(pretax\)\s*:\s*(\d+(?:\.\d+)?)\s*%/i);
    if (expertPretax) data.preTaxProfitPct = asPercent(expertPretax[1]);
  }
  if (data.cogsPct == null && data.grossMarginPct != null) {
    data.cogsPct = asPercent(Math.round((100 - data.grossMarginPct) * 10) / 10);
  }

  const rules = sectionFrom(
    sourceText,
    /Rules of Thumb/i,
    /\n\s*(?:Industry Multiples|Pricing Tips|Expenses|Industry Quick View|Benchmark)\b/i
  );
  data.sdeMult = singleTimes(rules, 'SDE');
  data.ebitdaMult = singleTimes(rules, 'EBITDA');
  data.ebitMult = singleTimes(rules, 'EBIT(?!DA)');
  data.revenueMultPct = singlePercentOfSales(rules);

  return industryExtractionIsUseful(data) ? data : null;
}

module.exports = {
  INDUSTRY_KEYS,
  INDUSTRY_SIGNAL_KEYS,
  INDUSTRY_EXTRACT_FAILED,
  isIndustryPrompt,
  emptyIndustry,
  pdfTextIsSparse,
  industryExtractionIsUseful,
  parseBrgIndustryReport,
  dealRatioActual,
  fmtRatio,
};

function round1(n) {
  return Math.round(n * 10) / 10;
}

function numOrNull(value) {
  if (value == null || value === '') return null;
  const n = Number(String(value).replace(/[$,]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function safeRatio(numerator, denominator) {
  if (numerator == null || denominator == null || denominator === 0) return null;
  return round1(numerator / denominator);
}

function daysRatio(numerator, denominator) {
  if (numerator == null || denominator == null || denominator === 0) return null;
  return round1((numerator / denominator) * 365);
}

function dealRatioActual(label, fin) {
  if (!fin || !label) return null;
  const key = String(label).toLowerCase().replace(/[^a-z0-9]+/g, '');
  const rev = numOrNull(fin.rev);
  const cogs = numOrNull(fin.cogs);
  const ebitda = numOrNull(fin.ebitda);
  const interest = numOrNull(fin.interest);
  const dep = numOrNull(fin.dep) || 0;
  const amor = numOrNull(fin.amor) || 0;
  const ownerComp = numOrNull(fin.ownerComp);
  const cash = numOrNull(fin.cash);
  const ar = numOrNull(fin.ar);
  const inv = numOrNull(fin.inv);
  const ca = numOrNull(fin.ca);
  const ta = numOrNull(fin.ta);
  const ap = numOrNull(fin.ap);
  const cl = numOrNull(fin.cl);
  const tl = numOrNull(fin.tl);
  const nw = numOrNull(fin.nw);
  if (key === 'current') return safeRatio(ca, cl);
  if (key === 'quick') {
    if (cl == null || cl === 0) return null;
    if (cash == null && ar == null && (ca == null || inv == null)) return null;
    const assets = (cash != null || ar != null) ? (cash || 0) + (ar || 0) : ca - inv;
    return round1(assets / cl);
  }
  if (key.includes('receivable') && key.includes('day')) return daysRatio(ar, rev);
  if (key.includes('inventory') && key.includes('day')) return daysRatio(inv, cogs);
  if (key.includes('payable') && key.includes('day')) return daysRatio(ap, cogs);
  if (key.includes('ebit') && key.includes('interest') && !key.includes('ebitda')) {
    if (ebitda == null || interest == null || interest === 0) return null;
    return round1((ebitda - dep - amor) / interest);
  }
  if (key.includes('debt') && key.includes('worth')) return safeRatio(tl, nw);
  if (key.includes('fixed') && key.includes('worth')) {
    if (ta == null || ca == null) return null;
    return safeRatio(ta - ca, nw);
  }
  if (key.includes('sales') && key.includes('totalasset')) return safeRatio(rev, ta);
  if (key.includes('ebitda') && key.includes('sales')) return rev ? round1((ebitda / rev) * 100) : null;
  if ((key.includes('officer') || key.includes('owner') || key.includes('comp')) && key.includes('sales')) {
    return ownerComp == null || !rev ? null : round1((ownerComp / rev) * 100);
  }
  return null;
}

function fmtRatio(value) {
  if (value == null || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const rounded = round1(n);
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
