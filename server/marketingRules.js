'use strict';

/**
 * Deal Marketing rules ported from the advisor prompt Alisha runs in chat.
 * The Engagement Agreement stays authoritative for listing and asking price.
 * One Valuation SDE is used in the blind ad, the flyer, and the CBR.
 */

const DEAL_TEAM = [
  ['Michael', 'Lead Broker', 'Deal Structure · Strategy · Negotiations'],
  ['Robin', 'Acquisition Advisor', 'Operations · Due Diligence · Buyer Success'],
  ['Alisha', 'Acquisition Advisor', 'Seller Success · CBR Production'],
  ['Lee', 'Lender Liaison', 'SBA Lending Expert'],
  ['Lance', 'Operations', 'Business Listings · Leads'],
];

const SOURCE_RULES = `SOURCE DOCUMENT RULES:
- Use ONLY numbers present in the interview form, a confirmed marketing lock, or these documents. Never fabricate, estimate, or infer a financial figure. If a required figure is missing and cannot be derived under the stated exceptions, omit that line. Never display $0, "N/A", or any other stand-in for a missing number.
- The Engagement Agreement is authoritative for listing price, asking price, and deal terms, including reason for selling, building square footage, rent, year founded, hours, and employees. Where the Engagement Agreement and the MPA conflict on price, the Engagement Agreement governs. A confirmed asking price already saved on the interview form overrides every other price figure.
- The QSI MPA is authoritative for financial performance: revenue, COGS, expenses, add-backs, and each year's SDE. Do not take financial figures from the Discovery Prep Report.
- Valuation SDE is ONE locked figure used identically in the blind ad, the flyer, and the CBR. If three years of SDE exist, calculate the weighted average with 3-2-1 weighting only (most recent year × 3, prior year × 2, two years prior × 1, divided by 6) and label it "Wtd. Avg. SDE (3-2-1)". If only one or two years exist, use the most recent year's SDE and label it "SDE ([Year])". Never apply 3-2-1 with fewer than three years. No output may mix SDE bases. The CBR financial table still shows each reported year.
- EBITDA: use the stated figure, or derive it only when Revenue, COGS, Operating Expenses, Depreciation, and Interest are all present. If any component is missing, omit EBITDA.
- The Bank Term Sheet supplies the SBA bank name, interest rate, loan terms, and payment. Do not invent them. Estimated SBA figures are allowed only from the confirmed rate, 90% financed, a 10-year term on business assets, and a 25-year term on any real estate portion. Blend the two payments when real estate is included. Label every such figure "Est." and state the rate used.
- Blind materials (blind ad and flyer only) never reveal the business name, owner name, street address, county in a small or rural market, or exact founding year. Location is general region + state only. Years in business are written "XX+ years established".
- Employees are described by role and tenure only unless the documents explicitly say the seller approved sharing names.
- The SBA Pre-Approved badge is included only when SBA pre-qualification is explicitly confirmed in the documents.
- Industry statistics, review scores, and social metrics are included only when the documents state them. Otherwise write qualitative copy or "to be provided by seller."
- The Discovery Prep Report may enrich the business description, seller differentiators, ideal buyer, and industry narrative. Do not use it for financial figures.
- Do not use the word "Upside". On the flyer, growth language is "Identified Growth Levers".`;

