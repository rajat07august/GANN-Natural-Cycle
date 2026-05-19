#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────
// backtest_low_entry.js — Gann Confluence LONG Backtest — Low Entry
// ─────────────────────────────────────────────────────────────────────
// Entry  : Next trading day after conf date
//          First hourly CLOSE within 0.3% above conf date Low
// SL     : Hourly CLOSE below conf date Low  (close-based, not wick)
// BE     : Daily CLOSE above conf date High → SL ratchets to cost
// 3R     : Hourly HIGH reaches ep+3R → SL ratchets to ep+1.5R
// r2     : Fixed exit at 2R target (+ BE trailing)
// r3     : Trailing only — no fixed exit; runs until SL hit
// Filter : cfCount ≥ 2, all types
// ─────────────────────────────────────────────────────────────────────

const fs   = require('fs');
const path = require('path');

const ADJ_DIR      = 'j:/Swing Trading/Swing Trading/processed_adj';
const RAW_DIR      = 'j:/Swing Trading/Swing Trading/processed';
const INTRADAY_DIR = 'j:/Swing Trading/Swing Trading/processed_intraday';
const SRC1         = 'j:/GANN Claude/Dataset/NIFTY50_all.csv';
const OUT_HTML     = 'j:/GANN Claude/Backtest/backtest_low_entry.html';
const OUT_CSV      = 'j:/GANN Claude/Backtest/backtest_low_entry.csv';

const DEV    = 4;
const DEP    = 10;
const GAPS   = [20,15,13,12,10,6,5,4,3,2,1];
const ANALYSIS_YEARS = [2020,2021,2022,2023,2024,2025,2026];
const MONTH_NAMES    = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

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

const SELECTED_SYMS = [
  'PERSISTENT','SHRIRAMFIN','HUDCO','SJVN','RVNL','COFORGE',
  'HINDALCO','ADANIPORTS','INDHOTEL','ICICIBANK','JSWSTEEL','TRENT','ASIANPAINT','LT','HCLTECH',
];

const HIST_NAMES = {
  BHARTIARTL: ['BHARTI','BHARTIARTL'], HINDUNILVR: ['HINDLEVER','HINDUNILVR'],
  INFY: ['INFOSYSTCH','INFY'],         JSWSTEEL: ['JSWSTL','JSWSTEEL'],
  HINDALCO: ['HINDALC0','HINDALCO'],   TATASTEEL: ['TISCO','TATASTEEL'],
  TATAMOTORS: ['TELCO','TATAMOTORS'],  AXISBANK: ['UTIBANK','AXISBANK'],
  KOTAKBANK: ['KOTAKMAH','KOTAKBANK'], HEROMOTOCO: ['HEROHONDA','HEROMOTOCO'],
  BAJFINANCE: ['BAJAUTOFIN','BAJFINANCE'],
};

// ── CSV / data helpers ────────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const h = lines[0].split(',').map(x => x.trim().replace(/^"|"$/g,''));
  return lines.slice(1).map(line => {
    const c = line.split(',');
    const o = {};
    h.forEach((k,i) => { o[k] = (c[i]||'').trim().replace(/^"|"$/g,''); });
    return o;
  });
}

function cleanOHLC(rows) {
  const out = [];
  for (let i=0; i<rows.length; i++) {
    let {date,open,high,low,close} = rows[i];
    if (high>close*2.0) high=+(close*1.05).toFixed(2);
    if (close>low*2.0)  low=+(close*0.95).toFixed(2);
    if (open>close*2.0) open=+(close*1.02).toFixed(2);
    if (close>open*2.0) open=+(close*0.98).toFixed(2);
    if (i>0 && i<rows.length-1) {
      const pc=out[out.length-1].close, nc=rows[i+1].close;
      const rb=close/pc, ra=nc/close;
      if ((rb>1.35&&ra<1/1.35)||(rb<1/1.35&&ra>1.35)) {
        const sf=pc/close;
        out.push({date,open:+(open*sf).toFixed(2),high:+(high*sf).toFixed(2),low:+(low*sf).toFixed(2),close:+(close*sf).toFixed(2)});
        continue;
      }
    }
    out.push({date,open,high,low,close});
  }
  return out;
}

let _src1=null;
function getSrc1() { if(!_src1) _src1=parseCSV(fs.readFileSync(SRC1,'utf8')); return _src1; }

function loadAdjOHLC(sym) {
  const adjPath = path.join(ADJ_DIR,`${sym}.csv`);
  if (fs.existsSync(adjPath)) {
    return cleanOHLC(
      parseCSV(fs.readFileSync(adjPath,'utf8'))
        .filter(r=>parseInt(r.Volume||r.volume||0)>0)
        .map(r=>({date:(r.Date||r.date||'').trim(),open:parseFloat(r.Open||r.open||0),high:parseFloat(r.High||r.high||0),low:parseFloat(r.Low||r.low||0),close:parseFloat(r.Close||r.close||0)}))
        .filter(r=>r.date&&r.high>0).sort((a,b)=>a.date.localeCompare(b.date))
    );
  }
  const histNames=HIST_NAMES[sym]||[sym]; const symSet=new Set(histNames);
  const rows=getSrc1().filter(r=>symSet.has(r.Symbol)).map(r=>({date:r.Date.trim(),open:parseFloat(r.Open||0),high:parseFloat(r.High||0),low:parseFloat(r.Low||0),close:parseFloat(r.Close||0)})).filter(r=>r.date&&r.high>0);
  const rawPath=path.join(RAW_DIR,`${sym}.csv`);
  if (fs.existsSync(rawPath)) {
    const existing=new Set(rows.map(r=>r.date));
    parseCSV(fs.readFileSync(rawPath,'utf8')).map(r=>({date:(r.Date||r.date||'').trim(),open:parseFloat(r.Open||r.open||0),high:parseFloat(r.High||r.high||0),low:parseFloat(r.Low||r.low||0),close:parseFloat(r.Close||r.close||0)})).filter(r=>r.date&&r.high>0&&!existing.has(r.date)).forEach(r=>rows.push(r));
  }
  return cleanOHLC(rows.filter(r=>r.date>='2000-01-01').sort((a,b)=>a.date.localeCompare(b.date)));
}

function loadRawOHLC(sym) {
  const rawPath = path.join(RAW_DIR,`${sym}.csv`);
  if (!fs.existsSync(rawPath)) return [];
  return parseCSV(fs.readFileSync(rawPath,'utf8'))
    .map(r=>({date:(r.Date||r.date||'').trim(),high:parseFloat(r.High||r.high||0),low:parseFloat(r.Low||r.low||0),close:parseFloat(r.Close||r.close||0)}))
    .filter(r=>r.date&&r.high>0).sort((a,b)=>a.date.localeCompare(b.date));
}

