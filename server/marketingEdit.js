'use strict';

const { v4: uuidv4 } = require('uuid');
const { getDb, logEvent } = require('./database');
const { documentFromMessage, generationBody } = require('./marketingText');
const { requireConfirmed, formatLockedBlock, formatMoney } = require('./marketingLock');
const { scrubUpside } = require('./marketingRules');

const VERSION_LIMIT = 10;

const COLUMNS = {
  blind_ad: 'blind_ad_text',
  flyer: 'flyer_html',
  cbr: 'cbr_html',
};

const MAX_TOKENS = {
  blind_ad: 4000,
  flyer: 12000,
  cbr: 32000,
};

function httpError(statusCode, message) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function assertKind(kind) {
  if (!COLUMNS[kind]) throw httpError(400, 'Unknown marketing document.');
  return COLUMNS[kind];
}

function readBody(dealId, kind) {
  const column = assertKind(kind);
  const row = getDb().prepare(`SELECT ${column} AS body FROM deals WHERE id = ?`).get(dealId);
  if (!row) throw httpError(404, 'Deal not found');
  return row.body || '';
}

function latestVersion(dealId, kind) {
  return getDb().prepare(`
    SELECT id, body, source, created_at FROM deal_document_versions
    WHERE deal_id = ? AND kind = ?
    ORDER BY created_at DESC, rowid DESC
    LIMIT 1
  `).get(dealId, kind);
}