const FINANCIAL_RULES = `FINANCIAL INTEGRITY — APPLY TO EVERY NUMBER:
- Never fabricate, estimate, or infer a financial figure. Use only numbers explicitly in the documents, the interview, or the LOCKED VALUES block.
- Missing metric: omit the line. Never show $0 or "N/A" as a stand-in for a number.
- Weighted Average SDE uses 3-2-1 weighting only when three years of SDE exist. Otherwise the most recent year is the Valuation SDE.
- Every multiple, cash-on-cash return, and DSCR in this document uses the same locked Valuation SDE.
- Valuation multiple: if the documents do not state one, derive Asking Price ÷ Valuation SDE and label it "Derived Multiple".
- SBA estimates: 90% financed, 10-year term for business assets, 25-year term for real estate, blended payment when real estate is included in the price. Label each "Est." and state the confirmed rate.
- Two cash-on-cash lines, both labeled Est.:
  1. Est. Cash-on-Cash (Pre-Owner Comp): (Valuation SDE − annual debt service) ÷ down payment
  2. Est. Cash-on-Cash (After Owner Comp): (Valuation SDE − annual debt service − owner comp) ÷ down payment
  Owner comp is the market-rate salary in the documents or the confirmed lock. If it is not stated, estimate a market rate for the role and write "market-rate owner comp est. $X" beside line 2. Never omit line 2.
- Est. DSCR = Valuation SDE ÷ annual debt service. Note that SBA lenders typically require DSCR ≥ 1.25.
- For date references use the current month and year.`;

const BLIND_RULES = `BLIND MATERIALS:
- Never reveal the business name, owner name, specific street address, or any detail that would identify the business.
- Location is general region + state only (example: "Piedmont Region, NC"). Do not name the county in a small or rural market.
- Years in business: "XX+ years established". Never the exact founding year.
- Employees by role only unless the seller approved names in the documents.
- SBA Pre-Approved only if the documents explicitly confirm pre-qualification.`;

function dealTeamLines() {
  return DEAL_TEAM
    .map(([name, role, specialties]) => `${name} — ${role} | ${specialties}`)
    .join('\n');
}

function lockedOrComputed(lockedBlock) {
  if (lockedBlock && String(lockedBlock).trim()) {
    return `LOCKED VALUES — these override every other SDE, price, and rate. Copy them exactly. Do not recompute a different Valuation SDE. An edit may not change these figures unless the advisor's request explicitly supplies a replacement number.
${lockedBlock}`;
  }
  return `VALUATION SDE — declare one figure and use it for every multiple, cash-on-cash return, and DSCR in this document.
If three years of SDE are available: weighted average = (most recent × 3 + prior × 2 + two years prior × 1) / 6, labeled "Wtd. Avg. SDE (3-2-1)".
If fewer than three years are available: use the most recent year's SDE, labeled "SDE ([Year])". Never apply 3-2-1 in that case.`;
}

function scrubUpside(text) {
  if (!text) return text;
  return String(text).replace(/\bupside\b/gi, 'Identified Growth Levers');
}

function blindAdSystem() {
  return `You are a professional business broker copywriter for Peterson Acquisitions / The Deal Team.
Advisors: Michael (Lead Broker), Robin, Alisha, Lee (Lender Liaison), and Lance.
You write compelling, factual BizBuySell blind ads that follow a strict structure.
Write in a confident, authoritative tone. No filler language.
${BLIND_RULES}
${FINANCIAL_RULES}
- Output plain text only. Use ** for bold headlines and - for bullet points.
- Do not use the word "Upside". A growth highlight is an identified growth lever.`;
}