const _idCache = {};
function loadIntradayByDate(sym) {
  if (_idCache[sym]) return _idCache[sym];
  const p = path.join(INTRADAY_DIR,`${sym}_60min.csv`);
  const byDate = {};
  if (!fs.existsSync(p)) { _idCache[sym]=byDate; return byDate; }
  const lines = fs.readFileSync(p,'utf8').trim().split('\n');
  for (let i=1; i<lines.length; i++) {
    const c=lines[i].split(',');
    const date=c[1]?.trim(), time=c[2]?.trim();
    if (!date||!time) continue;
    if (!byDate[date]) byDate[date]=[];
    byDate[date].push({time,open:parseFloat(c[3]),high:parseFloat(c[4]),low:parseFloat(c[5]),close:parseFloat(c[6])});
  }
  for (const d of Object.keys(byDate)) byDate[d].sort((a,b)=>a.time.localeCompare(b.time));
  _idCache[sym]=byDate;
  return byDate;
}

// ── ZigZag ────────────────────────────────────────────────────────────
function computeZigZag(rows) {
  const pivots=[]; if(!rows.length) return pivots;
  let trend=null,lhP=rows[0].high,lhD=rows[0].date,lhI=0,llP=rows[0].low,llD=rows[0].date,llI=0;
  for(let i=1;i<rows.length;i++){
    const{date,high,low}=rows[i];
    if(trend===null||trend==='UP'){
      if(high>=lhP){lhP=high;lhD=date;lhI=i;}
      if(lhP-low>=lhP*(DEV/100)&&i-lhI>=DEP){pivots.push({date:lhD,type:'H',price:lhP});trend='DOWN';llP=low;llD=date;llI=i;}
    }
    if(trend==='DOWN'){
      if(low<=llP){llP=low;llD=date;llI=i;}
      if(high-llP>=llP*(DEV/100)&&i-llI>=DEP){pivots.push({date:llD,type:'L',price:llP});trend='UP';lhP=high;lhD=date;lhI=i;}
    }
  }
  if(trend==='UP'&&lhI>0) pivots.push({date:lhD,type:'H',price:lhP});
  if(trend==='DOWN'&&llI>0) pivots.push({date:llD,type:'L',price:llP});
  return pivots;
}

function buildMatrix(pivots) {
  const m={};
  pivots.forEach(p=>{
    const d=new Date(p.date); const yr=d.getFullYear(),mi=d.getMonth(),day=String(d.getDate()).padStart(2,'0');
    if(!m[yr])m[yr]={}; if(!m[yr][mi])m[yr][mi]=[];
    m[yr][mi].push({day,type:p.type});
  });
  return m;
}

function getConfluence(matrix,analysisYear,monthIdx) {
  const freq={};
  GAPS.map(g=>analysisYear-g).forEach(yr=>{
    const yd=matrix[yr]; if(!yd||!yd[monthIdx]) return;
    yd[monthIdx].forEach(({day,type})=>{ if(!freq[day])freq[day]=[]; freq[day].push({year:yr,type}); });
  });
  const result={};
  for(const[day,arr] of Object.entries(freq)) { if(arr.length>=2) result[day]=arr; }
  return result;
}

// ── Core: simulate one LOW-ENTRY trade ────────────────────────────────
// r2 : fixed exit at 2R  +  BE trailing (daily close > confHigh)
// r3 : trailing only — conf Low → BE → lock 1.5R at 3R — no fixed target
// r5 : trailing only — same + lock 3R when high hits 5R — no fixed target
function simulateLowEntry(rawOhlcArr, rawDateIdx, rawDateMap, intradayByDate, refDate) {
  const refBar = rawDateMap[refDate];
  if (!refBar || refBar.high <= refBar.low || refBar.high <= 0) return null;

  const confLow  = refBar.low;
  const confHigh = refBar.high;
  const entryZone = +(confLow * 1.003).toFixed(4);  // 0.3% above confLow

  // Entry day = next trading day after refDate
  const refIdx = rawDateIdx[refDate];
  if (refIdx === undefined || refIdx >= rawOhlcArr.length - 1) return null;

  const entryDate    = rawOhlcArr[refIdx + 1].date;
  const entryCandles = intradayByDate[entryDate] || [];

  // Find entry: first hourly close in [confLow, entryZone]
  let ep = null, entryTime = null, trigIdx = -1;
  for (let ci = 0; ci < entryCandles.length; ci++) {
    const c = entryCandles[ci];
    if (c.close >= confLow && c.close <= entryZone) {
      ep = c.close; entryTime = c.time; trigIdx = ci; break;
    }
  }
  if (!ep) return null;

  const risk = ep - confLow;
  if (risk <= 0) return null;

  // Simulate r2 and r3 in one pass
  const results = {};

  for (const targetR of [2, 3, 5]) {
    const isFixed  = targetR === 2;    // r2: fixed 2R exit; r3/r5: trailing only
    const fixedTgt = ep + 2 * risk;    // only used for r2

    let currentSL  = confLow;
    let trailLevel = 0;  // 0=confLow, 1=BE, 2=1.5R
    let outcome    = 'open';
    let exitDate   = '', exitTime = '', exitPrice = 0, barsHeld = 0;
    let maxFav     = 0;
    let done       = false;

    function slLabel() {
      if (trailLevel === 0) return 'SL';
      if (trailLevel === 1) return 'BE';
      return 'TRAIL';
    }

    // Ratchet SL to BE (called after daily close confirmed > confHigh)
    function tryBE() {
      if (trailLevel < 1) { trailLevel = 1; currentSL = ep; }
    }

    // Ratchet SL to 1.5R (called when candle HIGH reaches 3R)
    function try3R(candleHigh) {
      if (candleHigh >= ep + 3 * risk && trailLevel < 2) {
        trailLevel = 2; currentSL = ep + 1.5 * risk;
      }
    }

    // Ratchet SL to 3R (called when candle HIGH reaches 5R — r5 only)
    function try5R(candleHigh) {
      if (targetR === 5 && candleHigh >= ep + 5 * risk && trailLevel < 3) {
        trailLevel = 3; currentSL = ep + 3 * risk;
      }
    }

    // Check candle for exit (SL = close-based; target = close-based)
    function tickCandle(c, date) {
      if (done) return;
      const fav = c.high - ep;
      if (fav > maxFav) maxFav = fav;

      // 3R / 5R ratchets (candle high based)
      try3R(c.high);
      try5R(c.high);

      // SL check: hourly CLOSE below currentSL
      if (c.close < currentSL) {
        outcome = slLabel(); exitPrice = currentSL;
        exitDate = date; exitTime = c.time; done = true; return;
      }
      // Fixed target (r2 only): hourly CLOSE >= fixedTgt
      if (isFixed && c.close >= fixedTgt) {
        outcome = 'TARGET'; exitPrice = fixedTgt;
        exitDate = date; exitTime = c.time; done = true;
      }
    }

    // ── Entry day ──
    let dayClose = 0;
    for (let ci = trigIdx; ci < entryCandles.length && !done; ci++) {
      tickCandle(entryCandles[ci], entryDate);
      dayClose = entryCandles[ci].close;
    }
    // End-of-entry-day: check BE trigger
    if (!done) { if (dayClose > confHigh) tryBE(); barsHeld = 1; }

    // ── Subsequent days ──
    for (let di = refIdx + 2; di < rawOhlcArr.length && !done; di++) {
      const dayRow  = rawOhlcArr[di];
      const date    = dayRow.date;
      const candles = intradayByDate[date] || [];
      barsHeld++;
      dayClose = 0;

      if (candles.length) {
        for (const c of candles) { if (!done) { tickCandle(c, date); dayClose = c.close; } }
      } else {
        // No intraday — use daily OHLC as a single proxy candle
        const fav = dayRow.high - ep;
        if (fav > maxFav) maxFav = fav;
        try3R(dayRow.high);
        try5R(dayRow.high);
        // SL: daily close below currentSL
        if (dayRow.close < currentSL) {
          outcome = slLabel(); exitPrice = currentSL; exitDate = date; exitTime = 'EOD'; done = true;
        }
        if (!done && isFixed && dayRow.high >= fixedTgt) {
          outcome = 'TARGET'; exitPrice = fixedTgt; exitDate = date; exitTime = 'EOD'; done = true;
        }
        dayClose = dayRow.close;
      }

      // End-of-day: BE trigger
      if (!done && dayClose > confHigh) tryBE();
    }

    if (!done) {
      const last = rawOhlcArr[rawOhlcArr.length - 1];
      exitDate = last.date; exitPrice = last.close || ep; outcome = 'open';
    }

    const rMult = (exitPrice - ep) / risk;
    results[`r${targetR}`] = {
      target:    isFixed ? +fixedTgt.toFixed(2) : null,
      outcome, exitDate, exitTime,
      exitPrice: +exitPrice.toFixed(2),
      trailLevel, barsHeld,
      rMult:     +rMult.toFixed(2),
      maxFavPct: +(maxFav / ep * 100).toFixed(2),
    };
  }

  return {
    ep: +ep.toFixed(2), sl: +confLow.toFixed(2), confHigh: +confHigh.toFixed(2),
    risk: +risk.toFixed(2), entryDate, entryTime,
    maxFavPct: +(Math.max(results.r2?.maxFavPct||0, results.r3?.maxFavPct||0)),
    ...results
  };
}

