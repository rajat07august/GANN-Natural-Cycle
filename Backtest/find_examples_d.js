#!/usr/bin/env node
// find_examples_d.js — Setup D trade examples with Plotly charts
// Finds 5 SL exits, 5 BE exits, 5 best trailing exits
// and builds a single HTML with 15 annotated candlestick charts

const fs   = require('fs');
const path = require('path');

const ADJ_DIR      = 'j:/Swing Trading/Swing Trading/processed_adj';
const RAW_DIR      = 'j:/Swing Trading/Swing Trading/processed';
const INTRADAY_DIR = 'j:/Swing Trading/Swing Trading/processed_intraday';
const SRC1         = 'j:/GANN Claude/Dataset/NIFTY50_all.csv';
const OUT          = 'j:/GANN Claude/Backtest/examples_setup_d.html';

const DEV = 4, DEP = 10;
const GAPS           = [20,15,13,12,10,6,5,4,3,2,1];
const ANALYSIS_YEARS = [2020,2021,2022,2023,2024,2025,2026];
const MONTH_NAMES    = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const today          = new Date().toISOString().slice(0,10);

const NIFTY50_SYMS = [
  'ADANIENT','ADANIPORTS','APOLLOHOSP','ASIANPAINT','AXISBANK',
  'BAJAJ-AUTO','BAJAJFINSV','BAJFINANCE','BHARTIARTL','BPCL',
  'BRITANNIA','CIPLA','COALINDIA','DRREDDY','EICHERMOT',
  'GRASIM','HCLTECH','HDFCBANK','HDFCLIFE','HEROMOTOCO',
  'HINDALCO','HINDUNILVR','ICICIBANK','INDUSINDBK','INFY',
  'ITC','JSWSTEEL','KOTAKBANK','LT','M&M',
  'MARUTI','NESTLEIND','NTPC','ONGC','POWERGRID',
  'RELIANCE','SBIN','SHRIRAMFIN','SUNPHARMA','TATACONSUM',
  'TATAMOTORS','TATASTEEL','TCS','TECHM','TITAN',
  'TRENT','ULTRACEMCO','WIPRO','ZOMATO',
];
const MIDCAP_SYMS = [
  'ADANIPOWER','POONAWALLA','SUZLON','FEDERALBNK','PERSISTENT',
  'COFORGE','CANBK','SAIL','NMDC','RVNL','IRFC','MCX',
  'NATIONALUM','INDHOTEL','LTTS','MFSL','HUDCO','SRF',
  'POLYCAB','NHPC','SJVN','GMRINFRA','CONCOR','COCHINSHIP','MAZDOCK',
];
const ALL_SYMS = [...NIFTY50_SYMS, ...MIDCAP_SYMS];
const HIST_NAMES = {
  BHARTIARTL:['BHARTI','BHARTIARTL'], HINDUNILVR:['HINDLEVER','HINDUNILVR'],
  INFY:['INFOSYSTCH','INFY'], JSWSTEEL:['JSWSTL','JSWSTEEL'],
  HINDALCO:['HINDALC0','HINDALCO'], TATASTEEL:['TISCO','TATASTEEL'],
  TATAMOTORS:['TELCO','TATAMOTORS'], AXISBANK:['UTIBANK','AXISBANK'],
  KOTAKBANK:['KOTAKMAH','KOTAKBANK'], HEROMOTOCO:['HEROHONDA','HEROMOTOCO'],
  BAJFINANCE:['BAJAUTOFIN','BAJFINANCE'],
};