function blindAdUser({ interviewData, sources, advisorName, lockedBlock }) {
  const advisor = advisorName || interviewData.advisor_name || 'an acquisition advisor';
  return `Generate a BizBuySell blind ad. Follow this EXACT structure. Do not add, remove, or reorder any section.

${lockedOrComputed(lockedBlock)}

${sources || ''}

Business data:
${JSON.stringify(interviewData, null, 2)}

---

**[COMPELLING HEADLINE — industry descriptor + key differentiator + region and state]**
(Example: "Profitable Landscape & Nursery Business | 20+ Yrs | Recurring Revenue | NC")

[Region], [State]

Asking Price: $[X]

Cash Flow (SDE): $[locked Valuation SDE] (omit the line if no SDE is available)

EBITDA: $[X] (omit the line if EBITDA cannot be stated or derived)

Gross Revenue: $[X]

Established: [XX+ years established]

**Business Description:**

[3-5 paragraphs. What the business does, that it is XX+ years established, what makes it durable, how it operates day to day, the owner's role and replaceability, and buyer fit. No identifying details. No business name. No exact founding year.]

**KEY HIGHLIGHTS:**

- [Profitability / track record]
- [Customer retention / repeat revenue, only if stated]
- [Customer concentration — or the lack of it]
- [Margin or financial strength]
- [Team / operational stability, roles only]
- [Business model simplicity or defensibility]
- [Identified growth lever — one line. Do not write "Upside".]
- [Financial record quality]

**IDEAL BUYER:**

- [Operator background that fits this business]
- [Industry experience preferred or required]
- [Entrepreneur / owner-operator profile]
- [Strategic buyer angle if applicable]
- SBA-qualified with 680+ credit score, 10% down, and liquid reserves equal to 10% of purchase price post-close

[Asset sale or stock sale — one line]

**SUPPORT & TRANSITION:**

[1-2 sentences on the seller's willingness to train and support the transition.]

**REASON FOR SELLING:**

[Seller's stated reason — one line only]

**REPRESENTATION:**

This opportunity is being handled by ${advisor} with The Deal Team | Powered by Peterson Acquisitions. An experienced acquisition advisor may follow up to answer questions and guide next steps.

**NEXT STEPS:**

Inquire today for full financials and a confidential business summary. All prospective buyers must sign an NDA and demonstrate financial ability to purchase.

**Detailed Information**

Inventory: $[X] — [Included / Not included] in asking price (omit if not available)

Furniture, Fixtures, & Equipment (FF&E): $[X] — [Included / Not included] in asking price (omit if not available)

Employees: [X] Full-time[, X Part-time if applicable] by role, not by name

Financing: [Primary financing type — 1 sentence on terms]

Support & Training: [Transition statement]

Reason for Selling: [Reason]

**Business Location**

Location: [Region], [State]

Real Estate: [Owned / Leased]

[Building SF: X — if provided]

[Rent: $X/mo — if leased and provided]

---

Output the ad exactly in that structure. Plain text only.`;
}

function flyerSystem() {
  return `You are a professional graphic designer and copywriter for Peterson Acquisitions / The Deal Team.
You generate a single-page, print-ready HTML listing flyer.

ABSOLUTE RULES:
1. Output ONLY a complete HTML document starting with <!DOCTYPE html>. No markdown, no commentary, no code fences.
2. The only external dependency is the Google Fonts link provided.
3. ${BLIND_RULES}
4. ${FINANCIAL_RULES}
5. THE FLYER FITS ON EXACTLY ONE LETTER PAGE. Include:
   @page { size: 8.5in 11in; margin: 0; }
   html, body { width: 8.5in; height: 11in; overflow: hidden; margin: 0; padding: 0; }
   .page { width: 8.5in; height: 11in; display: flex; flex-direction: column; overflow: hidden; }
6. If a zone would overflow its height, remove bullets or shorten lines until it fits. A clipped line is a broken flyer. Do not count on overflow:hidden to hide excess copy.
7. ALL body copy is bullet points of 15 words or fewer. No paragraphs except the hero description (max 2 sentences, 30 words).
8. TEXT CONTRAST: body #111111, headers #1A1A1A, secondary #444444.
9. Never use the word "Upside". The growth section label is "Identified Growth Levers".
10. Brand: charcoal #1A1A1A, copper #C1622F, Oswald headers, Inter body.`;
}

