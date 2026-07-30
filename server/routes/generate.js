const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const { getDb } = require('../database');

const router = express.Router();

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

// POST /api/generate/blind-ad
router.post('/blind-ad', async (req, res) => {
  const { deal_id } = req.body;
  if (!deal_id) return res.status(400).json({ error: 'deal_id required' });
  const deal = getDb().prepare('SELECT * FROM deals WHERE id = ?').get(deal_id);
  if (!deal) return res.status(404).json({ error: 'Deal not found' });

  let interviewData;
  try { interviewData = JSON.parse(deal.interview_data || '{}'); } catch { interviewData = {}; }

  const client = getClient();
  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      system: `You are a professional business broker copywriter for Peterson Acquisitions / The Deal Team.
You write compelling, factual blind ads for BizBuySell that follow a strict structure.
CRITICAL RULES:
- NEVER reveal the business name, owner name, specific street address, or any detail that would identify the business.
- Use county + state OR general region + state for location only (e.g., "Piedmont Region, NC" or "Central NC").
- NEVER invent or estimate financial figures. Use only what is provided in the data.
- Write in a confident, authoritative tone. Avoid filler language.
- If a field is not provided, omit that line entirely rather than guessing.
- Output must be plain text, copy-paste ready for BizBuySell. No markdown except bold headline (use ** for bold) and bullet points (use - for bullets).`,
      messages: [{
        role: 'user',
        content: `Generate a BizBuySell blind ad using this business data: ${JSON.stringify(interviewData, null, 2)}

Follow this EXACT structure and formatting. Do not add, remove, or reorder sections.

---

**[COMPELLING HEADLINE — industry descriptor + key differentiator + location]**
(Example: "Profitable Landscape & Nursery Business | 20+ Yrs | Recurring Revenue | NC")
[County/Region], [State]

Asking Price: $[X]
Cash Flow (SDE): $[X]
EBITDA: $[X]
Gross Revenue: $[X]
Established: [Year]

**Business Description:**
[3-5 paragraphs. Cover: what the business does, how long established, what makes it durable and defensible,
how it operates day-to-day, owner's role and replaceability, buyer type fit.
Be specific and compelling. No identifying details. No business name. Write each paragraph as a standalone point of value.]

**KEY HIGHLIGHTS:**
- [Profitability / track record note]
- [Customer retention / repeat revenue stat]
- [Customer concentration risk — or lack thereof]
- [Margin or financial strength note]
- [Team / operational stability note]
- [Business model simplicity or defensibility]
- [Upside / growth potential — 1 line]
- [Financial record quality]

**IDEAL BUYER:**
- [Operator background that fits]
- [Industry experience preferred]
- [Entrepreneur profile]
- [Strategic buyer angle if applicable]
- SBA-qualified with 680+ credit score, 10% down, and 10% liquidity post-close

[Asset sale or stock sale note]

**SUPPORT & TRANSITION:**
[1-2 sentences on seller's willingness to train and transition.]

**REASON FOR SELLING:**
[Seller's stated reason — one line]

**REPRESENTATION:**
This opportunity is being handled by ${interviewData.advisor_name || deal.advisor_name || 'an acquisition advisor'} with The Deal Team | Powered by Peterson Acquisitions. An experienced acquisition advisor may follow up to answer questions and guide next steps.

**NEXT STEPS:**
Inquire today for full financials and a confidential business summary. All prospective buyers must sign an NDA and demonstrate financial ability to purchase.

**Detailed Information**

Inventory: $[X]
[Included / Not included] in asking price

Furniture, Fixtures, & Equipment (FF&E): $[X]
[Included / Not included] in asking price

Employees: [X] Full-time[, X Part-time if applicable]

Financing: [Primary financing type]
[1 sentence detail on terms if seller carry or SBA]

Support & Training: [Repeat transition statement]

Reason for Selling: [Repeat reason]

**Business Location**
Location: [County/Region], [State]
Real Estate: [Owned / Leased]
[Building SF: X — if provided]
[Rent: $X/mo — if leased and provided]
[Acreage: X — if relevant and provided]

---

Output the ad exactly as formatted above. Plain text only.`
      }]
    });

    const blindAdText = message.content[0].text;
    getDb().prepare('UPDATE deals SET blind_ad_text = ?, updated_at = ? WHERE id = ?')
      .run(blindAdText, new Date().toISOString(), deal_id);
    res.json({ blind_ad_text: blindAdText });
  } catch (err) {
    console.error('Blind ad generation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/generate/flyer
router.post('/flyer', async (req, res) => {
  const { deal_id } = req.body;
  if (!deal_id) return res.status(400).json({ error: 'deal_id required' });
  const deal = getDb().prepare('SELECT * FROM deals WHERE id = ?').get(deal_id);
  if (!deal) return res.status(404).json({ error: 'Deal not found' });

  let interviewData;
  try { interviewData = JSON.parse(deal.interview_data || '{}'); } catch { interviewData = {}; }

  const client = getClient();
  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      system: `You are a professional graphic designer and copywriter for Peterson Acquisitions.
You generate single-page, print-ready HTML/CSS business listing flyers.

ABSOLUTE RULES — VIOLATION MEANS THE OUTPUT IS REJECTED:
1. Output ONLY a complete, self-contained HTML document. No markdown, no commentary, no code fences.
2. No external dependencies except the Google Fonts CDN link provided.
3. ALL content must be BLIND — no business name, owner name, or specific street address.
4. NEVER fabricate financial figures. Use only data provided.
5. THE ENTIRE FLYER MUST FIT ON EXACTLY ONE PAGE. You MUST include this CSS exactly:
   @page { size: 8.5in 11in; margin: 0; }
   html, body { width: 8.5in; height: 11in; overflow: hidden; margin: 0; padding: 0; }
   .page { width: 8.5in; height: 11in; display: flex; flex-direction: column; overflow: hidden; }
6. NO paragraph-style "Business Analysis" or "Overview" sections. ALL body copy must be bullet points of 15 words or fewer. No exceptions.
7. The advisor contact card goes INSIDE the right sidebar column — NOT as a separate footer or second page.
8. TEXT CONTRAST: body text #111111, headers #1A1A1A, secondary #444444 minimum. This is a print document.`,
      messages: [{
        role: 'user',
        content: `Generate a single-page print-ready business listing flyer. The page is exactly 8.5×11 inches. NOTHING may overflow.

FONTS (include exactly this link tag in <head>):
<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">

BRAND COLORS:
- Header/footer background: #1A1A1A
- Accent / copper: #C1622F
- Page background: #ffffff
- Section header text: #1A1A1A bold Oswald uppercase
- Body / bullet text: #111111 Inter
- Captions / secondary: #444444

REQUIRED CSS (copy exactly into a <style> tag):
@page { size: 8.5in 11in; margin: 0; }
*, *::before, *::after { box-sizing: border-box; }
html, body { width: 8.5in; height: 11in; overflow: hidden; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
.page { width: 8.5in; height: 11in; display: flex; flex-direction: column; overflow: hidden; background: #fff; }

LAYOUT — FIVE ZONES, STRICT HEIGHT BUDGETS (must total ≤ 11in / 1056px at 96dpi):

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ZONE 1 — HEADER BAR  [height: 44px, flex-shrink: 0]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Background #1A1A1A. Single flex row, padding 0 20px.
Left: "PETERSON ACQUISITIONS" in #C1622F Oswald 13px bold + "THE DEAL TEAM" in #888 Inter 10px below.
Right: "OFFERED EXCLUSIVELY · CONFIDENTIAL · NDA REQUIRED" in white Oswald 10px uppercase letter-spacing.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ZONE 2 — HERO  [height: 190px, flex-shrink: 0]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Background #1A1A1A. Two columns: LEFT 55%, RIGHT 45%.
LEFT (padding 20px 16px 16px 20px, vertical flex):
  - Industry category chip: copper pill #C1622F, white Inter 9px bold uppercase, 4px 10px padding, border-radius 2px. Max 1 line.
  - Headline: Oswald bold, white, font-size 26px, line-height 1.15, max 2 lines, margin-top 8px. BLIND (industry + region only, no business name).
  - Tagline: #C1622F Oswald 12px uppercase letter-spacing 0.08em, margin-top 6px. Max 1 line, 10 words max.
  - Description: white Inter 11px, line-height 1.5, margin-top 8px. MAX 2 SENTENCES, 30 words total. Do not start with "This business".
RIGHT: If a photo URL is available use it as a cover image (object-fit: cover, width/height 100%); otherwise fill with a gradient from #2a2a2a to #1a1a1a with a large centered copper "✦" symbol at 48px.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ZONE 3 — METRICS STRIP  [height: 88px, flex-shrink: 0]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
White background. Four equal-width columns, border-right 1px solid #e5e5e5 on first three, padding 10px 16px.
Each column: LABEL in #888 Inter 8px uppercase letter-spacing 0.1em; VALUE in #1A1A1A Oswald bold 22px; YEAR/CAPTION in #C1622F Inter 8px.
Columns (left to right): ASKING PRICE | GROSS REVENUE | CASH FLOW / SDE | VALUATION MULTIPLE
Values: Use the most recent completed fiscal year only (fin_year1_* or revenue_year1 / sde_year1 fields). Format currency as $X,XXX,XXX. Multiple as "X.Xx SDE".
A 3px solid #C1622F bar runs across the full width at the bottom of this zone.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ZONE 4 — MAIN BODY  [flex: 1, min-height: 0, overflow: hidden]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Two columns. Left 62%, right 38%. Both overflow: hidden.

LEFT COLUMN (padding 16px 14px 12px 20px, border-right 2px solid #f0f0f0):
  SECTION A — "KEY HIGHLIGHTS" [Oswald 10px uppercase #C1622F letter-spacing 0.12em, border-bottom 2px solid #C1622F, padding-bottom 3px, margin-bottom 8px]
  Bullet list: 8–10 bullets. Each bullet: copper "▸" marker, Inter 11px #111111, line-height 1.4, margin-bottom 4px.
  RULE: Each bullet MUST be ≤ 15 words. No sub-bullets. No paragraphs. Cover: operating history, locations/fleet, services, competitive moats, workforce, SBA status, real estate, insurance relationships, customer base — whatever applies from the data.

  SECTION B — "KEY FEATURES" [same header style, margin-top 12px]
  2×3 grid of feature badges. Each badge: border 1.5px solid #C1622F, border-radius 4px, padding 5px 8px, display inline-flex, align-items center, gap 6px.
  Badge content: copper circle with white number (Oswald 10px bold, 18px diameter, background #C1622F, border-radius 50%) + label text Inter 10px #111111 bold + value Inter 10px #444444.
  Use exactly 6 badges from: Operating History, Real Estate, Service Type, Employees, Hours, SBA Pre-Approved, Turn-Key, Customer Database, Fleet/Locations, Established Year — pick the 6 most compelling.

RIGHT COLUMN (padding 14px 18px 12px 14px, display flex flex-direction column gap 10px):
  CARD 1 — DEAL TERMS (border 1.5px solid #e0e0e0, border-radius 4px, padding 10px):
    Header: "DEAL TERMS" Oswald 9px #888 uppercase. Then a small table of 4–5 rows: label (#888 Inter 9px) + value (#111111 Inter 10px bold). Include: Price, Down Payment (est. 10% SBA), Financing, Real Estate, Transition.

  CARD 2 — OPERATIONS (same card style):
    Header: "OPERATIONS" Oswald 9px #888 uppercase. 3–4 rows: Hours, Employees, Established, Location (county/region only).

  CARD 3 — ADVISOR (same card style, background #fafafa):
    Header: "YOUR ADVISOR" Oswald 9px #888 uppercase.
    Flex row: advisor name Inter 11px bold #1A1A1A + title Inter 9px #C1622F + phone Inter 10px #111111 + email Inter 9px #444444 + "The Deal Team | Peterson Acquisitions" Inter 8px #888.
    NO photo in the advisor card (photo assets are not available in server context).

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ZONE 5 — FOOTER BAR  [height: 36px, flex-shrink: 0]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Background #1A1A1A. Flex row, padding 0 20px, align-items center, justify-content space-between.
Left: "CONFIDENTIAL — ALL INQUIRIES HANDLED WITH STRICT DISCRETION" #C1622F Oswald 9px uppercase letter-spacing 0.08em.
Right: "TheDealTeam.co  ·  Peterson Acquisitions" white Inter 9px.

FINANCIAL DATA RULE: ALL revenue, SDE, EBITDA, price, and multiple figures MUST come from the most recent completed fiscal year only. Do NOT use YTD, partial-year, or projected figures anywhere on the flyer.

CONTENT RULES:
- No paragraph text anywhere. Everything is a bullet, label, or short value.
- Bullets: maximum 15 words each, no exceptions.
- Hero description: maximum 2 sentences, 30 words total.
- Do not add any section not listed above (no "Overview", no "Business Analysis", no "About", no second advisor block).
- The advisor info is ONLY in Zone 4 Right Column Card 3. Nowhere else.

Business data:
${JSON.stringify(interviewData, null, 2)}

Advisor name: ${deal.advisor_name || 'Your Advisor'}

Output ONLY the complete HTML document starting with <!DOCTYPE html>. Nothing before or after.`
      }]
    });

    const flyerHtml = message.content[0].text;
    getDb().prepare('UPDATE deals SET flyer_html = ?, updated_at = ? WHERE id = ?')
      .run(flyerHtml, new Date().toISOString(), deal_id);
    res.json({ flyer_html: flyerHtml });
  } catch (err) {
    console.error('Flyer generation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/generate/cbr
router.post('/cbr', async (req, res) => {
  const { deal_id } = req.body;
  if (!deal_id) return res.status(400).json({ error: 'deal_id required' });
  const deal = getDb().prepare('SELECT * FROM deals WHERE id = ?').get(deal_id);
  if (!deal) return res.status(404).json({ error: 'Deal not found' });

  let interviewData;
  try { interviewData = JSON.parse(deal.interview_data || '{}'); } catch { interviewData = {}; }

  const brandColor = interviewData.seller_brand_color || '#2D5016';
  const client = getClient();

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 16000,
      system: `You are generating a Confidential Business Review (CBR) for a business acquisition listing.
This is a CONFIDENTIAL document shared only with vetted, NDA-signed buyers.
It must be professional, accurate, and compelling.
CRITICAL RULES:
- Do NOT invent or fabricate any facts, figures, or statistics.
- Use ONLY data provided. If a field is blank, write "To be provided upon NDA execution" or omit gracefully.
- Output ONLY a single, complete, valid HTML document. No preamble, no explanation, no markdown.
- Use page-break-after: always on each .slide for clean PDF pagination.
- The document must be landscape 1920x1080px per slide.
- TEXT CONTRAST IS MANDATORY: All body text on white or light-colored slide backgrounds MUST be #111111. Never use any gray lighter than #444444 for readable body copy. Metric values and data figures must be #1A1A1A bold. Table body text must be #111111. This is a print/presentation document — light gray text on white is completely unacceptable and illegible.`,
      messages: [{
        role: 'user',
        content: `Generate a complete multi-page Confidential Business Review (CBR) as a single HTML document.

Brand system:
- Slide size: 1920x1080px landscape
- Primary dark: #1A1A1A
- Accent copper: #C1622F
- Brand/seller color: ${brandColor}
- White: #FFFFFF
- Body font: Inter 16px #111111 (REQUIRED — near-black for all body text on light backgrounds)
- Secondary/caption text: #444444 maximum — never lighter than this on white/light backgrounds
- Header font: Oswald bold uppercase
- Load fonts: <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
- Every content slide footer: "©${new Date().getFullYear()} Proprietary and Confidential. All Rights Reserved." centered small gray text | Peterson Acquisitions bottom-left | page number bottom-right
- Section divider slides: background #1A1A1A, large 72px Oswald white uppercase centered text
- Content slides: white background, Oswald bold uppercase title top-left, 4px ${brandColor} bar under title

Required slides IN ORDER:
1. COVER: "CONFIDENTIAL BUSINESS REVIEW" large centered Oswald bold white on #1A1A1A bg. Industry/type descriptor (no business name) below in copper. Confidentiality statement italic white below. Peterson footer bar at bottom.
2. TABLE OF CONTENTS: White bg. 3-column icon grid with these sections (use Unicode emoji as icons): Executive Summary 📋, Products & Services 🛍️, Marketing 📣, Sales 📈, Customers 👥, Employees 👤, Financial Information 💰, Growth Opportunities 🌱, Transaction Details 🤝, Deal Team 🏆
3. SECTION DIVIDER: "EXECUTIVE SUMMARY"
4. BUSINESS OVERVIEW: 2-col layout. Left: industry type, year founded, location (city/state), hours, entity type, licenses. Right: business description paragraph, key systems, owner tenure.
5. OWNER BACKGROUND: Origin story, owner skills, typical day, vision/mission. (Do NOT name the owner)
6. BUSINESS MODEL: Bullet list of how business operates, compensation method, SOPs, IP, entity.
7. INDUSTRY OVERVIEW: 2-col. Left: key highlights, trends. Right: challenges, opportunities, profit drivers.
8. KEY HIGHLIGHTS: 3-col info grid with icons — Revenue, SDE, EBITDA, Asking Price, Employees, Est. Year, FFE Value, Real Estate, Down Payment. IMPORTANT: Revenue, SDE, and EBITDA figures here MUST come from the most recent completed fiscal year only (fin_year1_* fields). Display the year label (fin_year1_year) as a small caption under each financial metric so it is clear which tax year is shown.
9. SECTION DIVIDER: "PRODUCTS & SERVICES"
10. PRODUCTS & SERVICES: 2-col. Left: core products/services list with descriptions. Right: pricing strategy, delivery process, unique offerings, diversification.
11. SECTION DIVIDER: "MARKETING"
12. MARKETING: 2-col. Left: branding, channels, online reputation/reviews. Right: positioning, why customers choose, strengths/weaknesses.
13. SECTION DIVIDER: "SALES"
14. SALES: Sales process, trends, channels, seasonality, MRR highlight in branded color box.
15. SECTION DIVIDER: "CUSTOMERS"
16. CUSTOMERS: 2-col. Left: total customers, repeat %, avg revenue per customer, geography, segmentation. Right: satisfaction approach, strengths, database size.
17. SECTION DIVIDER: "EMPLOYEES"
18. ORG CHART: Visual CSS org chart. Owner at top → key direct reports → crew/staff. Use flexbox columns.
19. EMPLOYEE OVERVIEW: Total breakdown FT/PT/seasonal, benefits, compensation, HR systems, post-sale transitions.
20. SECTION DIVIDER: "FINANCIAL INFORMATION"
21. FINANCIAL TABLE: 4-year income summary table. Header row: ${brandColor} bg white text. Alternating white/#F0F5F0 rows. Bold rows for Gross Profit, EBITDA, SDE. Columns: Metric | Year1 | Year2 | Year3 | Year4 — replace "Year1/2/3/4" header labels with the actual year values from fin_year1_year, fin_year2_year, fin_year3_year, fin_year4_year fields (e.g. "2024", "2023", "2022", "2021"). Year 1 (fin_year1_*) is the most recent completed tax year and appears first. Omit columns where no data exists. Rows: Revenue, COGS, Gross Profit, Operating Expenses, Net Income, Depreciation, Interest, EBITDA, Owner Salary Addback, Other Addbacks, SDE. RULE: Only use completed fiscal year data from the fin_year* fields — never infer or use YTD/partial-year figures.
22. REVENUE SEGMENTS: Pie chart visualization using CSS conic-gradient. Show segment names and percentages. Legend below chart.
23. ASSETS: FFE description and value, land/real estate, inventory, total appraised assets table.
24. SECTION DIVIDER: "GROWTH OPPORTUNITIES"
25. GROWTH OPPORTUNITIES: Dark ${brandColor} full-bleed background. White Oswald title. 2-col grid of growth bullets with copper numbering. Compelling framing intro sentence.
26. SECTION DIVIDER: "TRANSACTION DETAILS"
27. TRANSACTION DETAILS: 3 large boxes side-by-side on ${brandColor} bg: "LISTING PRICE" | "DEAL STRUCTURE" | "TRANSITION PLAN". White text. Real estate note below if applicable.
28. BUYER PROCESS: 9-step horizontal flow diagram. Steps: Pre-Qualification → Initial Consult → CBR Meeting → Seller Meeting → Funding Approval → Offer to Purchase → Due Diligence → Closing → Transition. Number each step. Copper connecting arrows. White bg.
29. DEAL TEAM: 5-person grid. For each: Name in Oswald bold, Role/specialty in Inter. Background ${brandColor} cards. Team members from data or default to: Michael (Lead Broker | Deal Structure | Strategy | Negotiations), Robin (Acquisition Advisor | Operations | Due Diligence | Buyer Success), Alisha (Acquisition Advisor | Seller Success), Lee (Lender Liaison | SBA Lending Expert), Lance (Operations | Business Listings | Leads).
30. NEXT STEPS: ${brandColor} bg. "NEXT STEPS" white Oswald title. Closing paragraph about the opportunity. List: 1) Sign NDA, 2) Review CBR, 3) Attend Seller Meeting, 4) Submit LOI. "Contact us today" CTA in copper box.

Business data: ${JSON.stringify(interviewData, null, 2)}
Advisor: ${deal.advisor_name}

IMPORTANT: Output ONLY the complete HTML document starting with <!DOCTYPE html>. No other text.`
      }]
    });

    const cbrHtml = message.content[0].text;
    // Strip any accidental markdown fences
    const cleanHtml = cbrHtml.replace(/^```html\n?/, '').replace(/\n?```$/, '').trim();
    getDb().prepare('UPDATE deals SET cbr_html = ?, updated_at = ? WHERE id = ?')
      .run(cleanHtml, new Date().toISOString(), deal_id);
    res.json({ cbr_html: cleanHtml });
  } catch (err) {
    console.error('CBR generation error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/generate/proxy-messages
// Transparent proxy for legacy index.html Deal Marketing app.
// Accepts the same body as Anthropic /v1/messages, forwards with server-side API key.
router.post('/proxy-messages', async (req, res) => {
  const client = getClient();
  try {
    const { model, max_tokens, system, messages } = req.body;
    const message = await client.messages.create({ model, max_tokens, system, messages });
    res.json(message);
  } catch (err) {
    console.error('Proxy messages error:', err);
    res.status(500).json({ error: { message: err.message } });
  }
});

module.exports = router;
