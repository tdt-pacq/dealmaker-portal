const express = require('express');
const router = express.Router();

// ─── PROMPTS ──────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are the Deal Team Discovery Intelligence Engine. The Deal Team is the number 1 SBA acquisition advisory firm at Peterson Acquisitions, operating the proprietary QSI system.

YOUR MISSION: Research a target seller business and generate a complete Discovery Prep Report that gives a Deal Team advisor everything they need to conduct a world-class initial discovery call. The report must be specific to this business — not generic. Every section must reflect actual research, not templates.

RESEARCH BEHAVIOR:
- Search the business website, Google reviews, LinkedIn, news articles, and any available public intel
- Search industry data for the identified NAICS code including buyer activity, SBA lender appetite, and market trends
- Search for any red flags, litigation, reputation issues, or public financial distress signals
- If the website or business name yields limited results, say so explicitly and note what could not be confirmed

TONE AND VOICE:
- Direct, professional, advisor-ready
- Write as if briefing a senior dealmaker before an important client meeting
- Be specific. Avoid generic statements that could apply to any business.
- Flag uncertainty clearly rather than stating guesses as fact

BVO FRAMEWORK:
The BVO (Business Valuation Optimization) framework has eight sections. Generate 5 to 8 targeted discovery questions for each section based on what was found in research. Questions must be specific to this business and seller situation — not generic interview questions.

BVO Sections:
1. Executive Summary and Business Overview
2. Products and Services
3. Marketing
4. Sales
5. Customers
6. Employees
7. Financials
8. Transition and Deal Structure

QUESTION QUALITY STANDARD:
- Each question must have a clear purpose: uncovering a risk, confirming a strength, or surfacing information needed for valuation or deal fit
- Prioritize questions that reveal owner dependency, customer concentration, revenue transferability, and financial accuracy
- Include at least two questions per section that a less experienced advisor would not think to ask
- End each section with one question designed to build rapport and trust with the seller

OUTPUT FORMAT:
Return the complete report wrapped in XML tags as specified in the user prompt. Do not add preamble or explanation outside the tags.`;

const USER_PROMPT_TEMPLATE = `Research the following business and generate a complete Discovery Prep Report for a Deal Team advisor preparing for an initial seller discovery call.

BUSINESS NAME: [BUSINESS_NAME]
WEBSITE: [WEBSITE_URL]
SELLER NAME: [SELLER_NAME]
STATE: [STATE]
NAICS CODE: [NAICS_CODE]
INDUSTRY DESCRIPTION: [INDUSTRY_DESCRIPTION]

Note: Any fields above marked "Not provided" means the advisor does not have that information yet. Research what you can from the available inputs. If a NAICS code or industry description is provided, use it to anchor the industry analysis even if the business name is unknown. If neither business name nor website is provided, generate the report as an industry-level brief focused on buyer appetite, lender appetite, and discovery questions for that industry type.

Search the web for all available intel on this business including their website, reviews, news, social presence, and any other public information. Also research the industry this business operates in including NAICS classification, buyer demand, SBA lender appetite, and market trends.

Return the complete report in this exact XML structure:

<business_intel>
BUSINESS INTELLIGENCE SUMMARY

Business Name: [name]
Website: [url]
Location: [city, state if found]
Years in Operation: [estimated or confirmed]
Owner(s): [seller name plus any other principals found]
Business Phone: [if found]
Legal Entity: [if found]

Overview:
[3-5 sentences describing what the business does, who it serves, and how it operates based on research. Be specific to this business.]

Online Presence Assessment:
Website Quality: [Strong / Moderate / Weak] - [one sentence rationale]
Google Rating: [rating and review count if found, or Not Found]
Social Media: [platforms active on, follower counts if notable, or Not Found]
Online Reputation Summary: [2-3 sentences on what reviews and public sentiment reveal]

Notable Intel:
[Bullet list of anything significant found: news coverage, awards, expansion, ownership changes, litigation, notable clients, press mentions. If nothing found, state that explicitly.]

Red Flags Found:
[Any negative signals: BBB complaints, litigation, Yelp issues, news of financial distress, regulatory violations. If none found, state: No red flags identified in public records.]
</business_intel>

<industry_analysis>
INDUSTRY ANALYSIS AND NAICS CODE

NAICS Code: [code]
NAICS Description: [official description]
Confidence: [High / Medium / Low] - [one sentence rationale for the classification]

