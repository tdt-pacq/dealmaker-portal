const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// In production set DB_PATH=/data/pacq_deals.db and mount a Railway persistent volume at /data.
// Falls back to server/pacq_deals.db for local dev.
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'pacq_deals.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    initSchema();
  }
  return db;
}

function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS deals (
      id TEXT PRIMARY KEY,
      deal_name TEXT NOT NULL,
      status TEXT DEFAULT 'draft',
      created_at TEXT,
      updated_at TEXT,
      advisor_name TEXT,
      interview_data TEXT,
      blind_ad_text TEXT,
      flyer_html TEXT,
      cbr_html TEXT,
      listing_platform_notes TEXT
    )
  `);
}

function seedTestDeal() {
  const existing = getDb().prepare('SELECT id FROM deals WHERE deal_name = ?').get('Nursery - NC - 2025');
  if (existing) return;

  const testDeal = {
    id: uuidv4(),
    deal_name: 'Nursery - NC - 2025',
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    advisor_name: 'Alisha',
    interview_data: JSON.stringify({
      // Section 1: Executive Summary
      business_legal_name: 'Piedmont Carolina Nursery & Landscaping LLC',
      year_founded: '2003',
      year_owner_took_over: '2003',
      business_website: 'www.piedmontcarolinanursery.com',
      business_city_state: 'Piedmont, NC',
      hours_of_operation: 'Mon-Sat 7am-6pm, Sun 9am-4pm (seasonal)',
      origin_story: 'Founded in 2003 by a horticulture graduate who saw an opportunity to serve the growing residential and commercial landscaping market in the Piedmont region of North Carolina.',
      typical_day: 'Owner arrives at 6:30am, reviews orders and crew assignments, meets with commercial clients, handles vendor relationships, reviews financials weekly.',
      owner_skills: 'Horticulture degree, 20+ years industry experience, strong vendor relationships, deep community ties.',
      primary_roles: 'Client relations, vendor management, team leadership, financial oversight.',
      owner_absent: 'Assistant manager handles day-to-day operations. 3 lead horticulturists manage crews. Business runs smoothly for 2-week periods.',
      vision_mission: 'To be the premier nursery and landscaping provider in the Piedmont region, delivering exceptional quality and service.',
      core_values: 'Quality, integrity, community, sustainability.',
      reason_for_selling: 'Retirement planning — owner is 62 and looking to transition in the next 12-18 months.',
      top_5_growth: '1. Add irrigation installation services\n2. Expand commercial contracts\n3. Launch online retail store\n4. Add landscape design services\n5. Expand to second location',
      owner_optimistic: 'Strong housing market, growing demand for outdoor living spaces, loyal customer base.',
      owner_concerns: 'Seasonal labor availability, supply chain for specialty plants.',
      advice_for_buyer: 'Build relationships with the key employees — they are the backbone of the business.',
      warning_for_buyer: 'Seasonal cash flow requires working capital reserves.',
      business_description: 'Full-service nursery and landscaping company serving residential and commercial clients in the Piedmont region of NC. Offers plant sales, landscape design, installation, and maintenance.',
      owner_compensation_method: 'S-Corp distribution plus W-2 salary ($85,000)',
      key_systems: 'QuickBooks Online, JobBer for scheduling, proprietary inventory tracking, documented SOPs for all crew operations.',
      entity_type: 'S-Corporation',
      licenses_held: 'NC Contractor License, NC Pesticide License, Business License',
      intellectual_property: 'Trademarked business name, proprietary planting guides.',
      litigation_status: 'None',
      industry_highlights: 'The U.S. nursery and landscaping industry generates $105B+ annually. Residential landscaping spending increased 23% post-COVID.',
      industry_trends: 'Growing demand for native plants, outdoor living spaces, sustainable landscaping practices.',
      industry_challenges: 'Seasonal labor shortages, weather dependency, supply chain for specialty plants.',
      industry_opportunities: 'Irrigation services, landscape lighting, outdoor entertainment spaces.',
      profit_drivers: 'High-margin installation projects, recurring maintenance contracts, retail plant sales.',
      regulatory_factors: 'Pesticide licensing requirements, water usage regulations.',
      employees_count: '12 Full-time, 8 Part-time (seasonal)',
      revenue_year1_label: '2024',
      revenue_year1: '2850000',
      sde_year1: '485000',
      ebitda_year1: '420000',
      asking_price: '1750000',
      real_estate_situation: 'Owned — 3.2 acres with greenhouse, retail space, and storage. Available for separate purchase.',
      real_estate_value: '850000',
      ffe_value: '320000',
      inventory_value: '175000',
      sba_preapproved: 'Yes',
      financing_available: 'SBA 7(a) pre-qualified. Seller willing to carry 10% note.',
      down_payment_required: '10% ($175,000)',
      // Section 2: Products & Services
      core_products: 'Landscape installation, landscape maintenance contracts, retail plant nursery, hardscape design and installation, seasonal color programs.',
      pricing_strategy: 'Competitive market rates for retail; value-based pricing for commercial contracts; tiered maintenance packages.',
      delivery_process: 'Crew-based delivery and installation. 6 crews of 2-3 technicians. Scheduling via Jobber.',
      unique_offerings: '20+ years of deep vendor relationships allowing access to rare and specialty plants. The only nursery in the region with a climate-controlled greenhouse for year-round availability.',
      product_diversification: 'Revenue split: 40% installation, 30% maintenance, 20% retail nursery, 10% hardscape.',
      supplier_diversification: 'Sources from 15+ wholesale nurseries across NC, SC, and VA. No single supplier >20% of inventory.',
      products_in_development: 'Irrigation installation service line under development for 2025 launch.',
      future_product_potential: 'Landscape lighting, outdoor kitchen installation, indoor plant subscription service.',
      // Section 3: Marketing
      branding_strategy: 'Local brand built on word-of-mouth referrals and community presence. Active in local garden clubs and HOA relationships.',
      social_reputation: '4.8 stars on Google (312 reviews), 4.7 on Yelp (98 reviews). Strong Facebook community following (2,800+).',
      marketing_channels: 'Google Ads, Facebook/Instagram, Nextdoor, direct mail for seasonal promotions, HOA partnerships.',
      marketing_roi_metrics: 'Cost per lead tracked via Google Ads. Job close rate tracked per sales rep.',
      marketing_strengths: 'Strong organic reputation, loyal referral base, seasonal promotion expertise.',
      marketing_weaknesses: 'Limited paid digital budget. No dedicated marketing staff.',
      market_positioning: 'Premium local provider vs. national chains — positioned on quality, expertise, and local relationships.',
      why_customers_choose: 'Quality of plant material, knowledgeable staff, reliable service, strong warranty on installations.',
      // Section 4: Sales
      sales_process: 'Inbound leads from web/referrals → phone consultation → site visit → estimate → proposal → close. Average sales cycle 5-10 days for residential.',
      sales_trends: 'YoY growth 8-12% for past 5 years. Commercial division growing faster at 18% YoY.',
      sales_channels: 'Direct (walk-in, phone, web), referral program, commercial sales rep.',
      sales_responsible: 'Owner handles commercial accounts. 1 dedicated inside sales coordinator handles residential.',
      sales_superstars: 'Maria (commercial accounts) — responsible for 35% of commercial revenue.',
      sales_growth_opportunities: 'Add 1-2 commercial sales reps, launch referral incentive program, expand service radius.',
      seasonality: 'Peak: March-June and September-October. Slower: July-August (heat) and December-February.',
      mrr: 'Maintenance contracts generate approximately $65,000/month in recurring revenue.',
      // Section 5: Customers
      total_customers: 'Approximately 850 active customer accounts',
      repeat_customer_pct: '68% of revenue from repeat/contract customers',
      customer_satisfaction: 'Annual satisfaction surveys, Google review monitoring, proactive follow-up on all installs.',
      customer_service_strengths: 'Personal relationships, owner accessibility, strong warranty honoring.',
      customer_service_improvements: 'Customer portal for project tracking, automated scheduling reminders.',
      avg_revenue_per_customer: '$3,350/year average across all active accounts',
      customer_segmentation: '55% residential homeowners, 30% commercial properties/HOAs, 15% municipal/institutional',
      customer_geography: '85% within 25-mile radius of main location',
      customer_database_size: '850 active, 2,400+ historical customers in CRM',
      // Section 6: Employees
      employee_detail: '12 FT, 8 PT seasonal (April-October)',
      org_structure: 'Owner → Assistant Manager → 3 Crew Leaders (2-3 crew members each) + 2 retail staff + 1 sales coordinator + 1 admin',
      key_employees: 'Tom (Asst. Manager, 9 years) — oversees daily operations\nMaria (Sales Coordinator, 6 years) — commercial accounts\nJose (Lead Horticulturist, 11 years) — oversees plant quality',
      employee_challenges: 'Seasonal retention of skilled crew members. Bilingual communication (50% Spanish-speaking crew).',
      compliance_issues: 'E-Verify compliant. All pesticide applicators licensed.',
      hiring_challenges: 'Experienced horticulturists are scarce. Partner with local community college for pipeline.',
      hr_systems: 'Gusto for payroll/HR. Jobber for time tracking.',
      benefits: 'Health insurance (FT only), paid time off, annual bonus, tool allowance.',
      compensation_approach: 'Competitive hourly rates + performance bonuses for crew leaders and sales staff.',
      post_sale_transitions: 'Tom (Asst. Manager) confirmed staying. Maria confirmed staying. Owner will stay 6-12 months for transition.',
      // Section 7: Financials
      fin_year1_label: '2024', fin_year1_revenue: '2850000', fin_year1_cogs: '1425000',
      fin_year1_gross_profit: '1425000', fin_year1_operating_exp: '940000',
      fin_year1_net_income: '485000', fin_year1_depreciation: '45000',
      fin_year1_amortization: '0', fin_year1_interest: '28000',
      fin_year1_ebitda: '558000', fin_year1_owner_salary: '85000',
      fin_year1_other_addbacks: 'Personal vehicle: $12,000 / Personal phone/utilities: $8,400 / One-time legal: $15,000',
      fin_year1_sde: '678400',
      fin_year2_label: '2023', fin_year2_revenue: '2640000', fin_year2_cogs: '1320000',
      fin_year2_gross_profit: '1320000', fin_year2_operating_exp: '895000',
      fin_year2_net_income: '425000', fin_year2_depreciation: '42000',
      fin_year2_amortization: '0', fin_year2_interest: '31000',
      fin_year2_ebitda: '498000', fin_year2_owner_salary: '85000',
      fin_year2_other_addbacks: 'Personal vehicle: $12,000 / Personal phone/utilities: $8,400',
      fin_year2_sde: '603400',
      fin_year3_label: '2022', fin_year3_revenue: '2380000', fin_year3_cogs: '1190000',
      fin_year3_gross_profit: '1190000', fin_year3_operating_exp: '862000',
      fin_year3_net_income: '328000', fin_year3_depreciation: '38000',
      fin_year3_amortization: '0', fin_year3_interest: '34000',
      fin_year3_ebitda: '400000', fin_year3_owner_salary: '80000',
      fin_year3_other_addbacks: 'Personal vehicle: $12,000 / Personal phone/utilities: $8,400',
      fin_year3_sde: '508400',
      fiscal_year_end: 'December 31',
      financial_record_system: 'QuickBooks Online, reviewed annually by CPA (Morris & Associates, Greensboro NC)',
      accuracy_rating: '9',
      records_current: 'Yes',
      asset_list_available: 'Yes',
      assets_not_conveyed: 'Owner\'s personal vehicle. Personal tools not used in business.',
      cash_flow_status: 'Strong positive cash flow. Maintenance contract revenue provides consistent monthly base.',
      cash_flow_decline: 'N/A — no decline',
      industry_benchmarks: 'Revenue per employee (~$142K) is above industry average of $115K. Gross margin (50%) at top of industry range.',
      five_year_projections: 'Yes — available upon NDA',
      rev_segment1_name: 'Landscape Installation', rev_segment1_pct: '40',
      rev_segment2_name: 'Maintenance Contracts', rev_segment2_pct: '30',
      rev_segment3_name: 'Retail Nursery', rev_segment3_pct: '20',
      rev_segment4_name: 'Hardscape', rev_segment4_pct: '10',
      ffe_description: 'Fleet of 4 trucks, 2 trailers, riding mowers, commercial equipment, greenhouse equipment.',
      ffe_appraised: '320000',
      land_value: '850000',
      inventory_appraised: '175000',
      total_appraised_assets: '1345000',
      // Section 8: Growth Opportunities
      growth_opportunities: '1. Launch irrigation installation division — equipment purchased, licensing in progress\n2. Expand commercial HOA contracts — only 12% market penetration in target counties\n3. Online plant retail store — ship rare/specialty plants regionally\n4. Landscape lighting as add-on to every install project\n5. Second location 20 miles north — strong demographic match\n6. Outdoor kitchen/hardscape design-build expansion\n7. Corporate grounds maintenance contracts in Research Triangle\n8. Greenhouse wholesale to other garden centers',
      // Section 9: Transaction Details
      listing_price: '1750000',
      deal_structure: 'Asset purchase. Real estate available separately at $850,000 or seller will lease at $5,500/month.',
      financing_type: 'SBA 7(a) pre-qualified. Seller carry available (10%). Conventional financing possible.',
      down_payment_pct: '10% SBA / 20-25% conventional',
      transition_plan: 'Seller will remain for 12 months as paid consultant. Full training included. Key employees committed to stay.',
      buyer_process_notes: 'Preferred buyer: owner-operator with management background. Industry experience preferred but not required.',
      // Section 10: Deal Team
      deal_team_members: ['Michael', 'Robin', 'Alisha', 'Lee', 'Lance'],
      seller_brand_color: '#2D5016'
    }),
    blind_ad_text: null,
    flyer_html: null,
    cbr_html: null,
    listing_platform_notes: 'BizBuySell, BusinessBroker.net, LoopNet (commercial properties)'
  };

  getDb().prepare(`
    INSERT INTO deals (id, deal_name, status, created_at, updated_at, advisor_name, interview_data,
      blind_ad_text, flyer_html, cbr_html, listing_platform_notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    testDeal.id, testDeal.deal_name, testDeal.status,
    testDeal.created_at, testDeal.updated_at, testDeal.advisor_name,
    testDeal.interview_data, testDeal.blind_ad_text, testDeal.flyer_html,
    testDeal.cbr_html, testDeal.listing_platform_notes
  );

  console.log(`Seeded test deal: ${testDeal.deal_name} (${testDeal.id})`);
}

module.exports = { getDb, seedTestDeal };
