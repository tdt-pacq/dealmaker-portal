/**
 * BuyerStrategyApp.jsx
 * Buyer Strategy Tool — The Deal Team | Peterson Acquisitions
 *
 * Discover → Develop → Deploy framework for advisor-led buyer Zoom calls.
 * All state in localStorage['dealteam_buyer_strategy']. No backend. No API.
 * PPTX export via PptxGenJS CDN (loaded on demand).
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import './buyer-strategy.css';

// ─── Constants ────────────────────────────────────────────────────────────────

const LS_KEY   = 'dealteam_buyer_strategy';
const PPTX_CDN = 'https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.bundle.js';

const OBJECTION_TAGS = ['Money','Time','Spouse/Partner','Failure','Self-Doubt','Trust'];
const PERSONALITY_OPTIONS = ['','The Operator','The Investor','The Escape Artist','The Legacy Builder'];
const SBA_STATUS_OPTIONS  = ['None','In Progress','Approved'];
const TIMELINE_OPTIONS    = ['6mo','12mo','18mo','24mo+'];
const CLOSE_TL_OPTIONS    = ['3 months','6 months','12 months','18+ months'];
const DECISION_OPTIONS    = ['','Committed','Needs Partner Conversation','Objection Raised','No Decision','Reschedule'];

const MILESTONES = [
  {id:'buybox',   label:'Buybox Submitted'},
  {id:'match',    label:'Deal Match Found'},
  {id:'loi',      label:'LOI Executed'},
  {id:'dd',       label:'Due Diligence'},
  {id:'sba',      label:'SBA Submission'},
  {id:'close',    label:'Close'},
];

// ─── Default Data ─────────────────────────────────────────────────────────────

const newId = () => 'b_' + Date.now().toString(36);

const defIntel = () => ({
  name:'', phone:'', email:'', linkedin:'',
  sbaStatus:'None', sbaAmount:'', resumeOnFile:false, buyboxComplete:false,
  personalityType:'', personalityRationale:'', personalityOverridden:false,
  mindset:5, model:5, momentum:5,
});
const defDiscover = () => ({
  callFrame:{rapport:false,agenda:false,permission:false,icebreaker:''},
  desire:'', desireSummary:'',
  identity:{statement:'',timeline:'12mo',lifestyle:''},
  block:{text:'',objections:[]},
  capacity:{commitment:5,statement:'',capital:'',timelineToClose:'6 months'},
  future:{response:'',currentIdentity:'',futureIdentity:''},
  gapAnalysis:'',
  nextSteps:{buybox:false,resume:false,sba:false,developDate:'',prepNotes:''},
  status:'not_started',
});
const defDevelop = () => ({
  updates:'', buyboxSubmitted:false,
  programSelected:'',
  programBenefits:['','',''],
  feeStructure:'', timelineToClose:'',
  purchasePriceRange:'', projectedSDE:'',
  dealOptions: Array.from({length:3},()=>({
    businessType:'',revenue:'',sde:'',askingPrice:'',
    dealStructure:'',downPayment:'',sbaTerms:'',whyFit:'',
  })),
  decisionOutcome:'', objectionNotes:{}, objectionAddressed:{},
  nextAction:'', nextActionDate:'', status:'not_started',
});
const defDeploy  = () => ({
  program:'',
  milestones: Object.fromEntries(MILESTONES.map(m=>[m.id,false])),
  notes:'',
});
const defBuyer   = () => ({
  intel:defIntel(), discover:defDiscover(),
  develop:defDevelop(), deploy:defDeploy(),
  createdAt:new Date().toISOString(),
});
const defData    = () => ({activeBuyerId:null, buyers:{}});

// ─── localStorage ─────────────────────────────────────────────────────────────

const lsOk = (() => {
  try { localStorage.setItem('__bs','1'); localStorage.removeItem('__bs'); return true; }
  catch { return false; }
})();

function loadData() {
  if (!lsOk) return defData();
  try { const r=localStorage.getItem(LS_KEY); return r ? JSON.parse(r) : defData(); }
  catch { return defData(); }
}
function persist(data) {
  if (!lsOk) return;
  try { localStorage.setItem(LS_KEY, JSON.stringify(data)); }
  catch(e) { console.warn('[BuyerStrategy] localStorage write failed:', e.message); }
}

// ─── Business Logic ───────────────────────────────────────────────────────────

const ARCHETYPE_KW = {
  'The Operator':      ['systems','operations','manage','control','run','efficient','process','team'],
  'The Investor':      ['roi','return','passive','portfolio','cash flow','yield','invest','asset'],
  'The Escape Artist': ['freedom','corporate','tired','own','independent','autonomy','escape','quit'],
  'The Legacy Builder':['legacy','family','build','children','last','future','generation','heritage'],
};
const ARCHETYPE_WHY = {
  'The Operator':      'Language emphasizes systems and operational control.',
  'The Investor':      'Language is returns-driven and financially analytical.',
  'The Escape Artist': 'Language signals desire to break free from constraints.',
  'The Legacy Builder':'Language focuses on family, heritage, and long-term wealth.',
};

function inferPersonality(buyer) {
  const corpus = [
    buyer.discover.desire, buyer.discover.identity.statement,
    buyer.discover.identity.lifestyle, buyer.discover.block.text,
    buyer.discover.future.response, buyer.discover.future.futureIdentity,
  ].join(' ').toLowerCase();
  if (corpus.trim().length < 15) return {type:'',rationale:''};
  const scores = Object.fromEntries(
    Object.entries(ARCHETYPE_KW).map(([k,kws])=>[k, kws.filter(w=>corpus.includes(w)).length])
  );
  const [winner] = Object.entries(scores).sort((a,b)=>b[1]-a[1]);
  return winner[1]===0 ? {type:'',rationale:''} : {type:winner[0], rationale:ARCHETYPE_WHY[winner[0]]};
}

function buildGapText(buyer) {
  const {intel,discover} = buyer;
  const nm  = intel.name || 'Your client';
  const vis = discover.identity.statement || '{{their vision — complete Section 2}}';
  const blk = discover.block.text        || '{{their primary block — complete Section 3}}';
  const cap = parseFloat(String(discover.capacity.capital||'').replace(/[^0-9.]/g,'')) || 0;
  const com = discover.capacity.commitment || 5;
  const sde = cap > 0 ? cap*3 : 500000;
  const sdeLbl   = cap > 0 ? `$${(Math.round(sde/100000)*0.1).toFixed(1)}M` : '{{SDE estimate}}';
  const oppLbl   = cap > 0 ? `$${Math.round((sde*3)-(cap*0.21)).toLocaleString()}` : '{{opportunity cost}}';
  const biz3yr   = cap > 0 ? `$${Math.round(sde*3).toLocaleString()}` : '{{business value projection}}';
  const capLbl   = cap > 0 ? `$${cap.toLocaleString()}` : '{{liquid capital — complete Section 4}}';
  return `${nm} wants ${vis} but is currently blocked by ${blk}.\n\nCapacity: ${com}/10. Available capital: ${capLbl}.\n\nAt current trajectory, ${nm} leaves an estimated ${oppLbl} in wealth-building potential on the table over 36 months. A ${sdeLbl} SDE acquisition through the QSI™ process projects ${biz3yr} in business value over the same window.\n\nThe gap is not capital. The gap is certainty and a system.`;
}

function summarizeDesire(text) {
  if (!text || text.trim().length < 15) return '{{add buyer response above to generate summary}}';
  const stop = new Set('i a an the and or but in on at to for of with by from my me we our you your it is are was were be been have has had do does did will would could should can that this what just really very so also as if not about get got make think feel when then they their there here want need know'.split(' '));
  const words = text.toLowerCase().replace(/[^a-z\s]/g,'').split(/\s+/).filter(w=>w.length>3&&!stop.has(w));
  const freq = {}; words.forEach(w=>{freq[w]=(freq[w]||0)+1;});
  const top = Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([w])=>w);
  const preview = text.trim().slice(0,90);
  return top.length ? `Core desire: ${top.join(' / ')} — "${preview}${text.length>90?'...':'"'}` : `"${preview}${text.length>90?'...':`"`}`;
}

function stageStatus(buyer, stage) {
  const s = buyer[stage]?.status;
  if (s==='complete') return 'complete';
  const d = buyer[stage];
  if (stage==='discover') return (d.desire||d.identity.statement||d.block.text) ? 'in_progress' : 'not_started';
  if (stage==='develop')  return (d.updates||d.programSelected) ? 'in_progress' : 'not_started';
  return 'not_started';
}
const stageDot = s => s==='complete' ? {icon:'●',color:'#2eb860'} : s==='in_progress' ? {icon:'◑',color:'#C9A84C'} : {icon:'○',color:'#64748b'};

// ─── Objection Templates ──────────────────────────────────────────────────────

function objTemplate(tag, buyer) {
  const n    = buyer.intel.name || 'your client';
  const vis  = buyer.discover.identity.statement        || '{{IDENTITY_VISION}}';
  const tl   = buyer.discover.identity.timeline         || '{{TIMELINE}}';
  const blk  = buyer.discover.block.text                || '{{BLOCK}}';
  const curId= buyer.discover.future.currentIdentity    || '{{CURRENT_IDENTITY}}';
  const futId= buyer.discover.future.futureIdentity     || '{{FUTURE_IDENTITY}}';
  const capRaw = parseFloat(String(buyer.discover.capacity.capital||'').replace(/[^0-9.]/g,''))||0;
  const cap    = capRaw>0?`$${capRaw.toLocaleString()}`:'{{CAPITAL}}';
  const sde    = capRaw>0?capRaw*3:500000;
  const sdeLbl = capRaw>0?`$${(Math.round(sde/100000)*0.1).toFixed(1)}M`:'{{SDE}}M';
  const sde3x  = capRaw>0?`$${Math.round(sde*3).toLocaleString()}`:'{{3×SDE}}';
  const capX   = capRaw>0?`$${Math.round(capRaw*1.225).toLocaleString()}`:'{{CAPITAL×1.225}}';

  const T = {
    'Money':{
      acknowledge:`I completely understand — this is a significant financial commitment and it deserves serious thought.`,
      reframe:`The real question isn't whether you can afford to buy — it's whether your current path gets you to ${vis} within ${tl}.\n\nBased on what you shared, ${n} has ${cap} available. Deployed into a ${sdeLbl} SDE acquisition, the 36-month upside is ${sde3x}. Left where it is at 7% — it's ${capX}.\n\nThe gap is the cost of staying put.`,
      redirect:`If the numbers worked and the deal matched your buybox, would capital structure be the only thing standing between you and your vision?`,
    },
    'Time':{
      acknowledge:`Time is the one thing none of us can get back — I hear that.`,
      reframe:`You told me your vision is ${vis} and your timeline is ${tl}. The question isn't whether you have time to do this. It's whether you can afford to wait another ${tl} and still get there.`,
      redirect:`What if the process was designed specifically so it doesn't consume your current schedule — would time still be the concern?`,
    },
    'Spouse/Partner':{
      acknowledge:`That makes complete sense — this is a family decision, not just a business decision.`,
      reframe:`The strongest deals I've seen happen when both partners are aligned on the vision. What you described — ${vis} — that's not just your dream. That's your family's future.`,
      redirect:`Would it help to schedule a 30-minute call that includes your partner so they can hear the process directly and ask their own questions?`,
    },
    'Failure':{
      acknowledge:`Fear of making a wrong move on a decision this size is completely rational — and it means you're taking it seriously.`,
      reframe:`Here's what separates our process: the industry average deal success rate is around 20%. Our QSI™ system runs at 90%+. That gap exists because we eliminate the variables that cause deals to fail — before you're committed.`,
      redirect:`If the process was specifically designed to protect you from the most common failure points, would that change how you're thinking about the risk?`,
    },
    'Self-Doubt':{
      acknowledge:`What you're feeling is something almost every successful buyer has felt before their first acquisition — it's not a signal to stop, it's a signal you care.`,
      reframe:`You told me your future identity is ${futId}. You also told me what's been holding you back is ${blk}. Every day you make decisions from ${curId} instead of ${futId} is a day the gap gets wider.`,
      redirect:`What would you need to see or know that would make you feel confident this is the right move?`,
    },
    'Trust':{
      acknowledge:`Skepticism toward brokers is earned — I won't pretend otherwise.`,
      reframe:`The QSI™ system exists because we built it specifically to remove the opacity that kills most deals. You get full visibility into the process, the pricing methodology, the buyer pool, and every step before you commit to anything.`,
      redirect:`What would it take for you to feel that working with The Deal Team is the safest path to your acquisition?`,
    },
  };
  return T[tag]||null;
}


// ─── Small Reusable Components ────────────────────────────────────────────────

function BsToggle({value, onChange, label}) {
  return (
    <label className="bs-toggle" onClick={()=>onChange(!value)}>
      <div className={`bs-toggle-track${value?' bs-toggle-track--on':''}`}>
        <div className="bs-toggle-thumb"/>
      </div>
      {label && <span style={{fontFamily:'Inter,sans-serif',fontSize:13,color:'#e2e8f0'}}>{label}</span>}
    </label>
  );
}

function BsAccordion({number, title, sub, children}) {
  const [open,setOpen] = useState(false);
  return (
    <div className="bs-accordion">
      <button className="bs-accordion-header" onClick={()=>setOpen(o=>!o)}>
        {number!=null && <span className="bs-accordion-num">{number}</span>}
        <span className="bs-accordion-title">{title}{sub&&<span className="bs-accordion-sub">{sub}</span>}</span>
        <span className={`bs-accordion-arrow${open?' bs-accordion-arrow--open':''}`}>›</span>
      </button>
      {open && <div className="bs-accordion-body">{children}</div>}
    </div>
  );
}

function BsField({label, children, style}) {
  return <div style={style}><label className="bs-label">{label}</label>{children}</div>;
}

// ─── PptxGenJS Loader ─────────────────────────────────────────────────────────

function usePptx() {
  const [ready,setReady]   = useState(!!window.PptxGenJS);
  const [error,setError]   = useState(false);
  const load = useCallback(()=>{
    if (window.PptxGenJS) { setReady(true); return; }
    const s = document.createElement('script');
    s.src = PPTX_CDN;
    s.onload  = ()=>setReady(true);
    s.onerror = ()=>setError(true);
    document.head.appendChild(s);
  },[]);
  return {ready, error, load};
}

// ─── Slide Canvas (scales 960×540 to fit container) ──────────────────────────

function SlideCanvas({children, animClass}) {
  const outerRef = useRef(null);
  const [scale,setScale] = useState(1);
  useEffect(()=>{
    const calc = ()=>{ if(outerRef.current) setScale(outerRef.current.offsetWidth/960); };
    calc();
    const ro = new ResizeObserver(calc);
    if(outerRef.current) ro.observe(outerRef.current);
    return ()=>ro.disconnect();
  },[]);
  return (
    <div ref={outerRef} className="bs-slide-outer">
      <div className={`bs-slide-inner${animClass?' '+animClass:''}`}
           style={{transform:`scale(${scale})`}}>
        {children}
      </div>
    </div>
  );
}

// ─── HTML Slide Renderers ─────────────────────────────────────────────────────
// Each renders a 960×540 JSX card matching the PPTX brand design.

const S = {
  // Dark slide base
  dark: { width:960, height:540, background:'#1B2A4A', position:'relative', overflow:'hidden',
          display:'flex', flexDirection:'column', padding:60, boxSizing:'border-box', fontFamily:'Inter,sans-serif' },
  // Light slide base
  light: { width:960, height:540, background:'#F9F7F2', position:'relative', overflow:'hidden',
           display:'flex', flexDirection:'column', padding:60, boxSizing:'border-box', fontFamily:'Inter,sans-serif' },
  hdDark:  { fontFamily:"'Playfair Display',serif", fontSize:40, color:'#FFFFFF', fontWeight:700, lineHeight:1.15, marginBottom:6 },
  hdGold:  { fontFamily:"'Playfair Display',serif", fontSize:40, color:'#C9A84C', fontWeight:700, lineHeight:1.15, marginBottom:6 },
  hdNavy:  { fontFamily:"'Playfair Display',serif", fontSize:36, color:'#1B2A4A', fontWeight:700, lineHeight:1.2, marginBottom:6 },
  rule:    { width:60, height:4, background:'#C9A84C', borderRadius:2, margin:'16px 0' },
  body:    { fontFamily:'Inter,sans-serif', fontSize:16, lineHeight:1.65, color:'#FFFFFF' },
  bodyDk:  { fontFamily:'Inter,sans-serif', fontSize:16, lineHeight:1.65, color:'#333333' },
  tag:     { position:'absolute', top:20, right:24, fontFamily:'Inter,sans-serif', fontSize:10, fontWeight:700,
             letterSpacing:2.5, textTransform:'uppercase', color:'#C9A84C' },
  pg:      { position:'absolute', bottom:14, right:20, fontFamily:'Inter,sans-serif', fontSize:10, color:'#4A5568' },
  tagLt:   { position:'absolute', top:20, right:24, fontFamily:'Inter,sans-serif', fontSize:10, fontWeight:700,
             letterSpacing:2.5, textTransform:'uppercase', color:'#1B2A4A', opacity:0.5 },
};

const BRAND_TAG_DARK  = <div style={S.tag}>THE DEAL TEAM | PETERSON ACQUISITIONS</div>;
const BRAND_TAG_LIGHT = <div style={S.tagLt}>THE DEAL TEAM | PETERSON ACQUISITIONS</div>;

function SlideNum({n,total}) { return <div style={S.pg}>{n} / {total}</div>; }

function BulletList({items, color='#333333', gap=10}) {
  return (
    <div style={{display:'flex',flexDirection:'column',gap}}>
      {items.map((item,i)=>(
        <div key={i} style={{display:'flex',alignItems:'flex-start',gap:10}}>
          <div style={{width:6,height:6,borderRadius:3,background:'#C9A84C',flexShrink:0,marginTop:7}}/>
          <div style={{fontFamily:'Inter,sans-serif',fontSize:15,color,lineHeight:1.55}}>{item}</div>
        </div>
      ))}
    </div>
  );
}

function StatCard({stat, dark}) {
  return (
    <div style={{flex:1,background:dark?'rgba(255,255,255,0.07)':'rgba(27,42,74,0.07)',
                 border:`1px solid ${dark?'rgba(201,168,76,0.3)':'rgba(27,42,74,0.2)'}`,
                 borderRadius:10,padding:'24px 18px',textAlign:'center'}}>
      <div style={{fontFamily:"'Playfair Display',serif",fontSize:28,fontWeight:700,
                   color:'#C9A84C',marginBottom:8}}>{stat.value}</div>
      <div style={{fontFamily:'Inter,sans-serif',fontSize:13,color:dark?'#BDC8D8':'#555555',lineHeight:1.4}}>{stat.label}</div>
    </div>
  );
}

// Discover deck slides (9)
function buildDiscoverSlides(buyer) {
  const nm    = buyer.intel.name  || 'Your Client';
  const date  = new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
  const vis   = buyer.discover.identity.statement || '{{Complete Section 2 — Identity}}';
  const tl    = buyer.discover.identity.timeline  || '12mo';
  const curId = buyer.discover.future.currentIdentity || '{{Current Identity}}';
  const futId = buyer.discover.future.futureIdentity  || '{{Future Identity}}';
  const gap   = buyer.discover.gapAnalysis || buildGapText(buyer);
  const capRaw= parseFloat(String(buyer.discover.capacity.capital||'').replace(/[^0-9.]/g,''))||0;
  const sde   = capRaw>0?capRaw*3:500000;
  const gapAmt= capRaw>0?`$${Math.round((sde*3)-(capRaw*0.21)).toLocaleString()}`:'{{Opportunity Cost}}';
  const devDate = buyer.discover.nextSteps.developDate || '{{Schedule your Develop Call}}';
  const nameHl = nm==='Your Client' ? <span style={{background:'rgba(245,245,0,0.3)',padding:'0 4px'}}>{nm}</span> : nm;

  return [
    // Slide 1 — Title
    <div style={S.dark} key="d1">
      {BRAND_TAG_DARK}
      <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',textAlign:'center'}}>
        <div style={S.hdDark}>Your Acquisition</div>
        <div style={S.hdGold}>Discovery Session</div>
        <div style={S.rule}/>
        <div style={{fontFamily:'Inter,sans-serif',fontSize:20,color:'#BDC8D8',marginBottom:6}}>{nameHl}</div>
        <div style={{fontFamily:'Inter,sans-serif',fontSize:14,color:'#8A9BB0'}}>{date}</div>
        <div style={{position:'absolute',bottom:40,left:0,right:0,textAlign:'center',
                     fontFamily:"'Playfair Display',serif",fontSize:14,color:'#C9A84C',fontStyle:'italic',padding:'0 60px'}}>
          You're only one deal away from the wealth, time, and freedom you deserve.
        </div>
      </div>
      <SlideNum n={1} total={9}/>
    </div>,

    // Slide 2 — About The Deal Team
    <div style={S.light} key="d2">
      {BRAND_TAG_LIGHT}
      <div style={S.hdNavy}>Who We Are</div>
      <div style={S.rule}/>
      <div style={{display:'flex',gap:40,flex:1}}>
        <div style={{flex:3}}>
          <BulletList color="#333333" items={[
            'Mission: Help entrepreneurs build wealth and freedom through business acquisition.',
            'The QSI™ System — a proprietary acquisition process with 90%+ deal success.',
            'Industry average deal close rate: ~20%. Our rate: 90%+.',
            'Full-service: deal sourcing, valuation, SBA structuring, and close support.',
          ]}/>
        </div>
        <div style={{flex:2,background:'#E8E4DC',borderRadius:10,display:'flex',alignItems:'center',
                     justifyContent:'center',color:'#94a3b8',fontSize:13}}>
          Team Photo
        </div>
      </div>
      <SlideNum n={2} total={9}/>
    </div>,

    // Slide 3 — Why Acquisition
    <div style={S.dark} key="d3">
      {BRAND_TAG_DARK}
      <div style={{...S.hdDark,fontSize:32}}>The Wealth-Building Case for Acquisition</div>
      <div style={S.rule}/>
      <div style={{display:'flex',gap:20,flex:1,alignItems:'stretch'}}>
        <StatCard dark stat={{value:'{{STAT_1_VALUE}}',label:'{{STAT_1_LABEL}}'}}/>
        <StatCard dark stat={{value:'{{STAT_2_VALUE}}',label:'{{STAT_2_LABEL}}'}}/>
        <StatCard dark stat={{value:'{{STAT_3_VALUE}}',label:'{{STAT_3_LABEL}}'}}/>
      </div>
      <div style={{fontFamily:'Inter,sans-serif',fontSize:11,color:'#4A5568',marginTop:12}}>Fill in stats before presenting — edit in Develop stage Deal Options.</div>
      <SlideNum n={3} total={9}/>
    </div>,

    // Slide 4 — SBA Opportunity
    <div style={S.light} key="d4">
      {BRAND_TAG_LIGHT}
      <div style={S.hdNavy}>The SBA Advantage</div>
      <div style={S.rule}/>
      <BulletList color="#333333" gap={16} items={[
        'Typical buyer down payment: 10% — leverage up to 90% with an SBA 7(a) loan.',
        'Loan terms: 10-year amortization at current SBA prime-plus rates.',
        'Eligible deal sizes: $500K–$5M+ acquisition price.',
        'Speed to close: 60–120 days from LOI to funded transaction.',
      ]}/>
      <div style={{fontFamily:'Inter,sans-serif',fontSize:11,color:'#888888',marginTop:'auto',paddingTop:20}}>
        {'Source: {{SBA_SOURCE}} — verify current terms before presenting.'}
      </div>
      <SlideNum n={4} total={9}/>
    </div>,

    // Slide 5 — Your Vision
    <div style={S.dark} key="d5">
      {BRAND_TAG_DARK}
      <div style={{...S.hdGold,fontSize:34}}>{nm === 'Your Client' ? <span style={{background:'rgba(245,245,0,0.2)',padding:'0 4px'}}>{nm}</span> : nm}'s Vision</div>
      <div style={S.rule}/>
      <div style={{flex:1,display:'flex',alignItems:'center'}}>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:24,color:'#FFFFFF',lineHeight:1.55,fontStyle:'italic',
                     borderLeft:'4px solid #C9A84C',paddingLeft:24}}>
          "{vis}"
        </div>
      </div>
      <div style={{fontFamily:'Inter,sans-serif',fontSize:14,color:'#8A9BB0',marginTop:16}}>
        Target timeline: <span style={{color:'#C9A84C',fontWeight:600}}>{tl}</span>
      </div>
      <SlideNum n={5} total={9}/>
    </div>,

    // Slide 6 — The Gap
    <div style={S.light} key="d6">
      {BRAND_TAG_LIGHT}
      <div style={S.hdNavy}>Where You Are vs. Where You Want to Be</div>
      <div style={S.rule}/>
      <div style={{display:'flex',gap:32,flex:1}}>
        <div style={{flex:1,background:'rgba(27,42,74,0.05)',borderRadius:10,padding:24}}>
          <div style={{fontFamily:'Inter,sans-serif',fontSize:12,fontWeight:700,color:'#888888',
                       textTransform:'uppercase',letterSpacing:2,marginBottom:12}}>TODAY</div>
          <div style={{fontFamily:'Inter,sans-serif',fontSize:15,color:'#555555',lineHeight:1.6}}>{curId}</div>
        </div>
        <div style={{flex:1,background:'rgba(27,42,74,0.08)',borderRadius:10,padding:24,
                     border:'2px solid #C9A84C'}}>
          <div style={{fontFamily:'Inter,sans-serif',fontSize:12,fontWeight:700,color:'#C9A84C',
                       textTransform:'uppercase',letterSpacing:2,marginBottom:12}}>YOUR VISION</div>
          <div style={{fontFamily:"'Playfair Display',serif",fontSize:16,color:'#1B2A4A',lineHeight:1.6,fontStyle:'italic'}}>{vis}</div>
        </div>
      </div>
      <div style={{textAlign:'center',marginTop:20,fontFamily:'Inter,sans-serif',fontSize:17,
                   fontWeight:700,color:'#1B2A4A'}}>
        {gapAmt} opportunity cost of staying put
      </div>
      <SlideNum n={6} total={9}/>
    </div>,

    // Slide 7 — The Acquisition Path
    <div style={S.dark} key="d7">
      {BRAND_TAG_DARK}
      <div style={S.hdDark}>The Acquisition Path</div>
      <div style={S.rule}/>
      <div style={{display:'flex',gap:16,flex:1,alignItems:'center'}}>
        {[
          {num:'01',label:'Search',desc:'Define your buybox, we source matched opportunities.'},
          {num:'02',label:'Qualify',desc:'QSI™ valuation, due diligence, and deal review.'},
          {num:'03',label:'Structure',desc:'SBA financing, seller carry, and deal architecture.'},
          {num:'04',label:'Close',desc:'LOI to funded close — 60–120 day target.'},
        ].map((step,i)=>(
          <div key={i} style={{flex:1,textAlign:'center',padding:20}}>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:36,color:'#C9A84C',fontWeight:700,marginBottom:8}}>{step.num}</div>
            <div style={{fontFamily:'Inter,sans-serif',fontSize:16,fontWeight:700,color:'#FFFFFF',marginBottom:8}}>{step.label}</div>
            <div style={{fontFamily:'Inter,sans-serif',fontSize:13,color:'#8A9BB0',lineHeight:1.5}}>{step.desc}</div>
          </div>
        ))}
      </div>
      <SlideNum n={7} total={9}/>
    </div>,

    // Slide 8 — What Happens Next
    <div style={S.light} key="d8">
      {BRAND_TAG_LIGHT}
      <div style={S.hdNavy}>What Happens Next</div>
      <div style={S.rule}/>
      <div style={{display:'flex',flexDirection:'column',gap:14,marginBottom:24}}>
        {[
          `Complete your Buybox — we use it to match you to opportunities.`,
          `We research matched opportunities based on your criteria.`,
          `Strategy session scheduled: ${devDate}`,
        ].map((item,i)=>(
          <div key={i} style={{display:'flex',alignItems:'flex-start',gap:16}}>
            <div style={{width:32,height:32,borderRadius:16,background:'#1B2A4A',
                         display:'flex',alignItems:'center',justifyContent:'center',
                         fontFamily:'Inter,sans-serif',fontSize:14,fontWeight:700,color:'#C9A84C',flexShrink:0}}>
              {i+1}
            </div>
            <div style={{fontFamily:'Inter,sans-serif',fontSize:15,color:'#333333',lineHeight:1.55,paddingTop:5}}>{item}</div>
          </div>
        ))}
      </div>
      <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:'#1B2A4A',fontStyle:'italic',
                   textAlign:'center',marginTop:'auto'}}>
        No commitment. No pressure. Just clarity.
      </div>
      <SlideNum n={8} total={9}/>
    </div>,

    // Slide 9 — Close
    <div style={S.dark} key="d9">
      {BRAND_TAG_DARK}
      <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',textAlign:'center'}}>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,color:'#C9A84C',fontWeight:700,
                     letterSpacing:3,textTransform:'uppercase',marginBottom:20}}>
          The Deal Team | Peterson Acquisitions
        </div>
        <div style={S.rule}/>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,color:'#FFFFFF',fontStyle:'italic',
                     lineHeight:1.5,maxWidth:600,margin:'20px auto'}}>
          "You're only one deal away from the wealth, time, and freedom you deserve."
        </div>
        <div style={{marginTop:32,fontFamily:'Inter,sans-serif',fontSize:14,color:'#8A9BB0'}}>
          Michael Moore · The Deal Team<br/>
          michael@thedealteam.co
        </div>
      </div>
      <SlideNum n={9} total={9}/>
    </div>,
  ];
}

// Develop deck slides (10)
function buildDevelopSlides(buyer) {
  const nm    = buyer.intel.name || 'Your Client';
  const date  = new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
  const vis   = buyer.discover.identity.statement || '{{Vision Statement}}';
  const gap   = buyer.discover.gapAnalysis || buildGapText(buyer);
  const gapFst= gap.split('\n')[0];
  const prog  = buyer.develop.programSelected || '{{Program Selected}}';
  const capRaw= parseFloat(String(buyer.discover.capacity.capital||'').replace(/[^0-9.]/g,''))||0;
  const ppRaw = parseFloat(String(buyer.develop.purchasePriceRange||'').replace(/[^0-9.]/g,''))||0;
  const sdeRaw= parseFloat(String(buyer.develop.projectedSDE||'').replace(/[^0-9.]/g,''))||0;
  const dp    = ppRaw>0?(ppRaw*0.10):0;
  const roi3  = ppRaw>0&&sdeRaw>0?Math.round((sdeRaw*3/dp-1)*100):0;

  const dealSlides = buyer.develop.dealOptions.map((d,i)=>(
    <div style={S.light} key={`deal${i}`}>
      {BRAND_TAG_LIGHT}
      <div style={{...S.hdNavy,fontSize:30}}>Deal Option {i+1}</div>
      {d.businessType && <div style={{fontFamily:'Inter,sans-serif',fontSize:16,color:'#C9A84C',fontWeight:600,marginBottom:4}}>{d.businessType}</div>}
      <div style={S.rule}/>
      <div style={{display:'flex',gap:32,flex:1}}>
        <div style={{flex:1}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
            {[['Revenue',d.revenue||'{{Revenue}}'],['SDE',d.sde||'{{SDE}}'],
              ['Asking Price',d.askingPrice||'{{Asking Price}}'],['Down Payment',d.downPayment||'{{Down}}'],
              ['Deal Structure',d.dealStructure||'{{Structure}}'],['SBA Terms',d.sbaTerms||'{{SBA Terms}}'],
            ].map(([lbl,val])=>(
              <div key={lbl}>
                <div style={{fontFamily:'Inter,sans-serif',fontSize:10,fontWeight:700,color:'#888888',textTransform:'uppercase',letterSpacing:1.5,marginBottom:3}}>{lbl}</div>
                <div style={{fontFamily:'Courier New,monospace',fontSize:15,color:'#1B2A4A',fontWeight:600}}>{val}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{flex:1,background:'rgba(201,168,76,0.07)',border:'1px solid rgba(201,168,76,0.25)',
                     borderRadius:10,padding:20}}>
          <div style={{fontFamily:'Inter,sans-serif',fontSize:12,fontWeight:700,color:'#C9A84C',
                       textTransform:'uppercase',letterSpacing:1.5,marginBottom:10}}>
            Why This Fits {nm}'s Profile
          </div>
          <div style={{fontFamily:'Inter,sans-serif',fontSize:14,color:'#333333',lineHeight:1.65}}>
            {d.whyFit || `{{Advisor: explain why this deal matches ${nm}'s buybox, vision, and capacity.}}`}
          </div>
        </div>
      </div>
      <SlideNum n={4+i} total={10}/>
    </div>
  ));

  return [
    // Slide 1
    <div style={S.dark} key="dv1">
      {BRAND_TAG_DARK}
      <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',textAlign:'center'}}>
        <div style={S.hdDark}>Your Acquisition</div>
        <div style={S.hdGold}>Strategy Session</div>
        <div style={S.rule}/>
        <div style={{fontFamily:'Inter,sans-serif',fontSize:20,color:'#BDC8D8',marginBottom:6}}>{nm}</div>
        <div style={{fontFamily:'Inter,sans-serif',fontSize:14,color:'#8A9BB0'}}>{date}</div>
      </div>
      <SlideNum n={1} total={10}/>
    </div>,

    // Slide 2 — Vision Recap
    <div style={S.light} key="dv2">
      {BRAND_TAG_LIGHT}
      <div style={S.hdNavy}>Your Vision Recap</div>
      <div style={S.rule}/>
      <div style={{fontFamily:"'Playfair Display',serif",fontSize:18,color:'#1B2A4A',fontStyle:'italic',
                   borderLeft:'4px solid #C9A84C',paddingLeft:20,lineHeight:1.6,marginBottom:24}}>
        "{vis}"
      </div>
      <div style={{fontFamily:'Inter,sans-serif',fontSize:15,color:'#555555',lineHeight:1.65}}>
        {gapFst}
      </div>
      <div style={{marginTop:'auto',fontFamily:'Inter,sans-serif',fontSize:16,fontWeight:700,color:'#1B2A4A'}}>
        Here's what we found. →
      </div>
      <SlideNum n={2} total={10}/>
    </div>,

    // Slide 3 — What We Found
    <div style={S.dark} key="dv3">
      {BRAND_TAG_DARK}
      <div style={S.hdDark}>We Researched Your Market</div>
      <div style={S.rule}/>
      <div style={{fontFamily:'Inter,sans-serif',fontSize:16,color:'#BDC8D8',lineHeight:1.7,marginBottom:20}}>
        Based on your buybox criteria, we identified opportunities matching your target acquisition profile.
      </div>
      <div style={{fontFamily:'Inter,sans-serif',fontSize:14,color:'#8A9BB0',fontStyle:'italic'}}>
        Here are the opportunities we identified →
      </div>
      <SlideNum n={3} total={10}/>
    </div>,

    // Slides 4–6 — Deal Options
    ...dealSlides,

    // Slide 7 — QSI™ Advantage
    <div style={S.dark} key="dv7">
      {BRAND_TAG_DARK}
      <div style={S.hdDark}>What Protects You Through This Process</div>
      <div style={S.rule}/>
      <div style={{display:'flex',gap:20,flex:1}}>
        {[
          {label:'Confidentiality',body:'Every step is managed with full seller and buyer discretion. Your identity is protected until you choose to move forward.'},
          {label:'Control',body:'You set the criteria. We filter the deals. You only see opportunities that match your buybox — no wasted time.'},
          {label:'Certainty',body:'The QSI™ system eliminates the variables that kill 80% of deals before they start. Our close rate speaks for itself.'},
        ].map(c=>(
          <div key={c.label} style={{flex:1,background:'rgba(255,255,255,0.05)',border:'1px solid rgba(201,168,76,0.25)',
                                    borderRadius:10,padding:24}}>
            <div style={{fontFamily:"'Playfair Display',serif",fontSize:20,color:'#C9A84C',fontWeight:700,marginBottom:12}}>{c.label}</div>
            <div style={{fontFamily:'Inter,sans-serif',fontSize:14,color:'#BDC8D8',lineHeight:1.65}}>{c.body}</div>
          </div>
        ))}
      </div>
      <SlideNum n={7} total={10}/>
    </div>,

    // Slide 8 — Investment Summary
    <div style={S.light} key="dv8">
      {BRAND_TAG_LIGHT}
      <div style={S.hdNavy}>This Is What the Path Forward Looks Like</div>
      <div style={S.rule}/>
      <div style={{marginBottom:16,fontFamily:'Inter,sans-serif',fontSize:14,color:'#555555'}}>Program: <strong style={{color:'#1B2A4A'}}>{prog}</strong> · Fee: {buyer.develop.feeStructure||'{{FEE_STRUCTURE}}'}</div>
      <div style={{background:'rgba(27,42,74,0.06)',borderRadius:10,padding:20}}>
        {[
          ['Purchase Price',ppRaw>0?`$${ppRaw.toLocaleString()}`:'{{Purchase Price Range}}',''],
          ['Buyer Down Payment (~10%)',dp>0?`$${Math.round(dp).toLocaleString()}`:'{{Down Payment}}',''],
          ['Projected Annual SDE',sdeRaw>0?`$${sdeRaw.toLocaleString()}`:'{{Projected SDE}}',''],
          ['3-Year SDE Return',sdeRaw>0?`$${(sdeRaw*3).toLocaleString()}`:'{{3yr Return}}','green'],
          ['3-Year ROI on Down Payment',roi3>0?`${roi3}%`:'{{ROI %}}','green'],
        ].map(([lbl,val,type])=>(
          <div key={lbl} style={{display:'flex',justifyContent:'space-between',alignItems:'center',
                                  padding:'10px 0',borderBottom:'1px solid rgba(27,42,74,0.1)'}}>
            <span style={{fontFamily:'Inter,sans-serif',fontSize:14,color:'#555555'}}>{lbl}</span>
            <span style={{fontFamily:'Courier New,monospace',fontSize:16,fontWeight:700,
                          color:type==='green'?'#059669':'#1B2A4A'}}>{val}</span>
          </div>
        ))}
      </div>
      <SlideNum n={8} total={10}/>
    </div>,

    // Slide 9 — Your Decision
    <div style={S.dark} key="dv9">
      {BRAND_TAG_DARK}
      <div style={{...S.hdGold,fontSize:32,textAlign:'center',marginBottom:8}}>What Would You Like to Do?</div>
      <div style={S.rule}/>
      <div style={{display:'flex',gap:24,flex:1,marginTop:8}}>
        <div style={{flex:1,background:'rgba(255,255,255,0.03)',borderRadius:10,padding:24}}>
          <div style={{fontFamily:'Inter,sans-serif',fontSize:13,fontWeight:700,color:'#64748b',
                       textTransform:'uppercase',letterSpacing:2,marginBottom:16}}>Stay on Current Path</div>
          <BulletList color="#64748b" items={['Continue trading time for income','Gap between vision and reality widens','Capital stays at sub-7% returns']}/>
        </div>
        <div style={{flex:1,background:'rgba(201,168,76,0.08)',border:'2px solid #C9A84C',
                     borderRadius:10,padding:24}}>
          <div style={{fontFamily:'Inter,sans-serif',fontSize:13,fontWeight:700,color:'#C9A84C',
                       textTransform:'uppercase',letterSpacing:2,marginBottom:16}}>Take the Acquisition Path</div>
          <BulletList color="#FFFFFF" items={['Own a cash-flowing business within 90–120 days','Deploy capital at 3×+ returns on SDE','Step into your future identity — now']}/>
        </div>
      </div>
      <SlideNum n={9} total={10}/>
    </div>,

    // Slide 10 — Close
    <div style={S.dark} key="dv10">
      {BRAND_TAG_DARK}
      <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',textAlign:'center'}}>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,color:'#C9A84C',fontWeight:700,letterSpacing:3,textTransform:'uppercase',marginBottom:20}}>
          The Deal Team | Peterson Acquisitions
        </div>
        <div style={S.rule}/>
        <div style={{fontFamily:"'Playfair Display',serif",fontSize:22,color:'#FFFFFF',fontStyle:'italic',lineHeight:1.5,maxWidth:600,margin:'20px auto'}}>
          "You're only one deal away from the wealth, time, and freedom you deserve."
        </div>
        <div style={{marginTop:32,fontFamily:'Inter,sans-serif',fontSize:14,color:'#8A9BB0'}}>
          Next step: {buyer.develop.nextAction||'{{Schedule your next action}}'}<br/>
          {buyer.develop.nextActionDate && <span>Date: {buyer.develop.nextActionDate}</span>}
        </div>
      </div>
      <SlideNum n={10} total={10}/>
    </div>,
  ];
}


// ─── PPTX Generator ───────────────────────────────────────────────────────────
// PptxGenJS colors: no '#'. LAYOUT_WIDE = 13.33" × 7.5"

async function generatePptx(deckType, buyer) {
  if (!window.PptxGenJS) throw new Error('PptxGenJS not loaded');
  const pptx = new window.PptxGenJS();
  pptx.layout  = 'LAYOUT_WIDE';
  pptx.author  = 'The Deal Team | Peterson Acquisitions';
  pptx.subject = deckType === 'discover' ? 'Acquisition Discovery Session' : 'Acquisition Strategy Session';

  const NAVY='1B2A4A', GOLD='C9A84C', CREAM='F9F7F2', WHITE='FFFFFF', MID='333333', MUTED='64748b';
  const nm   = buyer.intel.name  || 'Your Client';
  const date = new Date().toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
  const vis  = buyer.discover.identity.statement || '{{Complete Section 2}}';
  const tl   = buyer.discover.identity.timeline  || '12mo';
  const curId= buyer.discover.future.currentIdentity || '{{Current Identity}}';
  const futId= buyer.discover.future.futureIdentity  || '{{Future Identity}}';
  const capRaw = parseFloat(String(buyer.discover.capacity.capital||'').replace(/[^0-9.]/g,''))||0;
  const sde    = capRaw>0?capRaw*3:500000;
  const gapAmt = capRaw>0?`$${Math.round((sde*3)-(capRaw*0.21)).toLocaleString()}`:'{{Opportunity Cost}}';

  // Helper: add branded slide
  const darkSlide = ()=>{ const s=pptx.addSlide(); s.background={color:NAVY}; return s; };
  const lightSlide=()=>{ const s=pptx.addSlide(); s.background={color:CREAM}; return s; };
  const addTag=(s,dark)=>s.addText('THE DEAL TEAM | PETERSON ACQUISITIONS',{x:7.5,y:0.22,w:5.6,h:0.25,fontFace:'Inter',fontSize:9,color:dark?GOLD:'1B2A4A',bold:true,align:'right'});
  const addPg=(s,n,tot)=>s.addText(`${n} / ${tot}`,{x:12,y:7.15,w:1.2,h:0.25,fontFace:'Inter',fontSize:9,color:MUTED,align:'right'});
  const addRule=(s,x,y,light)=>s.addShape(pptx.ShapeType.rect,{x,y,w:0.9,h:0.05,fill:{color:GOLD},line:{color:GOLD}});
  const addBullet=(s,txt,x,y,w,color)=>s.addText('• '+txt,{x,y,w,h:0.45,fontFace:'Inter',fontSize:14,color,wrap:true});

  if (deckType==='discover') {
    const TOT=9;
    // 1 — Title
    let sl=darkSlide(); addTag(sl,true); addPg(sl,1,TOT);
    sl.addText('Your Acquisition',{x:1,y:1.4,w:11.33,h:0.9,fontFace:'Playfair Display',fontSize:40,color:WHITE,bold:true,align:'center'});
    sl.addText('Discovery Session',{x:1,y:2.2,w:11.33,h:0.9,fontFace:'Playfair Display',fontSize:40,color:GOLD,bold:true,align:'center'});
    addRule(sl,6.2,3.2);
    sl.addText(nm,{x:1,y:3.5,w:11.33,h:0.5,fontFace:'Inter',fontSize:20,color:'BDC8D8',align:'center'});
    sl.addText(date,{x:1,y:3.95,w:11.33,h:0.4,fontFace:'Inter',fontSize:14,color:'8A9BB0',align:'center'});
    sl.addText("You're only one deal away from the wealth, time, and freedom you deserve.",
      {x:1,y:6.5,w:11.33,h:0.5,fontFace:'Playfair Display',fontSize:13,color:GOLD,italic:true,align:'center'});

    // 2 — About
    sl=lightSlide(); addTag(sl,false); addPg(sl,2,TOT);
    sl.addText('Who We Are',{x:0.6,y:0.5,w:9,h:0.8,fontFace:'Playfair Display',fontSize:36,color:NAVY,bold:true});
    addRule(sl,0.6,1.4);
    ['Mission: Help entrepreneurs build wealth and freedom through business acquisition.',
     'The QSI™ System — a proprietary acquisition process with 90%+ deal success.',
     'Industry average deal close rate: ~20%. Our rate: 90%+.',
     'Full-service: deal sourcing, valuation, SBA structuring, and close support.'].forEach((b,i)=>{
      addBullet(sl,b,0.6,1.65+i*0.75,7.5,MID);
    });
    sl.addShape(pptx.ShapeType.rect,{x:9,y:1.5,w:3.8,h:4.5,fill:{color:'E8E4DC'},line:{color:'D1CBC0'}});
    sl.addText('Team Photo',{x:9,y:3.5,w:3.8,h:0.5,fontFace:'Inter',fontSize:13,color:MUTED,align:'center'});

    // 3 — Why Acquisition (stat cards)
    sl=darkSlide(); addTag(sl,true); addPg(sl,3,TOT);
    sl.addText('The Wealth-Building Case for Acquisition',{x:0.6,y:0.5,w:12,h:0.8,fontFace:'Playfair Display',fontSize:32,color:WHITE,bold:true});
    addRule(sl,0.6,1.4);
    [[0.6,'{{STAT_1_VALUE}}','{{STAT_1_LABEL}}'],[4.8,'{{STAT_2_VALUE}}','{{STAT_2_LABEL}}'],[9,'{{STAT_3_VALUE}}','{{STAT_3_LABEL}}']].forEach(([x,v,l])=>{
      sl.addShape(pptx.ShapeType.rect,{x,y:1.7,w:3.6,h:4,fill:{color:'1E3560'},line:{color:GOLD}});
      sl.addText(v,{x,y:2.4,w:3.6,h:1,fontFace:'Playfair Display',fontSize:28,color:GOLD,bold:true,align:'center'});
      sl.addText(l,{x,y:3.8,w:3.6,h:1.2,fontFace:'Inter',fontSize:13,color:'BDC8D8',align:'center',wrap:true});
    });
    sl.addText('Fill in stats before presenting.',{x:0.6,y:6.9,w:12,h:0.3,fontFace:'Inter',fontSize:10,color:MUTED,italic:true});

    // 4 — SBA
    sl=lightSlide(); addTag(sl,false); addPg(sl,4,TOT);
    sl.addText('The SBA Advantage',{x:0.6,y:0.5,w:9,h:0.8,fontFace:'Playfair Display',fontSize:36,color:NAVY,bold:true});
    addRule(sl,0.6,1.4);
    ['Typical buyer down payment: 10% — leverage up to 90% with an SBA 7(a) loan.',
     'Loan terms: 10-year amortization at current SBA prime-plus rates.',
     'Eligible deal sizes: $500K–$5M+ acquisition price.',
     'Speed to close: 60–120 days from LOI to funded transaction.'].forEach((b,i)=>{
      addBullet(sl,b,0.6,1.65+i*0.9,11,MID);
    });
    sl.addText('Source: {{SBA_SOURCE}} — verify current terms before presenting.',{x:0.6,y:7.1,w:12,h:0.3,fontFace:'Inter',fontSize:10,color:MUTED,italic:true});

    // 5 — Vision
    sl=darkSlide(); addTag(sl,true); addPg(sl,5,TOT);
    sl.addText(`${nm}'s Vision`,{x:0.6,y:0.5,w:11,h:0.8,fontFace:'Playfair Display',fontSize:34,color:GOLD,bold:true});
    addRule(sl,0.6,1.4);
    sl.addShape(pptx.ShapeType.rect,{x:0.6,y:1.7,w:0.06,h:3.5,fill:{color:GOLD},line:{color:GOLD}});
    sl.addText(`"${vis}"`,{x:0.9,y:1.8,w:11,h:3.2,fontFace:'Playfair Display',fontSize:22,color:WHITE,italic:true,wrap:true,valign:'middle'});
    sl.addText(`Target timeline: ${tl}`,{x:0.6,y:6.8,w:8,h:0.4,fontFace:'Inter',fontSize:14,color:'8A9BB0'});

    // 6 — Gap
    sl=lightSlide(); addTag(sl,false); addPg(sl,6,TOT);
    sl.addText('Where You Are vs. Where You Want to Be',{x:0.6,y:0.5,w:12,h:0.8,fontFace:'Playfair Display',fontSize:32,color:NAVY,bold:true});
    addRule(sl,0.6,1.4);
    sl.addShape(pptx.ShapeType.rect,{x:0.6,y:1.7,w:5.5,h:4.2,fill:{color:'F0EDE7'},line:{color:'D1CBC0'}});
    sl.addText('TODAY',{x:0.8,y:1.9,w:5,h:0.4,fontFace:'Inter',fontSize:11,color:'888888',bold:true});
    sl.addText(curId,{x:0.8,y:2.4,w:5,h:3,fontFace:'Inter',fontSize:14,color:MID,wrap:true});
    sl.addShape(pptx.ShapeType.rect,{x:7,y:1.7,w:5.8,h:4.2,fill:{color:'F9F7F2'},line:{color:GOLD},lineSize:2});
    sl.addText('YOUR VISION',{x:7.2,y:1.9,w:5.2,h:0.4,fontFace:'Inter',fontSize:11,color:GOLD,bold:true});
    sl.addText(`"${vis}"`,{x:7.2,y:2.4,w:5.2,h:3,fontFace:'Playfair Display',fontSize:16,color:NAVY,italic:true,wrap:true});
    sl.addText(`${gapAmt} opportunity cost of staying put`,{x:0.6,y:6.3,w:12,h:0.6,fontFace:'Inter',fontSize:18,color:NAVY,bold:true,align:'center'});

    // 7 — Path
    sl=darkSlide(); addTag(sl,true); addPg(sl,7,TOT);
    sl.addText('The Acquisition Path',{x:0.6,y:0.5,w:12,h:0.8,fontFace:'Playfair Display',fontSize:36,color:WHITE,bold:true});
    addRule(sl,0.6,1.4);
    [['01','Search','Define your buybox, we source matched opportunities.'],
     ['02','Qualify','QSI™ valuation, due diligence, and deal review.'],
     ['03','Structure','SBA financing, seller carry, and deal architecture.'],
     ['04','Close','LOI to funded close — 60–120 day target.']].forEach(([n,lbl,desc],i)=>{
      const x=0.6+i*3.2;
      sl.addText(n,{x,y:1.8,w:3,h:1,fontFace:'Playfair Display',fontSize:36,color:GOLD,bold:true,align:'center'});
      sl.addText(lbl,{x,y:2.8,w:3,h:0.5,fontFace:'Inter',fontSize:16,color:WHITE,bold:true,align:'center'});
      sl.addText(desc,{x,y:3.4,w:3,h:1.5,fontFace:'Inter',fontSize:13,color:'8A9BB0',align:'center',wrap:true});
    });

    // 8 — Next
    const devDate = buyer.discover.nextSteps.developDate || '{{Schedule your Develop Call}}';
    sl=lightSlide(); addTag(sl,false); addPg(sl,8,TOT);
    sl.addText('What Happens Next',{x:0.6,y:0.5,w:11,h:0.8,fontFace:'Playfair Display',fontSize:36,color:NAVY,bold:true});
    addRule(sl,0.6,1.4);
    [`Complete your Buybox — we use it to match you to opportunities.`,
     `We research matched opportunities based on your criteria.`,
     `Strategy session scheduled: ${devDate}`].forEach((item,i)=>{
      sl.addText(String(i+1),{x:0.6,y:1.8+i*1.1,w:0.5,h:0.5,fontFace:'Inter',fontSize:14,color:GOLD,bold:true,align:'center'});
      sl.addText(item,{x:1.3,y:1.8+i*1.1,w:10.5,h:0.75,fontFace:'Inter',fontSize:15,color:MID,wrap:true,valign:'middle'});
    });
    sl.addText('No commitment. No pressure. Just clarity.',{x:0.6,y:6.3,w:12,h:0.6,fontFace:'Playfair Display',fontSize:18,color:NAVY,italic:true,align:'center'});

    // 9 — Close
    sl=darkSlide(); addPg(sl,9,TOT);
    sl.addText('THE DEAL TEAM | PETERSON ACQUISITIONS',{x:1,y:1.5,w:11.33,h:0.5,fontFace:'Playfair Display',fontSize:18,color:GOLD,bold:true,align:'center',charSpacing:3});
    addRule(sl,6.2,2.3);
    sl.addText('"You\'re only one deal away from the wealth, time, and freedom you deserve."',
      {x:1.5,y:2.6,w:10.33,h:2,fontFace:'Playfair Display',fontSize:20,color:WHITE,italic:true,align:'center',wrap:true});
    sl.addText('Michael Moore · The Deal Team · michael@thedealteam.co',
      {x:1,y:6.4,w:11.33,h:0.4,fontFace:'Inter',fontSize:13,color:'8A9BB0',align:'center'});

    await pptx.writeFile({fileName:`Discover_Deck_${nm.replace(/\s+/g,'_')}.pptx`});

  } else {
    // Develop deck (10 slides) — abbreviated PPTX version
    const TOT=10; const prog=buyer.develop.programSelected||'{{Program}}';
    const ppRaw=parseFloat(String(buyer.develop.purchasePriceRange||'').replace(/[^0-9.]/g,''))||0;
    const sdeRaw=parseFloat(String(buyer.develop.projectedSDE||'').replace(/[^0-9.]/g,''))||0;
    const dp=ppRaw>0?Math.round(ppRaw*0.10):0;
    const roi3=ppRaw>0&&sdeRaw>0?Math.round((sdeRaw*3/Math.max(dp,1)-1)*100):0;

    // 1
    let sl=darkSlide(); addTag(sl,true); addPg(sl,1,TOT);
    sl.addText('Your Acquisition',{x:1,y:1.4,w:11.33,h:0.9,fontFace:'Playfair Display',fontSize:40,color:WHITE,bold:true,align:'center'});
    sl.addText('Strategy Session',{x:1,y:2.2,w:11.33,h:0.9,fontFace:'Playfair Display',fontSize:40,color:GOLD,bold:true,align:'center'});
    addRule(sl,6.2,3.2);
    sl.addText(nm,{x:1,y:3.5,w:11.33,h:0.5,fontFace:'Inter',fontSize:20,color:'BDC8D8',align:'center'});
    sl.addText(date,{x:1,y:3.95,w:11.33,h:0.4,fontFace:'Inter',fontSize:14,color:'8A9BB0',align:'center'});
    // 2
    sl=lightSlide(); addTag(sl,false); addPg(sl,2,TOT);
    sl.addText('Your Vision Recap',{x:0.6,y:0.5,w:11,h:0.8,fontFace:'Playfair Display',fontSize:36,color:NAVY,bold:true});
    addRule(sl,0.6,1.4);
    sl.addShape(pptx.ShapeType.rect,{x:0.6,y:1.7,w:0.06,h:2.5,fill:{color:GOLD},line:{color:GOLD}});
    sl.addText(`"${vis}"`,{x:0.9,y:1.8,w:11,h:2.5,fontFace:'Playfair Display',fontSize:20,color:NAVY,italic:true,wrap:true});
    sl.addText("Here's what we found →",{x:0.6,y:6.6,w:12,h:0.5,fontFace:'Inter',fontSize:16,color:NAVY,bold:true});
    // 3
    sl=darkSlide(); addTag(sl,true); addPg(sl,3,TOT);
    sl.addText('We Researched Your Market',{x:0.6,y:0.5,w:11,h:0.8,fontFace:'Playfair Display',fontSize:36,color:WHITE,bold:true});
    addRule(sl,0.6,1.4);
    sl.addText('Based on your buybox criteria, we identified opportunities matching your target acquisition profile.',
      {x:0.6,y:1.8,w:11,h:2,fontFace:'Inter',fontSize:16,color:'BDC8D8',wrap:true,lineSpacingMultiple:1.5});
    sl.addText('Here are the opportunities we identified →',{x:0.6,y:6.4,w:11,h:0.5,fontFace:'Inter',fontSize:14,color:'8A9BB0',italic:true});

    // 4-6 — Deal Options
    buyer.develop.dealOptions.forEach((d,i)=>{
      sl=lightSlide(); addTag(sl,false); addPg(sl,4+i,TOT);
      sl.addText(`Deal Option ${i+1}`,{x:0.6,y:0.3,w:11,h:0.7,fontFace:'Playfair Display',fontSize:30,color:NAVY,bold:true});
      if(d.businessType) sl.addText(d.businessType,{x:0.6,y:0.95,w:8,h:0.4,fontFace:'Inter',fontSize:16,color:GOLD,bold:true});
      addRule(sl,0.6,1.45);
      const fields=[['Revenue',d.revenue||'{{Revenue}}'],['SDE',d.sde||'{{SDE}}'],['Asking Price',d.askingPrice||'{{Asking Price}}'],
                    ['Down Payment',d.downPayment||'{{Down}}'],['Deal Structure',d.dealStructure||'{{Structure}}'],['SBA Terms',d.sbaTerms||'{{SBA Terms}}']];
      fields.forEach(([lbl,val],fi)=>{
        const col=fi<3?0:1, row=fi%3;
        const x=col===0?0.6:6.5, y=1.75+row*1.0;
        sl.addText(lbl,{x,y,w:5.5,h:0.3,fontFace:'Inter',fontSize:10,color:'888888',bold:true});
        sl.addText(val,{x,y:y+0.3,w:5.5,h:0.55,fontFace:'Courier New',fontSize:15,color:NAVY,bold:true});
      });
      sl.addText(`Why This Fits ${nm}'s Profile`,{x:0.6,y:5.0,w:12,h:0.4,fontFace:'Inter',fontSize:12,color:GOLD,bold:true});
      sl.addText(d.whyFit||`{{Advisor: explain why this deal matches ${nm}'s buybox, vision, and capacity.}}`,
        {x:0.6,y:5.45,w:12,h:1.5,fontFace:'Inter',fontSize:14,color:MID,wrap:true});
    });

    // 7 — QSI
    sl=darkSlide(); addTag(sl,true); addPg(sl,7,TOT);
    sl.addText('What Protects You Through This Process',{x:0.6,y:0.4,w:11,h:0.8,fontFace:'Playfair Display',fontSize:32,color:WHITE,bold:true});
    addRule(sl,0.6,1.35);
    [['Confidentiality','Every step is managed with full discretion. Your identity is protected until you choose to move forward.'],
     ['Control','You set the criteria. We filter the deals. You only see opportunities that match your buybox.'],
     ['Certainty','The QSI™ system eliminates the variables that kill 80% of deals. Our close rate speaks for itself.']].forEach(([h,b],i)=>{
      const x=0.6+i*4.2;
      sl.addShape(pptx.ShapeType.rect,{x,y:1.7,w:4,h:4.5,fill:{color:'1E3560'},line:{color:GOLD}});
      sl.addText(h,{x,y:2.0,w:4,h:0.7,fontFace:'Playfair Display',fontSize:20,color:GOLD,bold:true,align:'center'});
      sl.addText(b,{x,y:2.8,w:4,h:3,fontFace:'Inter',fontSize:13,color:'BDC8D8',align:'center',wrap:true});
    });

    // 8 — Investment
    sl=lightSlide(); addTag(sl,false); addPg(sl,8,TOT);
    sl.addText('This Is What the Path Forward Looks Like',{x:0.6,y:0.4,w:11,h:0.8,fontFace:'Playfair Display',fontSize:32,color:NAVY,bold:true});
    addRule(sl,0.6,1.35);
    sl.addText(`Program: ${prog} · Fee: ${buyer.develop.feeStructure||'{{FEE_STRUCTURE}}'}`,
      {x:0.6,y:1.55,w:12,h:0.4,fontFace:'Inter',fontSize:14,color:'555555'});
    [['Purchase Price',ppRaw>0?`$${ppRaw.toLocaleString()}`:'{{Purchase Price}}',false],
     ['Buyer Down Payment (~10%)',dp>0?`$${dp.toLocaleString()}`:'{{Down Payment}}',false],
     ['Projected Annual SDE',sdeRaw>0?`$${sdeRaw.toLocaleString()}`:'{{SDE}}',false],
     ['3-Year SDE Return',sdeRaw>0?`$${(sdeRaw*3).toLocaleString()}`:'{{3yr Return}}',true],
     ['3-Year ROI on Down',roi3>0?`${roi3}%`:'{{ROI %}}',true]].forEach(([lbl,val,green],i)=>{
      sl.addText(lbl,{x:0.6,y:2.2+i*0.82,w:8,h:0.5,fontFace:'Inter',fontSize:14,color:'555555',valign:'middle'});
      sl.addText(val,{x:9.5,y:2.2+i*0.82,w:3.5,h:0.5,fontFace:'Courier New',fontSize:16,color:green?'059669':NAVY,bold:true,align:'right',valign:'middle'});
    });

    // 9 — Decision
    sl=darkSlide(); addTag(sl,true); addPg(sl,9,TOT);
    sl.addText('What Would You Like to Do?',{x:0.6,y:0.5,w:12,h:0.8,fontFace:'Playfair Display',fontSize:34,color:GOLD,bold:true,align:'center'});
    addRule(sl,6.2,1.5);
    sl.addShape(pptx.ShapeType.rect,{x:0.4,y:2.0,w:5.8,h:4.5,fill:{color:'1A2545'},line:{color:'2d3748'}});
    sl.addText('STAY ON CURRENT PATH',{x:0.5,y:2.2,w:5.6,h:0.4,fontFace:'Inter',fontSize:11,color:MUTED,bold:true,align:'center'});
    ['Continue trading time for income','Gap between vision and reality widens','Capital stays at sub-7% returns'].forEach((b,i)=>{
      sl.addText('• '+b,{x:0.7,y:2.9+i*0.7,w:5.2,h:0.55,fontFace:'Inter',fontSize:13,color:MUTED,wrap:true});
    });
    sl.addShape(pptx.ShapeType.rect,{x:7.1,y:2.0,w:5.8,h:4.5,fill:{color:'1A3020'},line:{color:GOLD},lineSize:2});
    sl.addText('TAKE THE ACQUISITION PATH',{x:7.2,y:2.2,w:5.6,h:0.4,fontFace:'Inter',fontSize:11,color:GOLD,bold:true,align:'center'});
    ['Own a cash-flowing business within 90–120 days','Deploy capital at 3×+ returns on SDE','Step into your future identity — now'].forEach((b,i)=>{
      sl.addText('• '+b,{x:7.3,y:2.9+i*0.7,w:5.2,h:0.55,fontFace:'Inter',fontSize:13,color:WHITE,wrap:true});
    });

    // 10 — Close
    sl=darkSlide(); addPg(sl,10,TOT);
    sl.addText('THE DEAL TEAM | PETERSON ACQUISITIONS',{x:1,y:1.5,w:11.33,h:0.5,fontFace:'Playfair Display',fontSize:18,color:GOLD,bold:true,align:'center',charSpacing:3});
    addRule(sl,6.2,2.3);
    sl.addText('"You\'re only one deal away from the wealth, time, and freedom you deserve."',
      {x:1.5,y:2.6,w:10.33,h:2,fontFace:'Playfair Display',fontSize:20,color:WHITE,italic:true,align:'center',wrap:true});
    sl.addText(`Next step: ${buyer.develop.nextAction||'{{Next Action}}'}  ${buyer.develop.nextActionDate||''}`,
      {x:1,y:6.4,w:11.33,h:0.4,fontFace:'Inter',fontSize:13,color:'8A9BB0',align:'center'});

    await pptx.writeFile({fileName:`Develop_Deck_${nm.replace(/\s+/g,'_')}.pptx`});
  }
}

// ─── Slide Preview Modal ───────────────────────────────────────────────────────

function SlidePreviewModal({deckType, buyer, title, onClose, onDownload, downloading}) {
  // Build slides during render (not in event handler) so React can catch errors
  let slides = [];
  let buildError = null;
  try {
    slides = deckType === 'discover' ? buildDiscoverSlides(buyer) : buildDevelopSlides(buyer);
  } catch(e) {
    buildError = e.message || String(e);
  }

  const [idx,setIdx]  = useState(0);
  const [anim,setAnim]= useState('');

  const go = (newIdx) => {
    if (newIdx===idx || !slides.length) return;
    const d = newIdx>idx?'right':'left';
    setAnim(d==='right'?'bs-slide-anim-right':'bs-slide-anim-left');
    setIdx(newIdx);
    setTimeout(()=>setAnim(''),400);
  };

  useEffect(()=>{
    const h = e=>{
      if(e.key==='ArrowRight'||e.key==='ArrowDown') go(Math.min(idx+1,slides.length-1));
      if(e.key==='ArrowLeft' ||e.key==='ArrowUp')   go(Math.max(idx-1,0));
      if(e.key==='Escape') onClose();
    };
    window.addEventListener('keydown',h);
    return ()=>window.removeEventListener('keydown',h);
  },[idx, slides.length, onClose]);

  const modal = (
    <div className="bs-modal-overlay">
      <div className="bs-modal-topbar">
        <span className="bs-modal-title">{title}</span>
        <button className="bs-modal-dl-btn" onClick={onDownload} disabled={downloading}>
          {downloading ? '⏳ Generating…' : '⬇ Download .pptx'}
        </button>
        <button className="bs-modal-close" onClick={onClose}>✕</button>
      </div>
      {buildError ? (
        <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',
                     flexDirection:'column',gap:16,color:'#ef4444',fontFamily:'Inter,sans-serif'}}>
          <div style={{fontSize:18,fontWeight:600}}>⚠ Slide build failed</div>
          <div style={{fontSize:13,color:'#94a3b8',maxWidth:500,textAlign:'center'}}>{buildError}</div>
          <button className="bs-btn bs-btn-danger" onClick={onClose}>Close</button>
        </div>
      ) : (
        <>
          <div className="bs-slide-stage">
            <SlideCanvas key={idx} animClass={anim}>
              {slides[idx]}
            </SlideCanvas>
          </div>
          <div className="bs-modal-nav">
            <button className="bs-modal-nav-btn" onClick={()=>go(Math.max(idx-1,0))} disabled={idx===0}>←</button>
            <span className="bs-slide-counter">{idx+1} / {slides.length}</span>
            <button className="bs-modal-nav-btn" onClick={()=>go(Math.min(idx+1,slides.length-1))} disabled={idx===slides.length-1}>→</button>
          </div>
        </>
      )}
    </div>
  );

  // Portal into document.body to escape portal-shell overflow/stacking context
  return createPortal(modal, document.body);
}

// ─── Objection Engine ─────────────────────────────────────────────────────────

function ObjectionEngine({buyer, activeObjTags, develop, onUpdateDevelop}) {
  const tags = activeObjTags.length ? activeObjTags : OBJECTION_TAGS;
  return (
    <div>
      <div className="bs-warn" style={{marginBottom:12}}>
        Draft — Review before use. Personalization tokens auto-filled from buyer data.
      </div>
      {tags.map(tag=>{
        const tmpl = objTemplate(tag, buyer);
        if (!tmpl) return null;
        const addressed = develop.objectionAddressed?.[tag]||false;
        const note = develop.objectionNotes?.[tag]||'';
        return (
          <div className="bs-obj-card" key={tag}>
            <div className="bs-obj-header">
              <span className="bs-obj-tag">{tag}</span>
              <BsToggle value={addressed} label="Addressed"
                onChange={v=>onUpdateDevelop({
                  ...develop,
                  objectionAddressed:{...develop.objectionAddressed,[tag]:v}
                })}
              />
            </div>
            <div className="bs-obj-body">
              {[['ACKNOWLEDGE','--ack',tmpl.acknowledge],['REFRAME','--reframe',tmpl.reframe],['REDIRECT','--redirect',tmpl.redirect]].map(([lbl,mod,txt])=>(
                <div className="bs-obj-block" key={lbl}>
                  <div className={`bs-obj-block-lbl bs-obj-block-lbl${mod}`}>{lbl}</div>
                  <div className="bs-obj-block-text">{txt}</div>
                </div>
              ))}
              <div style={{marginTop:10}}>
                <label className="bs-label">Advisor notes</label>
                <textarea className="bs-textarea" style={{minHeight:56}} defaultValue={note}
                  onBlur={e=>onUpdateDevelop({
                    ...develop,
                    objectionNotes:{...develop.objectionNotes,[tag]:e.target.value}
                  })}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Buyer Intel Panel ────────────────────────────────────────────────────────

function BuyerIntelPanel({buyer, onUpdate}) {
  const {intel} = buyer;
  const [inferring,setInferring] = useState(false);
  const upd = f => onUpdate({...buyer, intel:{...intel,...f}});

  const runInference = () => {
    setInferring(true);
    const inf = inferPersonality(buyer);
    if (inf.type && !intel.personalityOverridden) {
      upd({personalityType:inf.type, personalityRationale:inf.rationale});
    }
    setInferring(false);
  };

  const scoreColor = v => v>=8?'#2eb860':v>=5?'#C9A84C':'#ef4444';

  return (
    <div className="bs-card">
      <div className="bs-card-header">
        <span className="bs-card-title">Buyer Intel</span>
        {intel.name && (
          <span style={{fontFamily:'Inter,sans-serif',fontSize:13,color:'#94a3b8'}}>
            {intel.name}
            {intel.personalityType && (
              <span className="bs-archetype-badge" style={{marginLeft:12}}>
                {intel.personalityType}
              </span>
            )}
          </span>
        )}
      </div>
      <div className="bs-card-body">
        {/* Contact row */}
        <div className="bs-grid-3" style={{marginBottom:14}}>
          {[['Name','name','text'],['Phone','phone','tel'],['Email','email','email']].map(([lbl,key,type])=>(
            <BsField key={key} label={lbl}>
              <input className="bs-input" type={type} defaultValue={intel[key]}
                onBlur={e=>upd({[key]:e.target.value})} placeholder={lbl}/>
            </BsField>
          ))}
        </div>
        <div className="bs-grid-4" style={{marginBottom:14}}>
          <BsField label="LinkedIn URL" style={{gridColumn:'span 2'}}>
            <input className="bs-input" type="url" defaultValue={intel.linkedin}
              onBlur={e=>upd({linkedin:e.target.value})} placeholder="https://linkedin.com/in/..."/>
          </BsField>
          <BsField label="SBA Status">
            <select className="bs-select" value={intel.sbaStatus} onChange={e=>upd({sbaStatus:e.target.value})}>
              {SBA_STATUS_OPTIONS.map(o=><option key={o}>{o}</option>)}
            </select>
          </BsField>
          <BsField label={`SBA Amount${intel.sbaStatus==='Approved'?' (Approved)':''}`}>
            <input className="bs-input" type="text" defaultValue={intel.sbaAmount}
              disabled={intel.sbaStatus==='None'}
              onBlur={e=>upd({sbaAmount:e.target.value})} placeholder="$0"/>
          </BsField>
        </div>
        <div style={{display:'flex',gap:20,alignItems:'center',flexWrap:'wrap',marginBottom:16}}>
          <BsToggle value={intel.resumeOnFile}  onChange={v=>upd({resumeOnFile:v})}  label="Resume on File"/>
          <BsToggle value={intel.buyboxComplete} onChange={v=>upd({buyboxComplete:v})} label="Buybox Complete"/>
        </div>

        {/* Personality */}
        <hr className="bs-divider"/>
        <div className="bs-grid-2" style={{marginBottom:12}}>
          <BsField label="Personality Archetype">
            <select className="bs-select" value={intel.personalityType}
              onChange={e=>upd({personalityType:e.target.value,personalityOverridden:!!e.target.value})}>
              {PERSONALITY_OPTIONS.map(o=><option key={o} value={o}>{o||'— Auto-infer —'}</option>)}
            </select>
          </BsField>
          <div style={{display:'flex',alignItems:'flex-end',gap:8}}>
            <button className="bs-btn bs-btn-secondary bs-btn-sm" onClick={runInference} disabled={inferring}>
              {inferring?'…':'🔍 Re-Infer from Notes'}
            </button>
          </div>
        </div>
        {intel.personalityRationale && (
          <div style={{fontFamily:'Inter,sans-serif',fontSize:12,color:'#64748b',fontStyle:'italic',marginBottom:12}}>
            Auto-inferred: {intel.personalityRationale}
          </div>
        )}

        {/* 3M Scores */}
        <hr className="bs-divider"/>
        <div style={{fontSize:11,fontWeight:700,color:'#C9A84C',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:12}}>3M Scores</div>
        <div className="bs-grid-3">
          {[['Mindset','mindset','Thinking pattern & belief system'],['Model','model','Business acumen & deal literacy'],['Momentum','momentum','Urgency & readiness to act']].map(([lbl,key,sub])=>(
            <div key={key}>
              <div className="bs-label">{lbl}</div>
              <div style={{fontFamily:'Courier New,monospace',fontSize:24,fontWeight:700,color:scoreColor(intel[key]),marginBottom:4}}>
                {intel[key]}/10
              </div>
              <input type="range" min={1} max={10} value={intel[key]} className="bs-slider"
                onChange={e=>upd({[key]:+e.target.value})}/>
              <div className="bs-slider-labels"><span>{sub}</span></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Discover Stage ───────────────────────────────────────────────────────────

function DiscoverStage({buyer, onUpdate, buyerId}) {
  const d = buyer.discover;
  const updD = patch => onUpdate({...buyer, discover:{...d,...patch}});

  const [desireSum,setDesireSum] = useState(d.desireSummary||'');
  const [gapText,setGapText]     = useState(d.gapAnalysis||'');

  const doSummarize = () => {
    const s = summarizeDesire(d.desire); setDesireSum(s); updD({desireSummary:s});
  };
  const doGap = () => {
    const g = buildGapText(buyer); setGapText(g); updD({gapAnalysis:g});
  };
  const markComplete = () => updD({status:'complete'});

  return (
    <div>
      {/* Section 0 — Call Frame */}
      <BsAccordion number={0} title="Call Frame" sub="Pre-call setup checklist" key={buyerId+'cf'}>
        <div style={{marginBottom:14}}>
          {[['rapport','Rapport established'],['agenda','Agenda set (exploration call, not a pitch)'],['permission','Permission to ask direct questions secured']].map(([k,lbl])=>(
            <label key={k} className="bs-check-row">
              <input type="checkbox" checked={d.callFrame[k]||false}
                onChange={e=>updD({callFrame:{...d.callFrame,[k]:e.target.checked}})}/>
              <span className="bs-check-label">{lbl}</span>
            </label>
          ))}
        </div>
        <BsField label="Opening angle / icebreaker note">
          <textarea className="bs-textarea" defaultValue={d.callFrame.icebreaker} key={buyerId+'ice'}
            onBlur={e=>updD({callFrame:{...d.callFrame,icebreaker:e.target.value}})}
            placeholder="Note any intel from LinkedIn, resume, or prior conversation to open warmly…"/>
        </BsField>
      </BsAccordion>

      {/* Section 1 — Desire */}
      <BsAccordion number={1} title="Desire" sub="What brought them here?" key={buyerId+'des'}>
        <div className="bs-prompt">"What made you book and show up on this call today?"</div>
        <textarea className="bs-textarea bs-textarea--large" defaultValue={d.desire} key={buyerId+'d1'}
          onBlur={e=>updD({desire:e.target.value})}
          placeholder="Capture buyer's verbatim language — their exact words matter…"/>
        <div style={{display:'flex',gap:10,marginTop:10,alignItems:'center'}}>
          <button className="bs-btn bs-btn-secondary bs-btn-sm" onClick={doSummarize}>
            ⚡ Summarize Desire Theme
          </button>
          {desireSum && <div className="bs-summary-box">{desireSum}</div>}
        </div>
      </BsAccordion>

      {/* Section 2 — Identity */}
      <BsAccordion number={2} title="Identity" sub="Vision, timeline, lifestyle" key={buyerId+'id'}>
        <div className="bs-prompt">"What do you really want? What's the vision for your life that excites you?"</div>
        <textarea className="bs-textarea bs-textarea--large" defaultValue={d.identity.statement} key={buyerId+'id1'}
          onBlur={e=>updD({identity:{...d.identity,statement:e.target.value}})}
          placeholder="Buyer's vision statement in their own words…"/>
        <div className="bs-grid-3" style={{marginTop:14}}>
          <BsField label="Target Timeline">
            <select className="bs-select" value={d.identity.timeline}
              onChange={e=>updD({identity:{...d.identity,timeline:e.target.value}})}>
              {TIMELINE_OPTIONS.map(o=><option key={o}>{o}</option>)}
            </select>
          </BsField>
          <BsField label="Lifestyle Goal" style={{gridColumn:'span 2'}}>
            <input className="bs-input" defaultValue={d.identity.lifestyle} key={buyerId+'ls'}
              onBlur={e=>updD({identity:{...d.identity,lifestyle:e.target.value}})}
              placeholder="e.g. Replace W-2, be home by 3pm, travel 10 weeks/year…"/>
          </BsField>
        </div>
      </BsAccordion>

      {/* Section 3 — Block */}
      <BsAccordion number={3} title="Block" sub="What's been stopping them?" key={buyerId+'blk'}>
        <div className="bs-prompt">"What has stopped you or held you back from getting there?"</div>
        <textarea className="bs-textarea bs-textarea--large" defaultValue={d.block.text} key={buyerId+'bl1'}
          onBlur={e=>updD({block:{...d.block,text:e.target.value}})}
          placeholder="Their exact language — used to personalize objection scripts…"/>
        <div style={{marginTop:14}}>
          <div className="bs-label">Objection Tags (pre-populates Objection Engine)</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:8,marginTop:6}}>
            {OBJECTION_TAGS.map(tag=>{
              const checked=(d.block.objections||[]).includes(tag);
              return (
                <label key={tag} style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',
                  background:checked?'rgba(201,168,76,0.12)':'#161b27',
                  border:`1px solid ${checked?'rgba(201,168,76,0.4)':'#1e2d45'}`,
                  borderRadius:20,padding:'5px 12px',transition:'all 0.12s'}}>
                  <input type="checkbox" style={{accentColor:'#C9A84C'}} checked={checked}
                    onChange={e=>{
                      const objs=d.block.objections||[];
                      updD({block:{...d.block,objections:e.target.checked?[...objs,tag]:objs.filter(t=>t!==tag)}});
                    }}/>
                  <span style={{fontFamily:'Inter,sans-serif',fontSize:13,color:checked?'#C9A84C':'#94a3b8',fontWeight:600}}>{tag}</span>
                </label>
              );
            })}
          </div>
        </div>
      </BsAccordion>

      {/* Section 4 — Capacity */}
      <BsAccordion number={4} title="Capacity" sub="Capital, commitment, timeline" key={buyerId+'cap'}>
        <div className="bs-prompt">"How committed are you to changing this about your life — right now?"</div>
        <div style={{marginBottom:16}}>
          <div className="bs-label">Commitment Level</div>
          <div style={{fontFamily:'Courier New,monospace',fontSize:24,fontWeight:700,color:'#C9A84C',marginBottom:4}}>
            {d.capacity.commitment}/10
          </div>
          <input type="range" min={1} max={10} value={d.capacity.commitment} className="bs-slider"
            onChange={e=>updD({capacity:{...d.capacity,commitment:+e.target.value}})}/>
          <div className="bs-slider-labels"><span>1 — Just exploring</span><span>10 — Ready to move now</span></div>
        </div>
        <div className="bs-grid-3" style={{marginTop:14}}>
          <BsField label="Commitment Statement">
            <textarea className="bs-textarea" style={{minHeight:72}} defaultValue={d.capacity.statement} key={buyerId+'cs'}
              onBlur={e=>updD({capacity:{...d.capacity,statement:e.target.value}})}
              placeholder="Buyer's exact words about readiness…"/>
          </BsField>
          <BsField label="Liquid Capital Available">
            <input className="bs-input" defaultValue={d.capacity.capital} key={buyerId+'cap2'}
              onBlur={e=>updD({capacity:{...d.capacity,capital:e.target.value}})}
              placeholder="$150,000"/>
          </BsField>
          <BsField label="Timeline to Close">
            <select className="bs-select" value={d.capacity.timelineToClose}
              onChange={e=>updD({capacity:{...d.capacity,timelineToClose:e.target.value}})}>
              {CLOSE_TL_OPTIONS.map(o=><option key={o}>{o}</option>)}
            </select>
          </BsField>
        </div>
      </BsAccordion>

      {/* Section 5 — Future */}
      <BsAccordion number={5} title="Future" sub="Identity gap — who must they become?" key={buyerId+'fut'}>
        <div className="bs-prompt">"Are you making decisions based on who you are today — or who you need to become to realize your vision?"</div>
        <textarea className="bs-textarea bs-textarea--large" defaultValue={d.future.response} key={buyerId+'fr'}
          onBlur={e=>updD({future:{...d.future,response:e.target.value}})}
          placeholder="Buyer's response in full…"/>
        <div className="bs-grid-2" style={{marginTop:14}}>
          <BsField label="Current Identity">
            <input className="bs-input" defaultValue={d.future.currentIdentity} key={buyerId+'ci'}
              onBlur={e=>updD({future:{...d.future,currentIdentity:e.target.value}})}
              placeholder="e.g. Corporate VP, constrained, time-poor…"/>
          </BsField>
          <BsField label="Future Identity">
            <input className="bs-input" defaultValue={d.future.futureIdentity} key={buyerId+'fi'}
              onBlur={e=>updD({future:{...d.future,futureIdentity:e.target.value}})}
              placeholder="e.g. Business owner, financially free, present father…"/>
          </BsField>
        </div>
      </BsAccordion>

      {/* Section 6 — Gap Reveal */}
      <BsAccordion number={6} title="Gap Reveal" sub="Auto-generated analysis + next steps" key={buyerId+'gap'}>
        <button className="bs-btn bs-btn-gold" style={{marginBottom:14}} onClick={doGap}>
          ⚡ Generate Gap Analysis
        </button>
        {gapText && (
          <div className="bs-gap-card" style={{marginBottom:16}}>
            <span className="bs-draft-badge">DRAFT — Review before use</span>
            <div className="bs-label" style={{color:'#2eb860',marginBottom:10}}>GAP ANALYSIS — {buyer.intel.name||'Buyer'}</div>
            <div className="bs-gap-text">{gapText}</div>
          </div>
        )}

        <div style={{fontSize:11,fontWeight:700,color:'#2eb860',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:10}}>Next Steps</div>
        {[['buybox','Send Buybox form'],['resume','Request resume'],['sba','Request SBA pre-approval or referral']].map(([k,lbl])=>(
          <label key={k} className="bs-check-row">
            <input type="checkbox" checked={d.nextSteps[k]||false}
              onChange={e=>updD({nextSteps:{...d.nextSteps,[k]:e.target.checked}})}/>
            <span className="bs-check-label">{lbl}</span>
          </label>
        ))}
        <div className="bs-grid-2" style={{marginTop:12}}>
          <BsField label="Schedule Develop Call">
            <input className="bs-input" type="date" defaultValue={d.nextSteps.developDate} key={buyerId+'dd'}
              onBlur={e=>updD({nextSteps:{...d.nextSteps,developDate:e.target.value}})}/>
          </BsField>
          <BsField label="Prep Notes for Develop">
            <textarea className="bs-textarea" style={{minHeight:60}} defaultValue={d.nextSteps.prepNotes} key={buyerId+'pn'}
              onBlur={e=>updD({nextSteps:{...d.nextSteps,prepNotes:e.target.value}})}/>
          </BsField>
        </div>

        {/* Objection Engine — expanded from tagged objections */}
        {(d.block.objections||[]).length > 0 && (
          <div style={{marginTop:20}}>
            <div style={{fontSize:11,fontWeight:700,color:'#C9A84C',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:10}}>
              Objection Engine — {d.block.objections.length} Tagged
            </div>
            <ObjectionEngine buyer={buyer} activeObjTags={d.block.objections}
              develop={buyer.develop} onUpdateDevelop={dev=>onUpdate({...buyer,develop:dev})}/>
          </div>
        )}

        <button className="bs-btn bs-btn-primary" style={{marginTop:16,width:'100%'}} onClick={markComplete}>
          ✓ Save & Mark Discover Complete
        </button>
      </BsAccordion>
    </div>
  );
}