// ── Backtest one symbol ────────────────────────────────────────────────
function backtestSym(sym, verbose=false) {
  const adjOHLC = loadAdjOHLC(sym);
  const rawOHLC = loadRawOHLC(sym);
  if (!adjOHLC.length || !rawOHLC.length) return [];

  const rawDateMap = {}; rawOHLC.forEach(r => rawDateMap[r.date]=r);
  const rawDateIdx = {}; rawOHLC.forEach((r,i) => rawDateIdx[r.date]=i);
  const lastRawDate = rawOHLC[rawOHLC.length-1].date;
  const liveCutoff  = (() => { const d=new Date(lastRawDate); d.setDate(d.getDate()-180); return d.toISOString().slice(0,10); })();

  const intradayByDate = loadIntradayByDate(sym);
  const pivots = computeZigZag(adjOHLC);
  const matrix = buildMatrix(pivots);

  const trades = [];

  for (const analysisYear of ANALYSIS_YEARS) {
    for (let mi = 0; mi < 12; mi++) {
      const conf = getConfluence(matrix, analysisYear, mi);
      for (const [day, arr] of Object.entries(conf)) {
        const mm = String(mi+1).padStart(2,'0');
        if (parseInt(day) > new Date(analysisYear, mi+1, 0).getDate()) continue;
        const confDate = `${analysisYear}-${mm}-${day.padStart(2,'0')}`;

        // Ref bar: confDate if a trading day, else next in same month
        let refDate = rawDateMap[confDate] ? confDate : null;
        if (!refDate) {
          const nd = rawOHLC.find(r => r.date > confDate && r.date <= `${analysisYear}-${mm}-31`);
          refDate = nd?.date || null;
        }
        if (!refDate) continue;

        const sim = simulateLowEntry(rawOHLC, rawDateIdx, rawDateMap, intradayByDate, refDate);
        if (!sim) continue;

        const hasH = arr.some(e=>e.type==='H'), hasL = arr.some(e=>e.type==='L');
        const cfType = (hasH&&hasL)?'HL':hasH?'H':'L';
        const isLive = ['r2','r3','r5'].some(k => sim[k]?.outcome==='open') && sim.entryDate >= liveCutoff;

        if (verbose) {
          console.log(`\n  ${confDate} (${cfType}×${arr.length}) ref:${refDate} entry:${sim.entryDate} ${sim.entryTime} ep=${sim.ep} sl=${sim.sl}`);
          console.log(`    r2 → ${sim.r2.outcome} on ${sim.r2.exitDate} R=${sim.r2.rMult}`);
          console.log(`    r3 → ${sim.r3.outcome} on ${sim.r3.exitDate} R=${sim.r3.rMult}`);
          console.log(`    r5 → ${sim.r5.outcome} on ${sim.r5.exitDate} R=${sim.r5.rMult}`);
        }

        trades.push({
          sym, analysisYear, month: MONTH_NAMES[mi], confDate, cfType,
          cfCount: arr.length, refDate, ...sim, live: isLive ? 'Y' : 'N',
        });
      }
    }
  }
  return trades;
}

// ── Stats ──────────────────────────────────────────────────────────────
function calcStats(trades, rKey) {
  const closed = trades.filter(t => t[rKey]?.outcome !== 'open');
  if (!closed.length) return { n:0 };
  const wins = closed.filter(t => ['TARGET','TRAIL'].includes(t[rKey].outcome)).length;
  const bes  = closed.filter(t => t[rKey].outcome==='BE').length;
  const sls  = closed.filter(t => t[rKey].outcome==='SL').length;
  const avgR = closed.reduce((s,t)=>s+t[rKey].rMult,0) / closed.length;
  return { n:closed.length, open:trades.length-closed.length, wins, bes, sls,
           wr:wins/closed.length, avgR, ev:avgR };
}

