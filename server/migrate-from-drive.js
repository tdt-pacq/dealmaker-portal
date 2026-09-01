#!/usr/bin/env node
/**
 * One-time migration: imports deals from the legacy Google Drive JSON
 * into the SQLite database used by the new portal.
 *
 * Usage:
 *   node server/migrate-from-drive.js <path-to-decoded-deals.json>
 *
 * The input file should be the base64-decoded content of the PACQ Deals/deals.json
 * from Google Drive (a JSON array of deal objects).
 *
 * Run from the dealmaker-portal root directory.
 */

const fs   = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { getDb } = require('./database');

const inputPath = process.argv[2];
if (!inputPath) {
  console.error('Usage: node server/migrate-from-drive.js <deals.json>');
  process.exit(1);
}

const deals = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
const db = getDb();

const insert = db.prepare(`
  INSERT OR IGNORE INTO deals
    (id, deal_name, status, advisor_name, interview_data, blind_ad_text, flyer_html, cbr_html, created_at, updated_at)
  VALUES
    (@id, @deal_name, @status, @advisor_name, @interview_data, @blind_ad_text, @flyer_html, @cbr_html, @created_at, @updated_at)
`);

const logEvent = db.prepare(`
  INSERT INTO deal_events (id, deal_id, user_id, user_display_name, event_type, description, created_at)
  VALUES (@id, @deal_id, @user_id, @user_display_name, @event_type, @description, @created_at)
`);

let imported = 0;
let skipped  = 0;

for (const d of deals) {
  const fz  = d.flyerZones  || {};
  const cs  = d.cimSections || {};
  const raw = d.rawOutputs  || {};

  // Map legacy flyerZones to new portal interview fields where a clear mapping exists
  const interviewData = {
    // ── Business basics ──────────────────────────────────────────────
    business_legal_name:  d.name,
    business_website:     d.website || '',
    year_founded:         fz.BUSINESS_STARTED || '',
    business_city_state:  (fz.SUBHEAD_INDUSTRY || '').split('|').pop().trim(),
    hours_of_operation:   fz.HOURS_OF_OPERATION || '',
    employees_count:      fz.EMPLOYEES || '',
    business_description: fz.OVERVIEW_PARAGRAPH || '',

    // ── Financials ────────────────────────────────────────────────────
    asking_price:         (d.price || '').replace(/[^0-9.]/g, ''),
    revenue_year1:        (fz.PRICE_BOX_REVENUE_VALUE || '').replace(/[^0-9.]/g, ''),
    revenue_year1_label:  (fz.PRICE_BOX_REVENUE_LABEL || '').replace('Sales:', '').trim() || '2025',
    sde_year1:            (fz.PRICE_BOX_CASHFLOW_VALUE || '').replace(/[^0-9.]/g, ''),
    sde_year1_label:      '2025',
    ffe_value:            (fz.PRICE_BOX_FFE_VALUE || '').replace(/[^0-9.]/g, ''),
    financing_type:       fz['KEY_FEATURE_6_VALUE'] || 'SBA Eligible',
    down_payment_required: '',
    sba_preapproved:      'yes',

    // ── Preserved customized flyer content ────────────────────────────
    // Stored verbatim so AI can use these when regenerating
    _legacy_flyer_headline1:  fz.HEADLINE_LINE_1  || '',
    _legacy_flyer_headline2:  fz.HEADLINE_LINE_2  || '',
    _legacy_flyer_headline3:  fz.HEADLINE_LINE_3  || '',
    _legacy_flyer_subhead:    fz.SUBHEAD_INDUSTRY || '',
    _legacy_flyer_descriptor: fz.SUBHEAD_DESCRIPTOR || '',
    _legacy_flyer_overview:   fz.OVERVIEW_PARAGRAPH || '',
    _legacy_key_features:     [1,2,3,4,5,6].map(n => ({
      label: fz[`KEY_FEATURE_${n}_LABEL`] || '',
      value: fz[`KEY_FEATURE_${n}_VALUE`] || '',
    })).filter(f => f.label),
    _legacy_analysis_points:  [1,2,3,4,5].map(n => ({
      label: cs[`ANALYSIS_POINT_${n}_LABEL`] || fz[`ANALYSIS_POINT_${n}_LABEL`] || '',
      body:  cs[`ANALYSIS_POINT_${n}_BODY`]  || fz[`ANALYSIS_POINT_${n}_BODY`]  || '',
    })).filter(p => p.label),
    _legacy_cim_tagline:      cs.COVER_TAGLINE    || '',
    _legacy_cim_exec_overview: cs.EXEC_OVERVIEW   || '',
    _legacy_primary_color:    d.primaryColor      || '',
    _legacy_accent_color:     d.accentColor       || '',
    _legacy_drive_id:         d.id,               // original legacy ID
  };

  // blind_ad_text: the raw text the legacy app generated (preserved as-is)
  const blindAdText = raw.blindAd || '';

  // flyer_html / cbr_html: legacy app stored zone text, not full HTML.
  // These need regeneration in the new portal; we leave them null
  // so the portal shows "Generate" buttons rather than broken output.
  const flyerHtml = null;
  const cbrHtml   = null;

  const now = new Date().toISOString();

  const row = {
    id:             randomUUID(),
    deal_name:      d.name,
    status:         d.status || 'active',
    advisor_name:   d.advisorName || '',
    interview_data: JSON.stringify(interviewData),
    blind_ad_text:  blindAdText,
    flyer_html:     flyerHtml,
    cbr_html:       cbrHtml,
    created_at:     d.createdAt || now,
    updated_at:     d.updatedAt || now,
  };

  const result = insert.run(row);
  if (result.changes === 0) {
    console.log(`  SKIP (already exists or duplicate name): ${d.name}`);
    skipped++;
    continue;
  }

  // Log the import as a deal event
  logEvent.run({
    id:               randomUUID(),
    deal_id:          row.id,
    user_id:          null,
    user_display_name: 'Migration',
    event_type:       'deal_created',
    description:      `Imported from legacy Google Drive system (original ID: ${d.id}, created by ${d.createdBy || 'unknown'})`,
    created_at:       d.createdAt || now,
  });

  console.log(`  OK: ${d.name}  →  ${row.id}`);
  imported++;
}

console.log(`\nDone. Imported: ${imported}  Skipped: ${skipped}`);