function insertVersion(dealId, kind, body, source, note, when) {
  getDb().prepare(`
    INSERT INTO deal_document_versions (id, deal_id, kind, body, source, note, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(uuidv4(), dealId, kind, body, source, note || null, when || new Date().toISOString());
}

function trimVersions(dealId, kind) {
  getDb().prepare(`
    DELETE FROM deal_document_versions
    WHERE deal_id = ? AND kind = ? AND id NOT IN (
      SELECT id FROM deal_document_versions
      WHERE deal_id = ? AND kind = ?
      ORDER BY created_at DESC, rowid DESC
      LIMIT ?
    )
  `).run(dealId, kind, dealId, kind, VERSION_LIMIT);
}

function rememberPrevious(dealId, kind, previous) {
  if (!previous) return;
  const latest = latestVersion(dealId, kind);
  if (latest && latest.body === previous) return;
  insertVersion(dealId, kind, previous, 'snapshot', null, new Date(Date.now() - 1).toISOString());
}

function saveDocument(dealId, kind, body, source, note) {
  const column = assertKind(kind);
  const previous = readBody(dealId, kind);
  rememberPrevious(dealId, kind, previous === body ? '' : previous);
  const now = new Date().toISOString();
  getDb().prepare(`UPDATE deals SET ${column} = ?, updated_at = ? WHERE id = ?`).run(body, now, dealId);
  insertVersion(dealId, kind, body, source, note, now);
  trimVersions(dealId, kind);
  return body;
}

function noteSavedBody(dealId, kind, previous, next) {
  assertKind(kind);
  if ((previous || '') === (next || '')) return;
  rememberPrevious(dealId, kind, previous || '');
  if (next) insertVersion(dealId, kind, next, 'manual', null, new Date().toISOString());
  trimVersions(dealId, kind);
}

function listVersions(dealId, kind) {
  assertKind(kind);
  const deal = getDb().prepare('SELECT id FROM deals WHERE id = ?').get(dealId);
  if (!deal) throw httpError(404, 'Deal not found');
  return getDb().prepare(`
    SELECT id, kind, source, note, created_at, length(body) AS body_chars
    FROM deal_document_versions
    WHERE deal_id = ? AND kind = ?
    ORDER BY created_at DESC, rowid DESC
    LIMIT ?
  `).all(dealId, kind, VERSION_LIMIT);
}

function restoreVersion(dealId, versionId) {
  const version = getDb().prepare(`
    SELECT id, kind, body FROM deal_document_versions WHERE id = ? AND deal_id = ?
  `).get(versionId, dealId);
  if (!version) throw httpError(404, 'Version not found');
  saveDocument(dealId, version.kind, version.body, 'restore', version.id);
  return { kind: version.kind, body: version.body, version_id: version.id };
}

function explicitNumbers(request) {
  const found = new Set();
  const re = /\$?\s*(\d[\d,]*(?:\.\d+)?)%?/g;
  let match;
  const text = String(request || '');
  while ((match = re.exec(text))) found.add(match[1].replace(/,/g, ''));
  return found;
}

function moneyTokens(text) {
  return [...String(text || '').matchAll(/\$\s?\d[\d,]*(?:\.\d+)?/g)].map((match) => match[0]);
}

function percentTokens(text) {
  return [...String(text || '').matchAll(/\b\d+(?:\.\d+)?%/g)].map((match) => match[0]);
}

function numberOf(token) {
  return String(token).replace(/[$,%\s]/g, '').replace(/,/g, '');
}

/**
 * Keep every currency and percent token from the original document unless
 * the advisor's request explicitly includes the replacement number.
 * Surrounding copy from the edited draft is preserved.
 */
function guardEdit(original, edited, request) {
  const allowed = explicitNumbers(request);
  const origMoney = moneyTokens(original);
  const origPct = percentTokens(original);
  let moneyIndex = 0;
  let pctIndex = 0;
  let out = String(edited == null ? '' : edited);
  out = out.replace(/\$\s?\d[\d,]*(?:\.\d+)?/g, (token) => {
    const orig = origMoney[moneyIndex++];
    if (!orig) return allowed.has(numberOf(token)) ? token : token;
    if (numberOf(token) === numberOf(orig)) return orig;
    if (allowed.has(numberOf(token))) return token;
    return orig;
  });
  out = out.replace(/\b\d+(?:\.\d+)?%/g, (token) => {
    const orig = origPct[pctIndex++];
    if (!orig) return token;
    if (numberOf(token) === numberOf(orig)) return orig;
    if (allowed.has(numberOf(token))) return token;
    return orig;
  });
  return out;
}

function editPrompt(kind, current, request, lock) {
  const label = kind === 'blind_ad' ? 'blind ad' : kind === 'flyer' ? 'one-page flyer HTML' : 'CBR HTML';
  return generationBody(
    MAX_TOKENS[kind],
    `You edit an existing ${label} for Peterson Acquisitions.
Apply ONLY the requested change. Every other character stays identical: wording, HTML, spacing, and numbers.
Do not invent financial figures. Do not change the locked Valuation SDE, asking price, SBA rate, DSCR, or cash-on-cash lines unless the request explicitly writes the new number.
Return the full document and nothing else.`,
    `${formatLockedBlock(lock)}

CURRENT DOCUMENT:
${current}

REQUESTED CHANGE:
${request}

Return the full document with only that change applied.`
  );
}

async function reviseDocument(deal, kind, request, complete, user) {
  const instruction = String(request || '').trim();
  if (instruction.length < 3) throw httpError(400, 'Describe the change you want.');
  assertKind(kind);
  const lock = requireConfirmed(deal);
  const current = readBody(deal.id, kind);
  if (!current.trim()) throw httpError(400, 'Generate the document before requesting an edit.');
  const message = await complete(editPrompt(kind, current, instruction, lock));
  let edited = documentFromMessage(message, 'Edit');
  edited = edited.replace(/^```(?:html|text)?\n?/i, '').replace(/\n?```$/, '').trim();
  edited = guardEdit(current, edited, instruction);
  if (kind !== 'cbr') edited = scrubUpside(edited);
  const lockedFigure = formatMoney(lock.valuation_sde);
  const supplied = explicitNumbers(instruction);
  const lockedNumber = String(Math.round(lock.valuation_sde));
  if (
    current.includes(lockedFigure)
    && !edited.includes(lockedFigure)
    && !supplied.has(lockedNumber)
    && !/sde|cash flow|valuation/i.test(instruction)
  ) {
    throw httpError(422, 'That edit dropped the locked Valuation SDE. Ask for a specific wording change, or include the new SDE figure explicitly.');
  }
  saveDocument(deal.id, kind, edited, 'edit', instruction.slice(0, 500));
  logEvent(deal.id, user, 'marketing_edited', `Edited the ${kind.replace('_', ' ')}`);
  return edited;
}

module.exports = {
  VERSION_LIMIT,
  COLUMNS,
  saveDocument,
  noteSavedBody,
  listVersions,
  restoreVersion,
  explicitNumbers,
  guardEdit,
  editPrompt,
  reviseDocument,
};