// ── Data loading (identical to backtest_short_all.js) ─────────────────────────
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const h = lines[0].split(',').map(x => x.trim().replace(/^"|"$/g,''));
  return lines.slice(1).map(line => {
    const c = line.split(','), o = {};
    h.forEach((k,i)=>{ o[k]=(c[i]||'').trim().replace(/^"|"$/g,''); });
    return o;
  });
}
function cleanOHLC(rows) {
  const out = [];
  for (let i=0;i<rows.length;i++){
    const r=rows[i];
    const date=(r.date||r.Date||'').trim();
    const open=parseFloat(r.open||r.Open||0),high=parseFloat(r.high||r.High||0);
    const low=parseFloat(r.low||r.Low||0),close=parseFloat(r.close||r.Close||0);
    if(!date||high<=0||low<=0) continue;
    if(i>0&&i<rows.length-1){
      const pc=out.length?out[out.length-1].close:0;
      const nc=parseFloat((rows[i+1]||{}).close||(rows[i+1]||{}).Close||0);
      if(pc>0&&nc>0){
        const rb=close/pc,ra=nc/close;
        if((rb>1.35&&ra<1/1.35)||(rb<1/1.35&&ra>1.35)){
          const sf=pc/close;
          out.push({date,open:+(open*sf).toFixed(2),high:+(high*sf).toFixed(2),
                    low:+(low*sf).toFixed(2),close:+(close*sf).toFixed(2)});
          continue;
        }
      }
    }
    out.push({date,open,high,low,close});
  }
  return out;
}
let _src1=null;
function getSrc1(){if(!_src1)_src1=parseCSV(fs.readFileSync(SRC1,'utf8'));return _src1;}
function loadAdjOHLC(sym){
  const p=path.join(ADJ_DIR,`${sym}.csv`);
  if(fs.existsSync(p)){
    return cleanOHLC(parseCSV(fs.readFileSync(p,'utf8'))
      .filter(r=>parseInt(r.Volume||r.volume||0)>0)
      .map(r=>({date:(r.Date||r.date||'').trim(),open:parseFloat(r.Open||r.open||0),
                high:parseFloat(r.High||r.high||0),low:parseFloat(r.Low||r.low||0),
                close:parseFloat(r.Close||r.close||0)}))
      .filter(r=>r.date&&r.high>0).sort((a,b)=>a.date.localeCompare(b.date)));
  }
  const symSet=new Set(HIST_NAMES[sym]||[sym]);
  const rows=getSrc1().filter(r=>symSet.has(r.Symbol))
    .map(r=>({date:r.Date.trim(),open:parseFloat(r.Open||0),high:parseFloat(r.High||0),
              low:parseFloat(r.Low||0),close:parseFloat(r.Close||0)}))
    .filter(r=>r.date&&r.high>0);
  const rawPath=path.join(RAW_DIR,`${sym}.csv`);
  if(fs.existsSync(rawPath)){
    const ex=new Set(rows.map(r=>r.date));
    parseCSV(fs.readFileSync(rawPath,'utf8'))
      .map(r=>({date:(r.Date||r.date||'').trim(),open:parseFloat(r.Open||r.open||0),
                high:parseFloat(r.High||r.high||0),low:parseFloat(r.Low||r.low||0),
                close:parseFloat(r.Close||r.close||0)}))
      .filter(r=>r.date&&r.high>0&&!ex.has(r.date)).forEach(r=>rows.push(r));
  }
  return cleanOHLC(rows.filter(r=>r.date>='2000-01-01').sort((a,b)=>a.date.localeCompare(b.date)));
}
function loadRawOHLC(sym){
  const p=path.join(RAW_DIR,`${sym}.csv`);
  if(!fs.existsSync(p)) return [];
  return parseCSV(fs.readFileSync(p,'utf8'))
    .map(r=>({date:(r.Date||r.date||'').trim(),open:parseFloat(r.Open||r.open||0),
              high:parseFloat(r.High||r.high||0),low:parseFloat(r.Low||r.low||0),
              close:parseFloat(r.Close||r.close||0)}))
    .filter(r=>r.date&&r.high>0).sort((a,b)=>a.date.localeCompare(b.date));
}
const _idCache={};
function loadIntradayByDate(sym){
  if(_idCache[sym]) return _idCache[sym];
  const p=path.join(INTRADAY_DIR,`${sym}_60min.csv`);
  const byDate={};
  if(!fs.existsSync(p)){_idCache[sym]=byDate;return byDate;}
  const lines=fs.readFileSync(p,'utf8').trim().split('\n');
  for(let i=1;i<lines.length;i++){
    const c=lines[i].split(',');
    const date=c[1]?.trim(),time=c[2]?.trim();
    if(!date||!time) continue;
    if(!byDate[date]) byDate[date]=[];
    byDate[date].push({time,open:parseFloat(c[3]),high:parseFloat(c[4]),
                       low:parseFloat(c[5]),close:parseFloat(c[6])});
  }
  for(const d of Object.keys(byDate)) byDate[d].sort((a,b)=>a.time.localeCompare(b.time));
  _idCache[sym]=byDate; return byDate;
}
const _adjCache={},_rawCache={};
function getAdj(sym){if(!_adjCache[sym])_adjCache[sym]=loadAdjOHLC(sym);return _adjCache[sym];}
function getRaw(sym){if(!_rawCache[sym])_rawCache[sym]=loadRawOHLC(sym);return _rawCache[sym];}

