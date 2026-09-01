require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const cron = require('node-cron');
const { basicAuth }  = require('./auth');
const rateLimit      = require('express-rate-limit');

// General API limiter — 120 req/min per IP (protects CRUD routes)
const apiLimiter = rateLimit({
  windowMs: 60_000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests — please slow down.' },
});

// AI limiter — 10 AI research kicks per 10 min per IP (each call costs real money)
const aiLimiter = rateLimit({
  windowMs: 10 * 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'AI request limit reached. Please wait a few minutes before trying again.' },
});
const { getDb, seedTestDeal, seedUsers } = require('./database');
const { runBackup } = require('./backup');
const dealsRouter = require('./routes/deals');
const usersRouter = require('./routes/users');
const generateRouter = require('./routes/generate');
const exportRouter = require('./routes/export');
const extractRouter = require('./routes/extract');
const discoveryRouter = require('./routes/discovery');
const dealFinderRouter  = require('./routes/deal-finder');
const buyerIntelRouter  = require('./routes/buyer-intel');
const otpRouter         = require('./routes/otp');
const redactRouter      = require('./routes/redact');

const app = express();
const PORT = process.env.PORT || 3001;

// Ensure output directory exists (persisted at /data/output on Render; local fallback for dev)
const { OUTPUT_ROOT } = require('./paths');
fs.mkdirSync(OUTPUT_ROOT, { recursive: true });

// In production Express serves the React build directly (same origin — no CORS needed).
// In dev the Vite dev server runs on :3000 and needs CORS to reach the API on :3001.
const isDev = process.env.NODE_ENV !== 'production';
app.use(cors({
  origin: isDev ? 'http://localhost:3000' : false,
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Auth + general rate limit on all API routes
app.use('/api', basicAuth, apiLimiter);

// Tighter rate limits on expensive AI endpoints (POST-only — polls must never be rate-limited)
app.post('/api/discovery',            aiLimiter);
app.use('/api/buyer-intel/research', aiLimiter);
app.use('/api/deal-finder/:id/run',  aiLimiter);

app.use('/api/users',        usersRouter);
app.use('/api/deals',        dealsRouter);
app.use('/api/generate',     generateRouter);
app.use('/api/export',       exportRouter);
app.use('/api/extract',      extractRouter);
app.use('/api/discovery',    discoveryRouter);
app.use('/api/deal-finder',  dealFinderRouter);
app.use('/api/buyer-intel',  buyerIntelRouter);
app.use('/api/otp',          otpRouter);
app.use('/api/redact',       redactRouter);

// Serve generated output files (auth required)
app.use('/output', basicAuth, express.static(OUTPUT_ROOT));

// Health check (no auth)
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

// Manual backup trigger (admin only)
app.post('/api/admin/backup', basicAuth, async (req, res) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  res.json({ message: 'Backup started — check server logs for result.' });
  runBackup().catch(e => console.error('[Backup] Manual trigger failed:', e.message));
});

// One-time migration: import legacy Drive deals into SQLite
app.post('/api/admin/migrate-drive-deals', basicAuth, (req, res) => {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
  const { randomUUID } = require('crypto');
  const db = getDb();
  const deals = req.body;
  if (!Array.isArray(deals)) return res.status(400).json({ error: 'Body must be a JSON array of deals' });

  const insert = db.prepare(`
    INSERT OR IGNORE INTO deals
      (id, deal_name, status, advisor_name, interview_data, blind_ad_text, flyer_html, cbr_html, created_at, updated_at)
    VALUES
      (@id, @deal_name, @status, @advisor_name, @interview_data, @blind_ad_text, @flyer_html, @cbr_html, @created_at, @updated_at)
  `);
  const logEv = db.prepare(`
    INSERT INTO deal_events (id, deal_id, user_id, user_display_name, event_type, description, created_at)
    VALUES (@id, @deal_id, @user_id, @user_display_name, @event_type, @description, @created_at)
  `);

  let imported = 0, skipped = 0;
  const now = new Date().toISOString();

  for (const d of deals) {
    const fz = d.flyerZones || {}, cs = d.cimSections || {}, raw = d.rawOutputs || {};
    const interviewData = {
      business_legal_name: d.name, business_website: d.website || '',
      year_founded: fz.BUSINESS_STARTED || '', business_city_state: (fz.SUBHEAD_INDUSTRY || '').split('|').pop().trim(),
      hours_of_operation: fz.HOURS_OF_OPERATION || '', employees_count: fz.EMPLOYEES || '',
      business_description: fz.OVERVIEW_PARAGRAPH || '',
      asking_price: (d.price || '').replace(/[^0-9.]/g, ''),
      revenue_year1: (fz.PRICE_BOX_REVENUE_VALUE || '').replace(/[^0-9.]/g, ''), revenue_year1_label: '2025',
      sde_year1: (fz.PRICE_BOX_CASHFLOW_VALUE || '').replace(/[^0-9.]/g, ''), sde_year1_label: '2025',
      ffe_value: (fz.PRICE_BOX_FFE_VALUE || '').replace(/[^0-9.]/g, ''),
      financing_type: 'SBA Eligible', down_payment_required: '', sba_preapproved: 'yes',
      _legacy_flyer_headline1: fz.HEADLINE_LINE_1 || '', _legacy_flyer_headline2: fz.HEADLINE_LINE_2 || '',
      _legacy_flyer_headline3: fz.HEADLINE_LINE_3 || '', _legacy_flyer_subhead: fz.SUBHEAD_INDUSTRY || '',
      _legacy_flyer_descriptor: fz.SUBHEAD_DESCRIPTOR || '', _legacy_flyer_overview: fz.OVERVIEW_PARAGRAPH || '',
      _legacy_key_features: [1,2,3,4,5,6].map(n => ({ label: fz[`KEY_FEATURE_${n}_LABEL`]||'', value: fz[`KEY_FEATURE_${n}_VALUE`]||'' })).filter(f=>f.label),
      _legacy_analysis_points: [1,2,3,4,5].map(n => ({ label: cs[`ANALYSIS_POINT_${n}_LABEL`]||fz[`ANALYSIS_POINT_${n}_LABEL`]||'', body: cs[`ANALYSIS_POINT_${n}_BODY`]||fz[`ANALYSIS_POINT_${n}_BODY`]||'' })).filter(p=>p.label),
      _legacy_cim_tagline: cs.COVER_TAGLINE || '', _legacy_cim_exec_overview: cs.EXEC_OVERVIEW || '',
      _legacy_primary_color: d.primaryColor || '', _legacy_accent_color: d.accentColor || '',
      _legacy_drive_id: d.id,
    };
    const row = {
      id: randomUUID(), deal_name: d.name, status: d.status || 'active',
      advisor_name: d.advisorName || '', interview_data: JSON.stringify(interviewData),
      blind_ad_text: raw.blindAd || '', flyer_html: null, cbr_html: null,
      created_at: d.createdAt || now, updated_at: d.updatedAt || now,
    };
    const result = insert.run(row);
    if (result.changes === 0) { skipped++; continue; }
    logEv.run({ id: randomUUID(), deal_id: row.id, user_id: null, user_display_name: 'Migration',
      event_type: 'deal_created', description: `Imported from legacy Google Drive (original ID: ${d.id}, by ${d.createdBy||'unknown'})`, created_at: d.createdAt || now });
    imported++;
  }
  res.json({ imported, skipped, total: deals.length });
});

// Serve root index.html (Deal Marketing — has its own Firebase auth, no basic auth needed)
const rootHtml = path.join(__dirname, '..', 'index.html');
app.get('/pacq-app', (req, res) => res.sendFile(rootHtml));

// Serve Discovery Prep standalone app (no basic auth — standalone tool with its own key)
const discoveryHtml = path.join(__dirname, '..', 'discovery-prep.html');
app.get('/discovery-prep.html', (req, res) => res.sendFile(discoveryHtml));

// Serve root-level assets (images, fonts, etc. referenced by index.html)
const rootAssets = path.join(__dirname, '..', 'assets');
if (fs.existsSync(rootAssets)) {
  app.use('/assets', express.static(rootAssets));
}

// Serve React build in production
const clientBuild = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientBuild)) {
  app.use(express.static(clientBuild));
  app.get('*', (req, res) => res.sendFile(path.join(clientBuild, 'index.html')));
}

