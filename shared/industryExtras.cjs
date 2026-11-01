// Extra Business Reference Guide fields: ratio quartiles, expert ratings,
// expense benchmarks, and a summary of the narrative sections.
// Pure functions. No PDF, OCR, or network calls.

const INSIGHT_DEFS = [
  ['pricingTips', 'Pricing tips', /pricing tips/i],
  ['dueDiligence', 'Expert due-diligence questions', /questions from our industry experts/i],
  ['businessModel', 'Business model', /general information/i],
  ['advice', 'Advice for buyers and sellers', /advice from our industry experts/i],
  ['trends', 'Industry trends and forecast', /industry trends/i],
  ['financing', 'Financing and deal terms', /\bfinancing\b/i],
  ['disadvantages', 'Disadvantages', /\bdisadvantages reported by our industry experts/i],
  ['advantages', 'Advantages', /\badvantages reported by our industry experts/i],
];

const FORECAST_HEADING = /industry forecast/i;

function emptyExtras() {
  return {
    financialRatios: null,
    expertRatings: null,
    expertExpenses: null,
    expertBenchmarks: null,
    expertInsights: null,
  };
}

function round1(n) {
  return Math.round(n * 10) / 10;
}

function banLoi(text) {
  return String(text || '')
    .replace(/\bletters of intent\b/gi, 'offers')
    .replace(/\ba letter of intent\b/gi, 'an offer')
    .replace(/\bletter of intent\b/gi, 'offer')
    .replace(/\bLOIs\b/g, 'offers')
    .replace(/\bLOI\b/g, 'offer')
    .replace(/“\|/g, '“I')
    .replace(/\bthan then the\b/gi, 'than the');
}

function cleanBlock(text) {
  return String(text || '')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line && !/copyright|all rights reserved|business brokerage press/i.test(line))
    .join('\n');
}

function sliceSection(text, startRe, endRe) {
  const source = String(text || '');
  const start = source.search(startRe);
  if (start < 0) return '';
  const from = start + (source.slice(start).match(startRe) || [''])[0].length;
  const rest = source.slice(from);
  const end = rest.search(endRe);
  return cleanBlock(end >= 0 ? rest.slice(0, end) : rest.slice(0, 6000));
}

function yearTokens(line) {
  const years = [];
  const re = /(20\d{2})\s*[-–—]\s*(\d{2})/g;
  let match;
  while ((match = re.exec(line))) years.push(`${match[1]}-${match[2]}`);
  return years;
}

function quartileOf(line) {
  const match = String(line || '').match(/\b(upper|median|lower)\b/i);
  return match ? match[1].toLowerCase() : null;
}

function numericTokens(line) {
  const out = [];
  const re = /N\/A|-?\d+(?:\.\d+)?/gi;
  let match;
  while ((match = re.exec(line))) {
    out.push(/^n\/a$/i.test(match[0]) ? null : Number(match[0]));
  }
  return out;
}

function labelBeforeQuartile(line, quartile) {
  const at = line.toLowerCase().indexOf(quartile);
  const raw = at >= 0 ? line.slice(0, at) : line.replace(/N\/A|-?\d+(?:\.\d+)?/gi, ' ');
  return cleanRatioLabel(raw);
}

function cleanRatioLabel(raw) {
  const label = String(raw || '')
    .replace(/[|+*•]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[^A-Za-z%]+/, '')
    .trim();
  const letters = label.match(/[A-Za-z]/g) || [];
  if (letters.length < 3) return '';
  if (/copyright|rights reserved|type of statement|number of statements/i.test(label)) return '';
  return label;
}

function lastThree(nums) {
  const picked = nums.filter((n) => n == null || Number.isFinite(n)).slice(-3);
  while (picked.length < 3) picked.unshift(null);
  return picked.slice(-3);
}

