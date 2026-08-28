const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const { getDb, logEvent } = require('../database');

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
      model: 'claude-sonnet-5',
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
    logEvent(deal_id, req.user, 'blind_ad_generated', 'Blind ad generated');
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
      model: 'claude-sonnet-5',
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
    logEvent(deal_id, req.user, 'flyer_generated', 'One-page flyer generated');
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
      model: 'claude-sonnet-5',
      max_tokens: 16000,
      system: `You are generating a Confidential Business Review (CBR) for a business acquisition listing.
This is a CONFIDENTIAL document shared only with vetted, NDA-signed buyers.
It must be professional, accurate, and compelling.

CRITICAL RULES:
- Do NOT invent or fabricate any facts, figures, or statistics.
- Use ONLY data provided. If a field is blank, write "To be provided upon NDA execution" or omit gracefully.
- Output ONLY a single, complete, valid HTML document. No preamble, no explanation, no markdown.
- TEXT CONTRAST IS MANDATORY: All body text on white/light backgrounds MUST be #111111. Never use gray lighter than #444444 for body copy. This is a print document — light gray on white is illegible.

PAGE BREAK RULES — THIS IS THE MOST IMPORTANT SECTION:
- Section divider pages get: page-break-before: always; page-break-after: always; (full isolated page)
- Content pages get: page-break-before: always; (start fresh page) but NO page-break-after — content flows naturally to next content section
- Every content block (section-block div) gets: page-break-inside: avoid; (never split a content block across pages)
- NEVER put page-break-after on a content block — this creates near-blank pages when content is short
- If two related content sections fit on one page, they SHARE the page — no forced break between them
- Result: short sections pair together naturally; long sections flow onto the next page only when needed

RIGHT SIDEBAR RULE:
- Every content page has a right sidebar (28% width)
- The sidebar MUST contain real, useful content — a callout box with 3-5 key stats, a highlighted bullet list, or a "Why This Deal" box
- NEVER leave the sidebar empty or purely decorative — empty space looks unprofessional`,
      messages: [{
        role: 'user',
        content: `Generate a complete multi-page Confidential Business Review (CBR) as a single HTML document.

FONTS (include in <head>):
<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">

BRAND SYSTEM:
- Primary dark: #1A1A1A
- Accent copper: #C1622F
- Brand/seller color: ${brandColor}
- Body font: Inter 15px #111111
- Secondary text: #444444 (never lighter on white bg)
- Headers: Oswald bold uppercase

BASE CSS (include in <style>):
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Inter', sans-serif; font-size: 15px; color: #111111; background: white; }
.section-divider { page-break-before: always; page-break-after: always; background: #1A1A1A; width: 100%; min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
.content-page { page-break-before: always; display: flex; flex-direction: column; min-height: 100vh; padding: 0; }
.content-body { display: flex; flex: 1; }
.main-col { flex: 1; padding: 40px 32px 32px 40px; }
.sidebar { width: 28%; padding: 40px 28px 32px 24px; background: #f8f8f8; border-left: 3px solid ${brandColor}; }
.section-label { font-family: 'Oswald', sans-serif; font-size: 10px; font-weight: 600; letter-spacing: 0.15em; color: #888; text-transform: uppercase; margin-bottom: 6px; }
.page-title { font-family: 'Oswald', sans-serif; font-size: 28px; font-weight: 700; color: #1A1A1A; text-transform: uppercase; margin-bottom: 4px; }
.title-bar { height: 4px; background: ${brandColor}; width: 56px; margin-bottom: 24px; }
.section-block { page-break-inside: avoid; margin-bottom: 24px; }
.sub-heading { font-family: 'Oswald', sans-serif; font-size: 12px; font-weight: 600; color: ${brandColor}; text-transform: uppercase; letter-spacing: 0.1em; border-bottom: 1.5px solid ${brandColor}; padding-bottom: 4px; margin-bottom: 10px; }
p { line-height: 1.65; margin-bottom: 10px; color: #111111; }
ul { list-style: none; padding: 0; }
ul li { padding: 4px 0 4px 16px; position: relative; line-height: 1.5; color: #111111; }
ul li::before { content: "▸"; position: absolute; left: 0; color: ${brandColor}; font-size: 10px; top: 6px; }
.callout-box { background: #1A1A1A; color: white; border-radius: 4px; padding: 16px; margin-bottom: 16px; page-break-inside: avoid; }
.callout-box .cb-label { font-size: 9px; font-family: 'Oswald', sans-serif; letter-spacing: 0.12em; text-transform: uppercase; color: #C1622F; margin-bottom: 4px; }
.callout-box .cb-value { font-family: 'Oswald', sans-serif; font-size: 22px; font-weight: 700; color: white; line-height: 1.1; }
.callout-box .cb-caption { font-size: 10px; color: #aaa; margin-top: 2px; }
.stat-row { display: flex; justify-content: space-between; align-items: baseline; padding: 6px 0; border-bottom: 1px solid #e8e8e8; }
.stat-row:last-child { border-bottom: none; }
.stat-label { font-size: 12px; color: #444; }
.stat-value { font-family: 'Oswald', sans-serif; font-size: 14px; font-weight: 600; color: #1A1A1A; }
.page-footer { background: #f0f0f0; border-top: 1px solid #ddd; padding: 8px 40px; display: flex; justify-content: space-between; align-items: center; font-size: 10px; color: #666; }
table { width: 100%; border-collapse: collapse; font-size: 13px; page-break-inside: avoid; }
th { background: ${brandColor}; color: white; font-family: 'Oswald', sans-serif; font-weight: 600; padding: 10px 12px; text-align: left; font-size: 12px; letter-spacing: 0.05em; }
td { padding: 8px 12px; border-bottom: 1px solid #eee; color: #111111; }
tr:nth-child(even) td { background: #f7f7f7; }
tr.bold-row td { font-weight: 700; color: #1A1A1A; background: #eef0f8; }
tr.sde-row td { font-weight: 700; color: ${brandColor}; font-size: 14px; background: #fff8f4; }

REQUIRED PAGES IN ORDER:

━━━ PAGE 1: COVER ━━━
Class: (no page class — first page, no break needed)
Full-page dark background #1A1A1A. Center-aligned vertically and horizontally.
- Top: "CONFIDENTIAL BUSINESS REVIEW" — Oswald 13px #C1622F uppercase letter-spacing
- Middle: Industry descriptor (no business name) — Oswald bold 52px white, max 2 lines
- Tagline: italic Inter 16px #ccc, 1 sentence about the business opportunity
- Separator: 3px line half copper half gray, 80px wide, margin 24px auto
- Confidentiality notice: Inter 12px #888 italic
- Bottom bar: #C1622F strip 60px tall — left: "PETERSON ACQUISITIONS | THE DEAL TEAM" Oswald 14px white; right: "Offered Exclusively · Strictly Confidential" Inter 11px white

━━━ PAGE 2: TABLE OF CONTENTS ━━━
Class: content-page (page-break-before: always)
White background. No sidebar on this page (full width).
Header: "TABLE OF CONTENTS" page-title, date subtitle "As of [current month year]"
8-section grid (2 columns × 4 rows). Each cell: circle number in ${brandColor} bg, section name Oswald bold 15px, subtitle Inter 12px #444.
Sections: 1 Executive Summary, 2 Business Description, 3 Operational Information, 4 Financial Information, 5 Market Price Valuation, 6 Growth Opportunities, 7 Transaction Details, 8 Next Steps
Confidentiality notice in a bordered box below the grid.

━━━ PAGE 3: SECTION DIVIDER — EXECUTIVE SUMMARY ━━━
Class: section-divider
Dark #1A1A1A full page. Center: "EXECUTIVE SUMMARY" Oswald bold 64px white uppercase. Gray/copper divider line below.

━━━ PAGE 4: BUSINESS OVERVIEW + KEY HIGHLIGHTS ━━━
Class: content-page
Section label: EXECUTIVE SUMMARY
Left column:
  - "BUSINESS OVERVIEW" page-title + title-bar
  - section-block: Business description paragraph (3-4 sentences on what the business does, how long established, operating structure)
  - section-block: sub-heading "BUSINESS DETAILS" — stat-row table: Industry, Founded, City/State, Hours, Entity Type, Licenses, Employees, Owner Tenure
  - section-block: sub-heading "KEY SYSTEMS & INFRASTRUCTURE" — bullet list of systems, SOPs, IP
Right sidebar:
  - callout-box: ASKING PRICE — value from listing_price or asking_price
  - callout-box: MOST RECENT REVENUE — fin_year1_revenue with year label caption
  - callout-box: CASH FLOW / SDE — fin_year1_sde with year label caption
  - stat-row list: Est. Year, Real Estate, SBA Eligible, Down Payment Est.

━━━ PAGE 5: OWNER BACKGROUND + INDUSTRY OVERVIEW ━━━
Class: content-page (NO page-break-before — flows from page 4 only if needed, otherwise starts new page)
IMPORTANT: If page 4 content is long, this starts a new page. Use page-break-before: always here.
Section label: EXECUTIVE SUMMARY
Left column:
  - "OWNER BACKGROUND" page-title + title-bar
  - section-block: Origin story / how business was founded paragraph
  - section-block: sub-heading "OWNER'S ROLE TODAY" — typical day, primary responsibilities, how long owner could be absent
  - section-block: sub-heading "REASON FOR SELLING" — seller's stated reason (1-2 sentences)
  - sub-heading "INDUSTRY OVERVIEW" (new section within same page)
  - section-block: Industry size, trends, outlook paragraph
  - section-block: sub-heading "COMPETITIVE LANDSCAPE" — challenges, opportunities as bullets
Right sidebar:
  - sub-heading "OWNER PROFILE"
  - bullet list: key skills, industry experience, transition willingness
  - sub-heading "INDUSTRY AT A GLANCE"
  - stat-row list: market size data, growth rate, SBA lending notes

━━━ PAGE 6: SECTION DIVIDER — BUSINESS DESCRIPTION ━━━
Class: section-divider

━━━ PAGE 7: PRODUCTS & SERVICES + CUSTOMERS ━━━
Class: content-page
Section label: BUSINESS DESCRIPTION
Left column:
  - "PRODUCTS & SERVICES" page-title + title-bar
  - section-block: 2-3 sentence overview of what the business sells/provides
  - section-block: sub-heading "CORE OFFERINGS" — bullet list of products/services with short descriptions
  - section-block: sub-heading "PRICING & DELIVERY" — pricing strategy, delivery process
  - section-block: sub-heading "COMPETITIVE ADVANTAGES" — unique offerings, diversification, moats
  - [new sub-section on same page]: sub-heading "CUSTOMER BASE"
  - section-block: Total customers, repeat %, segmentation breakdown, geography paragraph
Right sidebar:
  - sub-heading "REVENUE MIX"
  - If revenue segments available: show as a simple labeled list with % bars (CSS width-based)
  - sub-heading "CUSTOMER HIGHLIGHTS"
  - stat-rows: Total Customers, Repeat/Contract %, Avg Revenue/Customer, Database Size

━━━ PAGE 8: MARKETING & SALES ━━━
Class: content-page
Section label: BUSINESS DESCRIPTION
Left column:
  - "MARKETING & SALES" page-title + title-bar
  - section-block: sub-heading "MARKETING CHANNELS" — bullet list of channels, online reputation/reviews, branding approach
  - section-block: sub-heading "MARKET POSITIONING" — why customers choose this business, positioning vs competitors
  - section-block: sub-heading "SALES PROCESS" — how leads come in, sales cycle, who is responsible
  - section-block: sub-heading "SALES PERFORMANCE" — trends, YoY growth, MRR if available, seasonality
Right sidebar:
  - sub-heading "REPUTATION"
  - Review scores, social following stats, notable relationships
  - sub-heading "SALES SNAPSHOT"
  - stat-rows: Sales channel breakdown, close rate data, seasonality notes, MRR if applicable

━━━ PAGE 9: SECTION DIVIDER — OPERATIONAL INFORMATION ━━━
Class: section-divider

━━━ PAGE 10: OPERATIONS + ORG STRUCTURE ━━━
Class: content-page
Section label: OPERATIONAL INFORMATION
Left column:
  - "OPERATIONS & MANAGEMENT" page-title + title-bar
  - section-block: sub-heading "LOCATION & FACILITIES" — physical locations, sq footage, real estate situation
  - section-block: sub-heading "DAILY OPERATIONS" — how the business runs day to day, key workflows, systems
  - section-block: sub-heading "MANAGEMENT STRUCTURE" — visual CSS org chart using flexbox: Owner box at top, direct reports below, staff below that. Use colored boxes (${brandColor} bg for owner, #1A1A1A bg for managers, #444 bg for staff). White text. Small font. Name + title in each box.
Right sidebar:
  - sub-heading "KEY EMPLOYEES"
  - For each key employee: name bold, title in copper, tenure, brief note (1 line)
  - sub-heading "STAFFING OVERVIEW"
  - stat-rows: FT count, PT/Seasonal count, Benefits offered, HR system, Post-sale transitions

━━━ PAGE 11: SECTION DIVIDER — FINANCIAL INFORMATION ━━━
Class: section-divider

━━━ PAGE 12: FINANCIAL PERFORMANCE TABLE ━━━
Class: content-page
Section label: FINANCIAL INFORMATION
Full-width layout (no sidebar — table needs the full width).
  - "FINANCIAL PERFORMANCE & SELLER'S DISCRETIONARY EARNINGS" page-title + title-bar
  - section-block: Brief intro sentence about the financials (accuracy rating, who prepares them, fiscal year end)
  - FINANCIAL TABLE: Columns — Metric | [fin_year1_label] | [fin_year1_label] % Rev | [fin_year2_label] | [fin_year2_label] % Rev | [fin_year3_label] | [fin_year3_label] % Rev
    Omit columns for years with no data. Year 1 is most recent.
    Rows: Gross Revenue, Cost of Goods Sold, Gross Profit (bold-row), Operating Expenses, Net Income (bold-row), Depreciation/Amortization, Interest Expense, EBITDA (bold-row), Owner Salary Addback, Other Add-Backs, SDE (sde-row — highlighted in ${brandColor})
    % Rev = that line / gross revenue for that year, formatted as percent
  - Below table: 3 callout boxes in a row: Weighted Avg SDE (if calculable) | Most Recent Year SDE | Valuation Basis

━━━ PAGE 13: ASSETS & REVENUE SEGMENTS ━━━
Class: content-page
Section label: FINANCIAL INFORMATION
Left column:
  - "ASSETS & REVENUE SEGMENTS" page-title + title-bar
  - section-block: sub-heading "FURNITURE, FIXTURES & EQUIPMENT (FF&E)"
    Description of FF&E included in sale, appraised value
  - section-block: sub-heading "REAL ESTATE"
    Situation (owned/leased), value, terms
  - section-block: sub-heading "INVENTORY"
    Inventory description and value
  - section-block: sub-heading "TOTAL APPRAISED ASSETS"
    Table: Asset | Value rows — FF&E, Real Estate, Inventory, Total
Right sidebar:
  - sub-heading "REVENUE SEGMENTS"
  - Visual bar chart: for each revenue segment, show name + percentage as a CSS width bar in ${brandColor}
  - sub-heading "ASSET SUMMARY"
  - stat-rows: Total Assets, FF&E, Real Estate, Inventory

━━━ PAGE 14: SECTION DIVIDER — MARKET PRICE VALUATION ━━━
Class: section-divider

━━━ PAGE 15: MARKET PRICE VALUATION ━━━
Class: content-page
Section label: MARKET PRICE VALUATION
Left column:
  - "MARKET PRICE VALUATION" page-title + title-bar
  - section-block: Valuation methodology paragraph — explain SDE-based valuation, why multiples apply
  - section-block: sub-heading "VALUATION SUMMARY" — table with: SDE Basis, Multiple Applied, Business Value, + Real Estate (if applicable), Total Asking Price
  - section-block: sub-heading "SBA FINANCING OVERVIEW" — SBA 7(a) eligibility, down payment, estimated monthly payment, financing terms
  - section-block: sub-heading "DEAL ECONOMICS" — how the numbers work for a buyer (purchase price, down payment, annual debt service, remaining cash flow after debt service)
Right sidebar:
  - Large callout-box: ASKING PRICE in big Oswald
  - stat-rows: SDE Multiple, Down Payment (10% SBA), Est. Monthly Debt Service, Est. Annual Cash-on-Cash Return
  - Note about real estate if applicable

━━━ PAGE 16: SECTION DIVIDER — GROWTH OPPORTUNITIES ━━━
Class: section-divider

━━━ PAGE 17: GROWTH OPPORTUNITIES ━━━
Class: content-page
Section label: GROWTH OPPORTUNITIES
Full page — dark ${brandColor} background. White text.
  - "GROWTH OPPORTUNITIES" Oswald 36px white uppercase title, copper accent bar
  - Intro sentence: compelling framing of the upside available to a buyer
  - 2-column grid of numbered opportunities. Each: copper circle number, bold title in Oswald 14px white, 1-2 sentence description in Inter 13px #ddd
  - At bottom: "ADVISOR'S PERSPECTIVE" — a brief 2-sentence synthesis of why these opportunities are actionable

━━━ PAGE 18: SECTION DIVIDER — TRANSACTION DETAILS ━━━
Class: section-divider

━━━ PAGE 19: TRANSACTION DETAILS + BUYER PROCESS ━━━
Class: content-page
Section label: TRANSACTION DETAILS
Left column:
  - "TRANSACTION DETAILS" page-title + title-bar
  - section-block: 3 large info boxes side by side:
    Box 1 — LISTING PRICE: large value, structure note
    Box 2 — DEAL STRUCTURE: asset vs stock, real estate note
    Box 3 — TRANSITION PLAN: seller training, key employee retention
  - section-block: sub-heading "THE QSI™ BUYER PROCESS"
    Horizontal step flow: numbered steps with connecting arrows
    Steps: 1 Pre-Qualification → 2 Initial Consult → 3 CBR Review → 4 Seller Meeting → 5 Funding Approval → 6 Offer to Purchase → 7 Due Diligence → 8 Closing → 9 Transition
Right sidebar:
  - sub-heading "KEY DEAL TERMS"
  - stat-rows: Price, Down Payment, Financing, Real Estate, Inventory, FF&E, Training Period, Non-Compete
  - sub-heading "IDEAL BUYER PROFILE"
  - bullets: buyer background fit, experience needed, SBA qualification notes

━━━ PAGE 20: DEAL TEAM + NEXT STEPS ━━━
Class: content-page
Section label: NEXT STEPS
Left column (60%):
  - "THE DEAL TEAM" page-title + title-bar
  - 5-card grid of team members. Each card: ${brandColor} background, name Oswald bold 16px white, role Inter 12px #ddd, specialties as small copper pills.
    Team members: Michael (Lead Broker | Deal Structure · Strategy · Negotiations), Robin (Acquisition Advisor | Operations · Due Diligence · Buyer Success), Alisha (Acquisition Advisor | Seller Success · CBR Production), Lee (Lender Liaison | SBA Lending Expert), Lance (Operations | Business Listings · Leads)
    Override with any team members listed in deal data.
Right column (40%):
  - Full dark ${brandColor} background panel
  - "NEXT STEPS" Oswald 24px white
  - Numbered list: 1) Execute NDA 2) Review this CBR 3) Schedule Seller Meeting 4) Submit Letter of Intent
  - Bottom CTA box in #C1622F: "READY TO MOVE FORWARD?" + "Contact your advisor today" + petersonacquisitions.com
  - Copyright footer: "©${new Date().getFullYear()} Peterson Acquisitions · Confidential Business Review · All Rights Reserved"

━━━ FOOTER (on all content pages) ━━━
Every content-page ends with a .page-footer div:
Left: "© ${new Date().getFullYear()} Peterson Acquisitions"
Center: "Confidential Business Review · [industry/type descriptor, no business name]"
Right: "petersonacquisitions.com"

Business data: ${JSON.stringify(interviewData, null, 2)}
Advisor: ${deal.advisor_name}

IMPORTANT: Output ONLY the complete HTML document starting with <!DOCTYPE html>. No other text.
IMPORTANT: Follow the PAGE BREAK RULES exactly — content pages use page-break-before: always and page-break-inside: avoid on blocks. NEVER use page-break-after on content blocks.`
      }]
    });

    const cbrHtml = message.content[0].text;
    // Strip any accidental markdown fences
    const cleanHtml = cbrHtml.replace(/^```html\n?/, '').replace(/\n?```$/, '').trim();
    getDb().prepare('UPDATE deals SET cbr_html = ?, updated_at = ? WHERE id = ?')
      .run(cleanHtml, new Date().toISOString(), deal_id);
    logEvent(deal_id, req.user, 'cbr_generated', 'Confidential Business Review generated');
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