// ── ZigZag + Confluence ───────────────────────────────────────────────────────
function computeZigZag(rows){
  const pv=[];if(!rows.length)return pv;
  let tr=null,lhP=rows[0].high,lhD=rows[0].date,lhI=0,llP=rows[0].low,llD=rows[0].date,llI=0;
  for(let i=1;i<rows.length;i++){
    const{date,high,low}=rows[i];
    if(tr===null||tr==='UP'){
      if(high>=lhP){lhP=high;lhD=date;lhI=i;}
      if(lhP-low>=lhP*(DEV/100)&&i-lhI>=DEP){pv.push({date:lhD,type:'H',price:lhP});tr='DOWN';llP=low;llD=date;llI=i;}
    }
    if(tr==='DOWN'){
      if(low<=llP){llP=low;llD=date;llI=i;}
      if(high-llP>=llP*(DEV/100)&&i-llI>=DEP){pv.push({date:llD,type:'L',price:llP});tr='UP';lhP=high;lhD=date;lhI=i;}
    }
  }
  if(tr==='UP'&&lhI>0) pv.push({date:lhD,type:'H',price:lhP});
  if(tr==='DOWN'&&llI>0) pv.push({date:llD,type:'L',price:llP});
  return pv;
}
function buildMatrix(pivots){
  const m={};
  pivots.forEach(p=>{
    const d=new Date(p.date),yr=d.getFullYear(),mi=d.getMonth(),day=String(d.getDate()).padStart(2,'0');
    if(!m[yr])m[yr]={};if(!m[yr][mi])m[yr][mi]=[];
    m[yr][mi].push({day,type:p.type});
  });
  return m;
}
function getConfluence(matrix,yr,mi){
  const freq={};
  GAPS.map(g=>yr-g).forEach(y=>{
    const yd=matrix[y];if(!yd||!yd[mi])return;
    yd[mi].forEach(({day,type})=>{if(!freq[day])freq[day]=[];freq[day].push({year:y,type});});
  });
  const res={};
  for(const[day,arr] of Object.entries(freq)) if(arr.length>=2) res[day]=arr;
  return res;
}