function flyerUser({ interviewData, sources, photos, advisorName, lockedBlock }) {
  const cover = photos && photos.hasCover
    ? 'Use exactly this cover image and nothing else: <img data-pacq="biz-cover" src="{{PACQ_BIZ_COVER}}" alt="" style="width:100%;height:100%;object-fit:cover;display:block"/>'
    : 'Fill with a gradient from #2a2a2a to #1a1a1a with a centered copper "✦" at 48px.';
  const advisorPhoto = photos && photos.hasAdvisor
    ? 'Start the advisor card with this circular headshot: <img data-pacq="advisor-photo" src="{{PACQ_ADVISOR_PHOTO}}" alt="" style="width:72px;height:72px;border-radius:50%;object-fit:cover;border:2.5px solid #C1622F;flex-shrink:0"/>'
    : 'No advisor headshot was uploaded. Do not invent a photo. If phone or email is not documented, display "Contact info to be provided."';

  return `Generate a single-page print-ready listing flyer. The page is exactly 8.5×11 inches. Every zone must fit. Nothing may paint past the page edge.

FONTS (this exact link in <head>):
<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">

BRAND: header/footer #1A1A1A, accent copper #C1622F, page #ffffff, Oswald headers, Inter body.

REQUIRED CSS:
@page { size: 8.5in 11in; margin: 0; }
*, *::before, *::after { box-sizing: border-box; }
html, body { width: 8.5in; height: 11in; overflow: hidden; margin: 0; padding: 0; font-family: 'Inter', sans-serif; }
.page { width: 8.5in; height: 11in; display: flex; flex-direction: column; overflow: hidden; background: #fff; }

FIVE ZONES (total = 11in):

ZONE 1 — HEADER BAR [44px, flex-shrink: 0, background #1A1A1A]
Left: "PETERSON ACQUISITIONS" in #C1622F Oswald 13px bold, and "THE DEAL TEAM" in #888 Inter 10px below.
Right: "OFFERED EXCLUSIVELY · CONFIDENTIAL · NDA REQUIRED" white Oswald 10px uppercase.

ZONE 2 — HERO [190px, flex-shrink: 0, background #1A1A1A, LEFT 55% RIGHT 45%]
LEFT (padding 20px 16px 16px 20px):
- Industry chip: #C1622F pill, white Inter 9px bold uppercase
- Headline: Oswald bold white 26px, max 2 lines, BLIND (industry + region only)
- Tagline: #C1622F Oswald 12px uppercase, max 10 words
- Description: white Inter 11px, MAX 2 SENTENCES, 30 words total
RIGHT: ${cover}

ZONE 3 — METRICS STRIP [88px, flex-shrink: 0, white]
4 equal columns: ASKING PRICE | GROSS REVENUE | CASH FLOW / SDE | VALUATION MULTIPLE
Each: LABEL #888 Inter 8px uppercase, VALUE #1A1A1A Oswald bold 22px, CAPTION #C1622F Inter 8px.
Cash Flow / SDE is the locked Valuation SDE. Currency like $X,XXX,XXX. Multiple like "X.Xx SDE" (derive Asking ÷ Valuation SDE if not stated, caption "Derived").
3px solid #C1622F bar at the bottom of the zone.

ZONE 4 — MAIN BODY [flex: 1, min-height: 0, two columns Left 62% Right 38%]
LEFT (padding 16px 14px 12px 20px, border-right 2px solid #f0f0f0):
Section "KEY HIGHLIGHTS": Oswald 10px uppercase #C1622F, border-bottom 2px solid #C1622F.
8-10 bullets, copper "▸", Inter 11px #111111, each 15 words or fewer. Drop to 6 if the column would overflow. Include one identified growth lever. Do not write "Upside".
Section "IDENTIFIED GROWTH LEVERS": same header style, 2 or 3 bullets of documented growth opportunities, each 15 words or fewer. Never title this section "Upside".
Section "KEY FEATURES": 2×3 grid of badges.
Each badge: border 1.5px solid #C1622F, border-radius 4px, padding 5px 8px.
Badge: copper circle number (18px, #C1622F, white Oswald 10px) + label Inter 10px #111111 bold + value Inter 10px #444444.
Choose 6 from documented data only: Operating History ("XX+ Yrs", never the exact year), Real Estate status, Service Type, Employees, Hours, Turn-Key, Customer Database, Fleet/Locations. Include "SBA Pre-Approved" only if the documents confirm it.

RIGHT (padding 14px 18px 12px 14px, flex column, gap 10px):
CARD 1 "DEAL TERMS": border 1.5px solid #e0e0e0, padding 10px. Header Oswald 9px #888 uppercase.
Rows: Price, Down Payment (est. 10% SBA), Financing, Real Estate, Transition. Label #888 Inter 9px, value #111111 Inter 10px bold.
CARD 2 "OPERATIONS": same card. Rows: Hours, Employees, Established ("XX+ Years"), Location (region + state only).
CARD 3 "YOUR ADVISOR": background #fafafa. Advisor name Inter 11px bold, title Inter 9px #C1622F, phone, email, and "The Deal Team | Peterson Acquisitions" Inter 8px #888.
${advisorPhoto}

ZONE 5 — FOOTER BAR [36px, flex-shrink: 0, background #1A1A1A]
Left: "CONFIDENTIAL — ALL INQUIRIES HANDLED WITH STRICT DISCRETION" #C1622F Oswald 9px uppercase.
Right: "TheDealTeam.co · Peterson Acquisitions" white Inter 9px.

${lockedOrComputed(lockedBlock)}

${sources || ''}

Business data:
${JSON.stringify(interviewData, null, 2)}

Advisor name: ${advisorName || 'Your Advisor'}

Output ONLY the complete HTML document starting with <!DOCTYPE html>.`;
}

