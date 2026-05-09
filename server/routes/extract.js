const express = require('express');
const multer = require('multer');
const mammoth = require('mammoth');
const Anthropic = require('@anthropic-ai/sdk');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const isDocx = file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      || file.originalname.endsWith('.docx');
    const isTxt = file.mimetype === 'text/plain' || file.originalname.endsWith('.txt');
    if (isDocx || isTxt) return cb(null, true);
    cb(new Error('Only .docx and .txt files are supported. For PDFs or other formats, copy and paste the text instead.'));
  }
});

const FIELD_DEFINITIONS = `
business_legal_name: Legal business name including DBAs
business_website: Business website URL
year_founded: Year the business was originally founded (4-digit year only)
year_owner_took_over: Year the current owner acquired or took over (4-digit year only)
business_city_state: City and state only, e.g. "Greensboro, NC"
hours_of_operation: Hours the business operates, e.g. "Mon-Fri 8am-5pm"
entity_type: Legal entity type, e.g. "S-Corp", "LLC", "Sole Proprietor"
business_description: 2-5 sentence general description of what the business does (do NOT include the business name)
origin_story: How and why the business was started; founder background story
owner_skills: Owner's background, education, skills, and relevant experience
typical_day: What a typical workday looks like for the owner
primary_roles: Owner's primary roles and day-to-day responsibilities
owner_absent: How the business operates when the owner is away for 2 weeks
vision_mission: Business vision statement and/or mission statement
core_values: Core values of the business
reason_for_selling: Why the owner is selling the business now
top_5_growth: Top 5 growth strategies the owner would pursue if keeping the business (numbered list)
owner_optimistic: What makes the owner most optimistic about the business future
owner_concerns: Owner's biggest concerns about the business
advice_for_buyer: Single best piece of advice for the new buyer
warning_for_buyer: Single most important warning for the new buyer
owner_compensation_method: How the owner pays themselves, e.g. "W-2 salary plus S-Corp distribution"
licenses_held: Professional licenses, permits, or certifications the business holds
key_systems: Key software, technology, SOPs, or operational systems used
intellectual_property: Any trademarks, patents, proprietary methods, or trade secrets
litigation_status: Current or pending litigation status; "None" if clean
industry_highlights: Key positive highlights about the broader industry
industry_trends: Current trends shaping the industry
industry_challenges: Primary challenges facing the industry
industry_opportunities: Key opportunities within the industry
profit_drivers: Main drivers of profit for this business type
regulatory_factors: Political or regulatory factors affecting the business
employees_count: Total employee headcount with FT/PT breakdown, e.g. "12 FT, 4 PT"
asking_price: Asking or listing price as a plain number with no dollar sign or commas, e.g. 1750000
revenue_year1: Most recent full year gross revenue as a plain number, e.g. 2850000
revenue_year1_label: 4-digit year for revenue_year1, e.g. 2024
sde_year1: Most recent SDE (Seller Discretionary Earnings) as a plain number
sde_year1_label: 4-digit year for sde_year1
ebitda_year1: Most recent EBITDA as a plain number
ebitda_year1_label: 4-digit year for ebitda_year1
real_estate_situation: Real estate situation — owned/leased, included in asking price or separate
real_estate_value: Real estate appraised or estimated value as a plain number (if owned)
ffe_value: FF&E (Furniture, Fixtures, Equipment) value as a plain number
inventory_value: Inventory value as a plain number
down_payment_required: Required down payment, e.g. "10% ($175,000)"
sba_preapproved: SBA pre-approval status — exactly one of: "Yes", "No", or "In process"
financing_available: Description of financing options available
core_products: Core products or services offered — use a multi-line list if multiple
pricing_strategy: How the business prices its products or services
delivery_process: How products or services are delivered or fulfilled
unique_offerings: What makes this business unique vs. competitors
product_diversification: Description of product or service line diversification
supplier_diversification: Supplier or vendor diversification description
products_in_development: Products or services currently being developed
future_product_potential: Future product or service expansion potential
branding_strategy: Branding approach and strategy
social_reputation: Online reviews — include star ratings, platforms (Google, Yelp, etc.), and review counts
marketing_channels: Marketing channels used, e.g. "Google Ads, Facebook, referrals, Nextdoor"
marketing_roi_metrics: How marketing return on investment is measured
marketing_strengths: Primary marketing strengths
marketing_weaknesses: Primary marketing weaknesses or gaps
market_positioning: How the business is positioned in the market vs. competitors
why_customers_choose: Why customers choose this business over competitors
sales_process: Step-by-step description of the sales process
sales_trends: Sales trends observed over time
sales_channels: Sales channels used (direct, online, distributor, wholesale, etc.)
sales_responsible: Who is responsible for sales in the business
sales_superstars: Any standout sales performers on the team
sales_growth_opportunities: Growth opportunities specific to the sales function
seasonality: Seasonality or cyclical trends in the business
mrr_amount: Monthly Recurring Revenue (MRR) amount, e.g. "$65,000/month"
mrr: Description of the MRR or recurring revenue model
total_customers: Total number of customers or active accounts
repeat_customer_pct: Percentage of revenue from repeat or long-term customers
customer_satisfaction: Customer satisfaction approach, scores, or programs
customer_service_strengths: Key customer service strengths
customer_service_improvements: Customer service areas needing improvement
avg_revenue_per_customer: Average annual or per-transaction revenue per customer
customer_segmentation: Customer segments and approximate percentage of revenue from each
customer_geography: Geographic distribution of customers
customer_database_size: Size of customer database (active and total)
employee_detail: Employee breakdown FT/PT/seasonal with numbers
org_structure: Organizational structure and reporting hierarchy description
key_employees: Key employees — for each: name, role, and tenure (CBR use only)
employee_challenges: Employee-related challenges (retention, skills gaps, etc.)
compliance_issues: Regulatory or HR compliance issues
hiring_challenges: Hiring or talent acquisition challenges
hr_systems: HR or payroll systems used, e.g. "Gusto", "ADP", "Paychex"
benefits: Employee benefits offered (health, PTO, bonus, etc.)
compensation_approach: Overall compensation philosophy and structure
post_sale_transitions: Which employees are expected to stay or leave post-sale
fin_year1_label: Financial Year 1 label (most recent year), e.g. 2024
fin_year1_revenue: Year 1 total gross revenue, plain number
fin_year1_cogs: Year 1 cost of goods sold, plain number
fin_year1_gross_profit: Year 1 gross profit, plain number
fin_year1_operating_exp: Year 1 total operating expenses, plain number
fin_year1_net_income: Year 1 net income or pre-tax profit, plain number
fin_year1_depreciation: Year 1 depreciation, plain number
fin_year1_amortization: Year 1 amortization, plain number
fin_year1_interest: Year 1 interest expense, plain number
fin_year1_ebitda: Year 1 EBITDA, plain number
fin_year1_owner_salary: Year 1 owner salary or compensation addback, plain number
fin_year1_other_addbacks: Year 1 total other addbacks, plain number
fin_year1_other_addbacks_detail: Year 1 itemized addbacks description
fin_year1_sde: Year 1 SDE (Seller Discretionary Earnings), plain number
fin_year2_label: Financial Year 2 label (second most recent), e.g. 2023
fin_year2_revenue: Year 2 gross revenue, plain number
fin_year2_cogs: Year 2 COGS, plain number
fin_year2_gross_profit: Year 2 gross profit, plain number
fin_year2_operating_exp: Year 2 operating expenses, plain number
fin_year2_net_income: Year 2 net income, plain number
fin_year2_depreciation: Year 2 depreciation, plain number
fin_year2_amortization: Year 2 amortization, plain number
fin_year2_interest: Year 2 interest, plain number
fin_year2_ebitda: Year 2 EBITDA, plain number
fin_year2_owner_salary: Year 2 owner salary addback, plain number
fin_year2_other_addbacks: Year 2 other addbacks total, plain number
fin_year2_other_addbacks_detail: Year 2 itemized addbacks description
fin_year2_sde: Year 2 SDE, plain number
fin_year3_label: Financial Year 3 label, e.g. 2022
fin_year3_revenue: Year 3 gross revenue, plain number
fin_year3_cogs: Year 3 COGS, plain number
fin_year3_gross_profit: Year 3 gross profit, plain number
fin_year3_operating_exp: Year 3 operating expenses, plain number
fin_year3_net_income: Year 3 net income, plain number
fin_year3_depreciation: Year 3 depreciation, plain number
fin_year3_amortization: Year 3 amortization, plain number
fin_year3_interest: Year 3 interest, plain number
fin_year3_ebitda: Year 3 EBITDA, plain number
fin_year3_owner_salary: Year 3 owner salary addback, plain number
fin_year3_other_addbacks: Year 3 other addbacks total, plain number
fin_year3_other_addbacks_detail: Year 3 itemized addbacks description
fin_year3_sde: Year 3 SDE, plain number
fin_year4_label: Financial Year 4 label (oldest), e.g. 2021
fin_year4_revenue: Year 4 gross revenue, plain number
fin_year4_cogs: Year 4 COGS, plain number
fin_year4_gross_profit: Year 4 gross profit, plain number
fin_year4_operating_exp: Year 4 operating expenses, plain number
fin_year4_net_income: Year 4 net income, plain number
fin_year4_depreciation: Year 4 depreciation, plain number
fin_year4_amortization: Year 4 amortization, plain number
fin_year4_interest: Year 4 interest, plain number
fin_year4_ebitda: Year 4 EBITDA, plain number
fin_year4_owner_salary: Year 4 owner salary addback, plain number
fin_year4_other_addbacks: Year 4 other addbacks total, plain number
fin_year4_other_addbacks_detail: Year 4 itemized addbacks description
fin_year4_sde: Year 4 SDE, plain number
fiscal_year_end: Fiscal year end date, e.g. "December 31"
financial_record_system: Accounting or bookkeeping software used, e.g. "QuickBooks Online, CPA-reviewed"
accuracy_rating: Financial record accuracy self-rating 1-10 (number only)
records_current: Are records current and up to date? Exactly "Yes" or "No"
asset_list_available: Is a detailed asset list available? Exactly "Yes", "No", or "In progress"
assets_not_conveyed: Assets that will NOT be included in the sale
cash_flow_status: Description of current cash flow health
cash_flow_decline: Causes of any cash flow decline (if none, omit this field)
industry_benchmarks: How the business compares to industry benchmarks or averages
five_year_projections: Are 5-year financial projections available? Exactly "Yes", "No", or "In development"
rev_segment1_name: Revenue segment 1 name, e.g. "Landscape Installation"
rev_segment1_pct: Revenue segment 1 percentage, number only e.g. 40
rev_segment2_name: Revenue segment 2 name
rev_segment2_pct: Revenue segment 2 percentage
rev_segment3_name: Revenue segment 3 name
rev_segment3_pct: Revenue segment 3 percentage
rev_segment4_name: Revenue segment 4 name
rev_segment4_pct: Revenue segment 4 percentage
rev_segment5_name: Revenue segment 5 name
rev_segment5_pct: Revenue segment 5 percentage
ffe_description: Detailed description of FF&E with appraised or estimated value
land_value: Land or real estate appraised value, plain number
inventory_appraised: Inventory appraised value with any seasonal variability notes
total_appraised_assets: Total appraised asset value, plain number
growth_opportunities: Growth opportunities as a numbered list, one per line
listing_price: Listing price, plain number (may duplicate asking_price)
down_payment_pct: Down payment percentage description, e.g. "10% SBA / 20-25% conventional"
deal_structure: Deal structure preference — asset purchase vs. stock sale, real estate terms
financing_type: Financing type available — "SBA 7(a)", "seller carry", "conventional", etc.
transition_plan: Seller transition plan — duration, training, consulting arrangement
buyer_process_notes: Preferred buyer profile, industry experience required, special requirements
seller_brand_color: Seller's primary brand color as hex code, e.g. "#2D5016"
`.trim();

