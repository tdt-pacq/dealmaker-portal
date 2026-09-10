/**
 * Seller Engagement Proposal — broker/advisor CRUD behind Basic Auth.
 * GET /t/:token is the public seller share view: unguessable token, no login.
 * List / create / patch / delete stay authenticated.
 */

const express = require('express');
const crypto = require('crypto');
const { getDb } = require('../database');
const { defaultPacket, mergePacket, parsePacket, publicRow, shareViewRow } = require('../proposal-packet');

const SHARE_TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;

const router = express.Router();

function makeShareToken() {
  return crypto.randomBytes(24).toString('base64url');
}

function makeProposalId() {
  const year = new Date().getFullYear();
  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `SEP-${year}-${suffix}`;
}

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

function applySourceHooks(packet, { dealId, discoveryReportId, analyzerDealSlug }) {
  const db = getDb();
  const next = mergePacket(packet, {
    hooks: {
      dealId: dealId || packet.hooks.dealId || null,
      discoveryReportId: discoveryReportId || packet.hooks.discoveryReportId || null,
      analyzerDealSlug: analyzerDealSlug || packet.hooks.analyzerDealSlug || '',
    },
  });

  if (dealId) {
    const deal = db.prepare('SELECT id, deal_name, advisor_name, interview_data FROM deals WHERE id = ?').get(dealId);
    if (deal) {
      let interview = {};
      try { interview = JSON.parse(deal.interview_data || '{}'); } catch { /* */ }
      if (!next.cover.brokerName && deal.advisor_name) next.cover.brokerName = deal.advisor_name;
      if (!next.cover.sellerNames && interview.owner_name) next.cover.sellerNames = interview.owner_name;
      if (!next.cover.blindCompanyLabel && deal.deal_name) {
        next.cover.blindCompanyLabel = deal.deal_name;
      }
      if (!next.whyHere.situationFrame && interview.reason_for_selling) {
        next.whyHere.situationFrame = interview.reason_for_selling;
      }
    }
  }

  if (discoveryReportId) {
    const report = db.prepare(
      'SELECT id, business_name, seller_name, industry, state FROM discovery_reports WHERE id = ?'
    ).get(discoveryReportId);
    if (report) {
      if (!next.cover.sellerNames && report.seller_name) next.cover.sellerNames = report.seller_name;
      if (!next.cover.blindCompanyLabel) {
        const bits = [report.industry, report.state].filter(Boolean);
        next.cover.blindCompanyLabel = bits.length
          ? `${bits.join(' · ')} — confidential`
          : (report.business_name ? 'Confidential seller (label from BIR hook)' : '');
      }
      if (!next.bir.highlights) {
        next.bir.highlights = '';
      }
    }
  }

  if (analyzerDealSlug && !next.sellability.pfa && !next.trifecta.fmvLow) {
    // Firestore MPA lives client-side — store the slug hook only; never invent numbers.
    next.trifecta.supportNotes = next.trifecta.supportNotes || '';
  }

  return next;
}