function cbrSystem() {
  return `You are generating a Confidential Business Review (CBR) for Peterson Acquisitions / The Deal Team.
The CBR is for NDA-signed buyers only. Refer to the business by industry type, never by name.
Write in a confident, authoritative tone. No filler.

${FINANCIAL_RULES}
- Output ONLY one complete HTML document starting with <!DOCTYPE html>. No preamble and no markdown fences.
- Body text on white is #111111. Never lighter than #444444 for body copy. On the dark growth page, descriptions are #FFFFFF.
- Brand is charcoal #1A1A1A and copper #C1622F. Oswald headers, Inter body. Do not introduce a second brand color.
- PAGE FIT: every content page and section divider is exactly 11in tall and its copy must fit above the footer. If Business Overview would run past the bottom, shorten the paragraph to 3 sentences and put extra section-blocks on a following content page. Split or tighten. Never leave text painting off the page, and do not hide unread text with overflow alone.
- Page breaks: break-before: page on section dividers and content pages. page-break-inside: avoid on .section-block. Never put break-before and page-break-after on the same element.
- Right sidebar is 28% on every content page that uses one. If data is missing, use qualitative context from the documents or "To be provided by seller." Never fabricate a number to fill a sidebar.
- Employees: role and tenure only unless the documents explicitly confirm the seller approved the name.
- SBA Pre-Approved only when the documents confirm pre-qualification.
- Deal team cards are exactly: ${dealTeamLines().replace(/\n/g, '; ')}.`;
}