function repairTriple(values) {
  const next = values.map((v) => (v == null || !Number.isFinite(v) ? null : v));
  const decimals = next.filter((v) => v != null && !Number.isInteger(v));
  if (!decimals.length) return next;
  const sorted = [...decimals].sort((a, b) => a - b);
  const mid = sorted[Math.floor(sorted.length / 2)];
  return next.map((v) => {
    if (v == null || !Number.isInteger(v) || Math.abs(v) < 10) return v;
    const scaled = round1(v / 10);
    return Math.abs(scaled - mid) < Math.abs(v - mid) ? scaled : v;
  });
}

function repairRowScale(row) {
  const keys = ['upper', 'median', 'lower'];
  const hasDecimal = keys.some((key) => (row[key] || []).some((v) => v != null && !Number.isInteger(v)));
  if (!hasDecimal) return row;
  const reference = [];
  for (const key of keys) {
    for (const v of row[key] || []) {
      if (v != null && !Number.isInteger(v)) reference.push(Math.abs(v));
    }
  }
  if (!reference.length) return row;
  const ref = reference.sort((a, b) => a - b)[Math.floor(reference.length / 2)];
  const next = { ...row };
  for (const key of keys) {
    const vals = row[key] || [null, null, null];
    const ints = vals.filter((v) => v != null && Number.isInteger(v) && Math.abs(v) >= 10);
    if (ints.length !== vals.filter((v) => v != null).length || !ints.length) continue;
    const rawMid = [...ints].sort((a, b) => a - b)[Math.floor(ints.length / 2)];
    const scaledMid = rawMid / 10;
    if (rawMid > ref * 8 && scaledMid <= ref * 8 && scaledMid >= ref * 0.2) {
      next[key] = vals.map((v) => (v == null ? null : round1(v / 10)));
    }
  }
  return next;
}

function canonicalRatioLabel(label) {
  const key = label.toLowerCase();
  if (/tangible/.test(key) && /worth/.test(key)) return '% Profit before Taxes/Tangible Net Worth';
  if (/profit before taxes/.test(key) && /total assets/.test(key)) return '% Profit before Taxes/Total Assets';
  if (/officer|owner/.test(key) && /comp/.test(key)) return "% Officers', Directors', Owners' Comp/Sales";
  if (/depr|depl|amort/.test(key) && /sales/.test(key)) return '% Depr, Depl, Amort/Sales';
  if (/ebitda/.test(key) && /sales/.test(key)) return 'EBITDA/Sales';
  if (/sales/.test(key) && /total assets/.test(key)) return 'Sales/Total Assets';
  if (/sales/.test(key) && /net fixed/.test(key)) return 'Sales/Net Fixed Assets';
  if (/working capital/.test(key)) return 'Sales/Working Capital';
  if (/ebit/.test(key) && /interest/.test(key)) return 'EBIT/Interest';
  if (/debt/.test(key) && /worth/.test(key)) return 'Debt/Worth';
  if (/fixed/.test(key) && /worth/.test(key)) return 'Fixed/Worth';
  if (/payables/.test(key) && /turnover/.test(key)) return 'Cost of Sales/Payables (Turnover)';
  if (/payables/.test(key) && /day/.test(key)) return 'Cost of Sales/Payables (Days)';
  if (/inventory/.test(key) && /turnover/.test(key)) return 'Cost of Sales/Inventory (Turnover)';
  if (/inventory/.test(key) && /day/.test(key)) return 'Cost of Sales/Inventory (Days)';
  if (/receivable/.test(key) && /turnover/.test(key)) return 'Sales/Receivables (Turnover)';
  if (/receivable/.test(key) && /day/.test(key)) return 'Sales/Receivables (Days)';
  if (/dda|curr mat/.test(key)) return 'Net Profit + DDA/Curr Mat LTD';
  if (/^quick\b/.test(key)) return 'Quick';
  if (/^current\b/.test(key)) return 'Current';
  return label;
}