function calmar(trades, rKey) {
  const closed = [...trades.filter(t=>t[rKey]?.outcome!=='open')]
    .sort((a,b)=>a.entryDate.localeCompare(b.entryDate));
  if (closed.length < 5) return null;
  let cumR=0, peak=0, maxDD=0;
  for (const t of closed) { cumR+=t[rKey].rMult; if(cumR>peak)peak=cumR; const dd=peak-cumR; if(dd>maxDD)maxDD=dd; }
  if (maxDD===0) return null;
  const t0=new Date(closed[0].entryDate), t1=new Date(closed[closed.length-1].entryDate);
  const years=Math.max((t1-t0)/(365.25*24*3600*1000),0.5);
  const totalR=closed.reduce((s,t)=>s+t[rKey].rMult,0);
  return (totalR/years)/maxDD;
}

function durationStats(trades, rKey) {
  const closed = trades.filter(t=>t[rKey]?.outcome!=='open'&&t[rKey]?.exitDate);
  if (!closed.length) return null;
  const avgDays = closed.reduce((s,t)=>{
    return s+(new Date(t[rKey].exitDate)-new Date(t.entryDate))/86400000;
  },0)/closed.length;
  const events=[];
  closed.forEach(t=>{
    events.push({date:t.entryDate,d:+1});
    const ex=new Date(t[rKey].exitDate); ex.setDate(ex.getDate()+1);
    events.push({date:ex.toISOString().slice(0,10),d:-1});
  });
  events.sort((a,b)=>a.date<b.date?-1:1);
  let active=0,wSum=0,totalDays=0,maxActive=0,prev=null;
  for(const ev of events){
    if(prev&&ev.date>prev){const span=(new Date(ev.date)-new Date(prev))/86400000;wSum+=active*span;totalDays+=span;}
    active+=ev.d; if(active>maxActive)maxActive=active; prev=ev.date;
  }
  return { avgDays:+avgDays.toFixed(1), avgConcurrent:+(totalDays>0?wSum/totalDays:0).toFixed(2), maxConcurrent:maxActive };
}

// ── Portfolio simulation (fixed ₹16K/trade, no compounding) ───────────
// rKey: 'r2' | 'r3' | 'r5' — which exit to use for portfolio P&L
function simulatePortfolio(allTrades, rKey='r2') {
  const INITIAL  = 1_000_000;
  const RISK_AMT = Math.round(INITIAL * 0.08 / 5);
  const MAX_OPEN = 5;
  const hist = allTrades
    .filter(t=>t.live==='N'&&t[rKey]?.outcome!=='open'&&t[rKey]?.exitDate)
    .sort((a,b)=>a.entryDate.localeCompare(b.entryDate)||a.sym.localeCompare(b.sym));
  if (!hist.length) return null;
  let cap=INITIAL; const active=[],eqPts=[{date:hist[0].entryDate,cap}],yrData={};
  let totTaken=0,totSkipped=0;
  function flush(upToDate) {
    active.sort((a,b)=>a.exitDate.localeCompare(b.exitDate));
    while(active.length&&active[0].exitDate<=upToDate){
      const t=active.shift(); cap+=t.rMult*RISK_AMT;
      eqPts.push({date:t.exitDate,cap:Math.round(cap)});
      const yr=+t.exitDate.slice(0,4);
      if(!yrData[yr])yrData[yr]={taken:0,skipped:0,wins:0,losses:0,bes:0};
      if(t.rMult>0)yrData[yr].wins++; else if(t.rMult<0)yrData[yr].losses++; else yrData[yr].bes++;
    }
  }
  for(const t of hist){
    flush(t.entryDate);
    const yr=+t.entryDate.slice(0,4);
    if(!yrData[yr])yrData[yr]={taken:0,skipped:0,wins:0,losses:0,bes:0};
    if(active.length>=MAX_OPEN){yrData[yr].skipped++;totSkipped++;continue;}
    active.push({exitDate:t[rKey].exitDate,rMult:t[rKey].rMult}); yrData[yr].taken++;totTaken++;
  }
  [...active].sort((a,b)=>a.exitDate.localeCompare(b.exitDate)).forEach(t=>{cap+=t.rMult*RISK_AMT;eqPts.push({date:t.exitDate,cap:Math.round(cap)});});
  eqPts.sort((a,b)=>a.date.localeCompare(b.date));
  const eq=[]; for(const p of eqPts){if(eq.length&&eq[eq.length-1].date===p.date)eq[eq.length-1].cap=p.cap;else eq.push({...p});}
  let peak=INITIAL,maxDD=0;
  for(const p of eq){if(p.cap>peak)peak=p.cap;const dd=(peak-p.cap)/peak*100;if(dd>maxDD)maxDD=dd;}
  const years=Object.keys(yrData).map(Number).sort();
  let prevCap=INITIAL;
  const yearRows=years.map(yr=>{
    const pts=eq.filter(p=>p.date.startsWith(String(yr)));
    const endCap=pts.length?pts[pts.length-1].cap:prevCap;
    const pnl=endCap-prevCap, ret=pnl/INITIAL*100;
    const row={yr,startCap:Math.round(prevCap),endCap,pnl:Math.round(pnl),ret:+ret.toFixed(1),...yrData[yr]};
    prevCap=endCap; return row;
  });
  const dt=(new Date(eq[eq.length-1].date)-new Date(eq[0].date))/(365.25*864e5);
  const annualR=(cap-INITIAL)/INITIAL/Math.max(dt,0.5)*100;
  return {eq,yearRows,annualR:+annualR.toFixed(1),finalCap:Math.round(cap),
          totalRet:+((cap-INITIAL)/INITIAL*100).toFixed(1),maxDD:+maxDD.toFixed(1),
          totTaken,totSkipped,INITIAL,RISK_AMT};
}

