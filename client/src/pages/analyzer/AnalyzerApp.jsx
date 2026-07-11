import React from 'react';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import 'firebase/compat/firestore';
import './analyzer.css';

if (!firebase.apps.length) {
  firebase.initializeApp({
    apiKey: "AIzaSyAs9ix4W902ViLFCEDPfSTCJEfEIfQN9zY",
    authDomain: "qsi-analyzer.firebaseapp.com",
    projectId: "qsi-analyzer",
    storageBucket: "qsi-analyzer.appspot.com",
    messagingSenderId: "103925083775",
    appId: "1:103925083775:web:acb99d3771dbf85e23594a"
  });
}

const { useState, useEffect, useMemo, useRef } = React;

/* ── Utilities ─────────────────────────────────────── */
const fmtD = (n, d=0) => {
  const v = Number(n);
  if (isNaN(v)) return '$0';
  const s = Math.abs(v).toLocaleString('en-US',{minimumFractionDigits:d,maximumFractionDigits:d});
  return v < 0 ? `-$${s}` : `$${s}`;
};
const pn = s => { const n = parseFloat(String(s||'').replace(/[$,]/g,'')); return isNaN(n)?0:n; };
const isPT = et => ['1120-S','1065','Schedule C'].includes(et);
const curYear = new Date().getFullYear();

/* ── SDE Calc ──────────────────────────────────────── */
const calcSDE = yd => {
  const rev=pn(yd.revenue), cogs=pn(yd.cogs), opx=pn(yd.opx);
  const otherInc=pn(yd.otherIncome||0);
  const int=pn(yd.interest), dep=pn(yd.depreciation), amor=pn(yd.amortization);
  const taxes=isPT(yd.entityType)?0:pn(yd.taxes);
  const oc=pn(yd.ownerComp);
  const ab=(yd.addBacks||[]).reduce((s,a)=>s+pn(a.amount),0);
  const rentAB=pn(yd.rent||0)+pn(yd.rentAdj||0);
  const gp=rev-cogs, noi=gp+otherInc-opx;
  const ebitda=noi+int+taxes+dep+amor;
  const adjE=ebitda+oc;
  const sde=adjE+ab+rentAB;
  return {rev,cogs,gp,opx,otherInc,noi,int,taxes,dep,amor,ebitda,oc,adjE,ab,rentAB,sde};
};
const sortedByYear = yrs => [...yrs].sort((a,b)=>String(b.year).localeCompare(String(a.year)));
const wtdSDE = yrs => { const s=sortedByYear(yrs).map(y=>calcSDE(y).sde); return (s[0]*3+s[1]*2+s[2]*1)/6; };
const recentSDE = yrs => { for(const y of sortedByYear(yrs)){ const s=calcSDE(y).sde; if(pn(y.revenue)||s) return s; } return 0; };

/* ── Financial Performance Spread (shared: Income Statement + Deal Report) ── */
const SPREAD_ROWS = [
  ['Revenue',               y=>calcSDE(y).rev,   false],
  ['COGS / Cost of Sales',  y=>calcSDE(y).cogs,  false],
  ['Gross Profit',          y=>calcSDE(y).gp,    true],
  ['Operating Expenses',    y=>calcSDE(y).opx,   false],
  ['Net Operating Income',  y=>calcSDE(y).noi,   true],
  ['+ Interest',            y=>calcSDE(y).int,   false],
  ['+ Taxes',               y=>calcSDE(y).taxes, false],
  ['+ Depreciation',        y=>calcSDE(y).dep,   false],
  ['+ Amortization',        y=>calcSDE(y).amor,  false],
  ['EBITDA',                y=>calcSDE(y).ebitda,true],
  ["Owner's Compensation",  y=>calcSDE(y).oc,    false],
  ['Adjusted EBITDA',       y=>calcSDE(y).adjE,  true],
  ['Add-Backs',             y=>calcSDE(y).ab,    false],
  ["Seller's Discretionary Earnings",y=>calcSDE(y).sde,true],
];

const FinancialSpreadTable = ({years}) => (
  <table style={{width:'100%',fontSize:11,borderCollapse:'collapse'}}>
    <thead>
      <tr style={{borderBottom:'2px solid #1e2d45'}}>
        <th style={{textAlign:'left',padding:'5px 0',color:'#475569',fontSize:10,textTransform:'uppercase',letterSpacing:'0.06em',fontWeight:600,width:'40%'}}>Metric</th>
        {years.map(y=>[
          <th key={y.year} style={{textAlign:'right',padding:'5px 8px',color:'#475569',fontSize:10,textTransform:'uppercase',fontWeight:600}}>{y.year}</th>,
          <th key={y.year+'p'} style={{textAlign:'right',padding:'5px 12px 5px 0',color:'#334155',fontSize:9,fontWeight:400}}>% Rev</th>
        ])}
      </tr>
    </thead>
    <tbody>
      {SPREAD_ROWS.map(([lbl,fn,bold])=>{
        const isSDE=lbl.startsWith("Seller");
        return (
          <tr key={lbl} style={{borderBottom:`1px solid ${bold?'#1e2d45':'#0d1117'}`,background:isSDE?'#061208':bold?'#0a1205':'transparent'}}>
            <td style={{padding:'5px 0',color:isSDE?'#2eb860':bold?'#cbd5e1':'#64748b',fontWeight:bold?600:400,fontSize:11}}>{lbl}</td>
            {years.map(y=>{
              const v=fn(y), rev=calcSDE(y).rev;
              const p=lbl==='Revenue'?'100%':(rev>0?`${(v/rev*100).toFixed(1)}%`:'—');
              return [
                <td key={y.year} className={isSDE?'rpt-green':bold?'':'rpt-muted'} style={{textAlign:'right',padding:'5px 8px',fontFamily:'monospace',color:isSDE?'#2eb860':bold?'#e2e8f0':'#94a3b8',fontWeight:bold?600:400}}>{fmtD(v)}</td>,
                <td key={y.year+'p'} className="rpt-muted" style={{textAlign:'right',padding:'5px 12px 5px 0',fontFamily:'monospace',color:'#334155',fontSize:10}}>{p}</td>
              ];
            })}
          </tr>
        );
      })}
    </tbody>
  </table>
);

/* ── Default state ─────────────────────────────────── */
const blankYear = yr => ({year:yr,entityType:'1120-S',revenue:'',cogs:'',opx:'',otherIncome:'',interest:'',taxes:'',depreciation:'',amortization:'',ownerComp:'',addBacks:[],rent:'',rentAdj:'',expanded:false});
const initState = () => ({
  dealName:'', advisorName:'', ytdEnabled:false,
  years:[blankYear(curYear-3),blankYear(curYear-2),blankYear(curYear-1)],
  ytdData:blankYear('YTD'),
  sdeBasis:'recent', customMults:[],
  loanRate:10.75, loanAmort:10, dpPct:10, reAmort:25,
  loanStructure:'7a', re504Rate:6.5, ppLoan:0, ppRate:7.5, ppAmort:10,
  su:{marketPrice:'',sellerFin:'',sfRate:'',sfAmort:'',reVal:'',wc:'',arVal:'',invVal:'',closing:15000},
  bs:[{cash:'',ar:'',inv:'',ca:'',ta:'',ap:'',cl:'',tl:'',nw:'',capex:''},{cash:'',ar:'',inv:'',ca:'',ta:'',ap:'',cl:'',tl:'',nw:'',capex:''},{cash:'',ar:'',inv:'',ca:'',ta:'',ap:'',cl:'',tl:'',nw:'',capex:''}],
  np:{gross:'',cash:'',ap:'',ltd:'',mortgage:'',commission:'10',legal:'',sbaFee:'',closingCosts:'',taxRate:'',customDeds:[]},
  nlb:{pct:20,nextSDE:''},
  ind:{name:'',naics:'',source:'',reportYear:'',grossMarginPct:'',cogsPct:'',preTaxProfitPct:'',netMarginPct:'',sdeMult:'',revenueMultPct:'',ebitMult:'',ebitdaMult:'',sdeMultUnder1M:'',sdeMult1to5M:'',sdeMultOver5M:'',ebitdaMultUnder1M:'',ebitdaMult1to5M:'',ebitdaMultOver5M:''},
  roi:{growthPct:'0',exitYears:'10',exitMultiple:''},
  seller:{askingPrice:'',buyerSalary:'',contingencyPct:'10'},
  notes:'',
  _net:0,
});

/* ── Number Input ──────────────────────────────────── */
const NI = ({value,onChange,placeholder='',disabled=false,cls=''}) => {
  const [disp,setDisp]=useState('');
  useEffect(()=>{
    if(value===''||value===null||value===undefined){setDisp('');return;}
    const n=parseFloat(String(value).replace(/[$,]/g,''));
    setDisp(isNaN(n)?'':n.toLocaleString('en-US'));
  },[value]);
  return <input type="text" value={disp} disabled={disabled}
    className={`input-field ${cls}`} placeholder={placeholder}
    onChange={e=>{setDisp(e.target.value);const n=parseFloat(e.target.value.replace(/[$,]/g,''));onChange(isNaN(n)?'':n);}}
    onBlur={()=>{const n=parseFloat(String(disp).replace(/[$,]/g,''));setDisp(isNaN(n)?'':n.toLocaleString('en-US'));}}/>;
};

/* ── Calc display ──────────────────────────────────── */
const CF = ({v,neg=false}) => <div className={`calc-field ${neg&&v<0?'text-red-400':''}`}>{(v===''||v===undefined)?'—':fmtD(v)}</div>;

