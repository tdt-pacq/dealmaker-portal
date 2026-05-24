/**
 * deal-finder.js
 * Deal Finder — Buyer's Academy automated deal search
 *
 * Routes:
 *   GET    /api/deal-finder               list all search profiles
 *   POST   /api/deal-finder               create profile
 *   DELETE /api/deal-finder/:id           delete profile
 *   PATCH  /api/deal-finder/:id/toggle    toggle active flag
 *   POST   /api/deal-finder/:id/run       trigger async search → { jobId }
 *   GET    /api/deal-finder/jobs/:jobId   poll job status/results
 */

const express  = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');
const { getDb }      = require('../database');

const router = express.Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// In-memory job store (fire-and-forget; results in email, UI just previews)
const jobs = new Map();

// Auto-clean jobs after 15 minutes
setInterval(() => {
  const cutoff = Date.now() - 15 * 60 * 1000;
  for (const [id, job] of jobs) {
    if (job.createdAt < cutoff) jobs.delete(id);
  }
}, 5 * 60 * 1000);

// ─── UTILITIES ────────────────────────────────────────────────────────────────

function fmtPrice(n) {
  if (!n) return 'N/A';
  return '$' + Number(n).toLocaleString('en-US');
}

function extractTextBlocks(content) {
  return (content || [])
    .filter(b => b.type === 'text')
    .map(b => b.text)
    .join('');
}

function safeParseJson(raw, label) {
  // Try to extract a JSON array from the Claude response
  const text = extractTextBlocks(raw);

  // Log the raw text response for debugging (first 1500 chars)
  if (label) {
    console.log(`[Deal Finder] ${label} raw text (${text.length} chars):`, text.substring(0, 1500));
  }

  // Strip markdown code fences if present (```json ... ```)
  const stripped = text.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '');

  // Find the outermost JSON array
  const match = stripped.match(/\[[\s\S]*\]/);
  if (!match) {
    if (label) console.log(`[Deal Finder] ${label}: no JSON array found in response`);
    return [];
  }
  try {
    const parsed = JSON.parse(match[0]);
    if (label) console.log(`[Deal Finder] ${label}: parsed ${Array.isArray(parsed) ? parsed.length : 'non-array'} items`);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    if (label) console.log(`[Deal Finder] ${label}: JSON parse error —`, e.message);
    return [];
  }
}

// ─── CLAUDE SEARCH ────────────────────────────────────────────────────────────

async function searchOnMarket(profile) {
  const priceRange = `${fmtPrice(profile.price_min)} – ${fmtPrice(profile.price_max || 'no max')}`;
  const revenueClause = profile.revenue_min || profile.revenue_max
    ? `\n  Annual Revenue range: ${fmtPrice(profile.revenue_min)} – ${fmtPrice(profile.revenue_max || 'no max')}`
    : '';

  // Build explicit search queries Claude should run
  const queries = [
    `"${profile.industry}" for sale "${profile.location}" site:bizbuysell.com`,
    `"${profile.industry}" business for sale "${profile.location}" site:bizquest.com`,
    `"${profile.industry}" acquisition "${profile.location}" sunbelt OR "murphy business" OR bizbuysell`,
    `"${profile.industry}" business for sale "${profile.location}" asking price`,
  ];

  console.log(`[Deal Finder] Starting on-market search — industry: ${profile.industry}, location: ${profile.location}`);

  const resp = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 6000,
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    system: `You are a business listing aggregator for Peterson Acquisitions — The Deal Team, a top SBA acquisition advisory firm.
Your job: use web_search to find REAL, CURRENT, FOR-SALE business listings that match the buyer's criteria.
You MUST run multiple web searches and extract actual listing data from the results.
Only include listings you actually find — do not fabricate data. If a field is not shown in the listing, use "Not Disclosed".`,
    messages: [{
      role: 'user',
      content: `I need you to find currently listed for-sale businesses matching these criteria:

  Industry / Type: ${profile.industry}
  Location: ${profile.location}
  Asking Price range: ${priceRange}${revenueClause}

Run these web searches one by one using the web_search tool:
1. ${queries[0]}
2. ${queries[1]}
3. ${queries[2]}
4. ${queries[3]}

For each search, extract any real business-for-sale listings you find. Look for listing pages on BizBuySell, BizQuest, Sunbelt Advisors, Murphy Business, BusinessBroker.net, and similar broker platforms.

After running all searches, compile the unique real listings you found into a JSON array. Include up to 10 listings total (deduplicate if the same business appears on multiple sites).

Each listing object must use EXACTLY these keys:
{
  "name": "Business name or 'Confidential Listing' if not disclosed",
  "asking_price": "e.g. '$1,200,000' or 'Not Disclosed'",
  "gross_revenue": "e.g. '$2,800,000' or 'Not Disclosed'",
  "cash_flow": "e.g. '$420,000' or 'Not Disclosed'",
  "location": "City, State",
  "description": "2-3 sentence description from the listing",
  "source_platform": "BizBuySell / BizQuest / Sunbelt / etc",
  "listing_url": "full URL to the listing page",
  "broker_name": "Broker or brokerage name, or 'Not Listed'"
}

Return ONLY a JSON array of listing objects. No preamble, no explanation, no markdown fences.
If you find zero listings, return an empty array: []`,
    }],
  });

  return safeParseJson(resp.content, 'on-market');
}

