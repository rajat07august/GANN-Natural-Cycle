#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────
// backtest_long_refined.js — Refined Gann Confluence LONG Backtest
// ─────────────────────────────────────────────────────────────────────
// Entry   : hourly CLOSE > Confluence date High  (ref bar High)
// SL      : Confluence date Low  (ref bar Low)
// Trailing: move SL → entry price (breakeven) once 1R move achieved
// Target  : sweep 2R and 3R — compare which creates more value
// Filter  : cfCount ≥ 2, all confluence types (H/L/HL treated same)
// No time exit — hold until target or SL/BE hit
//
// Usage:
//   node backtest_long_refined.js             — all 74 symbols
//   node backtest_long_refined.js NATIONALUM  — single symbol, verbose
// ─────────────────────────────────────────────────────────────────────

const fs   = require('fs');
const path = require('path');

const ADJ_DIR      = 'j:/Swing Trading/Swing Trading/processed_adj';
const RAW_DIR      = 'j:/Swing Trading/Swing Trading/processed';
const INTRADAY_DIR = 'j:/Swing Trading/Swing Trading/processed_intraday';
const SRC1         = 'j:/GANN Claude/Dataset/NIFTY50_all.csv';
let OUT_HTML     = 'j:/GANN Claude/Backtest/backtest_long_refined.html';
let OUT_CSV      = 'j:/GANN Claude/Backtest/backtest_long_refined.csv';

let DEV    = 4;
let DEP    = 10;
const GAPS   = [20,15,13,12,10,6,5,4,3,2,1];
const TARGETS = [1, 2, 3];   // sweep 1R, 2R and 3R
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

// ── CSV helpers ───────────────────────────────────────────────────────
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

// ── Adjusted OHLC (for ZigZag/confluence only) ────────────────────────
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
function getSrc1() {
  if (!_src1) _src1=parseCSV(fs.readFileSync(SRC1,'utf8'));
  return _src1;
}

function loadAdjOHLC(sym) {
  const adjPath = path.join(ADJ_DIR,`${sym}.csv`);
  if (fs.existsSync(adjPath)) {
    return cleanOHLC(
      parseCSV(fs.readFileSync(adjPath,'utf8'))
        .filter(r=>parseInt(r.Volume||r.volume||0)>0)
        .map(r=>({date:(r.Date||r.date||'').trim(),open:parseFloat(r.Open||r.open||0),high:parseFloat(r.High||r.high||0),low:parseFloat(r.Low||r.low||0),close:parseFloat(r.Close||r.close||0)}))
        .filter(r=>r.date&&r.high>0)
        .sort((a,b)=>a.date.localeCompare(b.date))
    );
  }
  const histNames=HIST_NAMES[sym]||[sym];
  const symSet=new Set(histNames);
  const rows=getSrc1().filter(r=>symSet.has(r.Symbol)).map(r=>({date:r.Date.trim(),open:parseFloat(r.Open||0),high:parseFloat(r.High||0),low:parseFloat(r.Low||0),close:parseFloat(r.Close||0)})).filter(r=>r.date&&r.high>0);
  const rawPath=path.join(RAW_DIR,`${sym}.csv`);
  if (fs.existsSync(rawPath)) {
    const existing=new Set(rows.map(r=>r.date));
    parseCSV(fs.readFileSync(rawPath,'utf8')).map(r=>({date:(r.Date||r.date||'').trim(),open:parseFloat(r.Open||r.open||0),high:parseFloat(r.High||r.high||0),low:parseFloat(r.Low||r.low||0),close:parseFloat(r.Close||r.close||0)})).filter(r=>r.date&&r.high>0&&!existing.has(r.date)).forEach(r=>rows.push(r));
  }
  return cleanOHLC(rows.filter(r=>r.date>='2000-01-01').sort((a,b)=>a.date.localeCompare(b.date)));
}

// ── Raw daily (bhavcopy) — matches Kite intraday prices ──────────────
function loadRawOHLC(sym) {
  const rawPath = path.join(RAW_DIR,`${sym}.csv`);
  if (!fs.existsSync(rawPath)) return [];
  return parseCSV(fs.readFileSync(rawPath,'utf8'))
    .map(r=>({date:(r.Date||r.date||'').trim(),high:parseFloat(r.High||r.high||0),low:parseFloat(r.Low||r.low||0),close:parseFloat(r.Close||r.close||0)}))
    .filter(r=>r.date&&r.high>0)
    .sort((a,b)=>a.date.localeCompare(b.date));
}

// ── 60-min intraday (Kite, raw prices) ───────────────────────────────
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
  const pivots=[];
  if (!rows.length) return pivots;
  let trend=null,lhP=rows[0].high,lhD=rows[0].date,lhI=0,llP=rows[0].low,llD=rows[0].date,llI=0;
  for (let i=1;i<rows.length;i++) {
    const {date,high,low}=rows[i];
    if (trend===null||trend==='UP') {
      if (high>=lhP){lhP=high;lhD=date;lhI=i;}
      if (low<=lhP*(1-DEV/100)&&(i-lhI)>=DEP) {
        pivots.push({date:lhD,type:'H',price:lhP});
        trend='DOWN'; llP=low; llD=date; llI=i;
        for (let j=lhI+1;j<=i;j++){if(rows[j].low<llP){llP=rows[j].low;llD=rows[j].date;llI=j;}}
      }
    }
    if (trend==='DOWN') {
      if (low<=llP){llP=low;llD=date;llI=i;}
      if (high>=llP*(1+DEV/100)&&(i-llI)>=DEP) {
        pivots.push({date:llD,type:'L',price:llP});
        trend='UP'; lhP=high; lhD=date; lhI=i;
        for (let j=llI+1;j<=i;j++){if(rows[j].high>lhP){lhP=rows[j].high;lhD=rows[j].date;lhI=j;}}
      }
    }
  }
  if (trend==='UP') pivots.push({date:lhD,type:'H',price:lhP});
  else if (trend==='DOWN') pivots.push({date:llD,type:'L',price:llP});
  return pivots;
}

function buildMatrix(pivots) {
  const m={};
  pivots.forEach(({date,type})=>{
    const yr=+date.substring(0,4), mi=+date.substring(5,7)-1, dd=date.substring(8,10);
    if (!m[yr]) m[yr]=Array.from({length:12},()=>[]);
    m[yr][mi].push({day:dd,type});
  });
  return m;
}

function getConfluence(matrix, analysisYear, monthIdx) {
  const freq={};
  GAPS.map(g=>analysisYear-g).forEach(yr=>{
    const yd=matrix[yr]; if (!yd||!yd[monthIdx]) return;
    yd[monthIdx].forEach(({day,type})=>{ if (!freq[day]) freq[day]=[]; freq[day].push({year:yr,type}); });
  });
  const result={};
  for (const [day,arr] of Object.entries(freq)) { if (arr.length>=2) result[day]=arr; }
  return result;
}