Industry Overview:
[3-4 sentences on the state of this industry nationally and in the seller's region. Include market size, growth trajectory, and key dynamics.]

Key Industry Trends:
- [Trend 1 with brief explanation of relevance to this deal]
- [Trend 2]
- [Trend 3]
- [Trend 4]

Primary Industry Challenges:
- [Challenge 1]
- [Challenge 2]
- [Challenge 3]

Industry Profit Drivers:
- [Driver 1]
- [Driver 2]
- [Driver 3]

Political and Regulatory Environment:
[2-3 sentences on any regulatory, licensing, or political factors affecting this industry that a buyer would need to understand]
</industry_analysis>

<buyer_appetite>
BUYER APPETITE ASSESSMENT

Overall Buyer Demand: [Very High / High / Moderate / Low / Very Low]

Demand Rating Rationale:
[3-4 sentences explaining why buyer demand is rated as it is for this industry and business type. Reference specific buyer types actively seeking businesses like this.]

Primary Buyer Profiles for This Business:
- Buyer Type 1: [description of who would buy this and why]
- Buyer Type 2: [description]
- Buyer Type 3: [description]

Strategic Buyer Potential: [High / Moderate / Low] - [one sentence rationale]
Financial Buyer Potential: [High / Moderate / Low] - [one sentence rationale]
Owner-Operator Buyer Potential: [High / Moderate / Low] - [one sentence rationale]

Key Value Drivers That Will Attract Buyers:
- [Driver 1 specific to this business]
- [Driver 2]
- [Driver 3]

Buyer Concerns to Anticipate:
- [Concern 1 — what buyers will push back on or need to see addressed]
- [Concern 2]
- [Concern 3]

Market Activity:
[2-3 sentences on current transaction activity in this industry segment. How many similar businesses are selling, what are they trading at, and how long are they typically on market.]
</buyer_appetite>

<lender_appetite>
LENDER AND SBA APPETITE ASSESSMENT

SBA Eligibility: [Yes / Likely / Unlikely / No] - [one sentence rationale]
Overall Lender Appetite: [Very High / High / Moderate / Low / Very Low]

Lender Appetite Rationale:
[3-4 sentences on why lenders are or are not interested in this industry and business type. Reference any SBA preferred industries or flagged industries.]

Typical SBA Deal Structure for This Industry:
Loan Type: SBA 7(a)
Typical Down Payment: [percentage range]
Typical Loan Term: [years]
Typical Interest Rate: [current rate range]
Typical DSCR Requirement: [range]

Lender Red Flags for This Industry:
- [Red flag 1 that lenders will scrutinize]
- [Red flag 2]
- [Red flag 3]

What Lenders Will Want to See:
- [Requirement 1]
- [Requirement 2]
- [Requirement 3]
- [Requirement 4]

Lender Notes:
[2-3 sentences on any special considerations, SBA industry restrictions, or lender preferences specific to this business type that the advisor should know before the call]
</lender_appetite>

<bvo_questions>
DISCOVERY QUESTIONS BY BVO FRAMEWORK SECTION

--- SECTION 1: EXECUTIVE SUMMARY AND BUSINESS OVERVIEW ---

Purpose of this section: Understand the full story of the business, the owner, and the reason for selling. Surface owner dependency and confirm basic deal viability.

Questions:
1. [Question — specific to this business based on research]
2. [Question]
3. [Question]
4. [Question]
5. [Question]
6. [Question — designed to build rapport and trust]

Advisor Notes for This Section:
[1-2 sentences on what to listen for or watch out for based on what was found in research]

--- SECTION 2: PRODUCTS AND SERVICES ---

Purpose of this section: Understand what the business actually sells, how it is differentiated, and whether the revenue is transferable to a new owner.

Questions:
1. [Question — specific to this business]
2. [Question]
3. [Question]
4. [Question]
5. [Question]
6. [Question — rapport builder]

Advisor Notes for This Section:
[1-2 sentences]

--- SECTION 3: MARKETING ---

Purpose of this section: Assess the strength and transferability of the marketing engine. Understand reputation, online presence, and lead generation.

Questions:
1. [Question — specific to this business, informed by online presence findings]
2. [Question]
3. [Question]
4. [Question]
5. [Question]
6. [Question — rapport builder]

Advisor Notes for This Section:
[1-2 sentences]

--- SECTION 4: SALES ---

Purpose of this section: Understand how revenue is generated, who drives it, and whether it survives an ownership transition.

Questions:
1. [Question]
2. [Question]
3. [Question]
4. [Question]
5. [Question]
6. [Question — rapport builder]

Advisor Notes for This Section:
[1-2 sentences]

--- SECTION 5: CUSTOMERS ---

Purpose of this section: Assess customer concentration risk, loyalty, and transferability. Identify any single-customer dependencies that would affect valuation or lender appetite.

Questions:
1. [Question]
2. [Question]
3. [Question]
4. [Question]
5. [Question]
6. [Question — rapport builder]

Advisor Notes for This Section:
[1-2 sentences]

--- SECTION 6: EMPLOYEES ---

Purpose of this section: Understand the team structure, key person risk, and whether the business can operate without the owner.

Questions:
1. [Question]
2. [Question]
3. [Question]
4. [Question]
5. [Question]
6. [Question — rapport builder]

Advisor Notes for This Section:
[1-2 sentences]

--- SECTION 7: FINANCIALS ---

Purpose of this section: Confirm financial record quality, understand cash flow, identify add-backs, and assess SBA lender readiness.

Questions:
1. [Question]
2. [Question]
3. [Question]
4. [Question]
5. [Question]
6. [Question]
7. [Question]
8. [Question — rapport builder]

Advisor Notes for This Section:
[1-2 sentences — note any financial red flags surfaced in research]

--- SECTION 8: TRANSITION AND DEAL STRUCTURE ---

Purpose of this section: Understand seller expectations, timeline, and deal structure preferences. Surface any deal-killers early.

Questions:
1. [Question]
2. [Question]
3. [Question]
4. [Question]
5. [Question]
6. [Question — rapport builder]

Advisor Notes for This Section:
[1-2 sentences]
</bvo_questions>

<additional_questions>
ADDITIONAL DEAL-SPECIFIC QUESTIONS

These questions are generated based on specific findings from the research on this business. They go beyond the standard BVO framework and are designed to surface deal-specific risks, opportunities, or information gaps.

Deal-Specific Questions:
1. [Question based on a specific finding — state the finding it is based on]
2. [Question]
3. [Question]
4. [Question]
5. [Question]

Opening Questions to Build Rapport Before the Framework:
1. [Warm opener specific to this seller and business]
2. [Second opener]
3. [Third opener]

Closing Questions to End the Call Strong:
1. [Question that surfaces urgency or timeline]
2. [Question that positions Deal Team as the right advisor]
3. [Question that gets a clear next step commitment]

One Question That Could Make or Break This Deal:
[The single most important question for this specific business and seller situation, with a brief explanation of why]
</additional_questions>`;

// ─── JOB STORE (in-memory) ────────────────────────────────────────────────────
// Each job: { status: 'processing'|'complete'|'error', text?, error?, createdAt }
// Auto-cleaned after 10 minutes.

const jobs = new Map();

function makeJobId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

async function runJob(jobId, businessName, websiteUrl, sellerName, state, naicsCode, industryDescription) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  const userPrompt = USER_PROMPT_TEMPLATE
    .replace('[BUSINESS_NAME]', businessName || 'Not provided')
    .replace('[WEBSITE_URL]', websiteUrl || 'Not provided')
    .replace('[SELLER_NAME]', sellerName || 'Not provided')
    .replace('[STATE]', state || 'Not provided')
    .replace('[NAICS_CODE]', naicsCode || 'Not provided')
    .replace('[INDUSTRY_DESCRIPTION]', industryDescription || 'Not provided');

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-5',
        max_tokens: 16000,
        system: SYSTEM_PROMPT,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: userPrompt }],
      }),
      signal: AbortSignal.timeout(270000),
    });

    if (!upstream.ok) {
      const err = await upstream.json().catch(() => ({}));
      jobs.set(jobId, { status: 'error', error: err.error?.message || `Anthropic API error ${upstream.status}`, createdAt: Date.now() });
      return;
    }

    const data = await upstream.json();
    const text = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');

    if (!text) {
      jobs.set(jobId, { status: 'error', error: 'No text content in API response. Please retry.', createdAt: Date.now() });
      return;
    }

    jobs.set(jobId, { status: 'complete', text, createdAt: Date.now() });

  } catch (err) {
    const msg = (err.name === 'TimeoutError' || err.name === 'AbortError')
      ? 'Research timed out. Please retry.'
      : (err.message || 'Unexpected error during research.');
    jobs.set(jobId, { status: 'error', error: msg, createdAt: Date.now() });
  }

  // Auto-clean after 10 minutes
  setTimeout(() => jobs.delete(jobId), 600000);
}

// ─── ROUTES ───────────────────────────────────────────────────────────────────

// POST /api/discovery — start a job, return job ID immediately
router.post('/', (req, res) => {
  const { businessName, websiteUrl, sellerName, state, naicsCode, industryDescription } = req.body;

  // At least one field must be provided
  if (!businessName && !websiteUrl && !state && !naicsCode && !industryDescription) {
    return res.status(400).json({ error: 'At least one field is required to generate a report.' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured on server.' });
  }

  const jobId = makeJobId();
  jobs.set(jobId, { status: 'processing', createdAt: Date.now() });

  // Fire-and-forget — runs in background while client polls
  runJob(jobId, businessName, websiteUrl, sellerName, state, naicsCode, industryDescription);

  res.json({ jobId });
});

// GET /api/discovery/:jobId — poll job status
router.get('/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found. It may have expired — please start a new report.' });
  res.json(job);
});

module.exports = router;