async function searchOffMarket(profile) {
  const priceRange = `${fmtPrice(profile.price_min)} – ${fmtPrice(profile.price_max || 'no max')}`;

  console.log(`[Deal Finder] Starting off-market search — industry: ${profile.industry}, location: ${profile.location}`);

  const resp = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 4000,
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    system: `You are a business prospecting researcher for Peterson Acquisitions — The Deal Team, a top SBA acquisition advisory firm.
Your job: find established, privately-owned businesses that are NOT currently listed for sale but could be strong acquisition candidates.
Use Google Maps, Yelp, LinkedIn, and public business directories to find real businesses.
Focus on owner-operated businesses that appear to be in the right size/revenue range.
Only return real businesses you find — do not fabricate entries.`,
    messages: [{
      role: 'user',
      content: `Find established businesses in the following criteria that are NOT currently for sale — these are off-market prospecting targets:

  Industry / Type: ${profile.industry}
  Location: ${profile.location}
  Estimated acquisition price range: ${priceRange} (use this to infer approximate revenue size)

Search Google Maps, Yelp, LinkedIn, and public directories for real businesses in this area and industry.
Prioritize businesses that appear owner-operated, established 5+ years, with strong reviews and local presence.

Return up to 10 real off-market prospects as a JSON array. Each object must have these exact keys:
[
  {
    "name": "Business name",
    "address": "Full street address",
    "phone": "Phone number or 'Not Found'",
    "website": "Website URL or 'Not Found'",
    "google_rating": "e.g. '4.7 ★ (142 reviews)' or 'Not Found'",
    "years_in_business": "Estimated or confirmed years, e.g. 'Est. 2008 (17 years)' or 'Unknown'",
    "owner_name": "Owner name if publicly findable, otherwise 'Not Found'",
    "estimated_revenue_range": "Rough estimate based on size/employees/reviews, e.g. '$1M–$3M'",
    "why_good_prospect": "1-2 sentences on why this business could be a good acquisition target"
  }
]

Return ONLY the JSON array. No preamble, no explanation, no markdown fences.`,
    }],
  });

  return safeParseJson(resp.content, 'off-market');
}

// ─── EMAIL ────────────────────────────────────────────────────────────────────

