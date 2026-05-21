#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// backtest_short_all.js — Gann Confluence SHORT — 4 Setups Combined
// ─────────────────────────────────────────────────────────────────────────────
// Setup A — Rejection Short  : candle HIGH touches confHigh but CLOSE < confHigh
//                              SL = rejection candle high, Risk = high - close
// Setup B — Breakdown Short  : first CLOSE < confLow on next day
//                              SL = confHigh, Risk = confHigh - ep
// Setup C — Trend Breakdown  : same as B, but only when ZigZag shows Lower High
//                              (last confirmed H pivot < previous H pivot)
// Setup D — Fade High        : first CLOSE > confHigh on next day (breakout fade)
//                              SL = entry candle high, Risk = high - close
//
// Ratchet (all setups, inverted for short):
//   Lvl 1 (BE)   : candle LOW ≤ ep − 1R  → SL drops to ep
//   Lvl 2 (1.5R) : candle LOW ≤ ep − 2R  → SL drops to ep − 1.5R
//   Lvl 3 (2R)   : candle LOW ≤ ep − 3R  → SL drops to ep − 2R  (r3 exit only)
// SL trigger     : candle HIGH ≥ currentSL
// Exits          : r1 = fixed 1R target, r2 = trailing, r3 = trailing + 2R lock
// ─────────────────────────────────────────────────────────────────────────────

const fs   = require('fs');
const path = require('path');

const ADJ_DIR      = 'j:/Swing Trading/Swing Trading/processed_adj';
const RAW_DIR      = 'j:/Swing Trading/Swing Trading/processed';
const INTRADAY_DIR = 'j:/Swing Trading/Swing Trading/processed_intraday';
const SRC1         = 'j:/GANN Claude/Dataset/NIFTY50_all.csv';
const OUT_HTML     = 'j:/GANN Claude/Backtest/backtest_short_all.html';

const DEV = 4, DEP = 10;
const GAPS           = [20,15,13,12,10,6,5,4,3,2,1];
const ANALYSIS_YEARS = [2020,2021,2022,2023,2024,2025,2026];
const MONTH_NAMES    = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const INITIAL  = 1_000_000, RISK_AMT = 16_000, MAX_OPEN = 5, MIN_TRADES = 5, TOP_N = 15;

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