// ── HTML builders ──────────────────────────────────────────────────────
function buildPortfolioSection(allTrades, sectionLabel, gradId, rKey='r2') {
  const p = simulatePortfolio(allTrades, rKey);
  if (!p) return '';
  const {eq}=p;
  const W=860,H=240,PL=82,PR=20,PT=15,PB=38,cw=W-PL-PR,ch=H-PT-PB;
  const ts=eq.map(e=>+new Date(e.date)),vs=eq.map(e=>e.cap);
  const t0=Math.min(...ts),t1=Math.max(...ts);
  const vSpan=Math.max(...vs)-Math.min(...vs);
  const v0=Math.min(...vs)-vSpan*0.08,v1=Math.max(...vs)+vSpan*0.08;
  const sx=t=>PL+(t-t0)/(t1-t0)*cw, sy=v=>PT+ch-(v-v0)/(v1-v0)*ch;
  const pts=eq.map(e=>`${sx(+new Date(e.date)).toFixed(1)},${sy(e.cap).toFixed(1)}`).join(' ');
  const fx=sx(ts[0]).toFixed(1),lx=sx(ts[ts.length-1]).toFixed(1),by=(PT+ch).toFixed(1);
  let grid=''; const y0=new Date(t0).getFullYear(),y1=new Date(t1).getFullYear();
  for(let y=y0+1;y<=y1;y++){const x=sx(+new Date(`${y}-01-01`));if(x>PL&&x<W-PR)grid+=`<line x1="${x.toFixed(1)}" y1="${PT}" x2="${x.toFixed(1)}" y2="${PT+ch}" stroke="#30363d" stroke-dasharray="3,3"/><text x="${x.toFixed(1)}" y="${PT+ch+20}" fill="#8b949e" font-size="11" text-anchor="middle">${y}</text>`;}
  let yAxis=''; for(let i=0;i<=4;i++){const v=v0+i*(v1-v0)/4,yy=sy(v).toFixed(1);yAxis+=`<line x1="${PL}" y1="${yy}" x2="${W-PR}" y2="${yy}" stroke="#30363d" stroke-opacity=".5"/><text x="${PL-6}" y="${yy}" fill="#8b949e" font-size="10" text-anchor="end" dominant-baseline="middle">₹${(v/1e5).toFixed(1)}L</text>`;}
  const svg=`<div style="padding:0 24px 8px"><svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block"><defs><linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#58a6ff" stop-opacity=".22"/><stop offset="100%" stop-color="#58a6ff" stop-opacity=".01"/></linearGradient></defs>${yAxis}${grid}<polygon points="${fx},${by} ${pts} ${lx},${by}" fill="url(#${gradId})"/><polyline points="${pts}" fill="none" stroke="#58a6ff" stroke-width="1.8" stroke-linejoin="round"/></svg></div>`;
  function fc(v){return `₹${(v/1e5).toFixed(2)}L`;} function fm(v){return `₹${Math.round(v/1000)}K`;} function rc(v){return v>0?'pos':v<0?'neg':'neu';}
  const stats=`<div class="port-stats"><div class="ps"><div class="ps-l">Initial</div><div class="ps-v">${fc(p.INITIAL)}</div></div><div class="ps"><div class="ps-l">Fixed Risk/Trade</div><div class="ps-v">${fm(p.RISK_AMT)}</div></div><div class="ps"><div class="ps-l">Final Capital</div><div class="ps-v ${rc(p.finalCap-p.INITIAL)}">${fc(p.finalCap)}</div></div><div class="ps"><div class="ps-l">Total Return</div><div class="ps-v ${rc(p.totalRet)}">${p.totalRet>0?'+':''}${p.totalRet}%</div></div><div class="ps"><div class="ps-l">Avg Annual Return</div><div class="ps-v ${rc(p.annualR)}">${p.annualR>0?'+':''}${p.annualR}%/yr</div></div><div class="ps"><div class="ps-l">Max Drawdown</div><div class="ps-v neg">-${p.maxDD}%</div></div><div class="ps"><div class="ps-l">Taken</div><div class="ps-v">${p.totTaken}</div></div><div class="ps"><div class="ps-l">Skipped</div><div class="ps-v neu">${p.totSkipped}</div></div></div>`;
  const tbl=`<table><thead><tr><th>Year</th><th>Start</th><th>End</th><th>P&L</th><th>Ret on ₹10L</th><th>Taken</th><th>Skip</th><th>Wins</th><th>BE</th><th>Loss</th></tr></thead><tbody>${p.yearRows.map(r=>`<tr><td><b>${r.yr}</b></td><td style="color:var(--sub)">${fc(r.startCap)}</td><td class="${rc(r.pnl)}">${fc(r.endCap)}</td><td class="${rc(r.pnl)}">${r.pnl>=0?'+':''}${fm(r.pnl)}</td><td><b class="${rc(r.ret)}">${r.ret>0?'+':''}${r.ret}%</b></td><td>${r.taken}</td><td class="neu">${r.skipped}</td><td class="pos">${r.wins}</td><td class="neu">${r.bes}</td><td class="neg">${r.losses}</td></tr>`).join('')}</tbody></table>`;
  const exitLabel = rKey==='r5'?'5R trailing':rKey==='r3'?'3R trailing':'2R fixed';
  return `<h2>Portfolio (${exitLabel} exits) — ${sectionLabel} · ₹10L · ₹16K fixed · Max 5 Open</h2>${stats}${svg}<div class="wrap" style="margin-top:8px">${tbl}</div>`;
}