// ── Setup D simulation (returns full trade detail including ratchet events) ───
function simShortDFull(rawArr, rawIdx, rawMap, intraday, refDate) {
  const ref=rawMap[refDate]; if(!ref||ref.high<=ref.low) return null;
  const confHigh=ref.high, confLow=ref.low;
  const ri=rawIdx[refDate]; if(ri===undefined||ri>=rawArr.length-1) return null;
  const entryDay=rawArr[ri+1].date, cans=intraday[entryDay]||[];

  let ep=null, slInit=null, entryTime=null, trigIdx=-1;
  for(let ci=0;ci<cans.length;ci++){
    const c=cans[ci];
    if(c.close>confHigh){
      const risk=c.high-c.close; if(risk<=0) continue;
      ep=c.close; slInit=c.high; entryTime=c.time; trigIdx=ci; break;
    }
  }
  if(!ep) return null;
  const risk=slInit-ep;

  // Simulate r2 (trailing) and track ratchet events
  let sl=slInit, lvl=0, outcome='open';
  let exitDate='', exitTime='', exitPrice=0, barsHeld=0, done=false;
  const ratchetEvents=[];  // {date, time, lvl, newSL, triggerPrice}
  const slLbl=()=>lvl===0?'SL':lvl===1?'BE':'TRAIL';

  const advance=(low,date,time)=>{
    if(lvl<1&&low<=ep-risk){
      lvl=1;sl=ep;
      ratchetEvents.push({date,time,lvl:1,newSL:ep,label:'BE ratchet'});
    }
    if(lvl<2&&low<=ep-2*risk){
      lvl=2;sl=ep-1.5*risk;
      ratchetEvents.push({date,time,lvl:2,newSL:+(ep-1.5*risk).toFixed(2),label:'1.5R lock'});
    }
    if(lvl<3&&low<=ep-3*risk){
      lvl=3;sl=ep-2.5*risk;
      ratchetEvents.push({date,time,lvl:3,newSL:+(ep-2.5*risk).toFixed(2),label:'2.5R lock'});
    }
    if(lvl<4&&low<=ep-5*risk){
      lvl=4;sl=ep-4*risk;
      ratchetEvents.push({date,time,lvl:4,newSL:+(ep-4*risk).toFixed(2),label:'4R lock'});
    }
  };
  const tick=(c,date)=>{
    if(done) return;
    advance(c.low,date,c.time);
    if(c.high>=sl){outcome=slLbl();exitPrice=sl;exitDate=date;exitTime=c.time;done=true;}
  };

  // Entry day
  for(let ci=trigIdx;ci<cans.length&&!done;ci++) tick(cans[ci],entryDay);
  if(!done) barsHeld=1;
  for(let di=ri+2;di<rawArr.length&&!done;di++){
    const dr=rawArr[di];
    const dc=intraday[dr.date]||[];
    barsHeld++;
    if(dc.length){ for(const c of dc){if(!done)tick(c,dr.date);} }
    else{
      advance(dr.low,dr.date,'EOD');
      if(dr.high>=sl){outcome=slLbl();exitPrice=sl;exitDate=dr.date;exitTime='EOD';done=true;}
    }
    if(!done&&barsHeld>250){outcome='open';exitDate=dr.date;exitPrice=dr.close;done=true;}
  }
  if(!done){const last=rawArr[rawArr.length-1];exitDate=last.date;exitPrice=last.close||ep;outcome='open';}

  const rMult=+((ep-exitPrice)/risk).toFixed(2);
  return{sym:'',confDate:refDate,cfLow:+confLow.toFixed(2),cfHigh:+confHigh.toFixed(2),
    ep:+ep.toFixed(2),slInit:+slInit.toFixed(2),risk:+risk.toFixed(2),
    entryDay,entryTime,trigIdx,
    outcome,exitDate,exitTime,exitPrice:+exitPrice.toFixed(2),rMult,
    ratchetEvents,lvlAtExit:lvl};
}

// ── Gather candles for a trade ────────────────────────────────────────────────
function getTradeCandles(sym, entryDay, exitDate, extraDays=2) {
  const raw=getRaw(sym), id=loadIntradayByDate(sym);
  const dates=raw.map(r=>r.date);
  const ei=dates.indexOf(entryDay);
  const xi=dates.indexOf(exitDate);
  const start=Math.max(0,ei);
  const end=Math.min(raw.length-1, xi>=0?xi+extraDays:ei+extraDays+5);
  const candles=[];
  for(let i=start;i<=end;i++){
    const d=raw[i].date;
    const dc=id[d];
    if(dc&&dc.length){
      dc.forEach(c=>candles.push({...c,date:d,dt:`${d} ${c.time}`}));
    }
  }
  return candles;
}

// ── Run Setup D on all symbols ────────────────────────────────────────────────
console.log('Running Setup D on all symbols …');
process.stdout.write('Preloading … ');
for(const sym of ALL_SYMS){try{getAdj(sym);getRaw(sym);loadIntradayByDate(sym);}catch{}}
console.log('done\n');

const allTrades=[];
for(const sym of ALL_SYMS){
  try{
    const adj=getAdj(sym),raw=getRaw(sym);
    if(!adj.length||!raw.length) continue;
    const rawMap={},rawIdx={};
    raw.forEach((r,i)=>{rawMap[r.date]=r;rawIdx[r.date]=i;});
    const intraday=loadIntradayByDate(sym);
    const matrix=buildMatrix(computeZigZag(adj));
    for(const yr of ANALYSIS_YEARS){
      for(let mi=0;mi<12;mi++){
        const conf=getConfluence(matrix,yr,mi);
        for(const[day,arr] of Object.entries(conf)){
          if(parseInt(day)>new Date(yr,mi+1,0).getDate()) continue;
          const refDate=`${yr}-${String(mi+1).padStart(2,'0')}-${day}`;
          if(refDate>=today) continue;
          const t=simShortDFull(raw,rawIdx,rawMap,intraday,refDate);
          if(t&&t.outcome!=='open'){
            t.sym=sym;
            t.cfCount=arr.length;
            allTrades.push(t);
          }
        }
      }
    }
  }catch{}
}
console.log(`Total Setup D trades: ${allTrades.length}`);