const EXTRACTION_SYSTEM_PROMPT = `You are an expert business acquisition data extractor working for Peterson Acquisitions, a professional business brokerage firm.

Your job is to read a seller interview transcript, interview notes, or business summary document and extract structured data that maps directly to the firm's interview form fields.

EXTRACTION RULES:
1. Extract ONLY information that is explicitly present in the document. Do NOT infer, fabricate, estimate, or assume any values.
2. Polish the extracted text into clean, professional language suitable for a business listing document. Fix grammar, remove filler words and verbal tics (um, you know, like, sort of), tighten run-on sentences — but preserve all factual content exactly as stated.
3. For financial fields (revenue, SDE, EBITDA, prices, values): output plain numbers only — no dollar signs, no commas, no "M" or "K" abbreviations. Convert "$2.8 million" to 2800000. Convert "$850K" to 850000.
4. For year fields: output 4-digit years only, e.g. 2024.
5. For multi-year financial data: map the most recent year's data to fin_year1_*, second most recent to fin_year2_*, etc.
6. If a field is not addressed in the document, OMIT it from the output entirely. Do not include fields with null, empty string, or placeholder values.
7. For list fields (growth_opportunities, key_employees, top_5_growth, etc.): format as a clean numbered list with one item per line.
8. Output ONLY a valid JSON object. No preamble, no explanation, no markdown code fences, no commentary.

FIELD DEFINITIONS:
${FIELD_DEFINITIONS}

OUTPUT: A single valid JSON object where each key is exactly one of the field names defined above and each value is the extracted and polished string (or number as string for financial fields). Include only fields where content was found.`;