// GET /api/proposals
router.get('/', (req, res) => {
  try {
    const rows = getDb().prepare(`
      SELECT id, share_token, status, created_by_user_id, created_by_display_name,
             deal_id, discovery_report_id, analyzer_deal_slug, packet, created_at, updated_at
      FROM seller_engagement_proposals
      ORDER BY updated_at DESC
    `).all();
    res.json(rows.map(publicRow));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/proposals
router.post('/', (req, res) => {
  try {
    const {
      deal_id = null,
      discovery_report_id = null,
      analyzer_deal_slug = '',
      packet: incomingPacket = {},
    } = req.body || {};

    const packet = applySourceHooks(defaultPacket({
      cover: {
        brokerName: incomingPacket.cover?.brokerName || req.user?.display_name || '',
        sellerNames: incomingPacket.cover?.sellerNames || '',
        spouseName: incomingPacket.cover?.spouseName || '',
        blindCompanyLabel: incomingPacket.cover?.blindCompanyLabel || '',
        proposalId: incomingPacket.cover?.proposalId || makeProposalId(),
        date: incomingPacket.cover?.date || todayISODate(),
      },
      whyHere: incomingPacket.whyHere,
      sellability: incomingPacket.sellability,
      trifecta: incomingPacket.trifecta,
      bir: incomingPacket.bir,
      noBs: incomingPacket.noBs,
      nextStep: incomingPacket.nextStep,
      hooks: incomingPacket.hooks,
    }), {
      dealId: deal_id,
      discoveryReportId: discovery_report_id,
      analyzerDealSlug: analyzer_deal_slug,
    });

    const id = crypto.randomUUID();
    const shareToken = makeShareToken();
    const now = new Date().toISOString();

    getDb().prepare(`
      INSERT INTO seller_engagement_proposals
        (id, share_token, status, created_by_user_id, created_by_display_name,
         deal_id, discovery_report_id, analyzer_deal_slug, packet, created_at, updated_at)
      VALUES (?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      shareToken,
      req.user?.id || null,
      req.user?.display_name || '',
      deal_id || null,
      discovery_report_id || null,
      analyzer_deal_slug || packet.hooks.analyzerDealSlug || '',
      JSON.stringify(packet),
      now,
      now
    );

    const row = getDb().prepare('SELECT * FROM seller_engagement_proposals WHERE id = ?').get(id);
    res.status(201).json(publicRow(row));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/proposals/t/:token — public seller share (auth middleware skips 401).
// Anonymous viewers get the packet only. Authenticated brokers get the full row.
router.get('/t/:token', (req, res) => {
  try {
    const token = req.params.token || '';
    if (!SHARE_TOKEN_RE.test(token)) {
      return res.status(404).json({ error: 'Proposal not found' });
    }
    const row = getDb().prepare('SELECT * FROM seller_engagement_proposals WHERE share_token = ?').get(token);
    if (!row) return res.status(404).json({ error: 'Proposal not found' });
    res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
    res.json(req.user ? publicRow(row) : shareViewRow(row));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/proposals/:id
router.get('/:id', (req, res) => {
  try {
    const row = getDb().prepare('SELECT * FROM seller_engagement_proposals WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Proposal not found' });
    res.json(publicRow(row));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /api/proposals/:id
router.patch('/:id', (req, res) => {
  try {
    const row = getDb().prepare('SELECT * FROM seller_engagement_proposals WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Proposal not found' });

    const current = parsePacket(row.packet);
    const nextPacket = req.body.packet
      ? applySourceHooks(mergePacket(current, req.body.packet), {
          dealId: req.body.deal_id !== undefined ? req.body.deal_id : row.deal_id,
          discoveryReportId: req.body.discovery_report_id !== undefined ? req.body.discovery_report_id : row.discovery_report_id,
          analyzerDealSlug: req.body.analyzer_deal_slug !== undefined ? req.body.analyzer_deal_slug : row.analyzer_deal_slug,
        })
      : current;

    const dealId = req.body.deal_id !== undefined ? (req.body.deal_id || null) : row.deal_id;
    const discoveryId = req.body.discovery_report_id !== undefined ? (req.body.discovery_report_id || null) : row.discovery_report_id;
    const analyzerSlug = req.body.analyzer_deal_slug !== undefined
      ? (req.body.analyzer_deal_slug || '')
      : row.analyzer_deal_slug;
    const status = req.body.status && ['draft', 'ready'].includes(req.body.status)
      ? req.body.status
      : row.status;

    getDb().prepare(`
      UPDATE seller_engagement_proposals
      SET packet = ?, deal_id = ?, discovery_report_id = ?, analyzer_deal_slug = ?,
          status = ?, updated_at = ?
      WHERE id = ?
    `).run(
      JSON.stringify(nextPacket),
      dealId,
      discoveryId,
      analyzerSlug,
      status,
      new Date().toISOString(),
      req.params.id
    );

    const updated = getDb().prepare('SELECT * FROM seller_engagement_proposals WHERE id = ?').get(req.params.id);
    res.json(publicRow(updated));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/proposals/:id
router.delete('/:id', (req, res) => {
  try {
    const row = getDb().prepare('SELECT id FROM seller_engagement_proposals WHERE id = ?').get(req.params.id);
    if (!row) return res.status(404).json({ error: 'Proposal not found' });
    getDb().prepare('DELETE FROM seller_engagement_proposals WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