/* ── Toggle ────────────────────────────────────────── */
const Tog = ({on,set,label}) => (
  <label className="flex items-center gap-2 cursor-pointer select-none">
    <div className="relative w-10 h-5">
      <input type="checkbox" className="sr-only" checked={on} onChange={e=>set(e.target.checked)}/>
      <div className={`w-10 h-5 rounded-full transition-colors ${on?'bg-blue-600':'bg-gray-700'}`}/>
      <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${on?'translate-x-5':''}`}/>
    </div>
    {label&&<span className="text-sm text-gray-300">{label}</span>}
  </label>
);

/* ── SVG Bar Chart ─────────────────────────────────── */
const BarChart = ({data,dataKey,color='#2eb860',label='',fmtAxis}) => {
  const W=340,H=160,PAD={t:10,r:10,b:30,l:60};
  const vals=data.map(d=>d[dataKey]||0);
  const maxV=Math.max(...vals,1);
  const minV=Math.min(...vals,0);
  const range=maxV-minV||1;
  const innerW=W-PAD.l-PAD.r, innerH=H-PAD.t-PAD.b;
  const bw=Math.floor(innerW/data.length*0.6);
  const gap=innerW/data.length;
  const scaleY=v=>(innerH*(1-(v-minV)/range));
  const zeroY=scaleY(0);
  const fmtTick=fmtAxis||(v=>{ const a=Math.abs(v); if(a>=1000000)return '$'+(v/1000000).toFixed(1)+'M'; if(a>=1000)return '$'+(v/1000).toFixed(0)+'k'; return '$'+v; });
  const ticks=4;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{overflow:'visible'}}>
      {Array.from({length:ticks+1},(_,i)=>{
        const v=minV+(range/ticks)*i;
        const y=PAD.t+scaleY(v);
        return <g key={i}><line x1={PAD.l} x2={PAD.l+innerW} y1={y} y2={y} stroke="#1f2937" strokeDasharray="3 3"/><text x={PAD.l-4} y={y+4} textAnchor="end" fontSize="9" fill="#64748b">{fmtTick(v)}</text></g>;
      })}
      {data.map((d,i)=>{
        const x=PAD.l+gap*i+gap/2-bw/2;
        const val=d[dataKey]||0;
        const barH=Math.abs(scaleY(val)-zeroY);
        const by=PAD.t+Math.min(scaleY(val),zeroY);
        return (
          <g key={i}>
            <rect x={x} y={by} width={bw} height={Math.max(barH,1)} fill={color} rx="2"/>
            <text x={x+bw/2} y={PAD.t+innerH+18} textAnchor="middle" fontSize="10" fill="#94a3b8">{d.year}</text>
          </g>
        );
      })}
      <line x1={PAD.l} x2={PAD.l} y1={PAD.t} y2={PAD.t+innerH} stroke="#374151"/>
      <line x1={PAD.l} x2={PAD.l+innerW} y1={PAD.t+zeroY} y2={PAD.t+zeroY} stroke="#374151"/>
    </svg>
  );
};

/* ── SVG Line Chart ────────────────────────────────── */
const LineChart = ({data,dataKey,color='#10b981'}) => {
  const W=340,H=140,PAD={t:10,r:10,b:30,l:60};
  const vals=data.map(d=>d[dataKey]||0);
  const maxV=Math.max(...vals,1),minV=Math.min(...vals,0);
  const range=maxV-minV||1;
  const innerW=W-PAD.l-PAD.r, innerH=H-PAD.t-PAD.b;
  const gap=innerW/(data.length-1||1);
  const scaleY=v=>innerH*(1-(v-minV)/range);
  const fmtTick=v=>{ const a=Math.abs(v); if(a>=1000000)return '$'+(v/1000000).toFixed(1)+'M'; if(a>=1000)return '$'+(v/1000).toFixed(0)+'k'; return '$'+v; };
  const pts=data.map((d,i)=>`${PAD.l+gap*i},${PAD.t+scaleY(d[dataKey]||0)}`).join(' ');
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{overflow:'visible'}}>
      {[0,1,2,3,4].map(i=>{
        const v=minV+(range/4)*i; const y=PAD.t+scaleY(v);
        return <g key={i}><line x1={PAD.l} x2={PAD.l+innerW} y1={y} y2={y} stroke="#1f2937" strokeDasharray="3 3"/><text x={PAD.l-4} y={y+4} textAnchor="end" fontSize="9" fill="#64748b">{fmtTick(v)}</text></g>;
      })}
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2"/>
      {data.map((d,i)=>(
        <g key={i}>
          <circle cx={PAD.l+gap*i} cy={PAD.t+scaleY(d[dataKey]||0)} r="4" fill={color}/>
          <text x={PAD.l+gap*i} y={PAD.t+innerH+18} textAnchor="middle" fontSize="10" fill="#94a3b8">{d.year}</text>
        </g>
      ))}
      <line x1={PAD.l} x2={PAD.l} y1={PAD.t} y2={PAD.t+innerH} stroke="#374151"/>
      <line x1={PAD.l} x2={PAD.l+innerW} y1={PAD.t+innerH} y2={PAD.t+innerH} stroke="#374151"/>
    </svg>
  );
};

/* ── SVG Stacked Bar ───────────────────────────────── */
const StackedBar = ({data}) => {
  const W=480,H=200,PAD={t:10,r:120,b:30,l:60};
  const keys=[{k:'ebitda',c:'#2eb860',l:'EBITDA'},{k:'oc',c:'#3b82f6',l:"Owner's Comp"},{k:'ab',c:'#f59e0b',l:'Add-Backs'}];
  const totals=data.map(d=>keys.reduce((s,k)=>s+Math.max(0,d[k.k]||0),0));
  const maxV=Math.max(...totals,1);
  const innerW=W-PAD.l-PAD.r, innerH=H-PAD.t-PAD.b;
  const bw=Math.floor(innerW/data.length*0.55);
  const gap=innerW/data.length;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{overflow:'visible'}}>
      {[0,1,2,3,4].map(i=>{
        const v=(maxV/4)*i; const y=PAD.t+innerH*(1-v/maxV);
        return <g key={i}><line x1={PAD.l} x2={PAD.l+innerW} y1={y} y2={y} stroke="#1f2937" strokeDasharray="3 3"/><text x={PAD.l-4} y={y+4} textAnchor="end" fontSize="9" fill="#64748b">{v>=1000000?'$'+(v/1000000).toFixed(1)+'M':v>=1000?'$'+(v/1000).toFixed(0)+'k':'$'+v}</text></g>;
      })}
      {data.map((d,i)=>{
        const x=PAD.l+gap*i+gap/2-bw/2;
        let cum=0;
        return <g key={i}>
          {keys.map(k=>{
            const val=Math.max(0,d[k.k]||0);
            const h=innerH*val/maxV;
            const y=PAD.t+innerH*(1-(cum+val)/maxV);
            cum+=val;
            return <rect key={k.k} x={x} y={y} width={bw} height={Math.max(h,0)} fill={k.c} rx="1"/>;
          })}
          <text x={x+bw/2} y={PAD.t+innerH+18} textAnchor="middle" fontSize="10" fill="#94a3b8">{d.year}</text>
        </g>;
      })}
      <line x1={PAD.l} x2={PAD.l} y1={PAD.t} y2={PAD.t+innerH} stroke="#374151"/>
      <line x1={PAD.l} x2={PAD.l+innerW} y1={PAD.t+innerH} y2={PAD.t+innerH} stroke="#374151"/>
      {/* Legend */}
      {keys.map((k,i)=>(
        <g key={k.k} transform={`translate(${PAD.l+innerW+10},${PAD.t+i*22})`}>
          <rect width="10" height="10" fill={k.c} rx="2"/>
          <text x="14" y="9" fontSize="10" fill="#94a3b8">{k.l}</text>
        </g>
      ))}
    </svg>
  );
};

/* ── Year Section ──────────────────────────────────── */
const pctRev=(v,rev)=>rev>0?`${(v/rev*100).toFixed(1)}%`:'';
const PctBadge=({v,rev})=>{ const p=pctRev(v,rev); return p?<span style={{fontSize:9,color:'#64748b',marginLeft:4}}>({p})</span>:null; };

const YearSec = ({yd,onChange,onImport,reVal=0}) => {
  const c=calcSDE(yd);
  const set=(f,v)=>onChange({...yd,[f]:v});
  const addAB=()=>{const sid=Date.now();onChange({...yd,addBacks:[...(yd.addBacks||[]),{id:sid,sharedId:sid,label:'',amount:''}]});};
  const rmAB=id=>onChange({...yd,addBacks:(yd.addBacks||[]).filter(a=>a.id!==id)});
  const upAB=(id,k,v)=>onChange({...yd,addBacks:(yd.addBacks||[]).map(a=>a.id===id?{...a,[k]:v}:a)});
  return (
    <div className="card" style={{marginBottom:40}}>
      <div className="flex items-center justify-between px-5 py-4 cursor-pointer select-none hover:bg-gray-900 rounded-lg"
        onClick={()=>set('expanded',!yd.expanded)}>
        <div className="flex items-center gap-4">
          <span className="text-gray-500 text-sm" style={{transition:'transform .15s',display:'inline-block',transform:yd.expanded?'rotate(90deg)':'rotate(0deg)'}}>▶</span>
          <span className="font-bold text-blue-300 text-base">{yd.year}</span>
          <select className="input-field py-1.5" style={{fontSize:13,width:120}} value={yd.entityType}
            onClick={e=>e.stopPropagation()} onChange={e=>{e.stopPropagation();set('entityType',e.target.value);}}>
            {['1120-S','1065','1120','Schedule C'].map(t=><option key={t}>{t}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-4">
          {onImport&&<button onClick={e=>{e.stopPropagation();onImport();}} style={{fontSize:12,padding:'5px 12px',background:'#1e293b',color:'#94a3b8',border:'1px solid #334155',borderRadius:4,cursor:'pointer',whiteSpace:'nowrap'}}>Import PDF</button>}
          <div className="text-right">
            <span className="text-sm text-gray-500 mr-2">SDE</span>
            <span className={`mono font-bold text-base ${c.sde>=0?'text-green-400':'text-red-400'}`}>{(pn(yd.revenue)||c.sde)?fmtD(c.sde):'—'}</span>
          </div>
        </div>
      </div>
      {yd.expanded&&(
        <div className="px-5 pb-6 pt-4 border-t border-gray-800 space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div><span className="lbl">Total Sales / Revenue</span><NI value={yd.revenue} onChange={v=>set('revenue',v)}/></div>
            <div><span className="lbl">COGS<PctBadge v={c.cogs} rev={c.rev}/></span><NI value={yd.cogs} onChange={v=>set('cogs',v)}/></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><span className="lbl">Gross Profit (auto)<PctBadge v={c.gp} rev={c.rev}/></span><CF v={c.gp}/></div>
            <div><span className="lbl">Operating Expenses (OpX)<PctBadge v={c.opx} rev={c.rev}/></span><NI value={yd.opx} onChange={v=>set('opx',v)}/></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="lbl">Other Income <span style={{fontSize:11,color:'#475569'}}>(Line 5 / Stmt 1)</span></span>
              <NI value={yd.otherIncome} placeholder="0" onChange={v=>set('otherIncome',v)}/>
            </div>
            <div/>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><span className="lbl">Ordinary Income (auto)</span><CF v={c.noi} neg/></div>
            <div><span className="lbl">Interest</span><NI value={yd.interest} onChange={v=>set('interest',v)}/></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><span className="lbl">Depreciation</span><NI value={yd.depreciation} onChange={v=>set('depreciation',v)}/></div>
            <div><span className="lbl">Amortization</span><NI value={yd.amortization} onChange={v=>set('amortization',v)}/></div>
          </div>
          {!isPT(yd.entityType)&&(
            <div className="grid grid-cols-2 gap-4">
              <div><span className="lbl">Taxes (C-Corp)</span><NI value={yd.taxes} onChange={v=>set('taxes',v)}/></div>
              <div/>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div><span className="lbl">EBITDA (auto)</span><CF v={c.ebitda}/></div>
            <div><span className="lbl">Owner's Compensation<PctBadge v={c.oc} rev={c.rev}/></span><NI value={yd.ownerComp} onChange={v=>{
              const comp=pn(v);
              const existing=(yd.addBacks||[]).findIndex(a=>/payroll.?tax/i.test(a.label));
              const taxAmt=Math.round(comp*0.0765*100)/100;
              const newABs=[...(yd.addBacks||[])];
              if(comp>0){
                if(existing>=0){newABs[existing]={...newABs[existing],amount:taxAmt};}
                else{const sid=Date.now();newABs.push({id:sid,sharedId:sid,label:'Owner payroll tax (7.65%)',amount:taxAmt});}
              }
              onChange({...yd,ownerComp:v,addBacks:newABs});
            }}/></div>
          </div>
          <div><span className="lbl">Adjusted EBITDA (auto)</span><CF v={c.adjE}/></div>
          {/* Rent / RE Add-back */}
          <div className="mt-3 pt-3 border-t border-gray-800">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Rent / Real Estate Add-Back</span>
            </div>
            {reVal>0&&(
              <div style={{background:'rgba(217,119,6,0.08)',border:'1px solid rgba(217,119,6,0.2)',borderRadius:4,padding:'6px 10px',fontSize:12,color:'#fbbf24',marginBottom:8}}>
                Real estate included in deal — if the business currently leases its space, add back the rent expense below and set RE NOI to 0 (buyer will own the property; occupancy cost becomes debt service).
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="lbl">Rent Expense (from return)</span>
                <NI value={yd.rent} onChange={v=>{
                  const rv=pn(v);
                  onChange({...yd,rent:v,rentAdj:rv>0?-rv:''});
                }}/>
              </div>
              <div>
                <span className="lbl">Rent Adj / RE NOI (+/-)</span>
                <input className="input-field" type="text" value={yd.rentAdj||''} onChange={e=>set('rentAdj',e.target.value)} placeholder="0"/>
              </div>
            </div>
            {(pn(yd.rent)+pn(yd.rentAdj))!==0&&(
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div><span className="lbl">Total RE Add-Back (auto)</span><CF v={pn(yd.rent)+pn(yd.rentAdj)}/></div>
              </div>
            )}
          </div>
          {/* Add-Backs */}
          <div className="mt-3 border-t border-gray-800 pt-3">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Normalizations / Add-Backs<PctBadge v={c.ab} rev={c.rev}/></span>
              <button onClick={addAB} className="text-sm bg-blue-900 hover:bg-blue-800 text-blue-300 px-3 py-1.5 rounded">+ Add Item</button>
            </div>
            {(yd.addBacks||[]).map(ab=>(
              <div key={ab.id} className="grid grid-cols-5 gap-2 mb-2 items-center">
                <input className="input-field col-span-3" style={{fontSize:13}} placeholder="Description" value={ab.label} onChange={e=>upAB(ab.id,'label',e.target.value)}/>
                <NI value={ab.amount} onChange={v=>upAB(ab.id,'amount',v)} placeholder="0"/>
                <button onClick={()=>rmAB(ab.id)} className="text-red-500 hover:text-red-400 text-center text-base">✕</button>
              </div>
            ))}
            {(yd.addBacks||[]).length>0&&(
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div><span className="lbl">Total Add-Backs (auto)</span><CF v={c.ab}/></div>
              </div>
            )}
          </div>
          <div className="mt-3 pt-3 border-t border-blue-900">
            <span className="lbl text-blue-400">SDE — Seller's Discretionary Earnings</span>
            <div className={`calc-field text-lg font-bold mono ${c.sde>=0?'text-green-400':'text-red-400'}`}>{fmtD(c.sde)}</div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ── Analysis Panel ────────────────────────────────── */
const Analysis = ({state,set,primeRate}) => {
  const {years,sdeBasis,customMults,loanRate,loanAmort,dpPct}=state;
  const hasData=years.some(y=>pn(y.revenue)||calcSDE(y).sde);
  const wt=wtdSDE(years), rec=recentSDE(years);
  const base=sdeBasis==='weighted'?wt:rec;
  const mults=[2.5,3.0,3.5,...(customMults||[]).map(m=>parseFloat(m)).filter(m=>m>0)];
  const r=(loanRate||10.75)/100/12, n=(loanAmort||10)*12;
  const pmt=loan=>r===0?loan/n:loan*r*Math.pow(1+r,n)/(Math.pow(1+r,n)-1);
  const dpFrac=(100-(dpPct||10))/100;
  return (
    <div className="card p-5">
      <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-4 pb-2 border-b border-gray-700">Analysis</h3>
      {!hasData?(
        <div>
          <p className="text-gray-500 text-sm italic mb-3">Enter tax return data to see valuation analysis</p>
          <div className="bg-gray-900 rounded p-4 text-sm text-gray-400 mono leading-6">Revenue − COGS − OpX<br/>+ ITDA + Owner's Comp<br/>+ Add-Backs = SDE</div>
        </div>
      ):(
        <>
          <div className="mb-4">
            <span className="lbl">SDE Basis</span>
            <div className="flex rounded overflow-hidden border border-gray-700 text-sm">
              {['weighted','recent'].map(b=>(
                <button key={b} onClick={()=>set({...state,sdeBasis:b})}
                  className={`flex-1 py-2 transition-colors ${sdeBasis===b?'bg-blue-700 text-white':'bg-gray-900 text-gray-400 hover:bg-gray-800'}`}>
                  {b==='weighted'?'Weighted Avg':'Most Recent'}
                </button>
              ))}
            </div>
          </div>
          <div className="bg-gray-900 rounded p-4 mb-4">
            <span className="lbl">Selected SDE</span>
            <div className="text-2xl font-bold text-green-400 mono">{fmtD(base)}</div>
            <div className="text-sm text-gray-500 mt-1">
              {sdeBasis==='weighted'?`Wtd Avg (3×/2×/1×) ÷ 6`:`Most Recent Year`}
            </div>
          </div>
          <div className="mb-4">
            <span className="lbl text-blue-400 mb-2 block">Fair Market Value Range</span>
            {mults.map(m=>(
              <div key={m} className="flex justify-between items-center bg-gray-900 rounded px-3 py-2 mb-1.5">
                <span className="text-sm text-gray-400">{m.toFixed(1)}× SDE</span>
                <span className="mono text-base font-semibold text-blue-300">{fmtD(base*m)}</span>
              </div>
            ))}
            <button className="text-sm text-blue-400 hover:text-blue-300 mt-2"
              onClick={()=>{const m=prompt('Enter custom multiplier (e.g. 4.0):');if(m&&!isNaN(parseFloat(m)))set({...state,customMults:[...(customMults||[]),m]});}}>
              + Add Custom Multiplier
            </button>
          </div>
          <div className="border-t border-gray-700 pt-4">
            <span className="lbl text-green-400 mb-2 block">SBA Loan Analysis</span>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div><span className="lbl">Rate (%)</span><NI value={loanRate} onChange={v=>set({...state,loanRate:v})}/>{primeRate&&<div className="text-xs text-gray-600 mt-1">Prime {primeRate}% + 2.75%</div>}</div>
              <div><span className="lbl">Amort (yrs)</span><NI value={loanAmort} onChange={v=>set({...state,loanAmort:v})}/></div>
            </div>
            {mults.map(m=>{
              const price=base*m, loan=price*dpFrac;
              const mo=pmt(loan), ann=mo*12;
              return (
                <div key={m} className="bg-gray-900 rounded p-3 mb-2 text-sm">
                  <div className="text-gray-300 font-semibold mb-2">{m.toFixed(1)}× — {fmtD(price)}</div>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-1">
                    <span className="text-gray-500">Loan ({100-(dpPct||10)}% LTV):</span><span className="mono text-gray-300">{fmtD(loan)}</span>
                    <span className="text-gray-500">Monthly Pmt:</span><span className="mono text-yellow-400">{fmtD(mo)}</span>
                    <span className="text-gray-500">Annual DS:</span><span className="mono text-red-400">{fmtD(ann)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

/* ── Tab 1: Data Input ─────────────────────────────── */
const T1 = ({state,set,primeRate,importTaxReturn}) => {
  // Sync add-backs (add/remove/relabel) across all sections — the 3 tax-return
  // years plus YTD when enabled — so a change to any one carries over to the rest.
  const syncSection=(idx, newYd)=>{
    const sections=state.ytdEnabled?[...state.years,state.ytdData]:[...state.years];
    const oldYd=sections[idx];
    sections[idx]=newYd;
    const oldABs=oldYd.addBacks||[], newABs=newYd.addBacks||[];
    const added=newABs.filter(na=>na.sharedId&&!oldABs.find(oa=>oa.sharedId===na.sharedId));
    const removed=oldABs.filter(oa=>oa.sharedId&&!newABs.find(na=>na.sharedId===oa.sharedId)).map(a=>a.sharedId);
    const relabeled=newABs.filter(na=>{ const o=oldABs.find(oa=>oa.sharedId===na.sharedId); return o&&o.label!==na.label; });
    let next=sections;
    if(added.length||removed.length||relabeled.length){
      next=sections.map((y,i)=>{
        if(i===idx) return y;
        let abs=[...(y.addBacks||[])];
        added.forEach(ab=>{ if(!abs.find(a=>a.sharedId===ab.sharedId)) abs=[...abs,{id:Date.now()+i+Math.random(),sharedId:ab.sharedId,label:ab.label,amount:''}]; });
        removed.forEach(sid=>{ abs=abs.filter(a=>a.sharedId!==sid); });
        relabeled.forEach(lc=>{ abs=abs.map(a=>a.sharedId===lc.sharedId?{...a,label:lc.label}:a); });
        return {...y,addBacks:abs};
      });
    }
    if(state.ytdEnabled){
      set({...state,years:next.slice(0,-1),ytdData:next[next.length-1]});
    } else {
      set({...state,years:next});
    }
  };
  const upY=(yearIdx, newYd)=>syncSection(yearIdx, newYd);
  const upYTD=newYd=>syncSection(state.years.length, newYd);
  return (
    <div style={{display:'flex',gap:24,minHeight:0}}>
      <div style={{flex:'0 0 64%',overflowY:'auto',paddingRight:8,minWidth:0}}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-white">Data Input &amp; Setup</h2>
            <p className="text-xs text-gray-500">SDE + DSCR Analysis — 3-Year Tax Return Spread</p>
          </div>
          <Tog on={state.ytdEnabled} set={v=>set({...state,ytdEnabled:v})} label="YTD"/>
        </div>
        {state.years.map((yd,i)=><YearSec key={yd.year} yd={yd} onChange={yd=>upY(i,yd)} onImport={()=>importTaxReturn(i)} reVal={pn(state.su?.reVal)}/>)}
        {state.ytdEnabled&&<YearSec yd={state.ytdData} onChange={upYTD} onImport={null} reVal={pn(state.su?.reVal)}/>}
        {/* Financial Performance Spread */}
        <div className="card p-5" style={{marginBottom:20}}>
          <div style={{fontSize:14,fontWeight:800,color:'#f1f5f9',marginBottom:14}}>Financial Performance &amp; Seller's Discretionary Earnings</div>
          <FinancialSpreadTable years={state.ytdEnabled?[...state.years,state.ytdData]:state.years}/>
        </div>
        {/* Advisor Notes */}
        <div style={{marginTop:20,padding:16,background:'#0f172a',borderRadius:8,border:'1px solid #1e293b'}}>
          <div style={{fontSize:12,color:'#64748b',marginBottom:8,fontWeight:700,letterSpacing:1,textTransform:'uppercase'}}>Advisor Notes</div>
          <textarea
            value={state.notes||''}
            onChange={e=>set({...state,notes:e.target.value})}
            placeholder="Deal context, conditions, assumptions, red flags, RE details..."
            style={{width:'100%',minHeight:100,background:'#1e293b',color:'#e2e8f0',border:'1px solid #334155',borderRadius:6,padding:'10px 12px',fontSize:14,fontFamily:'inherit',resize:'vertical',boxSizing:'border-box'}}
          />
        </div>
      </div>
      <div style={{flex:'0 0 33.333%',minWidth:0}}><Analysis state={state} set={set} primeRate={primeRate}/></div>
    </div>
  );
};

/* ── Tab 2: Dashboard ──────────────────────────────── */
const T2 = ({state}) => {
  const {years,ytdData,ytdEnabled}=state;
  const base=[...years];
  if(ytdEnabled)base.push({...ytdData,year:'YTD'});
  const data=base.map(y=>{const c=calcSDE(y);return{year:String(y.year),revenue:c.rev,cogs:c.cogs,opx:c.opx,sde:c.sde};});
  const charts=[{k:'revenue',l:'Total Sales / Revenue',c:'#2eb860'},{k:'cogs',l:'COGS / Cost of Sales',c:'#ef4444'},{k:'opx',l:'Operating Expenses',c:'#ef4444'},{k:'sde',l:'SDE Trend',c:'#2eb860'}];
  return (
    <div>
      <h2 className="text-lg font-bold text-white mb-4">Dashboard</h2>
      <div className="grid grid-cols-2 gap-4">
        {charts.map(ch=>(
          <div key={ch.k} className="card p-4">
            <h3 className="text-sm font-semibold text-gray-300 mb-3">{ch.l}</h3>
            <BarChart data={data} dataKey={ch.k} color={ch.c}/>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ── Tab 3: SDE Charts ─────────────────────────────── */
const T3 = ({state}) => {
  const {years,ytdData,ytdEnabled}=state;
  const base=[...years];
  if(ytdEnabled)base.push({...ytdData,year:'YTD'});
  const data=base.map(y=>{const c=calcSDE(y);return{year:String(y.year),ebitda:Math.max(0,c.ebitda),oc:Math.max(0,c.oc),ab:Math.max(0,c.ab),sde:c.sde};});
  const wtd=wtdSDE(years), recent=recentSDE(years);
  const yearCards=data.filter(d=>d.year!=='YTD');
  const chartData=data;
  // Margin % chart data
  const marginData=base.map(y=>{const c=calcSDE(y);const r=c.rev;return{year:String(y.year),gm:r>0?+(c.gp/r*100).toFixed(1):0,em:r>0?+(c.ebitda/r*100).toFixed(1):0,sm:r>0?+(c.sde/r*100).toFixed(1):0,rev:c.rev};});
  const pctFmt=v=>v.toFixed(1)+'%';
  // YoY revenue growth
  const sortedRevYears=[...years].sort((a,b)=>String(a.year).localeCompare(String(b.year)));
  return (
    <div>
      <h2 className="text-lg font-bold text-white mb-4">SDE Charts</h2>
      <div className="grid grid-cols-4 gap-4 mb-4">
        {yearCards.map(d=>(
          <div key={d.year} className="card p-5">
            <div className="text-base font-bold text-white mb-4">{d.year}</div>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">EBITDA</span>
                <span className="mono text-blue-400 text-base font-semibold">{fmtD(d.ebitda)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Owner's Comp</span>
                <span className="mono text-green-400 text-base font-semibold">{fmtD(d.oc)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-400">Add-Backs</span>
                <span className="mono text-yellow-400 text-base font-semibold">{fmtD(d.ab)}</span>
              </div>
              <div className="flex justify-between items-center border-t border-gray-700 pt-3 mt-1">
                <span className="text-base font-bold text-white">SDE</span>
                <span className={`mono text-xl font-bold ${d.sde>=0?'text-green-400':'text-red-400'}`}>{fmtD(d.sde)}</span>
              </div>
            </div>
          </div>
        ))}
        <div className="card p-5" style={{borderColor:'#1a5e35'}}>
          <div className="text-base font-bold mb-4" style={{color:'#2eb860'}}>SDE Summary</div>
          <div className="space-y-3">
            <div>
              <div className="text-sm text-gray-400 mb-1">Weighted Avg SDE</div>
              <div className={`mono font-bold text-xl ${wtd>=0?'text-green-400':'text-red-400'}`}>{fmtD(wtd)}</div>
            </div>
            <div className="border-t border-gray-700 pt-3">
              <div className="text-sm text-gray-400 mb-1">Most Recent SDE</div>
              <div className={`mono font-bold text-xl ${recent>=0?'text-green-400':'text-red-400'}`}>{fmtD(recent)}</div>
            </div>
            {/* Revenue growth */}
            {sortedRevYears.length>=2&&(()=>{
              const rows=sortedRevYears.filter(y=>calcSDE(y).rev>0);
              return rows.length>=2?(
                <div className="border-t border-gray-700 pt-3">
                  <div className="text-sm text-gray-400 mb-1">Revenue Growth</div>
                  {rows.slice(1).map((y,i)=>{
                    const prev=calcSDE(rows[i]).rev, cur=calcSDE(y).rev;
                    const g=prev>0?((cur-prev)/prev*100):0;
                    return <div key={y.year} style={{fontSize:11,fontFamily:'monospace',color:g>=0?'#2eb860':'#ef4444'}}>{rows[i].year}→{y.year}: {g>=0?'+':''}{g.toFixed(1)}%</div>;
                  })}
                </div>
              ):null;
            })()}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">SDE Components (Stacked)</h3>
          <StackedBar data={chartData}/>
        </div>
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">SDE Trend</h3>
          <LineChart data={chartData} dataKey="sde" color="#2eb860"/>
        </div>
      </div>
      {/* Margin % Trends */}
      <div style={{marginBottom:4}}>
        <div style={{fontSize:11,fontWeight:700,color:'#475569',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:10}}>Margin Trends</div>
        <div className="grid grid-cols-3 gap-4">
          {[{label:'Gross Margin %',k:'gm',color:'#60a5fa'},{label:'EBITDA Margin %',k:'em',color:'#a78bfa'},{label:'SDE Margin %',k:'sm',color:'#2eb860'}].map(ch=>(
            <div key={ch.k} className="card p-4">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">{ch.label}</h3>
              <BarChart data={marginData} dataKey={ch.k} color={ch.color} fmtAxis={pctFmt}/>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ── Tab: Ratio Analysis ───────────────────────────── */
const TRatios = ({state}) => {
  const {years,bs,ind}=state;
  const sorted=sortedByYear(years);
  const yearData=sorted.map(y=>{
    const origIdx=years.findIndex(oy=>String(oy.year)===String(y.year));
    const b=(bs&&bs[origIdx])||{};
    const bv={cash:pn(b.cash),ar:pn(b.ar),inv:pn(b.inv),ca:pn(b.ca),ta:pn(b.ta),cl:pn(b.cl),tl:pn(b.tl),nw:pn(b.nw)};
    return{year:y.year,c:calcSDE(y),b:bv};
  });
  const hasBs=d=>d.b.ta>0||d.b.ca>0||d.b.cl>0;
  const rat=(n,d)=>d>0?n/d:null;
  const pct=(n,d)=>d>0?n/d*100:null;
  const days=(n,d)=>d>0?n/d*365:null;
  // color: green/yellow/red for ascending thresholds
  const gc=(v,g,o)=>v==null?'#475569':v>=g?'#2eb860':v>=o?'#f59e0b':'#ef4444';
  // color: green/yellow/red for descending thresholds (lower is better)
  const rc=(v,g,o)=>v==null?'#475569':v<=g?'#2eb860':v<=o?'#f59e0b':'#ef4444';
  const fP=v=>v==null?'—':v.toFixed(1)+'%';
  const fR=v=>v==null?'—':v.toFixed(2)+'x';
  const fD=v=>v==null?'—':v.toFixed(0)+' d';

  const SH=({title})=>(
    <tr><td colSpan={yearData.length+1} style={{padding:'12px 0 4px',color:'#60a5fa',fontSize:10,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',borderTop:'1px solid #1e2d45'}}>{title}</td></tr>
  );
  const Row=({label,hint,vals,cols,fmt})=>(
    <tr style={{borderBottom:'1px solid #0a0f1a'}}>
      <td style={{padding:'7px 0',fontSize:11,width:'42%'}}>
        <span style={{color:'#94a3b8'}}>{label}</span>
        {hint&&<div style={{fontSize:9,color:'#334155',marginTop:1}}>{hint}</div>}
      </td>
      {yearData.map((d,i)=>(
        <td key={d.year} style={{textAlign:'right',padding:'7px 10px',fontFamily:'monospace',fontSize:12,color:cols?cols[i]:'#94a3b8',fontWeight:600}}>{fmt(vals[i])}</td>
      ))}
    </tr>
  );

  const indGM=pn(ind.grossMarginPct),indCOGS=pn(ind.cogsPct),indPT=pn(ind.preTaxProfitPct),indNM=pn(ind.netMarginPct);
  const hasIndPct=indGM>0||indCOGS>0||indPT>0||indNM>0;

  return (
    <div>
      <h2 className="text-lg font-bold text-white mb-1">Financial Ratio Analysis</h2>
      <p style={{fontSize:12,color:'#475569',marginBottom:20}}>Ratios marked — require Balance Sheet data (populate the Balance Sheet tab to unlock them).</p>
      <div className="card p-5">
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead>
            <tr style={{borderBottom:'2px solid #1e2d45'}}>
              <th style={{textAlign:'left',fontSize:10,color:'#475569',textTransform:'uppercase',letterSpacing:'0.06em',fontWeight:600,paddingBottom:8,width:'42%'}}>Ratio</th>
              {yearData.map(d=><th key={d.year} style={{textAlign:'right',padding:'0 10px 8px',fontSize:10,color:'#475569',textTransform:'uppercase',fontWeight:600}}>{d.year}</th>)}
            </tr>
          </thead>
          <tbody>
            <SH title="Profitability"/>
            <Row label="Gross Margin %" hint="(Revenue − COGS) ÷ Revenue"
              vals={yearData.map(d=>pct(d.c.gp,d.c.rev))}
              cols={yearData.map(d=>gc(pct(d.c.gp,d.c.rev),40,25))} fmt={fP}/>
            <Row label="EBITDA Margin %" hint="EBITDA ÷ Revenue · >15% strong"
              vals={yearData.map(d=>pct(d.c.ebitda,d.c.rev))}
              cols={yearData.map(d=>gc(pct(d.c.ebitda,d.c.rev),15,8))} fmt={fP}/>
            <Row label="SDE Margin %" hint="SDE ÷ Revenue"
              vals={yearData.map(d=>pct(d.c.sde,d.c.rev))}
              cols={yearData.map(d=>gc(pct(d.c.sde,d.c.rev),20,10))} fmt={fP}/>
            <Row label="Return on Assets" hint="NOI ÷ Total Assets · requires BS"
              vals={yearData.map(d=>hasBs(d)&&d.b.ta>0?pct(d.c.noi,d.b.ta):null)}
              cols={yearData.map(d=>gc(hasBs(d)&&d.b.ta>0?pct(d.c.noi,d.b.ta):null,10,5))} fmt={fP}/>
            <Row label="Return on Equity" hint="NOI ÷ Net Worth · requires BS"
              vals={yearData.map(d=>d.b.nw>0?pct(d.c.noi,d.b.nw):null)}
              cols={yearData.map(d=>gc(d.b.nw>0?pct(d.c.noi,d.b.nw):null,15,10))} fmt={fP}/>
            <SH title="Liquidity (requires Balance Sheet)"/>
            <Row label="Current Ratio" hint="Current Assets ÷ Current Liabilities · >1.5 healthy"
              vals={yearData.map(d=>d.b.cl>0?rat(d.b.ca,d.b.cl):null)}
              cols={yearData.map(d=>gc(d.b.cl>0?rat(d.b.ca,d.b.cl):null,1.5,1.0))} fmt={fR}/>
            <Row label="Quick Ratio" hint="(Cash + A/R) ÷ Current Liabilities · >1.0 healthy"
              vals={yearData.map(d=>d.b.cl>0?rat(d.b.cash+d.b.ar,d.b.cl):null)}
              cols={yearData.map(d=>gc(d.b.cl>0?rat(d.b.cash+d.b.ar,d.b.cl):null,1.0,0.8))} fmt={fR}/>
            <SH title="Efficiency (requires Balance Sheet)"/>
            <Row label="Asset Turnover" hint="Revenue ÷ Total Assets · >1.0 efficient"
              vals={yearData.map(d=>d.b.ta>0?rat(d.c.rev,d.b.ta):null)}
              cols={yearData.map(d=>gc(d.b.ta>0?rat(d.c.rev,d.b.ta):null,1.5,0.8))} fmt={fR}/>
            <Row label="A/R Days" hint="A/R ÷ Revenue × 365 · <30 days efficient"
              vals={yearData.map(d=>d.b.ar>0&&d.c.rev>0?days(d.b.ar,d.c.rev):null)}
              cols={yearData.map(d=>rc(d.b.ar>0&&d.c.rev>0?days(d.b.ar,d.c.rev):null,30,45))} fmt={fD}/>
            <Row label="Inventory Days" hint="Inventory ÷ COGS × 365 · lower is faster"
              vals={yearData.map(d=>d.b.inv>0&&d.c.cogs>0?days(d.b.inv,d.c.cogs):null)}
              cols={yearData.map(d=>rc(d.b.inv>0&&d.c.cogs>0?days(d.b.inv,d.c.cogs):null,30,60))} fmt={fD}/>
            <SH title="Leverage & Solvency (requires Balance Sheet)"/>
            <Row label="Debt-to-Equity" hint="Total Liabilities ÷ Net Worth · <1.0 conservative"
              vals={yearData.map(d=>d.b.nw>0?rat(d.b.tl,d.b.nw):null)}
              cols={yearData.map(d=>rc(d.b.nw>0?rat(d.b.tl,d.b.nw):null,1.0,2.0))} fmt={fR}/>
            <Row label="Debt-to-Assets" hint="Total Liabilities ÷ Total Assets"
              vals={yearData.map(d=>d.b.ta>0?pct(d.b.tl,d.b.ta):null)}
              cols={yearData.map(d=>rc(d.b.ta>0?pct(d.b.tl,d.b.ta):null,50,70))}
              fmt={v=>v==null?'—':v.toFixed(1)+'%'}/>
          </tbody>
        </table>
        {hasIndPct&&(
          <div style={{marginTop:16,padding:'10px 14px',background:'#0a1628',borderRadius:6,border:'1px solid #1e2d45'}}>
            <div style={{fontSize:10,color:'#a78bfa',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6}}>Industry Avg — {ind.name||'Imported'}</div>
            <div style={{display:'flex',gap:20,flexWrap:'wrap'}}>
              {indGM>0&&<span style={{fontSize:11}}><span style={{color:'#64748b'}}>Gross Margin: </span><span style={{fontFamily:'monospace',color:'#e2e8f0',fontWeight:600}}>{indGM.toFixed(1)}%</span></span>}
              {indCOGS>0&&<span style={{fontSize:11}}><span style={{color:'#64748b'}}>COGS: </span><span style={{fontFamily:'monospace',color:'#e2e8f0',fontWeight:600}}>{indCOGS.toFixed(1)}%</span></span>}
              {indPT>0&&<span style={{fontSize:11}}><span style={{color:'#64748b'}}>Pre-Tax Profit: </span><span style={{fontFamily:'monospace',color:'#e2e8f0',fontWeight:600}}>{indPT.toFixed(1)}%</span></span>}
              {indNM>0&&<span style={{fontSize:11}}><span style={{color:'#64748b'}}>Net Margin: </span><span style={{fontFamily:'monospace',color:'#e2e8f0',fontWeight:600}}>{indNM.toFixed(1)}%</span></span>}
            </div>
          </div>
        )}
        <div style={{marginTop:12,fontSize:10,color:'#334155'}}>🟢 On target · 🟡 Monitor · 🔴 Below target · — Balance sheet data not yet entered</div>
      </div>
    </div>
  );
};

/* ── Tab 4: Sources & Uses ─────────────────────────── */
const T4 = ({state,set}) => {
  const {years,sdeBasis,customMults,loanRate,loanAmort,dpPct,reAmort,su,loanStructure,re504Rate,ppLoan,ppRate,ppAmort}=state;
  const base=sdeBasis==='weighted'?wtdSDE(years):recentSDE(years);
  const mults=[2.5,3.0,3.5,...(customMults||[]).map(m=>parseFloat(m)).filter(m=>m>0)];
  const setSU=(f,v)=>set({...state,su:{...su,[f]:v}});
  useEffect(()=>{ if(base>0&&!pn(su.marketPrice)) set(prev=>({...prev,su:{...prev.su,marketPrice:base*3}})); },[base]);

  const dp=(dpPct||10)/100;
  const mp=pn(su.marketPrice);
  const reVal=pn(su.reVal), wcVal=pn(su.wc), arVal=pn(su.arVal), invVal=pn(su.invVal);
  const totalProject=mp+reVal+wcVal+arVal+invVal;
  const down=totalProject*dp;
  const baseLoan=totalProject*(1-dp);
  const guarFee=baseLoan*0.75*0.035;
  const closingAmt=su.closing===''?0:pn(su.closing);
  const totalLoan=baseLoan+guarFee+closingAmt;

  // SBA monthly payment
  const r=(loanRate||10.75)/100/12, n=(loanAmort||10)*12;
  const pmtFn=loan=>r===0?loan/n:loan*r*Math.pow(1+r,n)/(Math.pow(1+r,n)-1);
  const rePct=totalProject>0?(reVal/totalProject)*100:0;
  let bizMoPmt=0, reMoPmt=0, blendedAmort=loanAmort||10;
  if(loanStructure==='504'&&reVal>0){
    const r504=(re504Rate||6.5)/100/12, n504=(reAmort||25)*12;
    const pmt504=loan=>r504===0?loan/n504:loan*r504*Math.pow(1+r504,n504)/(Math.pow(1+r504,n504)-1);
    bizMoPmt=pmtFn((totalProject-reVal)*(1-dp)+guarFee+closingAmt);
    reMoPmt=pmt504(reVal*(1-dp));
  } else {
    blendedAmort=reVal>0
      ?Math.min(25,Math.max(10,Math.round((reVal/totalProject)*(reAmort||25)+((totalProject-reVal)/totalProject)*(loanAmort||10))))
      :(loanAmort||10);
    const nB=blendedAmort*12;
    bizMoPmt=(loan=>r===0?loan/nB:loan*r*Math.pow(1+r,nB)/(Math.pow(1+r,nB)-1))(totalLoan);
  }
  const rPP=(ppRate||7.5)/100/12, nPP=(ppAmort||10)*12;
  const ppMo=(ppLoan||0)>0?(rPP===0?(ppLoan||0)/nPP:(ppLoan||0)*rPP*Math.pow(1+rPP,nPP)/(Math.pow(1+rPP,nPP)-1)):0;
  const monthlyLoan=bizMoPmt+reMoPmt+ppMo;

  // Seller note
  const sfAmt=pn(su.sellerFin);
  const sfR=(pn(su.sfRate)||0)/100/12;
  const sfN=(pn(su.sfAmort)||0)*12;
  const sfPmt=(sfAmt>0&&sfR>0&&sfN>0)?sfAmt*sfR*Math.pow(1+sfR,sfN)/(Math.pow(1+sfR,sfN)-1):0;
  const sfAnn=sfPmt*12;

  const totalUses=totalProject+guarFee+closingAmt;
  const totalSrc=totalLoan+down+sfAmt;

  return (
    <div>
      <h2 className="text-lg font-bold text-white mb-1">Sources &amp; Uses</h2>
      <div className="flex items-center gap-3 mb-4">
        <span className="text-xs text-gray-400">SDE Basis:</span>
        <div className="flex rounded overflow-hidden border border-gray-700 text-xs">
          {['weighted','recent'].map(b=>(
            <button key={b} onClick={()=>set({...state,sdeBasis:b})}
              className={`py-1 px-3 transition-colors ${sdeBasis===b?'bg-blue-700 text-white':'bg-gray-900 text-gray-400 hover:bg-gray-800'}`}>
              {b==='weighted'?'Weighted Avg':'Most Recent'}
            </button>
          ))}
        </div>
      </div>
      <div className="card p-4 mb-4">
        <span className="lbl text-blue-400 mb-2 block">Fair Market Value Range — Click to set Market Price</span>
        <div className="flex gap-2 flex-wrap">
          {mults.map(m=>(
            <button key={m} onClick={()=>setSU('marketPrice',base*m)}
              className={`px-3 py-2 rounded text-sm transition-colors ${Math.abs(mp-base*m)<1?'bg-blue-700 text-white':'bg-gray-800 text-blue-300 hover:bg-blue-900'}`}>
              {m.toFixed(1)}× — {fmtD(base*m)}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        {/* Sources */}
        <div className="card p-4">
          <h3 className="text-sm font-bold text-green-400 mb-3 uppercase tracking-wide">Sources (Financing)</h3>
          <div className="space-y-3">
            <div>
              <span className="lbl">SBA Loan (auto — fee &amp; closing financed)</span>
              <CF v={totalLoan}/>
              {totalLoan>0&&(
              <div>
                {loanStructure==='504'&&reVal>0?(
                  <>
                    <div className="text-xs text-gray-500 mt-0.5">{fmtD(bizMoPmt)}/mo 7(a) ({loanAmort}yr) + {fmtD(reMoPmt)}/mo 504 ({reAmort||25}yr @ {re504Rate||6.5}%)</div>
                    <div className="text-xs font-bold mt-0.5" style={{color:'#2eb860'}}>= {fmtD(bizMoPmt+reMoPmt)}/mo SBA</div>
                  </>
                ):(
                  <div className="text-xs text-gray-500 mt-0.5">
                    {fmtD(bizMoPmt)}/mo @ {loanRate}%{reVal>0?` / ${blendedAmort}yr blended`:`/ ${loanAmort}yr`}
                    {reVal>0&&<span className="ml-1 text-gray-600">({rePct.toFixed(0)}% RE×{reAmort||25}yr + {(100-rePct).toFixed(0)}% biz×{loanAmort}yr)</span>}
                  </div>
                )}
                {ppMo>0&&<div className="text-xs text-gray-500 mt-0.5">+ {fmtD(ppMo)}/mo pari passu ({ppAmort}yr @ {ppRate}%)</div>}
                {(ppMo>0||reMoPmt>0)&&<div className="text-xs font-bold mt-0.5" style={{color:'#2eb860'}}>= {fmtD(monthlyLoan)}/mo total</div>}
              </div>
            )}
            </div>
            <div>
              <span className="lbl">Buyer Down Payment (auto, {dpPct}% of total project)</span>
              <CF v={down}/>
            </div>
            <div className="border-t border-gray-700 pt-3">
              <span className="text-xs font-semibold text-yellow-400 mb-2 block">Seller Financing (optional)</span>
              <div className="space-y-2">
                <div><span className="lbl">Note Amount</span><NI value={su.sellerFin} onChange={v=>setSU('sellerFin',v)} placeholder="0"/></div>
                {sfAmt>0&&<>
                  <div className="grid grid-cols-2 gap-2">
                    <div><span className="lbl">Note Rate (%)</span><NI value={su.sfRate} onChange={v=>setSU('sfRate',v)} placeholder="0.00"/></div>
                    <div><span className="lbl">Term (yrs)</span><NI value={su.sfAmort} onChange={v=>setSU('sfAmort',v)} placeholder="0"/></div>
                  </div>
                  {sfPmt>0&&<div><span className="lbl">Monthly Payment (auto)</span><CF v={sfPmt}/><div className="text-xs text-gray-500 mt-0.5">{fmtD(sfAnn)}/yr — included in DSCR</div></div>}
                </>}
              </div>
            </div>
            <div className="border-t border-gray-700 pt-2 flex justify-between">
              <span className="text-xs font-bold text-gray-300">Total Sources</span>
              <span className="mono font-bold text-green-400">{fmtD(totalSrc)}</span>
            </div>
          </div>
        </div>
        {/* Uses */}
        <div className="card p-4">
          <h3 className="text-sm font-bold text-red-400 mb-3 uppercase tracking-wide">Uses (Deal Costs)</h3>
          <div className="space-y-2">
            <div><span className="lbl">Market Price</span><NI value={su.marketPrice} onChange={v=>setSU('marketPrice',v)} placeholder="0"/></div>
            <div><span className="lbl">Real Estate (if applicable)</span><NI value={su.reVal} onChange={v=>setSU('reVal',v)} placeholder="0"/></div>
            <div><span className="lbl">Working Capital</span><NI value={su.wc} onChange={v=>setSU('wc',v)} placeholder="0"/></div>
            <div><span className="lbl">Accounts Receivable (if applicable)</span><NI value={su.arVal} onChange={v=>setSU('arVal',v)} placeholder="0"/></div>
            <div><span className="lbl">Inventory (if applicable)</span><NI value={su.invVal} onChange={v=>setSU('invVal',v)} placeholder="0"/></div>
            <div><span className="lbl">SBA Guarantee Fee (auto, 3.5% of 75% of loan)</span><CF v={guarFee}/></div>
            <div><span className="lbl">Closing Costs / Fees</span><NI value={su.closing} onChange={v=>setSU('closing',v)} placeholder="15,000"/></div>
            <div className="border-t border-gray-700 pt-2 flex justify-between">
              <span className="text-xs font-bold text-gray-300">Total Uses</span>
              <span className="mono font-bold text-red-400">{fmtD(totalUses)}</span>
            </div>
          </div>
        </div>
      </div>
      <div className="card p-3 mt-3 flex justify-between items-center">
        <span className="text-xs text-gray-400">Sources vs. Uses Variance</span>
        <span className={`mono font-bold ${Math.abs(totalSrc-totalUses)<1?'text-green-400':totalSrc>totalUses?'text-green-400':'text-red-400'}`}>{fmtD(totalSrc-totalUses)}</span>
      </div>

      {/* Loan Structure & Pari Passu */}
      <div className="card p-4 mt-3 space-y-4">
        {reVal>0&&(
          <div>
            <span className="text-xs font-semibold text-gray-300 uppercase tracking-wide mb-2 block">SBA Loan Structure</span>
            <div className="flex rounded overflow-hidden border border-gray-700 text-xs mb-2">
              {[['7a','7(a) Blended'],['504','7(a) + SBA 504']].map(([v,l])=>(
                <button key={v} onClick={()=>set({...state,loanStructure:v})}
                  className={`flex-1 py-2 transition-colors ${(loanStructure||'7a')===v?'bg-blue-700 text-white':'bg-gray-900 text-gray-400 hover:bg-gray-800'}`}>
                  {l}
                </button>
              ))}
            </div>
            {loanStructure==='7a'&&reVal>0&&(
              <div className="text-xs text-gray-500">Blended term: {blendedAmort}yr ({rePct.toFixed(0)}% RE × {reAmort||25}yr + {(100-rePct).toFixed(0)}% biz × {loanAmort}yr)</div>
            )}
            {loanStructure==='504'&&(
              <div className="mt-2">
                <span className="lbl">SBA 504 Debenture Rate (%)</span>
                <NI value={re504Rate||6.5} onChange={v=>set({...state,re504Rate:v})} placeholder="6.50"/>
                <div className="text-xs text-gray-500 mt-1">Fixed rate for the 504 CDC/SBA debenture (RE portion only)</div>
              </div>
            )}
          </div>
        )}
        <div>
          <span className="text-xs font-semibold text-gray-300 uppercase tracking-wide mb-2 block">
            Pari Passu Loan <span className="text-gray-600 font-normal normal-case">(optional — conventional bank loan alongside 7(a))</span>
          </span>
          <div className="grid grid-cols-3 gap-3">
            <div><span className="lbl">Loan Amount</span><NI value={ppLoan||''} onChange={v=>set({...state,ppLoan:v})} placeholder="0"/></div>
            <div><span className="lbl">Rate (%)</span><NI value={ppRate||7.5} onChange={v=>set({...state,ppRate:v})} placeholder="7.50"/></div>
            <div><span className="lbl">Term (yrs)</span><NI value={ppAmort||10} onChange={v=>set({...state,ppAmort:v})} placeholder="10"/></div>
          </div>
          {ppMo>0&&<div className="text-xs mt-1" style={{color:'#fbbf24'}}>{fmtD(ppMo)}/mo pari passu — included in all debt service calculations</div>}
        </div>
      </div>
    </div>
  );
};

/* ── Tab 5: DSCR ───────────────────────────────────── */
const T5 = ({state,set,primeRate}) => {
  const {years,ytdData,ytdEnabled,loanRate,loanAmort,dpPct,reAmort,sdeBasis,su,loanStructure,re504Rate,ppLoan,ppRate,ppAmort}=state;
  const all=ytdEnabled?[...years,ytdData]:years;
  const r=(loanRate||10.75)/100/12, n=(loanAmort||10)*12;
  const pmt=loan=>r===0?loan/n:loan*r*Math.pow(1+r,n)/(Math.pow(1+r,n)-1);
  const dp=(dpPct||10)/100;
  const basisSDE=sdeBasis==='weighted'?wtdSDE(years):recentSDE(years);
  const maxAt2x=sde=>{ if(!r)return(sde/2)/(12/n)/(1-dp); const pf=r*Math.pow(1+r,n)/(Math.pow(1+r,n)-1); return((sde/2)/(pf*12))/(1-dp); };
  // Per-year thresholds: index 0=oldest(2023), 1=middle(2024), 2=most recent(2025)
  const thresholds=[
    {green:1.5,yellow:1.25},  // oldest year
    {green:1.7,yellow:1.25},  // middle year
    {green:2.0,yellow:1.8},   // most recent year
  ];
  const dcFor=(d,idx)=>{ const t=thresholds[idx]||thresholds[2]; return d>=t.green?'text-green-400':d>=t.yellow?'text-yellow-400':'text-red-400'; };
  const dbgFor=(d,idx)=>{ const t=thresholds[idx]||thresholds[2]; return d>=t.green?'bg-green-900/30':d>=t.yellow?'bg-yellow-900/30':'bg-red-900/30'; };
  const labelFor=(d,idx)=>{ const t=thresholds[idx]||thresholds[2]; return d>=t.green?'✓ Strong':d>=t.yellow?'⚠ Marginal':'✗ Below Min'; };
  const reVal=pn(su?.reVal);
  const mp5=pn(su?.marketPrice);
  const totalProjectEst=mp5+reVal;
  const rePct=totalProjectEst>0?(reVal/totalProjectEst)*100:0;
  const basisLoan=basisSDE*3*(1-dp), basisMo=pmt(basisLoan), basisAnn=basisMo*12;
  // Seller note debt service (from Sources & Uses)
  const sfAmt=pn(su?.sellerFin), sfR=(pn(su?.sfRate)||0)/100/12, sfN=(pn(su?.sfAmort)||0)*12;
  const sfPmt=(sfAmt>0&&sfR>0&&sfN>0)?sfAmt*sfR*Math.pow(1+sfR,sfN)/(Math.pow(1+sfR,sfN)-1):0;
  const sfAnn=sfPmt*12;
  const totalAnn=basisAnn+sfAnn;
  // Deal DSCR — actual loan from Sources & Uses
  const wcVal5=pn(su?.wc), arVal5=pn(su?.arVal), invVal5=pn(su?.invVal);
  const totalProject5=mp5+reVal+wcVal5+arVal5+invVal5;
  const baseLoan5=totalProject5*(1-dp);
  const guarFee5=baseLoan5*0.75*0.035;
  const closingAmt5=su?.closing===''?0:(pn(su?.closing)||15000);
  const totalLoan5=baseLoan5+guarFee5+closingAmt5;
  let dealBizMo=0, dealREMo=0, blended5=loanAmort||10;
  if(loanStructure==='504'&&reVal>0){
    const r504=(re504Rate||6.5)/100/12, n504=(reAmort||25)*12;
    const pmt504=loan=>r504===0?loan/n504:loan*r504*Math.pow(1+r504,n504)/(Math.pow(1+r504,n504)-1);
    dealBizMo=pmt((totalProject5-reVal)*(1-dp)+guarFee5+closingAmt5);
    dealREMo=pmt504(reVal*(1-dp));
  } else {
    blended5=reVal>0
      ?Math.min(25,Math.max(10,Math.round((reVal/totalProject5)*(reAmort||25)+((totalProject5-reVal)/totalProject5)*(loanAmort||10))))
      :(loanAmort||10);
    const nB5=blended5*12;
    dealBizMo=(loan=>r===0?loan/nB5:loan*r*Math.pow(1+r,nB5)/(Math.pow(1+r,nB5)-1))(totalLoan5);
  }
  const rPP5=(ppRate||7.5)/100/12, nPP5=(ppAmort||10)*12;
  const ppMo5=(ppLoan||0)>0?(rPP5===0?(ppLoan||0)/nPP5:(ppLoan||0)*rPP5*Math.pow(1+rPP5,nPP5)/(Math.pow(1+rPP5,nPP5)-1)):0;
  const dealMonthly=dealBizMo+dealREMo+ppMo5;
  const dealAnn=dealMonthly*12+sfAnn;
  return (
    <div>
      <h2 className="text-lg font-bold text-white mb-1">DSCR Analysis</h2>
      <div className="flex items-center gap-3 mb-3">
        <span className="text-xs text-gray-400">SDE Basis:</span>
        <div className="flex rounded overflow-hidden border border-gray-700 text-xs">
          {['weighted','recent'].map(b=>(
            <button key={b} onClick={()=>set({...state,sdeBasis:b})}
              className={`py-1 px-3 transition-colors ${sdeBasis===b?'bg-blue-700 text-white':'bg-gray-900 text-gray-400 hover:bg-gray-800'}`}>
              {b==='weighted'?'Weighted Avg':'Most Recent'}
            </button>
          ))}
        </div>
      </div>
      <div className="card p-4 mb-3">
        <div className="grid grid-cols-3 gap-4">
          <div><span className="lbl">Interest Rate (%)</span><NI value={loanRate} onChange={v=>set({...state,loanRate:v})}/><div className="text-xs text-gray-500 mt-1">{primeRate?`WSJ Prime (${primeRate}%) + 2.75% = ${(primeRate+2.75).toFixed(2)}%`:'WSJ Prime + 2.75%'}</div></div>
          <div><span className="lbl">Amortization (yrs)</span><NI value={loanAmort} onChange={v=>set({...state,loanAmort:v})}/></div>
          <div><span className="lbl">Down Payment (%)</span><NI value={dpPct} onChange={v=>set({...state,dpPct:v})}/></div>
        </div>
      </div>
      {reVal>0&&(
        <div className="card p-4 mb-3" style={{borderColor:'#1e3a5f'}}>
          <div className="grid grid-cols-3 gap-4 items-start">
            <div>
              <span className="lbl">RE Amortization (yrs)</span>
              <NI value={reAmort||25} onChange={v=>set({...state,reAmort:Math.min(25,Math.max(1,v))})}/>
              <div className="text-xs text-gray-500 mt-1">SBA max: 25 yrs for real estate</div>
            </div>
            <div>
              <span className="lbl">Real Estate % of Project</span>
              <div style={{fontSize:18,fontWeight:700,color:'#94a3b8',fontFamily:'monospace'}}>{rePct.toFixed(1)}%</div>
              <div className="text-xs text-gray-500 mt-1">{fmtD(reVal)} of {fmtD(totalProjectEst)} total</div>
            </div>
            <div>
              <span className="lbl">Loan Structure</span>
              <div style={{fontSize:14,fontWeight:700,color:'#60a5fa',fontFamily:'monospace'}}>{(loanStructure||'7a')==='504'?'7(a) + 504':'7(a) Blended'}</div>
              {(loanStructure||'7a')==='7a'?(
                <div className="text-xs text-gray-500 mt-1">Blended term: {blended5}yr<br/>({rePct.toFixed(0)}% RE×{reAmort||25}yr + {(100-rePct).toFixed(0)}% biz×{loanAmort}yr)</div>
              ):(
                <div className="text-xs text-gray-500 mt-1">7(a): {loanAmort}yr · 504: {reAmort||25}yr @ {re504Rate||6.5}%</div>
              )}
            </div>
          </div>
        </div>
      )}
      {mp5>0?(
        <div className="mb-4">
          <div className="text-xs font-semibold mb-1" style={{color:'#60a5fa'}}>Deal DSCR — Actual Loan @ {fmtD(mp5)}{reVal>0?` (includes ${fmtD(reVal)} RE)`:''}</div>
          {reVal>0&&(loanStructure||'7a')==='504'&&(
            <div className="text-xs text-gray-500 mb-2">{fmtD(dealBizMo)}/mo 7(a) ({loanAmort}yr @ {loanRate}%) + {fmtD(dealREMo)}/mo 504 ({reAmort||25}yr @ {re504Rate||6.5}%){sfAnn>0?` + ${fmtD(sfPmt)}/mo seller note`:''}</div>
          )}
          {reVal>0&&(loanStructure||'7a')==='7a'&&blended5!==(loanAmort||10)&&(
            <div className="text-xs text-gray-500 mb-2">Blended {blended5}yr term · {rePct.toFixed(0)}% RE × {reAmort||25}yr + {(100-rePct).toFixed(0)}% biz × {loanAmort}yr{sfAnn>0?` + ${fmtD(sfPmt)}/mo seller note`:''}</div>
          )}
          {ppMo5>0&&<div className="text-xs text-gray-500 mb-2">+ {fmtD(ppMo5)}/mo pari passu ({ppAmort}yr @ {ppRate}%) included in debt service</div>}
          <div className="grid grid-cols-3 gap-3">
            {all.map((yd,i)=>{
              const c=calcSDE(yd), sde=c.sde;
              const dscr=dealAnn>0?sde/dealAnn:0;
              const mp=maxAt2x(sde);
              const dc=dcFor(dscr,i), dbg=dbgFor(dscr,i), lbl=labelFor(dscr,i);
              const t=thresholds[i]||thresholds[2];
              return (
                <div key={yd.year} className={`card p-4 ${dbg}`}>
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-bold text-white text-base">{yd.year}</span>
                    <div className="text-right"><div className="text-xs text-gray-400">{yd.year} SDE</div><div className={`mono font-bold ${sde>=0?'text-green-400':'text-red-400'}`}>{fmtD(sde)}</div></div>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div><span className="lbl">Deal Monthly Payment</span><div className="mono text-yellow-400">{fmtD(dealMonthly)}</div></div>
                    <div><span className="lbl">Deal Annual Debt Service</span><div className="mono text-red-400">{fmtD(dealAnn)}</div></div>
                    {sfAnn>0&&<div><span className="lbl">Incl. Seller Note Annual Service</span><div className="mono text-red-400">{fmtD(sfAnn)}</div></div>}
                    <div className="border-t border-gray-700 pt-2">
                      <span className="lbl">DSCR ({yd.year} SDE ÷ Deal DS)</span>
                      <div className={`mono font-bold text-xl ${dc}`}>{dscr>0?dscr.toFixed(2):'—'}</div>
                      <div className={`text-xs ${dc}`}>{lbl}</div>
                      <div className="text-gray-600 mt-1">≥{t.green} green · ≥{t.yellow} yellow · below red</div>
                    </div>
                    <div><span className="lbl">Max Price @ 2.0× DSCR</span><div className="mono text-blue-400">{sde>0?fmtD(mp):'—'}</div></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ):(
        <div className="grid grid-cols-3 gap-3 mb-4">
          {all.map((yd,i)=>{
            const c=calcSDE(yd), sde=c.sde;
            const dscr=totalAnn>0?sde/totalAnn:0;
            const mp=maxAt2x(sde);
            const dc=dcFor(dscr,i), dbg=dbgFor(dscr,i), lbl=labelFor(dscr,i);
            const t=thresholds[i]||thresholds[2];
            return (
              <div key={yd.year} className={`card p-4 ${dbg}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-bold text-white text-base">{yd.year}</span>
                  <div className="text-right"><div className="text-xs text-gray-400">{yd.year} SDE</div><div className={`mono font-bold ${sde>=0?'text-green-400':'text-red-400'}`}>{fmtD(sde)}</div></div>
                </div>
                <div className="space-y-2 text-xs">
                  <div><span className="lbl">SBA Annual Debt Service</span><div className="mono text-red-400">{fmtD(basisAnn)}</div></div>
                  {sfAnn>0&&<div><span className="lbl">Seller Note Annual Service</span><div className="mono text-red-400">{fmtD(sfAnn)}</div></div>}
                  {sfAnn>0&&<div><span className="lbl">Total Annual Debt Service</span><div className="mono font-bold text-red-400">{fmtD(totalAnn)}</div></div>}
                  <div className="border-t border-gray-700 pt-2">
                    <span className="lbl">DSCR ({yd.year} SDE ÷ {sfAnn>0?'Total':'SBA'} Debt Svc)</span>
                    <div className={`mono font-bold text-xl ${dc}`}>{dscr>0?dscr.toFixed(2):'—'}</div>
                    <div className={`text-xs ${dc}`}>{lbl}</div>
                    <div className="text-gray-600 mt-1">≥{t.green} green · ≥{t.yellow} yellow · below red</div>
                  </div>
                  <div><span className="lbl">Max Price @ 2.0× DSCR</span><div className="mono text-blue-400">{sde>0?fmtD(mp):'—'}</div></div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div className="card p-3 mb-4" style={{borderColor:'#1a5e35'}}>
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="text-xs font-semibold" style={{color:'#2eb860'}}>SDE × 3 Lender Sizing Reference — {sdeBasis==='weighted'?'Weighted Avg':'Most Recent'} SDE: {fmtD(basisSDE)}</div>
            <div className="text-xs text-gray-500 mt-0.5">Loan: {fmtD(basisLoan)} · {fmtD(basisMo)}/mo · {fmtD(basisAnn)}/yr{sfAnn>0?` + ${fmtD(sfAnn)}/yr seller note = ${fmtD(totalAnn)}/yr total`:''}</div>
          </div>
          <div className="flex gap-5">
            {all.map((yd,i)=>{
              const c=calcSDE(yd), sde=c.sde;
              const dscr=totalAnn>0?sde/totalAnn:0;
              const dc=dcFor(dscr,i), lbl=labelFor(dscr,i);
              return (
                <div key={yd.year} className="text-center" style={{minWidth:56}}>
                  <div className="text-xs text-gray-500">{yd.year}</div>
                  <div className={`mono font-bold text-base ${dc}`}>{dscr>0?dscr.toFixed(2):'—'}</div>
                  <div className={`text-xs ${dc}`}>{lbl}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {years.some(y=>calcSDE(y).sde>0)&&(
        <div className="card p-4 mt-2">
          <h3 className="text-sm font-bold text-gray-300 mb-3">DSCR Sensitivity — {sdeBasis==='weighted'?'Weighted Avg':'Most Recent'} SDE</h3>
          <table className="w-full text-xs">
            <thead><tr className="text-gray-500 border-b border-gray-700">
              <th className="text-left py-1 pr-3">Mult</th><th className="text-right py-1 pr-3">Price</th><th className="text-right py-1 pr-3">Loan</th><th className="text-right py-1 pr-3">Monthly</th><th className="text-right py-1 pr-3">Ann. DS</th><th className="text-right py-1">DSCR</th>
            </tr></thead>
            <tbody>
              {[2.0,2.5,3.0,3.5,4.0,4.5,5.0].map(m=>{
                const price=basisSDE*m, loan=price*(1-dp), mo=pmt(loan), sbaAnn=mo*12, totalAnnRow=sbaAnn+sfAnn, dscr=totalAnnRow>0?basisSDE/totalAnnRow:0;
                return (
                  <tr key={m} className="border-b border-gray-800">
                    <td className="py-1.5 pr-3 text-gray-400">{m.toFixed(1)}×</td>
                    <td className="py-1.5 pr-3 text-right mono">{fmtD(price)}</td>
                    <td className="py-1.5 pr-3 text-right mono">{fmtD(loan)}</td>
                    <td className="py-1.5 pr-3 text-right mono text-yellow-400">{fmtD(mo)}</td>
                    <td className="py-1.5 pr-3 text-right mono text-red-400">{fmtD(totalAnnRow)}</td>
                    <td className={`py-1.5 text-right mono font-bold ${dcFor(dscr,2)}`}>{dscr.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

/* ── Tab 6: Balance Sheet ──────────────────────────── */
const T6 = ({state,set,importBalanceSheet}) => {
  const bsArr=state.bs;
  const setBS=(yi,f,v)=>{const nb=[...bsArr];nb[yi]={...nb[yi],[f]:v};set({...state,bs:nb});};
  const assetFields=[['cash','Cash'],['ar','Accounts Receivable'],['inv','Inventory'],['ca','Total Current Assets'],['ta','Total Assets']];
  const liabFields=[['ap','Accounts Payable'],['cl','Total Current Liabilities'],['tl','Total Liabilities'],['nw','Net Worth / Equity'],['capex','Capital Expenditures']];
  const ratioRow=(label,vals)=>(
    <tr key={label} className="border-b border-gray-800">
      <td className="py-2 text-gray-400 text-xs pr-4" style={{width:'40%'}}>{label}</td>
      {vals.map((v,i)=><td key={i} className="py-2 text-right mono text-blue-300 text-xs px-2">{v}</td>)}
    </tr>
  );
  const ratios=bsArr.map((bs,i)=>{
    const rev=pn(state.years[i]?.revenue), cogs=pn(state.years[i]?.cogs);
    const ar=pn(bs.ar), ap=pn(bs.ap), inv=pn(bs.inv), ca=pn(bs.ca), cl=pn(bs.cl);
    const dAR=rev>0?(ar/rev)*365:0, dAP=cogs>0?(ap/cogs)*365:0, dInv=cogs>0?(inv/cogs)*365:0;
    const nwChg=i>0?pn(bs.nw)-pn(bsArr[i-1].nw):null;
    return {dAR,dAP,dInv,wc:ca-cl,nwChg,nw:pn(bs.nw)};
  });
  return (
    <div>
      <h2 className="text-lg font-bold text-white mb-4">Balance Sheet</h2>
      <div className="card p-4 mb-4">
        <div style={{display:'grid',gridTemplateColumns:'180px repeat(3, 1fr)',gap:'0 12px'}}>
          <div/>
          {state.years.map((y,i)=>(
            <div key={i} style={{textAlign:'center',paddingBottom:8,borderBottom:'1px solid #1e2d45',marginBottom:8}}>
              <div style={{fontWeight:700,color:'#60a5fa',fontSize:13,marginBottom:4}}>{y.year}</div>
              <button onClick={()=>importBalanceSheet(i)} style={{fontSize:10,padding:'3px 8px',background:'#1e293b',color:'#94a3b8',border:'1px solid #334155',borderRadius:4,cursor:'pointer'}}> Import PDF</button>
            </div>
          ))}
          <div style={{gridColumn:'1/-1',borderBottom:'1px solid #1e2d45',marginBottom:6}}/>
          <div style={{fontSize:11,fontWeight:700,color:'#60a5fa',padding:'4px 0',gridColumn:'1/-1'}}>Assets</div>
          {assetFields.map(([f,l])=>[
            <div key={f+'l'} style={{fontSize:11,color:'#94a3b8',display:'flex',alignItems:'center',padding:'3px 0'}}>{l}</div>,
            ...bsArr.map((bs,i)=><div key={f+i}><NI value={bs[f]} onChange={v=>setBS(i,f,v)}/></div>)
          ])}
          <div style={{fontSize:11,fontWeight:700,color:'#f87171',padding:'8px 0 4px',gridColumn:'1/-1'}}>Liabilities &amp; Equity</div>
          {liabFields.map(([f,l])=>[
            <div key={f+'l'} style={{fontSize:11,color:'#94a3b8',display:'flex',alignItems:'center',padding:'3px 0'}}>{l}</div>,
            ...bsArr.map((bs,i)=><div key={f+i}><NI value={bs[f]} onChange={v=>setBS(i,f,v)}/></div>)
          ])}
        </div>
      </div>
      <div className="card p-4">
        <h3 className="text-sm font-bold text-gray-300 mb-3">Benchmark Ratios</h3>
        <table className="w-full">
          <thead><tr className="border-b border-gray-700">
            <th style={{textAlign:'left',fontSize:11,color:'#475569',fontWeight:600,paddingBottom:6,width:'40%'}}>Metric</th>
            {state.years.map((y,i)=><th key={i} style={{textAlign:'right',fontSize:11,color:'#60a5fa',fontWeight:700,paddingBottom:6,paddingLeft:8}}>{y.year}</th>)}
          </tr></thead>
          <tbody>
            {ratioRow('Days Receivables',ratios.map(r=>r.dAR>0?r.dAR.toFixed(1)+' d':'—'))}
            {ratioRow('Days Payable',ratios.map(r=>r.dAP>0?r.dAP.toFixed(1)+' d':'—'))}
            {ratioRow('Days Inventory',ratios.map(r=>r.dInv>0?r.dInv.toFixed(1)+' d':'—'))}
            {ratioRow('Operating Cycle',ratios.map(r=>(r.dAR+r.dInv)>0?(r.dAR+r.dInv).toFixed(1)+' d':'—'))}
            {ratioRow('Working Capital',ratios.map(r=>r.wc!==0?fmtD(r.wc):'—'))}
            {ratioRow('Net Worth Chg',ratios.map(r=>r.nwChg!==null?fmtD(r.nwChg):'—'))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* ── Tab: Industry Benchmarks ──────────────────────── */
const TIndustry = ({state,set,importIndustryReport}) => {
  const ind=state.ind||{};
  const setInd=(f,v)=>set({...state,ind:{...ind,[f]:v}});
  const years=state.years;

  // Compute actuals per year
  const actuals=years.map((yd,i)=>{
    const s=calcSDE(yd);
    const bs=state.bs[i]||{};
    return {
      rev:s.rev,
      grossMarginPct:s.rev>0?(s.gp/s.rev)*100:null,
      cogsPct:s.rev>0?(s.cogs/s.rev)*100:null,
      ebitdaPct:s.rev>0?(s.ebitda/s.rev)*100:null,
      netMarginPct:s.rev>0?(s.noi/s.rev)*100:null,
      sdeMult:pn(state.su?.marketPrice)>0&&s.sde>0?pn(state.su?.marketPrice)/s.sde:null,
      ebitdaMult:pn(state.su?.marketPrice)>0&&s.ebitda>0?pn(state.su?.marketPrice)/s.ebitda:null,
    };
  });

  // Pick correct revenue-tier multiples based on most recent year revenue
  const recRev=actuals[actuals.length-1]?.rev||0;
  const tierSDE=recRev>5000000?pn(ind.sdeMultOver5M):recRev>1000000?pn(ind.sdeMult1to5M):pn(ind.sdeMultUnder1M);
  const tierEBITDA=recRev>5000000?pn(ind.ebitdaMultOver5M):recRev>1000000?pn(ind.ebitdaMult1to5M):pn(ind.ebitdaMultUnder1M);
  const tierLabel=recRev>5000000?'Over $5M':recRev>1000000?'$1M–$5M':'Under $1M';

  const badge=(actual,bench,higherBetter=true)=>{
    if(actual===null||actual===undefined||!bench)return null;
    const better=higherBetter?actual>=bench:actual<=bench;
    return <span style={{marginLeft:6,fontSize:10,fontWeight:700,color:better?'#2eb860':'#f87171'}}>{better?'▲':'▼'}</span>;
  };

  const pct=(v,dec=1)=>v!=null?v.toFixed(dec)+'%':'—';
  const mult=(v,dec=2)=>v!=null?v.toFixed(dec)+'×':'—';
  const row=(label,bench,yearVals,fmt=pct,higherBetter=true)=>(
    <tr key={label} className="border-b border-gray-800">
      <td className="py-2 text-gray-400 text-xs pr-3" style={{width:'30%'}}>{label}</td>
      <td className="py-2 text-right mono text-purple-300 text-xs px-2" style={{width:'17%'}}>{bench!=null&&bench!==''?fmt(pn(bench)):'—'}</td>
      {yearVals.map((v,i)=>(
        <td key={i} className="py-2 text-right mono text-xs px-2" style={{width:'17%',color:v!==null?'#e2e8f0':'#475569'}}>
          {v!==null?fmt(v):'—'}{badge(v,pn(bench),higherBetter)}
        </td>
      ))}
    </tr>
  );

  const hasData=ind.name||ind.grossMarginPct||ind.sdeMult;
  const askPrice=pn(state.su?.marketPrice);
  const recSDE=calcSDE(years[years.length-1]).sde;
  const recEBITDA=calcSDE(years[years.length-1]).ebitda;

  return (
    <div>
      <div className="card p-4 mb-4">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:12}}>
          <div>
            <h2 className="text-lg font-bold text-white mb-1">Industry Benchmarks</h2>
            {ind.name&&<div style={{color:'#a78bfa',fontSize:13,fontWeight:600}}>{ind.name}{ind.naics?` · NAICS ${ind.naics}`:''}</div>}
            {ind.source&&<div style={{color:'#64748b',fontSize:11,marginTop:2}}>{ind.source}{ind.reportYear?` · ${ind.reportYear}`:''}</div>}
          </div>
          <button onClick={importIndustryReport} style={{fontSize:11,padding:'6px 12px',background:'#1e293b',color:'#94a3b8',border:'1px solid #334155',borderRadius:6,cursor:'pointer',whiteSpace:'nowrap'}}> Import Industry PDF</button>
        </div>
        {!hasData&&(
          <div style={{color:'#475569',fontSize:12,fontStyle:'italic',padding:'12px 0'}}>No industry data yet. Click "Import Industry PDF" to upload a Business Brokerage Press or BizMiner report and extract benchmarks automatically.</div>
        )}
        {/* Manual overrides */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:8,marginTop:8}}>
          {[['name','Industry Name'],['naics','NAICS Code'],['source','Report Source'],['reportYear','Report Year']].map(([f,l])=>(
            <div key={f}>
              <div style={{fontSize:10,color:'#64748b',marginBottom:3}}>{l}</div>
              <input className="input-field" style={{fontSize:11}} value={ind[f]||''} onChange={e=>setInd(f,e.target.value)} placeholder={l}/>
            </div>
          ))}
        </div>
      </div>

      {/* Income Comparison */}
      <div className="card p-4 mb-4">
        <h3 className="text-sm font-bold text-gray-300 mb-3">Income Statement Comparison</h3>
        <table className="w-full">
          <thead><tr className="border-b border-gray-700">
            <th style={{textAlign:'left',fontSize:10,color:'#475569',fontWeight:600,paddingBottom:6,width:'30%'}}>Metric</th>
            <th style={{textAlign:'right',fontSize:10,color:'#a78bfa',fontWeight:700,paddingBottom:6,paddingLeft:8,width:'17%'}}>Industry Avg</th>
            {years.map((y,i)=><th key={i} style={{textAlign:'right',fontSize:10,color:'#60a5fa',fontWeight:700,paddingBottom:6,paddingLeft:8,width:'17%'}}>{y.year}</th>)}
          </tr></thead>
          <tbody>
            {row('Gross Margin %',ind.grossMarginPct,actuals.map(a=>a.grossMarginPct))}
            {row('COGS %',ind.cogsPct,actuals.map(a=>a.cogsPct),pct,false)}
            {row('EBITDA %',null,actuals.map(a=>a.ebitdaPct))}
            {row('Pre-Tax Profit %',ind.preTaxProfitPct,actuals.map(a=>a.netMarginPct))}
            {row('Net Income %',ind.netMarginPct,actuals.map(a=>a.netMarginPct))}
          </tbody>
        </table>
        <div style={{fontSize:10,color:'#475569',marginTop:8}}>▲ above benchmark · ▼ below benchmark · Industry Avg from imported report</div>
      </div>

      {/* Valuation Comparison */}
      <div className="card p-4 mb-4">
        <h3 className="text-sm font-bold text-gray-300 mb-1">Valuation Comparison</h3>
        {recRev>0&&<div style={{fontSize:10,color:'#64748b',marginBottom:10}}>Revenue tier: <span style={{color:'#60a5fa',fontWeight:600}}>{tierLabel}</span> (based on most recent year revenue {fmtD(recRev)})</div>}
        <table className="w-full">
          <thead><tr className="border-b border-gray-700">
            <th style={{textAlign:'left',fontSize:10,color:'#475569',fontWeight:600,paddingBottom:6,width:'40%'}}>Metric</th>
            <th style={{textAlign:'right',fontSize:10,color:'#a78bfa',fontWeight:700,paddingBottom:6,paddingLeft:8}}>Industry</th>
            <th style={{textAlign:'right',fontSize:10,color:'#60a5fa',fontWeight:700,paddingBottom:6,paddingLeft:8}}>This Deal</th>
          </tr></thead>
          <tbody>
            <tr className="border-b border-gray-800">
              <td className="py-2 text-gray-400 text-xs pr-3">Rules of Thumb — x SDE</td>
              <td className="py-2 text-right mono text-purple-300 text-xs px-2">{ind.sdeMult?pn(ind.sdeMult)+'×':'—'}</td>
              <td className="py-2 text-right mono text-xs px-2" style={{color:'#e2e8f0'}}>{askPrice>0&&recSDE>0?(askPrice/recSDE).toFixed(2)+'×':'—'}</td>
            </tr>
            <tr className="border-b border-gray-800">
              <td className="py-2 text-gray-400 text-xs pr-3">Rules of Thumb — x EBITDA</td>
              <td className="py-2 text-right mono text-purple-300 text-xs px-2">{ind.ebitdaMult?pn(ind.ebitdaMult)+'×':'—'}</td>
              <td className="py-2 text-right mono text-xs px-2" style={{color:'#e2e8f0'}}>{askPrice>0&&recEBITDA>0?(askPrice/recEBITDA).toFixed(2)+'×':'—'}</td>
            </tr>
            <tr className="border-b border-gray-800">
              <td className="py-2 text-gray-400 text-xs pr-3">Rules of Thumb — % of Annual Sales</td>
              <td className="py-2 text-right mono text-purple-300 text-xs px-2">{ind.revenueMultPct?pn(ind.revenueMultPct)+'%':'—'}</td>
              <td className="py-2 text-right mono text-xs px-2" style={{color:'#e2e8f0'}}>{askPrice>0&&recRev>0?pct(askPrice/recRev*100):'—'}</td>
            </tr>
            <tr className="border-b border-gray-800">
              <td className="py-2 text-gray-400 text-xs pr-3">MVIC/SDE — {tierLabel} tier</td>
              <td className="py-2 text-right mono text-purple-300 text-xs px-2">{tierSDE>0?tierSDE.toFixed(2)+'×':'—'}</td>
              <td className="py-2 text-right mono text-xs px-2" style={{color:'#e2e8f0'}}>{askPrice>0&&recSDE>0?(askPrice/recSDE).toFixed(2)+'×':'—'}</td>
            </tr>
            <tr className="border-b border-gray-800">
              <td className="py-2 text-gray-400 text-xs pr-3">MVIC/EBITDA — {tierLabel} tier</td>
              <td className="py-2 text-right mono text-purple-300 text-xs px-2">{tierEBITDA>0?tierEBITDA.toFixed(2)+'×':'—'}</td>
              <td className="py-2 text-right mono text-xs px-2" style={{color:'#e2e8f0'}}>{askPrice>0&&recEBITDA>0?(askPrice/recEBITDA).toFixed(2)+'×':'—'}</td>
            </tr>
          </tbody>
        </table>
        {/* Implied values from industry multiples */}
        {(tierSDE>0||pn(ind.sdeMult)>0)&&recSDE>0&&(
          <div style={{marginTop:12,padding:'10px 12px',background:'#0f1623',borderRadius:6,border:'1px solid #1e2d45'}}>
            <div style={{fontSize:10,color:'#64748b',marginBottom:6,fontWeight:600}}>IMPLIED VALUE RANGE (based on most recent SDE of {fmtD(recSDE)})</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8}}>
              {pn(ind.sdeMultUnder1M)>0&&<div style={{textAlign:'center'}}><div style={{fontSize:9,color:'#64748b'}}>Under $1M tier</div><div style={{color:'#a78bfa',fontWeight:700,fontSize:13}}>{fmtD(recSDE*pn(ind.sdeMultUnder1M))}</div><div style={{fontSize:9,color:'#475569'}}>{pn(ind.sdeMultUnder1M).toFixed(2)}× SDE</div></div>}
              {pn(ind.sdeMult1to5M)>0&&<div style={{textAlign:'center'}}><div style={{fontSize:9,color:'#64748b'}}>$1M–$5M tier</div><div style={{color:'#a78bfa',fontWeight:700,fontSize:13}}>{fmtD(recSDE*pn(ind.sdeMult1to5M))}</div><div style={{fontSize:9,color:'#475569'}}>{pn(ind.sdeMult1to5M).toFixed(2)}× SDE</div></div>}
              {pn(ind.sdeMultOver5M)>0&&<div style={{textAlign:'center'}}><div style={{fontSize:9,color:'#64748b'}}>Over $5M tier</div><div style={{color:'#a78bfa',fontWeight:700,fontSize:13}}>{fmtD(recSDE*pn(ind.sdeMultOver5M))}</div><div style={{fontSize:9,color:'#475569'}}>{pn(ind.sdeMultOver5M).toFixed(2)}× SDE</div></div>}
            </div>
            {askPrice>0&&<div style={{marginTop:8,paddingTop:8,borderTop:'1px solid #1e2d45',fontSize:11,color:'#94a3b8'}}>
              Asking price: <span style={{color:'#fbbf24',fontWeight:700}}>{fmtD(askPrice)}</span>
              {tierSDE>0&&<span style={{marginLeft:12}}>vs. {tierLabel} tier implied: <span style={{fontWeight:700,color:askPrice<=recSDE*tierSDE*1.1?'#2eb860':'#f87171'}}>{fmtD(recSDE*tierSDE)}</span></span>}
            </div>}
          </div>
        )}
      </div>

      {/* All Multiples Reference */}
      {(pn(ind.sdeMultUnder1M)||pn(ind.sdeMult1to5M)||pn(ind.sdeMultOver5M))>0&&(
        <div className="card p-4">
          <h3 className="text-sm font-bold text-gray-300 mb-3">Industry Multiples — All Tiers</h3>
          <table className="w-full">
            <thead><tr className="border-b border-gray-700">
              <th style={{textAlign:'left',fontSize:10,color:'#475569',fontWeight:600,paddingBottom:6}}>Revenue Tier</th>
              <th style={{textAlign:'right',fontSize:10,color:'#60a5fa',fontWeight:700,paddingBottom:6}}>MVIC/SDE</th>
              <th style={{textAlign:'right',fontSize:10,color:'#34d399',fontWeight:700,paddingBottom:6}}>MVIC/EBITDA</th>
            </tr></thead>
            <tbody>
              {[['Under $1M','sdeMultUnder1M','ebitdaMultUnder1M'],['$1M – $5M','sdeMult1to5M','ebitdaMult1to5M'],['Over $5M','sdeMultOver5M','ebitdaMultOver5M']].map(([label,sF,eF])=>(
                <tr key={label} className="border-b border-gray-800">
                  <td className="py-2 text-gray-400 text-xs">{label}{tierLabel===label.replace(' Net Sales','')&&<span style={{marginLeft:6,fontSize:9,color:'#60a5fa',fontWeight:700}}>← this deal</span>}</td>
                  <td className="py-2 text-right mono text-blue-300 text-xs">{pn(ind[sF])>0?pn(ind[sF]).toFixed(2)+'×':'—'}</td>
                  <td className="py-2 text-right mono text-green-300 text-xs">{pn(ind[eF])>0?pn(ind[eF]).toFixed(2)+'×':'—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

/* ── Buyer ROI Tab ─────────────────────────────────── */
const TBuyerROI = ({state,set}) => {
  const {years,loanRate,loanAmort,dpPct,sdeBasis,su,ind,roi={}}=state;
  const setROI=(f,v)=>set({...state,roi:{...roi,[f]:v}});

  // Loan mechanics (same pattern as T5)
  const r=(loanRate||10.75)/100/12, n=(loanAmort||10)*12;
  const pmtFn=loan=>r===0?loan/n:loan*r*Math.pow(1+r,n)/(Math.pow(1+r,n)-1);
  const dp=(dpPct||10)/100;

  // Deal amounts from S&U
  const mp=pn(su?.marketPrice);
  const dpAmt=mp*dp;
  const sfAmt=pn(su?.sellerFin);
  const sbaLoan=Math.max(0,mp*(1-dp)-sfAmt);
  const sbaMonthly=pmtFn(sbaLoan);
  const sbaAnnual=sbaMonthly*12;
  const sfR=(pn(su?.sfRate)||0)/100/12, sfN=(pn(su?.sfAmort)||0)*12;
  const sfMonthly=sfAmt>0&&sfR>0&&sfN>0?sfAmt*sfR*Math.pow(1+sfR,sfN)/(Math.pow(1+sfR,sfN)-1):0;
  const sfAnnual=sfMonthly*12;
  const totalDS=sbaAnnual+sfAnnual;
  const closing=(su?.closing===''||su?.closing===undefined)?15000:pn(su?.closing);
  const sbaFeeAmt=sbaLoan*0.75*0.035;
  const totalCash=dpAmt+closing+sbaFeeAmt+pn(su?.wc);
  const leverage=totalCash>0?mp/totalCash:0;

  // SDE
  const sde=sdeBasis==='weighted'?wtdSDE(years):recentSDE(years);
  const basisLabel=sdeBasis==='weighted'?'Weighted Avg':'Most Recent';
  const netCF=sde-totalDS;
  const cashOnCash=totalCash>0?netCF/totalCash*100:0;

  // Year-1 loan paydown (principal paid in first 12 payments)
  const yr1Prin=(loan,rate,monthly)=>{
    let bal=loan,prin=0;
    if(!rate||!monthly)return 0;
    for(let m=0;m<12;m++){const int=bal*rate;const p=monthly-int;prin+=p;bal-=p;if(bal<=0)break;}
    return Math.max(0,prin);
  };
  const sbaEquityY1=yr1Prin(sbaLoan,r,sbaMonthly);
  const sfEquityY1=sfAmt>0&&sfR>0?yr1Prin(sfAmt,sfR,sfMonthly):0;
  const totalEquityY1=sbaEquityY1+sfEquityY1;
  const totalReturnY1=netCF+totalEquityY1;
  const effectiveROI=totalCash>0?totalReturnY1/totalCash*100:0;
  const paybackYrs=netCF>0?totalCash/netCF:null;

  // Remaining loan balance after N years
  const remBal=(loan,rate,monthly,yrs)=>{
    if(!rate||!monthly||loan<=0)return 0;
    let bal=loan;
    for(let m=0;m<yrs*12;m++){const int=bal*rate;bal-=(monthly-int);if(bal<=0)return 0;}
    return Math.max(0,bal);
  };

  // Projection
  const growth=pn(roi.growthPct||'0')/100;
  const exitYrs=Math.min(30,Math.max(1,pn(roi.exitYears||'10')));
  const autoMult=pn(ind?.sdeMult)||3.5;
  const exitMult=pn(roi.exitMultiple)||autoMult;
  let cumulativeCF=0;
  const yearRows=[];
  for(let y=1;y<=exitYrs;y++){
    const yearSDE=sde*Math.pow(1+growth,y-1);
    const yearCF=yearSDE-totalDS;
    cumulativeCF+=Math.max(0,yearCF);
    yearRows.push({y,yearSDE,yearCF,cumulativeCF});
  }
  const exitSDE=sde*Math.pow(1+growth,exitYrs-1);
  const terminalValue=exitSDE*exitMult;
  const sbaRem=remBal(sbaLoan,r,sbaMonthly,exitYrs);
  const sfRem=sfAmt>0&&sfR>0?remBal(sfAmt,sfR,sfMonthly,exitYrs):0;
  const netExitProceeds=terminalValue-sbaRem-sfRem;
  const totalWealth=cumulativeCF+netExitProceeds;
  const totalROI=totalCash>0?totalWealth/totalCash*100:0;
  const cagr=totalCash>0&&exitYrs>0?Math.pow(totalWealth/totalCash,1/exitYrs)-1:0;

  // Exit scenarios
  const scenarios=[
    {label:'Conservative',mult:Math.max(1,exitMult-1)},
    {label:'Market',mult:exitMult},
    {label:'Premium',mult:exitMult+1},
  ];
  const scenarioCalc=mult=>{
    const tv=exitSDE*mult;
    const net=tv-sbaRem-sfRem;
    const total=cumulativeCF+net;
    const roi2=totalCash>0?total/totalCash*100:0;
    const cagr2=totalCash>0&&exitYrs>0?Math.pow(total/totalCash,1/exitYrs)-1:0;
    return {tv,net,total,roi2,cagr2};
  };

  const noData=mp===0||sde===0;
  const stat=(label,val,color='#e2e8f0',sub)=>(
    <div style={{textAlign:'center',padding:'12px 16px',background:'#0f1623',borderRadius:8,border:'1px solid #1e2d45'}}>
      <div style={{fontSize:10,color:'#64748b',marginBottom:4,fontWeight:600,textTransform:'uppercase',letterSpacing:'.04em'}}>{label}</div>
      <div style={{fontFamily:'monospace',fontWeight:800,fontSize:18,color}}>{val}</div>
      {sub&&<div style={{fontSize:10,color:'#475569',marginTop:3}}>{sub}</div>}
    </div>
  );

  if(noData) return (
    <div>
      <h2 className="text-lg font-bold text-white mb-4">Buyer ROI Analysis</h2>
      <div className="card p-6" style={{textAlign:'center',color:'#475569',fontSize:13}}>
        Enter deal data in <strong style={{color:'#94a3b8'}}>Sources & Uses</strong> (market price) and <strong style={{color:'#94a3b8'}}>Income Statement</strong> (SDE) to see buyer ROI analysis.
      </div>
    </div>
  );

  return (
    <div>
      <h2 className="text-lg font-bold text-white mb-1">Buyer ROI Analysis</h2>
      <div style={{fontSize:11,color:'#64748b',marginBottom:16}}>SDE Basis: <span style={{color:'#60a5fa'}}>{basisLabel} — {fmtD(sde)}</span> · Asking Price: <span style={{color:'#60a5fa'}}>{fmtD(mp)}</span></div>

      {/* Card 1 — Investment Summary */}
      <div className="card p-4 mb-4">
        <h3 className="text-sm font-bold text-gray-300 mb-3">Investment Summary — Cash to Close</h3>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr) 1.3fr',gap:8,marginBottom:12}}>
          {[
            ['Down Payment',dpAmt,`${dpPct||10}% of price`],
            ['SBA Guarantee Fee',sbaFeeAmt,'0.75% × loan × 3.5%'],
            ['Closing Costs',closing,'Est. closing/legal'],
            ['Working Capital',pn(su?.wc)||0,'From S&U'],
            ['Total Cash to Close',totalCash,'All-in investment'],
          ].map(([l,v,s],i)=>(
            <div key={i} style={{textAlign:'center',padding:'10px 8px',background:i===4?'#071a0b':'#0f1623',borderRadius:7,border:`1px solid ${i===4?'#1a5e35':'#1e2d45'}`}}>
              <div style={{fontSize:9,color:'#64748b',marginBottom:3,fontWeight:600,textTransform:'uppercase'}}>{l}</div>
              <div style={{fontFamily:'monospace',fontWeight:700,fontSize:14,color:i===4?'#2eb860':'#e2e8f0'}}>{fmtD(v)}</div>
              <div style={{fontSize:9,color:'#475569',marginTop:2}}>{s}</div>
            </div>
          ))}
        </div>
        <div style={{background:'#0d1623',borderRadius:6,padding:'10px 14px',border:'1px solid #1e3a5f',display:'flex',alignItems:'center',gap:8}}>
          <span style={{fontSize:18}}></span>
          <span style={{fontSize:12,color:'#93c5fd'}}>
            <strong style={{color:'#60a5fa'}}>{fmtD(totalCash)}</strong> invested controls a <strong style={{color:'#60a5fa'}}>{fmtD(mp)}</strong> business — <strong style={{color:'#fbbf24'}}>{leverage.toFixed(1)}:1 leverage</strong> via SBA financing
          </span>
        </div>
      </div>

      {/* Card 2 — Year 1 Returns */}
      <div className="card p-4 mb-4">
        <h3 className="text-sm font-bold text-gray-300 mb-3">Year 1 Returns</h3>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
          {/* Waterfall */}
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
            <thead><tr style={{borderBottom:'1px solid #1e2d45'}}>
              <th style={{textAlign:'left',color:'#475569',paddingBottom:6,fontSize:10,fontWeight:600}}>Component</th>
              <th style={{textAlign:'right',color:'#64748b',paddingBottom:6,fontSize:10}}>Annual</th>
              <th style={{textAlign:'right',color:'#64748b',paddingBottom:6,fontSize:10}}>Monthly</th>
            </tr></thead>
            <tbody>
              <tr style={{borderBottom:'1px solid #0f1623'}}>
                <td style={{padding:'6px 0',color:'#94a3b8'}}>Seller's Discretionary Earnings</td>
                <td style={{textAlign:'right',fontFamily:'monospace',color:'#2eb860',paddingLeft:8}}>{fmtD(sde)}</td>
                <td style={{textAlign:'right',fontFamily:'monospace',color:'#2eb860',paddingLeft:8}}>{fmtD(sde/12)}</td>
              </tr>
              <tr style={{borderBottom:'1px solid #0f1623'}}>
                <td style={{padding:'6px 0',color:'#94a3b8',paddingLeft:8}}>− SBA Loan Payment</td>
                <td style={{textAlign:'right',fontFamily:'monospace',color:'#f87171',paddingLeft:8}}>({fmtD(sbaAnnual)})</td>
                <td style={{textAlign:'right',fontFamily:'monospace',color:'#f87171',paddingLeft:8}}>({fmtD(sbaMonthly)})</td>
              </tr>
              {sfAnnual>0&&<tr style={{borderBottom:'1px solid #0f1623'}}>
                <td style={{padding:'6px 0',color:'#94a3b8',paddingLeft:8}}>− Seller Financing</td>
                <td style={{textAlign:'right',fontFamily:'monospace',color:'#f87171',paddingLeft:8}}>({fmtD(sfAnnual)})</td>
                <td style={{textAlign:'right',fontFamily:'monospace',color:'#f87171',paddingLeft:8}}>({fmtD(sfMonthly)})</td>
              </tr>}
              <tr style={{borderBottom:'1px solid #1e2d45',background:'#071a0b'}}>
                <td style={{padding:'7px 0',color:'#2eb860',fontWeight:700}}>Net Cash Flow</td>
                <td style={{textAlign:'right',fontFamily:'monospace',color:netCF>=0?'#2eb860':'#f87171',fontWeight:700,paddingLeft:8}}>{netCF>=0?fmtD(netCF):`(${fmtD(Math.abs(netCF))})`}</td>
                <td style={{textAlign:'right',fontFamily:'monospace',color:netCF>=0?'#2eb860':'#f87171',fontWeight:700,paddingLeft:8}}>{netCF>=0?fmtD(netCF/12):`(${fmtD(Math.abs(netCF)/12)})`}</td>
              </tr>
              <tr style={{borderBottom:'1px solid #0f1623'}}>
                <td style={{padding:'6px 0',color:'#94a3b8'}}>+ Equity Built (Loan Paydown)</td>
                <td style={{textAlign:'right',fontFamily:'monospace',color:'#a78bfa',paddingLeft:8}}>{fmtD(totalEquityY1)}</td>
                <td style={{textAlign:'right',fontFamily:'monospace',color:'#a78bfa',paddingLeft:8}}>{fmtD(totalEquityY1/12)}</td>
              </tr>
              <tr style={{background:'#0d0f1a'}}>
                <td style={{padding:'7px 0',color:'#e2e8f0',fontWeight:700}}>Total Economic Return</td>
                <td style={{textAlign:'right',fontFamily:'monospace',color:'#e2e8f0',fontWeight:700,paddingLeft:8}}>{fmtD(totalReturnY1)}</td>
                <td style={{textAlign:'right',fontFamily:'monospace',color:'#e2e8f0',fontWeight:700,paddingLeft:8}}>{fmtD(totalReturnY1/12)}</td>
              </tr>
            </tbody>
          </table>
          {/* Headline metrics */}
          <div style={{display:'flex',flexDirection:'column',gap:8,justifyContent:'center'}}>
            {stat('Cash-on-Cash Return',cashOnCash.toFixed(1)+'%',cashOnCash>=15?'#2eb860':cashOnCash>=10?'#fbbf24':'#f87171','Net CF ÷ Total Cash Invested')}
            {stat('Total ROI (incl. equity)',effectiveROI.toFixed(1)+'%','#a78bfa','CF + Loan Paydown ÷ Investment')}
            {stat('Payback Period',paybackYrs?paybackYrs.toFixed(1)+' yrs':'N/A',paybackYrs&&paybackYrs<7?'#2eb860':'#fbbf24','Years to recover full investment')}
          </div>
        </div>
      </div>

      {/* Card 3 — Projection */}
      <div className="card p-4 mb-4">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
          <h3 className="text-sm font-bold text-gray-300">{exitYrs}-Year Wealth Projection</h3>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            {[['growthPct','Growth %','0'],['exitYears','Exit Yr','10'],['exitMultiple',`Exit Mult (auto: ${autoMult}×)`,'']].map(([f,l,ph])=>(
              <div key={f} style={{display:'flex',flexDirection:'column',alignItems:'center'}}>
                <div style={{fontSize:9,color:'#64748b',marginBottom:2}}>{l}</div>
                <input className="input-field" style={{width:70,fontSize:11,textAlign:'center'}}
                  value={roi[f]??''} onChange={e=>setROI(f,e.target.value)} placeholder={ph}/>
              </div>
            ))}
          </div>
        </div>
        <div style={{maxHeight:220,overflowY:'auto',marginBottom:12}}>
          <table className="w-full" style={{fontSize:11}}>
            <thead style={{position:'sticky',top:0,background:'#161b27'}}>
              <tr style={{borderBottom:'1px solid #1e2d45'}}>
                <th style={{textAlign:'left',color:'#475569',fontWeight:600,paddingBottom:5,paddingRight:8}}>Yr</th>
                <th style={{textAlign:'right',color:'#60a5fa',fontWeight:600,paddingBottom:5,paddingLeft:8}}>SDE</th>
                <th style={{textAlign:'right',color:netCF>=0?'#2eb860':'#f87171',fontWeight:600,paddingBottom:5,paddingLeft:8}}>Annual CF</th>
                <th style={{textAlign:'right',color:'#94a3b8',fontWeight:600,paddingBottom:5,paddingLeft:8}}>Cumulative CF</th>
              </tr>
            </thead>
            <tbody>
              {yearRows.map(({y,yearSDE,yearCF,cumulativeCF:cumCF})=>(
                <tr key={y} style={{borderBottom:'1px solid #0f1623',background:y===exitYrs?'#0d1623':'transparent'}}>
                  <td style={{padding:'4px 8px 4px 0',color:y===exitYrs?'#fbbf24':'#64748b',fontWeight:y===exitYrs?700:400}}>{y}{y===exitYrs&&' ★'}</td>
                  <td style={{textAlign:'right',fontFamily:'monospace',color:'#60a5fa',paddingLeft:8}}>{fmtD(yearSDE)}</td>
                  <td style={{textAlign:'right',fontFamily:'monospace',color:yearCF>=0?'#2eb860':'#f87171',paddingLeft:8}}>{yearCF>=0?fmtD(yearCF):`(${fmtD(Math.abs(yearCF))})`}</td>
                  <td style={{textAlign:'right',fontFamily:'monospace',color:'#94a3b8',paddingLeft:8}}>{fmtD(cumCF)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{background:'#071a0b',borderRadius:7,padding:'12px 14px',border:'1px solid #1a5e35'}}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
            {[
              ['Cumulative Cash Flow',fmtD(cumulativeCF),'#2eb860'],
              ['+ Net Exit Proceeds',fmtD(netExitProceeds),'#a78bfa'],
              ['= Total Wealth Created',fmtD(totalWealth),'#fbbf24'],
              ['Annualized CAGR',(cagr*100).toFixed(1)+'%',cagr>=0.15?'#2eb860':cagr>=0.10?'#fbbf24':'#f87171'],
            ].map(([l,v,c])=>(
              <div key={l} style={{textAlign:'center'}}>
                <div style={{fontSize:9,color:'#64748b',marginBottom:3,fontWeight:600,textTransform:'uppercase'}}>{l}</div>
                <div style={{fontFamily:'monospace',fontWeight:800,fontSize:15,color:c}}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{fontSize:10,color:'#475569',marginTop:8}}>Exit value = {exitYrs}-yr SDE × {exitMult}× multiple · Remaining debt deducted · Based on {basisLabel} SDE of {fmtD(sde)}</div>
        </div>
      </div>

      {/* Card 4 — Exit Scenarios */}
      <div className="card p-4">
        <h3 className="text-sm font-bold text-gray-300 mb-3">Exit Scenarios — Year {exitYrs}</h3>
        <table className="w-full" style={{fontSize:12}}>
          <thead><tr style={{borderBottom:'1px solid #1e2d45'}}>
            <th style={{textAlign:'left',color:'#475569',fontWeight:600,paddingBottom:6,width:'35%'}}></th>
            {scenarios.map(s=>(
              <th key={s.label} style={{textAlign:'center',color:s.label==='Market'?'#fbbf24':'#64748b',fontWeight:700,paddingBottom:6,paddingLeft:8}}>{s.label}<div style={{fontSize:9,fontWeight:400,color:'#475569'}}>{s.mult.toFixed(1)}× SDE</div></th>
            ))}
          </tr></thead>
          <tbody>
            {[
              ['Business Value at Exit', s=>fmtD(exitSDE*s.mult), ''],
              ['− Remaining Debt', ()=>`(${fmtD(sbaRem+sfRem)})`, '#f87171'],
              ['+ Cumulative Cash Flow', ()=>fmtD(cumulativeCF), '#2eb860'],
              ['= Total Return', s=>fmtD(scenarioCalc(s.mult).total), '#fbbf24', true],
              ['Total ROI on Investment', s=>scenarioCalc(s.mult).roi2.toFixed(0)+'%', '#a78bfa', true],
              ['Annualized CAGR', s=>(scenarioCalc(s.mult).cagr2*100).toFixed(1)+'%', '#34d399', true],
            ].map(([label,valFn,color,bold])=>(
              <tr key={label} style={{borderBottom:'1px solid #0f1623'}}>
                <td style={{padding:'6px 0',color:'#94a3b8',fontSize:11}}>{label}</td>
                {scenarios.map(s=>{
                  const v=typeof valFn==='function'?valFn(s):valFn;
                  return <td key={s.label} style={{textAlign:'center',fontFamily:'monospace',paddingLeft:8,color:color||'#e2e8f0',fontWeight:bold?700:400}}>{v}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{fontSize:10,color:'#475569',marginTop:10}}>* Exit SDE = {fmtD(exitSDE)} (Year {exitYrs} with {(growth*100).toFixed(1)}% annual growth) · Remaining SBA loan balance: {fmtD(sbaRem)}</div>
      </div>
    </div>
  );
};

/* ── Tab: Seller Reality Check ─────────────────────── */
const TSeller = ({state, set}) => {
  const {years, sdeBasis, loanRate, loanAmort, dpPct, reAmort, su, loanStructure, re504Rate, ppLoan, ppRate, ppAmort} = state;
  const seller = state.seller || {askingPrice:'', buyerSalary:'', contingencyPct:'10'};
  const setSeller = (f, v) => set({...state, seller:{...seller, [f]:v}});

  const sde = sdeBasis==='weighted' ? wtdSDE(years) : recentSDE(years);
  const basisLabel = sdeBasis==='weighted' ? 'Weighted Avg' : 'Most Recent';
  const dp = (dpPct||10)/100;
  const r = (loanRate||10.75)/100/12, n = (loanAmort||10)*12;
  const pmtFn = loan => r===0 ? loan/n : loan*r*Math.pow(1+r,n)/(Math.pow(1+r,n)-1);
  const reVal = pn(su?.reVal);

  // Blended amort based on actual S&U totalProject
  const mp5S=pn(su?.marketPrice);
  const totalProjectS=mp5S+reVal+pn(su?.wc)+pn(su?.arVal)+pn(su?.invVal);
  const blendedAmortS=totalProjectS>0&&reVal>0
    ?Math.min(25,Math.max(10,Math.round((reVal/totalProjectS)*(reAmort||25)+((totalProjectS-reVal)/totalProjectS)*(loanAmort||10))))
    :(loanAmort||10);
  const nBlendS=blendedAmortS*12;
  const blendedPmtS=loan=>r===0?loan/nBlendS:loan*r*Math.pow(1+r,nBlendS)/(Math.pow(1+r,nBlendS)-1);
  const r504S=(re504Rate||6.5)/100/12, n504S=(reAmort||25)*12;
  const pmt504S=loan=>r504S===0?loan/n504S:loan*r504S*Math.pow(1+r504S,n504S)/(Math.pow(1+r504S,n504S)-1);
  const rPPS=(ppRate||7.5)/100/12, nPPS=(ppAmort||10)*12;
  const ppMoS=(ppLoan||0)>0?(rPPS===0?(ppLoan||0)/nPPS:(ppLoan||0)*rPPS*Math.pow(1+rPPS,nPPS)/(Math.pow(1+rPPS,nPPS)-1)):0;

  const monthlyAtPrice = price => {
    if(!price||price<=0) return ppMoS;
    if((loanStructure||'7a')==='504'&&reVal>0){
      const reComp=Math.min(reVal,price), bizComp=price-reComp;
      return pmtFn(bizComp*(1-dp))+pmt504S(reComp*(1-dp))+ppMoS;
    }
    return blendedPmtS(price*(1-dp))+ppMoS;
  };

  const askingPrice = pn(seller.askingPrice);
  const advisorPrice = pn(su?.marketPrice);
  const buyerSalary = pn(seller.buyerSalary);
  const contingencyPct = pn(seller.contingencyPct) || 10;

  const maxSupportable = (dscrTarget, salary) => {
    const adjSDE = sde - salary;
    if(adjSDE <= 0) return 0;
    let lo=0,hi=20000000,iters=0;
    while(hi-lo>100&&iters++<60){
      const mid=(lo+hi)/2;
      if(monthlyAtPrice(mid)*12<adjSDE/dscrTarget) lo=mid; else hi=mid;
    }
    return (lo+hi)/2;
  };

  const dscrMetrics = price => {
    if(!price||price<=0) return null;
    const monthlyPmt = monthlyAtPrice(price);
    const annualDS = monthlyPmt*12;
    const rawDSCR = annualDS>0 ? sde/annualDS : 0;
    const adjDSCR = annualDS>0 ? (sde-buyerSalary)/annualDS : 0;
    const contingencyAmt = sde*(contingencyPct/100);
    const cashLeft = sde - buyerSalary - annualDS - contingencyAmt;
    return {loan:price*(1-dp), monthlyPmt, annualDS, rawDSCR, adjDSCR, contingencyAmt, cashLeft};
  };

  const max125 = maxSupportable(1.25, buyerSalary);
  const askMetrics = dscrMetrics(askingPrice);
  const advisorMetrics = dscrMetrics(advisorPrice);
  const max125Metrics = dscrMetrics(max125);

  const dscrColor = d => d>=1.5 ? '#2eb860' : d>=1.25 ? '#fbbf24' : '#f87171';
  const cashColor = v => v>0 ? '#2eb860' : '#f87171';
  const statusBadge = m => {
    if(!m) return <span style={{color:'#475569'}}>—</span>;
    if(m.adjDSCR>=1.5) return <span style={{color:'#2eb860',fontWeight:700}}>✅ Strong</span>;
    if(m.adjDSCR>=1.25) return <span style={{color:'#fbbf24',fontWeight:700}}>⚠ Marginal</span>;
    return <span style={{color:'#f87171',fontWeight:700}}>❌ Below Min</span>;
  };

  const prices = [askingPrice, advisorPrice, max125];
  const mets = [askMetrics, advisorMetrics, max125Metrics];
  const colLabels = ["Seller's Price", "Advisor's Price", "Max @ 1.25×"];
  const colColors = ['#f87171', '#2eb860', '#60a5fa'];

  const adjSDE = sde - buyerSalary;
  const contAmt = sde * (contingencyPct/100);

  const tRow = (lbl, vals, getColor, bold=false, isDscr=false) => (
    <tr style={{borderBottom:'1px solid #0d1117', background:bold?'#071a0b':'transparent'}}>
      <td style={{padding:'5px 0',color:'#94a3b8',fontSize:11,fontWeight:bold?700:400,paddingLeft:bold?0:8}}>{lbl}</td>
      {vals.map((v,i) => v==null
        ? <td key={i} style={{textAlign:'right',color:'#475569',padding:'5px 12px'}}>—</td>
        : <td key={i} style={{textAlign:'right',fontFamily:'monospace',fontSize:isDscr?13:11,fontWeight:isDscr||bold?700:400,color:getColor?getColor(v,i):'#e2e8f0',padding:'5px 12px'}}>
            {isDscr ? v.toFixed(2) : fmtD(v)}
          </td>
      )}
    </tr>
  );

  const talkingPoints = () => {
    if(!sde) return 'Enter financial data on the Income Statement tab to generate talking points.';
    const lines = [];
    if(askingPrice>0&&askMetrics){
      lines.push(`At your asking price of ${fmtD(askingPrice)}, the raw DSCR is ${askMetrics.rawDSCR.toFixed(2)}${askMetrics.rawDSCR<1.25?' — well below the 1.25× minimum SBA lenders require':askMetrics.rawDSCR<1.5?' — near the SBA minimum of 1.25×':''}.`);
      if(buyerSalary>0) lines.push(`After accounting for a ${fmtD(buyerSalary)} buyer salary, the adjusted DSCR drops to ${askMetrics.adjDSCR.toFixed(2)}${askMetrics.adjDSCR<1.25?', which would make this loan very difficult to approve':''}.`);
      if(askMetrics.cashLeft<0) lines.push(`At the seller's price, after debt service, salary, and a ${contingencyPct}% contingency reserve, the buyer would be ${fmtD(Math.abs(askMetrics.cashLeft))} short — the deal has a cash-flow deficit.`);
    }
    if(max125>0) lines.push(`The maximum price this business can support at 1.25× DSCR${buyerSalary>0?` with a ${fmtD(buyerSalary)} buyer salary`:''} is ${fmtD(max125)}.`);
    if(advisorPrice>0&&advisorMetrics&&advisorMetrics.adjDSCR>=1.25) lines.push(`The advisor's recommended price of ${fmtD(advisorPrice)} produces an adjusted DSCR of ${advisorMetrics.adjDSCR.toFixed(2)}, which meets lender requirements${advisorMetrics.cashLeft>0?` and leaves the buyer with ${fmtD(advisorMetrics.cashLeft)} after all obligations`:''}.`);
    if(askingPrice>0&&max125>0&&askingPrice>max125) lines.push(`To make this deal lendable, the price would need to decrease by ${fmtD(askingPrice-max125)} (${((( askingPrice-max125)/askingPrice)*100).toFixed(0)}% reduction).`);
    return lines.join(' ') || 'Enter a seller asking price above to generate talking points.';
  };

  const [copied, setCopied] = React.useState(false);
  const copyTP = () => { navigator.clipboard.writeText(talkingPoints()).then(()=>{setCopied(true);setTimeout(()=>setCopied(false),2000);}); };

  const dscrTargets = [
    {label:'1.25×', sub:'Minimum', value:1.25},
    {label:'1.50×', sub:'Comfortable', value:1.50},
    {label:'2.00×', sub:'Strong', value:2.00},
  ];

  return (
    <div>
      <h2 className="text-lg font-bold text-white mb-1">Seller Reality Check</h2>
      <div style={{fontSize:11,color:'#64748b',marginBottom:16}}>
        SDE Basis: <span style={{color:'#60a5fa'}}>{basisLabel} — {fmtD(sde)}</span>
        {advisorPrice>0&&<span> · Advisor Price: <span style={{color:'#60a5fa'}}>{fmtD(advisorPrice)}</span></span>}
        &nbsp;·&nbsp;Loan: {loanRate||10.75}% / {(loanStructure||'7a')==='504'?`7(a)+504`:`${blendedAmortS}yr blended`} / {dpPct||10}% down{ppMoS>0?` · PP: ${fmtD(ppMoS)}/mo`:''}
      </div>

      {/* Section 1 — Inputs */}
      <div className="card p-4 mb-4">
        <h3 className="text-sm font-bold text-gray-300 mb-3">Scenario Inputs</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <span className="lbl">Seller's Asking Price</span>
            <NI value={seller.askingPrice} onChange={v=>setSeller('askingPrice',v)} placeholder="1,200,000"/>
          </div>
          <div>
            <span className="lbl">Buyer Annual Salary Requirement</span>
            <NI value={seller.buyerSalary} onChange={v=>setSeller('buyerSalary',v)} placeholder="75,000"/>
          </div>
          <div>
            <span className="lbl">Contingency Reserve %</span>
            <input type="text" className="input-field" value={seller.contingencyPct}
              onChange={e=>setSeller('contingencyPct',e.target.value)} placeholder="10"/>
          </div>
        </div>
        <div style={{fontSize:10,color:'#334155',marginTop:8}}>
          Loan terms (rate, amortization, down payment %) are pulled from Sources & Uses / DSCR tab. Advisor's recommended price is pulled from Sources & Uses.
        </div>
      </div>

      {/* Section 2 — Three-Column Comparison */}
      <div className="card p-4 mb-4">
        <h3 className="text-sm font-bold text-gray-300 mb-3">Price Comparison</h3>
        {sde===0 ? (
          <div style={{color:'#475569',fontSize:13,textAlign:'center',padding:'20px 0'}}>
            Enter financial data in the Income Statement tab to enable this analysis.
          </div>
        ) : (
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
              <thead>
                <tr style={{borderBottom:'2px solid #1e2d45'}}>
                  <th style={{textAlign:'left',color:'#475569',fontSize:10,fontWeight:600,textTransform:'uppercase',letterSpacing:'0.06em',padding:'6px 0',width:'36%'}}>Metric</th>
                  {colLabels.map((l,i)=>(
                    <th key={i} style={{textAlign:'right',color:colColors[i],fontSize:11,fontWeight:700,padding:'6px 12px',textTransform:'uppercase',letterSpacing:'0.04em'}}>{l}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tRow('Asking Price', prices.map(p=>p>0?p:null), ()=>'#e2e8f0', true)}
                {tRow(`Down Payment (${dpPct||10}%)`, prices.map(p=>p>0?p*dp:null), ()=>'#94a3b8')}
                {tRow('SBA Loan', prices.map(p=>p>0?p*(1-dp):null), ()=>'#94a3b8')}
                {tRow('Monthly Payment', mets.map(m=>m?m.monthlyPmt:null), ()=>'#fbbf24')}
                <tr style={{borderBottom:'2px solid #1e2d45'}}>
                  <td style={{padding:'5px 0',color:'#94a3b8',fontSize:11}}>Annual Debt Service</td>
                  {mets.map((m,i)=> m
                    ? <td key={i} style={{textAlign:'right',fontFamily:'monospace',fontSize:11,color:'#f87171',padding:'5px 12px'}}>{fmtD(m.annualDS)}</td>
                    : <td key={i} style={{textAlign:'right',color:'#475569',padding:'5px 12px'}}>—</td>
                  )}
                </tr>
                {tRow('SDE Available', prices.map(()=>sde), ()=>'#2eb860', true)}
                {tRow('− Buyer Salary', prices.map(()=>buyerSalary>0?buyerSalary:0), ()=>'#94a3b8')}
                <tr style={{borderBottom:'2px solid #1e2d45', background:'#071a0b'}}>
                  <td style={{padding:'5px 0',color:'#94a3b8',fontSize:11,fontWeight:700}}>= Adjusted SDE</td>
                  {prices.map((_,i)=>(
                    <td key={i} style={{textAlign:'right',fontFamily:'monospace',fontSize:11,fontWeight:700,color:adjSDE>=0?'#2eb860':'#f87171',padding:'5px 12px'}}>{fmtD(adjSDE)}</td>
                  ))}
                </tr>
                {tRow('Raw DSCR', mets.map(m=>m?m.rawDSCR:null), (v)=>dscrColor(v), false, true)}
                <tr style={{borderBottom:'2px solid #1e2d45'}}>
                  <td style={{padding:'5px 0',color:'#94a3b8',fontSize:11,fontWeight:700}}>Adj. DSCR (salary-adjusted)</td>
                  {mets.map((m,i)=> m
                    ? <td key={i} style={{textAlign:'right',fontFamily:'monospace',fontSize:14,fontWeight:800,color:dscrColor(m.adjDSCR),padding:'5px 12px'}}>{m.adjDSCR.toFixed(2)}</td>
                    : <td key={i} style={{textAlign:'right',color:'#475569',padding:'5px 12px'}}>—</td>
                  )}
                </tr>
                {tRow(`− Contingency Reserve (${contingencyPct}%)`, prices.map(()=>contAmt), ()=>'#94a3b8')}
                <tr style={{borderBottom:'1px solid #1e2d45', background:'#071a0b'}}>
                  <td style={{padding:'5px 0',color:'#94a3b8',fontSize:11,fontWeight:700}}>= Cash Left Over</td>
                  {mets.map((m,i)=> m
                    ? <td key={i} style={{textAlign:'right',fontFamily:'monospace',fontSize:14,fontWeight:800,color:cashColor(m.cashLeft),padding:'5px 12px'}}>{fmtD(m.cashLeft)}</td>
                    : <td key={i} style={{textAlign:'right',color:'#475569',padding:'5px 12px'}}>—</td>
                  )}
                </tr>
                <tr>
                  <td style={{padding:'7px 0',color:'#94a3b8',fontSize:11,fontWeight:700}}>Lender Status</td>
                  {mets.map((m,i)=>(
                    <td key={i} style={{textAlign:'right',padding:'7px 12px'}}>{statusBadge(m)}</td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 3 — What Price Works? */}
      <div className="card p-4 mb-4">
        <h3 className="text-sm font-bold text-gray-300 mb-1">What Price Works?</h3>
        <p style={{fontSize:11,color:'#64748b',marginBottom:12}}>Maximum supportable price at each DSCR target, with and without buyer salary</p>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
          {dscrTargets.map(t=>(
            <React.Fragment key={t.value}>
              <div style={{background:'#0f1623',border:'1px solid #1e2d45',borderRadius:8,padding:'12px 14px'}}>
                <div style={{fontSize:9,color:'#64748b',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:4}}>
                  {t.label} {t.sub} — No Salary
                </div>
                <div style={{fontFamily:'monospace',fontWeight:800,fontSize:18,color:sde>0?'#2eb860':'#475569'}}>
                  {sde>0 ? fmtD(maxSupportable(t.value,0)) : '—'}
                </div>
                <div style={{fontSize:10,color:'#475569',marginTop:3}}>without buyer salary</div>
              </div>
              <div style={{background:buyerSalary>0?'#071a0b':'#0d1117',border:`1px solid ${buyerSalary>0?'#1a5e35':'#1e2d45'}`,borderRadius:8,padding:'12px 14px'}}>
                <div style={{fontSize:9,color:'#64748b',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:4}}>
                  {t.label} {t.sub} — With Salary
                </div>
                <div style={{fontFamily:'monospace',fontWeight:800,fontSize:18,color:sde>0&&buyerSalary>0?'#60a5fa':'#475569'}}>
                  {sde>0 ? fmtD(maxSupportable(t.value,buyerSalary)) : '—'}
                </div>
                <div style={{fontSize:10,color:'#475569',marginTop:3}}>
                  {buyerSalary>0 ? `after ${fmtD(buyerSalary)}/yr salary` : 'enter salary above'}
                </div>
              </div>
            </React.Fragment>
          ))}
        </div>
        <div style={{marginTop:8,fontSize:10,color:'#334155'}}>
          Based on {basisLabel} SDE of {fmtD(sde)} · {loanRate||10.75}% / {loanAmort||10}yr / {dpPct||10}% down
        </div>
      </div>

      {/* Section 4 — Advisor Talking Points */}
      <div className="card p-4">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
          <h3 className="text-sm font-bold text-gray-300">Advisor Talking Points</h3>
          <button onClick={copyTP}
            style={{fontSize:11,background:'#1a3a1a',color:'#6de09a',border:'1px solid #1a5e35',borderRadius:5,padding:'5px 12px',cursor:'pointer'}}>
            {copied ? '✓ Copied!' : ' Copy'}
          </button>
        </div>
        <div style={{background:'#071a07',border:'1px solid #1a5e35',borderRadius:7,padding:'14px 16px',fontSize:13,color:'#94a3b8',lineHeight:1.9,fontStyle:'italic'}}>
          {talkingPoints()}
        </div>
      </div>
    </div>
  );
};

/* ── Tab 7: Net Proceeds ───────────────────────────── */
const T7 = ({state,set}) => {
  const np=state.np||{}, setNP=(f,v)=>set({...state,np:{...np,[f]:v}});

  // Gross: auto from S&U market price → fallback to basis SDE × 3 → manual
  const basisSDE=state.sdeBasis==='weighted'?wtdSDE(state.years):recentSDE(state.years);
  const suPrice=pn(state.su?.marketPrice);
  const autoGross=suPrice>0?suPrice:(basisSDE>0?basisSDE*3:0);
  const gross=autoGross>0?autoGross:pn(np.gross);
  const grossIsAuto=autoGross>0;
  const grossLabel=suPrice>0?'Auto from Sources & Uses market price'
    :(basisSDE>0?`Auto: ${state.sdeBasis==='weighted'?'Weighted Avg':'Most Recent'} SDE × 3.0×`:'');

  // Auto-fill SBA fee & closing from S&U
  const dpPct=(state.dpPct||10)/100;
  const suMP=pn(state.su?.marketPrice);
  const suTotal=suMP+pn(state.su?.reVal)+pn(state.su?.wc)+pn(state.su?.arVal)+pn(state.su?.invVal);
  const suBaseLoan=suTotal*(1-dpPct);
  const autoSbaFee=suBaseLoan*0.75*0.035;
  const autoClosing=(state.su?.closing===''||state.su?.closing===undefined)?15000:pn(state.su?.closing);

  // Computed values
  const cashAdj=pn(np.cash);
  const apDeduct=pn(np.ap);
  const ltdDeduct=pn(np.ltd);
  const mort=pn(np.mortgage);
  const commPct=pn(np.commission)/100;
  const commAmt=gross*commPct;
  const legal=pn(np.legal);
  const sbaFeeVal=np.sbaFee===''||np.sbaFee===undefined?autoSbaFee:pn(np.sbaFee);
  const sbaIsAuto=(np.sbaFee===''||np.sbaFee===undefined)&&autoSbaFee>0;
  const closingVal=np.closingCosts===''||np.closingCosts===undefined?autoClosing:pn(np.closingCosts);
  const closingIsAuto=(np.closingCosts===''||np.closingCosts===undefined)&&autoClosing>0;
  const taxRate=pn(np.taxRate)/100;
  const customDeds=np.customDeds||[];
  const customTotal=customDeds.reduce((s,d)=>s+pn(d.amount),0);

  const preTax=gross+cashAdj-mort-apDeduct-ltdDeduct-commAmt-legal-sbaFeeVal-closingVal-customTotal;
  const taxAmt=preTax>0?preTax*taxRate:0;
  const net=preTax-taxAmt;
  useEffect(()=>{set(prev=>({...prev,_net:net}));},[net]);

  const addDed=()=>set({...state,np:{...np,customDeds:[...customDeds,{id:Date.now(),label:'',amount:''}]}});
  const updDed=(id,f,v)=>set({...state,np:{...np,customDeds:customDeds.map(d=>d.id===id?{...d,[f]:v}:d)}});
  const remDed=id=>set({...state,np:{...np,customDeds:customDeds.filter(d=>d.id!==id)}});

  // Waterfall rows for right panel
  const wf=[
    {l:'Gross Sale Price',v:gross,c:'#2eb860',sign:'+'},
    ...(cashAdj>0?[{l:'Cash (Balance Sheet)',v:cashAdj,c:'#2eb860',sign:'+'}]:[]),
    ...(mort>0?[{l:'Less: Mortgage / Debt Payoff',v:mort,c:'#f87171',sign:'-'}]:[]),
    ...(apDeduct>0?[{l:'Less: Accounts Payable',v:apDeduct,c:'#f87171',sign:'-'}]:[]),
    ...(ltdDeduct>0?[{l:'Less: Long-Term Debt',v:ltdDeduct,c:'#f87171',sign:'-'}]:[]),
    ...(commAmt>0?[{l:`Less: Commission (${(commPct*100).toFixed(0)}%)`,v:commAmt,c:'#f87171',sign:'-'}]:[]),
    ...(legal>0?[{l:'Less: Legal / Attorney Fees',v:legal,c:'#f87171',sign:'-'}]:[]),
    ...(sbaFeeVal>0?[{l:`Less: SBA Fee${sbaIsAuto?' (auto)':''}`,v:sbaFeeVal,c:'#f87171',sign:'-'}]:[]),
    ...(closingVal>0?[{l:`Less: Closing Costs${closingIsAuto?' (auto)':''}`,v:closingVal,c:'#f87171',sign:'-'}]:[]),
    ...customDeds.filter(d=>pn(d.amount)>0).map(d=>({l:`Less: ${d.label||'Custom'}`,v:pn(d.amount),c:'#f87171',sign:'-'})),
    {l:'Pre-Tax Proceeds',v:preTax,c:preTax>=0?'#fbbf24':'#f87171',sign:'+',bold:true},
    ...(taxAmt>0?[{l:`Less: Tax on Gain (${(taxRate*100).toFixed(0)}%)`,v:taxAmt,c:'#f87171',sign:'-'}]:[]),
  ];

  const Sec=({label,color='#2eb860',children})=>(
    <div className="card p-4">
      <div className="text-xs font-bold uppercase tracking-wider mb-3" style={{color}}>{label}</div>
      {children}
    </div>
  );

  return (
    <div>
      <h2 className="text-lg font-bold text-white mb-1">Net Proceeds to Seller</h2>
      <p className="text-xs text-gray-500 mb-4">Estimate seller's take-home after all closing deductions</p>
      <div className="grid grid-cols-2 gap-4">

        {/* ── Left: Inputs ── */}
        <div className="space-y-3">

          {/* Gross Sale Price */}
          <Sec label="Gross Sale Price" color="#2eb860">
            {grossIsAuto
              ?<><div className="calc-field font-bold text-green-400">{fmtD(gross)}</div>
                 <div className="text-xs text-gray-500 mt-1">{grossLabel}</div></>
              :<><NI value={np.gross} onChange={v=>setNP('gross',v)} placeholder="0"/>
                 <div className="text-xs text-gray-500 mt-1">Set market price in Sources &amp; Uses to auto-fill</div></>
            }
          </Sec>

          {/* Working Capital Add-back */}
          <Sec label="Working Capital Additions" color="#2eb860">
            <div>
              <span className="lbl">Cash — Most Recent Balance Sheet</span>
              <NI value={np.cash} onChange={v=>setNP('cash',v)} placeholder="0"/>
              <div className="text-xs text-gray-600 mt-0.5">Cash the seller retains from the business at closing</div>
            </div>
          </Sec>

          {/* Deductions */}
          <Sec label="Deductions at Closing" color="#f87171">
            <div className="space-y-3">
              <div>
                <span className="lbl">Accounts Payable</span>
                <NI value={np.ap} onChange={v=>setNP('ap',v)} placeholder="0"/>
                <div className="text-xs text-gray-600 mt-0.5">Vendor balances assumed or settled at closing</div>
              </div>
              <div>
                <span className="lbl">Long-Term Debt / Notes Payable</span>
                <NI value={np.ltd} onChange={v=>setNP('ltd',v)} placeholder="0"/>
              </div>
              <div>
                <span className="lbl">Existing Mortgage / Debt Payoff</span>
                <NI value={np.mortgage} onChange={v=>setNP('mortgage',v)} placeholder="0"/>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="lbl">Broker Commission (%)</span>
                  <NI value={np.commission} onChange={v=>setNP('commission',v)} placeholder="10"/>
                </div>
                <div>
                  <span className="lbl">Commission Amount (auto)</span>
                  <CF v={commAmt}/>
                </div>
              </div>
              <div>
                <span className="lbl">Legal / Attorney Fees</span>
                <NI value={np.legal} onChange={v=>setNP('legal',v)} placeholder="0"/>
              </div>
              <div>
                <span className="lbl">SBA Guarantee Fee{sbaIsAuto&&<span className="text-gray-600 font-normal"> — auto from S&amp;U</span>}</span>
                {sbaIsAuto
                  ?<><CF v={sbaFeeVal}/><div className="text-xs text-gray-600 mt-0.5">To override: <NI value={np.sbaFee} onChange={v=>setNP('sbaFee',v)} placeholder={`${Math.round(autoSbaFee)} (auto)`}/></div></>
                  :<NI value={np.sbaFee} onChange={v=>setNP('sbaFee',v)} placeholder={autoSbaFee>0?`${Math.round(autoSbaFee)} (auto)`:'0'}/>
                }
              </div>
              <div>
                <span className="lbl">Closing Costs{closingIsAuto&&<span className="text-gray-600 font-normal"> — auto from S&amp;U</span>}</span>
                {closingIsAuto
                  ?<><CF v={closingVal}/><div className="text-xs text-gray-600 mt-0.5">To override: <NI value={np.closingCosts} onChange={v=>setNP('closingCosts',v)} placeholder={`${Math.round(autoClosing)} (auto)`}/></div></>
                  :<NI value={np.closingCosts} onChange={v=>setNP('closingCosts',v)} placeholder={autoClosing>0?`${Math.round(autoClosing)} (auto)`:'0'}/>
                }
              </div>
            </div>
          </Sec>

          {/* Custom Deductions */}
          <Sec label="Additional Deductions" color="#94a3b8">
            <div className="space-y-2">
              {customDeds.map(d=>(
                <div key={d.id} className="flex gap-2 items-end">
                  <div style={{flex:'0 0 50%'}}>
                    <span className="lbl">Description</span>
                    <input className="input-field" value={d.label} onChange={e=>updDed(d.id,'label',e.target.value)} placeholder="e.g. Equipment Lien"/>
                  </div>
                  <div className="flex-1">
                    <span className="lbl">Amount</span>
                    <NI value={d.amount} onChange={v=>updDed(d.id,'amount',v)} placeholder="0"/>
                  </div>
                  <button onClick={()=>remDed(d.id)} className="text-red-400 hover:text-red-300 text-base mb-1 flex-shrink-0">✕</button>
                </div>
              ))}
              <button onClick={addDed}
                style={{display:'block',width:'100%',marginTop:4,padding:'6px',fontSize:11,background:'#0d1117',color:'#64748b',border:'1px dashed #334155',borderRadius:5,cursor:'pointer'}}>
                + Add Deduction Field
              </button>
            </div>
          </Sec>

          {/* Tax */}
          <Sec label="Tax on Gain" color="#f87171">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="lbl">Tax Rate (%)</span>
                <NI value={np.taxRate} onChange={v=>setNP('taxRate',v)} placeholder="0"/>
                <div className="text-xs text-gray-600 mt-0.5">Federal + state combined</div>
              </div>
              <div>
                <span className="lbl">Tax Amount (auto)</span>
                <CF v={taxAmt}/>
              </div>
            </div>
          </Sec>
        </div>

        {/* ── Right: Waterfall Summary ── */}
        <div>
          <div className="card p-4" style={{position:'sticky',top:0}}>
            <div className="text-xs font-bold uppercase tracking-wider mb-3" style={{color:'#2eb860'}}>Proceeds Waterfall</div>
            <div className="space-y-1">
              {wf.map((item,i)=>(
                <div key={i} className={`flex justify-between items-baseline text-xs${item.bold?' border-t border-gray-700 pt-2 mt-1':''}`}>
                  <span className="text-gray-400">{item.l}</span>
                  <span className="mono font-semibold" style={{color:item.c}}>
                    {item.sign==='-'?`(${fmtD(item.v)})`:fmtD(item.v)}
                  </span>
                </div>
              ))}
            </div>
            <div className="border-t-2 mt-3 pt-3" style={{borderColor:'#1a5e35'}}>
              <div className="flex justify-between items-center">
                <span className="text-sm font-bold text-white">Net Proceeds to Seller</span>
                <span className={`mono text-2xl font-bold ${net>=0?'text-green-400':'text-red-400'}`}>{fmtD(net)}</span>
              </div>
              {gross>0&&<div className="text-xs text-gray-500 mt-1 text-right">{((net/gross)*100).toFixed(1)}% of gross sale price</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Tab 8: QSI NLB ────────────────────────────────── */
const T8 = ({state,set}) => {
  const nlb=state.nlb, setNLB=(f,v)=>set({...state,nlb:{...nlb,[f]:v}});
  const net=state._net||0, pct=pn(nlb.pct)||20;
  const dp=net*(pct/100), target=dp/0.10;
  const estNext=target/3;
  const nextSDE=pn(nlb.nextSDE)||estNext;
  const curSDE=recentSDE(state.years);
  const delta=nextSDE-curSDE;
  return (
    <div>
      <h2 className="text-lg font-bold text-white mb-1">QSI™ NLB — Next Larger Business</h2>
      <p className="text-xs text-gray-500 mb-4">Scenario modeler: reinvest proceeds into a quantum-leap acquisition</p>
      <div className="grid grid-cols-2 gap-4">
        <div className="card p-4 space-y-4">
          <div><span className="lbl">Net Proceeds (from Tab 7)</span><div className="calc-field text-green-400 font-bold">{fmtD(net)}</div></div>
          <div>
            <span className="lbl">% of Proceeds as Down Payment</span>
            <div className="flex items-center gap-3 mt-1">
              <input type="range" min="5" max="100" step="5" value={pct} onChange={e=>setNLB('pct',e.target.value)}/>
              <span className="mono text-blue-300 w-12 text-right flex-shrink-0">{pct}%</span>
            </div>
          </div>
          <div><span className="lbl">Down Payment Amount (auto)</span><CF v={dp}/></div>
          <div><span className="lbl">Target Acquisition Price (auto, ÷10%)</span><CF v={target}/></div>
          <div>
            <span className="lbl">Estimated Next Business SDE</span>
            <NI value={nlb.nextSDE||Math.round(estNext)} onChange={v=>setNLB('nextSDE',v)} placeholder={Math.round(estNext)}/>
            <div className="text-xs text-gray-500 mt-1">Default: Target Price ÷ 3× multiple</div>
          </div>
        </div>
        <div className="card p-4">
          <h3 className="text-sm font-bold text-gray-300 mb-4">Business Comparison</h3>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-gray-900 rounded p-3 text-center">
              <div className="text-xs text-gray-400 mb-2">Current Business SDE</div>
              <div className={`mono text-xl font-bold ${curSDE>=0?'text-green-400':'text-red-400'}`}>{fmtD(curSDE)}</div>
              <div className="text-xs text-gray-500 mt-1">Most recent year</div>
            </div>
            <div className="rounded p-3 text-center border border-blue-700/50" style={{background:'rgba(46,184,96,0.15)'}}>
              <div className="text-xs text-blue-300 mb-2">Next Business SDE</div>
              <div className="mono text-xl font-bold text-blue-400">{fmtD(nextSDE)}</div>
              <div className="text-xs text-gray-500 mt-1">Estimated</div>
            </div>
          </div>
          <div className="bg-gray-900 rounded p-3 mb-4">
            <span className="lbl">Annual Cash Flow Increase</span>
            <div className={`mono text-xl font-bold ${delta>=0?'text-green-400':'text-red-400'}`}>{fmtD(delta)}</div>
            {delta>0&&curSDE>0&&<div className="text-xs text-gray-400 mt-1">+{((delta/curSDE)*100).toFixed(0)}% vs current</div>}
          </div>
          <div className="text-xs space-y-1 text-gray-400">
            <div className="flex justify-between"><span>Net Proceeds</span><span className="mono text-green-400">{fmtD(net)}</span></div>
            <div className="flex justify-between"><span>Down Payment ({pct}%)</span><span className="mono text-yellow-400">{fmtD(dp)}</span></div>
            <div className="flex justify-between"><span>Target Acquisition</span><span className="mono text-blue-400">{fmtD(target)}</span></div>
            <div className="flex justify-between"><span>Remaining Proceeds</span><span className="mono text-gray-300">{fmtD(net-dp)}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ── Narrative text renderer (shared by TNarrative + T9) ── */
const renderNarrative=text=>text.split('\n').map((line,i)=>{
  const bold=line.match(/^\*\*(.+?)\*\*$/);
  if(bold) return <div key={i} style={{fontSize:13,fontWeight:800,color:'#e2e8f0',marginTop:i>0?18:0,marginBottom:6,borderBottom:'1px solid #1e2d45',paddingBottom:4}}>{bold[1]}</div>;
  const mixed=line.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
  if(!line.trim()) return <div key={i} style={{height:6}}/>;
  return <div key={i} style={{fontSize:12,color:'#94a3b8',lineHeight:1.8}} dangerouslySetInnerHTML={{__html:mixed}}/>;
});

/* ── Waterfall (Revenue → SDE Bridge) ─────────────── */
const WaterfallChart = ({steps}) => {
  const W=720,H=210,PAD={t:24,r:20,b:48,l:70};
  const innerW=W-PAD.l-PAD.r, innerH=H-PAD.t-PAD.b;
  // Compute bar extents
  let running=0;
  const bars=steps.map(s=>{
    let lo,hi;
    if(s.type==='start'){lo=0;hi=s.val;running=s.val;}
    else if(s.type==='step'){if(s.val>=0){lo=running;hi=running+s.val;}else{hi=running;lo=running+s.val;}running+=s.val;}
    else{lo=0;hi=running;}
    return{...s,lo:Math.min(lo,hi),hi:Math.max(lo,hi),running};
  });
  const maxV=Math.max(...bars.map(b=>b.hi),1);
  const minV=Math.min(...bars.map(b=>b.lo),0);
  const range=maxV-minV||1;
  const sy=v=>innerH*(1-(v-minV)/range);
  const fk=v=>{const a=Math.abs(v);return(v<0?'−':'')+(a>=1000000?'$'+(a/1000000).toFixed(1)+'M':a>=1000?'$'+(a/1000).toFixed(0)+'k':'$'+a);};
  const bw=Math.max(24,Math.floor(innerW/steps.length*0.55));
  const gap=innerW/steps.length;
  const barColor=s=>{
    if(s.type==='total'){
      if(s.label==='SDE') return '#2eb860';
      if(s.label==='EBITDA') return '#a78bfa';
      if(s.label.includes('Profit')) return '#3b82f6';
      return '#60a5fa';
    }
    if(s.val<0) return '#ef4444';
    if(s.label.includes('OC')||s.label.includes('Owner')) return '#3b82f6';
    if(s.label.includes('Add')) return '#f59e0b';
    return '#22d3ee';
  };
  const ticks=4;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{overflow:'visible'}}>
      {Array.from({length:ticks+1},(_,i)=>{const v=minV+(range/ticks)*i;const y=PAD.t+sy(v);return(<g key={i}><line x1={PAD.l} x2={PAD.l+innerW} y1={y} y2={y} stroke="#1e2d45" strokeDasharray="3 3"/><text x={PAD.l-5} y={y+4} textAnchor="end" fontSize="9" fill="#64748b">{fk(v)}</text></g>);})}
      {/* Connector dashes between bars */}
      {bars.slice(0,-1).map((b,i)=>{
        const x1=PAD.l+gap*i+gap/2+bw/2, x2=PAD.l+gap*(i+1)+gap/2-bw/2;
        const cy=PAD.t+sy(b.running);
        return <line key={i} x1={x1} x2={x2} y1={cy} y2={cy} stroke="#334155" strokeWidth="1" strokeDasharray="4 2"/>;
      })}
      {bars.map((b,i)=>{
        const x=PAD.l+gap*i+gap/2-bw/2;
        const yTop=PAD.t+sy(b.hi), yBot=PAD.t+sy(b.lo);
        const bh=Math.max(Math.abs(yBot-yTop),2);
        const col=barColor(b);
        const isTotal=b.type==='start'||b.type==='total';
        const dispVal=isTotal?b.running:b.val;
        return (<g key={i}>
          <rect x={x} y={yTop} width={bw} height={bh} fill={col} rx="2" opacity={isTotal?1:0.8}/>
          <text x={x+bw/2} y={yTop-4} textAnchor="middle" fontSize="9" fill={col} fontWeight={isTotal?700:400}>{fk(dispVal)}</text>
          <text x={x+bw/2} y={PAD.t+innerH+14} textAnchor="middle" fontSize="9" fill={isTotal?'#94a3b8':'#64748b'}>{b.label}</text>
        </g>);
      })}
      <line x1={PAD.l} x2={PAD.l} y1={PAD.t} y2={PAD.t+innerH} stroke="#374151"/>
      <line x1={PAD.l} x2={PAD.l+innerW} y1={PAD.t+sy(0)} y2={PAD.t+sy(0)} stroke="#374151"/>
    </svg>
  );
};

/* ── Tab: Narrative Report ─────────────────────────── */
const TNarrative = ({state,narrative,setNarrative,narrativeStatus,setNarrativeStatus}) => {
  const [status,setStatus]=[narrativeStatus,setNarrativeStatus];
  const [copied,setCopied]=useState(false);

  // Data prep — newest first from sortedByYear
  const withData=[...sortedByYear(state.years)].filter(y=>pn(y.revenue)>0);
  const hasData=withData.length>0;
  const c0=hasData?calcSDE(withData[0]):null;   // most recent
  const c1=withData.length>1?calcSDE(withData[1]):null; // previous
  // Chart data: oldest→newest for left-right display
  const chartData=[...withData].reverse().map(y=>{const c=calcSDE(y);return{year:String(y.year),revenue:c.rev,sde:c.sde,gm:c.rev>0?+(c.gp/c.rev*100).toFixed(1):0,em:c.rev>0?+(c.ebitda/c.rev*100).toFixed(1):0,sm:c.rev>0?+(c.sde/c.rev*100).toFixed(1):0};});
  const pctFmt=v=>v.toFixed(1)+'%';
  // YoY helper
  const yoy=(cur,prev)=>prev&&Math.abs(prev)>0?((cur-prev)/Math.abs(prev)*100):null;
  // Waterfall steps for most recent year
  const wfSteps=c0?(()=>{
    const idao=c0.int+c0.taxes+c0.dep+c0.amor;
    const ab=c0.ab+c0.rentAB;
    const steps=[
      {label:'Revenue',val:c0.rev,type:'start'},
      {label:'− COGS',val:-c0.cogs,type:'step'},
      {label:'Gr. Profit',val:c0.gp,type:'total'},
      {label:'− OpEx',val:-c0.opx,type:'step'},
      {label:'NOI',val:c0.noi,type:'total'},
    ];
    if(idao>0) steps.push({label:'+I/T/D&A',val:idao,type:'step'});
    steps.push({label:'EBITDA',val:c0.ebitda,type:'total'});
    if(c0.oc>0) steps.push({label:'+OC',val:c0.oc,type:'step'});
    if(ab>0) steps.push({label:'+Add-Backs',val:ab,type:'step'});
    steps.push({label:'SDE',val:c0.sde,type:'total'});
    return steps;
  })():[];

  const generate=async()=>{
    setStatus('loading');
    const auth=sessionStorage.getItem('pacq_auth');
    const headers={'Content-Type':'application/json'};
    if(auth) headers['Authorization']=`Basic ${auth}`;
    const yearSummaries=sortedByYear(state.years).map(y=>{
      const c=calcSDE(y);
      return{year:y.year,entityType:y.entityType,revenue:c.rev,cogs:c.cogs,grossProfit:c.gp,opx:c.opx,ebitda:c.ebitda,ownerComp:c.oc,addBacks:c.ab,sde:c.sde,
        grossMarginPct:c.rev>0?(c.gp/c.rev*100).toFixed(1):null,
        ebitdaMarginPct:c.rev>0?(c.ebitda/c.rev*100).toFixed(1):null,
        sdeMarginPct:c.rev>0?(c.sde/c.rev*100).toFixed(1):null};
    });
    try{
      const resp=await fetch('/api/extract/narrative',{method:'POST',headers,body:JSON.stringify({dealName:state.dealName,years:yearSummaries,bs:state.bs,ind:state.ind,notes:state.notes})});
      if(!resp.ok){const e=await resp.json().catch(()=>({}));throw new Error(e.error||`Server error ${resp.status}`);}
      const data=await resp.json();
      setNarrative(data.narrative);
      setStatus('done');
    }catch(err){setStatus('error');}
  };

  const copy=()=>{navigator.clipboard.writeText(narrative);setCopied(true);setTimeout(()=>setCopied(false),2000);};
  const btnStyle=(bg,c)=>({padding:'8px 16px',background:bg,color:c,border:'none',borderRadius:6,fontSize:12,cursor:'pointer',fontWeight:600});

  // KPI card
  const KpiCard=({label,value,pctOfRev,yoyPct,color='#e2e8f0'})=>{
    const up=yoyPct!=null&&yoyPct>=0;
    return (
      <div className="card p-4" style={{flex:1}}>
        <div style={{fontSize:10,color:'#475569',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6}}>{label}</div>
        <div style={{fontFamily:'monospace',fontSize:18,fontWeight:800,color,marginBottom:4}}>{value}</div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          {pctOfRev!=null&&<span style={{fontSize:10,color:'#64748b'}}>{pctOfRev.toFixed(1)}% of rev</span>}
          {yoyPct!=null&&<span style={{fontSize:10,color:up?'#2eb860':'#ef4444',fontWeight:600}}>{up?'▲':'▼'}{Math.abs(yoyPct).toFixed(1)}% YoY</span>}
        </div>
      </div>
    );
  };

  return (
    <div>
      <h2 className="text-lg font-bold text-white mb-1">Financial Narrative Report</h2>
      <p style={{fontSize:12,color:'#475569',marginBottom:16}}>Visual performance summary + AI-generated analysis — suitable for inclusion in a CBR or deal package.</p>

      {/* ── Visual Dashboard (always visible when data exists) ── */}
      {hasData&&(
        <>
          {/* KPI Cards */}
          <div style={{display:'flex',gap:12,marginBottom:16}}>
            <KpiCard label="Revenue" value={fmtD(c0.rev)} yoyPct={yoy(c0.rev,c1?.rev)} color="#e2e8f0"/>
            <KpiCard label="Gross Profit" value={fmtD(c0.gp)} pctOfRev={c0.rev>0?c0.gp/c0.rev*100:null} yoyPct={yoy(c0.gp,c1?.gp)} color="#60a5fa"/>
            <KpiCard label="EBITDA" value={fmtD(c0.ebitda)} pctOfRev={c0.rev>0?c0.ebitda/c0.rev*100:null} yoyPct={yoy(c0.ebitda,c1?.ebitda)} color="#a78bfa"/>
            <KpiCard label="SDE" value={fmtD(c0.sde)} pctOfRev={c0.rev>0?c0.sde/c0.rev*100:null} yoyPct={yoy(c0.sde,c1?.sde)} color="#2eb860"/>
          </div>

          {/* Trend Charts */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:12,marginBottom:12}}>
            <div className="card p-4">
              <div style={{fontSize:11,color:'#94a3b8',fontWeight:600,marginBottom:8}}>Revenue Trend</div>
              <BarChart data={chartData} dataKey="revenue" color="#60a5fa"/>
            </div>
            <div className="card p-4">
              <div style={{fontSize:11,color:'#94a3b8',fontWeight:600,marginBottom:8}}>Gross Margin %</div>
              <BarChart data={chartData} dataKey="gm" color="#3b82f6" fmtAxis={pctFmt}/>
            </div>
            <div className="card p-4">
              <div style={{fontSize:11,color:'#94a3b8',fontWeight:600,marginBottom:8}}>EBITDA Margin %</div>
              <BarChart data={chartData} dataKey="em" color="#a78bfa" fmtAxis={pctFmt}/>
            </div>
            <div className="card p-4">
              <div style={{fontSize:11,color:'#94a3b8',fontWeight:600,marginBottom:8}}>SDE Trend</div>
              <BarChart data={chartData} dataKey="sde" color="#2eb860"/>
            </div>
          </div>

          {/* SDE Waterfall */}
          {wfSteps.length>0&&(
            <div className="card p-5" style={{marginBottom:20}}>
              <div style={{fontSize:11,color:'#94a3b8',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:12}}>
                Revenue → SDE Bridge — {withData[0]?.year}
              </div>
              <WaterfallChart steps={wfSteps}/>
              <div style={{display:'flex',gap:16,marginTop:10,flexWrap:'wrap'}}>
                {[['#ef4444','Subtraction'],['#22d3ee','I/T/D&A Addbacks'],['#3b82f6','Owner Comp'],['#f59e0b','Other Add-Backs'],['#a78bfa','EBITDA'],['#2eb860','SDE']].map(([c,l])=>(
                  <span key={l} style={{fontSize:10,color:'#64748b',display:'flex',alignItems:'center',gap:5}}>
                    <span style={{width:10,height:10,borderRadius:2,background:c,display:'inline-block'}}/>
                    {l}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ── AI Narrative ── */}
      <div style={{borderTop:'1px solid #1e2d45',paddingTop:20,marginTop:4}}>
        <div style={{fontSize:11,color:'#475569',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:12}}>AI Narrative Analysis</div>
        {status==='idle'&&(
          <button onClick={generate} style={{...btnStyle('#1a5e35','#6de09a'),fontSize:13,padding:'10px 24px'}}>{hasData?'Generate Narrative Report':'Enter income statement data first'}</button>
        )}
        {status==='loading'&&(
          <div style={{padding:32,textAlign:'center'}}>
            <div style={{color:'#2eb860',fontSize:13,marginBottom:6}}>Generating narrative…</div>
            <div style={{color:'#475569',fontSize:11}}>Claude is analyzing the financials. This takes 15–25 seconds.</div>
          </div>
        )}
        {status==='error'&&(
          <div>
            <div style={{color:'#ef4444',marginBottom:12,fontSize:13}}>Generation failed. Check that income statement data is entered and try again.</div>
            <button onClick={generate} style={btnStyle('#1a5e35','#6de09a')}>Retry</button>
          </div>
        )}
        {status==='done'&&(
          <div>
            <div style={{display:'flex',gap:8,marginBottom:14,justifyContent:'flex-end'}}>
              <button onClick={()=>setStatus('idle')} style={btnStyle('#1e293b','#94a3b8')}>Regenerate</button>
              <button onClick={copy} style={btnStyle(copied?'#1a5e35':'#1e3a5f',copied?'#6de09a':'#60a5fa')}>{copied?'✓ Copied':'Copy Text'}</button>
            </div>
            <div className="card p-6">{renderNarrative(narrative)}</div>
          </div>
        )}
      </div>
    </div>
  );
};

/* ── Tab 9: Deal Report ────────────────────────────── */
const REPORT_SECTIONS=[
  {id:'spread',    label:'Financial Performance',   seller:false},
  {id:'fmv',       label:'Fair Market Value Range',  seller:false},
  {id:'industry',  label:'Industry Comparison',      seller:false},
  {id:'dscr',      label:'DSCR Summary',             seller:false},
  {id:'seller',    label:'Seller Reality Check',     seller:false},
  {id:'roi',       label:'Buyer ROI Summary',        seller:false},
  {id:'sources',   label:'Sources & Uses',           seller:false},
  {id:'proceeds',  label:'Net Proceeds to Seller',   seller:true},
  {id:'nlb',       label:'QSI™ NLB',                seller:true},
  {id:'narrative', label:'Narrative Analysis',       seller:false},
];
const T9 = ({state,narrative,narrativeStatus}) => {
  const {years,ytdEnabled,ytdData,sdeBasis,customMults,loanRate,loanAmort,dpPct,su,loanStructure,re504Rate,ppLoan,ppRate,ppAmort}=state;
  const sellerData=state.seller||{askingPrice:'',buyerSalary:'',contingencyPct:'10'};
  const reAmort=state.reAmort||25;
  const [vis,setVis]=useState(()=>Object.fromEntries(REPORT_SECTIONS.map(s=>[s.id,true])));
  const toggle=id=>setVis(v=>({...v,[id]:!v[id]}));
  const setBuyer=()=>setVis(v=>Object.fromEntries(REPORT_SECTIONS.map(s=>[s.id,!s.seller])));
  const setSeller=()=>setVis(v=>Object.fromEntries(REPORT_SECTIONS.map(s=>[s.id,true])));

  const wt=wtdSDE(years), rec=recentSDE(years);
  const base=sdeBasis==='weighted'?wt:rec;
  const basisLabel=sdeBasis==='weighted'?'Weighted Average':'Most Recent';
  const mults=[2.5,3.0,3.5,...(customMults||[]).map(m=>parseFloat(m)).filter(m=>m>0)];
  const dp=(dpPct||10)/100, r=(loanRate||10.75)/100/12, n=(loanAmort||10)*12;
  const pmtFn=loan=>r===0?loan/n:loan*r*Math.pow(1+r,n)/(Math.pow(1+r,n)-1);

  // Sources & Uses amounts
  const mp=pn(su?.marketPrice);
  const reVal=pn(su?.reVal), wcVal=pn(su?.wc), arVal=pn(su?.arVal), invVal=pn(su?.invVal);
  const totalProject=mp+reVal+wcVal+arVal+invVal;
  const downAmt=totalProject*dp;
  const baseLoanSU=totalProject*(1-dp);
  const guarFee=baseLoanSU*0.75*0.035;
  const closingAmt=(su?.closing===''||su?.closing===undefined)?15000:pn(su?.closing);
  const totalLoan=baseLoanSU+guarFee+closingAmt;

  // Seller note
  const sfAmt=pn(su?.sellerFin), sfR=(pn(su?.sfRate)||0)/100/12, sfN=(pn(su?.sfAmort)||0)*12;
  const sfPmt=(sfAmt>0&&sfR>0&&sfN>0)?sfAmt*sfR*Math.pow(1+sfR,sfN)/(Math.pow(1+sfR,sfN)-1):0;

  // Seller Reality — report section computed values
  const sellerAskP=pn(sellerData.askingPrice);
  const sellerSal=pn(sellerData.buyerSalary);
  const sellerContP=pn(sellerData.contingencyPct)||10;
  // Blended amort for report (uses totalProject from S&U)
  const blendedAmortR9=totalProject>0&&reVal>0
    ?Math.min(25,Math.max(10,Math.round((reVal/totalProject)*(reAmort||25)+((totalProject-reVal)/totalProject)*(loanAmort||10))))
    :(loanAmort||10);
  const nBlendR9=blendedAmortR9*12;
  const blendedPmtR9=loan=>r===0?loan/nBlendR9:loan*r*Math.pow(1+r,nBlendR9)/(Math.pow(1+r,nBlendR9)-1);
  const r504R9=(re504Rate||6.5)/100/12, n504R9=(reAmort||25)*12;
  const pmt504R9=loan=>r504R9===0?loan/n504R9:loan*r504R9*Math.pow(1+r504R9,n504R9)/(Math.pow(1+r504R9,n504R9)-1);
  const rPPR9=(ppRate||7.5)/100/12, nPPR9=(ppAmort||10)*12;
  const ppMoR9=(ppLoan||0)>0?(rPPR9===0?(ppLoan||0)/nPPR9:(ppLoan||0)*rPPR9*Math.pow(1+rPPR9,nPPR9)/(Math.pow(1+rPPR9,nPPR9)-1)):0;
  const monthlyAtPriceR9=price=>{
    if(!price||price<=0)return ppMoR9;
    if((loanStructure||'7a')==='504'&&reVal>0){
      const reComp=Math.min(reVal,price),bizComp=price-reComp;
      return pmtFn(bizComp*(1-dp))+pmt504R9(reComp*(1-dp))+ppMoR9;
    }
    return blendedPmtR9(price*(1-dp))+ppMoR9;
  };
  const sDscrM=price=>{
    if(!price||price<=0)return null;
    const mo=monthlyAtPriceR9(price);
    const ann=mo*12;
    return{loan:price*(1-dp),mo,ann,rawD:ann>0?base/ann:0,adjD:ann>0?(base-sellerSal)/ann:0,cont:base*(sellerContP/100),cash:base-sellerSal-ann-base*(sellerContP/100)};
  };
  const sMax125=(()=>{
    const a=base-sellerSal;if(a<=0)return 0;
    let lo=0,hi=20000000,iters=0;
    while(hi-lo>100&&iters++<60){const mid=(lo+hi)/2;if(monthlyAtPriceR9(mid)*12<a/1.25)lo=mid;else hi=mid;}
    return(lo+hi)/2;
  })();
  const sAskM=sDscrM(sellerAskP),sAdvM=sDscrM(mp),sMaxM=sDscrM(sMax125);
  const sDC=d=>d>=1.5?'#059669':d>=1.25?'#d97706':'#dc2626';
  const sCC=v=>v>0?'#059669':'#dc2626';
  const sStatus=m=>!m?'—':m.adjD>=1.5?'✅ Strong':m.adjD>=1.25?'⚠ Marginal':'❌ Below Min';
  const sfAnn=sfPmt*12;

  // DSCR loan sizing (3× SDE basis, matching T5)
  const dscrLoan=base*3*(1-dp);
  const dscrAnn=pmtFn(dscrLoan)*12;
  const totalDscrAnn=dscrAnn+sfAnn;

  // Net proceeds
  const net=state._net||0;
  const nlb=state.nlb||{}, nlbPct=pn(nlb.pct)||20;
  const nlbDp=net*(nlbPct/100), nlbTarget=nlbDp/0.10;
  const nextSDE=pn(nlb.nextSDE)||(nlbTarget/3), curSDE=recentSDE(years);

  const allYears=ytdEnabled?[...years,ytdData]:years;

  const SH=({n,title,color='#059669'})=>(
    <div style={{borderLeft:`4px solid ${color}`,paddingLeft:12,marginBottom:14}}>
      <div className="rpt-muted" style={{fontSize:9,textTransform:'uppercase',letterSpacing:'0.1em',fontWeight:600,color:'#64748b'}}>Section {n}</div>
      <div style={{fontSize:15,fontWeight:800,color:'#f1f5f9',marginTop:2}}>{title}</div>
    </div>
  );
  const Row=({label,val,color='#94a3b8',bold=false,top=false})=>{
    const isGreen=color==='#2eb860'||color==='#059669';
    const isRed=color==='#f87171'||color==='#dc2626'||color==='#ef4444';
    const isAmber=color==='#fbbf24'||color==='#d97706';
    const isPurple=color==='#a78bfa'||color==='#8b5cf6';
    const cls=isGreen?'rpt-green':isRed?'rpt-red':isAmber?'rpt-amber':isPurple?'rpt-purple':'rpt-muted';
    return (
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 0',borderTop:top?'1px solid #1e2d45':'none',borderBottom:'1px solid #0d1117'}}>
        <span style={{color:'#94a3b8',fontSize:11,fontWeight:bold?700:400}}>{label}</span>
        <span className={`mono ${cls}`} style={{fontSize:11,fontWeight:bold?700:400,color}}>{val}</span>
      </div>
    );
  };

  return (
    <div>
      {/* Controls — hidden on print */}
      <div className="no-print card p-4 mb-4" style={{borderColor:'#1a5e35'}}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold" style={{color:'#2eb860'}}>Report Sections</span>
          <div className="flex gap-2">
            <button onClick={setBuyer} className="text-xs px-3 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-300">Buyer Report</button>
            <button onClick={setSeller} className="text-xs px-3 py-1 rounded text-white" style={{background:'#1a5e35'}}>Seller Report</button>
          </div>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {REPORT_SECTIONS.map(s=>(
            <label key={s.id} className="flex items-center gap-2 cursor-pointer select-none text-xs">
              <input type="checkbox" checked={vis[s.id]} onChange={()=>toggle(s.id)} className="accent-green-500"/>
              <span className={vis[s.id]?'text-gray-200':'text-gray-500'}>{s.label}</span>
              {s.seller&&<span className="text-yellow-600 text-xs">(seller)</span>}
            </label>
          ))}
        </div>
      </div>

      {/* ── Printable Report ───────────────────────── */}
      <div className="report-body">
        {/* Header */}
        <div style={{borderBottom:'3px solid #059669',paddingBottom:16,marginBottom:24,display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
          <div>
            <div style={{fontSize:22,fontWeight:900,color:'#f1f5f9',letterSpacing:'-0.02em'}}>{state.dealName||'Business Acquisition Analysis'}</div>
            <div style={{fontSize:13,color:'#64748b',marginTop:4}}>
              {state.advisorName?<span>Prepared by <strong style={{color:'#94a3b8'}}>{state.advisorName}</strong> &nbsp;·&nbsp; </span>:null}
              {new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})}
            </div>
            <div style={{fontSize:10,color:'#334155',marginTop:4,letterSpacing:'0.05em'}}>CONFIDENTIAL &nbsp;·&nbsp; QSI™ MARKET PRICE ANALYZER</div>
          </div>
          <button className="no-print" onClick={()=>window.print()}
            style={{background:'#1a5e35',color:'#6ee7b7',border:'none',borderRadius:6,padding:'9px 18px',cursor:'pointer',fontSize:13,fontWeight:600}}>
             Print / Export PDF
          </button>
        </div>

        {/* Intro banner */}
        <div className="card p-4 mb-5" style={{borderColor:'#1a5e35',background:'#0a1f05'}}>
          <div style={{fontSize:12,lineHeight:1.75,color:'#94a3b8'}}>
            <strong style={{color:'#2eb860'}}>About This Report — </strong>
            This analysis was prepared using the QSI™ Market Price Analyzer to evaluate the financial performance, fair market value,
            and SBA acquisition feasibility of <strong style={{color:'#e2e8f0'}}>{state.dealName||'this business'}</strong>.
            All figures are derived from the financial data provided and are intended as a guide for discussion.
            Actual transaction terms, tax consequences, and lender requirements may vary.
          </div>
        </div>

        {/* Section 1 — Financial Performance */}
        {vis.spread&&<div className="card p-5 mb-4" style={{pageBreakInside:'avoid'}}>
          <SH n={1} title="Financial Performance & Seller's Discretionary Earnings"/>
          <p style={{fontSize:12,lineHeight:1.75,color:'#94a3b8',marginBottom:16}}>
            <strong style={{color:'#e2e8f0'}}>Seller's Discretionary Earnings (SDE)</strong> is the standard measure of cash flow used to value small businesses.
            It represents the total financial benefit available to a full-time working owner — calculated as the business's net income,
            plus the owner's salary, non-cash charges (depreciation and amortization), interest expense, taxes, and any legitimate
            personal or non-recurring expenses run through the business known as "add-backs."
            SDE is the foundation for every valuation and debt-coverage calculation in this report.
            A consistent or growing SDE trend signals a healthy, transferable business; a declining trend warrants further investigation.
          </p>
          <FinancialSpreadTable years={allYears}/>
          <div style={{marginTop:14,paddingTop:10,borderTop:'1px solid #1e2d45',display:'flex',gap:28,fontSize:11,flexWrap:'wrap'}}>
            <div><span style={{color:'#64748b'}}>Weighted Avg SDE: </span><span style={{fontFamily:'monospace',color:'#2eb860',fontWeight:700}}>{fmtD(wt)}</span></div>
            <div><span style={{color:'#64748b'}}>Most Recent SDE: </span><span style={{fontFamily:'monospace',color:'#2eb860',fontWeight:700}}>{fmtD(rec)}</span></div>
            <div style={{marginLeft:'auto'}}><span style={{color:'#64748b'}}>Valuation Basis: </span><span style={{fontFamily:'monospace',color:'#2eb860',fontWeight:700}}>{basisLabel} — {fmtD(base)}</span></div>
          </div>
        </div>}

        {/* Section 2 — Fair Market Value */}
        {vis.fmv&&<div className="card p-5 mb-4" style={{pageBreakInside:'avoid'}}>
          <SH n={2} title="Fair Market Value Range"/>
          <p style={{fontSize:12,lineHeight:1.75,color:'#94a3b8',marginBottom:16}}>
            Small businesses are valued as a <strong style={{color:'#e2e8f0'}}>multiple of SDE</strong> — essentially, how many years of earnings a buyer
            is willing to pay. A <strong style={{color:'#e2e8f0'}}>3.0× multiple</strong> means the buyer pays three times the annual earnings,
            which is the most common benchmark for stable, owner-operated businesses.
            Higher multiples (3.5×–4.0×) reflect favorable factors such as strong growth, recurring revenue, or proprietary systems.
            Lower multiples (2.0×–2.5×) may reflect elevated risk, owner dependency, or declining revenue.
            The range below is based on the <strong style={{color:'#2eb860'}}>{basisLabel} SDE of {fmtD(base)}</strong>.
          </p>
          <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
            {mults.map(m=>{
              const price=base*m, sel=mp>0&&Math.abs(mp-price)<1;
              return (
                <div key={m} style={{background:sel?'#071a0b':'#0d1117',border:`1px solid ${sel?'#2eb860':'#1e2d45'}`,borderRadius:8,padding:'12px 16px',textAlign:'center',minWidth:110,flex:'1'}}>
                  <div style={{fontSize:10,color:sel?'#2eb860':'#475569',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.05em'}}>{m.toFixed(1)}× SDE</div>
                  <div style={{fontFamily:'monospace',fontWeight:800,fontSize:15,color:sel?'#2eb860':'#cbd5e1',marginTop:6}}>{fmtD(price)}</div>
                  {sel&&<div style={{fontSize:9,color:'#2eb860',marginTop:4,fontWeight:600}}>★ SELECTED</div>}
                </div>
              );
            })}
          </div>
          {mp>0&&<div style={{marginTop:10,fontSize:11,color:'#64748b'}}>
            Market price selected: <strong style={{fontFamily:'monospace',color:'#2eb860'}}>{fmtD(mp)}</strong>
            {base>0&&<span> ({(mp/base).toFixed(2)}× {basisLabel} SDE)</span>}
          </div>}
        </div>}

        {/* Section 3 — Industry Comparison */}
        {vis.industry&&(()=>{
          const ind=state.ind||{};
          const indYears=state.years;
          const indActuals=indYears.map((yd,i)=>{
            const s=calcSDE(yd);
            return {year:yd.year,rev:s.rev,grossMarginPct:s.rev>0?(s.gp/s.rev)*100:null,ebitdaPct:s.rev>0?(s.ebitda/s.rev)*100:null,netMarginPct:s.rev>0?(s.noi/s.rev)*100:null};
          });
          const recSDE2=calcSDE(indYears[indYears.length-1]).sde;
          const recEBITDA2=calcSDE(indYears[indYears.length-1]).ebitda;
          const recRev2=indActuals[indActuals.length-1]?.rev||0;
          const tierSDE2=recRev2>5000000?pn(ind.sdeMultOver5M):recRev2>1000000?pn(ind.sdeMult1to5M):pn(ind.sdeMultUnder1M);
          const tierLbl2=recRev2>5000000?'Over $5M':recRev2>1000000?'$1M–$5M':'Under $1M';
          const askP=pn(state.su?.marketPrice);
          return (
            <div className="card p-5 mb-4" style={{pageBreakInside:'avoid'}}>
              <SH n={3} title="Industry Comparison"/>
              {!ind.name?(
                <p style={{fontSize:12,color:'#64748b',fontStyle:'italic'}}>No industry data imported. Upload an industry report in the Industry tab to enable this section.</p>
              ):(
                <>
                  <div style={{marginBottom:12}}>
                    <span style={{fontWeight:700,color:'#a78bfa',fontSize:13}}>{ind.name}</span>
                    {ind.naics&&<span style={{color:'#64748b',fontSize:11,marginLeft:8}}>NAICS {ind.naics}</span>}
                    {ind.source&&<span style={{color:'#64748b',fontSize:11,marginLeft:8}}>· {ind.source}{ind.reportYear?` ${ind.reportYear}`:''}</span>}
                  </div>
                  <div style={{marginBottom:16}}>
                    <div style={{fontSize:11,fontWeight:700,color:'#94a3b8',marginBottom:8}}>INCOME BENCHMARKS</div>
                    <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
                      <thead><tr style={{borderBottom:'1px solid #1e2d45'}}>
                        <th style={{textAlign:'left',color:'#475569',paddingBottom:5,width:'35%'}}>Metric</th>
                        <th style={{textAlign:'right',color:'#a78bfa',paddingBottom:5,paddingLeft:8}}>Industry</th>
                        {indYears.map((y,i)=><th key={i} style={{textAlign:'right',color:'#60a5fa',paddingBottom:5,paddingLeft:8}}>{y.year}</th>)}
                      </tr></thead>
                      <tbody>
                        {[['Gross Margin %','grossMarginPct',ind.grossMarginPct,true],['EBITDA %','ebitdaPct',null,true],['Net Income %','netMarginPct',ind.netMarginPct,true]].map(([lbl,key,bench,hi])=>(
                          <tr key={lbl} style={{borderBottom:'1px solid #0f1623'}}>
                            <td style={{padding:'5px 0',color:'#94a3b8'}}>{lbl}</td>
                            <td style={{textAlign:'right',fontFamily:'monospace',color:'#a78bfa',paddingLeft:8}}>{bench?pn(bench)+'%':'—'}</td>
                            {indActuals.map((a,i)=>{
                              const v=a[key];
                              const better=bench&&v!==null?(hi?v>=pn(bench):v<=pn(bench)):null;
                              return <td key={i} style={{textAlign:'right',fontFamily:'monospace',paddingLeft:8,color:v!==null?'#e2e8f0':'#475569'}}>
                                {v!==null?v.toFixed(1)+'%':'—'}{better!==null&&<span style={{marginLeft:4,color:better?'#2eb860':'#f87171'}}>{better?'▲':'▼'}</span>}
                              </td>;
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div>
                    <div style={{fontSize:11,fontWeight:700,color:'#94a3b8',marginBottom:8}}>VALUATION CHECK — {tierLbl2} REVENUE TIER</div>
                    <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
                      <thead><tr style={{borderBottom:'1px solid #1e2d45'}}>
                        <th style={{textAlign:'left',color:'#475569',paddingBottom:5}}>Multiple</th>
                        <th style={{textAlign:'right',color:'#a78bfa',paddingBottom:5,paddingLeft:8}}>Industry</th>
                        <th style={{textAlign:'right',color:'#60a5fa',paddingBottom:5,paddingLeft:8}}>This Deal</th>
                        <th style={{textAlign:'right',color:'#60a5fa',paddingBottom:5,paddingLeft:8}}>Implied Value</th>
                      </tr></thead>
                      <tbody>
                        <tr style={{borderBottom:'1px solid #0f1623'}}>
                          <td style={{padding:'5px 0',color:'#94a3b8'}}>MVIC/SDE ({tierLbl2})</td>
                          <td style={{textAlign:'right',fontFamily:'monospace',color:'#a78bfa',paddingLeft:8}}>{tierSDE2>0?tierSDE2.toFixed(2)+'×':'—'}</td>
                          <td style={{textAlign:'right',fontFamily:'monospace',paddingLeft:8,color:'#e2e8f0'}}>{askP>0&&recSDE2>0?(askP/recSDE2).toFixed(2)+'×':'—'}</td>
                          <td style={{textAlign:'right',fontFamily:'monospace',paddingLeft:8,color:'#a78bfa'}}>{tierSDE2>0&&recSDE2>0?fmtD(recSDE2*tierSDE2):'—'}</td>
                        </tr>
                        <tr style={{borderBottom:'1px solid #0f1623'}}>
                          <td style={{padding:'5px 0',color:'#94a3b8'}}>Rules of Thumb — x SDE</td>
                          <td style={{textAlign:'right',fontFamily:'monospace',color:'#a78bfa',paddingLeft:8}}>{ind.sdeMult?pn(ind.sdeMult).toFixed(1)+'×':'—'}</td>
                          <td style={{textAlign:'right',fontFamily:'monospace',paddingLeft:8,color:'#e2e8f0'}}>{askP>0&&recSDE2>0?(askP/recSDE2).toFixed(2)+'×':'—'}</td>
                          <td style={{textAlign:'right',fontFamily:'monospace',paddingLeft:8,color:'#a78bfa'}}>{ind.sdeMult&&recSDE2>0?fmtD(recSDE2*pn(ind.sdeMult)):'—'}</td>
                        </tr>
                        <tr style={{borderBottom:'1px solid #0f1623'}}>
                          <td style={{padding:'5px 0',color:'#94a3b8'}}>Rules of Thumb — % of Revenue</td>
                          <td style={{textAlign:'right',fontFamily:'monospace',color:'#a78bfa',paddingLeft:8}}>{ind.revenueMultPct?pn(ind.revenueMultPct)+'%':'—'}</td>
                          <td style={{textAlign:'right',fontFamily:'monospace',paddingLeft:8,color:'#e2e8f0'}}>{askP>0&&recRev2>0?(askP/recRev2*100).toFixed(1)+'%':'—'}</td>
                          <td style={{textAlign:'right',fontFamily:'monospace',paddingLeft:8,color:'#a78bfa'}}>{ind.revenueMultPct&&recRev2>0?fmtD(recRev2*pn(ind.revenueMultPct)/100):'—'}</td>
                        </tr>
                      </tbody>
                    </table>
                    {askP>0&&<div style={{marginTop:8,fontSize:11,color:'#64748b'}}>Asking price: <strong style={{fontFamily:'monospace',color:'#fbbf24'}}>{fmtD(askP)}</strong></div>}
                  </div>
                </>
              )}
            </div>
          );
        })()}

        {/* Section 4 — DSCR */}
        {vis.dscr&&<div className="card p-5 mb-4" style={{pageBreakInside:'avoid'}}>
          <SH n={4} title="Debt Service Coverage Ratio (DSCR)"/>
          <p style={{fontSize:12,lineHeight:1.75,color:'#94a3b8',marginBottom:16}}>
            The <strong style={{color:'#e2e8f0'}}>Debt Service Coverage Ratio (DSCR)</strong> is the lender's primary underwriting test:
            does the business generate enough cash flow to comfortably make its own loan payments?
            It is calculated by dividing the business's SDE by the total annual loan payments.
            A DSCR of <strong style={{color:'#e2e8f0'}}>1.00</strong> means the business exactly covers its debt — nothing left over.
            <strong style={{color:'#e2e8f0'}}> 1.25</strong> is the typical SBA minimum — 25 cents of cushion for every dollar of payment.
            <strong style={{color:'#2eb860'}}> 2.00 or above</strong> is considered strong and signals that the buyer will have healthy cash flow after servicing the debt.
            The loan modeled here assumes a <strong style={{color:'#e2e8f0'}}>3× SDE price at {loanRate}% over {loanAmort} years with {dpPct}% down</strong>{reVal>0?<span> (real estate included — actual deal uses <strong style={{color:'#e2e8f0'}}>{(loanStructure||'7a')==='504'?`7(a)+504 structure`:`${blendedAmortR9}yr blended term`}</strong>)</span>:''}.
          </p>
          <table style={{width:'100%',fontSize:11,borderCollapse:'collapse'}}>
            <thead>
              <tr style={{borderBottom:'2px solid #1e2d45'}}>
                {['Year','SDE','SBA Annual DS',...(sfAnn>0?['Seller Note DS']:[]),'Total DS','DSCR','Assessment'].map((h,i)=>(
                  <th key={h} style={{textAlign:i===0?'left':'right',padding:'6px '+(i===0?'0':'8px'),color:'#475569',fontSize:10,textTransform:'uppercase',letterSpacing:'0.05em',fontWeight:600}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {years.map((y,i)=>{
                const sde=calcSDE(y).sde;
                const d=totalDscrAnn>0?sde/totalDscrAnn:0;
                const thresholds=[{g:1.5,y:1.25},{g:1.7,y:1.25},{g:2.0,y:1.8}];
                const t=thresholds[i]||thresholds[2];
                const clr=d>=t.g?'#059669':d>=t.y?'#d97706':'#dc2626';
                const lbl=d>=t.g?'✓ Strong':d>=t.y?'⚠ Marginal':'✗ Below Min';
                return (
                  <tr key={y.year} style={{borderBottom:'1px solid #1e2d45'}}>
                    <td style={{padding:'7px 0',color:'#e2e8f0',fontWeight:700}}>{y.year}</td>
                    <td className="rpt-green mono" style={{textAlign:'right',padding:'7px 8px',color:'#2eb860'}}>{fmtD(sde)}</td>
                    <td className="rpt-red mono" style={{textAlign:'right',padding:'7px 8px',color:'#f87171'}}>{fmtD(dscrAnn)}</td>
                    {sfAnn>0&&<td className="rpt-red mono" style={{textAlign:'right',padding:'7px 8px',color:'#f87171'}}>{fmtD(sfAnn)}</td>}
                    <td className="rpt-red mono" style={{textAlign:'right',padding:'7px 8px',color:'#f87171',fontWeight:700}}>{fmtD(totalDscrAnn)}</td>
                    <td className={`mono ${d>=t.g?'rpt-green':d>=t.y?'rpt-amber':'rpt-red'}`} style={{textAlign:'right',padding:'7px 8px',fontWeight:800,fontSize:14,color:clr}}>{d>0?d.toFixed(2):'—'}</td>
                    <td className={d>=t.g?'rpt-green':d>=t.y?'rpt-amber':'rpt-red'} style={{textAlign:'right',padding:'7px 0',fontSize:11,color:clr,fontWeight:600}}>{lbl}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {sfAnn>0&&<div style={{marginTop:8,fontSize:11,color:'#64748b'}}>
            Seller note of {fmtD(sfAmt)} at {su?.sfRate}% / {su?.sfAmort}yr adds {fmtD(sfAnn)}/yr to total debt service.
          </div>}
        </div>}

        {/* Section 5 — Seller Reality Check */}
        {vis.seller&&sellerAskP>0&&(
          <div className="card p-5 mb-4" style={{pageBreakInside:'avoid'}}>
            <SH n={5} title="Seller Reality Check"/>
            <p style={{fontSize:12,lineHeight:1.75,color:'#94a3b8',marginBottom:14}}>
              An SBA lender requires a <strong style={{color:'#e2e8f0'}}>DSCR of at least 1.25×</strong> — the business must generate
              $1.25 of cash flow for every $1.00 of loan payment. After deducting a buyer salary and contingency reserve,
              the adjusted DSCR shows true borrower capacity. The table below compares the seller's asking price,
              the advisor's recommended price, and the maximum price the business can mathematically support.
            </p>
            {(()=>{
              const sprices=[sellerAskP,mp,sMax125];
              const slabels=["Seller's Price","Advisor's Price","Max @ 1.25×"];
              const smets=[sAskM,sAdvM,sMaxM];
              const shdrC=['#dc2626','#059669','#60a5fa'];
              const srow=(lbl,vals,colFn,bold)=>(
                <tr style={{borderBottom:'1px solid #0f1623',background:bold?'#071a0b':'transparent'}}>
                  <td style={{padding:'4px 0',color:'#94a3b8',fontSize:11,fontWeight:bold?700:400}}>{lbl}</td>
                  {vals.map((v,i)=><td key={i} style={{textAlign:'right',fontFamily:'monospace',fontSize:11,padding:'4px 8px',color:typeof colFn==='function'?colFn(v,i):'#e2e8f0',fontWeight:bold?700:400}}>{v!=null?fmtD(v):'—'}</td>)}
                </tr>
              );
              const sdRow=(lbl,vals)=>(
                <tr style={{borderBottom:'1px solid #1e2d45'}}>
                  <td style={{padding:'4px 0',color:'#94a3b8',fontSize:11,fontWeight:700}}>{lbl}</td>
                  {vals.map((d,i)=><td key={i} style={{textAlign:'right',fontFamily:'monospace',fontSize:13,fontWeight:800,padding:'4px 8px',color:d!=null?sDC(d):'#475569'}}>{d!=null?d.toFixed(2):'—'}</td>)}
                </tr>
              );
              return (
                <table style={{width:'100%',borderCollapse:'collapse',marginBottom:14}}>
                  <thead>
                    <tr style={{borderBottom:'2px solid #1e2d45'}}>
                      <th style={{textAlign:'left',color:'#475569',fontSize:10,textTransform:'uppercase',padding:'4px 0',width:'35%'}}>Metric</th>
                      {slabels.map((l,i)=><th key={i} style={{textAlign:'right',color:shdrC[i],fontSize:10,fontWeight:700,padding:'4px 8px',textTransform:'uppercase'}}>{l}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {srow('Asking Price',sprices.map(p=>p>0?p:null),()=>'#e2e8f0',true)}
                    {srow(`Down Payment (${dpPct||10}%)`,sprices.map(p=>p>0?p*dp:null),()=>'#94a3b8')}
                    {srow('SBA Loan',sprices.map(p=>p>0?p*(1-dp):null),()=>'#94a3b8')}
                    {srow('Monthly Payment',smets.map(m=>m?m.mo:null),()=>'#fbbf24')}
                    {srow('Annual Debt Service',smets.map(m=>m?m.ann:null),()=>'#f87171')}
                    {srow('SDE Available',sprices.map(()=>base),()=>'#2eb860',true)}
                    {srow('− Buyer Salary',sprices.map(()=>sellerSal||0),()=>'#94a3b8')}
                    {srow('= Adjusted SDE',sprices.map(()=>base-sellerSal),(v)=>v>=0?'#2eb860':'#f87171',true)}
                    {sdRow('Raw DSCR',smets.map(m=>m?m.rawD:null))}
                    {sdRow('Adj. DSCR',smets.map(m=>m?m.adjD:null))}
                    {srow(`− Contingency (${sellerContP}%)`,sprices.map(()=>base*(sellerContP/100)),()=>'#94a3b8')}
                    <tr style={{borderBottom:'1px solid #1e2d45',background:'#071a0b'}}>
                      <td style={{padding:'4px 0',color:'#94a3b8',fontSize:11,fontWeight:700}}>= Cash Left Over</td>
                      {smets.map((m,i)=><td key={i} style={{textAlign:'right',fontFamily:'monospace',fontSize:13,fontWeight:800,padding:'4px 8px',color:m?sCC(m.cash):'#475569'}}>{m?fmtD(m.cash):'—'}</td>)}
                    </tr>
                    <tr>
                      <td style={{padding:'5px 0',color:'#94a3b8',fontSize:11,fontWeight:700}}>Status</td>
                      {smets.map((m,i)=><td key={i} style={{textAlign:'right',padding:'5px 8px',fontSize:11,fontWeight:700,color:m?(m.adjD>=1.5?'#059669':m.adjD>=1.25?'#d97706':'#dc2626'):'#475569'}}>{sStatus(m)}</td>)}
                    </tr>
                  </tbody>
                </table>
              );
            })()}
            {(()=>{
              const slines=[];
              if(sellerAskP>0&&sAskM){
                slines.push(`At the seller's asking price of ${fmtD(sellerAskP)}, the raw DSCR is ${sAskM.rawD.toFixed(2)}${sAskM.rawD<1.25?' — well below the 1.25× SBA minimum':sAskM.rawD<1.5?' — near the SBA minimum of 1.25×':''}.`);
                if(sellerSal>0)slines.push(`After deducting a ${fmtD(sellerSal)} buyer salary, the adjusted DSCR drops to ${sAskM.adjD.toFixed(2)}${sAskM.adjD<1.25?', making loan approval unlikely at this price':''}.`);
              }
              if(sMax125>0)slines.push(`The maximum supportable price at 1.25× DSCR${sellerSal>0?` with a ${fmtD(sellerSal)} buyer salary`:''} is ${fmtD(sMax125)}.`);
              if(!slines.length)return null;
              return <div style={{background:'#0a1f05',border:'1px solid #1a5e35',borderRadius:7,padding:'12px 14px',fontSize:12,color:'#94a3b8',lineHeight:1.8,fontStyle:'italic'}}>{slines.join(' ')}</div>;
            })()}
          </div>
        )}

        {/* Section 6 — Buyer ROI */}
        {vis.roi&&(()=>{
          const rmp=pn(su?.marketPrice), rdp=(dpPct||10)/100;
          const rr=(loanRate||10.75)/100/12, rn=(loanAmort||10)*12;
          const rpmt=loan=>rr===0?loan/rn:loan*rr*Math.pow(1+rr,rn)/(Math.pow(1+rr,rn)-1);
          const rsfAmt=pn(su?.sellerFin),rsfR=(pn(su?.sfRate)||0)/100/12,rsfN=(pn(su?.sfAmort)||0)*12;
          const rsbaLoan=Math.max(0,rmp*(1-rdp)-rsfAmt);
          const rsbaAnn=rpmt(rsbaLoan)*12;
          const rsfAnn=(rsfAmt>0&&rsfR>0&&rsfN>0?(rsfAmt*rsfR*Math.pow(1+rsfR,rsfN)/(Math.pow(1+rsfR,rsfN)-1)):0)*12;
          const rTotalDS=rsbaAnn+rsfAnn;
          const rClose=(su?.closing===''||su?.closing===undefined)?15000:pn(su?.closing);
          const rFee=rsbaLoan*0.75*0.035;
          const rTotalCash=rmp*rdp+rClose+rFee+pn(su?.wc);
          const rsde=sdeBasis==='weighted'?wtdSDE(years):recentSDE(years);
          const rNetCF=rsde-rTotalDS;
          const rCoC=rTotalCash>0?rNetCF/rTotalCash*100:0;
          const rroi2=state.roi||{};
          const rGrowth=pn(rroi2.growthPct||'0')/100;
          const rExitYrs=Math.max(1,pn(rroi2.exitYears||'10'));
          const rExitMult=pn(rroi2.exitMultiple)||pn(state.ind?.sdeMult)||3.5;
          const rRemBal=(loan,rate,mo,yrs)=>{let b=loan;if(!rate||!mo||b<=0)return 0;for(let m=0;m<yrs*12;m++){b-=(mo-b*rate);if(b<=0)return 0;}return Math.max(0,b);};
          const rExitSDE=rsde*Math.pow(1+rGrowth,rExitYrs-1);
          let rCumCF=0;for(let y=1;y<=rExitYrs;y++)rCumCF+=Math.max(0,rsde*Math.pow(1+rGrowth,y-1)-rTotalDS);
          const rSbaRem=rRemBal(rsbaLoan,rr,rpmt(rsbaLoan),rExitYrs);
          const rScen=mult=>{const tv=rExitSDE*mult;const net=tv-rSbaRem-(rsfAmt>0?rRemBal(rsfAmt,rsfR,(rsfAmt>0&&rsfR>0&&rsfN>0?rsfAmt*rsfR*Math.pow(1+rsfR,rsfN)/(Math.pow(1+rsfR,rsfN)-1):0),rExitYrs):0);const tot=rCumCF+net;return{tv,tot,roi:rTotalCash>0?tot/rTotalCash*100:0,cagr:rTotalCash>0?Math.pow(tot/rTotalCash,1/rExitYrs)-1:0};};
          if(rmp===0||rsde===0)return null;
          return (
            <div className="card p-5 mb-4" style={{pageBreakInside:'avoid'}}>
              <SH n={6} title="Buyer ROI Summary"/>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:14}}>
                {[['Total Cash to Close',fmtD(rTotalCash),'#2eb860'],['Cash-on-Cash Return',rCoC.toFixed(1)+'%',rCoC>=15?'#2eb860':rCoC>=10?'#fbbf24':'#f87171'],['Leverage Ratio',`${(rmp/rTotalCash).toFixed(1)}:1`,'#60a5fa']].map(([l,v,c])=>(
                  <div key={l} style={{textAlign:'center',padding:'10px',background:'#0f1623',borderRadius:6,border:'1px solid #1e2d45'}}>
                    <div style={{fontSize:9,color:'#64748b',marginBottom:3,fontWeight:600,textTransform:'uppercase'}}>{l}</div>
                    <div style={{fontFamily:'monospace',fontWeight:800,fontSize:16,color:c}}>{v}</div>
                  </div>
                ))}
              </div>
              <table style={{width:'100%',fontSize:11,borderCollapse:'collapse',marginBottom:14}}>
                <thead><tr style={{borderBottom:'1px solid #1e2d45'}}>
                  <th style={{textAlign:'left',color:'#475569',paddingBottom:5,fontSize:10,fontWeight:600}}>Year 1 Returns</th>
                  <th style={{textAlign:'right',color:'#64748b',paddingBottom:5,fontSize:10}}>Annual</th>
                  <th style={{textAlign:'right',color:'#64748b',paddingBottom:5,fontSize:10}}>Monthly</th>
                </tr></thead>
                <tbody>
                  {[['Seller\'s Discretionary Earnings',rsde,true,'#2eb860'],['− SBA Loan Payment',-rsbaAnn,false,'#f87171'],...(rsfAnn>0?[['− Seller Financing',-rsfAnn,false,'#f87171']]:[]),['Net Cash Flow',rNetCF,true,rNetCF>=0?'#2eb860':'#f87171']].map(([l,v,bold,c])=>(
                    <tr key={l} style={{borderBottom:'1px solid #0f1623'}}>
                      <td style={{padding:'5px 0',color:'#94a3b8',fontWeight:bold?700:400}}>{l}</td>
                      <td style={{textAlign:'right',fontFamily:'monospace',color:c,fontWeight:bold?700:400,paddingLeft:8}}>{v>=0?fmtD(v):`(${fmtD(Math.abs(v))})`}</td>
                      <td style={{textAlign:'right',fontFamily:'monospace',color:c,fontWeight:bold?700:400,paddingLeft:8}}>{v>=0?fmtD(v/12):`(${fmtD(Math.abs(v)/12)})`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{fontSize:10,fontWeight:700,color:'#94a3b8',marginBottom:6}}>EXIT SCENARIOS — YEAR {rExitYrs} (SDE: {fmtD(rExitSDE)} · Exit multiples based on {rExitMult.toFixed(1)}× market)</div>
              <table style={{width:'100%',fontSize:11,borderCollapse:'collapse'}}>
                <thead><tr style={{borderBottom:'1px solid #1e2d45'}}>
                  <th style={{textAlign:'left',color:'#475569',fontWeight:600,paddingBottom:4}}>Scenario</th>
                  {[['Conservative',rExitMult-1],['Market',rExitMult],['Premium',rExitMult+1]].map(([l])=><th key={l} style={{textAlign:'right',color:l==='Market'?'#fbbf24':'#64748b',fontWeight:700,paddingBottom:4,paddingLeft:8}}>{l}</th>)}
                </tr></thead>
                <tbody>
                  {[['Multiple',m=>m.toFixed(1)+'×','#94a3b8'],['Total Return',m=>fmtD(rScen(m).tot),'#fbbf24'],['Total ROI',m=>rScen(m).roi.toFixed(0)+'%','#a78bfa'],['CAGR',m=>(rScen(m).cagr*100).toFixed(1)+'%','#34d399']].map(([l,fn,c])=>(
                    <tr key={l} style={{borderBottom:'1px solid #0f1623'}}>
                      <td style={{padding:'5px 0',color:'#94a3b8'}}>{l}</td>
                      {[rExitMult-1,rExitMult,rExitMult+1].map(m=><td key={m} style={{textAlign:'right',fontFamily:'monospace',color:c,paddingLeft:8}}>{fn(m)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })()}

        {/* Section 6 — Sources & Uses */}
        {vis.sources&&<div className="card p-5 mb-4" style={{pageBreakInside:'avoid'}}>
          <SH n={7} title="Sources & Uses of Funds"/>
          <p style={{fontSize:12,lineHeight:1.75,color:'#94a3b8',marginBottom:16}}>
            Every acquisition has two sides: <strong style={{color:'#e2e8f0'}}>Sources</strong> (where the money comes from)
            and <strong style={{color:'#e2e8f0'}}>Uses</strong> (where every dollar goes).
            The <strong style={{color:'#e2e8f0'}}>SBA 7(a) loan</strong> is the primary financing vehicle for acquisitions of this type,
            enabling buyers to acquire a business with as little as {dpPct}% down.
            The SBA guarantee fee — charged by the federal government for backing the loan — and closing costs
            are typically rolled into the loan amount, minimizing cash needed at closing.
            For the deal to be fully funded, Total Sources must equal or exceed Total Uses.
          </p>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
            <div>
              <div style={{fontSize:10,fontWeight:700,color:'#2eb860',textTransform:'uppercase',letterSpacing:'0.08em',paddingBottom:8,marginBottom:8,borderBottom:'2px solid #1a5e35'}}>SOURCES — How It's Funded</div>
              <Row label={`SBA Loan (${(100-dpPct)}% of project + fee + closing)`} val={fmtD(totalLoan)} color='#2eb860'/>
              <Row label={`Buyer Down Payment (${dpPct}% of total project)`} val={fmtD(downAmt)} color='#cbd5e1'/>
              {sfAmt>0&&<Row label="Seller Financing Note" val={fmtD(sfAmt)} color='#fbbf24'/>}
              <Row label="Total Sources" val={fmtD(totalLoan+downAmt+sfAmt)} color='#2eb860' bold top/>
            </div>
            <div>
              <div style={{fontSize:10,fontWeight:700,color:'#f87171',textTransform:'uppercase',letterSpacing:'0.08em',paddingBottom:8,marginBottom:8,borderBottom:'2px solid #7f1d1d'}}>USES — Where It Goes</div>
              <Row label="Market Price" val={fmtD(mp)} color='#cbd5e1'/>
              {reVal>0&&<Row label="Real Estate" val={fmtD(reVal)} color='#cbd5e1'/>}
              {wcVal>0&&<Row label="Working Capital" val={fmtD(wcVal)} color='#cbd5e1'/>}
              {arVal>0&&<Row label="Accounts Receivable" val={fmtD(arVal)} color='#cbd5e1'/>}
              {invVal>0&&<Row label="Inventory" val={fmtD(invVal)} color='#cbd5e1'/>}
              <Row label="SBA Guarantee Fee (3.5% of 75% of loan)" val={fmtD(guarFee)} color='#94a3b8'/>
              <Row label="Closing Costs" val={fmtD(closingAmt)} color='#94a3b8'/>
              <Row label="Total Uses" val={fmtD(totalProject+guarFee+closingAmt)} color='#f87171' bold top/>
            </div>
          </div>
        </div>}

        {/* Section 5 — Net Proceeds */}
        {vis.proceeds&&<div className="card p-5 mb-4" style={{pageBreakInside:'avoid'}}>
          <SH n={8} title="Net Proceeds to Seller" color='#f59e0b'/>
          <p style={{fontSize:12,lineHeight:1.75,color:'#94a3b8',marginBottom:16}}>
            The gross sale price is rarely what a seller takes home. Several obligations are settled at closing before the seller receives their check.
            Any outstanding <strong style={{color:'#e2e8f0'}}>business debt or mortgage</strong> is paid off first.
            The <strong style={{color:'#e2e8f0'}}>broker's commission</strong> — typically 8–12% of the sale price — compensates the intermediary who brought the deal together.
            <strong style={{color:'#e2e8f0'}}> Legal and closing fees</strong> cover attorney review, due diligence, and transaction costs.
            Finally, <strong style={{color:'#e2e8f0'}}>capital gains taxes</strong> apply to any gain above the seller's adjusted cost basis in the business.
            What remains after all deductions is the seller's <em>true</em> take-home amount.
          </p>
          {(()=>{
            const gross=mp||pn(state.np?.gross);
            const mortgage=pn(state.np?.mortgage);
            const commPct=pn(state.np?.commission)/100;
            const comm=gross*commPct;
            const legal=pn(state.np?.legal);
            const taxRate=pn(state.np?.taxRate)/100;
            const taxable=gross-mortgage-comm-legal;
            const tax=taxable>0?taxable*taxRate:0;
            return (
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,alignItems:'center'}}>
                <div>
                  <Row label="Gross Sale Price" val={fmtD(gross)} color='#2eb860' bold/>
                  <Row label="Less: Debt / Mortgage Payoff" val={`(${fmtD(mortgage)})`} color='#f87171'/>
                  <Row label={`Less: Broker Commission (${(commPct*100).toFixed(0)}%)`} val={`(${fmtD(comm)})`} color='#f87171'/>
                  <Row label="Less: Legal & Closing Fees" val={`(${fmtD(legal)})`} color='#f87171'/>
                  <Row label={`Less: Estimated Tax (${(taxRate*100).toFixed(0)}%)`} val={`(${fmtD(tax)})`} color='#f87171'/>
                </div>
                <div style={{textAlign:'center',background:'#0a1f05',border:'1px solid #1a5e35',borderRadius:10,padding:'24px 16px'}}>
                  <div style={{fontSize:11,color:'#64748b',marginBottom:6,textTransform:'uppercase',letterSpacing:'0.08em',fontWeight:600}}>Estimated Net Proceeds</div>
                  <div style={{fontFamily:'monospace',fontWeight:900,fontSize:32,color:net>=0?'#2eb860':'#ef4444'}}>{fmtD(net)}</div>
                  <div style={{fontSize:10,color:'#475569',marginTop:6}}>after all deductions at closing</div>
                </div>
              </div>
            );
          })()}
        </div>}

        {/* Section 6 — QSI NLB */}
        {vis.nlb&&<div className="card p-5 mb-4" style={{pageBreakInside:'avoid'}}>
          <SH n={9} title="QSI™ Next Larger Business (NLB) Strategy" color='#8b5cf6'/>
          <p style={{fontSize:12,lineHeight:1.75,color:'#94a3b8',marginBottom:16}}>
            Rather than leaving sale proceeds in low-yield savings or investments, the <strong style={{color:'#e2e8f0'}}>QSI™ NLB Strategy</strong> shows
            how a seller can put their net proceeds to work by using them as a down payment on a <em>larger, more profitable business</em>.
            By leveraging the SBA's minimum 10% down payment requirement, even a modest set of proceeds can unlock access to a significantly
            larger acquisition — amplifying the seller's future income without requiring them to spend their entire liquidity.
            The "Annual Cash Flow Increase" below represents the estimated difference in owner earnings between the business being sold
            and the next business the seller could acquire using this strategy.
          </p>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
            <div>
              <div style={{fontSize:10,fontWeight:700,color:'#8b5cf6',textTransform:'uppercase',letterSpacing:'0.08em',paddingBottom:8,marginBottom:8,borderBottom:'2px solid #4c1d95'}}>STRATEGY INPUTS</div>
              <Row label="Net Proceeds from Sale" val={fmtD(net)} color='#2eb860'/>
              <Row label={`Down Payment for Next Acquisition (${nlbPct}%)`} val={fmtD(nlbDp)} color='#fbbf24'/>
              <Row label="Remaining Liquid Proceeds After DP" val={fmtD(net-nlbDp)} color='#94a3b8'/>
              <Row label="Current Business SDE" val={fmtD(curSDE)} color='#2eb860'/>
            </div>
            <div>
              <div style={{fontSize:10,fontWeight:700,color:'#8b5cf6',textTransform:'uppercase',letterSpacing:'0.08em',paddingBottom:8,marginBottom:8,borderBottom:'2px solid #4c1d95'}}>NEXT BUSINESS PROJECTION</div>
              <Row label="Target Acquisition Price (10% down)" val={fmtD(nlbTarget)} color='#a78bfa'/>
              <Row label="Estimated Next Business SDE (3× value)" val={fmtD(nextSDE)} color='#a78bfa'/>
              <div style={{marginTop:10,padding:'10px 0',borderTop:'2px solid #4c1d95',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span style={{color:'#e2e8f0',fontWeight:700,fontSize:12}}>Estimated Annual Income Increase</span>
                <span style={{fontFamily:'monospace',fontWeight:800,fontSize:14,color:nextSDE-curSDE>=0?'#2eb860':'#ef4444'}}>{fmtD(nextSDE-curSDE)}</span>
              </div>
            </div>
          </div>
        </div>}

        {/* Section: Narrative Analysis */}
        {vis.narrative&&(()=>{
          const withData=[...sortedByYear(years)].filter(y=>pn(y.revenue)>0);
          const c0=withData.length>0?calcSDE(withData[0]):null;
          const c1=withData.length>1?calcSDE(withData[1]):null;
          const yoy=(cur,prev)=>prev&&Math.abs(prev)>0?((cur-prev)/Math.abs(prev)*100):null;
          const chartData=[...withData].reverse().map(y=>{const c=calcSDE(y);return{year:String(y.year),revenue:c.rev,sde:c.sde,gm:c.rev>0?+(c.gp/c.rev*100).toFixed(1):0,em:c.rev>0?+(c.ebitda/c.rev*100).toFixed(1):0,sm:c.rev>0?+(c.sde/c.rev*100).toFixed(1):0};});
          const pctFmt=v=>v.toFixed(1)+'%';
          const wfSteps=c0?(()=>{const idao=c0.int+c0.taxes+c0.dep+c0.amor,ab=c0.ab+c0.rentAB,s=[{label:'Revenue',val:c0.rev,type:'start'},{label:'− COGS',val:-c0.cogs,type:'step'},{label:'Gr. Profit',val:c0.gp,type:'total'},{label:'− OpEx',val:-c0.opx,type:'step'},{label:'NOI',val:c0.noi,type:'total'}];if(idao>0)s.push({label:'+I/T/D&A',val:idao,type:'step'});s.push({label:'EBITDA',val:c0.ebitda,type:'total'});if(c0.oc>0)s.push({label:'+OC',val:c0.oc,type:'step'});if(ab>0)s.push({label:'+Add-Backs',val:ab,type:'step'});s.push({label:'SDE',val:c0.sde,type:'total'});return s;})():[];
          const KpiCard=({label,value,pctOfRev,yoyPct,color='#e2e8f0'})=>{const up=yoyPct!=null&&yoyPct>=0;return(<div className="card p-4" style={{flex:1}}><div style={{fontSize:10,color:'#475569',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6}}>{label}</div><div style={{fontFamily:'monospace',fontSize:16,fontWeight:800,color,marginBottom:4}}>{value}</div><div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{pctOfRev!=null&&<span style={{fontSize:10,color:'#64748b'}}>{pctOfRev.toFixed(1)}% of rev</span>}{yoyPct!=null&&<span style={{fontSize:10,color:up?'#2eb860':'#ef4444',fontWeight:600}}>{up?'▲':'▼'}{Math.abs(yoyPct).toFixed(1)}% YoY</span>}</div></div>);};
          return (
            <div className="card p-5 mb-4" style={{pageBreakInside:'avoid'}}>
              <SH n={10} title="Financial Narrative Analysis"/>
              {c0&&(<>
                {/* KPI cards */}
                <div style={{display:'flex',gap:10,marginBottom:14}}>
                  <KpiCard label="Revenue" value={fmtD(c0.rev)} yoyPct={yoy(c0.rev,c1?.rev)} color="#e2e8f0"/>
                  <KpiCard label="Gross Profit" value={fmtD(c0.gp)} pctOfRev={c0.rev>0?c0.gp/c0.rev*100:null} yoyPct={yoy(c0.gp,c1?.gp)} color="#60a5fa"/>
                  <KpiCard label="EBITDA" value={fmtD(c0.ebitda)} pctOfRev={c0.rev>0?c0.ebitda/c0.rev*100:null} yoyPct={yoy(c0.ebitda,c1?.ebitda)} color="#a78bfa"/>
                  <KpiCard label="SDE" value={fmtD(c0.sde)} pctOfRev={c0.rev>0?c0.sde/c0.rev*100:null} yoyPct={yoy(c0.sde,c1?.sde)} color="#2eb860"/>
                </div>
                {/* Trend charts */}
                <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10,marginBottom:14}}>
                  {[{l:'Revenue Trend',k:'revenue',c:'#60a5fa',f:undefined},{l:'Gross Margin %',k:'gm',c:'#3b82f6',f:pctFmt},{l:'EBITDA Margin %',k:'em',c:'#a78bfa',f:pctFmt},{l:'SDE Trend',k:'sde',c:'#2eb860',f:undefined}].map(ch=>(
                    <div key={ch.k} className="card p-3">
                      <div style={{fontSize:10,color:'#64748b',fontWeight:600,marginBottom:6}}>{ch.l}</div>
                      <BarChart data={chartData} dataKey={ch.k} color={ch.c} fmtAxis={ch.f}/>
                    </div>
                  ))}
                </div>
                {/* Waterfall */}
                {wfSteps.length>0&&<div style={{marginBottom:14}}>
                  <div style={{fontSize:10,color:'#475569',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8}}>Revenue → SDE Bridge — {withData[0]?.year}</div>
                  <WaterfallChart steps={wfSteps}/>
                </div>}
              </>)}
              {/* Narrative text */}
              {narrativeStatus==='done'
                ? <div style={{borderTop:'1px solid #1e2d45',paddingTop:14,marginTop:4}}>{renderNarrative(narrative)}</div>
                : <p className="no-print" style={{color:'#475569',fontSize:12,fontStyle:'italic',marginTop:8}}>
                    Narrative text not yet generated — go to the <strong style={{color:'#94a3b8'}}>Narrative Report</strong> tab and click Generate to populate this section.
                  </p>
              }
            </div>
          );
        })()}

        {/* Footer */}
        <div style={{marginTop:20,paddingTop:12,borderTop:'1px solid #1e2d45',display:'flex',justifyContent:'space-between',fontSize:10,color:'#334155'}}>
          <span>QSI™ Market Price Analyzer &nbsp;·&nbsp; Confidential &nbsp;·&nbsp; For Discussion Purposes Only</span>
          <span>{new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})}</span>
        </div>
      </div>
    </div>
  );
};

/* ── Load Modal ────────────────────────────────────── */
const LoadModal = ({onClose, onLoad, user}) => {
  const [deals, setDeals] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [deleting, setDeleting] = React.useState(null);

  React.useEffect(()=>{
    const db = firebase.firestore();
    db.collection('deals').orderBy('_savedAt','desc').get()
      .then(snap=>{
        const rows = snap.docs.map(d=>({id:d.id, ...d.data()}));
        setDeals(rows);
      })
      .catch(()=>setDeals([]))
      .finally(()=>setLoading(false));
  },[]);

  const handleDelete = async (id, nm) => {
    if(!window.confirm(`Delete "${nm}" from shared library?`)) return;
    setDeleting(id);
    try {
      await firebase.firestore().collection('deals').doc(id).delete();
      localStorage.removeItem(`deal_${nm}`);
      setDeals(d=>d.filter(x=>x.id!==id));
    } catch(e){ alert('Delete failed: '+e.message); }
    setDeleting(null);
  };

  const rel = ts => {
    if(!ts) return '';
    try {
      const secs = Math.floor((Date.now() - ts.toMillis())/1000);
      if(secs<60) return 'just now';
      if(secs<3600) return `${Math.floor(secs/60)}m ago`;
      if(secs<86400) return `${Math.floor(secs/3600)}h ago`;
      return `${Math.floor(secs/86400)}d ago`;
    } catch(e){ return ''; }
  };

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:1000,display:'flex',alignItems:'center',justifyContent:'center'}}
         onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div style={{background:'#161b27',border:'1px solid #1e2d45',borderRadius:10,padding:24,width:560,maxHeight:'75vh',display:'flex',flexDirection:'column'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
          <span style={{fontWeight:700,fontSize:15,color:'#e2e8f0'}}>Shared Deal Library</span>
          <button onClick={onClose} style={{background:'none',border:'none',color:'#64748b',fontSize:20,cursor:'pointer',lineHeight:1}}>&times;</button>
        </div>
        {loading ? (
          <div style={{textAlign:'center',padding:32,color:'#64748b'}}>Loading deals...</div>
        ) : deals.length===0 ? (
          <div style={{textAlign:'center',padding:32,color:'#64748b'}}>No deals in shared library yet.</div>
        ) : (
          <div style={{overflowY:'auto',flex:1}}>
            {deals.map(d=>(
              <div key={d.id} style={{display:'flex',alignItems:'center',gap:8,padding:'9px 6px',borderBottom:'1px solid #1e2d45'}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontWeight:600,fontSize:13,color:'#e2e8f0',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                    {d.dealName||d.id}
                  </div>
                  <div style={{fontSize:11,color:'#64748b',marginTop:2}}>
                    {d._savedByName||d._savedBy||'Unknown'} &middot; {rel(d._savedAt)}
                  </div>
                </div>
                <button onClick={()=>onLoad(d)}
                  style={{background:'#1a5e35',color:'#6de09a',border:'none',borderRadius:5,padding:'5px 12px',cursor:'pointer',fontSize:12,flexShrink:0}}>
                  Load
                </button>
                {(d._savedBy===user?.email) && (
                  <button onClick={()=>handleDelete(d.id, d.dealName||d.id)}
                    disabled={deleting===d.id}
                    style={{background:'#3b0a0a',color:'#f87171',border:'none',borderRadius:5,padding:'5px 10px',cursor:'pointer',fontSize:12,flexShrink:0,opacity:deleting===d.id?0.5:1}}>
                    {deleting===d.id?'...':'Delete'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const LOGO_SRC="data:image/png;base64,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";
/* ── PDF Extraction ────────────────────────────────── */
const INCOME_PROMPT=`Extract income statement data from this business tax return. Return ONLY a valid JSON object with these exact keys (use null for any field not found — do not guess):
{"entityType":"1120-S or 1065 or 1120 or Schedule C","year":number,"revenue":number or null,"cogs":number or null,"otherIncome":number or null,"opx":number or null,"interest":number or null,"depreciation":number or null,"amortization":number or null,"ownerComp":number or null,"taxes":number or null,"rent":number or null}
IMPORTANT: Only populate the "taxes" field if this is a 1120 C-Corp return. For 1120-S, 1065, or Schedule C returns, always set "taxes" to null regardless of any tax amounts shown.
IMPORTANT: For "revenue", use ONLY the gross receipts/net sales line — AFTER subtracting returns and allowances but BEFORE subtracting cost of goods sold. Exact lines: 1120-S Line 1c (Balance column) · 1065 Line 1c · 1120 Line 1c · Schedule C Line 1 net of Line 2 returns. Do NOT use "Total income", "Gross income", or any line that already nets out COGS or adds in other income items.
IMPORTANT: For "otherIncome", capture ONLY the "Other income (loss)" line — NOT net gain/loss from Form 4797. Exact lines: 1120-S Line 5 only (do NOT use Line 4 net gain/loss from Form 4797) · 1065 Lines 5–7 · 1120 Lines 9–10 · Schedule C Line 6. Sum all qualifying other income items into a single number. Use null if none present. Do NOT include the ordinary business income/loss line and do NOT include Form 4797 gains/losses.
IMPORTANT: For "interest", extract ONLY the interest expense deduction from the front page. Exact lines: 1120-S Line 13 · 1065 Line 15 · 1120 Line 18 · Schedule C Lines 16a+16b (sum both). Do NOT use advertising (1120-S Line 16), rent, or any other deduction line.
IMPORTANT: For "depreciation", only extract the depreciation amount from the front page of the return (e.g. 1120-S Line 14, 1065 Line 16c, 1120 Line 20, Schedule C Line 13 minus any Section 179). Do NOT include Section 179 depreciation — set it to null if only Section 179 is shown and no regular depreciation is present.
IMPORTANT: For "opx" (operating expenses), use the TOTAL DEDUCTIONS line from the front page of the return only — the single line that sums ALL ordinary business expense lines together. Use these exact lines: 1120-S Line 21 (Total deductions) · 1065 Line 22 (Total deductions) · 1120 Line 27 (Total deductions) · Schedule C Line 28 (Total expenses). This total INCLUDES officer compensation, salaries, interest, depreciation, amortization, and all other expense lines — do NOT subtract any of them. Do NOT use net income, ordinary income, or any profit/loss line. Report the raw total deductions figure even though interest, depreciation, and owner compensation are also extracted in separate fields.
IMPORTANT: For "rent" (rent expense paid by the business for its operating space), look for a "Rent" or "Rent expense" line in the deductions/expenses section or an attached Other Deductions schedule. Common locations: Schedule C Line 20a ("Rent or lease of other business property"), 1120-S/1065/1120 attached Other Deductions schedule showing "Rent". Use null if not clearly identified as rent expense for the business premises.
IMPORTANT: For "ownerComp", extract Officer Compensation from 1120-S Line 7, Partners' Guaranteed Payments from 1065 Line 10, or Officer Compensation from 1120 Line 12. For Schedule C returns, always set "ownerComp" to null — Schedule C has no separate officer compensation deduction line; the net profit of the business is the owner's effective compensation and must not be double-counted.`;

const BS_PROMPT=`Extract balance sheet data from this business tax return or financial statement. Return ONLY a valid JSON object with these exact keys (use null for any field not found — do not guess):
{"cash":number or null,"ar":number or null,"inv":number or null,"ca":number or null,"ta":number or null,"ap":number or null,"cl":number or null,"tl":number or null,"nw":number or null}`;

const COMBINED_PROMPT=`Extract income statement AND balance sheet data from this business tax return. Return ONLY a valid JSON object with exactly this structure (use null for any field not found — do not guess):
{"income":{"entityType":"1120-S or 1065 or 1120 or Schedule C","year":number,"revenue":number or null,"cogs":number or null,"otherIncome":number or null,"opx":number or null,"interest":number or null,"depreciation":number or null,"amortization":number or null,"ownerComp":number or null,"taxes":number or null,"rent":number or null},"balance":{"cash":number or null,"ar":number or null,"inv":number or null,"ca":number or null,"ta":number or null,"ap":number or null,"cl":number or null,"tl":number or null,"nw":number or null}}
IMPORTANT: Only populate income.taxes if this is a 1120 C-Corp return. For 1120-S, 1065, or Schedule C, always set income.taxes to null.
IMPORTANT: For income.revenue, use ONLY the gross receipts/net sales line — AFTER subtracting returns and allowances but BEFORE subtracting cost of goods sold. Exact lines: 1120-S Line 1c (Balance column) · 1065 Line 1c · 1120 Line 1c · Schedule C Line 1 net of Line 2 returns. Do NOT use "Total income", "Gross income", or any line that already nets out COGS or adds in other income items.
IMPORTANT: For income.otherIncome, capture ONLY the "Other income (loss)" line — NOT net gain/loss from Form 4797. Exact lines: 1120-S Line 5 only (do NOT use Line 4 net gain/loss from Form 4797) · 1065 Lines 5–7 · 1120 Lines 9–10 · Schedule C Line 6. Sum all qualifying other income items into a single number. Use null if none present. Do NOT include the ordinary business income/loss line and do NOT include Form 4797 gains/losses.
IMPORTANT: For income.interest, extract ONLY the interest expense deduction from the front page. Exact lines: 1120-S Line 13 · 1065 Line 15 · 1120 Line 18 · Schedule C Lines 16a+16b (sum both). Do NOT use advertising (1120-S Line 16), rent, or any other deduction line.
IMPORTANT: For income.depreciation, only extract the depreciation amount from the front page of the return (e.g. 1120-S Line 14, 1065 Line 16c, 1120 Line 20, Schedule C Line 13 minus any Section 179). Do NOT include Section 179 depreciation — set it to null if only Section 179 is shown and no regular depreciation is present.
IMPORTANT: For income.opx (operating expenses), use the TOTAL DEDUCTIONS line from the front page of the return only — the single line that sums ALL ordinary business expense lines together. Use these exact lines: 1120-S Line 21 (Total deductions) · 1065 Line 22 (Total deductions) · 1120 Line 27 (Total deductions) · Schedule C Line 28 (Total expenses). This total INCLUDES officer compensation, salaries, interest, depreciation, amortization, and all other expense lines — do NOT subtract any of them. Do NOT use net income, ordinary income, or any profit/loss line. Report the raw total deductions figure even though interest, depreciation, and owner compensation are also extracted in separate fields.
IMPORTANT: For income.rent (rent expense paid by the business for its operating space), look for a "Rent" or "Rent expense" line in the deductions/expenses section or an attached Other Deductions schedule. Common locations: Schedule C Line 20a ("Rent or lease of other business property"), 1120-S/1065/1120 attached Other Deductions schedule showing "Rent". Use null if not clearly identified as rent expense for the business premises.
IMPORTANT: For income.ownerComp, extract Officer Compensation from 1120-S Line 7, Partners' Guaranteed Payments from 1065 Line 10, or Officer Compensation from 1120 Line 12. For Schedule C returns, always set income.ownerComp to null — Schedule C has no separate officer compensation deduction line; the net profit of the business is the owner's effective compensation and must not be double-counted.`;

const INDUSTRY_PROMPT=`Extract industry benchmark data from this business reference or industry report. Return ONLY a valid JSON object with exactly this structure (use null for any field not found — do not guess):
{"name":"industry name as shown in the report","naics":"NAICS or SIC code if shown, otherwise null","source":"report publisher and edition (e.g. Business Brokerage Press 2026, BizMiner 2025, RMA Annual Statement Studies)","reportYear":number or null,"grossMarginPct":number or null,"cogsPct":number or null,"preTaxProfitPct":number or null,"netMarginPct":number or null,"sdeMult":number or null,"revenueMultPct":number or null,"ebitMult":number or null,"ebitdaMult":number or null,"sdeMultUnder1M":number or null,"sdeMult1to5M":number or null,"sdeMultOver5M":number or null,"ebitdaMultUnder1M":number or null,"ebitdaMult1to5M":number or null,"ebitdaMultOver5M":number or null}
FIELD DEFINITIONS:
- grossMarginPct: Gross Profit as % of revenue (e.g. 35.1 for 35.1%). Look in "Financial Ratios" Income Statement section or "Expenses" section for Gross Profit %.
- cogsPct: Cost of Goods / Cost of Sales as % of revenue (e.g. 64.9). Look in same sections.
- preTaxProfitPct: Pre-tax profit or operating profit as % of revenue. Look in "Expenses (% of Annual Sales)" section for "Profit (pretax)" line.
- netMarginPct: Net income as % of revenue. Look in Income Statement ratios for "Net Income" row, use the 3-Year or 5-Year average column.
- sdeMult: SDE multiple from "Rules of Thumb" section (e.g. 3.5 for "3.5 x SDE").
- revenueMultPct: Revenue/sales multiple from Rules of Thumb "% of annual sales" (e.g. 42 for "42% of annual sales").
- ebitMult: EBIT multiple from Rules of Thumb (e.g. 4 for "4 x EBIT").
- ebitdaMult: EBITDA multiple from Rules of Thumb (e.g. 4.5 for "4.5 x EBITDA").
- sdeMultUnder1M: MVIC/SDE ratio for businesses under $1M net sales from "Industry Multiples" section.
- sdeMult1to5M: MVIC/SDE ratio for $1M–$5M net sales tier.
- sdeMultOver5M: MVIC/SDE ratio for over $5M net sales tier.
- ebitdaMultUnder1M: MVIC/EBITDA ratio for under $1M net sales tier.
- ebitdaMult1to5M: MVIC/EBITDA ratio for $1M–$5M net sales tier.
- ebitdaMultOver5M: MVIC/EBITDA ratio for over $5M net sales tier.
IMPORTANT: All percentage fields (grossMarginPct, cogsPct, preTaxProfitPct, netMarginPct, revenueMultPct) are plain percentage numbers like 35.1, not decimals like 0.351.`;

const fileToBase64=file=>new Promise((res,rej)=>{
  const r=new FileReader();
  r.onload=()=>res(r.result.split(',')[1]);
  r.onerror=rej;
  r.readAsDataURL(file);
});

const ReviewModal=({reviewData,onApply,onCancel})=>{
  const isCombined=reviewData.type==='combined';
  const isIncome=reviewData.type==='income';
  const isIndustry=reviewData.type==='industry';
  const incomeFields=[['entityType','Entity Type'],['year','Tax Year'],['revenue','Revenue (Line 1c)'],['cogs','COGS'],['otherIncome','Other Income (Line 5)'],['opx','Total Deductions'],['interest','Interest'],['depreciation','Depreciation'],['amortization','Amortization'],['ownerComp',"Owner's Compensation"],['taxes','Taxes (C-Corp)']];
  const bsFields=[['cash','Cash'],['ar','Accounts Receivable'],['inv','Inventory'],['ca','Total Current Assets'],['ta','Total Assets'],['ap','Accounts Payable'],['cl','Total Current Liabilities'],['tl','Total Liabilities'],['nw','Net Worth / Equity']];
  const industryFields=[
    ['name','Industry Name'],['naics','NAICS / SIC Code'],['source','Report Source'],['reportYear','Report Year'],
    ['grossMarginPct','Gross Margin % Benchmark'],['cogsPct','COGS % Benchmark'],['preTaxProfitPct','Pre-Tax Profit % Benchmark'],['netMarginPct','Net Income % Benchmark'],
    ['sdeMult','SDE Multiple (Rules of Thumb)'],['revenueMultPct','Revenue Multiple — % of Annual Sales'],['ebitMult','EBIT Multiple'],['ebitdaMult','EBITDA Multiple'],
    ['sdeMultUnder1M','MVIC/SDE — Under $1M Revenue'],['sdeMult1to5M','MVIC/SDE — $1M–$5M Revenue'],['sdeMultOver5M','MVIC/SDE — Over $5M Revenue'],
    ['ebitdaMultUnder1M','MVIC/EBITDA — Under $1M Revenue'],['ebitdaMult1to5M','MVIC/EBITDA — $1M–$5M Revenue'],['ebitdaMultOver5M','MVIC/EBITDA — Over $5M Revenue'],
  ];
  const fields=isIncome?incomeFields:bsFields;
  const [incVals,setIncVals]=useState(reviewData.income||{});
  const [bsVals,setBsVals]=useState(reviewData.balance||{});
  const [vals,setVals]=useState(isCombined?{}:{...(reviewData.data||{})});
  const overlay={position:'fixed',inset:0,background:'rgba(0,0,0,0.75)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:2000};
  const modal={background:'#161b27',border:'1px solid #1e2d45',borderRadius:10,padding:24,width:480,maxHeight:'85vh',overflowY:'auto'};
  const btnBase={border:'none',borderRadius:5,padding:'7px 16px',fontSize:12,fontWeight:600,cursor:'pointer'};
  const renderField=(k,label,valObj,setValObj)=>(
    <div key={k} style={{marginBottom:10}}>
      <div style={{fontSize:11,color:'#94a3b8',marginBottom:3}}>
        {label}{valObj[k]===null&&<span style={{color:'#fbbf24'}}> — not found</span>}
      </div>
      <input className="input-field" style={{borderColor:valObj[k]===null?'#fbbf24':undefined}}
        value={valObj[k]??''} onChange={e=>setValObj({...valObj,[k]:e.target.value})}/>
    </div>
  );
  const handleApply=()=>isCombined?onApply({income:incVals,balance:bsVals}):onApply(vals);
  const title=isIndustry?'Review Industry Benchmarks':'Review Extracted Data';
  const subtitle=isIndustry?'Confirm the benchmarks extracted from the report. Edit any values before applying.':'Review and correct values before applying.';
  return (
    <div style={overlay}>
      <div style={modal}>
        <div style={{fontWeight:700,fontSize:14,color:'#e2e8f0',marginBottom:4}}>{title}</div>
        <div style={{fontSize:11,color:'#94a3b8',marginBottom:16}}>{subtitle} <span style={{color:'#fbbf24'}}>Yellow fields</span> were not found in the PDF.</div>
        {isCombined?(
          <>
            <div style={{fontSize:12,fontWeight:700,color:'#60a5fa',marginBottom:10,paddingBottom:6,borderBottom:'1px solid #1e2d45'}}>Income Statement</div>
            {incomeFields.map(([k,label])=>renderField(k,label,incVals,setIncVals))}
            <div style={{fontSize:12,fontWeight:700,color:'#34d399',margin:'16px 0 10px',paddingBottom:6,borderBottom:'1px solid #1e2d45'}}>Balance Sheet</div>
            {bsFields.map(([k,label])=>renderField(k,label,bsVals,setBsVals))}
          </>
        ):isIndustry?(
          <>
            <div style={{fontSize:12,fontWeight:700,color:'#a78bfa',marginBottom:10,paddingBottom:6,borderBottom:'1px solid #1e2d45'}}>Industry Info</div>
            {industryFields.slice(0,4).map(([k,label])=>renderField(k,label,vals,setVals))}
            <div style={{fontSize:12,fontWeight:700,color:'#60a5fa',margin:'16px 0 10px',paddingBottom:6,borderBottom:'1px solid #1e2d45'}}>Income Benchmarks</div>
            {industryFields.slice(4,8).map(([k,label])=>renderField(k,label,vals,setVals))}
            <div style={{fontSize:12,fontWeight:700,color:'#fbbf24',margin:'16px 0 10px',paddingBottom:6,borderBottom:'1px solid #1e2d45'}}>Valuation — Rules of Thumb</div>
            {industryFields.slice(8,12).map(([k,label])=>renderField(k,label,vals,setVals))}
            <div style={{fontSize:12,fontWeight:700,color:'#34d399',margin:'16px 0 10px',paddingBottom:6,borderBottom:'1px solid #1e2d45'}}>Valuation — MVIC/SDE by Revenue Tier</div>
            {industryFields.slice(12,15).map(([k,label])=>renderField(k,label,vals,setVals))}
            <div style={{fontSize:12,fontWeight:700,color:'#f87171',margin:'16px 0 10px',paddingBottom:6,borderBottom:'1px solid #1e2d45'}}>Valuation — MVIC/EBITDA by Revenue Tier</div>
            {industryFields.slice(15).map(([k,label])=>renderField(k,label,vals,setVals))}
          </>
        ):(
          fields.map(([k,label])=>(
            <div key={k} style={{marginBottom:10}}>
              <div style={{fontSize:11,color:'#94a3b8',marginBottom:3}}>
                {label}{vals[k]===null&&<span style={{color:'#fbbf24'}}> — not found</span>}
              </div>
              <input className="input-field" style={{borderColor:vals[k]===null?'#fbbf24':undefined}}
                value={vals[k]??''} onChange={e=>setVals({...vals,[k]:e.target.value})}/>
            </div>
          ))
        )}
        <div style={{display:'flex',gap:8,marginTop:18}}>
          <button style={{...btnBase,background:'#1a5e35',color:'#6de09a'}} onClick={handleApply}>Apply to Form</button>
          <button style={{...btnBase,background:'#1e293b',color:'#94a3b8'}} onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

/* ── Auth ──────────────────────────────────────────── */
const ALLOWED_DOMAINS = ['thedealteam.co'];
const isAllowed = email => ALLOWED_DOMAINS.some(d => email.endsWith('@' + d));

const SignInScreen = ({denied}) => {
  const signIn = () => {
    const p = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(p).catch(()=>{});
  };
  return (
    <div style={{display:'flex',height:'100vh',alignItems:'center',justifyContent:'center',background:'#0f1117'}}>
      <div className="card p-10 text-center" style={{maxWidth:360,padding:40}}>
        <div style={{fontSize:18,fontWeight:800,color:'#2eb860',marginBottom:4}}>QSI™ Market Price Analyzer</div>
        <div style={{fontSize:12,color:'#475569',marginBottom:28}}>SBA Acquisition Tool</div>
        {denied && (
          <div style={{background:'#3b0a0a',border:'1px solid #7f1d1d',borderRadius:6,padding:'8px 12px',fontSize:12,color:'#fca5a5',marginBottom:16}}>
            Your Google account is not authorized.<br/>Contact your administrator.
          </div>
        )}
        <button onClick={signIn}
          style={{display:'flex',alignItems:'center',gap:10,margin:'0 auto',background:'#fff',color:'#374151',border:'none',borderRadius:6,padding:'10px 20px',fontSize:13,fontWeight:600,cursor:'pointer',boxShadow:'0 1px 3px rgba(0,0,0,0.3)'}}>
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" width="18" height="18"/>
          Sign in with Google
        </button>
      </div>
    </div>
  );
};

/* ── Acquisition Calculator ─────────────────────────── */
const TAcqCalc = ({state}) => {
  const mpaSDE = state.sdeBasis==='weighted' ? wtdSDE(state.years) : recentSDE(state.years);
  const [c,setC] = useState(() => ({
    liquidity: 113000,
    dpPct: state.dpPct || 10,
    carryPct: 5,
    carryRate: 6,
    carryTerm: 2,
    sbaRate: state.loanRate || 10.75,
    sbaTerm: state.loanAmort || 10,
    multiple: 3.0,
    carryMode: 'standby',
    mode: 'liquidity',  // 'liquidity' | 'sde'
  }));
  const upd = (k,v) => setC(p=>({...p,[k]:v}));

  // Core calculations
  const dpFrac = (c.dpPct||10)/100;
  const carryFrac = (c.carryPct||0)/100;
  const price = c.mode==='sde' ? mpaSDE * (c.multiple||3) : (c.liquidity||0) / dpFrac;
  const sde = c.mode==='sde' ? mpaSDE : price / (c.multiple||3);
  const downAmt = price * dpFrac;
  const sellerNote = price * carryFrac;
  const sbaLoanPct = Math.max(0, 100 - (c.dpPct||10) - (c.carryPct||0));
  const sbaLoan = price * sbaLoanPct / 100;

  // SBA payment
  const r = (c.sbaRate||10.75)/100/12, n = (c.sbaTerm||10)*12;
  const sbaMoPmt = r===0 ? sbaLoan/n : sbaLoan * r * Math.pow(1+r,n) / (Math.pow(1+r,n)-1);
  const sbaAnnual = sbaMoPmt * 12;

  // Seller carry payment
  let carryAnnual = 0;
  if (sellerNote > 0) {
    if (c.carryMode==='standby') {
      carryAnnual = sellerNote * ((c.carryRate||6)/100);
    } else {
      const rc=(c.carryRate||6)/100/12, nc=(c.carryTerm||2)*12;
      const cmo = rc===0 ? sellerNote/nc : sellerNote*rc*Math.pow(1+rc,nc)/(Math.pow(1+rc,nc)-1);
      carryAnnual = cmo * 12;
    }
  }

  const totalDS = sbaAnnual + carryAnnual;
  const cfAfterDS = sde - totalDS;
  const cfPositive = cfAfterDS >= 0;

  // 5-year equity buildup
  const equityRows = [];
  let bal = sbaLoan;
  let cumPrin = 0;
  for (let y=1; y<=5; y++) {
    const balStart = bal;
    const intPaid = balStart * (c.sbaRate||10.75)/100/12 * 12;
    const principal = Math.max(0, sbaAnnual - intPaid);
    bal = Math.max(0, balStart - principal);
    cumPrin += principal;
    equityRows.push({y, balStart, intPaid, principal, balEnd: bal, equity: downAmt + cumPrin});
  }

  const btnBase = {border:'none',borderRadius:5,padding:'7px 16px',fontSize:13,fontWeight:600,cursor:'pointer',transition:'all 0.12s'};
  const modeBtn = (id,label) => (
    <button style={{...btnBase,
      background: c.mode===id ? '#2eb860' : '#1e2d45',
      color: c.mode===id ? '#fff' : '#94a3b8',
    }} onClick={()=>upd('mode',id)}>{label}</button>
  );
  const carryBtn = (id,label) => (
    <button style={{...btnBase,
      background: c.carryMode===id ? '#2eb860' : '#1e2d45',
      color: c.carryMode===id ? '#fff' : '#94a3b8',
      padding:'5px 12px', fontSize:12,
    }} onClick={()=>upd('carryMode',id)}>{label}</button>
  );

  const MetricTile = ({label,sub,value,isCFAD}) => (
    <div className="card p-4" style={isCFAD ? {borderColor: cfPositive?'#2eb860':'#ef4444'} : {}}>
      <div className="lbl" style={{marginBottom:3}}>{label}</div>
      {sub&&<div style={{fontSize:11,color:'#64748b',marginBottom:6}}>{sub}</div>}
      <div className="calc-field mono" style={{
        fontSize:18,fontWeight:700,textAlign:'right',
        color: isCFAD ? (cfPositive?'#2eb860':'#ef4444') : '#2eb860',
        background: isCFAD && !cfPositive ? '#1a0505' : undefined,
        borderColor: isCFAD && !cfPositive ? '#5e1a1a' : undefined,
      }}>{fmtD(value)}</div>
    </div>
  );

  return (
    <div style={{color:'#e2e8f0'}}>
      {/* Header */}
      <div style={{marginBottom:20}}>
        <div style={{fontSize:22,fontWeight:700,color:'#e2e8f0',marginBottom:4}}>Acquisition Calculator</div>
        <div style={{fontSize:13,color:'#64748b'}}>
          SBA 7(a) — {c.sbaTerm}yr @ {c.sbaRate}% — {c.dpPct}% buyer down / {c.carryPct}% seller carry
        </div>
      </div>

      {/* Row 1 — Liquidity + Mode Toggle */}
      <div className="card p-5" style={{marginBottom:12}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr auto',gap:24,alignItems:'start'}}>
          <div>
            <span className="lbl">{c.mode==='sde' ? 'Required Down Payment' : 'Buyer Liquidity'}</span>
            <div style={{display:'flex',alignItems:'center',gap:12}}>
              <input
                type="text"
                className="input-field mono"
                style={{width:160,fontSize:16,fontWeight:600}}
                value={c.mode==='sde' ? fmtD(downAmt).replace(/[^0-9]/g,'') : c.liquidity}
                readOnly={c.mode==='sde'}
                onChange={e=>upd('liquidity',pn(e.target.value)||0)}
              />
              {c.mode==='liquidity' && (
                <input type="range" min={25000} max={500000} step={5000}
                  value={c.liquidity}
                  onChange={e=>upd('liquidity',+e.target.value)}
                  style={{flex:1,accentColor:'#2eb860'}}
                />
              )}
              {c.mode==='sde' && (
                <div style={{fontSize:12,color:'#64748b',flex:1}}>Driven by MPA SDE × {c.multiple}× multiple</div>
              )}
            </div>
            {c.mode==='liquidity' && (
              <div style={{display:'flex',justifyContent:'space-between',fontSize:11,color:'#64748b',marginTop:4}}>
                <span>$25k</span><span>$500k</span>
              </div>
            )}
          </div>
          <div>
            <span className="lbl">Calculation Mode</span>
            <div style={{display:'flex',gap:6}}>
              {modeBtn('liquidity','💰 Liquidity')}
              {modeBtn('sde','📊 SDE')}
            </div>
          </div>
        </div>
      </div>

      {/* Row 2 — Parameters */}
      <div className="card p-5" style={{marginBottom:12}}>
        <div style={{fontSize:11,fontWeight:600,color:'#2eb860',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:12}}>Deal Parameters</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16,marginBottom:14}}>
          <div>
            <span className="lbl">Buyer Down %</span>
            <NI value={c.dpPct} onChange={v=>upd('dpPct',v)}/>
          </div>
          <div>
            <span className="lbl">Seller Carry %</span>
            <NI value={c.carryPct} onChange={v=>upd('carryPct',v)}/>
          </div>
          <div>
            <span className="lbl">Carry Rate %</span>
            <NI value={c.carryRate} onChange={v=>upd('carryRate',v)}/>
          </div>
          <div>
            <span className="lbl">Carry Term (yr)</span>
            <NI value={c.carryTerm} onChange={v=>upd('carryTerm',v)}/>
          </div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16,alignItems:'end'}}>
          <div>
            <span className="lbl">SBA Rate %</span>
            <NI value={c.sbaRate} onChange={v=>upd('sbaRate',v)}/>
          </div>
          <div>
            <span className="lbl">SBA Term (yr)</span>
            <NI value={c.sbaTerm} onChange={v=>upd('sbaTerm',v)}/>
          </div>
          <div>
            <span className="lbl">SDE Multiple</span>
            <NI value={c.multiple} onChange={v=>upd('multiple',v)}/>
          </div>
          <div>
            <span className="lbl">Seller Carry Type</span>
            <div style={{display:'flex',gap:6}}>
              {carryBtn('standby','Standby')}
              {carryBtn('amortizing','Amortizing')}
            </div>
          </div>
        </div>
      </div>

      {/* Row 3 — Big metric cards */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
        <div className="card p-5">
          <div className="lbl" style={{marginBottom:6}}>Business Purchase Price</div>
          <div className="calc-field mono" style={{fontSize:24,fontWeight:800,textAlign:'right',marginBottom:6}}>{fmtD(price)}</div>
          <div style={{fontSize:12,color:'#64748b'}}>Based on {c.dpPct}% buyer equity injection</div>
        </div>
        <div className="card p-5" style={{borderColor:'#2eb860'}}>
          <div className="lbl" style={{marginBottom:6}}>Annual Cash Flow (SDE)</div>
          <div className="calc-field mono" style={{fontSize:24,fontWeight:800,textAlign:'right',marginBottom:6,color:'#2eb860'}}>{fmtD(sde)}</div>
          <div style={{fontSize:12,color:'#64748b'}}>Valued at {(c.multiple||3).toFixed(1)}× cash flow</div>
        </div>
      </div>

      {/* Row 4 — Four metric tiles */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
        <MetricTile
          label={`SBA Loan (${sbaLoanPct}%)`}
          sub={`${c.sbaRate}% / ${c.sbaTerm}yr — ${fmtD(sbaMoPmt)}/mo`}
          value={sbaLoan}
        />
        <MetricTile
          label={`Seller Note (${c.carryPct}%)`}
          sub={c.carryMode==='standby' ? 'Interest-only standby per SBA' : `Amortizing ${c.carryTerm}yr @ ${c.carryRate}%`}
          value={sellerNote}
        />
        <MetricTile
          label="Annual Debt Service"
          sub={`SBA ${fmtD(sbaAnnual)} + Carry ${fmtD(carryAnnual)}`}
          value={totalDS}
        />
        <MetricTile
          label="Cash Flow After Debt Service"
          value={cfAfterDS}
          isCFAD={true}
        />
      </div>

      {/* Row 5 — Equity buildup table */}
      <div className="card" style={{marginBottom:16}}>
        <div style={{padding:'14px 16px 10px',borderBottom:'1px solid #1e2d45'}}>
          <div style={{fontSize:11,fontWeight:600,color:'#2eb860',textTransform:'uppercase',letterSpacing:'0.08em'}}>5-Year Equity Buildup (SBA Loan Amortization)</div>
        </div>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
            <thead>
              <tr style={{background:'#0a1628'}}>
                {['Year','Loan Bal Start','Interest Paid','Principal Paid','Loan Bal End','Total Equity Built'].map(h=>(
                  <th key={h} style={{padding:'9px 14px',textAlign:'right',fontSize:11,fontWeight:600,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.06em',whiteSpace:'nowrap',borderBottom:'1px solid #1e2d45'}}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {equityRows.map((row,i)=>(
                <tr key={row.y} style={{background: i%2===0?'#161b27':'#0d1117'}}>
                  <td style={{padding:'9px 14px',color:'#e2e8f0',fontWeight:600,textAlign:'right'}}>{row.y}</td>
                  <td style={{padding:'9px 14px',color:'#e2e8f0',fontFamily:'monospace',textAlign:'right'}}>{fmtD(row.balStart)}</td>
                  <td style={{padding:'9px 14px',color:'#94a3b8',fontFamily:'monospace',textAlign:'right'}}>{fmtD(row.intPaid)}</td>
                  <td style={{padding:'9px 14px',color:'#2eb860',fontFamily:'monospace',textAlign:'right'}}>{fmtD(row.principal)}</td>
                  <td style={{padding:'9px 14px',color:'#e2e8f0',fontFamily:'monospace',textAlign:'right'}}>{fmtD(row.balEnd)}</td>
                  <td style={{padding:'9px 14px',color:'#2eb860',fontFamily:'monospace',fontWeight:700,textAlign:'right'}}>{fmtD(row.equity)}</td>
                </tr>
              ))}
              <tr style={{background:'#0a1628',borderTop:'1px solid #1e2d45'}}>
                <td colSpan={6} style={{padding:'9px 14px',fontSize:11,color:'#64748b',fontStyle:'italic'}}>
                  Illustrative only. Actual SBA terms, multiples, and cash flow vary by deal. Equity buildup includes buyer down payment of {fmtD(downAmt)}.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

/* ── App ───────────────────────────────────────────── */
const TABS=[
  {id:'dashboard',label:'Dashboard',icon:'📊'},
  {id:'input',label:'Income Statement',icon:'📋'},
  {id:'balance',label:'Balance Sheet',icon:'⚖️'},
  {id:'ratios',label:'Ratio Analysis',icon:'📐'},
  {id:'industry',label:'Industry',icon:'🏭'},
  {id:'sde',label:'SDE Charts',icon:'📈'},
  {id:'sources',label:'Sources & Uses',icon:'💰'},
  {id:'dscr',label:'DSCR Analysis',icon:'🏦'},
  {id:'seller',label:'Seller Scenario',icon:'🔍'},
  {id:'roi',label:'Buyer ROI',icon:'💹'},
  {id:'proceeds',label:'Net Proceeds',icon:'💵'},
  {id:'nlb',label:'QSI™ NLB',icon:'⭐'},
  {id:'narrative',label:'Narrative Report',icon:'✍️'},
  {id:'report',label:'Deal Report',icon:'📄'},
];

function App() {
  const [tab,setTab]=useState('dashboard');
  const [state,setState]=useState(initState());
  const [showLoad,setShowLoad]=useState(false);
  const [saveStatus,setSaveStatus]=useState('idle');
  const saveTimer=useRef(null);
  const [primeRate,setPrimeRate]=useState(null);
  const [user,setUser]=useState(null);
  const [authLoading,setAuthLoading]=useState(true);
  const [authDenied,setAuthDenied]=useState(false);
  const [extracting,setExtracting]=useState(false);
  const [reviewData,setReviewData]=useState(null);
  const [narrative,setNarrative]=useState('');
  const [narrativeStatus,setNarrativeStatus]=useState('idle');
  useEffect(()=>{
    return firebase.auth().onAuthStateChanged(u=>{
      if(u&&isAllowed(u.email)){
        setUser(u);setAuthDenied(false);
      } else {
        setUser(null);
        if(u){setAuthDenied(true);firebase.auth().signOut();}
      }
      setAuthLoading(false);
    });
  },[]);
  // Autosave — debounced 2.5s after any state change
  useEffect(()=>{
    if(!state.dealName?.trim()||!state.advisorName?.trim()) return;
    if(saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current=setTimeout(async()=>{
      setSaveStatus('saving');
      const nm=state.dealName.trim();
      const slug=nm.replace(/[^a-z0-9]/gi,'-').toLowerCase();
      localStorage.setItem(`deal_${nm}`,JSON.stringify(state));
      try{
        await firebase.firestore().collection('deals').doc(slug).set({
          ...state,
          _savedAt:firebase.firestore.FieldValue.serverTimestamp(),
          _savedBy:user?.email||'',
          _savedByName:user?.displayName||state.advisorName||''
        });
        setSaveStatus('saved');
        setTimeout(()=>setSaveStatus('idle'),3000);
      }catch(e){
        setSaveStatus('error');
      }
    },2500);
    return()=>{if(saveTimer.current)clearTimeout(saveTimer.current);};
  },[state]);
  useEffect(()=>{
    fetch('https://fred.stlouisfed.org/graph/fredgraph.csv?id=PRIME')
      .then(r=>r.text())
      .then(csv=>{
        const lines=csv.trim().split('\n').filter(l=>!l.startsWith('DATE')&&l.trim());
        const last=lines[lines.length-1];
        const prime=parseFloat(last.split(',')[1]);
        if(prime>0&&prime<30){
          setPrimeRate(prime);
          setState(prev=>({...prev,loanRate:+(prime+2.75).toFixed(2)}));
        }
      })
      .catch(()=>{});
  },[]);
  const save=async()=>{
    if(!state.dealName?.trim()){alert('Please enter a Deal Name before saving.');return;}
    if(!state.advisorName?.trim()){alert('Please enter an Advisor Name before saving.');return;}
    setSaveStatus('saving');
    const nm=state.dealName.trim();
    const slug=nm.replace(/[^a-z0-9]/gi,'-').toLowerCase();
    localStorage.setItem(`deal_${nm}`,JSON.stringify(state));
    try{
      await firebase.firestore().collection('deals').doc(slug).set({
        ...state,
        _savedAt:firebase.firestore.FieldValue.serverTimestamp(),
        _savedBy:user?.email||'',
        _savedByName:user?.displayName||state.advisorName||''
      });
      setSaveStatus('saved');
      setTimeout(()=>setSaveStatus('idle'),3000);
    }catch(e){
      setSaveStatus('error');
      alert(`Cloud sync failed: ${e.message}`);
    }
  };
  const migrateBs=d=>{if(d.bs&&!Array.isArray(d.bs)){const o=d.bs;d={...d,bs:[{cash:o.cash||'',ar:o.ar||'',inv:o.inv||'',ca:o.ca||'',ta:o.ta||'',ap:o.ap||'',cl:o.cl||'',tl:o.tl||'',nw:o.nw||'',capex:o.capex||''},{cash:'',ar:'',inv:'',ca:'',ta:'',ap:'',cl:'',tl:'',nw:'',capex:''},{cash:'',ar:'',inv:'',ca:'',ta:'',ap:'',cl:'',tl:'',nw:'',capex:''}]};}return d;};
  const load=data=>{data=migrateBs(data);setState({...initState(),...data,_net:0});setShowLoad(false);setTab('dashboard');};
  const newDeal=()=>{if(window.confirm('Start a new deal? Unsaved data will be lost.'))setState(initState());};
  const exportDeal=()=>{
    const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download=`${(state.dealName||'deal').replace(/[^a-z0-9]/gi,'-')}-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const importDeal=()=>{
    const input=document.createElement('input');
    input.type='file'; input.accept='.json';
    input.onchange=e=>{
      const file=e.target.files[0]; if(!file) return;
      const reader=new FileReader();
      reader.onload=ev=>{
        try{let data=JSON.parse(ev.target.result);data=migrateBs(data);setState({...initState(),...data,_net:0});setTab('dashboard');}
        catch{alert('Invalid deal file — could not import.');}
      };
      reader.readAsText(file);
    };
    input.click();
  };
  const extractFromPDF=async(file,prompt)=>{
    // Send file as multipart — server extracts text with pdf-parse, sends text to Claude
    // Avoids base64 encoding which bloats token count past Claude's 200K context limit
    const auth=sessionStorage.getItem('pacq_auth');
    const form=new FormData();
    form.append('file',file);
    form.append('prompt',prompt);
    const headers={};
    if(auth) headers['Authorization']=`Basic ${auth}`;
    const resp=await fetch('/api/extract/pdf',{method:'POST',headers,body:form});
    if(!resp.ok){const e=await resp.json().catch(()=>({}));throw new Error(e.error||`Server error ${resp.status}`);}
    const json=await resp.json();
    return JSON.parse(json.result);
  };
  const importTaxReturn=yi=>{
    const input=document.createElement('input');
    input.type='file';input.accept='.pdf';
    input.onchange=async e=>{
      const file=e.target.files[0];if(!file)return;
      setExtracting(true);
      try{const data=await extractFromPDF(file,COMBINED_PROMPT);setReviewData({type:'combined',yearIndex:yi,income:data.income,balance:data.balance});}
      catch(err){alert('Extraction failed: '+err.message);}
      finally{setExtracting(false);}
    };
    input.click();
  };
  const importIndustryReport=()=>{
    const input=document.createElement('input');
    input.type='file';input.accept='.pdf';
    input.onchange=async e=>{
      const file=e.target.files[0];if(!file)return;
      setExtracting(true);
      try{const data=await extractFromPDF(file,INDUSTRY_PROMPT);setReviewData({type:'industry',data});}
      catch(err){alert('Extraction failed: '+err.message);}
      finally{setExtracting(false);}
    };
    input.click();
  };
  const importBalanceSheet=yi=>{
    const input=document.createElement('input');
    input.type='file';input.accept='.pdf';
    input.onchange=async e=>{
      const file=e.target.files[0];if(!file)return;
      setExtracting(true);
      try{const data=await extractFromPDF(file,BS_PROMPT);setReviewData({type:'balance',yearIndex:yi,data});}
      catch(err){alert('Extraction failed: '+err.message);}
      finally{setExtracting(false);}
    };
    input.click();
  };
  const applyReview=confirmed=>{
    const applyIncome=(prev,inc,yi)=>{
      const years=[...prev.years];
      const y=years[yi];
      const newRent=inc.rent!=null?inc.rent:y.rent;
      const rentVal=pn(newRent);
      // Auto-set rentAdj to negative rent if rent was extracted (nets to $0 by default)
      const newRentAdj=inc.rent!=null&&rentVal>0?-rentVal:y.rentAdj;
      // Auto-add/update owner payroll tax addback if ownerComp was extracted
      let newABs=[...(y.addBacks||[])];
      const newOC=inc.ownerComp??y.ownerComp;
      const ocVal=pn(newOC);
      if(inc.ownerComp!=null&&ocVal>0){
        const taxAmt=Math.round(ocVal*0.0765*100)/100;
        const idx=newABs.findIndex(a=>/payroll.?tax/i.test(a.label));
        if(idx>=0){newABs[idx]={...newABs[idx],amount:taxAmt};}
        else{const sid=Date.now();newABs.push({id:sid,sharedId:sid,label:'Owner payroll tax (7.65%)',amount:taxAmt});}
      }
      years[yi]={...y,
        entityType:inc.entityType||y.entityType,
        year:inc.year||y.year,
        revenue:inc.revenue??y.revenue,
        cogs:inc.cogs??y.cogs,
        otherIncome:inc.otherIncome??y.otherIncome,
        opx:inc.opx??y.opx,
        interest:inc.interest??y.interest,
        depreciation:inc.depreciation??y.depreciation,
        amortization:inc.amortization??y.amortization,
        ownerComp:newOC,
        taxes:inc.taxes??y.taxes,
        rent:newRent,
        rentAdj:newRentAdj,
        addBacks:newABs,
      };
      return years;
    };
    if(reviewData.type==='combined'){
      setState(prev=>{
        const years=applyIncome(prev,confirmed.income,reviewData.yearIndex);
        const newBS=[...prev.bs];
        newBS[reviewData.yearIndex]={...newBS[reviewData.yearIndex],...Object.fromEntries(Object.entries(confirmed.balance).filter(([,v])=>v!==null&&v!==''))};
        return {...prev,years,bs:newBS};
      });
    } else if(reviewData.type==='income'){
      setState(prev=>({...prev,years:applyIncome(prev,confirmed,reviewData.yearIndex)}));
    } else if(reviewData.type==='industry'){
      setState(prev=>({...prev,ind:{...prev.ind,...Object.fromEntries(Object.entries(confirmed).filter(([,v])=>v!==null&&v!==''))}}));
    } else {
      setState(prev=>{const newBS=[...prev.bs];newBS[reviewData.yearIndex]={...newBS[reviewData.yearIndex],...Object.fromEntries(Object.entries(confirmed).filter(([,v])=>v!==null&&v!==''))};return {...prev,bs:newBS};});
    }
    setReviewData(null);
  };
  if(authLoading) return (
    <div style={{display:'flex',height:'100vh',alignItems:'center',justifyContent:'center',background:'#0f1117'}}>
      <div style={{color:'#2eb860',fontSize:13}}>Loading…</div>
    </div>
  );
  if(!user) return <SignInScreen denied={authDenied}/>;
  return (
    <div className="az-shell" style={{display:'flex',height:'100vh',background:'#0f1117',overflow:'hidden'}}>
      {/* Sidebar */}
      <div className="no-print" style={{width:220,flexShrink:0,display:'flex',flexDirection:'column',background:'#0d1117',borderRight:'1px solid #1e293b',overflowY:'auto'}}>
        <div style={{padding:'16px 16px 12px',borderBottom:'1px solid #1e293b'}}>
          <div style={{fontSize:13,fontWeight:700,color:'#2eb860',letterSpacing:'.03em'}}>QSI™ Market Price Analyzer</div>
          <div style={{fontSize:11,color:'#475569'}}>SBA Acquisition Tool</div>
        </div>
        <div style={{padding:'12px',borderBottom:'1px solid #1e293b'}}>
          <div className="mb-2">
            <span className="lbl">Deal Name</span>
            <input className="input-field" value={state.dealName} onChange={e=>setState({...state,dealName:e.target.value})} placeholder="Enter deal name..."/>
          </div>
          <div>
            <span className="lbl">Advisor</span>
            <input className="input-field" value={state.advisorName} onChange={e=>setState({...state,advisorName:e.target.value})} placeholder="Advisor name..."/>
          </div>
        </div>
        <div style={{padding:'8px 12px',borderBottom:'1px solid #1e293b'}}>
          {[['+ New Deal',newDeal,'#1e293b','#94a3b8'],['Save Deal',save,'#1a5e35','#6de09a'],['Load Deal',()=>setShowLoad(true),'#1e293b','#94a3b8']].map(([l,fn,bg,c])=>(
            <button key={l} onClick={fn} style={{display:'block',width:'100%',marginBottom:4,fontSize:12,background:bg,color:c,border:'none',borderRadius:5,padding:'7px 8px',cursor:'pointer',textAlign:'center'}}
              onMouseEnter={e=>{e.target.style.filter='brightness(1.2)';}} onMouseLeave={e=>{e.target.style.filter='';}}>{l}</button>
          ))}
          {saveStatus!=='idle'&&(
            <div style={{fontSize:10,textAlign:'center',padding:'3px 0',marginTop:2,borderRadius:4,
              background:saveStatus==='saving'?'#1e293b':saveStatus==='saved'?'#0a2416':'#3b0a0a',
              color:saveStatus==='saving'?'#64748b':saveStatus==='saved'?'#2eb860':'#f87171'}}>
              {saveStatus==='saving'?'Saving...':saveStatus==='saved'?'✓ Saved':'⚠ Save failed'}
            </div>
          )}
          <div style={{borderTop:'1px solid #1e293b',marginTop:4,paddingTop:6}}>
            {[['↓ Export Deal',exportDeal,'#14281a','#6ee7b7'],['↑ Import Deal',importDeal,'#14281a','#6ee7b7']].map(([l,fn,bg,c])=>(
              <button key={l} onClick={fn} style={{display:'block',width:'100%',marginBottom:4,fontSize:12,background:bg,color:c,border:'1px solid #166534',borderRadius:5,padding:'7px 8px',cursor:'pointer',textAlign:'center'}}
                onMouseEnter={e=>{e.target.style.filter='brightness(1.2)';}} onMouseLeave={e=>{e.target.style.filter='';}}>{l}</button>
            ))}
          </div>
        </div>
        <nav style={{flex:1,padding:'6px 0'}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)}
              className={`sidebar-btn w-full text-left`}
              style={{display:'flex',alignItems:'center',gap:8,padding:'10px 14px',fontSize:13,background:tab===t.id?'#0a2416':'transparent',borderLeft:tab===t.id?'3px solid #2eb860':'3px solid transparent',color:tab===t.id?'#6de09a':'#94a3b8',cursor:'pointer',border:'none',outline:'none',width:'100%',borderRadius:0}}>
              <span>{t.icon}</span><span>{t.label}</span>
            </button>
          ))}
        </nav>
        <div style={{padding:'8px 12px',borderTop:'1px solid #1e293b'}}>
          <button onClick={()=>firebase.auth().signOut()}
            style={{display:'block',width:'100%',marginBottom:4,fontSize:10,background:'#1e293b',color:'#94a3b8',border:'none',borderRadius:5,padding:'6px 8px',cursor:'pointer',textAlign:'center'}}
            onMouseEnter={e=>{e.target.style.filter='brightness(1.2)';}} onMouseLeave={e=>{e.target.style.filter='';}}>
            Sign Out ({user?.email})
          </button>
        </div>
        <div style={{padding:'6px 14px',fontSize:10,color:'#334155'}}>v1.0 — QSI™ Market Price Analyzer</div>
      </div>
      {/* Content */}
      <div className="az-main" style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
      <div className="az-scroll" style={{flex:1,overflowY:'auto',padding:28}}>
        {tab==='input'&&<T1 state={state} set={setState} primeRate={primeRate} importTaxReturn={importTaxReturn}/>}
        {tab==='dashboard'&&<T2 state={state}/>}
        {tab==='sde'&&<T3 state={state}/>}
        {tab==='ratios'&&<TRatios state={state}/>}
        {tab==='sources'&&<T4 state={state} set={setState}/>}
        {tab==='dscr'&&<T5 state={state} set={setState} primeRate={primeRate}/>}
        {tab==='seller'&&<TSeller state={state} set={setState}/>}
        {tab==='roi'&&<TBuyerROI state={state} set={setState}/>}
        {tab==='balance'&&<T6 state={state} set={setState} importBalanceSheet={importBalanceSheet}/>}
        {tab==='industry'&&<TIndustry state={state} set={setState} importIndustryReport={importIndustryReport}/>}
        {tab==='proceeds'&&<T7 state={state} set={setState}/>}
        {tab==='nlb'&&<T8 state={state} set={setState}/>}
        {tab==='narrative'&&<TNarrative state={state} narrative={narrative} setNarrative={setNarrative} narrativeStatus={narrativeStatus} setNarrativeStatus={setNarrativeStatus}/>}
        {tab==='report'&&<T9 state={state} narrative={narrative} narrativeStatus={narrativeStatus}/>}
      </div>
      </div>
      {showLoad&&<LoadModal onClose={()=>setShowLoad(false)} onLoad={load} user={user}/>}
      {extracting&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.75)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:2000}}>
          <div style={{background:'#161b27',border:'1px solid #1e2d45',borderRadius:10,padding:32,textAlign:'center'}}>
            <div style={{color:'#2eb860',fontSize:14,marginBottom:8}}>Extracting data from PDF…</div>
            <div style={{color:'#475569',fontSize:11}}>Claude is reading your tax return. This takes 10–20 seconds.</div>
          </div>
        </div>
      )}
      {reviewData&&<ReviewModal reviewData={reviewData} onApply={applyReview} onCancel={()=>setReviewData(null)}/>}
    </div>
  );
}

export default function AnalyzerApp() {
  return (
    <div id="analyzer-root" style={{minHeight:'100%',display:'flex',flexDirection:'column'}}>
      <App />
    </div>
  );
}