// ── Core: simulate one LONG trade for all targets in one pass ─────────
// r1 : fixed exit at 1R (unchanged)
// r2 : trailing SL — 1R→BE, 2R→lock 1.5R; exit when SL hit
// r3 : trailing SL — 1R→BE, 2R→lock 1.5R, 3R→lock 2R; exit when SL hit
function simulateLong(rawOhlcArr, rawDateIdx, rawDateMap, intradayByDate, refDate, targets) {
  const rawRef = rawDateMap[refDate];
  if (!rawRef || rawRef.high<=rawRef.low || rawRef.high<=0) return null;

  const ep   = rawRef.high;
  const sl0  = rawRef.low;
  const risk = ep - sl0;
  if (risk <= 0) return null;

  const refRawIdx = rawDateIdx[refDate];
  if (refRawIdx===undefined || refRawIdx>=rawOhlcArr.length-1) return null;

  const entryDate    = rawOhlcArr[refRawIdx+1].date;
  const entryCandles = intradayByDate[entryDate] || [];

  let entryTime=null, trigIdx=-1;
  for (let ci=0; ci<entryCandles.length; ci++) {
    if (entryCandles[ci].close > ep) { entryTime=entryCandles[ci].time; trigIdx=ci; break; }
  }
  if (!entryTime) return null;

  const results = {};
  let sharedMaxFav = 0;

  for (const targetR of targets) {
    const isTrailing = targetR > 1; // r2/r3 use multi-level trailing; r1 is fixed exit
    const fixedTarget = ep + targetR * risk; // used only for r1

    let currentSL  = sl0;
    let trailLevel = 0; // 0=original SL, 1=BE, 2=locked 1.5R, 3=locked 2R
    let outcome    = 'open';
    let exitPrice  = 0;
    let exitDate   = '';
    let exitTime   = '';
    let barsHeld   = 0;
    let maxFav     = 0;
    let done       = false;

    function advanceTrail(high) {
      if (trailLevel < 1 && high >= ep + risk)       { trailLevel=1; currentSL=ep; }
      if (trailLevel < 2 && high >= ep + 2*risk)     { trailLevel=2; currentSL=ep + 1.5*risk; }
      if (targetR>=3 && trailLevel < 3 && high >= ep + 3*risk) { trailLevel=3; currentSL=ep + 2*risk; }
    }

    function slOutcome() {
      if (trailLevel===0) return 'SL';
      if (trailLevel===1) return 'BE';
      return 'TRAIL'; // positive exit locked via trailing SL
    }

    function tick(c, date) {
      const fav = c.high - ep;
      if (fav > maxFav) maxFav = fav;

      if (isTrailing) {
        advanceTrail(c.high);
        if (c.low <= currentSL) {
          outcome=slOutcome(); exitPrice=currentSL;
          exitDate=date; exitTime=c.time; done=true;
        }
      } else {
        // r1: fixed target with same-candle conflict check
        if (trailLevel<1 && c.high >= ep+risk) { trailLevel=1; currentSL=ep; }
        if (c.high >= fixedTarget) {
          if (c.low <= currentSL && c.open < currentSL) {
            outcome=trailLevel>=1?'BE':'SL'; exitPrice=currentSL;
          } else {
            outcome='TARGET'; exitPrice=fixedTarget;
          }
          exitDate=date; exitTime=c.time; done=true; return;
        }
        if (c.low <= currentSL) {
          outcome=trailLevel>=1?'BE':'SL'; exitPrice=currentSL;
          exitDate=date; exitTime=c.time; done=true;
        }
      }
    }

    for (let ci=trigIdx; ci<entryCandles.length && !done; ci++) tick(entryCandles[ci], entryDate);

    if (!done) {
      barsHeld = 1;
      for (let di=refRawIdx+2; di<rawOhlcArr.length && !done; di++) {
        const dayRow  = rawOhlcArr[di];
        const date    = dayRow.date;
        const candles = intradayByDate[date] || [];
        barsHeld++;
        if (candles.length) {
          for (const c of candles) { if (!done) tick(c, date); }
        } else {
          const fav = dayRow.high - ep;
          if (fav > maxFav) maxFav = fav;
          if (isTrailing) {
            advanceTrail(dayRow.high);
            if (dayRow.low <= currentSL) {
              outcome=slOutcome(); exitPrice=currentSL; exitDate=date; exitTime='EOD'; done=true;
            }
          } else {
            if (trailLevel<1 && dayRow.high >= ep+risk) { trailLevel=1; currentSL=ep; }
            if (dayRow.high >= fixedTarget) {
              outcome='TARGET'; exitPrice=fixedTarget; exitDate=date; exitTime='EOD'; done=true;
            } else if (dayRow.low <= currentSL) {
              outcome=trailLevel>=1?'BE':'SL'; exitPrice=currentSL; exitDate=date; exitTime='EOD'; done=true;
            }
          }
        }
      }
    }

    if (!done) {
      const last = rawOhlcArr[rawOhlcArr.length-1];
      exitDate  = last.date;
      exitPrice = last.close || ep;
      outcome   = 'open';
    }

    const pnl    = exitPrice - ep;
    const pnlPct = (pnl / ep * 100);
    const rMult  = pnl / risk;
    if (maxFav > sharedMaxFav) sharedMaxFav = maxFav;

    results[`r${targetR}`] = {
      target:    isTrailing ? null : +fixedTarget.toFixed(2),
      outcome, exitDate, exitTime,
      exitPrice: +exitPrice.toFixed(2),
      trailLevel, barsHeld,
      pnlPct:    +pnlPct.toFixed(2),
      rMult:     +rMult.toFixed(2),
      maxFavPct: +(maxFav/ep*100).toFixed(2),
    };
  }

  return { ep:+ep.toFixed(2), sl:+sl0.toFixed(2), risk:+risk.toFixed(2),
           entryDate, entryTime, maxFavPct:+(sharedMaxFav/ep*100).toFixed(2), ...results };
}

// ── Backtest one symbol ────────────────────────────────────────────────
function backtestSym(sym, verbose=false) {
  const adjOHLC   = loadAdjOHLC(sym);
  const rawOHLC   = loadRawOHLC(sym);
  if (!adjOHLC.length || !rawOHLC.length) return [];

  const rawDateMap = {};
  rawOHLC.forEach(r => { rawDateMap[r.date]=r; });
  const rawDateIdx = {};
  rawOHLC.forEach((r,i) => { rawDateIdx[r.date]=i; });
  const lastRawDate = rawOHLC[rawOHLC.length-1].date;
  const liveCutoff = (() => {
    const d = new Date(lastRawDate); d.setDate(d.getDate()-180); return d.toISOString().slice(0,10);
  })();

  const intradayByDate = loadIntradayByDate(sym);
  const pivots = computeZigZag(adjOHLC);
  const matrix = buildMatrix(pivots);

  const trades = [];

  for (const analysisYear of ANALYSIS_YEARS) {
    for (let mi=0; mi<12; mi++) {
      const conf = getConfluence(matrix, analysisYear, mi);

      for (const [day, arr] of Object.entries(conf)) {
        const mm  = String(mi+1).padStart(2,'0');
        if (parseInt(day) > new Date(analysisYear, mi+1, 0).getDate()) continue;
        const confDate = `${analysisYear}-${mm}-${day}`;

        // Ref bar: confDate if trading day, else next in rawOHLC within same month
        let refDate = rawDateMap[confDate] ? confDate : null;
        if (!refDate) {
          const nd = rawOHLC.find(r => r.date > confDate && r.date <= `${analysisYear}-${mm}-31`);
          refDate = nd?.date || null;
        }
        if (!refDate) continue;

        const sim = simulateLong(rawOHLC, rawDateIdx, rawDateMap, intradayByDate, refDate, TARGETS);
        if (!sim) continue;

        const hasH = arr.some(e=>e.type==='H'), hasL = arr.some(e=>e.type==='L');
        const cfType = (hasH&&hasL)?'HL':hasH?'H':'L';
        const isLive = TARGETS.some(t => sim[`r${t}`]?.outcome === 'open') && sim.entryDate >= liveCutoff;

        if (verbose) {
          console.log(`\n  ${confDate} (${cfType}×${arr.length}) ref:${refDate} entry:${sim.entryDate} ${sim.entryTime}`);
          TARGETS.forEach(t => {
            const r = sim[`r${t}`];
            console.log(`    ${t}R → ${r.outcome} on ${r.exitDate} @ ${r.exitPrice}  R=${r.rMult}`);
          });
        }

        trades.push({
          sym, analysisYear, month: MONTH_NAMES[mi], confDate, cfType,
          cfCount: arr.length, cfYears: arr.map(e=>`${e.year}${e.type}`).join('|'),
          refDate, ...sim, live: isLive ? 'Y' : 'N',
        });
      }
    }
  }

  return trades;
}