function cbrUser({ interviewData, sources, photos, advisorName, lockedBlock }) {
  const year = new Date().getFullYear();
  const monthYear = new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' });
  const cover = photos && photos.hasCover
    ? 'At the top of the cover, full width, before the title, include exactly <img data-pacq="biz-cover" src="{{PACQ_BIZ_COVER}}" alt="" style="width:100%;height:280px;object-fit:cover;display:block"/>'
    : 'No cover photo was uploaded. Do not invent one.';
  const sidebar = photos && photos.hasSidebar
    ? 'First sidebar element on the Business Overview page: <img data-pacq="biz-sidebar" src="{{PACQ_CIM_SIDEBAR}}" alt="" style="width:100%;height:180px;object-fit:cover;display:block;border-radius:4px;margin-bottom:16px"/>'
    : 'No sidebar photo. Do not invent one.';
  const gallery = photos && photos.hasGallery
    ? 'Immediately after the cover page, output this placeholder on its own line and do not modify it: {{PACQ_GALLERY}}'
    : '';

  return `Generate the full Confidential Business Review as one HTML document (cover through deal team). Use the locked Valuation SDE everywhere a valuation, multiple, cash-on-cash, or DSCR figure appears.

FONTS:
<link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">

BASE CSS — copy this structure. Accent is #C1622F, not a seller color.
@page { size: 8.5in 11in; margin: 0; }
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Inter', sans-serif; font-size: 15px; color: #111111; background: white; }
.section-divider { break-before: page; background: #1A1A1A; height: 11in; overflow: hidden; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
.content-page { break-before: page; display: flex; flex-direction: column; height: 11in; overflow: hidden; }
.content-body { display: flex; flex: 1; min-height: 0; }
.main-col { flex: 1; min-width: 0; padding: 40px 32px 32px 40px; }
.sidebar { width: 28%; padding: 40px 28px 32px 24px; background: #f8f8f8; border-left: 3px solid #C1622F; }
.page-title { font-family: 'Oswald', sans-serif; font-size: 28px; font-weight: 700; color: #1A1A1A; text-transform: uppercase; margin-bottom: 4px; }
.title-bar { height: 4px; background: #C1622F; width: 56px; margin-bottom: 24px; }
.section-block { page-break-inside: avoid; margin-bottom: 24px; }
.sub-heading { font-family: 'Oswald', sans-serif; font-size: 12px; font-weight: 600; color: #C1622F; text-transform: uppercase; letter-spacing: 0.1em; border-bottom: 1.5px solid #C1622F; padding-bottom: 4px; margin-bottom: 10px; }
p { line-height: 1.65; margin-bottom: 10px; color: #111111; }
ul { list-style: none; padding: 0; }
ul li { padding: 4px 0 4px 16px; position: relative; line-height: 1.5; color: #111111; }
ul li::before { content: "▸"; position: absolute; left: 0; color: #C1622F; font-size: 10px; top: 6px; }
.callout-box { background: #1A1A1A; border-radius: 4px; padding: 16px; margin-bottom: 16px; page-break-inside: avoid; }
.callout-box .cb-label { font-size: 9px; font-family: 'Oswald', sans-serif; letter-spacing: 0.12em; text-transform: uppercase; color: #C1622F; margin-bottom: 4px; }
.callout-box .cb-value { font-family: 'Oswald', sans-serif; font-size: 22px; font-weight: 700; color: white; line-height: 1.1; }
.callout-box .cb-caption { font-size: 10px; color: #aaa; margin-top: 2px; }
.stat-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #e8e8e8; }
.stat-label { font-size: 12px; color: #444; }
.stat-value { font-family: 'Oswald', sans-serif; font-size: 14px; font-weight: 600; color: #1A1A1A; }
.page-footer { background: #f0f0f0; border-top: 1px solid #ddd; padding: 8px 40px; display: flex; justify-content: space-between; font-size: 10px; color: #666; }
table { width: 100%; border-collapse: collapse; font-size: 13px; page-break-inside: avoid; }
th { background: #C1622F; color: white; font-family: 'Oswald', sans-serif; font-weight: 600; padding: 10px 12px; text-align: left; font-size: 12px; }
td { padding: 8px 12px; border-bottom: 1px solid #eee; color: #111111; }
tr:nth-child(even) td { background: #f7f7f7; }
tr.bold-row td { font-weight: 700; background: #f5f3f1; }
tr.sde-row td { font-weight: 700; color: #C1622F; font-size: 14px; background: #fff8f4; }

PAGES IN ORDER:

P1 COVER — full page #1A1A1A, centered.
"CONFIDENTIAL BUSINESS REVIEW" Oswald 13px #C1622F uppercase.
Industry descriptor (no business name) Oswald bold 52px white, max 2 lines.
Tagline italic Inter 16px #ccc, one sentence.
3px separator, half copper and half gray, 80px wide.
Confidentiality notice Inter 12px #888 italic.
Bottom bar #C1622F 60px: left "PETERSON ACQUISITIONS | THE DEAL TEAM" Oswald 14px white; right "Offered Exclusively · Strictly Confidential" Inter 11px white.
${cover}
${gallery}

P2 TABLE OF CONTENTS — content-page, full width, no sidebar.
"TABLE OF CONTENTS" plus subtitle "${monthYear}".
2-column × 4-row grid. Copper circle number, section name Oswald bold 15px, subtitle Inter 12px #444.
Sections: 1 Executive Summary · 2 Business Description · 3 Operational Information · 4 Financial Information · 5 Market Price Valuation · 6 Growth Opportunities · 7 Transaction Details · 8 Next Steps.
Confidentiality notice in a bordered box under the grid.

P3 SECTION DIVIDER: EXECUTIVE SUMMARY. "EXECUTIVE SUMMARY" Oswald bold white uppercase.

P4 BUSINESS OVERVIEW — content-page. This page must fit in 11in. Prefer 3 sentences of description. If details plus systems will not fit, keep the description and BUSINESS DETAILS here and move KEY SYSTEMS onto the next content page.
Main: "BUSINESS OVERVIEW" page-title + title-bar. Short description. sub-heading "BUSINESS DETAILS" stat-rows: Industry, Founded (XX+ years in blind-safe form is not required here — city/region and state are allowed for NDA buyers, still no street address), Hours, Entity Type, Licenses, Employees, Owner Tenure. sub-heading "KEY SYSTEMS & INFRASTRUCTURE" bullets.
Sidebar: ${sidebar}
callout ASKING PRICE. callout MOST RECENT REVENUE with year. callout CASH FLOW / SDE using the locked Valuation SDE and its basis. stat-rows: Est. Year, Real Estate, SBA Eligible, Down Payment Est.

P5 OWNER BACKGROUND + INDUSTRY — content-page.
"OWNER BACKGROUND". Origin, "OWNER'S ROLE TODAY", "REASON FOR SELLING", "INDUSTRY OVERVIEW" (qualitative — do not invent market size), "COMPETITIVE LANDSCAPE" bullets.
Sidebar: "OWNER PROFILE" bullets. "INDUSTRY AT A GLANCE" stat-rows from the documents only; otherwise "To be provided by seller."

P6 SECTION DIVIDER: BUSINESS DESCRIPTION.

P7 PRODUCTS & SERVICES + CUSTOMERS — content-page.
Overview, "CORE OFFERINGS", "PRICING & DELIVERY", "COMPETITIVE ADVANTAGES", "CUSTOMER BASE".
Sidebar: "REVENUE MIX" — copper CSS bars only if segment percentages are in the documents; otherwise 3-4 qualitative bullets and no bars. "CUSTOMER HIGHLIGHTS" stat-rows.

P8 MARKETING & SALES — content-page.
"MARKETING CHANNELS", "MARKET POSITIONING", "SALES PROCESS", "SALES PERFORMANCE".
Sidebar: "REPUTATION" — scores only if documented; otherwise 1-2 qualitative bullets labeled "Based on Seller Interview." "SALES SNAPSHOT" stat-rows.

P9 SECTION DIVIDER: OPERATIONAL INFORMATION.

P10 OPERATIONS + ORG STRUCTURE — content-page.
"LOCATION & FACILITIES", "DAILY OPERATIONS", "MANAGEMENT STRUCTURE" as a CSS flex org chart (owner box #C1622F, managers #1A1A1A, staff #444, white text). Roles, not unapproved names.
Sidebar: "KEY EMPLOYEES" — role in copper, tenure, note. A name only with documented seller approval. "STAFFING OVERVIEW" stat-rows.

P11 SECTION DIVIDER: FINANCIAL INFORMATION.

P12 FINANCIAL PERFORMANCE TABLE — content-page, full width, no sidebar.
"FINANCIAL PERFORMANCE & SELLER'S DISCRETIONARY EARNINGS".
Table columns oldest to newest. Metric | year | % Rev for each year that has data. Omit empty years.
Rows: Gross Revenue, COGS, Gross Profit (bold-row), Operating Expenses, Net Income (bold-row), Depreciation, Interest, EBITDA (omit the row if it cannot be derived), Owner Salary Add-back, Other Add-backs, SDE (sde-row).
% Rev = line ÷ gross revenue.
Below the table, three callout boxes: Weighted Avg SDE (3-2-1, or omit the value and say fewer than 3 years — do not print $0) | Most Recent SDE | Valuation SDE (locked basis).

P13 ASSETS — content-page.
"FF&E", "REAL ESTATE", "INVENTORY", "TOTAL APPRAISED ASSETS" table. Omit any asset row whose value is not in the documents.
Sidebar: "REVENUE SEGMENTS" bars only from documented percentages, else qualitative bullets. "ASSET SUMMARY" stat-rows.

P14 SECTION DIVIDER: MARKET PRICE VALUATION.

P15 MARKET PRICE VALUATION — content-page.
Methodology paragraph. "VALUATION SUMMARY" table: Valuation SDE, Multiple, Business Value, Real Estate if applicable, Total Asking Price.
"SBA FINANCING OVERVIEW": 90% financed, 10% down, 10-year business term, 25-year real estate term, blended Est. monthly payment at the confirmed rate.
"DEAL ECONOMICS": Purchase Price, Down Payment, Annual Debt Service, Est. DSCR (Valuation SDE ÷ annual debt service, note SBA minimum 1.25), Est. Cash-on-Cash (Pre-Owner Comp), Est. Cash-on-Cash (After Owner Comp).
Sidebar callout ASKING PRICE. stat-rows: Valuation SDE with basis, Multiple, Down Payment, Est. Monthly Debt Service, Est. DSCR, Est. Cash-on-Cash (After Owner Comp).

P16 SECTION DIVIDER: GROWTH OPPORTUNITIES.

P17 GROWTH OPPORTUNITIES — content-page, full #1A1A1A background, white text, copper accents.
"GROWTH OPPORTUNITIES" Oswald 36px white. Do not title this "Upside".
Intro sentence. 2-column numbered grid: copper circle, title Oswald 14px white, description Inter 13px #FFFFFF.
"ADVISOR'S PERSPECTIVE" in #C1622F Oswald, two sentences in white.

P18 SECTION DIVIDER: TRANSACTION DETAILS.

P19 TRANSACTION DETAILS + BUYER PROCESS — content-page.
Three boxes: LISTING PRICE | DEAL STRUCTURE | TRANSITION PLAN.
"THE QSI™ BUYER PROCESS" — 9 steps. Use two rows (5 then 4) or a vertical list if one row will not fit: 1 Pre-Qualification → 2 Initial Consult → 3 CBR Review → 4 Seller Meeting → 5 Funding Approval → 6 Offer to Purchase → 7 Due Diligence → 8 Closing → 9 Transition.
Sidebar: "KEY DEAL TERMS" stat-rows (Price, Down Payment, Financing, Real Estate, Inventory, FF&E, Training Period, Non-Compete). "IDEAL BUYER PROFILE" bullets.

P20 DEAL TEAM + NEXT STEPS — content-page.
Left 60%: "THE DEAL TEAM". Five cards, #C1622F background, Oswald bold 16px white name, Inter 12px role, copper specialty pills. Use these people only:
${dealTeamLines()}
Right 40% #C1622F: "NEXT STEPS" Oswald 24px white. 1) Execute NDA 2) Review this CBR 3) Schedule Seller Meeting 4) Submit Letter of Intent.
CTA box #1A1A1A: "READY TO MOVE FORWARD?" + "Contact your advisor today" + petersonacquisitions.com.

FOOTER on every content page (.page-footer):
Left: "© ${year} Peterson Acquisitions" | Center: "Confidential Business Review · [industry descriptor, no business name]" | Right: "petersonacquisitions.com"

${lockedOrComputed(lockedBlock)}

${sources || ''}

Business data: ${JSON.stringify(interviewData, null, 2)}
Advisor: ${advisorName || ''}

Output ONLY the complete HTML document starting with <!DOCTYPE html>.
Each .content-page must fit on one 11in page. Split a long Business Overview rather than letting it run off the bottom.`;
}

module.exports = {
  DEAL_TEAM,
  SOURCE_RULES,
  FINANCIAL_RULES,
  BLIND_RULES,
  scrubUpside,
  blindAdSystem,
  blindAdUser,
  flyerSystem,
  flyerUser,
  cbrSystem,
  cbrUser,
};
