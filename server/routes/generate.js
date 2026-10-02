const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const { getDb, logEvent } = require('../database');
const { documentFromMessage, generationBody, textFromMessage } = require('../marketingText');
const { sourceBlockForDeal, loadPhotoAssets, stampMarketingHtml } = require('../dealDocuments');
const {
  blindAdSystem, blindAdUser, flyerSystem, flyerUser, cbrSystem, cbrUser, scrubUpside,
} = require('../marketingRules');
const { ensurePageFit } = require('../pageFit');
const { saveDocument, listVersions, restoreVersion, reviseDocument } = require('../marketingEdit');
const {
  extractReview, summaryPrompt, confirmMarketing, requireConfirmed, formatLockedBlock,
} = require('../marketingLock');

const router = express.Router();

function getClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

function loadInterview(deal) {
  try { return JSON.parse(deal.interview_data || '{}'); } catch { return {}; }
}

function stripFences(text) {
  return String(text || '').replace(/^```html\n?/i, '').replace(/\n?```$/, '').trim();
}

function loadConfirmed(deal, res) {
  try {
    return requireConfirmed(deal);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
    return null;
  }
}

// POST /api/generate/summary
router.post('/summary', async (req, res) => {
  const { deal_id } = req.body || {};
  if (!deal_id) return res.status(400).json({ error: 'deal_id required' });
  try {
    const review = await extractReview(deal_id, async (draft) => {
      const message = await getClient().messages.create(summaryPrompt(draft));
      return textFromMessage(message);
    });
    res.json(review);
  } catch (err) {
    console.error('Marketing summary error:', err);
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

// POST /api/generate/confirm
router.post('/confirm', (req, res) => {
  const { deal_id } = req.body || {};
  if (!deal_id) return res.status(400).json({ error: 'deal_id required' });
  try {
    const lock = confirmMarketing(deal_id, req.body || {});
    logEvent(deal_id, req.user, 'marketing_confirmed', `Valuation SDE confirmed (${lock.valuation_basis_label})`);
    res.json({
      marketing_lock: lock,
      valuation_sde: lock.valuation_sde,
      valuation_basis_label: lock.valuation_basis_label,
      sba_rate: lock.sba_rate,
    });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

// POST /api/generate/blind-ad
router.post('/blind-ad', async (req, res) => {
  const { deal_id } = req.body;
  if (!deal_id) return res.status(400).json({ error: 'deal_id required' });
  const deal = getDb().prepare('SELECT * FROM deals WHERE id = ?').get(deal_id);
  if (!deal) return res.status(404).json({ error: 'Deal not found' });

  const interviewData = loadInterview(deal);
  const sources = sourceBlockForDeal(deal_id);
  const lock = loadConfirmed(deal, res);
  if (!lock) return undefined;
  const client = getClient();
  try {
    const message = await client.messages.create(generationBody(
      4000,
      blindAdSystem(),
      blindAdUser({
        interviewData,
        sources,
        advisorName: interviewData.advisor_name || deal.advisor_name,
        lockedBlock: formatLockedBlock(lock),
      })
    ));

    const blindAdText = saveDocument(
      deal_id,
      'blind_ad',
      scrubUpside(documentFromMessage(message, 'Blind ad')),
      'generate',
      null
    );
    logEvent(deal_id, req.user, 'blind_ad_generated', 'Blind ad generated');
    res.json({ blind_ad_text: blindAdText });
  } catch (err) {
    console.error('Blind ad generation error:', err);
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

// POST /api/generate/flyer
router.post('/flyer', async (req, res) => {
  const { deal_id } = req.body;
  if (!deal_id) return res.status(400).json({ error: 'deal_id required' });
  const deal = getDb().prepare('SELECT * FROM deals WHERE id = ?').get(deal_id);
  if (!deal) return res.status(404).json({ error: 'Deal not found' });

  const interviewData = loadInterview(deal);
  const sources = sourceBlockForDeal(deal_id);
  const photos = loadPhotoAssets(deal_id);
  const lock = loadConfirmed(deal, res);
  if (!lock) return undefined;
  const client = getClient();
  try {
    const message = await client.messages.create(generationBody(
      12000,
      flyerSystem(),
      flyerUser({
        interviewData,
        sources,
        photos,
        advisorName: deal.advisor_name,
        lockedBlock: formatLockedBlock(lock),
      })
    ));

    const drafted = scrubUpside(stampMarketingHtml(
      stripFences(documentFromMessage(message, 'One-page flyer')),
      { ...photos, stampCover: true, stampAdvisor: true, stampSidebar: false, stampGallery: false }
    ));
    const fitted = await ensurePageFit(drafted, 'flyer');
    const flyerHtml = saveDocument(deal_id, 'flyer', fitted.html, 'generate', null);
    logEvent(deal_id, req.user, 'flyer_generated', 'One-page flyer generated');
    res.json({ flyer_html: flyerHtml, page_fit: { fit: fitted.fit, flagged: fitted.flagged } });
  } catch (err) {
    console.error('Flyer generation error:', err);
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

// POST /api/generate/cbr
router.post('/cbr', async (req, res) => {
  const { deal_id } = req.body;
  if (!deal_id) return res.status(400).json({ error: 'deal_id required' });
  const deal = getDb().prepare('SELECT * FROM deals WHERE id = ?').get(deal_id);
  if (!deal) return res.status(404).json({ error: 'Deal not found' });

  const interviewData = loadInterview(deal);
  const sources = sourceBlockForDeal(deal_id);
  const photos = loadPhotoAssets(deal_id);
  const lock = loadConfirmed(deal, res);
  if (!lock) return undefined;
  const client = getClient();

  try {
    const message = await client.messages.create(generationBody(
      32000,
      cbrSystem(),
      cbrUser({
        interviewData,
        sources,
        photos,
        advisorName: deal.advisor_name,
        lockedBlock: formatLockedBlock(lock),
      })
    ));

    const drafted = stampMarketingHtml(
      stripFences(documentFromMessage(message, 'CBR')),
      { ...photos, stampCover: true, stampAdvisor: false, stampSidebar: true, stampGallery: true }
    );
    const fitted = await ensurePageFit(drafted, 'cbr');
    const cbrHtml = saveDocument(deal_id, 'cbr', fitted.html, 'generate', null);
    logEvent(deal_id, req.user, 'cbr_generated', 'Confidential Business Review generated');
    res.json({ cbr_html: cbrHtml, page_fit: { fit: fitted.fit, flagged: fitted.flagged } });
  } catch (err) {
    console.error('CBR generation error:', err);
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

// POST /api/generate/revise
router.post('/revise', async (req, res) => {
  const { deal_id, kind, request } = req.body || {};
  if (!deal_id) return res.status(400).json({ error: 'deal_id required' });
  const deal = getDb().prepare('SELECT * FROM deals WHERE id = ?').get(deal_id);
  if (!deal) return res.status(404).json({ error: 'Deal not found' });
  try {
    const edited = await reviseDocument(deal, kind, request, (body) => (
      getClient().messages.create(body)
    ), req.user);
    const key = kind === 'blind_ad' ? 'blind_ad_text' : kind === 'flyer' ? 'flyer_html' : 'cbr_html';
    res.json({ kind, [key]: edited });
  } catch (err) {
    console.error('Marketing edit error:', err);
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.get('/versions/:dealId/:kind', (req, res) => {
  try {
    res.json({ versions: listVersions(req.params.dealId, req.params.kind) });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
  }
});

router.post('/restore', (req, res) => {
  const { deal_id, version_id } = req.body || {};
  if (!deal_id || !version_id) return res.status(400).json({ error: 'deal_id and version_id required' });
  try {
    const restored = restoreVersion(deal_id, version_id);
    const key = restored.kind === 'blind_ad' ? 'blind_ad_text' : restored.kind === 'flyer' ? 'flyer_html' : 'cbr_html';
    logEvent(deal_id, req.user, 'marketing_restored', `Restored a previous ${restored.kind.replace('_', ' ')}`);
    res.json({ kind: restored.kind, [key]: restored.body });
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message });
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