// ── Stats helper ──────────────────────────────────────────────────────
function calcStats(trades, rKey) {
  const closed = trades.filter(t => t[rKey]?.outcome !== 'open');
  if (!closed.length) return { n:0 };
  const wins  = closed.filter(t => ['TARGET','TRAIL'].includes(t[rKey].outcome)).length;
  const bes   = closed.filter(t => t[rKey].outcome==='BE').length;
  const sls   = closed.filter(t => t[rKey].outcome==='SL').length;
  const avgR  = closed.reduce((s,t)=>s+t[rKey].rMult, 0) / closed.length;
  const ev    = avgR; // actual captured R per trade
  return { n:closed.length, open:trades.length-closed.length, wins, bes, sls,
           wr:wins/closed.length, avgR, ev };
}

// ── Calmar ratio ─────────────────────────────────────────────────────
// Annual R / Max drawdown in R (cumulative R peak-to-trough)
function calmar(trades, rKey) {
  const closed = [...trades.filter(t => t[rKey]?.outcome !== 'open')]
    .sort((a,b) => a.entryDate.localeCompare(b.entryDate));
  if (closed.length < 5) return null;

  let cumR = 0, peak = 0, maxDD = 0;
  for (const t of closed) {
    cumR += t[rKey].rMult;
    if (cumR > peak) peak = cumR;
    const dd = peak - cumR;
    if (dd > maxDD) maxDD = dd;
  }
  if (maxDD === 0) return null;

  const t0 = new Date(closed[0].entryDate);
  const t1 = new Date(closed[closed.length-1].entryDate);
  const years = Math.max((t1-t0) / (365.25*24*3600*1000), 0.5);
  const totalR = closed.reduce((s,t) => s+t[rKey].rMult, 0);
  return (totalR / years) / maxDD;
}

