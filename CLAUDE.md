# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Dealmaker Portal** — Internal tool for Peterson Acquisitions / The Deal Team. A full-stack web app that helps M&A advisors manage business listings, generate AI-powered marketing documents, research buyers, and produce legal documents (Offer to Purchase).

Deployed on Render (dashboard.render.com). The server serves both the API and the React SPA in production. Persistent SQLite DB is at /data/pacq_deals.db (DB_PATH env var), mounted on a Render disk at /data.

## Commands

### Development
```bash
# Install all dependencies (root installs concurrently; server and client have their own node_modules)
npm run install:all

# Run both server (port 3001) and client dev server (port 3000) concurrently
npm run dev

# Run server only (uses node --watch for auto-reload)
npm run dev:server

# Run client only (Vite HMR at http://localhost:3000)
npm run dev:client
```

### Production build
```bash
npm run build   # installs + builds React client into client/dist/
npm start       # runs server/index.js — serves built React app and API
```

There are no test suites. Manual testing via the browser is the verification path.

## Architecture

### Structure
```
dealmaker-portal/
├── server/          # Express API (CommonJS)
│   ├── index.js     # Entry point, middleware, route mounting, cron job
│   ├── auth.js      # HTTP Basic Auth middleware (TEAM_USERNAME / TEAM_PASSWORD env vars)
│   ├── database.js  # better-sqlite3 singleton, schema init + migrations, test seed
│   └── routes/
│       ├── deals.js        # CRUD for deal records
│       ├── generate.js     # AI document generation (blind ad, flyer, CBR)
│       ├── export.js       # Puppeteer → PDF for flyer and CBR
│       ├── extract.js      # Parse uploaded .docx/.txt → interview fields via Claude
│       ├── discovery.js    # Business Intel: AI web research report for seller discovery calls
│       ├── buyer-intel.js  # Buyer Intel: async AI research on prospective buyers
│       ├── deal-finder.js  # Deal Finder: automated daily deal search + email drip
│       └── otp.js          # Offer To Purchase: template → Puppeteer → PDF (no AI)
└── client/          # React 18 + Vite + Tailwind v4 (ESM)
    └── src/
        ├── App.jsx          # Root: login gate, layout shell (Sidebar + Topbar), React Router
        ├── api.js           # Axios instance with Basic Auth header injection, all API helpers
        ├── components/      # Sidebar, Topbar, DocumentExtractor, InterviewForm
        └── pages/
            ├── marketing/   # Deal Marketing: interview form → blind ad / flyer / CBR generation
            ├── analyzer/    # Market Price Analyzer
            ├── discovery/   # Business Intel (Discovery Prep)
            ├── buyers/      # BuyerStrategyApp, AcqCalcApp, DealFinderApp
            └── otp/         # Offer To Purchase generator
```

### Key architectural patterns

**Auth:** HTTP Basic Auth everywhere. Credentials stored in `sessionStorage` as a base64 string (`pacq_auth`). The axios instance in `api.js` injects it on every request. A 401 response triggers a full-page reload (forces re-login).

**Database:** SQLite via `better-sqlite3` (synchronous API). Single `getDb()` singleton. Schema is initialized inline in `initSchema()` — new columns are added via `ALTER TABLE` inside try/catch to handle idempotent migrations. In production, set `DB_PATH=/data/pacq_deals.db` and mount a Render persistent disk at `/data`.

**AI generation pattern:** All heavy AI work uses `@anthropic-ai/sdk`. Long-running jobs (Buyer Intel, Deal Finder) follow a fire-and-forget async pattern: POST returns a `{ jobId }`, client polls `GET .../jobs/:id`. Results are stored in an in-memory `Map` and auto-cleaned after 15–30 minutes. Short AI calls (blind ad, flyer, CBR, extract) are synchronous request/response.

**PDF export:** Puppeteer renders the saved HTML from the database to PDF. Flyer is Letter portrait; CBR is 1920×1080 landscape. The `output/` directory is served as static files under `/output` (auth-gated).

**Deal Finder cron:** Runs daily at 7:00am Eastern via `node-cron`. Queries all active `deal_finder_searches` profiles, runs a Claude web-search job for each, deduplicates against the `deal_finder_sent` ledger (max 5 new results/day per profile), and emails results via `nodemailer`.

**Rate limiting:** General API: 120 req/min. AI endpoints (discovery, buyer-intel research, deal-finder run): 10 req/10 min per IP.

### Dev vs. production routing
In **dev**, Vite runs on `:3000` and proxies `/api`, `/output`, `/pacq-app`, `/assets` to the Express server on `:3001`.  
In **production**, Express serves the React build directly from `client/dist/` with a catch-all `GET *` → `index.html`.

### AI models in use
- `claude-sonnet-4-6` — blind ad, flyer, CBR generation, document extraction
- `claude-sonnet-4-5` — buyer intel research (uses `web_search_20250305` tool)
- Deal Finder also uses `claude-sonnet-4-5` with `web_search_20250305`

### Sidebar navigation
The sidebar (`Sidebar.jsx`) drives the entire app's navigation. Items with `live: false` render as "Coming Soon" and are non-clickable. Live sections: **Sellers** (Business Intel, Market Price Analyzer, Deal Marketing) and **Buyers** (Buyer Intel, Acq Calculator, Deal Finder, OTP). **Advisors** section (Success Plan, SOPs, Training) is all coming soon.

## Environment variables (`.env`)
```
TEAM_USERNAME=      # Basic auth username for all /api routes
TEAM_PASSWORD=      # Basic auth password
ANTHROPIC_API_KEY=  # Required for all AI features
PORT=3001           # Optional, defaults to 3001
NODE_ENV=           # Set to "production" to disable CORS and test data seed
DB_PATH=            # Optional; defaults to server/pacq_deals.db
```

Email (Deal Finder) requires additional SMTP env vars configured in `server/routes/deal-finder.js`.