// ── Select examples ───────────────────────────────────────────────────────────
// Quality filter: must have intraday candles available for entry day
function hasIntraday(t){
  const id=loadIntradayByDate(t.sym);
  const dc=id[t.entryDay]||[];
  return dc.length>=3;
}
// Also require intraday data for exit day (for BE/SL on entry day itself, still show)
function hasExitIntraday(t){
  const id=loadIntradayByDate(t.sym);
  return (id[t.exitDate]||[]).length>=1;
}

function pickUnique(arr, n) {
  const used=new Set(), result=[];
  for(const t of arr){
    if(result.length>=n) break;
    if(!used.has(t.sym)){used.add(t.sym);result.push(t);}
  }
  return result;
}

// SL exits: full -1R loss, SL hit quickly (few bars held)
const slPool = allTrades.filter(t=>t.outcome==='SL'&&hasIntraday(t))
  .sort((a,b)=>a.entryDay.localeCompare(b.entryDay));
const slExamples = pickUnique(slPool, 5);

// BE exits: ratcheted to BE then SL hit at EP (rMult near 0)
const bePool = allTrades.filter(t=>t.outcome==='BE'&&hasIntraday(t)&&Math.abs(t.rMult)<0.05)
  .sort((a,b)=>a.entryDay.localeCompare(b.entryDay));
const beExamples = pickUnique(bePool, 5);

// Best trailing: TRAIL outcome, highest rMult (extended ratchets allow 4R+)
const trailPool = allTrades.filter(t=>t.outcome==='TRAIL'&&hasIntraday(t)&&t.rMult>=1.0)
  .sort((a,b)=>b.rMult-a.rMult);
const trailExamples = pickUnique(trailPool, 5);

console.log(`SL examples: ${slExamples.map(t=>`${t.sym}@${t.entryDay}`).join(', ')}`);
console.log(`BE examples: ${beExamples.map(t=>`${t.sym}@${t.entryDay}`).join(', ')}`);
console.log(`Trail examples: ${trailExamples.map(t=>`${t.sym}@${t.entryDay}(${t.rMult}R)`).join(', ')}`);

// ── Build chart data ──────────────────────────────────────────────────────────
function buildChartSpec(t) {
  const candles = getTradeCandles(t.sym, t.entryDay, t.exitDate, 3);
  if(!candles.length) return null;
  const ep=t.ep, risk=t.risk, sl=t.slInit, cfH=t.cfHigh;
  return {
    sym: t.sym, confDate: t.confDate, cfCount: t.cfCount,
    ep, slInit: sl, risk, cfHigh: cfH, cfLow: t.cfLow,
    entryDay: t.entryDay, entryTime: t.entryTime,
    outcome: t.outcome, exitDate: t.exitDate, exitTime: t.exitTime,
    exitPrice: t.exitPrice, rMult: t.rMult,
    ratchetEvents: t.ratchetEvents,
    levels: {
      slLine: +sl.toFixed(2),
      epLine: +ep.toFixed(2),
      cfH: +cfH.toFixed(2),
      r1:   +(ep - risk).toFixed(2),
      r1p5: +(ep - 1.5*risk).toFixed(2),
      r2p5: +(ep - 2.5*risk).toFixed(2),
      r4:   +(ep - 4*risk).toFixed(2),
    },
    candles: candles.map(c=>({dt:c.dt,o:c.open,h:c.high,l:c.low,c:c.close,
      isEntry: c.dt===`${t.entryDay} ${t.entryTime}`,
      isExit:  c.dt===`${t.exitDate} ${t.exitTime}`})),
  };
}

const slSpecs    = slExamples.map(buildChartSpec).filter(Boolean);
const beSpecs    = beExamples.map(buildChartSpec).filter(Boolean);
const trailSpecs = trailExamples.map(buildChartSpec).filter(Boolean);

// ── HTML ──────────────────────────────────────────────────────────────────────
function outcomeColor(o) {
  if(o==='SL') return '#f85149';
  if(o==='BE') return '#8b949e';
  return '#3fb950';
}
function outcomeLabel(o,r) {
  if(o==='SL') return `SL (−1R)`;
  if(o==='BE') return `BE (0R)`;
  return `TRAIL (+${r}R)`;
}

