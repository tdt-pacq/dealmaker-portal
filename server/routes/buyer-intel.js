/**
 * buyer-intel.js
 * Buyer Intelligence — AI-powered buyer research & call prep report
 *
 * Routes:
 *   POST /api/buyer-intel/research   → kick off async research, returns { jobId }
 *   GET  /api/buyer-intel/jobs/:id   → poll status / results
 */

const express   = require('express');
const Anthropic  = require('@anthropic-ai/sdk');
const { v4: uuidv4 } = require('uuid');

const router    = express.Router();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const jobs      = new Map();

// Auto-clean after 30 min
setInterval(() => {
  const cutoff = Date.now() - 30 * 60 * 1000;
  for (const [id, job] of jobs) {
    if (job.createdAt < cutoff) jobs.delete(id);
  }
}, 10 * 60 * 1000);

function extractText(content) {
  return (content || []).filter(b => b.type === 'text').map(b => b.text).join('');
}

function safeParseObject(raw) {
  const stripped = raw.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '');
  const match = stripped.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

// ─── Core Research Logic ──────────────────────────────────────────────────────

async function researchBuyer(buyer) {
  const { buyer_name, email, company, linkedin, website, buybox_notes, additional_context } = buyer;

  console.log(`[Buyer Intel] Starting research for: ${buyer_name || 'Unknown'}`);

  // ── Call 1: Web research ──────────────────────────────────────────────────
  const researchResp = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 6000,
    tools: [{ type: 'web_search_20250305', name: 'web_search' }],
    system: `You are a buyer intelligence researcher for Peterson Acquisitions — The Deal Team, a top SBA acquisition advisory firm. Research potential business acquisition buyers online to help advisors prepare for sales calls. Search LinkedIn, news articles, company websites, social media, and public directories. Report everything you find about their background, career, business experience, personality signals, and online presence. Be thorough and factual — only report what you actually find.`,
    messages: [{
      role: 'user',
      content: `Research this potential buyer thoroughly and compile everything you find online:

Name: ${buyer_name || 'Not provided'}
Email: ${email || 'Not provided'}
Company / Employer: ${company || 'Not provided'}
LinkedIn: ${linkedin || 'Not provided'}
Website: ${website || 'Not provided'}
Buy Box Notes: ${buybox_notes || 'Not provided'}
Additional Context: ${additional_context || 'Not provided'}

Search for:
1. LinkedIn profile — career history, titles, education, endorsements, posts
2. News articles, press releases, or podcast appearances
3. Company/employer background and their role there
4. Social media presence and public statements
5. Any entrepreneurial or business ownership history
6. Personality signals from their online language and content

Report all findings in plain text.`,
    }],
  }, { timeout: 240_000 }); // 4-min cap on web-search call

  const rawResearch = extractText(researchResp.content);
  console.log(`[Buyer Intel] Research gathered (${rawResearch.length} chars)`);

  // ── Call 2: Generate structured report ───────────────────────────────────
  const reportResp = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 6000,
    system: `You are an expert sales strategist and buyer psychologist for Peterson Acquisitions — The Deal Team. Based on online research and buyer info, generate a structured buyer intelligence report. The five framework sections (Desire, Identity, Block, Capacity, Future) represent stages of a sales conversation — generate customized questions and advisor talking points for each stage based on what you know about this specific person. Make everything highly personalized to this individual. Return only valid JSON.`,
    messages: [{
      role: 'user',
      content: `Generate a buyer intelligence report based on the following.

BUYER INFO PROVIDED:
Name: ${buyer_name || 'Unknown'}
Company: ${company || 'Not provided'}
Buy Box Notes: ${buybox_notes || 'Not provided'}
Additional Context: ${additional_context || 'Not provided'}

ONLINE RESEARCH FINDINGS:
${rawResearch || 'No research findings — base report on provided info only.'}

Return a JSON object with EXACTLY this structure (no markdown, no preamble):
{
  "summary": "2-3 paragraph background summary — career path, current role, business experience, and what makes them a likely acquisition buyer",
  "personality_type": "Exactly one of: The Operator / The Investor / The Escape Artist / The Legacy Builder",
  "personality_rationale": "2-3 sentences explaining why this archetype fits based on their background and online signals",
  "online_presence": "1-2 sentences summarizing their digital footprint — active on LinkedIn? any press? social following?",
  "hot_points": [
    "Specific motivator or value this buyer cares about deeply (personalized)",
    "Specific motivator 2",
    "Specific motivator 3",
    "Specific motivator 4",
    "Specific motivator 5"
  ],
  "things_to_avoid": [
    "Specific topic, approach, or trigger to avoid with this buyer (personalized)",
    "Thing to avoid 2",
    "Thing to avoid 3"
  ],
  "framework": {
    "desire": {
      "overview": "What likely brings this specific person to explore acquisition — their surface-level motivation",
      "questions": [
        "Personalized opening question to uncover their desire?",
        "Question 2?",
        "Question 3?",
        "Question 4?"
      ],
      "talking_points": [
        "Advisor framing or bridge point tailored to this buyer",
        "Talking point 2",
        "Talking point 3"
      ]
    },
    "identity": {
      "overview": "How this person likely sees themselves today and the future version they aspire to",
      "questions": [
        "Personalized question about their vision or future self?",
        "Question 2?",
        "Question 3?",
        "Question 4?"
      ],
      "talking_points": [
        "Advisor talking point about identity shift tailored to this buyer",
        "Talking point 2",
        "Talking point 3"
      ]
    },
    "block": {
      "overview": "Most likely obstacles, fears, or objections this specific buyer will have",
      "questions": [
        "Personalized question to surface their hesitation?",
        "Question 2?",
        "Question 3?",
        "Question 4?"
      ],
      "talking_points": [
        "Advisor reframe or bridge to address their likely block",
        "Talking point 2",
        "Talking point 3"
      ]
    },
    "capacity": {
      "overview": "Assessment of their likely financial and emotional readiness to move forward",
      "questions": [
        "Personalized question to assess commitment or capital readiness?",
        "Question 2?",
        "Question 3?",
        "Question 4?"
      ],
      "talking_points": [
        "Advisor point about capacity or readiness tailored to this buyer",
        "Talking point 2",
        "Talking point 3"
      ]
    },
    "future": {
      "overview": "What their life looks like if they succeed — their future identity",
      "questions": [
        "Personalized question to paint their future and close the gap?",
        "Question 2?",
        "Question 3?",
        "Question 4?"
      ],
      "talking_points": [
        "Advisor point about their future state to create urgency",
        "Talking point 2",
        "Talking point 3"
      ]
    }
  }
}`,
    }],
  }, { timeout: 120_000 }); // 2-min cap on synthesis call

  const reportRaw = extractText(reportResp.content);
  console.log(`[Buyer Intel] Report generated (${reportRaw.length} chars)`);

  const report = safeParseObject(reportRaw);
  if (!report) throw new Error('Failed to parse structured report from AI response');

  report.generatedAt  = new Date().toISOString();
  report.rawResearch  = rawResearch;
  return report;
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// POST /api/buyer-intel/research
router.post('/research', (req, res) => {
  const jobId = uuidv4();
  jobs.set(jobId, { status: 'processing', createdAt: Date.now() });

  (async () => {
    try {
      const report = await researchBuyer(req.body);
      jobs.set(jobId, { status: 'complete', report, createdAt: Date.now() });
    } catch (e) {
      console.error('[Buyer Intel] Error:', e.message);
      jobs.set(jobId, { status: 'error', error: e.message, createdAt: Date.now() });
    }
  })();

  res.json({ jobId });
});

// GET /api/buyer-intel/jobs/:jobId
router.get('/jobs/:jobId', (req, res) => {
  const job = jobs.get(req.params.jobId);
  if (!job) return res.status(404).json({ error: 'Job not found or expired' });
  res.json({ status: job.status, report: job.report, error: job.error });
});

module.exports = router;