// ── HTML report ───────────────────────────────────────────────────────
function buildHTML(allTrades, label='All 74 symbols') {
  const hist    = allTrades.filter(t => t.live==='N');
  const selHist = hist.filter(t => SELECTED_SYMS.includes(t.sym));

  function cls(v) { return v>0?'pos':v<0?'neg':'neu'; }
  function r(v)   { return `${v>0?'+':''}${v.toFixed(2)}R`; }
  function outBadge(o) {
    if (o==='TARGET') return `<span class="badge target">TARGET</span>`;
    if (o==='TRAIL')  return `<span class="badge trail">TRAIL</span>`;
    if (o==='BE')     return `<span class="badge be">BE</span>`;
    if (o==='SL')     return `<span class="badge sl">SL</span>`;
    return `<span class="badge open">OPEN</span>`;
  }

  // ── Aggregate stats (all) ──
  const agg1 = calcStats(hist, 'r1'), agg2 = calcStats(hist, 'r2'), agg3 = calcStats(hist, 'r3');
  const dur1 = durationStats(hist, 'r1'), dur2 = durationStats(hist, 'r2'), dur3 = durationStats(hist, 'r3');

  // ── Aggregate stats (selected) ──
  const sagg1 = calcStats(selHist, 'r1'), sagg2 = calcStats(selHist, 'r2'), sagg3 = calcStats(selHist, 'r3');
  const sdur1 = durationStats(selHist, 'r1'), sdur2 = durationStats(selHist, 'r2'), sdur3 = durationStats(selHist, 'r3');

  function statBox(s, dur, lbl, isTrailing=false) {
    if (!s.n) return `<div class="stat-box"><div class="lbl">${lbl}</div>No data</div>`;
    const winLabel = isTrailing ? 'TRAIL' : 'TARGET';
    return `<div class="stat-box">
  <div class="lbl">${lbl}</div>
  <b>${s.n}</b> trades &nbsp;|&nbsp;
  ${winLabel}: <b class="pos">${s.wins}</b> (${(s.wr*100).toFixed(1)}%) &nbsp;|&nbsp;
  BE: <b class="neu">${s.bes}</b> &nbsp;|&nbsp;
  SL: <b class="neg">${s.sls}</b> &nbsp;|&nbsp;
  EV/trade: <b class="${cls(s.ev)}">${s.ev.toFixed(2)}R</b>
  ${s.open ? `&nbsp;|&nbsp; Open: <b>${s.open}</b>` : ''}
  &nbsp;|&nbsp; avgDays: <b>${dur?.avgDays??'—'}</b>
  &nbsp;|&nbsp; avgOpen: <b>${dur?.avgConcurrent??'—'}</b> (max&nbsp;${dur?.maxConcurrent??'—'})
</div>`;
  }

  // ── Per-symbol table builder ──
  function buildSymRows(trades) {
    const map = {};
    trades.forEach(t => { if (!map[t.sym]) map[t.sym]=[]; map[t.sym].push(t); });
    return Object.entries(map).map(([sym, ts]) => {
      const s1=calcStats(ts,'r1'), s2=calcStats(ts,'r2'), s3=calcStats(ts,'r3');
      const cal = calmar(ts,'r1');
      const calStr = cal==null ? '—' : cal.toFixed(2);
      const calCls = cal==null ? 'neu' : cal>=1?'pos':cal>=0?'neu':'neg';
      return `<tr>
  <td class="sym">${sym}</td>
  <td>${s1.n||0}</td>
  <td class="col-1r ${cls((s1.wr||0)-0.6)}">${((s1.wr||0)*100).toFixed(0)}%</td>
  <td class="col-1r ${cls(s1.ev||0)}">${(s1.ev||0).toFixed(2)}R</td>
  <td class="col-1r ${calCls}"><b>${calStr}</b></td>
  <td class="col-2r ${cls((s2.wr||0)-0.3)}">${((s2.wr||0)*100).toFixed(0)}%</td>
  <td class="col-2r ${cls(s2.ev||0)}">${(s2.ev||0).toFixed(2)}R</td>
  <td class="col-3r ${cls((s3.wr||0)-0.25)}">${((s3.wr||0)*100).toFixed(0)}%</td>
  <td class="col-3r ${cls(s3.ev||0)}">${(s3.ev||0).toFixed(2)}R</td>
</tr>`;
    }).sort((a,b)=>{
      // sort by Calmar descending — re-extract cal from rendered row not ideal; sort source data instead
      return 0;
    }).join('');
  }

  // Build sym rows properly (sorted by Calmar)
  function buildSymRowsSorted(trades) {
    const map = {};
    trades.forEach(t => { if (!map[t.sym]) map[t.sym]=[]; map[t.sym].push(t); });
    return Object.entries(map).map(([sym, ts]) => {
      const s1=calcStats(ts,'r1'), s2=calcStats(ts,'r2'), s3=calcStats(ts,'r3');
      const cal = calmar(ts,'r1');
      return { sym, s1, s2, s3, cal };
    }).sort((a,b)=>(b.cal??-99)-(a.cal??-99))
    .map(({sym,s1,s2,s3,cal}) => {
      const calStr = cal==null ? '—' : cal.toFixed(2);
      const calCls = cal==null ? 'neu' : cal>=1?'pos':cal>=0?'neu':'neg';
      return `<tr>
  <td class="sym">${sym}</td>
  <td>${s1.n||0}</td>
  <td class="col-1r ${cls((s1.wr||0)-0.6)}">${((s1.wr||0)*100).toFixed(0)}%</td>
  <td class="col-1r ${cls(s1.ev||0)}">${(s1.ev||0).toFixed(2)}R</td>
  <td class="col-1r ${calCls}"><b>${calStr}</b></td>
  <td class="col-2r ${cls((s2.wr||0)-0.3)}">${((s2.wr||0)*100).toFixed(0)}%</td>
  <td class="col-2r ${cls(s2.ev||0)}">${(s2.ev||0).toFixed(2)}R</td>
  <td class="col-3r ${cls((s3.wr||0)-0.25)}">${((s3.wr||0)*100).toFixed(0)}%</td>
  <td class="col-3r ${cls(s3.ev||0)}">${(s3.ev||0).toFixed(2)}R</td>
</tr>`;
    }).join('');
  }

  const symRows    = buildSymRowsSorted(hist);
  const selSymRows = buildSymRowsSorted(selHist);

  // ── Trade row builder ──
  function buildTradeRows(trades) {
    return trades.map(t => {
      const r1=t.r1||{}, r2=t.r2||{}, r3=t.r3||{};
      return `<tr>
  <td class="sym">${t.sym}</td>
  <td>${t.analysisYear}</td>
  <td>${t.month} ${t.confDate.substring(8)}</td>
  <td>${t.cfType}</td>
  <td>${t.cfCount}</td>
  <td>${t.refDate}</td>
  <td>${t.entryDate}</td>
  <td style="color:var(--sub)">${t.entryTime}</td>
  <td>${t.ep}</td>
  <td>${t.sl}</td>
  <td class="pos">${t.risk}</td>
  <td class="col-1r">${outBadge(r1.outcome)} ${r1.exitDate||''}</td>
  <td class="col-1r ${cls(r1.rMult||0)}">${r(r1.rMult||0)}</td>
  <td class="col-2r">${outBadge(r2.outcome)} ${r2.exitDate||''}</td>
  <td class="col-2r ${cls(r2.rMult||0)}">${r(r2.rMult||0)}</td>
  <td class="col-3r">${outBadge(r3.outcome)} ${r3.exitDate||''}</td>
  <td class="col-3r ${cls(r3.rMult||0)}">${r(r3.rMult||0)}</td>
  <td>${t.maxFavPct}%</td>
</tr>`;
    }).join('');
  }

  const tradeRows    = buildTradeRows(hist);
  const selTradeRows = buildTradeRows(selHist);

  // ── Live signal row builder ──
  function buildLiveRows(trades) {
    return trades.map(t => `<tr>
  <td class="sym">${t.sym}</td>
  <td>${t.analysisYear}</td>
  <td>${t.month} ${t.confDate.substring(8)}</td>
  <td>${t.cfType} ×${t.cfCount}</td>
  <td>${t.refDate}</td>
  <td>${t.entryDate} ${t.entryTime}</td>
  <td>${t.ep}</td>
  <td>${t.sl}</td>
  <td class="pos col-1r">${(t.r1?.target||'').toFixed?.(2)||''}</td>
  <td class="pos col-2r">${(t.r2?.target||'').toFixed?.(2)||''}</td>
  <td class="pos col-3r">${(t.r3?.target||'').toFixed?.(2)||''}</td>
  <td class="col-1r">${t.r1?.outcome||''} ${t.r1?.exitDate||''}</td>
  <td class="col-2r">${t.r2?.outcome||''} ${t.r2?.exitDate||''}</td>
  <td class="col-3r">${t.r3?.outcome||''} ${t.r3?.exitDate||''}</td>
</tr>`).join('');
  }

  const live         = allTrades.filter(t=>t.live==='Y');
  const liveSel      = live.filter(t=>SELECTED_SYMS.includes(t.sym));
  const liveRows     = buildLiveRows(live);
  const liveSelRows  = buildLiveRows(liveSel);

  const liveTheadHTML = `<thead><tr>
  <th>Symbol</th><th>Year</th><th>CF Date</th><th>Type</th><th>Ref Bar</th>
  <th>Entry</th><th>Entry ₹</th><th>SL ₹</th>
  <th class="col-1r">1R Target</th><th class="col-2r">2R Target</th><th class="col-3r">3R Target</th>
  <th class="col-1r">1R Status</th><th class="col-2r">2R Status</th><th class="col-3r">3R Status</th>
</tr></thead>`;

  const tradeTheadHTML = `<thead><tr>
  <th>Sym</th><th>Yr</th><th>CF Date</th><th>Type</th><th>CF#</th>
  <th>Ref Bar</th><th>Entry Bar</th><th>Time</th><th>Entry ₹</th><th>SL ₹</th><th>Risk</th>
  <th class="col-1r">1R Exit</th><th class="col-1r">1R R</th>
  <th class="col-2r">2R Exit</th><th class="col-2r">2R R</th>
  <th class="col-3r">3R Exit</th><th class="col-3r">3R R</th>
  <th>Max Fav%</th>
</tr></thead>`;

  const symTheadHTML = `<thead><tr>
  <th>Symbol</th><th>Trades</th>
  <th class="col-1r">1R WR</th><th class="col-1r">1R EV</th><th class="col-1r">Calmar (1R)</th>
  <th class="col-2r">2R WR</th><th class="col-2r">2R EV</th>
  <th class="col-3r">3R WR</th><th class="col-3r">3R EV</th>
</tr></thead>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Gann Confluence — Long Backtest (Refined)</title>
<style>
  :root { --bg:#0d1117; --panel:#161b22; --border:#30363d; --accent:#58a6ff;
          --green:#3fb950; --red:#f85149; --orange:#e3b341; --text:#c9d1d9; --sub:#8b949e; }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { background:var(--bg); color:var(--text); font-family:'Segoe UI',system-ui,sans-serif; font-size:12px; }
  h1 { color:var(--accent); font-size:18px; padding:20px 24px 6px; }
  h2 { color:var(--accent); font-size:13px; padding:14px 24px 8px; border-top:1px solid var(--border); margin-top:8px; }
  .meta { color:var(--sub); padding:0 24px 10px; font-size:11px; }
  .stat-row { display:flex; gap:12px; padding:0 24px 16px; flex-wrap:wrap; }
  .stat-box { background:var(--panel); border:1px solid var(--border); border-radius:6px; padding:10px 16px; font-size:12px; flex:1; min-width:300px; }
  .stat-box .lbl { color:var(--sub); font-size:10px; text-transform:uppercase; margin-bottom:4px; }
  .wrap { padding:0 24px 24px; overflow-x:auto; }
  table { border-collapse:collapse; width:100%; }
  th { background:#1c2128; color:var(--sub); font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.4px; padding:7px 8px; border:1px solid var(--border); text-align:left; white-space:nowrap; position:sticky; top:48px; }
  td { border:1px solid var(--border); padding:4px 8px; vertical-align:middle; white-space:nowrap; }
  tr:hover td { background:#1a2130; }
  .sym { font-weight:700; color:var(--accent); }
  .pos { color:var(--green); font-weight:600; }
  .neg { color:var(--red); font-weight:600; }
  .neu { color:var(--sub); }
  .badge { border-radius:3px; padding:1px 5px; font-size:10px; font-weight:700; display:inline-block; }
  .badge.target { background:#0d2818; color:var(--green); border:1px solid #1a4a28; }
  .badge.trail  { background:#1a2810; color:#7fff7f; border:1px solid #2a5a18; }
  .badge.be     { background:#1a1a2d; color:#8b8bff; border:1px solid #2a2a5d; }
  .badge.sl     { background:#2d1010; color:var(--red); border:1px solid #4a1a1a; }
  .badge.open   { background:#2d2010; color:var(--orange); border:1px solid #6a4a10; }
  input[type=text] { background:var(--bg); border:1px solid var(--border); color:var(--text); padding:4px 8px; border-radius:4px; font-size:11px; width:200px; }
  .col-1r { background:#1a150d; }
  .col-2r { background:#0d1a10; }
  .col-3r { background:#0d100d; }
  /* Tabs */
  .tab-nav { display:flex; gap:4px; padding:8px 24px 0; border-bottom:1px solid var(--border); position:sticky; top:0; background:var(--bg); z-index:10; }
  .tab-btn { background:none; border:1px solid transparent; border-bottom:none; color:var(--sub); padding:7px 18px; font-size:12px; cursor:pointer; border-radius:6px 6px 0 0; font-family:inherit; }
  .tab-btn:hover { color:var(--text); background:var(--panel); }
  .tab-btn.active { background:var(--panel); border-color:var(--border); color:var(--accent); font-weight:700; }
  .tab-panel { display:none; }
  .tab-panel.active { display:block; }
  /* Portfolio */
  .port-stats { display:flex; gap:10px; padding:12px 24px 16px; flex-wrap:wrap; }
  .ps { background:var(--panel); border:1px solid var(--border); border-radius:6px; padding:10px 16px; min-width:120px; }
  .ps-l { color:var(--sub); font-size:10px; text-transform:uppercase; letter-spacing:.4px; margin-bottom:4px; }
  .ps-v { font-size:17px; font-weight:700; }
</style>
</head>
<body>
<h1>Gann Confluence — LONG Backtest (Refined)</h1>

<div class="tab-nav">
  <button class="tab-btn active" onclick="showTab('all',this)">All 74 Symbols</button>
  <button class="tab-btn" onclick="showTab('sel',this)">15 Selected Stocks</button>
</div>

<!-- ═══════════════════════ TAB 1: ALL 74 SYMBOLS ═══════════════════════ -->
<div id="tab-all" class="tab-panel active">
<div class="meta" style="padding-top:10px">
  Entry: hourly close &gt; ref High &nbsp;|&nbsp; SL: ref Low &nbsp;|&nbsp;
  Trailing: SL → BE after 1R &nbsp;|&nbsp; No time exit &nbsp;|&nbsp;
  ZigZag dev=4% dep=10 &nbsp;|&nbsp; cfCount ≥ 2 &nbsp;|&nbsp; ${label}
</div>

<div class="stat-row">
  ${statBox(agg1,dur1,'1R Fixed Exit',false)}
  ${statBox(agg2,dur2,'2R Trailing (lock 1.5R at 2R)',true)}
  ${statBox(agg3,dur3,'3R Trailing (lock 1.5R→2R)',true)}
</div>

${buildPortfolioSection(allTrades, 'All 74 Symbols', 'eqg1')}

${live.length ? `
<h2>Live / Open Signals (${live.length})</h2>
<div class="wrap"><table>${liveTheadHTML}<tbody>${liveRows}</tbody></table></div>` : ''}

<h2>Per-Symbol Summary — All 74 (historical, sorted by Calmar)</h2>
<div class="wrap"><table>${symTheadHTML}<tbody>${symRows}</tbody></table></div>

<h2>All Historical Trades</h2>
<div class="wrap">
<p style="color:var(--sub);font-size:11px;margin-bottom:8px;">Filter: <input type="text" id="tf" placeholder="symbol / date / outcome…" oninput="fltAll(this.value)"></p>
<table id="tt">${tradeTheadHTML}<tbody>${tradeRows}</tbody></table>
</div>
</div>

<!-- ═══════════════════════ TAB 2: 15 SELECTED ═══════════════════════════ -->
<div id="tab-sel" class="tab-panel">
<div class="meta" style="padding-top:10px">
  15 Selected Stocks &nbsp;|&nbsp; Ranked by Calmar ratio on 1R &nbsp;|&nbsp;
  ZigZag dev=4% dep=10 &nbsp;|&nbsp; cfCount ≥ 2 &nbsp;|&nbsp; Fixed position size ₹16K/trade
</div>

<div class="stat-row">
  ${statBox(sagg1,sdur1,'1R Fixed Exit — 15 Selected',false)}
  ${statBox(sagg2,sdur2,'2R Trailing — 15 Selected',true)}
  ${statBox(sagg3,sdur3,'3R Trailing — 15 Selected',true)}
</div>

${buildPortfolioSection(allTrades.filter(t=>SELECTED_SYMS.includes(t.sym)), '15 Selected Stocks', 'eqg2')}

${liveSel.length ? `
<h2>Live / Open Signals — 15 Selected (${liveSel.length})</h2>
<div class="wrap"><table>${liveTheadHTML}<tbody>${liveSelRows}</tbody></table></div>` : ''}

<h2>Per-Symbol Summary — 15 Selected (sorted by Calmar)</h2>
<div class="wrap"><table>${symTheadHTML}<tbody>${selSymRows}</tbody></table></div>

<h2>Historical Trades — 15 Selected</h2>
<div class="wrap">
<p style="color:var(--sub);font-size:11px;margin-bottom:8px;">Filter: <input type="text" id="sf" placeholder="symbol / date / outcome…" oninput="fltSel(this.value)"></p>
<table id="ts">${tradeTheadHTML}<tbody>${selTradeRows}</tbody></table>
</div>
</div>

<script>
function showTab(id, btn) {
  document.querySelectorAll('.tab-panel').forEach(p => { p.classList.remove('active'); });
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-'+id).classList.add('active');
  btn.classList.add('active');
}
function fltAll(v){const lv=v.toLowerCase();document.querySelectorAll('#tt tbody tr').forEach(r=>{r.style.display=r.textContent.toLowerCase().includes(lv)?'':'none';});}
function fltSel(v){const lv=v.toLowerCase();document.querySelectorAll('#ts tbody tr').forEach(r=>{r.style.display=r.textContent.toLowerCase().includes(lv)?'':'none';});}
</script>
</body></html>`;
}