// ══════════════════════════════════════════════════════════════════════════════
// DATA LOADING (identical to backtest_short_b.js)
// ══════════════════════════════════════════════════════════════════════════════
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
    const date = (r.date||r.Date||'').trim();
    const open = parseFloat(r.open||r.Open||0), high = parseFloat(r.high||r.High||0);
    const low  = parseFloat(r.low||r.Low||0),  close= parseFloat(r.close||r.Close||0);
    if (!date||high<=0||low<=0) continue;
    if (i>0 && i<rows.length-1) {
      const pc=out.length?out[out.length-1].close:0;
      const nc=parseFloat((rows[i+1]||{}).close||(rows[i+1]||{}).Close||0);
      if (pc>0&&nc>0) {
        const rb=close/pc,ra=nc/close;
        if ((rb>1.35&&ra<1/1.35)||(rb<1/1.35&&ra>1.35)) {
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
function loadAdjOHLC(sym) {
  const adjPath=path.join(ADJ_DIR,`${sym}.csv`);
  if(fs.existsSync(adjPath)){
    return cleanOHLC(parseCSV(fs.readFileSync(adjPath,'utf8'))
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

// ══════════════════════════════════════════════════════════════════════════════
// ZIGZAG — now stores price for trend filter
// ══════════════════════════════════════════════════════════════════════════════
function computeZigZag(rows) {
  const pv=[]; if(!rows.length) return pv;
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

// ══════════════════════════════════════════════════════════════════════════════
// CORE SHORT SIMULATION — shared by all 4 setups
// ══════════════════════════════════════════════════════════════════════════════
function runShortSim(rawArr, ri, intraday, entryDay, trigIdx, ep, slInit, risk, confLow, confHigh, entryDate, entryTime) {
  const results = {};
  const cansEntry = intraday[entryDay] || [];

  for (const tR of [1, 2, 3]) {
    const isFixed = tR === 1;
    const fixedTgt = ep - tR * risk;
    let sl = slInit, lvl = 0, outcome = 'open';
    let exitDate = '', exitTime = '', exitPrice = 0, barsHeld = 0, done = false;

    const slLbl = () => lvl === 0 ? 'SL' : lvl === 1 ? 'BE' : 'TRAIL';
    const advance = (low) => {
      if (lvl < 1 && low <= ep - risk)                     { lvl = 1; sl = ep; }               // BE
      if (lvl < 2 && low <= ep - 2 * risk)                 { lvl = 2; sl = ep - 1.5 * risk; } // lock 1.5R
      if (tR >= 2 && lvl < 3 && low <= ep - 3 * risk)     { lvl = 3; sl = ep - 2.5 * risk; } // lock 2.5R
      if (tR >= 2 && lvl < 4 && low <= ep - 5 * risk)     { lvl = 4; sl = ep - 4 * risk; }   // lock 4R
      if (tR >= 3 && lvl < 5 && low <= ep - 7 * risk)     { lvl = 5; sl = ep - 6 * risk; }   // lock 6R (r3)
    };
    const tick = (c, date) => {
      if (done) return;
      advance(c.low);
      if (isFixed) {
        if (c.low <= fixedTgt) {
          outcome = (c.high >= sl && c.open > sl) ? slLbl() : 'TARGET';
          exitPrice = outcome === 'TARGET' ? fixedTgt : sl;
          exitDate = date; exitTime = c.time; done = true; return;
        }
        if (c.high >= sl) { outcome = slLbl(); exitPrice = sl; exitDate = date; exitTime = c.time; done = true; }
      } else {
        if (c.high >= sl) { outcome = slLbl(); exitPrice = sl; exitDate = date; exitTime = c.time; done = true; }
      }
    };

    // Entry day candles from trigIdx
    for (let ci = trigIdx; ci < cansEntry.length && !done; ci++) tick(cansEntry[ci], entryDay);
    if (!done) barsHeld = 1;

    // Subsequent days
    for (let di = ri + 2; di < rawArr.length && !done; di++) {
      const dr = rawArr[di];
      const dc = intraday[dr.date] || [];
      barsHeld++;
      if (dc.length) {
        for (const c of dc) { if (!done) tick(c, dr.date); }
      } else {
        advance(dr.low);
        if (isFixed) {
          if (dr.low <= fixedTgt) { outcome='TARGET'; exitPrice=fixedTgt; exitDate=dr.date; exitTime='EOD'; done=true; }
          else if (dr.high >= sl) { outcome=slLbl(); exitPrice=sl; exitDate=dr.date; exitTime='EOD'; done=true; }
        } else {
          if (dr.high >= sl) { outcome=slLbl(); exitPrice=sl; exitDate=dr.date; exitTime='EOD'; done=true; }
        }
      }
      if (!done && barsHeld > 250) { outcome='open'; exitDate=dr.date; exitPrice=dr.close; done=true; }
    }
    if (!done) { const last=rawArr[rawArr.length-1]; exitDate=last.date; exitPrice=last.close||ep; outcome='open'; }

    const rMult = (ep - exitPrice) / risk;
    results[`r${tR}`] = { outcome, exitDate, exitTime, exitPrice:+exitPrice.toFixed(2), rMult:+rMult.toFixed(2) };
  }
  return { ep:+ep.toFixed(2), risk:+risk.toFixed(2), confLow:+confLow.toFixed(2), confHigh:+confHigh.toFixed(2), entryDate, entryTime, ...results };
}

// ── Setup A — Rejection Short ─────────────────────────────────────────────────
// Next-day candle: HIGH >= confHigh AND CLOSE < confHigh  →  touch-and-reject
// SL = rejection candle's HIGH   |   Risk = high − close
function simShortA(rawArr, rawIdx, rawMap, intraday, refDate) {
  const ref = rawMap[refDate]; if (!ref||ref.high<=ref.low) return null;
  const confHigh=ref.high, confLow=ref.low;
  const ri=rawIdx[refDate]; if (ri===undefined||ri>=rawArr.length-1) return null;
  const entryDay=rawArr[ri+1].date, cans=intraday[entryDay]||[];
  for (let ci=0;ci<cans.length;ci++) {
    const c=cans[ci];
    if (c.high>=confHigh && c.close<confHigh) {
      const risk=c.high-c.close; if (risk<=0) continue;
      return runShortSim(rawArr,ri,intraday,entryDay,ci,c.close,c.high,risk,confLow,confHigh,entryDay,c.time);
    }
  }
  return null;
}

// ── Setup B — Breakdown Short ─────────────────────────────────────────────────
// Next-day candle: first CLOSE < confLow
// SL = confHigh   |   Risk = confHigh − ep
function simShortB(rawArr, rawIdx, rawMap, intraday, refDate) {
  const ref = rawMap[refDate]; if (!ref||ref.high<=ref.low) return null;
  const confHigh=ref.high, confLow=ref.low;
  const ri=rawIdx[refDate]; if (ri===undefined||ri>=rawArr.length-1) return null;
  const entryDay=rawArr[ri+1].date, cans=intraday[entryDay]||[];
  for (let ci=0;ci<cans.length;ci++) {
    const c=cans[ci];
    if (c.close<confLow) {
      const risk=confHigh-c.close; if (risk<=0) continue;
      return runShortSim(rawArr,ri,intraday,entryDay,ci,c.close,confHigh,risk,confLow,confHigh,entryDay,c.time);
    }
  }
  return null;
}

// ── Setup C — Trend-Filtered Breakdown ───────────────────────────────────────
// Same as B, but only if the last two confirmed High pivots form a Lower High
// (ZigZag last H price < previous H price = downtrend context)
function simShortC(rawArr, rawIdx, rawMap, intraday, refDate, pivots) {
  const hPivots=pivots.filter(p=>p.type==='H'&&p.date<refDate);
  if (hPivots.length<2) return null;
  if (hPivots[hPivots.length-1].price >= hPivots[hPivots.length-2].price) return null; // not Lower High
  return simShortB(rawArr, rawIdx, rawMap, intraday, refDate);
}

// ── Setup D — Fade High ───────────────────────────────────────────────────────
// Next-day candle: first CLOSE > confHigh (breakout above resistance, we fade it)
// SL = that candle's HIGH (the wick above)   |   Risk = high − close
function simShortD(rawArr, rawIdx, rawMap, intraday, refDate) {
  const ref = rawMap[refDate]; if (!ref||ref.high<=ref.low) return null;
  const confHigh=ref.high, confLow=ref.low;
  const ri=rawIdx[refDate]; if (ri===undefined||ri>=rawArr.length-1) return null;
  const entryDay=rawArr[ri+1].date, cans=intraday[entryDay]||[];
  for (let ci=0;ci<cans.length;ci++) {
    const c=cans[ci];
    if (c.close>confHigh) {
      const risk=c.high-c.close; if (risk<=0) continue; // no upper wick → skip
      return runShortSim(rawArr,ri,intraday,entryDay,ci,c.close,c.high,risk,confLow,confHigh,entryDay,c.time);
    }
  }
  return null;
}

// ══════════════════════════════════════════════════════════════════════════════
// STATS + PORTFOLIO
// ══════════════════════════════════════════════════════════════════════════════
function calcStats(trades, rKey) {
  const cl=trades.filter(t=>t[rKey]?.outcome!=='open');
  if(!cl.length) return{n:0,open:0,wins:0,trails:0,bes:0,sls:0,wr:0,ev:0};
  const wins=cl.filter(t=>t[rKey].outcome==='TARGET').length;
  const trails=cl.filter(t=>t[rKey].outcome==='TRAIL').length;
  const bes=cl.filter(t=>t[rKey].outcome==='BE').length;
  const sls=cl.filter(t=>t[rKey].outcome==='SL').length;
  const ev=cl.reduce((s,t)=>s+(t[rKey].rMult??0),0)/cl.length;
  return{n:cl.length,open:trades.length-cl.length,wins,trails,bes,sls,wr:(wins+trails)/cl.length,ev};
}
function calmar(trades, rKey) {
  const cl=[...trades.filter(t=>t[rKey]?.outcome!=='open')]
    .sort((a,b)=>a.entryDate.localeCompare(b.entryDate));
  if(cl.length<3) return null;
  let peak=0,maxDD=0,cap=0;
  for(const t of cl){cap+=(t[rKey].rMult??0);if(cap>peak)peak=cap;const dd=peak-cap;if(dd>maxDD)maxDD=dd;}
  return maxDD===0?null:+(cap/maxDD).toFixed(2);
}
function selectTop15(hist,rKey='r2'){
  const map={};hist.forEach(t=>{if(!map[t.sym])map[t.sym]=[];map[t.sym].push(t);});
  return Object.entries(map)
    .map(([sym,ts])=>({sym,n:calcStats(ts,rKey).n,cal:calmar(ts,rKey)??-99}))
    .filter(x=>x.n>=MIN_TRADES).sort((a,b)=>b.cal-a.cal).slice(0,TOP_N).map(x=>x.sym);
}
function simulatePortfolio(trades, rKey) {
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
    totalRet:+((cap-INITIAL)/INITIAL*100).toFixed(1),maxDD:+maxDD.toFixed(1),totTaken,totSkipped,INITIAL,RISK_AMT};
}

// ══════════════════════════════════════════════════════════════════════════════
// RUN ALL SYMBOLS
// ══════════════════════════════════════════════════════════════════════════════
const today = new Date().toISOString().slice(0,10);

console.log('\nGann Confluence — SHORT All 4 Setups');
console.log('='.repeat(60));
process.stdout.write('Preloading OHLC … ');
for(const sym of ALL_SYMS){try{getAdj(sym);getRaw(sym);loadIntradayByDate(sym);}catch{}}
console.log('done\n');

const allA=[], allB=[], allC=[], allD=[];

for(const sym of ALL_SYMS){
  process.stdout.write(`  ${sym.padEnd(14)}`);
  try{
    const adj=getAdj(sym), raw=getRaw(sym);
    if(!adj.length||!raw.length){console.log('no data');continue;}
    const rawMap={},rawIdx={};
    raw.forEach((r,i)=>{rawMap[r.date]=r;rawIdx[r.date]=i;});
    const intraday=loadIntradayByDate(sym);
    const pivots=computeZigZag(adj);
    const matrix=buildMatrix(pivots);
    const tA=[],tB=[],tC=[],tD=[];
    for(const yr of ANALYSIS_YEARS){
      for(let mi=0;mi<12;mi++){
        const conf=getConfluence(matrix,yr,mi);
        for(const[day,arr] of Object.entries(conf)){
          if(parseInt(day)>new Date(yr,mi+1,0).getDate()) continue;
          const h=arr.some(e=>e.type==='H'),l=arr.some(e=>e.type==='L');
          const refDate=`${yr}-${String(mi+1).padStart(2,'0')}-${day}`;
          const cfType=(h&&l)?'HL':h?'H':'L',cfCount=arr.length,live=refDate>=today?'Y':'N';
          const base={sym,analysisYear:yr,month:MONTH_NAMES[mi],confDate:refDate,cfType,cfCount,live};
          const rA=simShortA(raw,rawIdx,rawMap,intraday,refDate);if(rA)tA.push({...base,...rA});
          const rB=simShortB(raw,rawIdx,rawMap,intraday,refDate);if(rB)tB.push({...base,...rB});
          const rC=simShortC(raw,rawIdx,rawMap,intraday,refDate,pivots);if(rC)tC.push({...base,...rC});
          const rD=simShortD(raw,rawIdx,rawMap,intraday,refDate);if(rD)tD.push({...base,...rD});
        }
      }
    }
    allA.push(...tA); allB.push(...tB); allC.push(...tC); allD.push(...tD);
    const hA=tA.filter(t=>t.live==='N'),hB=tB.filter(t=>t.live==='N');
    const hC=tC.filter(t=>t.live==='N'),hD=tD.filter(t=>t.live==='N');
    const s=x=>calcStats(x,'r2');
    console.log(`A:${hA.length}/${s(hA).ev.toFixed(2)}  B:${hB.length}/${s(hB).ev.toFixed(2)}  C:${hC.length}/${s(hC).ev.toFixed(2)}  D:${hD.length}/${s(hD).ev.toFixed(2)}`);
  }catch(e){console.log(`ERROR: ${e.message}`);}
}

const histA=allA.filter(t=>t.live==='N'), histB=allB.filter(t=>t.live==='N');
const histC=allC.filter(t=>t.live==='N'), histD=allD.filter(t=>t.live==='N');

const sA1=calcStats(histA,'r1'),sA2=calcStats(histA,'r2'),sA3=calcStats(histA,'r3'),calA=calmar(histA,'r2');
const sB1=calcStats(histB,'r1'),sB2=calcStats(histB,'r2'),sB3=calcStats(histB,'r3'),calB=calmar(histB,'r2');
const sC1=calcStats(histC,'r1'),sC2=calcStats(histC,'r2'),sC3=calcStats(histC,'r3'),calC=calmar(histC,'r2');
const sD1=calcStats(histD,'r1'),sD2=calcStats(histD,'r2'),sD3=calcStats(histD,'r3'),calD=calmar(histD,'r2');

console.log('\n' + '─'.repeat(60));
['A','B','C','D'].forEach((k,i)=>{
  const[s1,s2,s3,cal]=[[sA1,sA2,sA3,calA],[sB1,sB2,sB3,calB],[sC1,sC2,sC3,calC],[sD1,sD2,sD3,calD]][i];
  console.log(`  Setup ${k}  N=${s2.n}  EV r1:${s1.ev.toFixed(2)}  EV r2:${s2.ev.toFixed(2)}  EV r3:${s3.ev.toFixed(2)}  Calmar:${cal??'—'}`);
});

const top15A=selectTop15(histA,'r2'), top15B=selectTop15(histB,'r2');
const top15C=selectTop15(histC,'r2'), top15D=selectTop15(histD,'r2');
console.log(`\nTop 15 A: ${top15A.join(', ')}`);
console.log(`Top 15 B: ${top15B.join(', ')}`);
console.log(`Top 15 C: ${top15C.join(', ')}`);
console.log(`Top 15 D: ${top15D.join(', ')}`);

// ══════════════════════════════════════════════════════════════════════════════
// HTML
// ══════════════════════════════════════════════════════════════════════════════
console.log('\nBuilding HTML …');

const pct=v=>`${(v*100).toFixed(0)}%`;
const clsV=(v,t=0)=>v>t?'pos':v<-t?'neg':'neu';
const fc=v=>`₹${(v/1e5).toFixed(2)}L`;
const fm=v=>`₹${Math.round(v/1000)}K`;
const rc=v=>v>0?'pos':v<0?'neg':'neu';

function symTableHtml(trades, accentVar) {
  const map={};trades.forEach(t=>{if(!map[t.sym])map[t.sym]=[];map[t.sym].push(t);});
  const rows=Object.entries(map).map(([sym,ts])=>{
    const s1=calcStats(ts,'r1'),s2=calcStats(ts,'r2'),s3=calcStats(ts,'r3');
    const cal=calmar(ts,'r2');
    return{sym,n:s2.n,cal:(cal??-99),calStr:cal==null?'—':cal.toFixed(2),
           calCls:cal==null?'neu':cal>=1?'pos':cal>=0?'neu':'neg',s1,s2,s3};
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
  <td class="${clsV(r.s2.wr-.4)}">${pct(r.s2.wr)}</td><td class="${clsV(r.s2.ev)}">${r.s2.ev.toFixed(2)}R</td>
  <td class="${clsV(r.s3.wr-.35)}">${pct(r.s3.wr)}</td><td class="${clsV(r.s3.ev)}">${r.s3.ev.toFixed(2)}R</td>
</tr>`).join('')}
</tbody></table></div>`;
}

function portHtml(p, label, gradId) {
  if(!p) return `<p class="empty">No closed trades.</p>`;
  const{eq}=p;
  const W=860,H=240,PL=82,PR=20,PT=15,PB=38,cw=W-PL-PR,ch=H-PT-PB;
  const ts=eq.map(e=>+new Date(e.date)),vs=eq.map(e=>e.cap);
  const t0=Math.min(...ts),t1=Math.max(...ts),vSpan=Math.max(...vs)-Math.min(...vs)||1;
  const v0=Math.min(...vs)-vSpan*0.08,v1=Math.max(...vs)+vSpan*0.08;
  const sx=t=>PL+(t-t0)/(t1-t0)*cw,sy=v=>PT+ch-(v-v0)/(v1-v0)*ch;
  const pts=eq.map(e=>`${sx(+new Date(e.date)).toFixed(1)},${sy(e.cap).toFixed(1)}`).join(' ');
  const fx=sx(ts[0]).toFixed(1),lx=sx(ts[ts.length-1]).toFixed(1),by=(PT+ch).toFixed(1);
  let grid='';const y0=new Date(t0).getFullYear(),y1=new Date(t1).getFullYear();
  for(let y=y0+1;y<=y1;y++){const x=sx(+new Date(`${y}-01-01`));if(x>PL&&x<W-PR)grid+=`<line x1="${x.toFixed(1)}" y1="${PT}" x2="${x.toFixed(1)}" y2="${PT+ch}" stroke="#30363d" stroke-dasharray="3,3"/><text x="${x.toFixed(1)}" y="${PT+ch+20}" fill="#8b949e" font-size="11" text-anchor="middle">${y}</text>`;}
  let yAxis='';for(let i=0;i<=4;i++){const v=v0+i*(v1-v0)/4,yy=sy(v).toFixed(1);yAxis+=`<line x1="${PL}" y1="${yy}" x2="${W-PR}" y2="${yy}" stroke="#30363d" stroke-opacity=".5"/><text x="${PL-6}" y="${yy}" fill="#8b949e" font-size="10" text-anchor="end" dominant-baseline="middle">${fc(v)}</text>`;}
  const lineColor=p.finalCap>=p.INITIAL?'#3fb950':'#f85149';
  const svg=`<svg viewBox="0 0 ${W} ${H}" style="width:100%;display:block"><defs><linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${lineColor}" stop-opacity=".2"/><stop offset="100%" stop-color="${lineColor}" stop-opacity=".02"/></linearGradient></defs>${yAxis}${grid}<polygon points="${fx},${by} ${pts} ${lx},${by}" fill="url(#${gradId})"/><polyline points="${pts}" fill="none" stroke="${lineColor}" stroke-width="2" stroke-linejoin="round"/></svg>`;
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

// ── Criteria boxes per setup ──────────────────────────────────────────────────
const critA=`<div class="criteria-grid">
  <div class="crit-item"><div class="crit-label">Signal</div><div class="crit-val">Gann Confluence date — same calendar day in ≥2 lookback years. Any type (H/L/HL).</div></div>
  <div class="crit-item"><div class="crit-label">Entry</div><div class="crit-val">Next trading day — first hourly candle where <b>HIGH ≥ confHigh AND CLOSE &lt; confHigh</b>. Price tested resistance and closed below (rejection). Entry = close of that candle.</div></div>
  <div class="crit-item"><div class="crit-label">Stop Loss</div><div class="crit-val">Initial SL = <b>rejection candle's HIGH</b> (the wick that tested confHigh).</div></div>
  <div class="crit-item"><div class="crit-label">Risk</div><div class="crit-val">Risk = candle HIGH − candle CLOSE (the wick portion above the close).</div></div>
  <div class="crit-item"><div class="crit-label">Ratchet 1 — BE</div><div class="crit-val">LOW ≤ ep − 1R → SL drops to ep.</div></div>
  <div class="crit-item"><div class="crit-label">Ratchet 2 — 1.5R</div><div class="crit-val">LOW ≤ ep − 2R → SL drops to ep − 1.5R.</div></div>
  <div class="crit-item"><div class="crit-label">Ratchet 3 — 2R</div><div class="crit-val">LOW ≤ ep − 3R → SL drops to ep − 2R (r3 only).</div></div>
  <div class="crit-item"><div class="crit-label">Exits</div><div class="crit-val">r1 = fixed 1R target · r2 = trailing · r3 = trailing with 2R lock</div></div>
</div>`;

const critB=`<div class="criteria-grid">
  <div class="crit-item"><div class="crit-label">Signal</div><div class="crit-val">Gann Confluence date — same calendar day in ≥2 lookback years. Any type (H/L/HL).</div></div>
  <div class="crit-item"><div class="crit-label">Entry</div><div class="crit-val">Next trading day — first hourly candle CLOSE strictly <b>below confLow</b>. Entry = that close.</div></div>
  <div class="crit-item"><div class="crit-label">Stop Loss</div><div class="crit-val">Initial SL = <b>confHigh</b> (top of the daily confluence candle).</div></div>
  <div class="crit-item"><div class="crit-label">Risk</div><div class="crit-val">Risk = confHigh − ep (approximately the full confluence candle range).</div></div>
  <div class="crit-item"><div class="crit-label">Ratchet 1 — BE</div><div class="crit-val">LOW ≤ ep − 1R → SL drops to ep.</div></div>
  <div class="crit-item"><div class="crit-label">Ratchet 2 — 1.5R</div><div class="crit-val">LOW ≤ ep − 2R → SL drops to ep − 1.5R.</div></div>
  <div class="crit-item"><div class="crit-label">Ratchet 3 — 2R</div><div class="crit-val">LOW ≤ ep − 3R → SL drops to ep − 2R (r3 only).</div></div>
  <div class="crit-item"><div class="crit-label">Exits</div><div class="crit-val">r1 = fixed 1R target · r2 = trailing · r3 = trailing with 2R lock</div></div>
</div>`;

const critC=`<div class="criteria-grid">
  <div class="crit-item"><div class="crit-label">Signal</div><div class="crit-val">Gann Confluence date — same calendar day in ≥2 lookback years. Any type (H/L/HL).</div></div>
  <div class="crit-item"><div class="crit-label">Trend Filter</div><div class="crit-val"><b>Lower High required</b>: last confirmed ZigZag H pivot price &lt; previous H pivot price. If not (uptrend context) → skip signal entirely.</div></div>
  <div class="crit-item"><div class="crit-label">Entry</div><div class="crit-val">Next trading day — first hourly CLOSE <b>below confLow</b> (same as Setup B).</div></div>
  <div class="crit-item"><div class="crit-label">Stop Loss</div><div class="crit-val">Initial SL = <b>confHigh</b>. Risk = confHigh − ep.</div></div>
  <div class="crit-item"><div class="crit-label">Ratchets</div><div class="crit-val">Same as Setup B: BE at 1R, lock 1.5R at 2R move, lock 2R at 3R move (r3).</div></div>
  <div class="crit-item"><div class="crit-label">Exits</div><div class="crit-val">r1 = fixed 1R target · r2 = trailing · r3 = trailing with 2R lock</div></div>
  <div class="crit-item"><div class="crit-label">Key difference vs B</div><div class="crit-val">Fewer trades (only downtrend context) — filters out breakdown attempts during strong uptrends which tend to whipsaw.</div></div>
</div>`;

const critD=`<div class="criteria-grid">
  <div class="crit-item"><div class="crit-label">Signal</div><div class="crit-val">Gann Confluence date — same calendar day in ≥2 lookback years. Any type (H/L/HL).</div></div>
  <div class="crit-item"><div class="crit-label">Entry</div><div class="crit-val">Next trading day — first hourly candle CLOSE strictly <b>above confHigh</b>. Price breaks above daily resistance — we fade (sell) the breakout. Entry = that close.</div></div>
  <div class="crit-item"><div class="crit-label">Stop Loss</div><div class="crit-val">Initial SL = <b>entry candle's HIGH</b> (the wick that extended above confHigh). If price runs past the wick high, breakout is real.</div></div>
  <div class="crit-item"><div class="crit-label">Risk</div><div class="crit-val">Risk = candle HIGH − candle CLOSE. Candles with no upper wick (HIGH = CLOSE) are skipped — no definable risk.</div></div>
  <div class="crit-item"><div class="crit-label">Ratchet 1 — BE</div><div class="crit-val">LOW ≤ ep − 1R → SL drops to ep.</div></div>
  <div class="crit-item"><div class="crit-label">Ratchet 2 — 1.5R</div><div class="crit-val">LOW ≤ ep − 2R → SL drops to ep − 1.5R.</div></div>
  <div class="crit-item"><div class="crit-label">Ratchet 3 — 2R</div><div class="crit-val">LOW ≤ ep − 3R → SL drops to ep − 2R (r3 only).</div></div>
  <div class="crit-item"><div class="crit-label">Exits</div><div class="crit-val">r1 = fixed 1R target · r2 = trailing · r3 = trailing with 2R lock</div></div>
</div>`;

// ── Compute portfolios ────────────────────────────────────────────────────────
const selA=histA.filter(t=>top15A.includes(t.sym));
const selB=histB.filter(t=>top15B.includes(t.sym));
const selC=histC.filter(t=>top15C.includes(t.sym));
const selD=histD.filter(t=>top15D.includes(t.sym));
const portA=simulatePortfolio(selA,'r2'), portB=simulatePortfolio(selB,'r2');
const portC=simulatePortfolio(selC,'r2'), portD=simulatePortfolio(selD,'r2');

// ── Comparison table data ─────────────────────────────────────────────────────
const compRows=[
  {k:'A',label:'Rejection Short',n:sA2.n,wr1:sA1.wr,ev1:sA1.ev,wr2:sA2.wr,ev2:sA2.ev,wr3:sA3.wr,ev3:sA3.ev,cal:calA},
  {k:'B',label:'Breakdown Short',n:sB2.n,wr1:sB1.wr,ev1:sB1.ev,wr2:sB2.wr,ev2:sB2.ev,wr3:sB3.wr,ev3:sB3.ev,cal:calB},
  {k:'C',label:'Trend Breakdown',n:sC2.n,wr1:sC1.wr,ev1:sC1.ev,wr2:sC2.wr,ev2:sC2.ev,wr3:sC3.wr,ev3:sC3.ev,cal:calC},
  {k:'D',label:'Fade High',      n:sD2.n,wr1:sD1.wr,ev1:sD1.ev,wr2:sD2.wr,ev2:sD2.ev,wr3:sD3.wr,ev3:sD3.ev,cal:calD},
];

function setupSection(key, label, tagline, critHtml, hist, top15, sel, port) {
  const s1=calcStats(hist,'r1'),s2=calcStats(hist,'r2'),s3=calcStats(hist,'r3'),cal=calmar(hist,'r2');
  return `
<div id="tab-${key}" class="tab-panel" style="display:none">
<div class="criteria-box">
  <div class="criteria-title">Setup ${key} — ${label}: ${tagline}</div>
  ${critHtml}
</div>
<div class="summary-bar">
  <div class="sb-item"><div class="sb-l">Hist trades (r2)</div><div class="sb-v">${s2.n}</div></div>
  <div class="sb-item"><div class="sb-l">WR r1</div><div class="sb-v ${clsV(s1.wr-.5)}">${pct(s1.wr)}</div></div>
  <div class="sb-item"><div class="sb-l">EV r1</div><div class="sb-v ${clsV(s1.ev)}">${s1.ev.toFixed(2)}R</div></div>
  <div class="sb-item"><div class="sb-l">WR r2</div><div class="sb-v ${clsV(s2.wr-.4)}">${pct(s2.wr)}</div></div>
  <div class="sb-item"><div class="sb-l">EV r2</div><div class="sb-v ${clsV(s2.ev)}">${s2.ev.toFixed(2)}R</div></div>
  <div class="sb-item"><div class="sb-l">EV r3</div><div class="sb-v ${clsV(s3.ev)}">${s3.ev.toFixed(2)}R</div></div>
  <div class="sb-item"><div class="sb-l">Calmar r2</div><div class="sb-v ${clsV(cal??0)}">${cal??'—'}</div></div>
</div>
<div class="section-hdr"><span>All 74 Symbols — sorted by Calmar r2</span></div>
${symTableHtml(hist)}
<div class="section-hdr"><span>Top ${TOP_N} — ≥${MIN_TRADES} trades · Calmar r2</span></div>
<div class="top15-box">
  <div class="top15-label">Top ${TOP_N} by Calmar r2 (min ${MIN_TRADES} closed trades)</div>
  <div class="top15-chips">${top15.map((s,i)=>`<span class="chip">#${i+1} ${s}</span>`).join('')}</div>
</div>
${symTableHtml(sel)}
<div class="section-hdr"><span>Portfolio — Top ${TOP_N} · r2 Trailing Exit</span></div>
${portHtml(port, `Setup ${key} · r2 trailing · ₹10L · ₹16K/trade · Max 5 open`, `pg${key}`)}
</div>`;
}

const html=`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Gann SHORT — All 4 Setups</title>
<style>
  :root{--bg:#0d1117;--panel:#161b22;--panel2:#1c2128;--border:#30363d;
        --text:#e6edf3;--sub:#8b949e;--accent:#58a6ff;
        --pos:#3fb950;--neg:#f85149;--neu:#8b949e;--red:#ff6b6b;}
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Segoe UI',Arial,sans-serif;background:var(--bg);color:var(--text);font-size:13px;line-height:1.5;}

  .page-header{background:var(--panel);border-bottom:1px solid var(--border);padding:14px 28px;
    position:sticky;top:0;z-index:200;border-top:3px solid var(--red);}
  .page-header h1{font-size:17px;font-weight:700;margin-bottom:2px;}
  .page-header p{color:var(--sub);font-size:11px;}

  .tabs{display:flex;gap:0;border-bottom:1px solid var(--border);
    position:sticky;top:57px;z-index:100;background:var(--panel);}
  .tab-btn{padding:10px 20px;border:none;background:none;color:var(--sub);
    cursor:pointer;font-size:12.5px;font-weight:600;letter-spacing:.02em;
    border-bottom:3px solid transparent;transition:all .15s;}
  .tab-btn:hover{color:var(--text);background:rgba(255,255,255,.04);}
  .tab-btn.active{color:var(--red);border-bottom-color:var(--red);}

  .content{padding:22px 28px 60px;}

  .criteria-box{background:var(--panel);border:1px solid var(--border);
    border-left:3px solid var(--red);border-radius:10px;padding:18px 22px;margin-bottom:24px;}
  .criteria-title{font-size:13.5px;font-weight:700;color:var(--red);margin-bottom:12px;
    padding-bottom:8px;border-bottom:1px solid var(--border);}
  .criteria-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px 22px;}
  @media(max-width:900px){.criteria-grid{grid-template-columns:1fr;}}
  .crit-item{display:flex;gap:10px;align-items:baseline;padding:6px 0;
    border-bottom:1px solid rgba(48,54,61,.5);}
  .crit-label{min-width:140px;font-size:10.5px;font-weight:700;color:var(--sub);
    text-transform:uppercase;letter-spacing:.4px;flex-shrink:0;}
  .crit-val{font-size:12px;color:var(--text);line-height:1.5;}
  .crit-val b{color:var(--red);}

  /* Compare tab */
  .comp-table{border-collapse:collapse;width:100%;font-size:13px;}
  .comp-table th,.comp-table td{border:1px solid var(--border);padding:8px 14px;}
  .comp-table th{background:var(--panel2);color:var(--sub);font-size:10.5px;text-transform:uppercase;text-align:center;}
  .comp-table td{text-align:center;}
  .comp-table td:first-child,.comp-table td:nth-child(2){text-align:left;}
  .comp-table .setup-label{font-weight:700;font-size:14px;color:var(--red);}

  .summary-bar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:22px;}
  .sb-item{background:var(--panel);border:1px solid var(--border);border-radius:8px;
    padding:9px 14px;flex:1;min-width:120px;}
  .sb-l{font-size:10px;color:var(--sub);text-transform:uppercase;letter-spacing:.4px;margin-bottom:3px;}
  .sb-v{font-size:16px;font-weight:700;}

  .section-hdr{display:flex;align-items:center;gap:10px;margin:24px 0 12px;color:var(--sub);
    font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;}
  .section-hdr::after{content:'';flex:1;height:1px;background:var(--border);}

  .top15-box{background:rgba(255,107,107,.06);border:1px solid rgba(255,107,107,.2);
    border-radius:8px;padding:12px 16px;margin-bottom:14px;}
  .top15-label{font-size:10.5px;color:var(--sub);text-transform:uppercase;letter-spacing:.4px;margin-bottom:8px;}
  .top15-chips{display:flex;flex-wrap:wrap;gap:6px;}
  .chip{background:var(--panel2);border:1px solid rgba(255,107,107,.3);border-radius:20px;
    padding:3px 11px;font-size:11.5px;color:var(--red);font-weight:600;}

  .sym-table{border-collapse:collapse;width:100%;font-size:12px;}
  .sym-table th,.sym-table td{border:1px solid var(--border);padding:5px 9px;text-align:right;}
  .sym-table th{background:var(--panel2);color:var(--sub);font-size:10px;text-transform:uppercase;
    letter-spacing:.3px;position:sticky;top:0;}
  .sym-table td:first-child,.sym-table th:first-child{text-align:left;position:sticky;left:0;
    background:var(--bg);z-index:1;}
  .sym-table th:first-child{background:var(--panel2);}
  .sym-table td.sym{color:var(--red);font-weight:700;}
  .sym-table tr:hover td{background:rgba(255,107,107,.04);}
  .sym-table th.cr1,.sym-table td.cr1{border-left:2px solid #3a1a1a;}
  .sym-table th.cr2,.sym-table td.cr2{border-left:2px solid #3a1a2a;}
  .sym-table th.cr3,.sym-table td.cr3{border-left:2px solid #3a1a3a;}

  .port-title{font-size:13.5px;font-weight:700;color:var(--text);margin:8px 0 12px;}
  .port-stats{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px;}
  .ps{background:var(--panel2);border:1px solid var(--border);border-radius:8px;
    padding:7px 12px;min-width:100px;flex:1;}
  .ps-l{font-size:10px;color:var(--sub);text-transform:uppercase;letter-spacing:.3px;margin-bottom:2px;}
  .ps-v{font-size:14px;font-weight:700;}
  .svg-wrap{margin-bottom:8px;}
  .wrap{overflow-x:auto;margin-bottom:24px;}
  table{border-collapse:collapse;width:100%;font-size:12px;}
  table th,table td{border:1px solid var(--border);padding:6px 10px;text-align:right;}
  table th{background:var(--panel2);color:var(--sub);font-size:10.5px;text-transform:uppercase;}
  table td:first-child{text-align:left;font-weight:600;}
  table tr:hover td{background:rgba(255,107,107,.04);}
  .pos{color:var(--pos);}.neg{color:var(--neg);}.neu{color:var(--sub);}
  .empty{color:var(--sub);padding:20px;text-align:center;}
  ::-webkit-scrollbar{width:5px;height:5px;}
  ::-webkit-scrollbar-track{background:var(--bg);}
  ::-webkit-scrollbar-thumb{background:#30363d;border-radius:3px;}
</style>
</head>
<body>

<div class="page-header">
  <h1>📉 Gann Confluence — SHORT · 4 Setups</h1>
  <p>All 74 symbols · ZigZag 4%/10 · cfCount ≥ 2 · ₹10L · ₹16K fixed risk · Max 5 open</p>
</div>

<div class="tabs">
  <button class="tab-btn active" onclick="showTab('compare',this)">⚡ Compare</button>
  <button class="tab-btn" onclick="showTab('A',this)">A — Rejection</button>
  <button class="tab-btn" onclick="showTab('B',this)">B — Breakdown</button>
  <button class="tab-btn" onclick="showTab('C',this)">C — Trend+Breakdown</button>
  <button class="tab-btn" onclick="showTab('D',this)">D — Fade High</button>
</div>

<div class="content">

<!-- ══ COMPARE TAB ══ -->
<div id="tab-compare" class="tab-panel">
  <div class="section-hdr" style="margin-top:0"><span>All 4 Setups — Head to Head</span></div>
  <div class="wrap">
  <table class="comp-table">
  <thead><tr>
    <th>Setup</th><th>Description</th><th>N Trades</th>
    <th>WR r1</th><th>EV r1</th>
    <th>WR r2</th><th>EV r2</th>
    <th>WR r3</th><th>EV r3</th>
    <th>Calmar r2</th>
  </tr></thead>
  <tbody>
  ${compRows.map(r=>`<tr>
    <td><span class="setup-label">Setup ${r.k}</span></td>
    <td>${r.label}</td>
    <td>${r.n}</td>
    <td class="${clsV(r.wr1-.5)}">${pct(r.wr1)}</td>
    <td class="${clsV(r.ev1)}"><b>${r.ev1.toFixed(2)}R</b></td>
    <td class="${clsV(r.wr2-.4)}">${pct(r.wr2)}</td>
    <td class="${clsV(r.ev2)}"><b>${r.ev2.toFixed(2)}R</b></td>
    <td class="${clsV(r.wr3-.35)}">${pct(r.wr3)}</td>
    <td class="${clsV(r.ev3)}"><b>${r.ev3.toFixed(2)}R</b></td>
    <td class="${clsV(r.cal??0)}"><b>${r.cal??'—'}</b></td>
  </tr>`).join('')}
  </tbody>
  </table>
  </div>

  <div class="section-hdr"><span>Top 15 Lists — Overlap Across Setups</span></div>
  ${['A','B','C','D'].map((k,i)=>{
    const lists=[top15A,top15B,top15C,top15D];
    return `<div style="margin-bottom:12px">
      <div class="top15-label" style="margin-bottom:6px;color:var(--red);font-weight:700">Setup ${k}</div>
      <div class="top15-chips">${lists[i].map((s,j)=>`<span class="chip">#${j+1} ${s}</span>`).join('')}</div>
    </div>`;
  }).join('')}
</div>

${setupSection('A','Rejection Short','Touch confHigh, close below — sell the rejection',critA,histA,top15A,selA,portA)}
${setupSection('B','Breakdown Short','Close below confLow — sell the breakdown',critB,histB,top15B,selB,portB)}
${setupSection('C','Trend + Breakdown','Breakdown only in downtrend (Lower High filter)',critC,histC,top15C,selC,portC)}
${setupSection('D','Fade High','Close above confHigh — fade the false breakout',critD,histD,top15D,selD,portD)}

</div>

<script>
function showTab(id, btn) {
  document.querySelectorAll('.tab-panel').forEach(p=>p.style.display='none');
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('tab-'+id).style.display='block';
  btn.classList.add('active');
}
</script>
</body>
</html>`;

fs.writeFileSync(OUT_HTML, html);
console.log(`✓ HTML → ${OUT_HTML}`);
