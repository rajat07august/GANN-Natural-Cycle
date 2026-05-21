#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────
// backtest_short_b.js — Gann Confluence SHORT — Breakdown Entry
// ─────────────────────────────────────────────────────────────────────
// Signal  : Gann Confluence date (cfCount ≥ 2, any type H/L/HL)
// Entry   : Next trading day — first hourly CLOSE strictly below confLow
// SL      : confHigh  (full candle range above entry)
// Risk    : confHigh − ep  (ep is just below confLow)
//
// Ratchet 1 — BE  : candle LOW ≤ ep − 1R  → SL drops to ep
// Ratchet 2       : candle LOW ≤ ep − 2R  → SL drops to ep − 1.5R
// Ratchet 3       : candle LOW ≤ ep − 3R  → SL drops to ep − 2R  (r3 only)
// SL trigger      : candle HIGH ≥ currentSL  (wick-based, mirrors long)
//
// Exits   : r1 = fixed 1R target (close ≤ ep − risk)
//           r2 = trailing — no fixed target, exit when SL hit
//           r3 = trailing — no fixed target, exit when SL hit (extra ratchet)
//
// ZigZag  : Dev 4% / Depth 10 (adjusted prices)
// Sizing  : ₹10L capital · ₹16K fixed risk/trade · Max 5 open
// ─────────────────────────────────────────────────────────────────────

const fs   = require('fs');
const path = require('path');

const ADJ_DIR      = 'j:/Swing Trading/Swing Trading/processed_adj';
const RAW_DIR      = 'j:/Swing Trading/Swing Trading/processed';
const INTRADAY_DIR = 'j:/Swing Trading/Swing Trading/processed_intraday';
const SRC1         = 'j:/GANN Claude/Dataset/NIFTY50_all.csv';
const OUT_HTML     = 'j:/GANN Claude/Backtest/backtest_short_b.html';
const OUT_CSV      = 'j:/GANN Claude/Backtest/backtest_short_b.csv';

const DEV  = 4;
const DEP  = 10;
const GAPS           = [20,15,13,12,10,6,5,4,3,2,1];
const ANALYSIS_YEARS = [2020,2021,2022,2023,2024,2025,2026];
const MONTH_NAMES    = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const INITIAL        = 1_000_000;
const RISK_AMT       = 16_000;
const MAX_OPEN       = 5;
const MIN_TRADES     = 5;
const TOP_N          = 15;

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
  'POLYCAB','NHPC','SJVN','GMRINFRA','CONCOR',
  'COCHINSHIP','MAZDOCK',
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

// ══════════════════════════════════════════════════════
// DATA LOADING
// ══════════════════════════════════════════════════════
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const h = lines[0].split(',').map(x => x.trim().replace(/^"|"$/g,''));
  return lines.slice(1).map(line => {
    const c = line.split(','), o = {};
    h.forEach((k,i) => { o[k] = (c[i]||'').trim().replace(/^"|"$/g,''); });
    return o;
  });
}