// ── Duration & concurrency stats ─────────────────────────────────────
function durationStats(trades, rKey) {
  const closed = trades.filter(t => t[rKey]?.outcome !== 'open' && t[rKey]?.exitDate);
  if (!closed.length) return null;

  // Average bars held
  const avgBars = closed.reduce((s,t) => s + (t[rKey].barsHeld||0), 0) / closed.length;

  // Average calendar days (entry → exit)
  const avgDays = closed.reduce((s,t) => {
    const d = (new Date(t[rKey].exitDate) - new Date(t.entryDate)) / 86400000;
    return s + d;
  }, 0) / closed.length;

  // Time-weighted average concurrent positions (sweep-line)
  // +1 on entryDate, -1 on day after exitDate
  const events = [];
  closed.forEach(t => {
    events.push({ date: t.entryDate, d: +1 });
    const ex = new Date(t[rKey].exitDate);
    ex.setDate(ex.getDate() + 1);
    events.push({ date: ex.toISOString().slice(0,10), d: -1 });
  });
  events.sort((a,b) => a.date < b.date ? -1 : 1);

  let active=0, wSum=0, totalDays=0, maxActive=0, prev=null;
  for (const ev of events) {
    if (prev && ev.date > prev) {
      const span = (new Date(ev.date) - new Date(prev)) / 86400000;
      wSum += active * span;
      totalDays += span;
    }
    active += ev.d;
    if (active > maxActive) maxActive = active;
    prev = ev.date;
  }
  const avgConcurrent = totalDays > 0 ? wSum / totalDays : 0;

  return { avgBars: +avgBars.toFixed(1), avgDays: +avgDays.toFixed(1),
           avgConcurrent: +avgConcurrent.toFixed(2), maxConcurrent: maxActive };
}

