/**
 * OTP — Offer To Purchase PDF Generator
 * POST /api/otp/generate  →  returns PDF binary (application/pdf)
 *
 * No AI, no async job pattern. Pure template → Puppeteer → PDF, ~3-5s.
 */

const express = require('express');
const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');

const router = express.Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(val) {
  const n = parseFloat(String(val).replace(/[^0-9.-]/g, ''));
  if (isNaN(n)) return '$0';
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function num(val) {
  const n = parseFloat(String(val || '0').replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? 0 : n;
}

function blank(val, placeholder) {
  const v = String(val || '').trim();
  return v || (placeholder ? `<span class="blank">${placeholder}</span>` : '<span class="blank">______________</span>');
}

function cb(val) {
  return val === 'true' || val === true
    ? '<span class="checkbox checked">☑</span>'
    : '<span class="checkbox">☐</span>';
}

// ─── Logo (base64 inline) ─────────────────────────────────────────────────────

function getLogoBase64() {
  const logoPath = path.join(__dirname, '..', '..', 'client', 'public', 'favicon.png');
  try {
    const data = fs.readFileSync(logoPath);
    return `data:image/png;base64,${data.toString('base64')}`;
  } catch {
    return null;
  }
}

// ─── HTML Template ────────────────────────────────────────────────────────────

function buildHtml(d) {
  const logo = getLogoBase64();

  // Auto-calculated fields
  const depInitial = num(d.depositInitial);
  const depAdditional = num(d.depositAdditional);
  const depBalance = num(d.depositBalance);
  const totalDown = depInitial + depAdditional + depBalance;

  const bankFin = num(d.bankFinancing);
  const sellerFin = num(d.sellerFinancing);
  const addlAmt = num(d.additionalTermsAmount);
  const totalPurchase = totalDown + bankFin + sellerFin + addlAmt;

  const buyerCity = d.buyerCity || '';
  const buyerState = d.buyerState || '';
  const buyerZip = d.buyerZip || '';
  const buyerCSZ = [buyerCity, buyerState, buyerZip].filter(Boolean).join(', ');

  const sellerCity = d.sellerCity || '';
  const sellerState = d.sellerState || '';
  const sellerZip = d.sellerZip || '';
  const sellerCSZ = [sellerCity, sellerState, sellerZip].filter(Boolean).join(', ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Times New Roman', Times, serif;
    font-size: 10.5pt;
    color: #000;
    background: #fff;
    line-height: 1.45;
  }

  .page {
    padding: 0.65in 0.75in 0.65in 0.75in;
    position: relative;
  }

  .page-break {
    page-break-before: always;
  }

  /* ── Header ── */
  .doc-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    border-bottom: 2.5px solid #1a3a6b;
    padding-bottom: 10px;
    margin-bottom: 14px;
  }

  .header-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .logo-img {
    width: 56px;
    height: 56px;
    object-fit: contain;
  }

  .logo-text-block .brand-top {
    font-family: Arial, Helvetica, sans-serif;
    font-weight: 900;
    font-size: 14pt;
    color: #1a3a6b;
    letter-spacing: 1.5px;
    text-transform: uppercase;
    line-height: 1.1;
  }

  .logo-text-block .brand-sub {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 7.5pt;
    color: #c1622f;
    letter-spacing: 2px;
    text-transform: uppercase;
    margin-top: 1px;
  }

  .header-right {
    text-align: right;
    font-size: 9pt;
    color: #444;
    padding-top: 4px;
  }

  .header-right .date-label {
    font-weight: bold;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    font-size: 8.5pt;
    color: #222;
  }

  .header-right .date-val {
    font-size: 10pt;
    margin-top: 2px;
    border-bottom: 1px solid #555;
    min-width: 120px;
    display: inline-block;
    text-align: center;
    padding: 0 4px;
  }

  .initials-box {
    margin-top: 6px;
    border: 1.5px solid #555;
    width: 48px;
    height: 28px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 10pt;
    font-weight: bold;
    margin-left: auto;
  }

  /* ── Doc title ── */
  .doc-title {
    text-align: center;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 14pt;
    font-weight: 900;
    color: #1a3a6b;
    text-transform: uppercase;
    letter-spacing: 2px;
    margin-bottom: 4px;
  }

  .doc-subtitle {
    text-align: center;
    font-size: 8.5pt;
    color: #555;
    letter-spacing: 1px;
    text-transform: uppercase;
    margin-bottom: 16px;
    font-style: italic;
  }

  /* ── Sections ── */
  .section {
    margin-bottom: 13px;
  }

  .section-title {
    font-family: Arial, Helvetica, sans-serif;
    font-weight: 700;
    font-size: 9pt;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: #1a3a6b;
    border-bottom: 1px solid #1a3a6b;
    padding-bottom: 2px;
    margin-bottom: 6px;
  }

  p {
    margin-bottom: 6px;
    text-align: justify;
  }

  /* ── Fill fields ── */
  .blank {
    display: inline-block;
    border-bottom: 1px solid #000;
    min-width: 90px;
    text-align: center;
    color: #000;
    padding: 0 3px;
  }

  .fill {
    font-weight: bold;
    color: #000;
    text-decoration: underline;
    text-decoration-color: #333;
    text-underline-offset: 2px;
  }

  /* ── Price table ── */
  .price-table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 6px;
    font-size: 10pt;
  }

  .price-table td {
    padding: 3px 6px 3px 0;
    vertical-align: top;
  }

  .price-table .label-col {
    width: 24px;
    font-weight: bold;
    color: #1a3a6b;
    padding-right: 6px;
    white-space: nowrap;
  }

  .price-table .desc-col {
    flex: 1;
    color: #333;
    font-size: 9.5pt;
  }

  .price-table .amt-col {
    width: 110px;
    text-align: right;
    font-weight: bold;
    white-space: nowrap;
  }

  .price-table tr.total-row td {
    border-top: 1px solid #000;
    font-weight: bold;
    padding-top: 4px;
  }

  .price-table tr.grand-total td {
    border-top: 2px solid #1a3a6b;
    color: #1a3a6b;
    font-size: 11pt;
  }

  /* ── Checkboxes ── */
  .checkbox {
    font-size: 12pt;
    line-height: 1;
    margin-right: 4px;
  }

  .checkbox.checked {
    color: #000;
  }

  .indent-para {
    padding-left: 18px;
    margin-bottom: 5px;
    text-align: justify;
  }

  /* ── Contingencies ── */
  .contingency {
    display: flex;
    gap: 6px;
    margin-bottom: 5px;
    align-items: flex-start;
    text-align: justify;
  }

  .contingency .cont-letter {
    font-weight: bold;
    color: #1a3a6b;
    min-width: 14px;
    flex-shrink: 0;
    padding-top: 1px;
    text-transform: lowercase;
  }

  .contingency .cont-body {
    flex: 1;
    font-size: 10pt;
  }

  /* ── Initials row ── */
  .initials-row {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    margin-bottom: 5px;
  }

  .initials-row .cont-letter {
    font-weight: bold;
    color: #1a3a6b;
    min-width: 14px;
    flex-shrink: 0;
    padding-top: 1px;
    text-transform: lowercase;
  }

  .initials-row .cont-body {
    flex: 1;
    font-size: 10pt;
    text-align: justify;
  }

  .initials-box-inline {
    width: 52px;
    flex-shrink: 0;
    text-align: center;
    font-size: 8pt;
    color: #555;
  }

  .initials-box-inline .box {
    border: 1px solid #555;
    height: 24px;
    width: 100%;
    margin-bottom: 2px;
  }

  /* ── Signature blocks ── */
  .sig-section {
    margin-top: 14px;
  }

  .sig-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px 24px;
    margin-top: 8px;
  }

  .sig-field {
    margin-bottom: 10px;
  }

  .sig-line {
    border-bottom: 1px solid #000;
    width: 100%;
    min-height: 22px;
    padding: 2px 4px;
    font-size: 10pt;
    display: block;
  }

  .sig-label {
    font-size: 8pt;
    color: #555;
    margin-top: 2px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  /* ── Acceptance separator ── */
  .acceptance-bar {
    border-top: 2px solid #1a3a6b;
    margin: 16px 0 10px 0;
    padding-top: 8px;
    text-align: center;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 9.5pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 2px;
    color: #1a3a6b;
  }

  /* ── Footer ── */
  .doc-footer {
    border-top: 1px solid #ccc;
    margin-top: 14px;
    padding-top: 5px;
    font-size: 7.5pt;
    color: #888;
    display: flex;
    justify-content: space-between;
  }

  /* ── Release page ── */
  .release-header {
    text-align: center;
    margin-bottom: 12px;
  }

  .release-title {
    font-family: Arial, Helvetica, sans-serif;
    font-weight: 900;
    font-size: 13pt;
    color: #1a3a6b;
    text-transform: uppercase;
    letter-spacing: 1.5px;
  }

  .highlight-box {
    background: #f5f7fa;
    border: 1px solid #c8d0dc;
    border-left: 4px solid #1a3a6b;
    padding: 8px 12px;
    margin: 8px 0;
    font-size: 9.5pt;
    text-align: justify;
  }

  .bold { font-weight: bold; }
  .italic { font-style: italic; }
  .underline { text-decoration: underline; }
  .center { text-align: center; }
  .small { font-size: 8.5pt; color: #555; }

  .spacer { height: 8px; }
  .spacer-sm { height: 4px; }

  @media print {
    .page-break { page-break-before: always; }
  }
</style>
</head>
<body>

<!-- ═══════════════════════════════════════════════════════════════════════════
     PAGE 1 — Header + Introduction + Purchase Price
     ═══════════════════════════════════════════════════════════════════════════ -->
<div class="page">

  <!-- Header -->
  <div class="doc-header">
    <div class="header-left">
      ${logo ? `<img class="logo-img" src="${logo}" alt="Peterson Acquisitions" />` : ''}
      <div class="logo-text-block">
        <div class="brand-top">Peterson Acquisitions</div>
        <div class="brand-sub">The Deal Team</div>
      </div>
    </div>
    <div class="header-right">
      <div class="date-label">Date of Agreement</div>
      <div class="date-val">${blank(d.date)}</div>
      <div style="margin-top:6px; font-size:8pt; color:#555;">Manager Initials</div>
      <div class="initials-box">${d.managerInitials || ''}</div>
    </div>
  </div>

  <!-- Title -->
  <div class="doc-title">Offer to Purchase Business Assets</div>
  <div class="doc-subtitle">Non-Binding Letter of Intent — Subject to Execution of Asset Purchase Agreement</div>

  <!-- Section 1: Introduction -->
  <div class="section">
    <div class="section-title">1. Introduction</div>
    <p>
      This Agreement is entered into by and between <span class="fill">${blank(d.buyerName, 'Buyer Name')}</span> ("Buyer") and the owners/operators of <span class="fill">${blank(d.businessName, 'Business Name')}</span> ("Seller"), and shall serve as the Buyer's offer to purchase the business assets of <span class="fill">${blank(d.businessName, 'Business Name')}</span>, located at <span class="fill">${blank(d.businessLocation, 'Business Location')}</span>.
    </p>
    <p>
      Peterson Acquisitions, LLC, an Arizona limited liability company d/b/a Peterson Acquisitions ("Broker") is acting as the agent for Buyer. The Buyer's designated Peterson Acquisitions advisor is <span class="fill">${blank(d.advisorName, 'Advisor Name')}</span>.
    </p>
    <p>
      Buyer's offer to purchase is made herein upon the following terms and conditions:
    </p>
  </div>

  <!-- Section 2: Purchase Price -->
  <div class="section">
    <div class="section-title">2. Purchase Price</div>
    <p>
      The total business purchase price is <span class="fill" style="font-size:11pt;">${d.purchasePrice ? fmt(d.purchasePrice) : '<span class="blank" style="min-width:120px;">______________</span>'}</span>.
    </p>
    <p style="margin-bottom:4px;">The purchase price is to be paid in the following manner:</p>

    <table class="price-table">
      <tr>
        <td class="label-col">a.</td>
        <td class="desc-col">Initial deposit accompanying this Offer to Purchase on <span class="fill">${blank(d.date)}</span></td>
        <td class="amt-col">${fmt(d.depositInitial)}</td>
      </tr>
      <tr>
        <td class="label-col">b.</td>
        <td class="desc-col">Additional deposit due upon Seller's acceptance of this Offer to Purchase</td>
        <td class="amt-col">${fmt(d.depositAdditional)}</td>
      </tr>
      <tr>
        <td class="label-col">c.</td>
        <td class="desc-col">Balance of down payment due at closing</td>
        <td class="amt-col">${fmt(d.depositBalance)}</td>
      </tr>
      <tr class="total-row">
        <td class="label-col">d.</td>
        <td class="desc-col bold">TOTAL DOWN PAYMENT (a + b + c)</td>
        <td class="amt-col">${fmt(totalDown)}</td>
      </tr>
      <tr>
        <td class="label-col">e.</td>
        <td class="desc-col">Bank/SBA financing (subject to lender approval)</td>
        <td class="amt-col">${fmt(d.bankFinancing)}</td>
      </tr>
      <tr>
        <td class="label-col">f.</td>
        <td class="desc-col">Seller financing (subject to terms to be negotiated)</td>
        <td class="amt-col">${fmt(d.sellerFinancing)}</td>
      </tr>
      <tr>
        <td class="label-col">g.</td>
        <td class="desc-col">${blank(d.additionalTermsDescription, 'Additional terms description')}</td>
        <td class="amt-col">${fmt(d.additionalTermsAmount)}</td>
      </tr>
      <tr class="grand-total">
        <td class="label-col"></td>
        <td class="desc-col bold">TOTAL PURCHASE PRICE (d + e + f + g)</td>
        <td class="amt-col">${fmt(totalPurchase)}</td>
      </tr>
    </table>
  </div>

  <!-- Section 3: Closing Date -->
  <div class="section">
    <div class="section-title">3. Closing Date</div>
    <p>
      <span class="fill">${blank(d.businessName, 'Business Name')}</span> shall be sold with closing to take place on or before 5:00 PM on <span class="fill">${blank(d.closingDate, 'Closing Date')}</span>, unless extended by mutual written agreement of the parties.
    </p>
  </div>

  <!-- Section 4: Inventory -->
  <div class="section">
    <div class="section-title">4. Inventory</div>
    <p>
      <span class="fill">${blank(d.businessName, 'Business Name')}</span> includes approximately <span class="fill">${d.inventoryAmount ? fmt(d.inventoryAmount) : '<span class="blank">______________</span>'}</span> in saleable inventory that is included in the purchase price above.
    </p>
    <p>
      ${cb(d.inventoryHasMinMax)} The above inventory is subject to a "floor" of <span class="fill">${d.inventoryMin ? fmt(d.inventoryMin) : '<span class="blank">__________</span>'}</span> and a "ceiling" of <span class="fill">${d.inventoryMax ? fmt(d.inventoryMax) : '<span class="blank">__________</span>'}</span>. If inventory exceeds the ceiling at closing, Buyer agrees to purchase the excess at cost. If inventory falls below the floor, Seller agrees to restock to the floor amount or reduce the purchase price by the deficiency amount.
    </p>
    <p>
      ${cb(d.inventoryPaidDirect)} Saleable inventory will be paid directly to Seller at closing, separate from the purchase price above.
    </p>
  </div>

  <div class="doc-footer">
    <span>Peterson Acquisitions — Offer to Purchase Business Assets</span>
    <span>Page 1 of 4</span>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════════════════════════
     PAGE 2 — Contingencies A–G
     ═══════════════════════════════════════════════════════════════════════════ -->
<div class="page page-break">

  <!-- Repeat compact header -->
  <div style="display:flex; align-items:center; gap:10px; border-bottom:1.5px solid #1a3a6b; padding-bottom:7px; margin-bottom:12px;">
    ${logo ? `<img style="width:32px;height:32px;object-fit:contain;" src="${logo}" alt="" />` : ''}
    <div style="font-family:Arial,sans-serif; font-weight:900; font-size:10.5pt; color:#1a3a6b; letter-spacing:1.5px; text-transform:uppercase;">Peterson Acquisitions — Offer to Purchase</div>
    <div style="margin-left:auto; font-size:8.5pt; color:#555;"><span class="fill">${blank(d.businessName)}</span></div>
  </div>

  <!-- Section 5: Contingencies -->
  <div class="section">
    <div class="section-title">5. Contingencies</div>
    <p>This offer is contingent upon the following:</p>

    <div class="spacer-sm"></div>

    <div class="contingency">
      <div class="cont-letter">a.</div>
      <div class="cont-body">
        This offer is contingent upon the Buyer's inspection and approval of the business's financial records, including but not limited to income tax returns, profit and loss statements, and balance sheets for the past three (3) years, as well as any other financial documentation reasonably requested by Buyer. Buyer shall have thirty (30) days from the date of Seller's acceptance to complete said review.
      </div>
    </div>

    <div class="contingency">
      <div class="cont-letter">b.</div>
      <div class="cont-body">
        This offer is contingent upon the Buyer's inspection and approval of all existing and prospective lease agreements, licenses, permits, and other contractual obligations associated with the business and/or its physical premises. Buyer must receive copies of all leases within five (5) business days of Seller's acceptance.
      </div>
    </div>

    <div class="contingency">
      <div class="cont-letter">c.</div>
      <div class="cont-body">
        This offer is contingent upon Buyer and Seller entering into a mutually satisfactory Asset Purchase Agreement (the "APA"), which shall supersede this Offer to Purchase in all material respects upon execution by both parties. The APA shall be drafted by Buyer's legal counsel and provided to Seller within fifteen (15) days of Seller's acceptance of this Offer.
      </div>
    </div>

    <div class="contingency">
      <div class="cont-letter">d.</div>
      <div class="cont-body">
        This offer is contingent upon Buyer's receipt and review of all pending and active contracts, customer lists, supplier agreements, and any other agreements that materially affect the ongoing operations or revenues of the business, to the Buyer's reasonable satisfaction.
      </div>
    </div>

    <div class="contingency">
      <div class="cont-letter">e.</div>
      <div class="cont-body">
        This offer is contingent upon Buyer's thorough inspection and satisfaction with all equipment, vehicles, machinery, fixtures, furniture, inventory, and all other tangible and intangible assets included in the sale. Seller shall provide a complete asset list within five (5) business days of acceptance.
      </div>
    </div>

    <div class="contingency">
      <div class="cont-letter">f.</div>
      <div class="cont-body">
        This offer is contingent upon Buyer's review and satisfaction with all existing and prospective employee agreements, compensation structures, benefit plans, and a general understanding of the employee composition and key personnel of the business. Seller shall provide a complete and anonymized employee roster and compensation summary within five (5) business days of acceptance.
      </div>
    </div>

    <div class="contingency">
      <div class="cont-letter">g.</div>
      <div class="cont-body">
        This offer is contingent upon <span class="fill">${blank(d.buyerName, 'Buyer Name')}</span> establishing an escrow/earnest money account with ATA National Title Group LLC, with a minimum earnest money deposit of <span class="fill">${d.ataMinimum ? fmt(d.ataMinimum) : '<span class="blank">__________</span>'}</span>, within three (3) business days of Seller's acceptance of this Offer.
      </div>
    </div>

    <div class="contingency">
      <div class="cont-letter">h.</div>
      <div class="cont-body">
        This offer is contingent upon the Buyer obtaining financing from a financial institution or lender with terms and conditions satisfactory to the Buyer in Buyer's sole discretion, including acceptable interest rate, loan amount, and repayment schedule. Buyer shall diligently pursue financing and provide Seller with a financing status update within twenty (20) days of Seller's acceptance.
      </div>
    </div>

    <div class="contingency">
      <div class="cont-letter">i.</div>
      <div class="cont-body">
        This offer is contingent upon Seller and Buyer entering into a non-compete and non-solicitation agreement satisfactory to Buyer, in form and substance to be included in or attached to the Asset Purchase Agreement, prohibiting Seller from competing with the business or soliciting its customers and employees for a period and geographic scope mutually agreed upon.
      </div>
    </div>

    <div class="contingency">
      <div class="cont-letter">j.</div>
      <div class="cont-body">
        This offer is contingent upon Seller providing a training and transition period satisfactory to Buyer. Seller agrees to remain available for a minimum training period to be specified in the Asset Purchase Agreement, at no additional cost to Buyer beyond the purchase price.
      </div>
    </div>

    <div class="contingency">
      <div class="cont-letter">k.</div>
      <div class="cont-body">
        ${d.contingencyK
          ? `<span>${d.contingencyK}</span>`
          : '<span class="blank" style="min-width:300px; display:inline-block;">&nbsp;</span>'}
      </div>
    </div>

    <div class="contingency">
      <div class="cont-letter">l.</div>
      <div class="cont-body">
        ${d.contingencyL
          ? `<span>${d.contingencyL}</span>`
          : '<span class="blank" style="min-width:300px; display:inline-block;">&nbsp;</span>'}
      </div>
    </div>

  </div>

  <div class="doc-footer">
    <span>Peterson Acquisitions — Offer to Purchase Business Assets</span>
    <span>Page 2 of 4</span>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════════════════════════
     PAGE 3 — Additional Terms + Expiration + Signatures
     ═══════════════════════════════════════════════════════════════════════════ -->
<div class="page page-break">

  <!-- Compact header -->
  <div style="display:flex; align-items:center; gap:10px; border-bottom:1.5px solid #1a3a6b; padding-bottom:7px; margin-bottom:12px;">
    ${logo ? `<img style="width:32px;height:32px;object-fit:contain;" src="${logo}" alt="" />` : ''}
    <div style="font-family:Arial,sans-serif; font-weight:900; font-size:10.5pt; color:#1a3a6b; letter-spacing:1.5px; text-transform:uppercase;">Peterson Acquisitions — Offer to Purchase</div>
    <div style="margin-left:auto; font-size:8.5pt; color:#555;"><span class="fill">${blank(d.businessName)}</span></div>
  </div>

  <!-- Section 6: Additional Terms -->
  <div class="section">
    <div class="section-title">6. Additional Terms & Conditions</div>

    <div class="contingency">
      <div class="cont-letter">m.</div>
      <div class="cont-body">
        <span class="bold">AS-IS Condition.</span> Except as otherwise specifically represented in writing by Seller or in the APA, all assets sold hereunder are sold in their "AS-IS, WHERE-IS" condition. Seller makes no warranty, express or implied, as to the condition, fitness, or suitability of the assets for any particular purpose. Buyer acknowledges that Buyer has had or will have adequate opportunity to inspect all assets prior to closing.
      </div>
    </div>

    <div class="contingency">
      <div class="cont-letter">n.</div>
      <div class="cont-body">
        <span class="bold">Confidentiality.</span> Buyer agrees to keep the terms of this Offer to Purchase, the existence of these negotiations, and all information provided by Seller strictly confidential and shall not disclose such information to any third party without Seller's prior written consent, except as necessary for Buyer's legal, financial, and professional advisors to evaluate this transaction.
      </div>
    </div>

    <div class="contingency">
      <div class="cont-letter">o.</div>
      <div class="cont-body">
        <span class="bold">Governing Law.</span> This Agreement shall be governed by and construed in accordance with the laws of the State of Arizona, without regard to conflict of law principles. Any dispute arising hereunder shall be resolved through binding arbitration in Maricopa County, Arizona, pursuant to the rules of the American Arbitration Association.
      </div>
    </div>

    <div class="contingency">
      <div class="cont-letter">p.</div>
      <div class="cont-body">
        <span class="bold">Entire Agreement.</span> This Offer to Purchase constitutes the entire understanding between the parties with respect to the subject matter hereof, and supersedes all prior negotiations, representations, or agreements. This Offer to Purchase is non-binding and is intended solely as a letter of intent to negotiate in good faith toward the execution of a formal Asset Purchase Agreement.
      </div>
    </div>

    <div class="contingency">
      <div class="cont-letter">q.</div>
      <div class="cont-body">
        <span class="bold">Time is of the Essence.</span> Time is of the essence with respect to all dates and deadlines set forth in this Offer to Purchase, including without limitation the expiration date, the due diligence period, and the closing date.
      </div>
    </div>
  </div>

  <!-- Section 7: Expiration -->
  <div class="section">
    <div class="section-title">7. Offer Expiration</div>
    <p>
      This Offer to Purchase shall expire and become null and void if not accepted, signed, and returned to Buyer by <span class="fill" style="font-size:11pt;">${blank(d.expirationDate, 'Expiration Date & Time')}</span>. In the event this Offer is not accepted within the time specified, all deposits shall be returned to Buyer in full and neither party shall have any further obligation hereunder.
    </p>
  </div>

  <!-- Section 8: Buyer Signatures -->
  <div class="section sig-section">
    <div class="section-title">8. Buyer's Acknowledgment & Signature</div>
    <p class="small italic" style="margin-bottom:8px;">
      By signing below, Buyer acknowledges having read, understood, and agreed to all terms and conditions set forth in this Offer to Purchase. Buyer further acknowledges that this Offer constitutes a good-faith expression of intent and is subject to the contingencies listed herein.
    </p>

    <div class="sig-grid">
      <div class="sig-field">
        <div class="sig-line">${d.buyerName || ''}</div>
        <div class="sig-label">Buyer's Printed Full Name</div>
      </div>
      <div class="sig-field">
        <div class="sig-line" style="min-height:22px;">&nbsp;</div>
        <div class="sig-label">Buyer's Signature</div>
      </div>
      <div class="sig-field">
        <div class="sig-line">${d.buyerAddress || ''}${buyerCSZ ? ', ' + buyerCSZ : ''}</div>
        <div class="sig-label">Buyer's Address</div>
      </div>
      <div class="sig-field">
        <div class="sig-line">${d.buyerPhone || ''}</div>
        <div class="sig-label">Buyer's Phone Number</div>
      </div>
      <div class="sig-field">
        <div class="sig-line">&nbsp;</div>
        <div class="sig-label">Date Signed</div>
      </div>
      <div class="sig-field">
        <div class="sig-line">${d.advisorName || ''}</div>
        <div class="sig-label">Peterson Acquisitions Advisor</div>
      </div>
    </div>
  </div>

  <!-- Acceptance Bar -->
  <div class="acceptance-bar">✦ Seller's Acceptance ✦</div>
  <p style="margin-bottom:8px; font-style:italic; font-size:9.5pt;">
    The undersigned Seller hereby accepts the above Offer to Purchase and agrees to sell the business assets of <span class="fill">${blank(d.businessName)}</span> to Buyer upon the terms and conditions set forth herein.
  </p>

  <!-- Section 9: Seller Signatures -->
  <div class="section sig-section">
    <div class="section-title">9. Seller's Acceptance & Signature</div>

    <div class="sig-grid">
      <div class="sig-field">
        <div class="sig-line">${d.sellerBusinessName || ''}</div>
        <div class="sig-label">Seller's Business / Entity Name</div>
      </div>
      <div class="sig-field">
        <div class="sig-line">${d.sellerName || ''}</div>
        <div class="sig-label">Seller's Printed Name (Authorized Signatory)</div>
      </div>
      <div class="sig-field">
        <div class="sig-line" style="min-height:22px;">&nbsp;</div>
        <div class="sig-label">Seller's Signature</div>
      </div>
      <div class="sig-field">
        <div class="sig-line">${d.sellerAddress || ''}${sellerCSZ ? ', ' + sellerCSZ : ''}</div>
        <div class="sig-label">Seller's Address</div>
      </div>
      <div class="sig-field">
        <div class="sig-line">&nbsp;</div>
        <div class="sig-label">Date Accepted</div>
      </div>
      <div class="sig-field">
        <div class="sig-line">&nbsp;</div>
        <div class="sig-label">Seller's Title / Role</div>
      </div>
    </div>
  </div>

  <div class="doc-footer">
    <span>Peterson Acquisitions — Offer to Purchase Business Assets</span>
    <span>Page 3 of 4</span>
  </div>
</div>

<!-- ═══════════════════════════════════════════════════════════════════════════
     PAGE 4 — Release of Liability & Broker Compensation Disclosure
     ═══════════════════════════════════════════════════════════════════════════ -->
<div class="page page-break">

  <!-- Compact header -->
  <div style="display:flex; align-items:center; gap:10px; border-bottom:1.5px solid #1a3a6b; padding-bottom:7px; margin-bottom:12px;">
    ${logo ? `<img style="width:32px;height:32px;object-fit:contain;" src="${logo}" alt="" />` : ''}
    <div style="font-family:Arial,sans-serif; font-weight:900; font-size:10.5pt; color:#1a3a6b; letter-spacing:1.5px; text-transform:uppercase;">Peterson Acquisitions — Offer to Purchase</div>
    <div style="margin-left:auto; font-size:8.5pt; color:#555;"><span class="fill">${blank(d.businessName)}</span></div>
  </div>

  <!-- Release of Liability -->
  <div class="release-header">
    <div class="release-title">Release of Liability</div>
    <div style="font-size:9pt; color:#555; margin-top:3px; font-style:italic;">Peterson Acquisitions, LLC — Buyer's Acknowledgment</div>
  </div>

  <div class="highlight-box">
    <span class="bold">IMPORTANT NOTICE:</span> Please read the following carefully before signing. By signing this Offer to Purchase, Buyer acknowledges and agrees to the terms set forth in this Release of Liability.
  </div>

  <div class="section">
    <p>
      Buyer acknowledges that Buyer was advised by <span class="fill">${blank(d.releaseAdvisedBy, 'Advisor Name')}</span> of Peterson Acquisitions, LLC, an Arizona limited liability company d/b/a Peterson Acquisitions ("Broker"), and that <span class="bold">Broker is acting solely as the agent of Buyer</span> in connection with the transaction contemplated by this Offer to Purchase, and is <span class="underline bold">not</span> acting as the agent or representative of Seller.
    </p>
    <div class="spacer-sm"></div>
    <p>
      Buyer acknowledges, understands, and agrees that Broker (<span class="fill">${blank(d.releaseBroker || d.businessName, 'Broker/Business Name')}</span>) has made no representations or warranties of any kind, express or implied, regarding the accuracy or completeness of any financial information, projections, or other data provided by Seller or its representatives. Buyer is relying solely on Buyer's own investigation, due diligence, and the representations of Seller in connection with this transaction.
    </p>
    <div class="spacer-sm"></div>
    <p>
      Buyer hereby releases, acquits, and forever discharges Peterson Acquisitions, LLC, its members, managers, officers, employees, agents, and successors (collectively, "Released Parties") from any and all claims, demands, causes of action, suits, liabilities, and expenses of any kind or nature whatsoever arising out of or in connection with: (i) the information provided by Seller or Seller's representatives; (ii) the accuracy, completeness, or reliability of any financial statements, projections, or other representations made by Seller; (iii) the condition of the business assets; or (iv) any other matter related to the subject business, except to the extent that any such claim arises from the gross negligence or willful misconduct of the Released Parties.
    </p>
    <div class="spacer-sm"></div>
    <p>
      Buyer further acknowledges that Buyer has had the opportunity to consult with independent legal, financial, and tax advisors regarding this transaction, and has done so to the extent Buyer deems necessary or appropriate. Buyer accepts full and sole responsibility for all investment decisions made in connection with this Offer to Purchase and any subsequent Asset Purchase Agreement.
    </p>
  </div>

  <!-- Broker Compensation Disclosure -->
  <div class="section">
    <div class="section-title">Broker Compensation Disclosure</div>
    <p>
      Buyer acknowledges and understands that Peterson Acquisitions, LLC ("Broker") will receive a commission or referral fee in connection with this transaction, typically paid by Seller at closing. The specific commission arrangement has been disclosed to Buyer separately. Buyer's obligation to pay any fees to Broker shall be governed by a separate Buyer Representation Agreement, if any, executed between Buyer and Broker.
    </p>
    <div class="spacer-sm"></div>
    <p>
      Buyer understands that the existence of a commission arrangement between Broker and Seller does not alter Broker's fiduciary duty to Buyer as Buyer's agent in this transaction.
    </p>
  </div>

  <!-- Arizona Real Estate Disclosure -->
  <div class="section">
    <div class="section-title">State Disclosure</div>
    <p class="small">
      Peterson Acquisitions, LLC is a licensed Arizona business brokerage. This transaction involves the sale of business assets, not real property. To the extent real property is included in this transaction, a separate real estate addendum will be required. Buyer should seek independent legal counsel regarding any real property included in the sale.
    </p>
  </div>

  <!-- Signatures on Release -->
  <div class="section sig-section">
    <div class="section-title">Buyer's Acknowledgment of Release</div>
    <p class="small italic" style="margin-bottom:8px;">
      By signing below, Buyer acknowledges having read, understood, and agreed to the Release of Liability and Broker Compensation Disclosure set forth on this page.
    </p>

    <div class="sig-grid">
      <div class="sig-field">
        <div class="sig-line">${d.buyerName || ''}</div>
        <div class="sig-label">Buyer's Printed Full Name</div>
      </div>
      <div class="sig-field">
        <div class="sig-line" style="min-height:22px;">&nbsp;</div>
        <div class="sig-label">Buyer's Signature</div>
      </div>
      <div class="sig-field">
        <div class="sig-line">&nbsp;</div>
        <div class="sig-label">Date Signed</div>
      </div>
      <div class="sig-field">
        <div class="sig-line">${d.advisorName || ''}</div>
        <div class="sig-label">Peterson Acquisitions Advisor Signature</div>
      </div>
    </div>
  </div>

  <!-- Final footer -->
  <div class="doc-footer">
    <span>Peterson Acquisitions, LLC — Confidential — For Transaction Purposes Only</span>
    <span>Page 4 of 4</span>
  </div>
  <div style="text-align:center; margin-top:6px; font-size:7pt; color:#aaa;">
    This document was generated by the Dealmaker Portal · Peterson Acquisitions · thedealteam.co
  </div>

</div>
</body>
</html>`;
}

// ─── Route ────────────────────────────────────────────────────────────────────

router.post('/generate', async (req, res) => {
  try {
    const data = req.body;

    // Validate required fields
    if (!data.businessName || !data.buyerName) {
      return res.status(400).json({ error: 'businessName and buyerName are required.' });
    }

    const html = buildHtml(data);

    // Launch Puppeteer
    const browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: { top: '0px', right: '0px', bottom: '0px', left: '0px' },
      displayHeaderFooter: false,
    });

    await browser.close();

    // Build a safe filename
    const safeName = (data.businessName || 'Business')
      .replace(/[^a-zA-Z0-9 _-]/g, '')
      .trim()
      .replace(/\s+/g, '_')
      .slice(0, 40);
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `OTP_${safeName}_${dateStr}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    res.end(pdfBuffer);

  } catch (err) {
    console.error('[OTP] PDF generation error:', err.message);
    res.status(500).json({ error: 'PDF generation failed. ' + err.message });
  }
});

module.exports = router;