function buildEmailHtml(profile, results) {
  const date = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const priceRange = `${fmtPrice(profile.price_min)} – ${fmtPrice(profile.price_max || 'no max')}`;

  const onMarket  = results.onMarket  || [];
  const offMarket = results.offMarket || [];

  const listingCards = onMarket.map(l => `
    <div style="background:#1e293b;border:1px solid #2d3748;border-radius:8px;padding:20px;margin-bottom:14px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
        <div>
          <div style="font-weight:700;font-size:16px;color:#e2e8f0;margin-bottom:4px;">${l.name || 'Confidential Listing'}</div>
          <div style="font-size:12px;color:#64748b;">${l.location || ''} · ${l.source_platform || ''}</div>
        </div>
        <div style="text-align:right;flex-shrink:0;margin-left:16px;">
          <div style="font-size:18px;font-weight:700;color:#2eb860;">${l.asking_price || 'N/A'}</div>
          <div style="font-size:11px;color:#64748b;">Asking Price</div>
        </div>
      </div>
      <div style="display:flex;gap:24px;margin-bottom:12px;">
        <div><div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.5px;">Revenue</div><div style="font-size:14px;color:#94a3b8;">${l.gross_revenue || 'N/A'}</div></div>
        <div><div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.5px;">Cash Flow</div><div style="font-size:14px;color:#94a3b8;">${l.cash_flow || 'N/A'}</div></div>
        <div><div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.5px;">Broker</div><div style="font-size:14px;color:#94a3b8;">${l.broker_name || 'N/A'}</div></div>
      </div>
      ${l.description ? `<div style="font-size:13px;color:#94a3b8;line-height:1.6;margin-bottom:14px;">${l.description}</div>` : ''}
      ${l.listing_url && l.listing_url !== 'N/A' ? `<a href="${l.listing_url}" style="display:inline-block;background:#2eb860;color:#fff;text-decoration:none;font-size:13px;font-weight:600;padding:8px 18px;border-radius:4px;">View Listing →</a>` : ''}
    </div>`).join('');

  const prospectCards = offMarket.map(p => `
    <div style="background:#1e293b;border:1px solid #2d3748;border-radius:8px;padding:20px;margin-bottom:14px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
        <div>
          <div style="font-weight:700;font-size:16px;color:#e2e8f0;margin-bottom:4px;">${p.name || 'Unknown Business'}</div>
          <div style="font-size:12px;color:#64748b;">${p.address || ''}</div>
        </div>
        <span style="background:#334155;color:#94a3b8;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:3px 10px;border-radius:3px;flex-shrink:0;margin-left:12px;">Off-Market</span>
      </div>
      <div style="display:flex;gap:24px;margin-bottom:12px;flex-wrap:wrap;">
        ${p.google_rating !== 'Not Found' ? `<div><div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.5px;">Rating</div><div style="font-size:14px;color:#94a3b8;">${p.google_rating}</div></div>` : ''}
        <div><div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.5px;">In Business</div><div style="font-size:14px;color:#94a3b8;">${p.years_in_business || 'Unknown'}</div></div>
        <div><div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.5px;">Est. Revenue</div><div style="font-size:14px;color:#94a3b8;">${p.estimated_revenue_range || 'Unknown'}</div></div>
        ${p.owner_name !== 'Not Found' ? `<div><div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.5px;">Owner</div><div style="font-size:14px;color:#94a3b8;">${p.owner_name}</div></div>` : ''}
      </div>
      ${p.why_good_prospect ? `<div style="font-size:13px;color:#94a3b8;line-height:1.6;padding:10px 14px;background:rgba(46,184,96,.06);border-left:3px solid #2eb860;border-radius:0 4px 4px 0;margin-bottom:10px;">${p.why_good_prospect}</div>` : ''}
      <div style="display:flex;gap:16px;flex-wrap:wrap;">
        ${p.phone && p.phone !== 'Not Found' ? `<span style="font-size:13px;color:#64748b;">📞 ${p.phone}</span>` : ''}
        ${p.website && p.website !== 'Not Found' ? `<a href="${p.website.startsWith('http') ? p.website : 'https://' + p.website}" style="font-size:13px;color:#2eb860;text-decoration:none;">🌐 Website</a>` : ''}
      </div>
    </div>`).join('');

  const noListings = `<div style="color:#64748b;font-style:italic;padding:16px;text-align:center;">No listings found matching these criteria today. Criteria may be too narrow or no new listings posted.</div>`;
  const noProspects = `<div style="color:#64748b;font-style:italic;padding:16px;text-align:center;">No off-market prospects found in this search. Try broadening the location or industry keywords.</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#0f1117;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:680px;margin:0 auto;background:#0f1117;">

    <!-- Header -->
    <div style="background:#0a1628;padding:24px 32px;border-bottom:3px solid #2eb860;">
      <div style="font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;color:#2eb860;margin-bottom:6px;">Peterson Acquisitions — The Deal Team</div>
      <div style="font-size:22px;font-weight:700;color:#e2e8f0;letter-spacing:1px;text-transform:uppercase;">Deal Finder</div>
      <div style="font-size:13px;color:#64748b;margin-top:6px;">Buyer's Academy — Automated Deal Search</div>
    </div>

    <!-- Intro -->
    <div style="padding:24px 32px;border-bottom:1px solid #1a2235;">
      <div style="font-size:15px;color:#e2e8f0;margin-bottom:8px;">Hi ${profile.buyer_name},</div>
      <div style="font-size:14px;color:#94a3b8;line-height:1.65;">Here are today's deal matches for your search criteria. On-market listings come from major business brokerage platforms. Off-market prospects are established businesses in your target area that may be open to an acquisition conversation.</div>
      <div style="margin-top:14px;padding:12px 16px;background:#1e293b;border-radius:6px;font-size:12px;color:#64748b;">
        <strong style="color:#94a3b8;">Search Criteria:</strong> ${profile.industry} · ${profile.location} · ${priceRange}
      </div>
    </div>

    <!-- On-Market -->
    <div style="padding:24px 32px 8px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#2eb860;margin-bottom:4px;">01 — On-Market Listings</div>
      <div style="font-size:12px;color:#64748b;margin-bottom:16px;">Active listings sourced from BizBuySell, BizQuest, Sunbelt, Murphy Business &amp; more</div>
      ${onMarket.length ? listingCards : noListings}
    </div>

    <!-- Off-Market -->
    <div style="padding:16px 32px 24px;">
      <div style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#64748b;margin-bottom:4px;">02 — Off-Market Prospects</div>
      <div style="font-size:12px;color:#64748b;margin-bottom:16px;">Established businesses not currently for sale — potential outreach candidates</div>
      ${offMarket.length ? prospectCards : noProspects}
    </div>

    <!-- Footer -->
    <div style="background:#0a1628;padding:20px 32px;border-top:1px solid #1a2235;">
      <div style="font-size:12px;color:#334155;line-height:1.6;">
        This report was automatically generated on ${date} by the Peterson Acquisitions Deal Finder system.<br>
        Listings and prospects are sourced via AI-assisted web research and may not be exhaustive.<br>
        <strong style="color:#475569;">Questions?</strong> Contact your Deal Team advisor directly.
      </div>
    </div>

  </div>
</body>
</html>`;
}

async function sendEmail(profile, results) {
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;

  if (!gmailUser || !gmailPass) {
    throw new Error('GMAIL_USER and GMAIL_APP_PASSWORD must be set in .env to enable email delivery.');
  }

  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: { user: gmailUser, pass: gmailPass },
  });

  const fromAddress = process.env.GMAIL_FROM || gmailUser;
  const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const ccList = [];
  if (process.env.ADVISOR_CC_EMAIL) ccList.push(process.env.ADVISOR_CC_EMAIL);

  const info = await transporter.sendMail({
    from:    `"Deal Finder | The Deal Team" <${fromAddress}>`,
    to:      profile.buyer_email,
    cc:      ccList.length ? ccList : undefined,
    subject: `Deal Finder: ${profile.industry} in ${profile.location} — ${date}`,
    html:    buildEmailHtml(profile, results),
  });

  console.log(`[Deal Finder] Email sent — messageId: ${info.messageId}`);
  return info;
}

// ─── CORE SEARCH RUNNER ───────────────────────────────────────────────────────

async function runSearch(profile) {
  const [onMarket, offMarket] = await Promise.all([
    searchOnMarket(profile).catch(e => { console.error('On-market search error:', e.message); return []; }),
    searchOffMarket(profile).catch(e => { console.error('Off-market search error:', e.message); return []; }),
  ]);
  return { onMarket, offMarket };
}

// Exported for cron use in index.js — attached to router after routes are defined below
async function runSearchAndEmail(profile) {
  const db = getDb();
  const results = await runSearch(profile);
  await sendEmail(profile, results);
  db.prepare('UPDATE deal_finder_searches SET last_run_at = ? WHERE id = ?')
    .run(new Date().toISOString(), profile.id);
  return results;
}

// ─── ROUTES ───────────────────────────────────────────────────────────────────

// GET /api/deal-finder — list all profiles
router.get('/', (req, res) => {
  try {
    const db = getDb();
    const profiles = db.prepare(
      'SELECT * FROM deal_finder_searches ORDER BY created_at DESC'
    ).all();
    res.json(profiles);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/deal-finder — create profile
router.post('/', (req, res) => {
  const { buyer_name, buyer_email, industry, location, price_min, price_max, revenue_min, revenue_max, active } = req.body;
  if (!buyer_name || !buyer_email || !industry || !location) {
    return res.status(400).json({ error: 'buyer_name, buyer_email, industry, and location are required' });
  }
  try {
    const db = getDb();
    const id = uuidv4();
    db.prepare(`
      INSERT INTO deal_finder_searches
        (id, buyer_name, buyer_email, industry, location, price_min, price_max, revenue_min, revenue_max, active, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, buyer_name, buyer_email, industry, location,
      price_min || 0, price_max || 5000000,
      revenue_min || 0, revenue_max || 0,
      active !== false ? 1 : 0,
      new Date().toISOString()
    );
    res.json({ id });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/deal-finder/:id
router.delete('/:id', (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM deal_finder_searches WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/deal-finder/:id — update profile fields
router.patch('/:id', (req, res) => {
  const { buyer_name, buyer_email, industry, location, price_min, price_max, revenue_min, revenue_max, active } = req.body;
  if (!buyer_name || !buyer_email || !industry || !location) {
    return res.status(400).json({ error: 'buyer_name, buyer_email, industry, and location are required' });
  }
  try {
    const db = getDb();
    const row = db.prepare('SELECT id FROM deal_finder_searches WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    db.prepare(`
      UPDATE deal_finder_searches
      SET buyer_name=?, buyer_email=?, industry=?, location=?,
          price_min=?, price_max=?, revenue_min=?, revenue_max=?, active=?
      WHERE id=?
    `).run(
      buyer_name, buyer_email, industry, location,
      price_min ?? 0, price_max ?? 5000000,
      revenue_min ?? 0, revenue_max ?? 0,
      active !== false ? 1 : 0,
      req.params.id
    );
    const updated = db.prepare('SELECT * FROM deal_finder_searches WHERE id = ?').get(req.params.id);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/deal-finder/:id/toggle — flip active flag
router.patch('/:id/toggle', (req, res) => {
  try {
    const db = getDb();
    const row = db.prepare('SELECT active FROM deal_finder_searches WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    const newActive = row.active ? 0 : 1;
    db.prepare('UPDATE deal_finder_searches SET active = ? WHERE id = ?').run(newActive, req.params.id);
    res.json({ active: newActive });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/deal-finder/:id/run — kick off async search
router.post('/:id/run', (req, res) => {
  try {
    const db = getDb();
    const profile = db.prepare('SELECT * FROM deal_finder_searches WHERE id = ?').get(req.params.id);
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const jobId = uuidv4();
    jobs.set(jobId, { status: 'processing', createdAt: Date.now() });

    // Fire async
    (async () => {
      try {
        const results = await runSearch(profile);
        db.prepare('UPDATE deal_finder_searches SET last_run_at = ? WHERE id = ?')
          .run(new Date().toISOString(), profile.id);

        // Attempt email — capture result without blocking job completion
        let emailStatus = 'sent';
        let emailError  = null;
        try {
          await sendEmail(profile, results);
        } catch (e) {
          emailStatus = 'failed';
          emailError  = e.message;
          console.error('Deal Finder email error:', e.message);
        }

        jobs.set(jobId, { status: 'complete', results, emailStatus, emailError, createdAt: Date.now() });
      } catch (e) {
        jobs.set(jobId, { status: 'error', error: e.message, createdAt: Date.now() });
      }
    })();

    res.json({ jobId });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/deal-finder/jobs/:jobId — poll status
router.get('/jobs/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found or expired' });
  res.json({ status: job.status, results: job.results, error: job.error, emailStatus: job.emailStatus, emailError: job.emailError });
});

router.runSearchAndEmail = runSearchAndEmail;
module.exports = router;