// ─── Develop Stage ────────────────────────────────────────────────────────────

function DevelopStage({buyer, onUpdate, buyerId}) {
  const dv = buyer.develop;
  const updDv = patch => onUpdate({...buyer, develop:{...dv,...patch}});

  const capRaw = parseFloat(String(buyer.discover.capacity.capital||'').replace(/[^0-9.]/g,''))||0;
  const ppRaw  = parseFloat(String(dv.purchasePriceRange||'').replace(/[^0-9.]/g,''))||0;
  const sdeRaw = parseFloat(String(dv.projectedSDE||'').replace(/[^0-9.]/g,''))||0;
  const dp     = ppRaw>0?Math.round(ppRaw*0.10):0;
  const roi3   = dp>0&&sdeRaw>0?Math.round((sdeRaw*3/dp-1)*100):0;

  return (
    <div>
      {/* Section 1 — Updates */}
      <BsAccordion number={1} title="Updates Since Last Meeting" key={buyerId+'upd'}>
        <BsField label="Changes in situation or new intel">
          <textarea className="bs-textarea bs-textarea--large" defaultValue={dv.updates} key={buyerId+'u1'}
            onBlur={e=>updDv({updates:e.target.value})} placeholder="What changed? New information, mindset shifts, spouse conversation outcome…"/>
        </BsField>
        <div style={{marginTop:12}}>
          <BsToggle value={dv.buyboxSubmitted} onChange={v=>updDv({buyboxSubmitted:v})} label="Buybox Submitted"/>
        </div>
      </BsAccordion>

      {/* Section 2 — Gap Recap */}
      <BsAccordion number={2} title="Gap Recap" sub="From Discover session" key={buyerId+'grec'}>
        <div className="bs-gap-card" style={{marginBottom:12}}>
          <span className="bs-draft-badge">DRAFT</span>
          <div className="bs-gap-text">{buyer.discover.gapAnalysis || buildGapText(buyer)}</div>
        </div>
        <div style={{marginTop:12}}>
          <div style={{fontSize:11,fontWeight:700,color:'#C9A84C',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:10}}>Talking Points</div>
          {[
            `${buyer.intel.name||'Your client'}, when we spoke last, you told me you wanted ${buyer.discover.identity.statement||'{{vision}}'}. Has anything changed?`,
            `You shared that the gap between where you are and where you want to be is real — and the window is ${buyer.discover.identity.timeline||'12mo'}.`,
            `Today I want to show you what we found and give you a clear decision to make.`,
          ].map((tp,i)=>(
            <div key={i} style={{background:'#0a1628',border:'1px solid #1e2d45',borderRadius:6,padding:'10px 14px',marginBottom:8,
                                  fontFamily:'Inter,sans-serif',fontSize:13,color:'#e2e8f0',lineHeight:1.6}}>
              <span style={{color:'#C9A84C',fontWeight:700,marginRight:8}}>{i+1}.</span>{tp}
            </div>
          ))}
        </div>
      </BsAccordion>

      {/* Section 3 — Program Presentation */}
      <BsAccordion number={3} title="Program Presentation" key={buyerId+'prog'}>
        <div style={{marginBottom:14}}>
          <div className="bs-label">Select Program to Present</div>
          {[['listed','Listed Deal Match','Present from active inventory'],
            ['offmarket','Off-Market Sourcing Program','Custom search engagement'],
            ['sbafast','SBA Fast-Track Program','For pre-approved buyers ready to move']].map(([id,lbl,sub])=>(
            <label key={id} style={{display:'flex',alignItems:'flex-start',gap:10,cursor:'pointer',
              padding:'10px 14px',marginBottom:6,
              background:dv.programSelected===id?'rgba(201,168,76,0.08)':'#161b27',
              border:`1px solid ${dv.programSelected===id?'rgba(201,168,76,0.35)':'#1e2d45'}`,
              borderRadius:7,transition:'all 0.12s'}}>
              <input type="radio" style={{accentColor:'#C9A84C',marginTop:2}} checked={dv.programSelected===id}
                onChange={()=>updDv({programSelected:id})}/>
              <div>
                <div style={{fontFamily:'Inter,sans-serif',fontSize:14,fontWeight:600,color:'#e2e8f0'}}>{lbl}</div>
                <div style={{fontFamily:'Inter,sans-serif',fontSize:12,color:'#64748b'}}>{sub}</div>
              </div>
            </label>
          ))}
        </div>

        <div style={{marginBottom:14}}>
          <div className="bs-label">Benefit Bullets</div>
          {(dv.programBenefits||['','','']).map((b,i)=>(
            <div key={i} style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
              <div style={{width:6,height:6,borderRadius:3,background:'#C9A84C',flexShrink:0}}/>
              <input className="bs-input" defaultValue={b} key={buyerId+'pb'+i}
                onBlur={e=>{const arr=[...(dv.programBenefits||['','',''])];arr[i]=e.target.value;updDv({programBenefits:arr});}}
                placeholder={`Benefit ${i+1}…`}/>
            </div>
          ))}
        </div>

        <div className="bs-grid-3" style={{marginBottom:14}}>
          <BsField label="Fee Structure">
            <input className="bs-input" defaultValue={dv.feeStructure} key={buyerId+'fee'}
              onBlur={e=>updDv({feeStructure:e.target.value})} placeholder="{{FEE_STRUCTURE}}"/>
          </BsField>
          <BsField label="Timeline to Close">
            <select className="bs-select" value={dv.timelineToClose||''} onChange={e=>updDv({timelineToClose:e.target.value})}>
              <option value="">Select…</option>
              {CLOSE_TL_OPTIONS.map(o=><option key={o}>{o}</option>)}
            </select>
          </BsField>
          <BsField label="Purchase Price Range ($)">
            <input className="bs-input" defaultValue={dv.purchasePriceRange} key={buyerId+'pp'}
              onBlur={e=>updDv({purchasePriceRange:e.target.value})} placeholder="1500000"/>
          </BsField>
        </div>

        <div className="bs-grid-2" style={{marginBottom:14}}>
          <BsField label="Projected Annual SDE ($)">
            <input className="bs-input" defaultValue={dv.projectedSDE} key={buyerId+'sde'}
              onBlur={e=>updDv({projectedSDE:e.target.value})} placeholder="300000"/>
          </BsField>
          <div>
            <div className="bs-label">3-Year ROI Preview</div>
            <div style={{background:'#0a1628',border:'1px solid #1e2d45',borderRadius:6,padding:'10px 14px'}}>
              {[['Purchase Price',ppRaw>0?`$${ppRaw.toLocaleString()}`:'—'],['Down (~10%)',dp>0?`$${dp.toLocaleString()}`:'—'],['Annual SDE',sdeRaw>0?`$${sdeRaw.toLocaleString()}`:'—'],['3-Yr ROI',roi3>0?`${roi3}%`:'—']].map(([l,v])=>(
                <div key={l} style={{display:'flex',justifyContent:'space-between',fontFamily:'Inter,sans-serif',fontSize:13,
                                     borderBottom:'1px solid #1e2d45',padding:'5px 0'}}>
                  <span style={{color:'#64748b'}}>{l}</span>
                  <span style={{color:'#2eb860',fontFamily:'Courier New,monospace',fontWeight:700}}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Deal Options */}
        <div style={{marginTop:16}}>
          <div style={{fontSize:11,fontWeight:700,color:'#C9A84C',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:12}}>Deal Options (for Develop Deck Slides 4–6)</div>
          {(dv.dealOptions||[]).map((d,i)=>(
            <BsAccordion key={i} title={`Deal Option ${i+1}${d.businessType?' — '+d.businessType:''}`}>
              <div className="bs-grid-3" style={{marginBottom:10}}>
                {[['Business Type','businessType'],['Revenue ($)','revenue'],['SDE ($)','sde'],['Asking Price ($)','askingPrice'],['Deal Structure','dealStructure'],['Down Payment ($)','downPayment'],['SBA Terms','sbaTerms']].map(([lbl,key])=>(
                  <BsField key={key} label={lbl}>
                    <input className="bs-input" defaultValue={d[key]} key={buyerId+`do${i}${key}`}
                      onBlur={e=>{const arr=[...dv.dealOptions];arr[i]={...arr[i],[key]:e.target.value};updDv({dealOptions:arr});}}
                      placeholder={lbl}/>
                  </BsField>
                ))}
              </div>
              <BsField label={`Why This Fits ${buyer.intel.name||"Buyer"}'s Profile`}>
                <textarea className="bs-textarea" defaultValue={d.whyFit} key={buyerId+`dowf${i}`}
                  onBlur={e=>{const arr=[...dv.dealOptions];arr[i]={...arr[i],whyFit:e.target.value};updDv({dealOptions:arr});}}
                  placeholder="Explain alignment to buybox, vision, and capacity…"/>
              </BsField>
            </BsAccordion>
          ))}
        </div>
      </BsAccordion>

      {/* Section 4 — Decision */}
      <BsAccordion number={4} title="Secure the Decision" key={buyerId+'dec'}>
        <div className="bs-grid-2" style={{marginBottom:14}}>
          <BsField label="Decision Outcome">
            <select className="bs-select" value={dv.decisionOutcome} onChange={e=>updDv({decisionOutcome:e.target.value})}>
              {DECISION_OPTIONS.map(o=><option key={o} value={o}>{o||'— Select outcome —'}</option>)}
            </select>
          </BsField>
          <BsField label="Next Action Date">
            <input className="bs-input" type="date" defaultValue={dv.nextActionDate} key={buyerId+'nad'}
              onBlur={e=>updDv({nextActionDate:e.target.value})}/>
          </BsField>
        </div>
        <BsField label="Next Action">
          <textarea className="bs-textarea" defaultValue={dv.nextAction} key={buyerId+'na'}
            onBlur={e=>updDv({nextAction:e.target.value})} placeholder="What is the single committed next step?"/>
        </BsField>

        {dv.decisionOutcome==='Objection Raised' && (
          <div style={{marginTop:16}}>
            <div style={{fontSize:11,fontWeight:700,color:'#C9A84C',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:12}}>
              Objection Strategy Engine
            </div>
            <ObjectionEngine buyer={buyer} activeObjTags={buyer.discover.block.objections||[]}
              develop={dv} onUpdateDevelop={dev=>onUpdate({...buyer,develop:dev})}/>
          </div>
        )}

        <button className="bs-btn bs-btn-primary" style={{marginTop:16,width:'100%'}}
          onClick={()=>updDv({status:'complete'})}>
          ✓ Save & Mark Develop Complete
        </button>
      </BsAccordion>
    </div>
  );
}

// ─── Deploy Stage (Placeholder) ───────────────────────────────────────────────

function DeployStage({buyer, onUpdate, buyerId}) {
  const dp = buyer.deploy;
  const updDp = patch => onUpdate({...buyer, deploy:{...dp,...patch}});
  const prog = buyer.develop.programSelected;
  const progLabel = prog==='listed'?'Listed Deal Match':prog==='offmarket'?'Off-Market Sourcing':prog==='sbafast'?'SBA Fast-Track':'—';

  return (
    <div>
      <div className="bs-card">
        <div className="bs-card-header">
          <span className="bs-card-title">Active Buyer — {buyer.intel.name||'Unnamed'}</span>
          <span style={{background:'rgba(201,168,76,0.15)',border:'1px solid rgba(201,168,76,0.3)',borderRadius:4,
                        padding:'3px 10px',fontFamily:'Inter,sans-serif',fontSize:11,color:'#C9A84C',fontWeight:700}}>
            DEPLOY
          </span>
        </div>
        <div className="bs-card-body">
          <div style={{display:'flex',gap:24,marginBottom:20}}>
            <div><div className="bs-label">Enrolled Program</div>
              <div style={{fontFamily:'Inter,sans-serif',fontSize:16,fontWeight:600,color:'#e2e8f0'}}>{progLabel}</div></div>
            <div><div className="bs-label">Enrolled</div>
              <div style={{fontFamily:'Inter,sans-serif',fontSize:13,color:'#64748b'}}>
                {buyer.createdAt ? new Date(buyer.createdAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) : '—'}</div></div>
          </div>

          <div style={{fontSize:11,fontWeight:700,color:'#2eb860',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:12}}>
            Milestone Tracker
          </div>
          {MILESTONES.map((m,i)=>{
            const done=dp.milestones?.[m.id]||false;
            return (
              <label key={m.id} className="bs-milestone-row" style={{cursor:'pointer'}}>
                <div className={`bs-milestone-icon${done?' bs-milestone-icon--done':''}`}>
                  {done?'✓':i+1}
                </div>
                <span className={`bs-milestone-label${done?' bs-milestone-label--done':''}`}>{m.label}</span>
                <input type="checkbox" style={{marginLeft:'auto',accentColor:'#2eb860'}}
                  checked={done} onChange={e=>updDp({milestones:{...dp.milestones,[m.id]:e.target.checked}})}/>
              </label>
            );
          })}

          <hr className="bs-divider"/>
          <BsField label="Notes">
            <textarea className="bs-textarea" defaultValue={dp.notes} key={buyerId+'dpn'}
              onBlur={e=>updDp({notes:e.target.value})} placeholder="Deal progress, communication log, issues…"/>
          </BsField>

          <div style={{marginTop:16,textAlign:'center',background:'#0a1628',border:'1px solid #1e2d45',borderRadius:8,padding:'16px'}}>
            <div style={{fontFamily:'Inter,sans-serif',fontSize:13,color:'#64748b'}}>
              Advanced deal tracking features coming soon.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function BuyerStrategyApp() {
  const [appData,setAppData] = useState(()=>loadData());
  const {ready:pptxReady, error:pptxError, load:loadPptx} = usePptx();
  const [stage,setStage]       = useState('discover');
  const [preview,setPreview]   = useState(null); // {type:'discover'|'develop', slides:[]}
  const [downloading,setDl]    = useState(false);

  const lsWarn = !lsOk;

  // Persist whenever appData changes
  useEffect(()=>{ persist(appData); },[appData]);

  const activeBuyerId = appData.activeBuyerId;
  const buyer = activeBuyerId ? appData.buyers[activeBuyerId] : null;

  const setBuyer = useCallback((updatedBuyer) => {
    setAppData(prev=>{
      const next = {
        ...prev,
        buyers:{...prev.buyers, [activeBuyerId]: updatedBuyer}
      };
      // Re-infer personality on every save (non-overridden)
      if (!updatedBuyer.intel.personalityOverridden) {
        const inf = inferPersonality(updatedBuyer);
        if (inf.type) {
          next.buyers[activeBuyerId] = {
            ...updatedBuyer,
            intel:{...updatedBuyer.intel, personalityType:inf.type, personalityRationale:inf.rationale}
          };
        }
      }
      return next;
    });
  },[activeBuyerId]);

  const newBuyer = () => {
    const id = newId();
    setAppData(prev=>({
      ...prev,
      activeBuyerId:id,
      buyers:{...prev.buyers, [id]:defBuyer()}
    }));
    setStage('discover');
  };

  const deleteBuyer = () => {
    if (!activeBuyerId) return;
    const name = buyer?.intel?.name || 'this buyer';
    // Inline confirmation via state — no window.confirm
    if (!window.confirm(`Delete ${name}? This cannot be undone.`)) return;
    setAppData(prev=>{
      const next = {...prev, buyers:{...prev.buyers}};
      delete next.buyers[activeBuyerId];
      const remaining = Object.keys(next.buyers);
      next.activeBuyerId = remaining.length ? remaining[remaining.length-1] : null;
      return next;
    });
  };

  const openPreview = (type) => {
    if (!buyer) return;
    loadPptx();
    setPreview({type});
  };

  const handleDownload = async () => {
    if (!buyer || !pptxReady) return;
    setDl(true);
    try { await generatePptx(preview.type, buyer); }
    catch(e) { alert('PPTX generation failed: '+e.message); }
    setDl(false);
  };

  const buyerList = Object.entries(appData.buyers).map(([id,b])=>({id, name:b.intel.name||`New Buyer (${new Date(b.createdAt).toLocaleDateString('en-US',{month:'short',day:'numeric'})})`}));

  const dsStatus  = buyer ? stageStatus(buyer,'discover') : 'not_started';
  const dvStatus  = buyer ? stageStatus(buyer,'develop')  : 'not_started';

  return (
    <div className="bs-root" style={{padding:28}}>
      {/* Header */}
      <div style={{marginBottom:20}}>
        <div style={{fontSize:22,fontWeight:700,color:'#e2e8f0',marginBottom:4,fontFamily:'Inter,sans-serif'}}>
          Buyer Strategy
        </div>
        <div style={{fontSize:13,color:'#64748b',fontFamily:'Inter,sans-serif'}}>
          Discover → Develop → Deploy · The Deal Team | Peterson Acquisitions
        </div>
      </div>

      {/* Warnings */}
      {lsWarn && <div className="bs-warn">⚠ Session storage only — data will not persist after this session. (Private browsing or storage quota exceeded.)</div>}
      {pptxError && <div className="bs-error">⚠ Slide export unavailable — check your internet connection. HTML preview still works.</div>}

      {/* Buyer Selector */}
      <div className="bs-buyer-bar">
        <select className="bs-buyer-select" value={activeBuyerId||''}
          onChange={e=>{ setAppData(prev=>({...prev,activeBuyerId:e.target.value})); setStage('discover'); }}>
          {buyerList.length===0 && <option value="">No buyers yet</option>}
          {buyerList.map(b=><option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <button className="bs-btn bs-btn-primary bs-btn-sm" onClick={newBuyer}>+ New Buyer</button>
        {buyer && <button className="bs-btn bs-btn-danger bs-btn-sm" onClick={deleteBuyer}>Delete</button>}
      </div>

      {!buyer ? (
        <div style={{textAlign:'center',padding:'60px 20px',color:'#64748b',fontFamily:'Inter,sans-serif'}}>
          <div style={{fontSize:40,marginBottom:16}}>👤</div>
          <div style={{fontSize:18,fontWeight:600,marginBottom:8,color:'#94a3b8'}}>No buyer selected</div>
          <div style={{fontSize:14,marginBottom:20}}>Create a new buyer to begin a strategy session.</div>
          <button className="bs-btn bs-btn-primary" onClick={newBuyer}>+ Create First Buyer</button>
        </div>
      ) : (
        <>
          {/* Intel Panel */}
          <BuyerIntelPanel key={activeBuyerId} buyer={buyer} onUpdate={setBuyer}/>

          {/* Stage Nav */}
          <div className="bs-stage-nav">
            {[['discover','DISCOVER',dsStatus],['develop','DEVELOP',dvStatus],['deploy','DEPLOY','not_started']].map(([id,lbl,st])=>{
              const dot=stageDot(st);
              return (
                <button key={id} className={`bs-stage-btn${stage===id?' bs-stage-btn--active':''}`}
                  onClick={()=>setStage(id)}>
                  <span className="bs-stage-dot" style={{color:dot.color}}>{dot.icon}</span>
                  {lbl}
                </button>
              );
            })}
          </div>

          {/* Stage Content */}
          {stage==='discover' && <DiscoverStage key={activeBuyerId} buyer={buyer} onUpdate={setBuyer} buyerId={activeBuyerId}/>}
          {stage==='develop'  && <DevelopStage  key={activeBuyerId} buyer={buyer} onUpdate={setBuyer} buyerId={activeBuyerId}/>}
          {stage==='deploy'   && <DeployStage   key={activeBuyerId} buyer={buyer} onUpdate={setBuyer} buyerId={activeBuyerId}/>}

          {/* Deck Generators */}
          <div style={{display:'flex',gap:10,marginTop:20,flexWrap:'wrap'}}>
            <button className="bs-btn bs-btn-gold" onClick={()=>openPreview('discover')}>
              📊 Preview Discover Deck (9 slides)
            </button>
            <button className="bs-btn bs-btn-gold" onClick={()=>openPreview('develop')}
              disabled={dvStatus==='not_started'}>
              📊 Preview Develop Deck (10 slides)
            </button>
          </div>
        </>
      )}

      {/* Preview Modal — rendered via portal into document.body */}
      {preview && buyer && (
        <SlidePreviewModal
          deckType={preview.type}
          buyer={buyer}
          title={preview.type==='discover' ? `Discover Deck — ${buyer?.intel?.name||'Client'}` : `Develop Deck — ${buyer?.intel?.name||'Client'}`}
          onClose={()=>setPreview(null)}
          onDownload={handleDownload}
          downloading={downloading}
        />
      )}
    </div>
  );
}
