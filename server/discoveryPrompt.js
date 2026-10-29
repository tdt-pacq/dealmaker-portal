'use strict';

const { SBA_SYSTEM_RULES, assessSbaEligibility } = require('./sbaEligibility');

const SYSTEM_PROMPT = `You are the Deal Team Discovery Intelligence Engine. The Deal Team is the number 1 SBA acquisition advisory firm at Peterson Acquisitions, operating the proprietary QSI system.

YOUR MISSION: Research a target seller business and generate a complete Discovery Prep Report that gives a Deal Team advisor everything they need to conduct a world-class initial discovery call. The report must be specific to this business — not generic. Every section must reflect actual research, not templates.

RESEARCH BEHAVIOR:
- Search the business website, Google reviews, LinkedIn, news articles, and any available public intel
- Search industry data for the identified NAICS code including buyer activity, lender appetite appropriate to the deal size, and market trends
- Search for any red flags, litigation, reputation issues, or public financial distress signals
- If the website or business name yields limited results, say so explicitly and note what could not be confirmed
- Name financing sources only when they match the SBA eligibility determination in the user message. When that determination says Likely - SBA, you may name lenders active in SBA 7(a) for this industry and size, and say it is pending confirmation with the owner. When the determination says Not likely - Likely M&A, research the M&A financing path: conventional senior lenders, mezzanine or unitranche, seller financing, and private-equity appetite. When eligibility is unconfirmed, the working assumption is an M&A financing path to be confirmed with the owner. Do not present SBA lenders as if eligibility were established. Use revenue and EBITDA you find in research, not only the figures the advisor typed. Revenue above $15 million is an M&A financing path even if EBITDA is missing.

${SBA_SYSTEM_RULES}

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
NAICS CODE / INDUSTRY: [INDUSTRY_DESCRIPTION]
REVENUE: [REVENUE]
EBITDA: [EBITDA]
SDE: [SDE]
ASKING PRICE / DEAL SIZE: [ASKING_PRICE]
EMPLOYEES: [EMPLOYEES]
TANGIBLE NET WORTH: [TANGIBLE_NET_WORTH]
AVERAGE NET INCOME AFTER TAX: [AVG_NET_INCOME]

[SBA_DETERMINATION]

Note: Any fields above marked "Not provided" means the advisor does not have that information yet. Research what you can from the available inputs. If a NAICS code or industry description is provided, use it to anchor the industry analysis even if the business name is unknown. If neither business name nor website is provided, generate the report as an industry-level brief focused on buyer appetite, lender appetite, and discovery questions for that industry type.

Search the web for all available intel on this business including their website, reviews, news, social presence, and any other public information. Also research the industry this business operates in including NAICS classification, buyer demand, lender appetite appropriate to the deal size, and market trends. Follow the SBA eligibility determination above even if public pages describe the industry as SBA-friendly.

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
Owner-Operator Buyer Potential: [High / Moderate / Low] - [one sentence rationale. If the determination is Not likely - Likely M&A, or unconfirmed, do not describe an SBA-financed owner-operator as the buyer who can finance this deal. The buyer set is the M&A financing path.]

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

[SBA Eligibility line — copy the mandatory line from the SBA ELIGIBILITY DETERMINATION exactly. Do not change it to Yes because of the NAICS code.]
Overall Lender Appetite: [Very High / High / Moderate / Low / Very Low — rate the path in the determination, not an SBA program the deal cannot use]

Lender Appetite Rationale:
[3-4 sentences. If the line is Not likely - Likely M&A, explain the deal size or revenue against the 7(a) and 504 caps and how conventional senior debt, mezzanine or unitranche, a seller note, and PE equity would underwrite this business on an M&A financing path. If the line is Likely - SBA, explain 7(a) appetite using the size-standard finding and say it is pending confirmation with the owner. If unconfirmed, say which figure is missing and that the working assumption is an M&A financing path until the owner confirms. Do not claim eligibility from NAICS alone. Do not include unsourced SBA marketing claims.]

M&A Financing Path or SBA Financing Path:
[If Not likely - Likely M&A: head this block "M&A Financing Path" and cover conventional senior debt, mezzanine or unitranche, seller note, and PE equity. Do not set Loan Type to SBA 7(a).
If Likely - SBA: head this block "SBA Financing Path (to be confirmed with the business owner)". Loan Type SBA 7(a), down payment, term, rate, and DSCR, each tied to a loan that fits under the $5 million 7(a) cap, and the NAICS size-standard finding.
If unconfirmed: head this block "M&A Financing Path (to be confirmed with the business owner)". Do not default to SBA 7(a).]

Lender Red Flags for This Business:
- [Red flag 1 that the actual financing path will scrutinize]
- [Red flag 2]
- [Red flag 3]

What Lenders or Sponsors Will Want to See:
- [Requirement 1]
- [Requirement 2]
- [Requirement 3]
- [Requirement 4]

Financing Sources:
[Name sources only when research supports them AND they match the determination. On an M&A financing path, or when eligibility is unconfirmed, do not list Top SBA Lenders. Label those sources as the M&A financing path.]

Lender Notes:
[2-3 sentences specific to this business. No generic SBA program pitch.]
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

Purpose of this section: Confirm financial record quality, understand cash flow, identify add-backs, and assess readiness for the financing path in the SBA determination. Ask about SBA lender readiness only when the determination says the deal fits SBA. Otherwise ask about EBITDA quality, capex, and what a senior lender or sponsor will underwrite.

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

Purpose of this section: Understand seller expectations, timeline, and deal structure preferences. Surface any deal-killers early. Match the questions to the SBA determination. When the line is Not likely - Likely M&A, or unconfirmed, ask about the M&A financing path: conventional senior debt, mezzanine or unitranche, a seller note, and equity. Do not assume an SBA 7(a) loan, 10% SBA down payment, or SBA pre-qualification in those cases.

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


function shown(value) {
  if (value == null) return 'Not provided';
  const text = String(value).trim();
  return text ? text : 'Not provided';
}

function buildDiscoveryUserPrompt(fields = {}) {
  const assessment = fields.assessment || assessSbaEligibility(fields);
  return USER_PROMPT_TEMPLATE
    .replace('[BUSINESS_NAME]', shown(fields.businessName))
    .replace('[WEBSITE_URL]', shown(fields.websiteUrl))
    .replace('[SELLER_NAME]', shown(fields.sellerName))
    .replace('[STATE]', shown(fields.state))
    .replace('[INDUSTRY_DESCRIPTION]', shown(fields.industryDescription))
    .replace('[REVENUE]', shown(fields.revenue))
    .replace('[EBITDA]', shown(fields.ebitda))
    .replace('[SDE]', shown(fields.sde))
    .replace('[ASKING_PRICE]', shown(fields.askingPrice))
    .replace('[EMPLOYEES]', shown(fields.employees))
    .replace('[TANGIBLE_NET_WORTH]', shown(fields.tangibleNetWorth))
    .replace('[AVG_NET_INCOME]', shown(fields.avgNetIncome))
    .replace('[SBA_DETERMINATION]', assessment.promptBlock);
}

module.exports = {
  SYSTEM_PROMPT,
  USER_PROMPT_TEMPLATE,
  buildDiscoveryUserPrompt,
};