function cleanOHLC(rows) {
  const out = [];
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const date  = (r.date||r.Date||'').trim();
    const open  = parseFloat(r.open||r.Open||0);
    const high  = parseFloat(r.high||r.High||0);
    const low   = parseFloat(r.low||r.Low||0);
    const close = parseFloat(r.close||r.Close||0);
    if (!date||high<=0||low<=0) continue;
    if (i > 0 && i < rows.length-1) {
      const pc = out.length ? out[out.length-1].close : 0;
      const nc = parseFloat((rows[i+1]||{}).close||(rows[i+1]||{}).Close||0);
      if (pc > 0 && nc > 0) {
        const rb = close/pc, ra = nc/close;
        if ((rb>1.35&&ra<1/1.35)||(rb<1/1.35&&ra>1.35)) {
          const sf = pc/close;
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

function loadAdjOHLC(sym) {
  const adjPath=path.join(ADJ_DIR,`${sym}.csv`);
  if(fs.existsSync(adjPath)){
    return cleanOHLC(
      parseCSV(fs.readFileSync(adjPath,'utf8'))
        .filter(r=>parseInt(r.Volume||r.volume||0)>0)
        .map(r=>({date:(r.Date||r.date||'').trim(),open:parseFloat(r.Open||r.open||0),
                  high:parseFloat(r.High||r.high||0),low:parseFloat(r.Low||r.low||0),
                  close:parseFloat(r.Close||r.close||0)}))
        .filter(r=>r.date&&r.high>0).sort((a,b)=>a.date.localeCompare(b.date))
    );
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

function loadRawOHLC(sym) {
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

// ══════════════════════════════════════════════════════
// ZIGZAG + CONFLUENCE
// ══════════════════════════════════════════════════════
function computeZigZag(rows){
  const pv=[];if(!rows.length)return pv;
  let tr=null,lhP=rows[0].high,lhD=rows[0].date,lhI=0,llP=rows[0].low,llD=rows[0].date,llI=0;
  for(let i=1;i<rows.length;i++){
    const{date,high,low}=rows[i];
    if(tr===null||tr==='UP'){
      if(high>=lhP){lhP=high;lhD=date;lhI=i;}
      if(lhP-low>=lhP*(DEV/100)&&i-lhI>=DEP){pv.push({date:lhD,type:'H'});tr='DOWN';llP=low;llD=date;llI=i;}
    }
    if(tr==='DOWN'){
      if(low<=llP){llP=low;llD=date;llI=i;}
      if(high-llP>=llP*(DEV/100)&&i-llI>=DEP){pv.push({date:llD,type:'L'});tr='UP';lhP=high;lhD=date;lhI=i;}
    }
  }
  if(tr==='UP'&&lhI>0) pv.push({date:lhD,type:'H'});
  if(tr==='DOWN'&&llI>0) pv.push({date:llD,type:'L'});
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

// ══════════════════════════════════════════════════════
// SETUP B — BREAKDOWN SHORT SIMULATION
// ══════════════════════════════════════════════════════
function simShortB(rawArr, rawIdx, rawMap, intraday, refDate) {
  const ref = rawMap[refDate];
  if (!ref || ref.high <= ref.low || ref.high <= 0) return null;

  const confHigh = ref.high;
  const confLow  = ref.low;

  const ri = rawIdx[refDate];
  if (ri === undefined || ri >= rawArr.length - 1) return null;

  const entryDate = rawArr[ri + 1].date;
  const cans      = intraday[entryDate] || [];

  // Find entry: first hourly close BELOW confLow
  let ep = null, entryTime = null, trigIdx = -1;
  for (let ci = 0; ci < cans.length; ci++) {
    if (cans[ci].close < confLow) {
      ep = cans[ci].close; entryTime = cans[ci].time; trigIdx = ci; break;
    }
  }
  if (!ep) return null;

  // Risk = distance from entry up to SL (confHigh)
  const risk = confHigh - ep;
  if (risk <= 0) return null;

  const results = {};

  for (const tR of [1, 2, 3]) {
    const isFixed  = tR === 1;
    const fixedTgt = ep - tR * risk;   // price target below entry

    let sl      = confHigh;            // SL starts at confHigh (above entry)
    let lvl     = 0;                   // ratchet level: 0=original, 1=BE, 2=1.5R, 3=2R
    let outcome = 'open';
    let exitDate='', exitTime='', exitPrice=0, barsHeld=0, done=false;

    const slLbl = () => lvl===0?'SL':lvl===1?'BE':'TRAIL';

    // Advance ratchet: price moving DOWN (candle low going lower = profit)
    const advance = (low) => {
      if (lvl<1 && low <= ep - risk)          { lvl=1; sl=ep; }           // BE
      if (lvl<2 && low <= ep - 2*risk)        { lvl=2; sl=ep - 1.5*risk; } // lock 1.5R
      if (tR>=3 && lvl<3 && low<=ep-3*risk)  { lvl=3; sl=ep - 2*risk; }   // lock 2R
    };

    // Tick a candle — SL triggered by HIGH ≥ currentSL
    const tick = (c, date) => {
      if (done) return;
      advance(c.low);
      if (isFixed) {
        // For r1: target triggered by candle LOW ≤ fixedTgt
        if (c.low <= fixedTgt) {
          // Conflict: same candle hits both target and SL
          if (c.high >= sl && c.open > sl) {
            outcome=slLbl(); exitPrice=sl;
          } else {
            outcome='TARGET'; exitPrice=fixedTgt;
          }
          exitDate=date; exitTime=c.time; done=true; return;
        }
        if (c.high >= sl) { outcome=slLbl(); exitPrice=sl; exitDate=date; exitTime=c.time; done=true; }
      } else {
        // r2/r3: trailing, exit only when SL hit
        if (c.high >= sl) { outcome=slLbl(); exitPrice=sl; exitDate=date; exitTime=c.time; done=true; }
      }
    };

    // Entry day (from trigIdx onwards)
    for (let ci = trigIdx; ci < cans.length && !done; ci++) tick(cans[ci], entryDate);
    if (!done) barsHeld = 1;

    // Subsequent days
    for (let di = ri + 2; di < rawArr.length && !done; di++) {
      const dr  = rawArr[di];
      const dc  = intraday[dr.date] || [];
      barsHeld++;
      if (dc.length) {
        for (const c of dc) { if (!done) tick(c, dr.date); }
      } else {
        // Daily OHLC proxy
        advance(dr.low);
        if (isFixed) {
          if (dr.low <= fixedTgt) {
            outcome='TARGET'; exitPrice=fixedTgt; exitDate=dr.date; exitTime='EOD'; done=true;
          } else if (dr.high >= sl) {
            outcome=slLbl(); exitPrice=sl; exitDate=dr.date; exitTime='EOD'; done=true;
          }
        } else {
          if (dr.high >= sl) { outcome=slLbl(); exitPrice=sl; exitDate=dr.date; exitTime='EOD'; done=true; }
        }
      }
      if (!done && barsHeld > 250) { outcome='open'; exitDate=dr.date; exitPrice=dr.close; done=true; }
    }

    if (!done) {
      const last=rawArr[rawArr.length-1];
      exitDate=last.date; exitPrice=last.close||ep; outcome='open';
    }

    // For shorts: profit = ep - exitPrice (positive if price fell)
    const rMult = (ep - exitPrice) / risk;
    results[`r${tR}`] = { outcome, exitDate, exitTime,
                          exitPrice:+exitPrice.toFixed(2), rMult:+rMult.toFixed(2) };
  }

  return { ep:+ep.toFixed(2), risk:+risk.toFixed(2),
           confLow:+confLow.toFixed(2), confHigh:+confHigh.toFixed(2),
           entryDate, entryTime, ...results };
}

// ── Run one symbol ────────────────────────────────────────────────────
const today = new Date().toISOString().slice(0,10);

function backtestSym(sym) {
  const adj=getAdj(sym), raw=getRaw(sym);
  if(!adj.length||!raw.length) return [];
  const rawMap={},rawIdx={};
  raw.forEach((r,i)=>{rawMap[r.date]=r;rawIdx[r.date]=i;});
  const intraday=loadIntradayByDate(sym);
  const matrix=buildMatrix(computeZigZag(adj));
  const trades=[];

  for(const yr of ANALYSIS_YEARS){
    for(let mi=0;mi<12;mi++){
      const conf=getConfluence(matrix,yr,mi);
      for(const[day,arr] of Object.entries(conf)){
        if(parseInt(day)>new Date(yr,mi+1,0).getDate()) continue;
        const h=arr.some(e=>e.type==='H'),l=arr.some(e=>e.type==='L');
        const refDate=`${yr}-${String(mi+1).padStart(2,'0')}-${day}`;
        const res=simShortB(raw,rawIdx,rawMap,intraday,refDate);
        if(!res) continue;
        trades.push({sym,analysisYear:yr,month:MONTH_NAMES[mi],confDate:refDate,
          cfType:(h&&l)?'HL':h?'H':'L',cfCount:arr.length,
          live:refDate>=today?'Y':'N',...res});
      }
    }
  }
  return trades;
}

// ══════════════════════════════════════════════════════
// STATS + PORTFOLIO
// ══════════════════════════════════════════════════════
function calcStats(trades, rKey){
  const cl=trades.filter(t=>t[rKey]?.outcome!=='open');
  if(!cl.length) return{n:0,open:0,wins:0,bes:0,sls:0,trails:0,wr:0,ev:0};
  const wins  =cl.filter(t=>t[rKey].outcome==='TARGET').length;
  const trails=cl.filter(t=>t[rKey].outcome==='TRAIL').length;
  const bes   =cl.filter(t=>t[rKey].outcome==='BE').length;
  const sls   =cl.filter(t=>t[rKey].outcome==='SL').length;
  const ev    =cl.reduce((s,t)=>s+(t[rKey].rMult??0),0)/cl.length;
  return{n:cl.length,open:trades.length-cl.length,wins,trails,bes,sls,wr:(wins+trails)/cl.length,ev};
}

function calmar(trades, rKey){
  const cl=[...trades.filter(t=>t[rKey]?.outcome!=='open')]
    .sort((a,b)=>a.entryDate.localeCompare(b.entryDate));
  if(cl.length<3) return null;
  let peak=0,maxDD=0,cap=0;
  for(const t of cl){
    cap+=(t[rKey].rMult??0);
    if(cap>peak)peak=cap;
    const dd=peak-cap;if(dd>maxDD)maxDD=dd;
  }
  return maxDD===0?null:+(cap/maxDD).toFixed(2);
}

function selectTop15(hist,rKey='r2'){
  const map={};
  hist.forEach(t=>{if(!map[t.sym])map[t.sym]=[];map[t.sym].push(t);});
  return Object.entries(map)
    .map(([sym,ts])=>({sym,n:calcStats(ts,rKey).n,cal:calmar(ts,rKey)??-99}))
    .filter(x=>x.n>=MIN_TRADES)
    .sort((a,b)=>b.cal-a.cal)
    .slice(0,TOP_N).map(x=>x.sym);
}

function simulatePortfolio(trades, rKey){
  const hist=trades.filter(t=>t.live==='N'&&t[rKey]?.outcome!=='open'&&t[rKey]?.exitDate)
    .sort((a,b)=>a.entryDate.localeCompare(b.entryDate)||a.sym.localeCompare(b.sym));
  if(!hist.length) return null;
  let cap=INITIAL;const active=[],eqPts=[{date:hist[0].entryDate,cap}],yrData={};
  let totTaken=0,totSkipped=0;
  function flush(upto){
    active.sort((a,b)=>a.exitDate.localeCompare(b.exitDate));
    while(active.length&&active[0].exitDate<=upto){
      const t=active.shift();cap+=t.rMult*RISK_AMT;
      eqPts.push({date:t.exitDate,cap:Math.round(cap)});
      const yr=+t.exitDate.slice(0,4);
      if(!yrData[yr])yrData[yr]={taken:0,skipped:0,wins:0,losses:0,bes:0};
      if(t.rMult>0.05)yrData[yr].wins++;else if(t.rMult<-0.05)yrData[yr].losses++;else yrData[yr].bes++;
    }
  }
  for(const t of hist){
    flush(t.entryDate);
    const yr=+t.entryDate.slice(0,4);
    if(!yrData[yr])yrData[yr]={taken:0,skipped:0,wins:0,losses:0,bes:0};
    if(active.length>=MAX_OPEN){yrData[yr].skipped++;totSkipped++;continue;}
    active.push({exitDate:t[rKey].exitDate,rMult:t[rKey].rMult});yrData[yr].taken++;totTaken++;
  }
  [...active].sort((a,b)=>a.exitDate.localeCompare(b.exitDate))
    .forEach(t=>{cap+=t.rMult*RISK_AMT;eqPts.push({date:t.exitDate,cap:Math.round(cap)});});
  eqPts.sort((a,b)=>a.date.localeCompare(b.date));
  const eq=[];for(const p of eqPts){if(eq.length&&eq[eq.length-1].date===p.date)eq[eq.length-1].cap=p.cap;else eq.push({...p});}
  let peak=INITIAL,maxDD=0;
  for(const p of eq){if(p.cap>peak)peak=p.cap;const dd=(peak-p.cap)/peak*100;if(dd>maxDD)maxDD=dd;}
  const years=Object.keys(yrData).map(Number).sort();let prevCap=INITIAL;
  const yearRows=years.map(yr=>{
    const pts=eq.filter(p=>p.date.startsWith(String(yr)));
    const endCap=pts.length?pts[pts.length-1].cap:prevCap;
    const pnl=endCap-prevCap,ret=pnl/INITIAL*100;
    const row={yr,startCap:Math.round(prevCap),endCap,pnl:Math.round(pnl),ret:+ret.toFixed(1),...yrData[yr]};
    prevCap=endCap;return row;
  });
  const dt=(new Date(eq[eq.length-1].date)-new Date(eq[0].date))/(365.25*864e5);
  const annualR=(cap-INITIAL)/INITIAL/Math.max(dt,0.5)*100;
  return{eq,yearRows,annualR:+annualR.toFixed(1),finalCap:Math.round(cap),
    totalRet:+((cap-INITIAL)/INITIAL*100).toFixed(1),maxDD:+maxDD.toFixed(1),
    totTaken,totSkipped,INITIAL,RISK_AMT};
}

// ══════════════════════════════════════════════════════
// RUN
// ══════════════════════════════════════════════════════
console.log('\nGann Confluence — SHORT Breakdown (Setup B)');
console.log('='.repeat(56));

process.stdout.write('Preloading OHLC … ');
for(const sym of ALL_SYMS){try{getAdj(sym);getRaw(sym);loadIntradayByDate(sym);}catch{}}
console.log('done\n');

const allTrades=[];
for(const sym of ALL_SYMS){
  process.stdout.write(`  ${sym.padEnd(14)}`);
  try{
    const t=backtestSym(sym);
    allTrades.push(...t);
    const hist=t.filter(x=>x.live==='N');
    const s2=calcStats(hist,'r2'),cal=calmar(hist,'r2');
    console.log(`${hist.length} hist  WR:${(s2.wr*100).toFixed(0)}%  EV2R:${s2.ev.toFixed(2)}  CAL:${cal??'—'}`);
  }catch(e){console.log(`ERROR: ${e.message}`);}
}

const hist=allTrades.filter(t=>t.live==='N');
const s1=calcStats(hist,'r1'),s2=calcStats(hist,'r2'),s3=calcStats(hist,'r3');
const cal2=calmar(hist,'r2');

console.log('\n' + '─'.repeat(56));
console.log(`  r1  ${s1.n} trades  WR:${(s1.wr*100).toFixed(1)}%  TARGET:${s1.wins}  BE:${s1.bes}  SL:${s1.sls}  EV:${s1.ev.toFixed(2)}R`);
console.log(`  r2  ${s2.n} trades  WR:${(s2.wr*100).toFixed(1)}%  TRAIL:${s2.trails}  BE:${s2.bes}  SL:${s2.sls}  EV:${s2.ev.toFixed(2)}R`);
console.log(`  r3  ${s3.n} trades  WR:${(s3.wr*100).toFixed(1)}%  TRAIL:${s3.trails}  BE:${s3.bes}  SL:${s3.sls}  EV:${s3.ev.toFixed(2)}R`);
console.log(`  Calmar 2R: ${cal2??'—'}`);

const top15=selectTop15(hist,'r2');
const selHist=hist.filter(t=>top15.includes(t.sym));
const port_r2=simulatePortfolio(selHist,'r2');
const port_r3=simulatePortfolio(selHist,'r3');

console.log(`\nTop 15 (Calmar r2, ≥${MIN_TRADES} trades): ${top15.join(', ')}`);

// ── Save CSV ──────────────────────────────────────────────────────────
const csvLines=['sym,date,cfType,cfCount,live,ep,risk,confLow,confHigh,entryDate,entryTime,r1_out,r1_rMult,r2_out,r2_rMult,r3_out,r3_rMult'];
for(const t of allTrades){
  csvLines.push([t.sym,t.confDate,t.cfType,t.cfCount,t.live,t.ep,t.risk,t.confLow,t.confHigh,
    t.entryDate,t.entryTime,
    t.r1?.outcome,t.r1?.rMult,t.r2?.outcome,t.r2?.rMult,t.r3?.outcome,t.r3?.rMult].join(','));
}
fs.writeFileSync(OUT_CSV,csvLines.join('\n'));

// ══════════════════════════════════════════════════════
// HTML
// ══════════════════════════════════════════════════════
console.log('\nBuilding HTML …');

function pct(v){return `${(v*100).toFixed(0)}%`;}
function clsV(v,thr=0){return v>thr?'pos':v<-thr?'neg':'neu';}
function fc(v){return `₹${(v/1e5).toFixed(2)}L`;}
function fm(v){return `₹${Math.round(v/1000)}K`;}
function rc(v){return v>0?'pos':v<0?'neg':'neu';}

// Per-symbol table
function symTableHtml(trades){
  const map={};trades.forEach(t=>{if(!map[t.sym])map[t.sym]=[];map[t.sym].push(t);});
  const rows=Object.entries(map).map(([sym,ts])=>{
    const s1=calcStats(ts,'r1'),s2=calcStats(ts,'r2'),s3=calcStats(ts,'r3');
    const cal=calmar(ts,'r2');
    return{sym,n:s2.n,cal:(cal??-99),calStr:cal==null?'—':cal.toFixed(2),
           calCls:cal==null?'neu':cal>=1?'pos':cal>=0?'neu':'neg',
           s1,s2,s3};
  }).sort((a,b)=>b.cal-a.cal);
  return `<div style="overflow-x:auto"><table class="sym-table">
<thead><tr>
  <th>Symbol</th><th>N</th><th>Calmar r2</th>
  <th class="cr1">WR r1</th><th class="cr1">EV r1</th>
  <th class="cr2">WR r2</th><th class="cr2">EV r2</th>
  <th class="cr3">WR r3</th><th class="cr3">EV r3</th>
</tr></thead><tbody>
${rows.map(r=>`<tr>
  <td class="sym">${r.sym}</td><td>${r.n}</td>
  <td class="${r.calCls}"><b>${r.calStr}</b></td>
  <td class="${clsV(r.s1.wr-.5)}">${pct(r.s1.wr)}</td><td class="${clsV(r.s1.ev)}">${r.s1.ev.toFixed(2)}R</td>
  <td class="${clsV(r.s2.wr-.45)}">${pct(r.s2.wr)}</td><td class="${clsV(r.s2.ev)}">${r.s2.ev.toFixed(2)}R</td>
  <td class="${clsV(r.s3.wr-.4)}">${pct(r.s3.wr)}</td><td class="${clsV(r.s3.ev)}">${r.s3.ev.toFixed(2)}R</td>
</tr>`).join('')}
</tbody></table></div>`;
}

// Portfolio section
function portHtml(p, label, gradId){
  if(!p) return `<p class="empty">No closed trades.</p>`;
  const{eq}=p;
  const W=860,H=240,PL=82,PR=20,PT=15,PB=38,cw=W-PL-PR,ch=H-PT-PB;
  const ts=eq.map(e=>+new Date(e.date)),vs=eq.map(e=>e.cap);
  const t0=Math.min(...ts),t1=Math.max(...ts);
  const vSpan=Math.max(...vs)-Math.min(...vs)||1;
  const v0=Math.min(...vs)-vSpan*0.08,v1=Math.max(...vs)+vSpan*0.08;
  const sx=t=>PL+(t-t0)/(t1-t0)*cw,sy=v=>PT+ch-(v-v0)/(v1-v0)*ch;
  const pts=eq.map(e=>`${sx(+new Date(e.date)).toFixed(1)},${sy(e.cap).toFixed(1)}`).join(' ');
  const fx=sx(ts[0]).toFixed(1),lx=sx(ts[ts.length-1]).toFixed(1),by=(PT+ch).toFixed(1);
  let grid='';const y0=new Date(t0).getFullYear(),y1=new Date(t1).getFullYear();
  for(let y=y0+1;y<=y1;y++){const x=sx(+new Date(`${y}-01-01`));if(x>PL&&x<W-PR)grid+=`<line x1="${x.toFixed(1)}" y1="${PT}" x2="${x.toFixed(1)}" y2="${PT+ch}" stroke="#30363d" stroke-dasharray="3,3"/><text x="${x.toFixed(1)}" y="${PT+ch+20}" fill="#8b949e" font-size="11" text-anchor="middle">${y}</text>`;}
  let yAxis='';for(let i=0;i<=4;i++){const v=v0+i*(v1-v0)/4,yy=sy(v).toFixed(1);yAxis+=`<line x1="${PL}" y1="${yy}" x2="${W-PR}" y2="${yy}" stroke="#30363d" stroke-opacity=".5"/><text x="${PL-6}" y="${yy}" fill="#8b949e" font-size="10" text-anchor="end" dominant-baseline="middle">${fc(v)}</text>`;}
  const lineColor=p.finalCap>=p.INITIAL?'#3fb950':'#f85149';
  const fillId=`fill_${gradId}`;
  const svg=`<svg viewBox="0 0 ${W} ${H}" style="width:100%;display:block"><defs><linearGradient id="${fillId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${lineColor}" stop-opacity=".2"/><stop offset="100%" stop-color="${lineColor}" stop-opacity=".02"/></linearGradient></defs>${yAxis}${grid}<polygon points="${fx},${by} ${pts} ${lx},${by}" fill="url(#${fillId})"/><polyline points="${pts}" fill="none" stroke="${lineColor}" stroke-width="2" stroke-linejoin="round"/></svg>`;
  const stats=`<div class="port-stats">
    <div class="ps"><div class="ps-l">Capital</div><div class="ps-v">${fc(p.INITIAL)}</div></div>
    <div class="ps"><div class="ps-l">Risk/trade</div><div class="ps-v">${fm(p.RISK_AMT)}</div></div>
    <div class="ps"><div class="ps-l">Max open</div><div class="ps-v">5</div></div>
    <div class="ps"><div class="ps-l">Final</div><div class="ps-v ${rc(p.finalCap-p.INITIAL)}">${fc(p.finalCap)}</div></div>
    <div class="ps"><div class="ps-l">Total return</div><div class="ps-v ${rc(p.totalRet)}">${p.totalRet>0?'+':''}${p.totalRet}%</div></div>
    <div class="ps"><div class="ps-l">Annual return</div><div class="ps-v ${rc(p.annualR)}">${p.annualR>0?'+':''}${p.annualR}%/yr</div></div>
    <div class="ps"><div class="ps-l">Max drawdown</div><div class="ps-v neg">-${p.maxDD}%</div></div>
    <div class="ps"><div class="ps-l">Trades taken</div><div class="ps-v">${p.totTaken}</div></div>
    <div class="ps"><div class="ps-l">Skipped (>5)</div><div class="ps-v neu">${p.totSkipped}</div></div>
  </div>`;
  const tbl=`<table><thead><tr>
    <th>Year</th><th>Start</th><th>End</th><th>P&L</th><th>Ret on ₹10L</th>
    <th>Taken</th><th>Skip</th><th>Wins</th><th>BE</th><th>Loss</th>
  </tr></thead><tbody>
  ${p.yearRows.map(r=>`<tr>
    <td><b>${r.yr}</b></td><td style="color:var(--sub)">${fc(r.startCap)}</td>
    <td class="${rc(r.pnl)}">${fc(r.endCap)}</td>
    <td class="${rc(r.pnl)}">${r.pnl>=0?'+':''}${fm(r.pnl)}</td>
    <td><b class="${rc(r.ret)}">${r.ret>0?'+':''}${r.ret}%</b></td>
    <td>${r.taken}</td><td class="neu">${r.skipped}</td>
    <td class="pos">${r.wins}</td><td class="neu">${r.bes}</td><td class="neg">${r.losses}</td>
  </tr>`).join('')}
  </tbody></table>`;
  return `<h3 class="port-title">${label}</h3>${stats}<div class="svg-wrap">${svg}</div><div class="wrap">${tbl}</div>`;
}

const html=`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Gann SHORT — Breakdown (Setup B)</title>
<style>
  :root{--bg:#0d1117;--panel:#161b22;--panel2:#1c2128;--border:#30363d;
    --text:#e6edf3;--sub:#8b949e;--accent:#58a6ff;
    --pos:#3fb950;--neg:#f85149;--neu:#8b949e;--gold:#ffe066;--red:#ff6b6b;}
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Segoe UI',Arial,sans-serif;background:var(--bg);color:var(--text);font-size:13px;line-height:1.5;}

  .page-header{background:var(--panel);border-bottom:1px solid var(--border);padding:16px 28px;
    position:sticky;top:0;z-index:100;border-top:3px solid var(--red);}
  .page-header h1{font-size:18px;font-weight:700;margin-bottom:3px;}
  .page-header p{color:var(--sub);font-size:11.5px;}

  .content{padding:24px 28px 60px;}

  .criteria-box{background:var(--panel);border:1px solid var(--border);
    border-left:3px solid var(--red);border-radius:10px;padding:20px 24px;margin-bottom:28px;}
  .criteria-title{font-size:14px;font-weight:700;color:var(--red);margin-bottom:14px;
    padding-bottom:10px;border-bottom:1px solid var(--border);}
  .criteria-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 24px;}
  @media(max-width:900px){.criteria-grid{grid-template-columns:1fr;}}
  .crit-item{display:flex;gap:10px;align-items:baseline;padding:7px 0;
    border-bottom:1px solid rgba(48,54,61,.5);}
  .crit-label{min-width:140px;font-size:11px;font-weight:700;color:var(--sub);
    text-transform:uppercase;letter-spacing:.4px;flex-shrink:0;}
  .crit-val{font-size:12px;color:var(--text);line-height:1.5;}
  .crit-val b{color:var(--red);}

  .summary-bar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:24px;}
  .sb-item{background:var(--panel);border:1px solid var(--border);border-radius:8px;
    padding:10px 16px;flex:1;min-width:130px;}
  .sb-l{font-size:10px;color:var(--sub);text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px;}
  .sb-v{font-size:17px;font-weight:700;}

  .section-hdr{display:flex;align-items:center;gap:10px;margin:28px 0 14px;color:var(--sub);
    font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;}
  .section-hdr::after{content:'';flex:1;height:1px;background:var(--border);}

  .top15-box{background:rgba(255,107,107,.06);border:1px solid rgba(255,107,107,.25);
    border-radius:8px;padding:14px 18px;margin-bottom:16px;}
  .top15-label{font-size:11px;color:var(--sub);text-transform:uppercase;letter-spacing:.4px;margin-bottom:10px;}
  .top15-chips{display:flex;flex-wrap:wrap;gap:6px;}
  .chip{background:var(--panel2);border:1px solid rgba(255,107,107,.3);border-radius:20px;
    padding:4px 12px;font-size:12px;color:var(--red);font-weight:600;}

  .sym-table{border-collapse:collapse;width:100%;font-size:12px;}
  .sym-table th,.sym-table td{border:1px solid var(--border);padding:5px 9px;text-align:right;}
  .sym-table th{background:var(--panel2);color:var(--sub);font-size:10px;text-transform:uppercase;
    letter-spacing:.3px;position:sticky;top:0;}
  .sym-table td:first-child,.sym-table th:first-child{text-align:left;position:sticky;left:0;
    background:var(--bg);z-index:1;}
  .sym-table th:first-child{background:var(--panel2);}
  .sym-table td.sym{color:var(--red);font-weight:700;font-size:12.5px;}
  .sym-table tr:hover td{background:rgba(255,107,107,.05);}
  .sym-table th.cr1,.sym-table td.cr1{border-left:3px solid #3a1a1a;}
  .sym-table th.cr2,.sym-table td.cr2{border-left:3px solid #3a1a2a;}
  .sym-table th.cr3,.sym-table td.cr3{border-left:3px solid #3a1a3a;}

  .port-title{font-size:14px;font-weight:700;color:var(--text);margin:8px 0 14px;}
  .port-stats{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;}
  .ps{background:var(--panel2);border:1px solid var(--border);border-radius:8px;
    padding:8px 14px;min-width:110px;flex:1;}
  .ps-l{font-size:10px;color:var(--sub);text-transform:uppercase;letter-spacing:.3px;margin-bottom:3px;}
  .ps-v{font-size:15px;font-weight:700;}
  .svg-wrap{padding:0 0 12px;margin-bottom:8px;}
  .wrap{overflow-x:auto;margin-bottom:28px;}
  table{border-collapse:collapse;width:100%;font-size:12px;}
  table th,table td{border:1px solid var(--border);padding:6px 10px;text-align:right;}
  table th{background:var(--panel2);color:var(--sub);font-size:10.5px;text-transform:uppercase;}
  table td:first-child{text-align:left;font-weight:600;}
  table tr:hover td{background:rgba(255,107,107,.04);}

  .pos{color:var(--pos);}.neg{color:var(--neg);}.neu{color:var(--sub);}
  .empty{color:var(--sub);padding:20px;text-align:center;}
  ::-webkit-scrollbar{width:6px;height:6px;}
  ::-webkit-scrollbar-track{background:var(--bg);}
  ::-webkit-scrollbar-thumb{background:#30363d;border-radius:3px;}
</style>
</head>
<body>

<div class="page-header">
  <h1>📉 Gann Confluence — SHORT Breakdown (Setup B)</h1>
  <p>All 74 symbols · ZigZag 4%/10 · cfCount ≥ 2 · ₹10L · ₹16K fixed risk/trade · Max 5 open
     · Top 15 auto-selected by Calmar r2</p>
</div>

<div class="content">

<!-- ── Criteria ── -->
<div class="criteria-box">
  <div class="criteria-title">Setup B — Breakdown Short: Entry &amp; Exit Rules</div>
  <div class="criteria-grid">
    <div class="crit-item">
      <div class="crit-label">Signal</div>
      <div class="crit-val">Gann Confluence date: same calendar day in ≥2 of 11 lookback years
        (gaps 1,2,3,4,5,6,10,12,13,15,20). Any type (H/L/HL) — signal type ignored.</div>
    </div>
    <div class="crit-item">
      <div class="crit-label">Entry</div>
      <div class="crit-val">Next trading day after confluence date —
        first <b>hourly CLOSE strictly below confLow</b> (breakdown below the confluence candle's Low).
        Entry price (ep) = that close.</div>
    </div>
    <div class="crit-item">
      <div class="crit-label">Stop Loss</div>
      <div class="crit-val">Initial SL = <b>confHigh</b> (top of the confluence candle).
        Risk = confHigh − ep (approximately the full candle range).</div>
    </div>
    <div class="crit-item">
      <div class="crit-label">SL Trigger</div>
      <div class="crit-val">Any candle <b>HIGH ≥ currentSL</b> → exit at currentSL
        (wick-based, mirrors System 2 Long).</div>
    </div>
    <div class="crit-item">
      <div class="crit-label">Ratchet 1 — BE</div>
      <div class="crit-val">When candle LOW ≤ <b>ep − 1×risk</b> → SL drops to ep (breakeven).</div>
    </div>
    <div class="crit-item">
      <div class="crit-label">Ratchet 2 — 1.5R</div>
      <div class="crit-val">When candle LOW ≤ <b>ep − 2×risk</b> → SL drops to ep − 1.5×risk
        (locking 1.5R profit).</div>
    </div>
    <div class="crit-item">
      <div class="crit-label">Ratchet 3 — 2R</div>
      <div class="crit-val">When candle LOW ≤ <b>ep − 3×risk</b> → SL drops to ep − 2×risk
        (locking 2R profit) — r3 exit only.</div>
    </div>
    <div class="crit-item">
      <div class="crit-label">Exit — r1</div>
      <div class="crit-val"><b>Fixed 1R target</b>: exit when candle LOW ≤ ep − 1×risk.
        If same candle hits both target and SL, SL takes priority.</div>
    </div>
    <div class="crit-item">
      <div class="crit-label">Exit — r2</div>
      <div class="crit-val"><b>Trailing only</b>: no fixed target.
        Run until SL is hit (confHigh → BE → 1.5R lock at 2R move).</div>
    </div>
    <div class="crit-item">
      <div class="crit-label">Exit — r3</div>
      <div class="crit-val"><b>Trailing only</b>: no fixed target.
        Run until SL is hit (confHigh → BE → 1.5R → 2R lock at 3R move).</div>
    </div>
  </div>
</div>

<!-- ── Summary bar ── -->
<div class="summary-bar">
  <div class="sb-item"><div class="sb-l">Hist trades (r2)</div><div class="sb-v">${s2.n}</div></div>
  <div class="sb-item"><div class="sb-l">Win rate r1</div><div class="sb-v ${clsV(s1.wr-.5)}">${pct(s1.wr)}</div></div>
  <div class="sb-item"><div class="sb-l">EV r1</div><div class="sb-v ${clsV(s1.ev)}">${s1.ev.toFixed(2)}R</div></div>
  <div class="sb-item"><div class="sb-l">Win rate r2</div><div class="sb-v ${clsV(s2.wr-.45)}">${pct(s2.wr)}</div></div>
  <div class="sb-item"><div class="sb-l">EV r2</div><div class="sb-v ${clsV(s2.ev)}">${s2.ev.toFixed(2)}R</div></div>
  <div class="sb-item"><div class="sb-l">EV r3</div><div class="sb-v ${clsV(s3.ev)}">${s3.ev.toFixed(2)}R</div></div>
  <div class="sb-item"><div class="sb-l">Calmar r2</div><div class="sb-v ${clsV(cal2??0)}">${cal2??'—'}</div></div>
</div>

<!-- ── All 74 ── -->
<div class="section-hdr"><span>All 74 Symbols — Per-Symbol (sorted by Calmar r2)</span></div>
${symTableHtml(hist)}

<!-- ── Top 15 ── -->
<div class="section-hdr"><span>Top ${TOP_N} Selected — ≥${MIN_TRADES} trades · Calmar r2</span></div>
<div class="top15-box">
  <div class="top15-label">Top ${TOP_N} by Calmar r2 (min ${MIN_TRADES} closed trades)</div>
  <div class="top15-chips">${top15.map((s,i)=>`<span class="chip">#${i+1} ${s}</span>`).join('')}</div>
</div>
${symTableHtml(selHist)}

<!-- ── Portfolio r2 ── -->
<div class="section-hdr"><span>Portfolio Simulation — Top 15 — r2 Trailing Exit</span></div>
${portHtml(port_r2,'Short Breakdown · r2 trailing · ₹10L · ₹16K/trade · Max 5 open','pgr2')}

<!-- ── Portfolio r3 ── -->
<div class="section-hdr"><span>Portfolio Simulation — Top 15 — r3 Trailing Exit</span></div>
${portHtml(port_r3,'Short Breakdown · r3 trailing · ₹10L · ₹16K/trade · Max 5 open','pgr3')}

</div><!-- /content -->
</body>
</html>`;

fs.writeFileSync(OUT_HTML, html);
console.log(`✓ HTML → ${OUT_HTML}`);
console.log(`✓ CSV  → ${OUT_CSV}`);