function chartHtml(spec, idx, total) {
  const oc = outcomeColor(spec.outcome);
  const ol = outcomeLabel(spec.outcome, spec.rMult);
  const {levels, candles, ratchetEvents} = spec;

  // Find entry/exit candle indices for annotation
  const entryIdx = candles.findIndex(c=>c.isEntry);
  const exitIdx  = candles.findIndex(c=>c.isExit);

  const shapes = [];
  const annotations = [];

  // confHigh — amber
  shapes.push({type:'line',x0:0,x1:candles.length-1,y0:levels.cfH,y1:levels.cfH,
    xref:'x',yref:'y',line:{color:'#ffa600',dash:'dash',width:1.5}});
  annotations.push({x:0,y:levels.cfH,text:'confHigh',showarrow:false,
    font:{color:'#ffa600',size:9},xanchor:'left',yanchor:'bottom',xref:'x',yref:'y'});

  // SL (slInit) — red
  shapes.push({type:'line',x0:0,x1:candles.length-1,y0:levels.slLine,y1:levels.slLine,
    xref:'x',yref:'y',line:{color:'#f85149',dash:'dash',width:1.5}});
  annotations.push({x:0,y:levels.slLine,text:'SL',showarrow:false,
    font:{color:'#f85149',size:9},xanchor:'left',yanchor:'bottom',xref:'x',yref:'y'});

  // ep — white
  shapes.push({type:'line',x0:0,x1:candles.length-1,y0:levels.epLine,y1:levels.epLine,
    xref:'x',yref:'y',line:{color:'rgba(230,237,243,.5)',dash:'dot',width:1}});
  annotations.push({x:0,y:levels.epLine,text:'ep',showarrow:false,
    font:{color:'rgba(230,237,243,.6)',size:9},xanchor:'left',yanchor:'top',xref:'x',yref:'y'});

  // r1 (BE trigger) — light blue
  shapes.push({type:'line',x0:0,x1:candles.length-1,y0:levels.r1,y1:levels.r1,
    xref:'x',yref:'y',line:{color:'#79c0ff',dash:'dot',width:1}});
  annotations.push({x:0,y:levels.r1,text:'ep−1R (BE)',showarrow:false,
    font:{color:'#79c0ff',size:9},xanchor:'left',yanchor:'bottom',xref:'x',yref:'y'});

  // r1.5 lock — green
  shapes.push({type:'line',x0:0,x1:candles.length-1,y0:levels.r1p5,y1:levels.r1p5,
    xref:'x',yref:'y',line:{color:'#56d364',dash:'dot',width:1}});
  annotations.push({x:0,y:levels.r1p5,text:'ep−1.5R lock',showarrow:false,
    font:{color:'#56d364',size:9},xanchor:'left',yanchor:'bottom',xref:'x',yref:'y'});

  // r2.5 lock — cyan
  shapes.push({type:'line',x0:0,x1:candles.length-1,y0:levels.r2p5,y1:levels.r2p5,
    xref:'x',yref:'y',line:{color:'#39d0d8',dash:'dot',width:1}});
  annotations.push({x:0,y:levels.r2p5,text:'ep−2.5R lock',showarrow:false,
    font:{color:'#39d0d8',size:9},xanchor:'left',yanchor:'bottom',xref:'x',yref:'y'});

  // r4 lock — gold
  shapes.push({type:'line',x0:0,x1:candles.length-1,y0:levels.r4,y1:levels.r4,
    xref:'x',yref:'y',line:{color:'#ffd700',dash:'dot',width:1}});
  annotations.push({x:0,y:levels.r4,text:'ep−4R lock',showarrow:false,
    font:{color:'#ffd700',size:9},xanchor:'left',yanchor:'bottom',xref:'x',yref:'y'});

  // Entry marker
  if(entryIdx>=0){
    annotations.push({
      x:entryIdx,y:spec.ep,text:'▼ SHORT',showarrow:true,
      arrowcolor:'#ff005a',arrowsize:1,arrowwidth:2,ax:0,ay:-35,
      font:{color:'#ff005a',size:11,family:'monospace'},
      bgcolor:'rgba(31,10,10,.9)',bordercolor:'#ff005a',borderwidth:1,borderpad:4,
      xref:'x',yref:'y'
    });
  }

  // Ratchet events
  ratchetEvents.forEach(ev=>{
    const ri=candles.findIndex(c=>c.dt===`${ev.date} ${ev.time}`);
    if(ri<0) return;
    annotations.push({x:ri,y:ev.newSL,text:ev.label,showarrow:false,
      font:{color:'#58a6ff',size:9},bgcolor:'rgba(8,14,30,.8)',
      bordercolor:'#58a6ff',borderwidth:1,borderpad:3,
      xref:'x',yref:'y',xanchor:'right'});
  });

  // Exit marker
  if(exitIdx>=0){
    annotations.push({
      x:exitIdx,y:spec.exitPrice,text:`✕ ${ol}`,showarrow:true,
      arrowcolor:oc,arrowsize:1,arrowwidth:2,ax:0,ay:40,
      font:{color:oc,size:11,family:'monospace'},
      bgcolor:'rgba(10,10,10,.9)',bordercolor:oc,borderwidth:1,borderpad:4,
      xref:'x',yref:'y'
    });
  }

  const xs = candles.map((_,i)=>i);
  const tickvals = [], ticktext = [];
  let lastDate = '';
  candles.forEach((c,i)=>{
    const [d,t]=c.dt.split(' ');
    if(d!==lastDate){tickvals.push(i);ticktext.push(`${d.slice(5)}\n${t}`);lastDate=d;}
    else if(i%3===0){tickvals.push(i);ticktext.push(t);}
  });

  const chartId = `chart_${idx}`;

  // Color entry candle and exit candle differently in the candle color arrays
  const inc=candles.map((c,i)=>{
    if(c.isEntry) return '#ff8c42';   // orange for entry
    if(c.isExit) return oc;
    return '#3fb950';
  });
  const dec=candles.map((c,i)=>{
    if(c.isEntry) return '#ff5500';
    if(c.isExit) return oc;
    return '#f85149';
  });

  const priceRange = (() => {
    const all=[...candles.map(c=>c.h), ...candles.map(c=>c.l),
               levels.slLine, levels.r4];
    const mn=Math.min(...all), mx=Math.max(...all);
    const pad=(mx-mn)*0.08;
    return [mn-pad, mx+pad];
  })();

  return `
<div class="chart-wrap">
  <div class="chart-header">
    <div>
      <span class="sym-tag">${spec.sym}</span>
      <span class="conf-tag">Confluence ${spec.confDate} (×${spec.cfCount})</span>
    </div>
    <div class="outcome-tag" style="color:${oc};border-color:${oc}">${ol}</div>
  </div>
  <div class="chart-meta">
    <span>SHORT ${spec.entryDay} ${spec.entryTime} @ ₹${spec.ep}</span>
    <span>SL = ₹${spec.slInit}</span>
    <span>Risk = ₹${spec.risk.toFixed(2)}</span>
    <span>confHigh = ₹${spec.cfHigh}</span>
    <span style="color:${oc}">Exit ${spec.exitDate} ${spec.exitTime} @ ₹${spec.exitPrice} → ${spec.rMult}R</span>
  </div>
  <div id="${chartId}" style="height:320px"></div>
  <script>
  (function(){
    var candles=${JSON.stringify(candles)};
    var xs=${JSON.stringify(xs)};
    Plotly.newPlot('${chartId}',[{
      type:'candlestick',
      x:xs,
      open:candles.map(c=>c.o),
      high:candles.map(c=>c.h),
      low:candles.map(c=>c.l),
      close:candles.map(c=>c.c),
      increasing:{line:{color:'#3fb950'},fillcolor:'#1a2e1a'},
      decreasing:{line:{color:'#f85149'},fillcolor:'#2e1a1a'},
      whiskerwidth:0.3,
      name:'${spec.sym}',
    }],{
      paper_bgcolor:'#161b22',plot_bgcolor:'#0d1117',
      font:{color:'#e6edf3',family:'Segoe UI,sans-serif'},
      margin:{t:8,r:12,b:55,l:68},
      xaxis:{type:'category',rangeslider:{visible:false},tickvals:${JSON.stringify(tickvals)},
             ticktext:${JSON.stringify(ticktext)},tickfont:{size:9},
             tickangle:-45,gridcolor:'#21262d',showgrid:true},
      yaxis:{gridcolor:'#21262d',showgrid:true,tickfont:{size:10},range:${JSON.stringify(priceRange)}},
      shapes:${JSON.stringify(shapes)},
      annotations:${JSON.stringify(annotations)},
      showlegend:false,
    },{responsive:true,displayModeBar:false});
  })();
  </script>
</div>`;
}

