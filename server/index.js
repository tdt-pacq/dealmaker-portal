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
const { getDb, seedTestDeal } = require('./database');
const dealsRouter = require('./routes/deals');
const generateRouter = require('./routes/generate');
const exportRouter = require('./routes/export');
const extractRouter = require('./routes/extract');
const discoveryRouter = require('./routes/discovery');
const dealFinderRouter  = require('./routes/deal-finder');
const buyerIntelRouter  = require('./routes/buyer-intel');
const otpRouter         = require('./routes/otp');

const app = express();
const PORT = process.env.PORT || 3001;

// Ensure output directory exists
fs.mkdirSync(path.join(__dirname, '..', 'output'), { recursive: true });

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

app.use('/api/deals',        dealsRouter);
app.use('/api/generate',     generateRouter);
app.use('/api/export',       exportRouter);
app.use('/api/extract',      extractRouter);
app.use('/api/discovery',    discoveryRouter);
app.use('/api/deal-finder',  dealFinderRouter);
app.use('/api/buyer-intel',  buyerIntelRouter);
app.use('/api/otp',          otpRouter);

// Serve generated output files (auth required)
app.use('/output', basicAuth, express.static(path.join(__dirname, '..', 'output')));

// Health check (no auth)
app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

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

// Seed test data in development only
if (process.env.NODE_ENV !== 'production') {
  seedTestDeal();
}

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
  console.log(`Auth: ${process.env.TEAM_USERNAME} / [password from .env]`);
});
