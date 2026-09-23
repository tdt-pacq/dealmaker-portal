/**
 * 2027 Annual Success Plan seed, transcribed from the workbook
 * (Roster, person tabs, and 5-Year Plan). Numbers are the sheet values.
 * The dashboard KPI cell C6 ($3.5M) is a stale typed figure; the live
 * SUM of personal income targets is $5.6M and is what the app rolls up.
 *
 * Idempotent: skips when any person row already exists, so later edits stick.
 */

const { getDb } = require('./database');

const PLAN_YEAR = 2027;

const COMPANY_2027 = {
  year: PLAN_YEAR,
  vision: 'To become the #1 SBA acquisition deal team in the country.',
  mission: 'To create wealth, time, and freedom for clients and ourselves through world-class acquisition and advisory services.',
  deal_values: 'D – Dominate with Discipline · E – Execute Relentlessly · A – Align with Purpose · L – Lead with Honor',
  wtf_number: '',
};

const FIVE_YEAR_GOALS = [2027, 2028, 2029, 2030, 2031];

const PEOPLE = [
  {
    id: 'chad', name: 'Chad Peterson', role: 'Founder & CEO', sort_order: 1,
    commission_split: 0, personal_income_target: null, avg_deal_size: null,
    commission_rate: 0.1, close_ratio: 0.2,
  },
  {
    id: 'michael', name: 'Michael Moore', role: 'President & CGO', sort_order: 2,
    commission_split: 0, personal_income_target: null, avg_deal_size: null,
    commission_rate: 0.1, close_ratio: 0.2,
  },
  {
    id: 'lance', name: 'Lance Hines', role: 'COO', sort_order: 3,
    commission_split: 0, personal_income_target: null, avg_deal_size: null,
    commission_rate: 0.1, close_ratio: 0.2,
  },
  {
    id: 'lee', name: 'Lee Levinson', role: 'Chief Compliance & Underwriting Officer', sort_order: 4,
    commission_split: 0, personal_income_target: null, avg_deal_size: null,
    commission_rate: 0.1, close_ratio: 0.2,
  },
  {
    id: 'tim', name: 'Tim Moses', role: 'Broker', sort_order: 5,
    commission_split: 0.5, personal_income_target: 300000, avg_deal_size: 1500000,
    commission_rate: 0.1, close_ratio: 0.8,
    dealmaker_edge: 'Getting engagements',
    notes: 'People/support: Support behind the training. Tools/training: Lightspeed. Time: 10 hrs/wk.',
    priorities: ['Lead generation', 'Broker training', "SOP's - for Tim"],
  },
  {
    id: 'david', name: 'David P.', role: 'Broker', sort_order: 6,
    commission_split: 0.5, personal_income_target: 1000000, avg_deal_size: 2000000,
    commission_rate: 0.1, close_ratio: 0.8,
    dealmaker_edge: 'Responsive; getting new business',
    stop_delegate: 'Cash flow analysis (answering questions)',
    notes: 'Tools/training: Cash flow analysis. Time: 40 hrs/wk.',
    priorities: ['Lead generation'],
  },
  {
    id: 'jamie', name: 'Jamie', role: 'Broker', sort_order: 7,
    commission_split: 0.5, personal_income_target: 1000000, avg_deal_size: 3000000,
    commission_rate: 0.1, close_ratio: 0.8,
    dealmaker_edge: 'Deal structure and negotiations',
    stop_delegate: 'Admin tasks - CBR, MPA, buyer qualification',
    notes: 'People/support: Shared assistant - gathering docs, NYPT, buyer qualification. Time: 40 hrs/wk.',
    priorities: ['Lead generation', 'CRM management'],
  },
  {
    id: 'ethan', name: 'Ethan', role: 'Broker', sort_order: 8,
    commission_split: 0.5, personal_income_target: 300000, avg_deal_size: 1000000,
    commission_rate: 0.1, close_ratio: 0.8,
    dealmaker_edge: 'Buyer/seller calls; due diligence',
    stop_delegate: "Could use structure on front end of getting EA's",
    notes: 'People/support: Currently paying buyer rep.',
    priorities: ['Closing current deals', "Getting new EA's"],
  },
  {
    id: 'jim', name: 'Jim', role: 'Broker', sort_order: 9,
    commission_split: 0.5, personal_income_target: 300000, avg_deal_size: 1100000,
    commission_rate: 0.1, close_ratio: 0.8,
    dealmaker_edge: 'Seller qualification, Sales side working with buyers',
    stop_delegate: 'Technology, streamlining workflow',
    notes: 'People/support: Banker/lender fit, deal support. Time: 30 hrs/wk.',
    priorities: ['Lead generation', 'Technology & workflow'],
  },
  {
    id: 'fred', name: 'Fred', role: 'Broker', sort_order: 10,
    commission_split: 0.5, personal_income_target: 600000, avg_deal_size: 1800000,
    commission_rate: 0.1, close_ratio: 0.8,
    dealmaker_edge: 'Seller relationship management',
    stop_delegate: 'Administrative (chasing docs, etc.), buyer management',
    notes: 'People/support: Tech stack; buyer/seller admin support. Time: 30 hrs/wk.',
    priorities: ['Qualified leads', 'Administrative assistance', 'CIM process', 'Buyer management', 'DD & Closing process'],
  },
  {
    id: 'mark', name: 'Mark', role: 'Broker', sort_order: 11,
    commission_split: 0.5, personal_income_target: 300000, avg_deal_size: 2000000,
    commission_rate: 0.1, close_ratio: 0.6,
    dealmaker_edge: "Seller Discovery; MPA; Getting EA's",
    stop_delegate: 'Buyer qualification; personal mindset',
    notes: 'Tools/training: GHL training; AI integration. Time: 20 hrs/wk.',
    priorities: ['Lead generation', 'Deal support', 'Company communication'],
  },
  {
    id: 'robin', name: 'Robin McIntire', role: 'Sr. Acquisition Advisor', sort_order: 12,
    commission_split: 0.5, personal_income_target: 1000000, avg_deal_size: 3000000,
    commission_rate: 0.1, close_ratio: 0.8,
  },
  {
    id: 'alisha', name: 'Alisha Kaiser', role: 'Acquisition Advisor', sort_order: 13,
    commission_split: 0.5, personal_income_target: 100000, avg_deal_size: 1500000,
    commission_rate: 0.1, close_ratio: 0.8,
    dealmaker_edge: 'Inital, Discovery, Communication/follow-through',
    stop_delegate: 'MPA, EA negotiation',
    notes: 'People/support: Deal support/advice. Time: 20 hrs/wk.',
    priorities: ['Lead generation'],
  },
  {
    id: 'ken', name: 'Ken Ernewein', role: 'Acquisition Associate', sort_order: 14,
    commission_split: 0.425, personal_income_target: null, avg_deal_size: null,
    commission_rate: 0.1, close_ratio: 0.2,
  },
  {
    id: 'macon', name: 'Macon Rudisill', role: 'Acquisition Associate', sort_order: 15,
    commission_split: 0.5, personal_income_target: 200000, avg_deal_size: 1000000,
    commission_rate: 0.1, close_ratio: 0.8,
  },
  {
    id: 'chris', name: 'Chris Mahony', role: 'Acquisition Associate', sort_order: 16,
    commission_split: 0.425, personal_income_target: null, avg_deal_size: null,
    commission_rate: 0.1, close_ratio: 0.2,
  },
  {
    id: 'betty', name: 'Betty Gales', role: 'Acquisition Associate', sort_order: 17,
    commission_split: 0.5, personal_income_target: 500000, avg_deal_size: 850000,
    commission_rate: 0.1, close_ratio: 0.8,
    dealmaker_edge: 'Buyer/seller discernemnt, speed, communication, connection',
    stop_delegate: 'SBA process, tech, spreadsheets',
    notes: 'People/support: Admin tasks (contracts, docs, etc.), preferred lenders. Tools/training: Broker training. Time: 20 hrs/wk.',
    priorities: ['Lead generation'],
  },
];

