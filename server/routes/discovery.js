const express   = require('express');
const Anthropic  = require('@anthropic-ai/sdk');
const { v4: uuidv4 } = require('uuid');
const { getDb }  = require('../database');
const { assessSbaEligibility, applySbaGuardrail } = require('../sbaEligibility');
const { SYSTEM_PROMPT, buildDiscoveryUserPrompt } = require('../discoveryPrompt');

const router    = express.Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── JOB STORE (in-memory) ────────────────────────────────────────────────────
// Each job: { status: 'processing'|'complete'|'error', text?, error?, createdAt }
// Auto-cleaned after 10 minutes.

const jobs = new Map();

function makeJobId() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

async function runJob(jobId, fields) {
  const businessName = fields.businessName;
  const websiteUrl = fields.websiteUrl;
  const sellerName = fields.sellerName;
  const state = fields.state;
  const industryDescription = fields.industryDescription;
  const assessment = assessSbaEligibility(fields);
  const userPrompt = buildDiscoveryUserPrompt({ ...fields, assessment });

  try {
    const response = await anthropic.messages.create(
      {
        model:     'claude-opus-4-5',
        max_tokens: 16000,
        system:    SYSTEM_PROMPT,
        tools:     [{ type: 'web_search_20250305', name: 'web_search' }],
        messages:  [{ role: 'user', content: userPrompt }],
      },
      { timeout: 270_000 }
    );

    const rawText = (response.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('');

    const text = rawText ? applySbaGuardrail(rawText, fields).text : '';

    if (!text) {
      jobs.set(jobId, { status: 'error', error: 'No text content in API response. Please retry.', createdAt: Date.now() });
      return;
    }

    // Persist to SQLite so reports survive server restarts
    try {
      const db = getDb();
      db.prepare(`
        INSERT INTO discovery_reports (id, business_name, website_url, seller_name, state, industry, report_text, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        uuidv4(),
        businessName || null, websiteUrl || null, sellerName || null,
        state || null, industryDescription || null,
        text,
        new Date().toISOString()
      );
    } catch (dbErr) {
      console.warn('[Discovery] Could not save report to DB:', dbErr.message);
    }

    jobs.set(jobId, { status: 'complete', text, createdAt: Date.now() });

  } catch (err) {
    const isTimeout = err.name === 'APIConnectionTimeoutError' || err.name === 'TimeoutError' || err.name === 'AbortError';
    const msg = isTimeout
      ? 'Research timed out. Please retry.'
      : (err.message || 'Unexpected error during research.');
    jobs.set(jobId, { status: 'error', error: msg, createdAt: Date.now() });
  }

  // Auto-clean job from memory after 10 minutes (report is now in SQLite)
  setTimeout(() => jobs.delete(jobId), 600_000);
}

// ─── ROUTES ───────────────────────────────────────────────────────────────────

// POST /api/discovery — start a job, return job ID immediately
router.post('/', (req, res) => {
  const {
    businessName, websiteUrl, sellerName, state, industryDescription,
    revenue, ebitda, sde, askingPrice, employees, tangibleNetWorth, avgNetIncome, naics,
  } = req.body || {};

  // At least one identifying field must be provided. Financials alone are not a target.
  if (!businessName && !websiteUrl && !state && !industryDescription) {
    return res.status(400).json({ error: 'At least one field is required to generate a report.' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured on server.' });
  }

  const jobId = makeJobId();
  jobs.set(jobId, { status: 'processing', createdAt: Date.now() });

  // Fire-and-forget — runs in background while client polls
  runJob(jobId, {
    businessName, websiteUrl, sellerName, state, industryDescription,
    revenue, ebitda, sde, askingPrice, employees, tangibleNetWorth, avgNetIncome, naics,
  });

  res.json({ jobId });
});

// GET /api/discovery/recent — list last 20 saved reports (newest first)
router.get('/recent', (req, res) => {
  try {
    const db = getDb();
    const rows = db.prepare(`
      SELECT id, business_name, website_url, seller_name, state, industry, created_at
      FROM discovery_reports
      ORDER BY created_at DESC
      LIMIT 20
    `).all();
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/discovery/reports/:id — retrieve a saved report's full text
router.get('/reports/:id', (req, res) => {
  try {
    const db  = getDb();
    const row = db.prepare('SELECT * FROM discovery_reports WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Report not found' });
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/discovery/:jobId — poll job status
router.get('/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found. It may have expired — please start a new report.' });
  res.json(job);
});

module.exports = router;