// ── Portfolio simulation ──────────────────────────────────────────────
// Capital: ₹10L, fixed risk ₹16K/trade (= 1.6% of initial, no compounding), max 5 open, 1R exit
function simulatePortfolio(allTrades) {
  const INITIAL  = 1_000_000;
  const RISK_AMT = Math.round(INITIAL * 0.08 / 5);  // ₹16,000 fixed per trade
  const MAX_OPEN = 5;

  const hist = allTrades
    .filter(t => t.live==='N' && t.r1?.outcome !== 'open' && t.r1?.exitDate)
    .sort((a,b) => a.entryDate.localeCompare(b.entryDate) || a.sym.localeCompare(b.sym));
  if (!hist.length) return null;

  let cap = INITIAL;
  const active   = [];  // {exitDate, rMult}
  const eqPts    = [{ date: hist[0].entryDate, cap }];
  const yrData   = {};
  let totTaken = 0, totSkipped = 0;

  function flush(upToDate) {
    active.sort((a,b) => a.exitDate.localeCompare(b.exitDate));
    while (active.length && active[0].exitDate <= upToDate) {
      const t = active.shift();
      cap += t.rMult * RISK_AMT;
      eqPts.push({ date: t.exitDate, cap: Math.round(cap) });
      const yr = +t.exitDate.slice(0,4);
      if (!yrData[yr]) yrData[yr] = { taken:0, skipped:0, wins:0, losses:0, bes:0 };
      if (t.rMult > 0) yrData[yr].wins++;
      else if (t.rMult < 0) yrData[yr].losses++;
      else yrData[yr].bes++;
    }
  }

  for (const t of hist) {
    flush(t.entryDate);
    const yr = +t.entryDate.slice(0,4);
    if (!yrData[yr]) yrData[yr] = { taken:0, skipped:0, wins:0, losses:0, bes:0 };
    if (active.length >= MAX_OPEN) { yrData[yr].skipped++; totSkipped++; continue; }
    active.push({ exitDate: t.r1.exitDate, rMult: t.r1.rMult });
    yrData[yr].taken++; totTaken++;
  }
  [...active].sort((a,b)=>a.exitDate.localeCompare(b.exitDate)).forEach(t => {
    cap += t.rMult * RISK_AMT;
    eqPts.push({ date: t.exitDate, cap: Math.round(cap) });
  });

  // Sort & deduplicate
  eqPts.sort((a,b)=>a.date.localeCompare(b.date));
  const eq = [];
  for (const p of eqPts) {
    if (eq.length && eq[eq.length-1].date===p.date) eq[eq.length-1].cap=p.cap;
    else eq.push({...p});
  }

  // Max drawdown on running P&L from INITIAL
  let peak=INITIAL, maxDD=0;
  for (const p of eq) {
    if (p.cap>peak) peak=p.cap;
    const dd=(peak-p.cap)/peak*100;
    if (dd>maxDD) maxDD=dd;
  }

  // Year rows — return% expressed as % of initial capital (fixed sizing convention)
  const years = Object.keys(yrData).map(Number).sort();
  let prevCap = INITIAL;
  const yearRows = years.map(yr => {
    const pts = eq.filter(p=>p.date.startsWith(String(yr)));
    const endCap = pts.length ? pts[pts.length-1].cap : prevCap;
    const pnl = endCap - prevCap;
    const ret = pnl / INITIAL * 100;  // % of initial capital, not compounded
    const row = { yr, startCap:Math.round(prevCap), endCap, pnl:Math.round(pnl), ret:+ret.toFixed(1), ...yrData[yr] };
    prevCap = endCap;
    return row;
  });

  const totalRet = (cap - INITIAL) / INITIAL * 100;
  const dt = (new Date(eq[eq.length-1].date)-new Date(eq[0].date))/(365.25*864e5);
  // With fixed sizing, report simple annual return on initial capital instead of CAGR
  const annualR = totalRet / Math.max(dt, 0.5);

  return { eq, yearRows, annualR:+annualR.toFixed(1),
           finalCap:Math.round(cap), totalRet:+totalRet.toFixed(1),
           maxDD:+maxDD.toFixed(1), totTaken, totSkipped, INITIAL, RISK_AMT };
}

function buildPortfolioSection(allTrades, sectionLabel='All Symbols', gradId='eqg0') {
  const p = simulatePortfolio(allTrades);
  if (!p) return '';
  const { eq } = p;

  // ── SVG equity curve ──
  const W=860,H=240,PL=82,PR=20,PT=15,PB=38;
  const cw=W-PL-PR, ch=H-PT-PB;
  const ts=eq.map(e=>+new Date(e.date));
  const vs=eq.map(e=>e.cap);
  const t0=Math.min(...ts),t1=Math.max(...ts);
  const vSpan=Math.max(...vs)-Math.min(...vs);
  const v0=Math.min(...vs)-vSpan*0.08, v1=Math.max(...vs)+vSpan*0.08;
  const sx=t=>PL+(t-t0)/(t1-t0)*cw;
  const sy=v=>PT+ch-(v-v0)/(v1-v0)*ch;

  const pts=eq.map(e=>`${sx(+new Date(e.date)).toFixed(1)},${sy(e.cap).toFixed(1)}`).join(' ');
  const fx=sx(ts[0]).toFixed(1), lx=sx(ts[ts.length-1]).toFixed(1), by=(PT+ch).toFixed(1);

  let grid='';
  const y0=new Date(t0).getFullYear(), y1=new Date(t1).getFullYear();
  for(let y=y0+1;y<=y1;y++){
    const x=sx(+new Date(`${y}-01-01`));
    if(x>PL&&x<W-PR) grid+=
      `<line x1="${x.toFixed(1)}" y1="${PT}" x2="${x.toFixed(1)}" y2="${PT+ch}" stroke="#30363d" stroke-dasharray="3,3"/>` +
      `<text x="${x.toFixed(1)}" y="${PT+ch+20}" fill="#8b949e" font-size="11" text-anchor="middle">${y}</text>`;
  }
  let yAxis='';
  for(let i=0;i<=4;i++){
    const v=v0+i*(v1-v0)/4, yy=sy(v).toFixed(1);
    yAxis+=`<line x1="${PL}" y1="${yy}" x2="${W-PR}" y2="${yy}" stroke="#30363d" stroke-opacity=".5"/>` +
           `<text x="${PL-6}" y="${yy}" fill="#8b949e" font-size="10" text-anchor="end" dominant-baseline="middle">₹${(v/1e5).toFixed(1)}L</text>`;
  }

  const svg=`<div style="padding:0 24px 8px">
<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block;">
<defs><linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0%" stop-color="#58a6ff" stop-opacity=".22"/>
  <stop offset="100%" stop-color="#58a6ff" stop-opacity=".01"/>
</linearGradient></defs>
${yAxis}${grid}
<polygon points="${fx},${by} ${pts} ${lx},${by}" fill="url(#${gradId})"/>
<polyline points="${pts}" fill="none" stroke="#58a6ff" stroke-width="1.8" stroke-linejoin="round"/>
</svg></div>`;

  function fc(v){return `₹${(v/1e5).toFixed(2)}L`;}
  function fm(v){return `₹${Math.round(v/1000)}K`;}
  function rc(v){return v>0?'pos':v<0?'neg':'neu';}

  const stats=`<div class="port-stats">
  <div class="ps"><div class="ps-l">Initial Capital</div><div class="ps-v">${fc(p.INITIAL)}</div></div>
  <div class="ps"><div class="ps-l">Fixed Risk/Trade</div><div class="ps-v">${fm(p.RISK_AMT)}</div></div>
  <div class="ps"><div class="ps-l">Final Capital</div><div class="ps-v ${rc(p.finalCap-p.INITIAL)}">${fc(p.finalCap)}</div></div>
  <div class="ps"><div class="ps-l">Total Return</div><div class="ps-v ${rc(p.totalRet)}">${p.totalRet>0?'+':''}${p.totalRet}%</div></div>
  <div class="ps"><div class="ps-l">Avg Annual Return</div><div class="ps-v ${rc(p.annualR)}">${p.annualR>0?'+':''}${p.annualR}% / yr</div></div>
  <div class="ps"><div class="ps-l">Max Drawdown</div><div class="ps-v neg">-${p.maxDD}%</div></div>
  <div class="ps"><div class="ps-l">Trades Taken</div><div class="ps-v">${p.totTaken}</div></div>
  <div class="ps"><div class="ps-l">Skipped (cap full)</div><div class="ps-v neu">${p.totSkipped}</div></div>
</div>`;

  const tbl=`<table>
<thead><tr>
  <th>Year</th><th>Start ₹</th><th>End ₹</th><th>P&L</th><th>Return on ₹10L</th>
  <th>Taken</th><th>Skipped</th><th>Wins</th><th>BE</th><th>Losses</th>
</tr></thead>
<tbody>${p.yearRows.map(r=>`<tr>
  <td><b>${r.yr}</b></td>
  <td style="color:var(--sub)">${fc(r.startCap)}</td>
  <td class="${rc(r.pnl)}">${fc(r.endCap)}</td>
  <td class="${rc(r.pnl)}">${r.pnl>=0?'+':''}${fm(r.pnl)}</td>
  <td><b class="${rc(r.ret)}">${r.ret>0?'+':''}${r.ret}%</b></td>
  <td>${r.taken}</td><td class="neu">${r.skipped}</td>
  <td class="pos">${r.wins}</td><td class="neu">${r.bes}</td><td class="neg">${r.losses}</td>
</tr>`).join('')}</tbody>
</table>`;

  return `
<h2>Portfolio Simulation — ${sectionLabel} · ₹10L · ₹16K fixed/trade · Max 5 Open · 1R Exit</h2>
${stats}
${svg}
<div class="wrap" style="margin-top:8px">${tbl}</div>`;
}