function seedSuccessPlans() {
  const db = getDb();
  const existing = db.prepare('SELECT COUNT(*) AS n FROM success_plan_people').get();
  if (existing.n > 0) return { seeded: false };

  const now = new Date().toISOString();
  const insertPerson = db.prepare(`
    INSERT INTO success_plan_people (id, name, role, sort_order, active, created_at, updated_at)
    VALUES (@id, @name, @role, @sort_order, 1, @now, @now)
  `);
  const insertPlan = db.prepare(`
    INSERT INTO success_plans (
      id, person_id, year, commission_split, personal_income_target, avg_deal_size,
      commission_rate, close_ratio, dealmaker_edge, stop_delegate, notes,
      actual_gci, deals_closed, active_pipeline, updated_at, updated_by
    ) VALUES (
      @id, @person_id, @year, @commission_split, @personal_income_target, @avg_deal_size,
      @commission_rate, @close_ratio, @dealmaker_edge, @stop_delegate, @notes,
      NULL, NULL, NULL, @now, 'Seed'
    )
  `);
  const insertPriority = db.prepare(`
    INSERT INTO success_plan_priorities (
      id, year, person_id, sort_order, body, owner_name, ladders_to, company_priority_id, due_date, status
    ) VALUES (
      @id, @year, @person_id, @sort_order, @body, '', '', NULL, NULL, ''
    )
  `);

  const tx = db.transaction(() => {
    db.prepare(`
      INSERT INTO success_plan_company (year, vision, mission, deal_values, wtf_number, updated_at, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, 'Seed')
    `).run(
      COMPANY_2027.year, COMPANY_2027.vision, COMPANY_2027.mission,
      COMPANY_2027.deal_values, COMPANY_2027.wtf_number, now,
    );

    const insertGoal = db.prepare(`
      INSERT INTO success_plan_five_year (id, plan_year, goal_year, gci_target, ebitda_target, sort_order)
      VALUES (?, ?, ?, NULL, NULL, ?)
    `);
    FIVE_YEAR_GOALS.forEach((goalYear, i) => {
      insertGoal.run(`fy-${PLAN_YEAR}-${goalYear}`, PLAN_YEAR, goalYear, i);
    });

    for (const person of PEOPLE) {
      insertPerson.run({ ...person, now });
      insertPlan.run({
        id: `${person.id}-${PLAN_YEAR}`,
        person_id: person.id,
        year: PLAN_YEAR,
        commission_split: person.commission_split,
        personal_income_target: person.personal_income_target,
        avg_deal_size: person.avg_deal_size,
        commission_rate: person.commission_rate,
        close_ratio: person.close_ratio,
        dealmaker_edge: person.dealmaker_edge || '',
        stop_delegate: person.stop_delegate || '',
        notes: person.notes || '',
        now,
      });
      (person.priorities || []).forEach((body, i) => {
        insertPriority.run({
          id: `${person.id}-${PLAN_YEAR}-p${i + 1}`,
          year: PLAN_YEAR,
          person_id: person.id,
          sort_order: i,
          body,
        });
      });
    }
  });

  tx();
  console.log(`[Success Plans] Seeded ${PEOPLE.length} people for ${PLAN_YEAR}`);
  return { seeded: true, people: PEOPLE.length, year: PLAN_YEAR };
}

module.exports = { PLAN_YEAR, COMPANY_2027, FIVE_YEAR_GOALS, PEOPLE, seedSuccessPlans };