// POST /api/extract/interview
router.post('/interview', upload.single('file'), async (req, res) => {
  let rawText = '';

  if (req.file) {
    const isDocx = req.file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      || req.file.originalname.endsWith('.docx');
    if (isDocx) {
      try {
        const result = await mammoth.extractRawText({ buffer: req.file.buffer });
        rawText = result.value;
      } catch (err) {
        return res.status(422).json({ error: `Could not read .docx file: ${err.message}` });
      }
    } else {
      rawText = req.file.buffer.toString('utf-8');
    }
  }

  if (req.body.text && req.body.text.trim()) {
    rawText = rawText
      ? rawText + '\n\n---\n\n' + req.body.text.trim()
      : req.body.text.trim();
  }

  if (!rawText.trim()) {
    return res.status(400).json({ error: 'No content provided. Upload a .docx/.txt file or paste text.' });
  }

  // Truncate to ~100k chars to stay within model context
  if (rawText.length > 100000) {
    rawText = rawText.slice(0, 100000) + '\n\n[Document truncated at 100,000 characters]';
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      system: EXTRACTION_SYSTEM_PROMPT,
      messages: [{
        role: 'user',
        content: `Extract structured business interview data from the following document and return a JSON object mapping field names to extracted values.\n\n<document>\n${rawText}\n</document>`
      }]
    });

    const responseText = message.content[0].text;
    const cleaned = responseText
      .replace(/^```json\n?/, '')
      .replace(/^```\n?/, '')
      .replace(/\n?```$/, '')
      .trim();

    let extracted;
    try {
      extracted = JSON.parse(cleaned);
    } catch {
      return res.status(500).json({
        error: 'Claude returned malformed JSON. Try simplifying the document or pasting a smaller section.',
        debug: responseText.slice(0, 300)
      });
    }

    // Filter out any null/empty values Claude may have included despite instructions
    const clean = Object.fromEntries(
      Object.entries(extracted).filter(([, v]) => v !== null && v !== '' && v !== undefined)
    );

    const fields_found = Object.keys(clean);
    res.json({ extracted: clean, field_count: fields_found.length, fields_found });

  } catch (err) {
    console.error('Extraction error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Multer error handler for this router
router.use((err, _req, res, _next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large. Maximum size is 20MB.' });
  }
  res.status(400).json({ error: err.message });
});

module.exports = router;