// ── Full HTML ─────────────────────────────────────────────────────────────────
const sections = [
  { id:'sl',    title:'SL Exits', subtitle:'Price continued above the entry wick — stopped out at −1R',    color:'#f85149', specs: slSpecs    },
  { id:'be',    title:'BE Exits', subtitle:'Trade went in favour (BE ratchet hit), then reversed to entry — exit at 0R', color:'#8b949e', specs: beSpecs    },
  { id:'trail', title:'Trailing Exits (Best Profits)', subtitle:'Price fell significantly — ratchets locked profit, exit on reversal to trailing SL', color:'#3fb950', specs: trailSpecs },
];

let chartIdx = 0;
const sectionsHtml = sections.map(sec=>`
<div id="sec-${sec.id}" class="section">
  <div class="section-hdr" style="border-color:${sec.color}">
    <div>
      <div class="section-title" style="color:${sec.color}">${sec.title}</div>
      <div class="section-sub">${sec.subtitle}</div>
    </div>
  </div>
  ${sec.specs.map(spec=>chartHtml(spec,chartIdx++,sec.specs.length)).join('\n')}
</div>`).join('\n');

const html=`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Setup D — Trade Examples</title>
<script src="https://cdn.plot.ly/plotly-2.27.0.min.js"></script>
<style>
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Segoe UI',Arial,sans-serif;background:#0d1117;color:#e6edf3;
       font-size:13px;line-height:1.5;padding:0 0 60px;}

  .page-hdr{background:#161b22;border-bottom:1px solid #30363d;padding:16px 28px;
    border-top:3px solid #3fb950;position:sticky;top:0;z-index:100;}
  .page-hdr h1{font-size:18px;font-weight:700;margin-bottom:2px;}
  .page-hdr p{color:#8b949e;font-size:12px;}

  .nav{display:flex;gap:10px;padding:14px 28px;background:#161b22;
    border-bottom:1px solid #30363d;position:sticky;top:57px;z-index:99;}
  .nav a{color:#8b949e;text-decoration:none;font-size:12px;font-weight:600;
    padding:6px 16px;border-radius:6px;border:1px solid #30363d;transition:all .15s;}
  .nav a:hover,.nav a.active{color:#e6edf3;background:#21262d;border-color:#8b949e;}
  .nav a.sl{border-color:#f85149;color:#f85149;}
  .nav a.be{border-color:#8b949e;color:#8b949e;}
  .nav a.tr{border-color:#3fb950;color:#3fb950;}

  .section{padding:28px 28px 10px;}
  .section-hdr{border-left:4px solid #30363d;padding-left:14px;margin-bottom:22px;}
  .section-title{font-size:16px;font-weight:700;margin-bottom:3px;}
  .section-sub{font-size:12px;color:#8b949e;}

  .chart-wrap{background:#161b22;border:1px solid #30363d;border-radius:10px;
    padding:14px 14px 4px;margin-bottom:20px;}
  .chart-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;}
  .sym-tag{font-size:15px;font-weight:700;color:#e6edf3;margin-right:10px;}
  .conf-tag{font-size:11px;color:#8b949e;}
  .outcome-tag{font-size:12px;font-weight:700;border:1px solid;border-radius:20px;
    padding:3px 12px;}
  .chart-meta{display:flex;gap:18px;flex-wrap:wrap;font-size:11px;color:#8b949e;
    margin-bottom:10px;}
  .chart-meta span:last-child{font-weight:600;}
</style>
</head>
<body>

<div class="page-hdr">
  <h1>📉 Setup D — Fade High · Trade Examples</h1>
  <p>Entry: first hourly CLOSE above confHigh &nbsp;·&nbsp; SL = entry candle HIGH &nbsp;·&nbsp; r2 trailing exit</p>
</div>

<div class="nav">
  <a href="#sec-sl" class="sl">SL Exits (−1R)</a>
  <a href="#sec-be" class="be">BE Exits (0R)</a>
  <a href="#sec-trail" class="tr">Trailing Exits (Best Profits)</a>
</div>

${sectionsHtml}

</body>
</html>`;

fs.writeFileSync(OUT, html);
console.log(`\n✓ → ${OUT}`);