function buildHTML(allTrades) {
  const hist    = allTrades.filter(t=>t.live==='N');
  const selHist = hist.filter(t=>SELECTED_SYMS.includes(t.sym));

  function cls(v){return v>0?'pos':v<0?'neg':'neu';}
  function r(v){return `${v>0?'+':''}${v.toFixed(2)}R`;}
  function outBadge(o){
    if(o==='TARGET') return `<span class="badge target">TARGET</span>`;
    if(o==='TRAIL')  return `<span class="badge trail">TRAIL</span>`;
    if(o==='BE')     return `<span class="badge be">BE</span>`;
    if(o==='SL')     return `<span class="badge sl">SL</span>`;
    return `<span class="badge open">OPEN</span>`;
  }

  const agg2=calcStats(hist,'r2'), agg3=calcStats(hist,'r3'), agg5=calcStats(hist,'r5');
  const dur2=durationStats(hist,'r2'), dur3=durationStats(hist,'r3'), dur5=durationStats(hist,'r5');
  const sagg2=calcStats(selHist,'r2'), sagg3=calcStats(selHist,'r3'), sagg5=calcStats(selHist,'r5');
  const sdur2=durationStats(selHist,'r2'), sdur3=durationStats(selHist,'r3'), sdur5=durationStats(selHist,'r5');

  function statBox(s, dur, lbl, isTrailing=false) {
    if(!s.n) return `<div class="stat-box"><div class="lbl">${lbl}</div>No data</div>`;
    const wl = isTrailing ? 'TRAIL' : 'TARGET';
    return `<div class="stat-box"><div class="lbl">${lbl}</div>
  <b>${s.n}</b> trades &nbsp;|&nbsp; ${wl}: <b class="pos">${s.wins}</b> (${(s.wr*100).toFixed(1)}%) &nbsp;|&nbsp;
  BE: <b class="neu">${s.bes}</b> &nbsp;|&nbsp; SL: <b class="neg">${s.sls}</b> &nbsp;|&nbsp;
  EV: <b class="${cls(s.ev)}">${s.ev.toFixed(2)}R</b>
  ${s.open?`&nbsp;|&nbsp; Open: <b>${s.open}</b>`:''}
  &nbsp;|&nbsp; avgDays: <b>${dur?.avgDays??'—'}</b>
  &nbsp;|&nbsp; avgOpen: <b>${dur?.avgConcurrent??'—'}</b> (max&nbsp;${dur?.maxConcurrent??'—'})
</div>`;
  }

  function buildSymRows(trades, sortBy='calmar2r') {
    const map={};
    trades.forEach(t=>{if(!map[t.sym])map[t.sym]=[];map[t.sym].push(t);});
    return Object.entries(map).map(([sym,ts])=>{
      const s2=calcStats(ts,'r2'),s3=calcStats(ts,'r3'),s5=calcStats(ts,'r5');
      const cal=calmar(ts,'r2');
      const calStr=cal==null?'—':cal.toFixed(2);
      const calCls=cal==null?'neu':cal>=1?'pos':cal>=0?'neu':'neg';
      return {sym,s2,s3,s5,cal,calStr,calCls};
    }).sort((a,b)=>sortBy==='ev5r'?(b.s5.ev||0)-(a.s5.ev||0):(b.cal??-99)-(a.cal??-99))
    .map(({sym,s2,s3,s5,calStr,calCls})=>`<tr>
  <td class="sym">${sym}</td><td>${s2.n||0}</td>
  <td class="col-2r ${cls((s2.wr||0)-0.5)}">${((s2.wr||0)*100).toFixed(0)}%</td>
  <td class="col-2r ${cls(s2.ev||0)}">${(s2.ev||0).toFixed(2)}R</td>
  <td class="col-2r ${calCls}"><b>${calStr}</b></td>
  <td class="col-3r ${cls((s3.wr||0)-0.4)}">${((s3.wr||0)*100).toFixed(0)}%</td>
  <td class="col-3r ${cls(s3.ev||0)}">${(s3.ev||0).toFixed(2)}R</td>
  <td class="col-5r ${cls((s5.wr||0)-0.4)}">${((s5.wr||0)*100).toFixed(0)}%</td>
  <td class="col-5r ${cls(s5.ev||0)}">${(s5.ev||0).toFixed(2)}R</td>
</tr>`).join('');
  }

  function buildTradeRows(trades) {
    return trades.map(t=>{
      const r2=t.r2||{},r3=t.r3||{},r5=t.r5||{};
      return `<tr>
  <td class="sym">${t.sym}</td><td>${t.analysisYear}</td>
  <td>${t.month} ${t.confDate.substring(8)}</td>
  <td>${t.cfType} ×${t.cfCount}</td>
  <td>${t.refDate}</td><td>${t.entryDate}</td>
  <td style="color:var(--sub)">${t.entryTime}</td>
  <td>${t.ep}</td><td>${t.sl}</td><td style="color:var(--sub)">${t.confHigh}</td>
  <td class="pos">${t.risk}</td>
  <td class="col-2r">${outBadge(r2.outcome)} ${r2.exitDate||''}</td>
  <td class="col-2r ${cls(r2.rMult||0)}">${r(r2.rMult||0)}</td>
  <td class="col-3r">${outBadge(r3.outcome)} ${r3.exitDate||''}</td>
  <td class="col-3r ${cls(r3.rMult||0)}">${r(r3.rMult||0)}</td>
  <td class="col-5r">${outBadge(r5.outcome)} ${r5.exitDate||''}</td>
  <td class="col-5r ${cls(r5.rMult||0)}">${r(r5.rMult||0)}</td>
  <td>${t.maxFavPct}%</td>
</tr>`;
    }).join('');
  }

  function buildLiveRows(trades) {
    return trades.map(t=>`<tr>
  <td class="sym">${t.sym}</td><td>${t.analysisYear}</td>
  <td>${t.month} ${t.confDate.substring(8)}</td>
  <td>${t.cfType} ×${t.cfCount}</td>
  <td>${t.refDate}</td><td>${t.entryDate} ${t.entryTime}</td>
  <td>${t.ep}</td><td>${t.sl}</td><td style="color:var(--sub)">${t.confHigh}</td>
  <td class="col-2r">${t.r2?.outcome||''} ${t.r2?.exitDate||''}</td>
  <td class="col-3r">${t.r3?.outcome||''} ${t.r3?.exitDate||''}</td>
  <td class="col-5r">${t.r5?.outcome||''} ${t.r5?.exitDate||''}</td>
</tr>`).join('');
  }

  const live    = allTrades.filter(t=>t.live==='Y');
  const liveSel = live.filter(t=>SELECTED_SYMS.includes(t.sym));
  const liveRows    = buildLiveRows(live);
  const liveSelRows = buildLiveRows(liveSel);
  const tradeRows    = buildTradeRows(hist);
  const selTradeRows = buildTradeRows(selHist);
  const symRows      = buildSymRows(hist);
  const selSymRows   = buildSymRows(selHist);
  const sel5rSymRows = buildSymRows(selHist, 'ev5r');

  const liveThead = `<thead><tr>
  <th>Sym</th><th>Yr</th><th>CF Date</th><th>Type</th><th>Ref Bar</th>
  <th>Entry</th><th>EP</th><th>SL (CF Low)</th><th>CF High</th>
  <th class="col-2r">2R Status</th><th class="col-3r">3R Status</th><th class="col-5r">5R Status</th>
</tr></thead>`;
  const tradeThead = `<thead><tr>
  <th>Sym</th><th>Yr</th><th>CF Date</th><th>Type</th>
  <th>Ref Bar</th><th>Entry Bar</th><th>Time</th>
  <th>EP</th><th>SL</th><th>CF High</th><th>Risk</th>
  <th class="col-2r">2R Exit</th><th class="col-2r">2R R</th>
  <th class="col-3r">3R Exit</th><th class="col-3r">3R R</th>
  <th class="col-5r">5R Exit</th><th class="col-5r">5R R</th>
  <th>MaxFav%</th>
</tr></thead>`;
  const symThead = `<thead><tr>
  <th>Symbol</th><th>Trades</th>
  <th class="col-2r">2R WR</th><th class="col-2r">2R EV</th><th class="col-2r">Calmar(2R)</th>
  <th class="col-3r">3R WR</th><th class="col-3r">3R EV</th>
  <th class="col-5r">5R WR</th><th class="col-5r">5R EV</th>
</tr></thead>`;

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<title>Gann Confluence — Low Entry Backtest</title>
<style>
  :root{--bg:#0d1117;--panel:#161b22;--border:#30363d;--accent:#58a6ff;--green:#3fb950;--red:#f85149;--orange:#e3b341;--text:#c9d1d9;--sub:#8b949e;}
  *{box-sizing:border-box;margin:0;padding:0;}
  body{background:var(--bg);color:var(--text);font-family:'Segoe UI',system-ui,sans-serif;font-size:12px;}
  h1{color:var(--accent);font-size:18px;padding:20px 24px 6px;}
  h2{color:var(--accent);font-size:13px;padding:14px 24px 8px;border-top:1px solid var(--border);margin-top:8px;}
  .meta{color:var(--sub);padding:0 24px 10px;font-size:11px;}
  .stat-row{display:flex;gap:12px;padding:0 24px 16px;flex-wrap:wrap;}
  .stat-box{background:var(--panel);border:1px solid var(--border);border-radius:6px;padding:10px 16px;font-size:12px;flex:1;min-width:300px;}
  .stat-box .lbl{color:var(--sub);font-size:10px;text-transform:uppercase;margin-bottom:4px;}
  .wrap{padding:0 24px 24px;overflow-x:auto;}
  table{border-collapse:collapse;width:100%;}
  th{background:#1c2128;color:var(--sub);font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;padding:7px 8px;border:1px solid var(--border);text-align:left;white-space:nowrap;position:sticky;top:48px;}
  td{border:1px solid var(--border);padding:4px 8px;vertical-align:middle;white-space:nowrap;}
  tr:hover td{background:#1a2130;}
  .sym{font-weight:700;color:var(--accent);}
  .pos{color:var(--green);font-weight:600;} .neg{color:var(--red);font-weight:600;} .neu{color:var(--sub);}
  .badge{border-radius:3px;padding:1px 5px;font-size:10px;font-weight:700;display:inline-block;}
  .badge.target{background:#0d2818;color:var(--green);border:1px solid #1a4a28;}
  .badge.trail{background:#1a2810;color:#7fff7f;border:1px solid #2a5a18;}
  .badge.be{background:#1a1a2d;color:#8b8bff;border:1px solid #2a2a5d;}
  .badge.sl{background:#2d1010;color:var(--red);border:1px solid #4a1a1a;}
  .badge.open{background:#2d2010;color:var(--orange);border:1px solid #6a4a10;}
  input[type=text]{background:var(--bg);border:1px solid var(--border);color:var(--text);padding:4px 8px;border-radius:4px;font-size:11px;width:200px;}
  .col-2r{background:#0d1a10;} .col-3r{background:#0d100d;} .col-5r{background:#0d0d1a;}
  .tab-nav{display:flex;gap:4px;padding:8px 24px 0;border-bottom:1px solid var(--border);position:sticky;top:0;background:var(--bg);z-index:10;}
  .tab-btn{background:none;border:1px solid transparent;border-bottom:none;color:var(--sub);padding:7px 18px;font-size:12px;cursor:pointer;border-radius:6px 6px 0 0;font-family:inherit;}
  .tab-btn:hover{color:var(--text);background:var(--panel);}
  .tab-btn.active{background:var(--panel);border-color:var(--border);color:var(--accent);font-weight:700;}
  .tab-panel{display:none;} .tab-panel.active{display:block;}
  .port-stats{display:flex;gap:10px;padding:12px 24px 16px;flex-wrap:wrap;}
  .ps{background:var(--panel);border:1px solid var(--border);border-radius:6px;padding:10px 16px;min-width:120px;}
  .ps-l{color:var(--sub);font-size:10px;text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px;}
  .ps-v{font-size:17px;font-weight:700;}
</style></head>
<body>
<h1>Gann Confluence — LOW Entry Backtest</h1>
<div class="tab-nav">
  <button class="tab-btn active" onclick="showTab('all',this)">All 74 Symbols</button>
  <button class="tab-btn" onclick="showTab('sel',this)">15 Selected Stocks</button>
  <button class="tab-btn" onclick="showTab('5r',this)">5R — 15 Selected</button>
</div>

<!-- TAB 1 -->
<div id="tab-all" class="tab-panel active">
<div class="meta" style="padding-top:10px">
  Entry: within 0.3% of CF Low (hourly close) · SL: hourly close &lt; CF Low ·
  BE: daily close &gt; CF High → SL to cost · 3R ratchet → SL to 1.5R ·
  ZigZag dev=${DEV}% dep=${DEP} · cfCount ≥ 2
</div>
<div class="stat-row">
  ${statBox(agg2,dur2,'2R Fixed Exit (+ BE trailing)',false)}
  ${statBox(agg3,dur3,'3R Trailing (no fixed exit)',true)}
  ${statBox(agg5,dur5,'5R Trailing (lock 3R at 5R hit)',true)}
</div>
${buildPortfolioSection(allTrades,'All 74 Symbols','eqg1')}
${live.length?`<h2>Live / Open Signals (${live.length})</h2><div class="wrap"><table>${liveThead}<tbody>${liveRows}</tbody></table></div>`:''}
<h2>Per-Symbol Summary — All 74 (sorted by Calmar 2R)</h2>
<div class="wrap"><table>${symThead}<tbody>${symRows}</tbody></table></div>
<h2>All Historical Trades</h2>
<div class="wrap">
<p style="color:var(--sub);font-size:11px;margin-bottom:8px;">Filter: <input type="text" id="tf" placeholder="symbol / date / outcome…" oninput="fltAll(this.value)"></p>
<table id="tt">${tradeThead}<tbody>${tradeRows}</tbody></table>
</div>
</div>

<!-- TAB 2 -->
<div id="tab-sel" class="tab-panel">
<div class="meta" style="padding-top:10px">
  15 Selected Stocks · same entry/exit logic · sorted by Calmar 2R
</div>
<div class="stat-row">
  ${statBox(sagg2,sdur2,'2R Fixed Exit — 15 Selected',false)}
  ${statBox(sagg3,sdur3,'3R Trailing — 15 Selected',true)}
  ${statBox(sagg5,sdur5,'5R Trailing — 15 Selected',true)}
</div>
${buildPortfolioSection(allTrades.filter(t=>SELECTED_SYMS.includes(t.sym)),'15 Selected Stocks','eqg2')}
${liveSel.length?`<h2>Live / Open Signals — 15 Selected (${liveSel.length})</h2><div class="wrap"><table>${liveThead}<tbody>${liveSelRows}</tbody></table></div>`:''}
<h2>Per-Symbol Summary — 15 Selected</h2>
<div class="wrap"><table>${symThead}<tbody>${selSymRows}</tbody></table></div>
<h2>Historical Trades — 15 Selected</h2>
<div class="wrap">
<p style="color:var(--sub);font-size:11px;margin-bottom:8px;">Filter: <input type="text" id="sf" placeholder="symbol / date / outcome…" oninput="fltSel(this.value)"></p>
<table id="ts">${tradeThead}<tbody>${selTradeRows}</tbody></table>
</div>
</div>

<!-- TAB 3 -->
<div id="tab-5r" class="tab-panel">
<div class="meta" style="padding-top:10px">
  5R Trailing · 15 Selected Stocks · BE: daily close &gt; CF High → SL to cost · lock 3R when high hits 5R
</div>
<div class="stat-row">
  ${statBox(sagg5,sdur5,'5R Trailing — 15 Selected',true)}
</div>
${buildPortfolioSection(allTrades.filter(t=>SELECTED_SYMS.includes(t.sym)),'5R · 15 Selected Stocks','eqg3','r5')}
${liveSel.length?`<h2>Live / Open Signals — 15 Selected (${liveSel.length})</h2><div class="wrap"><table>${liveThead}<tbody>${liveSelRows}</tbody></table></div>`:''}
<h2>Per-Symbol Summary — 15 Selected (sorted by 5R EV)</h2>
<div class="wrap"><table>${symThead}<tbody>${sel5rSymRows}</tbody></table></div>
<h2>Historical Trades — 15 Selected (5R)</h2>
<div class="wrap">
<p style="color:var(--sub);font-size:11px;margin-bottom:8px;">Filter: <input type="text" id="f5" placeholder="symbol / date / outcome…" oninput="flt5r(this.value)"></p>
<table id="t5">${tradeThead}<tbody>${selTradeRows}</tbody></table>
</div>
</div>

<script>
function showTab(id,btn){document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));document.getElementById('tab-'+id).classList.add('active');btn.classList.add('active');}
function fltAll(v){const lv=v.toLowerCase();document.querySelectorAll('#tt tbody tr').forEach(r=>{r.style.display=r.textContent.toLowerCase().includes(lv)?'':'none';});}
function fltSel(v){const lv=v.toLowerCase();document.querySelectorAll('#ts tbody tr').forEach(r=>{r.style.display=r.textContent.toLowerCase().includes(lv)?'':'none';});}
function flt5r(v){const lv=v.toLowerCase();document.querySelectorAll('#t5 tbody tr').forEach(r=>{r.style.display=r.textContent.toLowerCase().includes(lv)?'':'none';});}
</script>
</body></html>`;
}

// ── Main ──────────────────────────────────────────────────────────────
function main() {
  const singleSym = process.argv.find(a=>!a.startsWith('-')&&a!==process.argv[0]&&a!==process.argv[1]);
  const verbose   = process.argv.includes('--verbose');
  const syms = singleSym ? [singleSym.toUpperCase()] : ALL_SYMS;

  console.log('══════════════════════════════════════════════════════════════════════');
  console.log('  Gann Confluence — LOW Entry Backtest');
  console.log('  Entry: within 0.3% of CF Low · SL: hourly close < CF Low');
  console.log('  BE: daily close > CF High · 3R ratchet → SL to 1.5R');
  console.log('  Targets: 2R fixed | 3R trailing | 5R trailing');
  console.log('══════════════════════════════════════════════════════════════════════');

  const allTrades = [];
  for (const sym of syms) {
    const trades = backtestSym(sym, verbose);
    const hist   = trades.filter(t=>t.live==='N');
    const live   = trades.filter(t=>t.live==='Y');
    if (!hist.length && !live.length) continue;
    const s2=calcStats(hist,'r2'), s3=calcStats(hist,'r3'), s5=calcStats(hist,'r5');
    const cal=calmar(hist,'r2');
    console.log(`  ${sym.padEnd(14)} ${hist.length} hist  ${live.length} live` +
      `  2R: WR=${(s2.wr*100||0).toFixed(0)}% EV=${(s2.ev||0).toFixed(2)}R  CAL=${cal==null?'—':cal.toFixed(2)}` +
      `  3R: EV=${(s3.ev||0).toFixed(2)}R  5R: EV=${(s5.ev||0).toFixed(2)}R`);
    allTrades.push(...trades);
  }

  const hist = allTrades.filter(t=>t.live==='N');
  const s2=calcStats(hist,'r2'), s3=calcStats(hist,'r3'), s5=calcStats(hist,'r5');
  const dur2=durationStats(hist,'r2'), dur3=durationStats(hist,'r3'), dur5=durationStats(hist,'r5');
  console.log('──────────────────────────────────────────────────────────────────────');
  console.log(`  2R  ${s2.n} trades  WR:${(s2.wr*100).toFixed(1)}%  TARGET:${s2.wins}  BE:${s2.bes}  SL:${s2.sls}  EV:${s2.ev.toFixed(2)}R  avgDays:${dur2?.avgDays}  avgOpen:${dur2?.avgConcurrent}`);
  console.log(`  3R  ${s3.n} trades  WR:${(s3.wr*100).toFixed(1)}%  TRAIL:${s3.wins}  BE:${s3.bes}  SL:${s3.sls}  EV:${s3.ev.toFixed(2)}R  avgDays:${dur3?.avgDays}  avgOpen:${dur3?.avgConcurrent}`);
  console.log(`  5R  ${s5.n} trades  WR:${(s5.wr*100).toFixed(1)}%  TRAIL:${s5.wins}  BE:${s5.bes}  SL:${s5.sls}  EV:${s5.ev.toFixed(2)}R  avgDays:${dur5?.avgDays}  avgOpen:${dur5?.avgConcurrent}`);

  const live = allTrades.filter(t=>t.live==='Y');
  if (live.length) {
    console.log(`\n  ── ${live.length} live/open signals ──`);
    live.forEach(t=>console.log(`  ${t.sym.padEnd(14)} ${t.analysisYear} ${t.month} ${t.confDate.substring(8)}  entry:${t.entryDate} ${t.entryTime}  ep:${t.ep} sl:${t.sl}  2R:${t.r2?.outcome}  3R:${t.r3?.outcome}  5R:${t.r5?.outcome}`));
  }

  // CSV
  const csvRows = [
    'sym,analysisYear,month,confDate,cfType,cfCount,refDate,entryDate,entryTime,ep,sl,confHigh,risk,r2_outcome,r2_exit,r2_R,r3_outcome,r3_exit,r3_R,r5_outcome,r5_exit,r5_R,maxFavPct,live'
  ];
  allTrades.forEach(t=>csvRows.push([
    t.sym,t.analysisYear,t.month,t.confDate,t.cfType,t.cfCount,t.refDate,
    t.entryDate,t.entryTime,t.ep,t.sl,t.confHigh,t.risk,
    t.r2?.outcome,t.r2?.exitDate,t.r2?.rMult,
    t.r3?.outcome,t.r3?.exitDate,t.r3?.rMult,
    t.r5?.outcome,t.r5?.exitDate,t.r5?.rMult,
    t.maxFavPct,t.live
  ].join(',')));
  fs.writeFileSync(OUT_CSV, csvRows.join('\n'), 'utf8');
  fs.writeFileSync(OUT_HTML, buildHTML(allTrades), 'utf8');
  console.log(`\n  → CSV:  ${OUT_CSV}`);
  console.log(`  → HTML: ${OUT_HTML}`);
  console.log('══════════════════════════════════════════════════════════════════════');
}

main();