// Seed initial users (idempotent — only runs if users table is empty)
seedUsers();

// Seed test deal data in development only
if (process.env.NODE_ENV !== 'production') {
  seedTestDeal();
}

// ─── Database Backup — Daily Cron ────────────────────────────────────────────
// Runs at 2:00am Eastern — before business hours, after Deal Finder emails
cron.schedule('0 2 * * *', () => {
  runBackup().catch(e => console.error('[Backup] Unhandled error:', e.message));
}, { timezone: 'America/New_York' });

// ─── Deal Finder — Daily Cron ─────────────────────────────────────────────────
// Runs every morning at 7:00am Mountain Time for all active search profiles
cron.schedule('0 7 * * *', async () => {
  console.log('[Deal Finder] Starting daily cron run…');
  const db = getDb();
  const profiles = db.prepare('SELECT * FROM deal_finder_searches WHERE active = 1').all();
  console.log(`[Deal Finder] ${profiles.length} active profile(s) to process`);
  for (const profile of profiles) {
    try {
      await dealFinderRouter.runSearchAndEmail(profile);
      console.log(`[Deal Finder] Sent to ${profile.buyer_email} (${profile.industry} · ${profile.location})`);
    } catch (e) {
      console.error(`[Deal Finder] Failed for profile ${profile.id}:`, e.message);
    }
  }
  console.log('[Deal Finder] Daily cron complete');
}, { timezone: 'America/New_York' });

app.listen(PORT, () => {
  console.log(`PACQ server running on http://localhost:${PORT}`);
  console.log(`Auth: per-user bcrypt (initial password = username)`);
});