// ── Sweep ────────────────────────────────────────────────────────────
const SWEEP_DEVS = [3, 4, 5, 6, 8, 10, 12];
const SWEEP_DEPS = [5, 10, 15];

function medianCalmar(trades, rKey) {
  const symMap = {};
  trades.forEach(t => { if (!symMap[t.sym]) symMap[t.sym]=[]; symMap[t.sym].push(t); });
  const vals = Object.values(symMap).map(ts => calmar(ts, rKey)).filter(c => c != null).sort((a,b)=>a-b);
  if (!vals.length) return null;
  return vals[Math.floor(vals.length / 2)];
}

function runSweep(syms) {
  const rows = [];
  const total = SWEEP_DEVS.length * SWEEP_DEPS.length;
  let done = 0;
  for (const dev of SWEEP_DEVS) {
    for (const dep of SWEEP_DEPS) {
      DEV = dev; DEP = dep;
      process.stdout.write(`  [${++done}/${total}] dev=${String(dev).padStart(2)}% dep=${dep}  `);
      const allTrades = [];
      for (const sym of syms) allTrades.push(...backtestSym(sym));
      const hist = allTrades.filter(t => t.live==='N');
      const s1=calcStats(hist,'r1'), s2=calcStats(hist,'r2'), s3=calcStats(hist,'r3');
      const cal1=calmar(hist,'r1'), cal2=calmar(hist,'r2'), cal3=calmar(hist,'r3');
      const med1=medianCalmar(hist,'r1'), med2=medianCalmar(hist,'r2'), med3=medianCalmar(hist,'r3');
      console.log(
        `n=${String(hist.length).padStart(4)}  ` +
        `1R:WR=${((s1.wr||0)*100).toFixed(0)}% EV=${(s1.ev||0).toFixed(2)} CAL=${cal1!=null?cal1.toFixed(2):'—'}  ` +
        `2R:WR=${((s2.wr||0)*100).toFixed(0)}% EV=${(s2.ev||0).toFixed(2)} CAL=${cal2!=null?cal2.toFixed(2):'—'}  ` +
        `3R:WR=${((s3.wr||0)*100).toFixed(0)}% EV=${(s3.ev||0).toFixed(2)} CAL=${cal3!=null?cal3.toFixed(2):'—'}`
      );
      rows.push({ dev, dep, n:hist.length, s1, s2, s3, cal1, cal2, cal3, med1, med2, med3 });
    }
  }
  rows.sort((a,b) => (b.cal1??-99) - (a.cal1??-99));

  const SWEEP_HTML = 'j:/GANN Claude/Backtest/backtest_sweep.html';
  fs.writeFileSync(SWEEP_HTML, buildSweepHTML(rows, syms.length), 'utf8');
  console.log(`\n  → HTML: ${SWEEP_HTML}`);
}