function parseFinancialRatios(text) {
  const source = String(text || '');
  const start = source.search(/Ratios\s*\(providing the upper quartile|^\s*YEARS\b/im);
  if (start < 0) return null;
  const rest = source.slice(start);
  const stop = rest.search(/\n\s*(?:Type of Statement|Ratings from Our Industry Experts|Expenses\s*\()\b/i);
  const block = stop >= 0 ? rest.slice(0, stop) : rest.slice(0, 8000);
  const lines = block.split('\n').map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean);

  let years = null;
  let currentLabel = '';
  let open = null;
  const rows = [];

  function pushOpen() {
    if (!open) return;
    const filled = ['upper', 'median', 'lower'].some((key) => (open[key] || []).some((v) => v != null));
    if (filled && open.label) {
      open.upper = repairTriple(open.upper);
      open.median = repairTriple(open.median);
      open.lower = repairTriple(open.lower);
      rows.push(repairRowScale(open));
    }
    open = null;
  }

  for (const line of lines) {
    if (/providing the upper quartile|type of statement|number of statements/i.test(line)) {
      const headerYears = yearTokens(line);
      if (headerYears.length >= 2 && !years) years = headerYears.slice(0, 3);
      continue;
    }
    const headerYears = yearTokens(line);
    if (headerYears.length >= 2 && numericTokens(line.replace(/20\d{2}\s*[-–—]\s*\d{2}/g, ' ')).length === 0) {
      if (!years) years = headerYears.slice(0, 3);
      continue;
    }
    let quartile = quartileOf(line);
    const rawNums = numericTokens(line);
    const nums = lastThree(rawNums);
    let label = quartile ? labelBeforeQuartile(line, quartile) : cleanRatioLabel(line.replace(/N\/A|-?\d+(?:\.\d+)?/gi, ' '));
    if (label) label = canonicalRatioLabel(label);
    if (!quartile && !label && rawNums.length >= 2 && open) {
      if (!open.median.some((v) => v != null)) quartile = 'median';
      else if (!open.lower.some((v) => v != null)) quartile = 'lower';
    }
    if (!quartile && label && rawNums.length >= 2) quartile = 'upper';
    if (!quartile || rawNums.length < 2) {
      if (label && !quartile) currentLabel = label;
      continue;
    }
    if (label) currentLabel = label;
    const labelForRow = label || currentLabel;
    if (!open || quartile === 'upper' || (open.label && labelForRow && open.label !== labelForRow && open.upper)) {
      pushOpen();
      open = { label: labelForRow, upper: [null, null, null], median: [null, null, null], lower: [null, null, null] };
    } else if (!open.label && labelForRow) {
      open.label = labelForRow;
    }
    open[quartile] = nums;
    if (open.upper.some((v) => v != null) && open.median.some((v) => v != null) && open.lower.some((v) => v != null)) {
      pushOpen();
    }
  }
  pushOpen();

  for (let i = 0; i < rows.length; i += 1) {
    const known = canonicalRatioLabel(rows[i].label);
    const recognizable = known !== rows[i].label || /current|quick|sales|ebit|worth|asset|profit|debt|fixed|depr|officer|owner|comp|amort|interest/i.test(rows[i].label);
    if (recognizable) {
      rows[i].label = known;
      continue;
    }
    const next = rows[i + 1];
    if (next && canonicalRatioLabel(next.label) === '% Profit before Taxes/Total Assets') {
      rows[i].label = '% Profit before Taxes/Tangible Net Worth';
    }
  }
  const usable = rows.filter((row) => row.label && ['upper', 'median', 'lower'].filter((key) => row[key].some((v) => v != null)).length >= 2);
  if (usable.length < 3) return null;
  return {
    years: years && years.length ? years : [],
    rows: usable,
  };
}

function parseExpertRatings(text) {
  const block = sliceSection(text, /Ratings from Our Industry Experts/i, /Expenses\s*\(|Benchmarks from Our Industry|Pricing Tips/i);
  if (!block) return null;
  const ratings = [];
  const re = /([A-Za-z][A-Za-z /&'-]{2,60}?)\s+(\d+(?:\.\d+)?)\s*\(([^)\n]{3,80})\)/g;
  let match;
  while ((match = re.exec(block))) {
    const score = Number(match[2]);
    if (!Number.isFinite(score) || score < 0 || score > 4) continue;
    const label = match[1].replace(/\s+/g, ' ').trim();
    if (/copyright|expense|benchmark/i.test(label)) continue;
    ratings.push({
      label,
      score: round1(score),
      scale: match[3].replace(/\s+/g, ' ').trim(),
    });
  }
  return ratings.length ? ratings : null;
}

function percentAfter(block, labelRe) {
  const match = block.match(new RegExp(labelRe.source + '[^\\n%]{0,24}?(\\d+(?:\\.\\d+)?)\\s*%', 'i'));
  if (!match) return null;
  const n = Number(match[1]);
  if (!Number.isFinite(n) || n < 0 || n > 100) return null;
  return round1(n);
}

function parseExpertExpenses(text) {
  const block = sliceSection(
    text,
    /Expenses\s*\(% of Annual Sales\)/i,
    /Benchmarks from Our Industry|Pricing Tips|Questions from Our Industry|General Information/i
  );
  if (!block) return null;
  const expenses = {
    cogsPct: percentAfter(block, /Cost of Goods/),
    occupancyPct: percentAfter(block, /Occupancy/),
    payrollPct: percentAfter(block, /Payrol\w*\s*\/?\s*Labor/),
    preTaxProfitPct: percentAfter(block, /Profit\s*\(pretax\)/),
  };
  return Object.values(expenses).some((v) => v != null) ? expenses : null;
}

function splitExpertComments(block) {
  const joined = cleanBlock(block).replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!joined) return [];
  const parts = joined.split(/(?=(?:^|\s)[A-Z][a-z]+(?:\s+[A-Z][a-z.'-]+){1,3}\s*\(\d{1,2}\/\d{1,2}\/\d{2,4}\)\s*:)/).map((part) => part.trim()).filter(Boolean);
  return parts
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .filter((part) => part.length > 12 && !/copyright|all rights reserved/i.test(part));
}

function parseExpertBenchmarks(text) {
  const block = sliceSection(text, /Benchmarks from Our Industry Experts/i, /Pricing Tips|Questions from Our Industry|Expenses\s*\(/i);
  const items = splitExpertComments(block);
  return items.length ? items : null;
}

function sentencesOf(text) {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const parts = clean.split(/(?<=[.?!])\s+(?=[A-Z0-9“"(])/).map((part) => part.trim()).filter(Boolean);
  return parts.length ? parts : [clean];
}

function conciseComment(text, questionMode) {
  const body = text.replace(/^[A-Z][A-Za-z.'-]+(?:\s+[A-Z][A-Za-z.'-]+){0,3}\s*\(\d{1,2}\/\d{1,2}\/\d{2,4}\)\s*:\s*/, '').trim();
  if (!body) return [];
  if (questionMode) {
    const questions = body.split(/(?<=\?)\s+/).map((q) => q.trim()).filter((q) => q.length > 8);
    if (questions.length) {
      return questions.map((q) => (q.endsWith('?') ? q : `${q.replace(/[.)\s]+$/, '')}?`));
    }
  }
  const sentences = sentencesOf(body);
  const clipped = sentences.slice(0, 4);
  if (clipped.join(' ').length <= 700) return [clipped.join(' ')];
  return [clipped.slice(0, 3).join(' ')];
}

function bulletsFromSection(body, questionMode) {
  const comments = splitExpertComments(body);
  const chunks = comments.length ? comments : [body.replace(/\s+/g, ' ').trim()];
  const bullets = [];
  for (const chunk of chunks) {
    for (const line of conciseComment(chunk, questionMode)) {
      const text = banLoi(line).trim();
      if (text) bullets.push(text);
    }
  }
  return bullets;
}

function forecastBullet(text) {
  const body = sliceSection(text, FORECAST_HEADING, /Industry Growth|Revenue per Employee|Resources|Products and Operations|Geographic Breakdown/i);
  const paragraph = body.replace(/\s+/g, ' ').trim();
  if (paragraph.length < 40) return '';
  const sentences = sentencesOf(paragraph).slice(0, 2).join(' ');
  return banLoi(sentences);
}

function summarizeExpertInsights(text) {
  const source = String(text || '');
  const found = [];
  for (const [id, heading, startRe] of INSIGHT_DEFS) {
    const next = INSIGHT_DEFS.map(([, , re]) => re).filter((re) => re !== startRe);
    const endRe = new RegExp(next.map((re) => re.source).join('|') + '|Industry Demographics|Products and Operations|Industry Forecast', 'i');
    const body = sliceSection(source, startRe, endRe);
    if (!body || body.length < 20) continue;
    const bullets = bulletsFromSection(body, id === 'dueDiligence');
    if (!bullets.length) continue;
    found.push({ id, heading, text: bullets.map((b) => b.replace(/^[-•]\s*/, '')).join('\n') });
  }
  const forecast = forecastBullet(source);
  if (forecast) {
    const trends = found.find((section) => section.id === 'trends');
    if (trends) {
      if (!trends.text.includes(forecast.slice(0, 40))) trends.text = `${trends.text}\n${forecast}`;
    } else {
      found.push({ id: 'trends', heading: 'Industry trends and forecast', text: forecast });
    }
  }
  return found.length ? found.map(({ heading, text }) => ({ heading, text })) : null;
}

function bulletsToText(value) {
  if (value == null) return '';
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean).join('\n');
  return String(value).trim();
}

function normalizeInsights(value) {
  if (!value) return null;
  let sections = [];
  if (Array.isArray(value)) {
    sections = value.map((section) => ({
      heading: String(section?.heading || section?.title || '').trim(),
      text: banLoi(bulletsToText(section?.text ?? section?.bullets ?? section?.body)),
    }));
  } else if (typeof value === 'object') {
    sections = INSIGHT_DEFS.map(([id, heading]) => ({
      heading,
      text: banLoi(bulletsToText(value[id] ?? value[heading])),
    }));
  }
  sections = sections.filter((section) => section.heading && section.text.replace(/\s+/g, '').length > 0);
  return sections.length ? sections : null;
}

function normalizeNumberList(value) {
  const list = Array.isArray(value) ? value : [];
  const out = [null, null, null];
  for (let i = 0; i < 3; i++) {
    const raw = list[i];
    if (raw == null || raw === '' || /^n\/a$/i.test(String(raw))) {
      out[i] = null;
      continue;
    }
    const n = Number(raw);
    out[i] = Number.isFinite(n) ? round1(n) : null;
  }
  return out;
}

function normalizeRatios(value) {
  if (!value || typeof value !== 'object' || !Array.isArray(value.rows)) return null;
  const years = Array.isArray(value.years) ? value.years.map((year) => String(year).trim()).filter(Boolean).slice(0, 6) : [];
  const rows = [];
  for (const row of value.rows) {
    if (!row || typeof row !== 'object') continue;
    const label = canonicalRatioLabel(cleanRatioLabel(row.label || row.name || ''));
    if (!label) continue;
    rows.push({
      label,
      upper: normalizeNumberList(row.upper),
      median: normalizeNumberList(row.median),
      lower: normalizeNumberList(row.lower),
    });
  }
  return rows.length ? { years, rows } : null;
}

function normalizeRatings(value) {
  if (!Array.isArray(value)) return null;
  const ratings = [];
  for (const row of value) {
    if (!row || typeof row !== 'object') continue;
    const score = Number(row.score);
    const label = String(row.label || '').replace(/\s+/g, ' ').trim();
    if (!label || !Number.isFinite(score) || score < 0 || score > 4) continue;
    ratings.push({
      label,
      score: round1(score),
      scale: banLoi(String(row.scale || '').replace(/\s+/g, ' ').trim()),
    });
  }
  return ratings.length ? ratings : null;
}

function normalizeExpenses(value) {
  if (!value || typeof value !== 'object') return null;
  const read = (key) => {
    const n = Number(value[key]);
    if (!Number.isFinite(n) || n < 0 || n > 100) return null;
    return round1(n);
  };
  const expenses = {
    cogsPct: read('cogsPct'),
    occupancyPct: read('occupancyPct'),
    payrollPct: read('payrollPct'),
    preTaxProfitPct: read('preTaxProfitPct'),
  };
  return Object.values(expenses).some((v) => v != null) ? expenses : null;
}

function normalizeBenchmarks(value) {
  const items = Array.isArray(value) ? value : (typeof value === 'string' ? value.split('\n') : []);
  const cleaned = items.map((item) => banLoi(String(item || '').replace(/\s+/g, ' ').trim())).filter((item) => item.length > 2);
  return cleaned.length ? cleaned : null;
}

const FORBIDDEN_KEY = /mvic/i;

function normalizeIndustryImport(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return data;
  const next = {};
  for (const [key, value] of Object.entries(data)) {
    if (FORBIDDEN_KEY.test(key) && /sale|profit/i.test(key)) continue;
    next[key] = value;
  }
  next.financialRatios = normalizeRatios(next.financialRatios);
  next.expertRatings = normalizeRatings(next.expertRatings);
  next.expertExpenses = normalizeExpenses(next.expertExpenses);
  next.expertBenchmarks = normalizeBenchmarks(next.expertBenchmarks);
  next.expertInsights = normalizeInsights(next.expertInsights);
  return next;
}

function extractIndustryExtras(text) {
  return {
    financialRatios: parseFinancialRatios(text),
    expertRatings: parseExpertRatings(text),
    expertExpenses: parseExpertExpenses(text),
    expertBenchmarks: parseExpertBenchmarks(text),
    expertInsights: summarizeExpertInsights(text),
  };
}

function ratioCellCount(table) {
  if (!table || !Array.isArray(table.rows)) return 0;
  let n = 0;
  for (const row of table.rows) {
    for (const key of ['upper', 'median', 'lower']) {
      n += (row[key] || []).filter((v) => v != null).length;
    }
  }
  return n;
}

const { dealRatioActual, fmtRatio } = require('./industryBenchmarks.cjs');

const INSIGHTS_PROMPT = `Summarize only the narrative sections in this Business Reference Guide excerpt for an M&A advisor. Return ONLY JSON with this shape:
{"sections":[{"heading":"Pricing tips|Financing and deal terms|Industry trends and forecast|Advice for buyers and sellers|Expert due-diligence questions|Business model|Advantages|Disadvantages","text":"one bullet per line"}]}
Rules:
- Use only facts written in the excerpt. Do not add industry knowledge.
- Omit a heading when the excerpt has nothing for it.
- Plain business language. Short bullets. Keep expert figures that are actually stated.
- Never write "LOI" or "letter of intent". If a document says that, write "offer" instead.
- Do not include ratio tables, valuation multiples, demographics, or geography.`;

module.exports = {
  emptyExtras,
  parseFinancialRatios,
  parseExpertRatings,
  parseExpertExpenses,
  parseExpertBenchmarks,
  summarizeExpertInsights,
  normalizeIndustryImport,
  extractIndustryExtras,
  ratioCellCount,
  dealRatioActual,
  fmtRatio,
  banLoi,
  INSIGHTS_PROMPT,
  repairTriple,
  repairRowScale,
};