function buildSweepHTML(rows, nSyms) {
  function cls(v) { return v>0?'pos':v<0?'neg':'neu'; }
  function fmt(v, digits=2) { return v==null ? '—' : v.toFixed(digits); }
  function calCls(v) { return v==null?'neu':v>=2?'pos':v>=1?'neu':'neg'; }

  const thead = `<tr>
  <th>Dev%</th><th>Dep</th><th>Trades</th>
  <th class="col-1r">1R WR</th><th class="col-1r">1R EV</th>
  <th class="col-1r">1R Calmar</th><th class="col-1r">1R Med Cal</th>
  <th class="col-2r">2R WR</th><th class="col-2r">2R EV</th>
  <th class="col-2r">2R Calmar</th><th class="col-2r">2R Med Cal</th>
  <th class="col-3r">3R WR</th><th class="col-3r">3R EV</th>
  <th class="col-3r">3R Calmar</th><th class="col-3r">3R Med Cal</th>
</tr>`;

  const tbody = rows.map(r => `<tr>
  <td><b>${r.dev}%</b></td><td>${r.dep}</td><td>${r.n}</td>
  <td class="col-1r ${cls((r.s1.wr||0)-0.6)}">${((r.s1.wr||0)*100).toFixed(0)}%</td>
  <td class="col-1r ${cls(r.s1.ev||0)}">${fmt(r.s1.ev)}</td>
  <td class="col-1r ${calCls(r.cal1)}"><b>${fmt(r.cal1)}</b></td>
  <td class="col-1r ${calCls(r.med1)}">${fmt(r.med1)}</td>
  <td class="col-2r ${cls((r.s2.wr||0)-0.3)}">${((r.s2.wr||0)*100).toFixed(0)}%</td>
  <td class="col-2r ${cls(r.s2.ev||0)}">${fmt(r.s2.ev)}</td>
  <td class="col-2r ${calCls(r.cal2)}"><b>${fmt(r.cal2)}</b></td>
  <td class="col-2r ${calCls(r.med2)}">${fmt(r.med2)}</td>
  <td class="col-3r ${cls((r.s3.wr||0)-0.25)}">${((r.s3.wr||0)*100).toFixed(0)}%</td>
  <td class="col-3r ${cls(r.s3.ev||0)}">${fmt(r.s3.ev)}</td>
  <td class="col-3r ${calCls(r.cal3)}"><b>${fmt(r.cal3)}</b></td>
  <td class="col-3r ${calCls(r.med3)}">${fmt(r.med3)}</td>
</tr>`).join('');

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<title>Gann Confluence — ZigZag Sweep</title>
<style>
  :root{--bg:#0d1117;--panel:#161b22;--border:#30363d;--accent:#58a6ff;
        --green:#3fb950;--red:#f85149;--orange:#e3b341;--text:#c9d1d9;--sub:#8b949e;}
  *{box-sizing:border-box;margin:0;padding:0;}
  body{background:var(--bg);color:var(--text);font-family:'Segoe UI',system-ui,sans-serif;font-size:12px;}
  h1{color:var(--accent);font-size:18px;padding:20px 24px 6px;}
  .meta{color:var(--sub);padding:0 24px 14px;font-size:11px;}
  .wrap{padding:16px 24px 32px;overflow-x:auto;}
  table{border-collapse:collapse;width:100%;}
  th{background:#1c2128;color:var(--sub);font-size:10px;font-weight:700;text-transform:uppercase;
     letter-spacing:.4px;padding:7px 8px;border:1px solid var(--border);text-align:left;
     white-space:nowrap;position:sticky;top:0;}
  td{border:1px solid var(--border);padding:5px 9px;vertical-align:middle;white-space:nowrap;}
  tr:hover td{background:#1a2130;}
  .pos{color:var(--green);font-weight:600;}
  .neg{color:var(--red);font-weight:600;}
  .neu{color:var(--sub);}
  .col-1r{background:#1a150d;}
  .col-2r{background:#0d1a10;}
  .col-3r{background:#0d100d;}
</style></head><body>
<h1>Gann Confluence — ZigZag Parameter Sweep</h1>
<div class="meta">
  ${nSyms} symbols &nbsp;|&nbsp; Entry: hourly close &gt; ref High &nbsp;|&nbsp; SL: ref Low &nbsp;|&nbsp;
  Trailing: BE after 1R, lock 1.5R@2R, lock 2R@3R &nbsp;|&nbsp; cfCount ≥ 2 &nbsp;|&nbsp;
  Sorted by 1R Calmar ↓ &nbsp;|&nbsp; Med Cal = median per-symbol Calmar (≥5 trades)
</div>
<div class="wrap"><table>
<thead>${thead}</thead>
<tbody>${tbody}</tbody>
</table></div>
</body></html>`;
}

// ── Main ──────────────────────────────────────────────────────────────
function main() {
  const args     = process.argv.slice(2);
  const symArg   = args.find(a=>!a.startsWith('--'))?.toUpperCase();
  const selected = args.includes('--selected');
  const syms     = symArg ? [symArg] : selected ? SELECTED_SYMS : ALL_SYMS;

  if (args.includes('--sweep')) { runSweep(syms); return; }

  const devArg = args.find(a=>a.startsWith('--dev='));
  const depArg = args.find(a=>a.startsWith('--dep='));
  if (devArg) DEV = parseFloat(devArg.split('=')[1]);
  if (depArg) DEP = parseInt(depArg.split('=')[1]);
  if (devArg || depArg) {
    const tag = `dev${DEV}_dep${DEP}`;
    OUT_HTML = `j:/GANN Claude/Backtest/backtest_long_${tag}.html`;
    OUT_CSV  = `j:/GANN Claude/Backtest/backtest_long_${tag}.csv`;
  }

  console.log('═'.repeat(70));
  console.log('  Gann Confluence — Refined LONG Backtest');
  console.log(`  ZigZag dev=${DEV}%  dep=${DEP}  |  Entry: hourly close > ref High  |  SL: ref Low`);
  console.log('  Trailing: BE after 1R  |  Targets: 1R/2R/3R  |  No time exit');
  console.log('═'.repeat(70));

  const allTrades = [];

  for (const sym of syms) {
    process.stdout.write(`  ${sym.padEnd(14)} `);
    const trades = backtestSym(sym, !!symArg);
    allTrades.push(...trades);
    const hist = trades.filter(t=>t.live==='N');
    const live = trades.filter(t=>t.live==='Y');
    const s1 = calcStats(hist,'r1'), s2 = calcStats(hist,'r2'), s3 = calcStats(hist,'r3');
    const cal = calmar(hist,'r1');
    console.log(
      `${hist.length} hist  ${live.length} live  ` +
      `1R: WR=${((s1.wr||0)*100).toFixed(0)}% EV=${(s1.ev||0).toFixed(2)}R  CAL=${cal!=null?cal.toFixed(2):'—'}  ` +
      `2R: EV=${(s2.ev||0).toFixed(2)}R  3R: EV=${(s3.ev||0).toFixed(2)}R`
    );
  }

  const hist = allTrades.filter(t=>t.live==='N');
  const live = allTrades.filter(t=>t.live==='Y');
  console.log('─'.repeat(70));
  for (const tR of TARGETS) {
    const s = calcStats(hist, `r${tR}`);
    if (!s.n) continue;
    const dur = durationStats(hist, `r${tR}`);
    console.log(
      `  ${tR}R  ${s.n} trades  WR:${(s.wr*100).toFixed(1)}%  ` +
      `TARGET:${s.wins}  BE:${s.bes}  SL:${s.sls}  avgR:${s.avgR.toFixed(2)}  EV:${s.ev.toFixed(2)}R  ` +
      `avgBars:${dur?.avgBars}  avgDays:${dur?.avgDays}  avgOpen:${dur?.avgConcurrent}  maxOpen:${dur?.maxConcurrent}`
    );
  }
  if (live.length) {
    console.log(`\n  ── ${live.length} live/open signals ──`);
    live.forEach(t => {
      const r1=t.r1||{}, r2=t.r2||{}, r3=t.r3||{};
      console.log(`  ${t.sym.padEnd(14)} ${t.analysisYear} ${t.month} ${t.confDate.substring(8)} ${t.cfType}×${t.cfCount}  entry:${t.entryDate} ${t.entryTime}  ep:${t.ep} sl:${t.sl}  1R:${r1.outcome}  2R:${r2.outcome}  3R:${r3.outcome}`);
    });
  }

  if (!symArg) {
    // CSV
    const keys = ['sym','analysisYear','month','confDate','cfType','cfCount','cfYears','refDate','entryDate','entryTime','ep','sl','risk','maxFavPct','live',
      'r1_target','r1_outcome','r1_exitDate','r1_exitTime','r1_exitPrice','r1_trailLevel','r1_barsHeld','r1_pnlPct','r1_rMult','r1_maxFavPct',
      'r2_target','r2_outcome','r2_exitDate','r2_exitTime','r2_exitPrice','r2_trailLevel','r2_barsHeld','r2_pnlPct','r2_rMult','r2_maxFavPct',
      'r3_target','r3_outcome','r3_exitDate','r3_exitTime','r3_exitPrice','r3_trailLevel','r3_barsHeld','r3_pnlPct','r3_rMult','r3_maxFavPct'];
    const csvLines = [keys.join(','), ...allTrades.map(t => keys.map(k => {
      if (k.startsWith('r1_')) return t.r1?.[k.slice(3)]??'';
      if (k.startsWith('r2_')) return t.r2?.[k.slice(3)]??'';
      if (k.startsWith('r3_')) return t.r3?.[k.slice(3)]??'';
      return t[k]??'';
    }).join(','))];
    fs.writeFileSync(OUT_CSV, csvLines.join('\n')+'\n','utf8');
    console.log(`\n  → CSV: ${OUT_CSV}`);

    const symLabel = selected ? `15 selected symbols` : `All ${syms.length} symbols`;
    const label = `${symLabel} | ZigZag dev=${DEV}% dep=${DEP}`;
    fs.writeFileSync(OUT_HTML, buildHTML(allTrades, label),'utf8');
    console.log(`  → HTML: ${OUT_HTML}`);
  }
  console.log('═'.repeat(70));
}

main();
