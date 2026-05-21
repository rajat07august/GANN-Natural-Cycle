#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────
// backtest_combined.js — Two Systems, One Report
//
// SYSTEM 1 — LOW ENTRY (buy near confluence Low)
//   Entry   : Next trading day — first hourly CLOSE in [confLow, confLow×1.003]
//   SL      : Hourly CLOSE below confLow  (close-based, no wick triggers)
//   BE      : Daily CLOSE above confHigh → SL jumps to entry price
//   3R ratchet : Any candle HIGH ≥ ep+3R → SL jumps to ep+1.5R
//   5R ratchet : Any candle HIGH ≥ ep+5R → SL jumps to ep+3R  (r5 only)
//   Exits   : r2 = fixed 2R target | r3 = trail (no target) | r5 = trail + 5R lock
//
// SYSTEM 2 — BREAKOUT LONG (buy above confluence High)
//   Entry   : Next trading day — first hourly CLOSE strictly above confHigh
//   SL      : confLow (full range of conf candle below entry)
//   Ratchet1: Any candle HIGH ≥ ep+1R → SL jumps to ep  (breakeven)
//   Ratchet2: Any candle HIGH ≥ ep+2R → SL jumps to ep+1.5R
//   Ratchet3: Any candle HIGH ≥ ep+3R → SL jumps to ep+2R  (r3 only)
//   Exits   : r1 = fixed 1R target | r2 = trail (no target) | r3 = trail + 3R lock
//
// Both: cfCount ≥ 2, ZigZag 4%/10, ₹10L capital, ₹16K fixed risk/trade, max 5 open
// Top 15 per system = top by Calmar 2R with ≥ 5 closed historical trades
// ─────────────────────────────────────────────────────────────────────

const fs   = require('fs');
const path = require('path');

const ADJ_DIR      = 'j:/Swing Trading/Swing Trading/processed_adj';
const RAW_DIR      = 'j:/Swing Trading/Swing Trading/processed';
const INTRADAY_DIR = 'j:/Swing Trading/Swing Trading/processed_intraday';
const SRC1         = 'j:/GANN Claude/Dataset/NIFTY50_all.csv';
const OUT_HTML     = 'j:/GANN Claude/Backtest/backtest_combined.html';

const DEV  = 4;
const DEP  = 10;
const MIN_TRADES_FOR_SELECTION = 5;
const TOP_N = 15;

const GAPS           = [20,15,13,12,10,6,5,4,3,2,1];
const ANALYSIS_YEARS = [2020,2021,2022,2023,2024,2025,2026];
const MONTH_NAMES    = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const INITIAL        = 1_000_000;
const RISK_AMT       = 16_000;
const MAX_OPEN       = 5;

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

// ══════════════════════════════════════════════════════════════
// DATA LOADING  (shared by both systems)
// ══════════════════════════════════════════════════════════════
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
          out.push({date,open:+(open*sf).toFixed(2),high:+(high*sf).toFixed(2),low:+(low*sf).toFixed(2),close:+(close*sf).toFixed(2)});
          continue;
        }
      }
    }
    out.push({date,open,high,low,close});
  }
  return out;
}

let _src1 = null;
function getSrc1() { if (!_src1) _src1 = parseCSV(fs.readFileSync(SRC1,'utf8')); return _src1; }

function loadAdjOHLC(sym) {
  const adjPath = path.join(ADJ_DIR, `${sym}.csv`);
  if (fs.existsSync(adjPath)) {
    return cleanOHLC(
      parseCSV(fs.readFileSync(adjPath,'utf8'))
        .filter(r => parseInt(r.Volume||r.volume||0) > 0)
        .map(r => ({date:(r.Date||r.date||'').trim(),open:parseFloat(r.Open||r.open||0),high:parseFloat(r.High||r.high||0),low:parseFloat(r.Low||r.low||0),close:parseFloat(r.Close||r.close||0)}))
        .filter(r => r.date&&r.high>0).sort((a,b) => a.date.localeCompare(b.date))
    );
  }
  const histNames = HIST_NAMES[sym]||[sym], symSet = new Set(histNames);
  const rows = getSrc1().filter(r => symSet.has(r.Symbol))
    .map(r => ({date:r.Date.trim(),open:parseFloat(r.Open||0),high:parseFloat(r.High||0),low:parseFloat(r.Low||0),close:parseFloat(r.Close||0)}))
    .filter(r => r.date&&r.high>0);
  const rawPath = path.join(RAW_DIR, `${sym}.csv`);
  if (fs.existsSync(rawPath)) {
    const existing = new Set(rows.map(r => r.date));
    parseCSV(fs.readFileSync(rawPath,'utf8'))
      .map(r => ({date:(r.Date||r.date||'').trim(),open:parseFloat(r.Open||r.open||0),high:parseFloat(r.High||r.high||0),low:parseFloat(r.Low||r.low||0),close:parseFloat(r.Close||r.close||0)}))
      .filter(r => r.date&&r.high>0&&!existing.has(r.date)).forEach(r => rows.push(r));
  }
  return cleanOHLC(rows.filter(r => r.date>='2000-01-01').sort((a,b) => a.date.localeCompare(b.date)));
}

function loadRawOHLC(sym) {
  const rawPath = path.join(RAW_DIR, `${sym}.csv`);
  if (!fs.existsSync(rawPath)) return [];
  return parseCSV(fs.readFileSync(rawPath,'utf8'))
    .map(r => ({date:(r.Date||r.date||'').trim(),high:parseFloat(r.High||r.high||0),low:parseFloat(r.Low||r.low||0),close:parseFloat(r.Close||r.close||0)}))
    .filter(r => r.date&&r.high>0).sort((a,b) => a.date.localeCompare(b.date));
}

const _idCache = {};
function loadIntradayByDate(sym) {
  if (_idCache[sym]) return _idCache[sym];
  const p = path.join(INTRADAY_DIR, `${sym}_60min.csv`);
  const byDate = {};
  if (!fs.existsSync(p)) { _idCache[sym]=byDate; return byDate; }
  const lines = fs.readFileSync(p,'utf8').trim().split('\n');
  for (let i=1; i<lines.length; i++) {
    const c = lines[i].split(',');
    const date = c[1]?.trim(), time = c[2]?.trim();
    if (!date||!time) continue;
    if (!byDate[date]) byDate[date]=[];
    byDate[date].push({time,open:parseFloat(c[3]),high:parseFloat(c[4]),low:parseFloat(c[5]),close:parseFloat(c[6])});
  }
  for (const d of Object.keys(byDate)) byDate[d].sort((a,b) => a.time.localeCompare(b.time));
  _idCache[sym]=byDate; return byDate;
}

const _adjCache={}, _rawCache={};
function getAdj(sym){ if(!_adjCache[sym]) _adjCache[sym]=loadAdjOHLC(sym); return _adjCache[sym]; }
function getRaw(sym){ if(!_rawCache[sym]) _rawCache[sym]=loadRawOHLC(sym);  return _rawCache[sym]; }

// ── ZigZag + confluence (shared) ─────────────────────────────────────
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
    const d=new Date(p.date), yr=d.getFullYear(), mi=d.getMonth(), day=String(d.getDate()).padStart(2,'0');
    if(!m[yr])m[yr]={}; if(!m[yr][mi])m[yr][mi]=[];
    m[yr][mi].push({day,type:p.type});
  });
  return m;
}

function getConfluence(matrix, yr, mi) {
  const freq={};
  GAPS.map(g=>yr-g).forEach(y=>{
    const yd=matrix[y]; if(!yd||!yd[mi]) return;
    yd[mi].forEach(({day,type})=>{ if(!freq[day])freq[day]=[]; freq[day].push({year:y,type}); });
  });
  const result={};
  for(const[day,arr] of Object.entries(freq)) if(arr.length>=2) result[day]=arr;
  return result;
}

// ══════════════════════════════════════════════════════════════
// SYSTEM 1 — LOW ENTRY
// ══════════════════════════════════════════════════════════════
function sim1(rawArr, rawIdx, rawMap, intraday, refDate) {
  const ref = rawMap[refDate];
  if(!ref||ref.high<=ref.low||ref.high<=0) return null;
  const confLow=ref.low, confHigh=ref.high, zone=+(confLow*1.003).toFixed(4);
  const ri=rawIdx[refDate];
  if(ri===undefined||ri>=rawArr.length-1) return null;
  const entryDate=rawArr[ri+1].date, cans=intraday[entryDate]||[];
  let ep=null, entryTime=null, trigIdx=-1;
  for(let ci=0;ci<cans.length;ci++){
    const c=cans[ci];
    if(c.close>=confLow&&c.close<=zone){ ep=c.close; entryTime=c.time; trigIdx=ci; break; }
  }
  if(!ep) return null;
  const risk=ep-confLow;
  if(risk<=0) return null;

  const results={};
  for(const tR of [2,3,5]){
    const isFixed=tR===2, fixTgt=ep+2*risk;
    let sl=confLow, lvl=0, outcome='open', exitDate='', exitTime='', exitPrice=0, barsHeld=0, done=false;
    const slLbl=()=>lvl===0?'SL':lvl===1?'BE':'TRAIL';
    const tryBE=()=>{if(lvl<1){lvl=1;sl=ep;}};
    const try3R=h=>{if(h>=ep+3*risk&&lvl<2){lvl=2;sl=ep+1.5*risk;}};
    const try5R=h=>{if(tR===5&&h>=ep+5*risk&&lvl<3){lvl=3;sl=ep+3*risk;}};
    const tick=(c,date)=>{
      if(done)return;
      try3R(c.high); try5R(c.high);
      if(c.close<sl){ outcome=slLbl();exitPrice=sl;exitDate=date;exitTime=c.time;done=true;return;}
      if(isFixed&&c.close>=fixTgt){outcome='TARGET';exitPrice=fixTgt;exitDate=date;exitTime=c.time;done=true;}
    };
    let dayClose=0;
    for(let ci=trigIdx;ci<cans.length&&!done;ci++){ tick(cans[ci],entryDate); dayClose=cans[ci].close; }
    if(!done){if(dayClose>confHigh)tryBE(); barsHeld=1;}
    for(let di=ri+2;di<rawArr.length&&!done;di++){
      const dr=rawArr[di]; const dc=intraday[dr.date]||[]; barsHeld++; dayClose=0;
      if(dc.length){ for(const c of dc){if(!done){tick(c,dr.date);dayClose=c.close;}} }
      else{
        try3R(dr.high);try5R(dr.high);
        if(dr.close<sl){outcome=slLbl();exitPrice=sl;exitDate=dr.date;exitTime='EOD';done=true;}
        if(!done&&isFixed&&dr.high>=fixTgt){outcome='TARGET';exitPrice=fixTgt;exitDate=dr.date;exitTime='EOD';done=true;}
        dayClose=dr.close;
      }
      if(!done&&dayClose>confHigh)tryBE();
      if(!done&&barsHeld>250){outcome='open';exitDate=dr.date;exitPrice=dr.close;done=true;}
    }
    if(!done){const last=rawArr[rawArr.length-1];exitDate=last.date;exitPrice=last.close||ep;outcome='open';}
    const rMult=(exitPrice-ep)/risk;
    results[`r${tR}`]={outcome,exitDate,exitTime,exitPrice:+exitPrice.toFixed(2),rMult:+rMult.toFixed(2)};
  }
  return{ep:+ep.toFixed(2),risk:+risk.toFixed(2),confLow:+confLow.toFixed(2),confHigh:+confHigh.toFixed(2),entryDate,entryTime,...results};
}

function backtest1(sym) {
  const adj=getAdj(sym), raw=getRaw(sym);
  if(!adj.length||!raw.length) return [];
  const rawMap={}, rawIdx={};
  raw.forEach((r,i)=>{rawMap[r.date]=r;rawIdx[r.date]=i;});
  const intraday=loadIntradayByDate(sym);
  const matrix=buildMatrix(computeZigZag(adj));
  const today=new Date().toISOString().slice(0,10);
  const trades=[];
  for(const yr of ANALYSIS_YEARS){
    for(let mi=0;mi<12;mi++){
      const conf=getConfluence(matrix,yr,mi);
      for(const[day,arr] of Object.entries(conf)){
        if(parseInt(day)>new Date(yr,mi+1,0).getDate()) continue;
        const h=arr.some(e=>e.type==='H'),l=arr.some(e=>e.type==='L');
        const refDate=`${yr}-${String(mi+1).padStart(2,'0')}-${day}`;
        const res=sim1(raw,rawIdx,rawMap,intraday,refDate);
        if(!res) continue;
        trades.push({sym,analysisYear:yr,month:MONTH_NAMES[mi],confDate:refDate,
          cfType:(h&&l)?'HL':h?'H':'L',cfCount:arr.length,
          live:refDate>=today?'Y':'N',...res});
      }
    }
  }
  return trades;
}

// ══════════════════════════════════════════════════════════════
// SYSTEM 2 — BREAKOUT LONG
// ══════════════════════════════════════════════════════════════
function sim2(rawArr, rawIdx, rawMap, intraday, refDate) {
  const ref=rawMap[refDate];
  if(!ref||ref.high<=ref.low||ref.high<=0) return null;
  const ep0=ref.high, sl0=ref.low, risk0=ep0-sl0;
  if(risk0<=0) return null;
  const ri=rawIdx[refDate];
  if(ri===undefined||ri>=rawArr.length-1) return null;
  const entryDate=rawArr[ri+1].date, cans=intraday[entryDate]||[];
  let ep=null, entryTime=null, trigIdx=-1;
  for(let ci=0;ci<cans.length;ci++){
    if(cans[ci].close>ep0){ep=ep0;entryTime=cans[ci].time;trigIdx=ci;break;}
  }
  if(!ep) return null;
  const risk=ep-sl0;
  if(risk<=0) return null;

  const results={};
  for(const tR of [1,2,3]){
    const isFixed=tR===1, fixTgt=ep+tR*risk;
    let sl=sl0, lvl=0, outcome='open', exitDate='', exitTime='', exitPrice=0, barsHeld=0, done=false;
    const slLbl=()=>lvl===0?'SL':lvl===1?'BE':'TRAIL';
    const advance=h=>{
      if(lvl<1&&h>=ep+risk){lvl=1;sl=ep;}
      if(lvl<2&&h>=ep+2*risk){lvl=2;sl=ep+1.5*risk;}
      if(tR>=3&&lvl<3&&h>=ep+3*risk){lvl=3;sl=ep+2*risk;}
    };
    const tick=(c,date)=>{
      if(done)return;
      if(isFixed){
        advance(c.high);
        if(c.high>=fixTgt){
          if(c.low<=sl&&c.open<sl){outcome=slLbl();exitPrice=sl;}
          else{outcome='TARGET';exitPrice=fixTgt;}
          exitDate=date;exitTime=c.time;done=true;return;
        }
        if(c.low<=sl){outcome=slLbl();exitPrice=sl;exitDate=date;exitTime=c.time;done=true;}
      } else {
        advance(c.high);
        if(c.low<=sl){outcome=slLbl();exitPrice=sl;exitDate=date;exitTime=c.time;done=true;}
      }
    };
    for(let ci=trigIdx;ci<cans.length&&!done;ci++) tick(cans[ci],entryDate);
    if(!done) barsHeld=1;
    for(let di=ri+2;di<rawArr.length&&!done;di++){
      const dr=rawArr[di]; const dc=intraday[dr.date]||[]; barsHeld++;
      if(dc.length){for(const c of dc){if(!done)tick(c,dr.date);}}
      else{
        advance(dr.high);
        if(isFixed){
          if(dr.high>=fixTgt){outcome='TARGET';exitPrice=fixTgt;exitDate=dr.date;exitTime='EOD';done=true;}
          else if(dr.low<=sl){outcome=slLbl();exitPrice=sl;exitDate=dr.date;exitTime='EOD';done=true;}
        } else {
          if(dr.low<=sl){outcome=slLbl();exitPrice=sl;exitDate=dr.date;exitTime='EOD';done=true;}
        }
      }
      if(!done&&barsHeld>250){outcome='open';exitDate=dr.date;exitPrice=dr.close;done=true;}
    }
    if(!done){const last=rawArr[rawArr.length-1];exitDate=last.date;exitPrice=last.close||ep;outcome='open';}
    const rMult=(exitPrice-ep)/risk;
    results[`r${tR}`]={outcome,exitDate,exitTime,exitPrice:+exitPrice.toFixed(2),rMult:+rMult.toFixed(2)};
  }
  return{ep:+ep.toFixed(2),risk:+risk.toFixed(2),confLow:+sl0.toFixed(2),confHigh:+ep0.toFixed(2),entryDate,entryTime,...results};
}

function backtest2(sym) {
  const adj=getAdj(sym), raw=getRaw(sym);
  if(!adj.length||!raw.length) return [];
  const rawMap={}, rawIdx={};
  raw.forEach((r,i)=>{rawMap[r.date]=r;rawIdx[r.date]=i;});
  const intraday=loadIntradayByDate(sym);
  const matrix=buildMatrix(computeZigZag(adj));
  const today=new Date().toISOString().slice(0,10);
  const trades=[];
  for(const yr of ANALYSIS_YEARS){
    for(let mi=0;mi<12;mi++){
      const conf=getConfluence(matrix,yr,mi);
      for(const[day,arr] of Object.entries(conf)){
        if(parseInt(day)>new Date(yr,mi+1,0).getDate()) continue;
        const h=arr.some(e=>e.type==='H'),l=arr.some(e=>e.type==='L');
        const refDate=`${yr}-${String(mi+1).padStart(2,'0')}-${day}`;
        const res=sim2(raw,rawIdx,rawMap,intraday,refDate);
        if(!res) continue;
        trades.push({sym,analysisYear:yr,month:MONTH_NAMES[mi],confDate:refDate,
          cfType:(h&&l)?'HL':h?'H':'L',cfCount:arr.length,
          live:refDate>=today?'Y':'N',...res});
      }
    }
  }
  return trades;
}

// ══════════════════════════════════════════════════════════════
// STATS & PORTFOLIO
// ══════════════════════════════════════════════════════════════
function calcStats(trades, rKey) {
  const cl=trades.filter(t=>t[rKey]?.outcome!=='open');
  if(!cl.length) return{n:0,open:0,wins:0,bes:0,sls:0,wr:0,ev:0};
  const wins=cl.filter(t=>t[rKey].outcome==='TARGET').length;
  const bes =cl.filter(t=>t[rKey].outcome==='BE').length;
  const sls =cl.filter(t=>t[rKey].outcome==='SL').length;
  const ev  =cl.reduce((s,t)=>s+(t[rKey].rMult??0),0)/cl.length;
  return{n:cl.length,open:trades.length-cl.length,wins,bes,sls,wr:wins/cl.length,ev};
}

function calmar(trades, rKey) {
  const cl=[...trades.filter(t=>t[rKey]?.outcome!=='open')].sort((a,b)=>a.entryDate.localeCompare(b.entryDate));
  if(cl.length<3) return null;
  let peak=0,maxDD=0,cap=0;
  for(const t of cl){
    cap+=(t[rKey].rMult??0);
    if(cap>peak)peak=cap;
    const dd=peak-cap; if(dd>maxDD)maxDD=dd;
  }
  return maxDD===0?null:+(cap/maxDD).toFixed(2);
}

function selectTop15(hist, rKey='r2') {
  const map={};
  hist.forEach(t=>{if(!map[t.sym])map[t.sym]=[];map[t.sym].push(t);});
  return Object.entries(map)
    .map(([sym,ts])=>{
      const s=calcStats(ts,rKey), cal=calmar(ts,rKey);
      return{sym,n:s.n,cal,ev:s.ev,wr:s.wr};
    })
    .filter(x=>x.n>=MIN_TRADES_FOR_SELECTION)
    .sort((a,b)=>(b.cal??-99)-(a.cal??-99))
    .slice(0,TOP_N)
    .map(x=>x.sym);
}

function simulatePortfolio(trades, rKey) {
  const hist=trades.filter(t=>t.live==='N'&&t[rKey]?.outcome!=='open'&&t[rKey]?.exitDate)
    .sort((a,b)=>a.entryDate.localeCompare(b.entryDate)||a.sym.localeCompare(b.sym));
  if(!hist.length) return null;
  let cap=INITIAL; const active=[],eqPts=[{date:hist[0].entryDate,cap}],yrData={};
  let totTaken=0,totSkipped=0;
  function flush(upto){
    active.sort((a,b)=>a.exitDate.localeCompare(b.exitDate));
    while(active.length&&active[0].exitDate<=upto){
      const t=active.shift(); cap+=t.rMult*RISK_AMT;
      eqPts.push({date:t.exitDate,cap:Math.round(cap)});
      const yr=+t.exitDate.slice(0,4);
      if(!yrData[yr])yrData[yr]={taken:0,skipped:0,wins:0,losses:0,bes:0};
      if(t.rMult>0.05)yrData[yr].wins++; else if(t.rMult<-0.05)yrData[yr].losses++; else yrData[yr].bes++;
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
  return{eq,yearRows,annualR:+annualR.toFixed(1),finalCap:Math.round(cap),
    totalRet:+((cap-INITIAL)/INITIAL*100).toFixed(1),maxDD:+maxDD.toFixed(1),
    totTaken,totSkipped,INITIAL,RISK_AMT};
}

// ══════════════════════════════════════════════════════════════
// HTML BUILDERS
// ══════════════════════════════════════════════════════════════
function pct(v){return `${(v*100).toFixed(0)}%`;}
function cls(v,thr=0){return v>thr?'pos':v<-thr?'neg':'neu';}
function fc(v){return `₹${(v/1e5).toFixed(2)}L`;}
function fm(v){return `₹${Math.round(v/1000)}K`;}
function rc(v){return v>0?'pos':v<0?'neg':'neu';}

function symTableHtml(hist, rKeys, labels) {
  const map={};
  hist.forEach(t=>{if(!map[t.sym])map[t.sym]=[];map[t.sym].push(t);});
  const rows=Object.entries(map).map(([sym,ts])=>{
    const stats=rKeys.map(k=>calcStats(ts,k));
    const cal=calmar(ts,rKeys[1]||rKeys[0]);
    return{sym,stats,cal:(cal??-99),calStr:cal==null?'—':cal.toFixed(2),calCls:cal==null?'neu':cal>=1?'pos':cal>=0?'neu':'neg'};
  }).sort((a,b)=>b.cal-a.cal);

  const hdrs=rKeys.map((k,i)=>`<th class="c${rKeys[i]}" colspan="2">${labels[i]}</th>`).join('');
  const subHdrs=rKeys.map(()=>`<th>WR</th><th>EV</th>`).join('');
  return `<div style="overflow-x:auto"><table class="sym-table">
<thead>
  <tr><th rowspan="2">Symbol</th><th rowspan="2">N</th><th rowspan="2">Calmar</th>${hdrs}</tr>
  <tr>${subHdrs}</tr>
</thead><tbody>
${rows.map(r=>`<tr>
  <td class="sym">${r.sym}</td>
  <td>${r.stats[0].n}</td>
  <td class="${r.calCls}"><b>${r.calStr}</b></td>
  ${r.stats.map((s,i)=>`<td class="${cls(s.wr-.45)}">${pct(s.wr)}</td><td class="${cls(s.ev)}">${s.ev.toFixed(2)}R</td>`).join('')}
</tr>`).join('')}
</tbody></table></div>`;
}

function portfolioHtml(p, label, gradId) {
  if(!p) return `<p class="empty">No closed trades for portfolio simulation.</p>`;
  const{eq}=p;
  const W=860,H=240,PL=82,PR=20,PT=15,PB=38,cw=W-PL-PR,ch=H-PT-PB;
  const ts=eq.map(e=>+new Date(e.date)),vs=eq.map(e=>e.cap);
  const t0=Math.min(...ts),t1=Math.max(...ts);
  const vSpan=Math.max(...vs)-Math.min(...vs)||1;
  const v0=Math.min(...vs)-vSpan*0.08, v1=Math.max(...vs)+vSpan*0.08;
  const sx=t=>PL+(t-t0)/(t1-t0)*cw, sy=v=>PT+ch-(v-v0)/(v1-v0)*ch;
  const pts=eq.map(e=>`${sx(+new Date(e.date)).toFixed(1)},${sy(e.cap).toFixed(1)}`).join(' ');
  const fx=sx(ts[0]).toFixed(1),lx=sx(ts[ts.length-1]).toFixed(1),by=(PT+ch).toFixed(1);
  let grid=''; const y0=new Date(t0).getFullYear(),y1=new Date(t1).getFullYear();
  for(let y=y0+1;y<=y1;y++){const x=sx(+new Date(`${y}-01-01`));if(x>PL&&x<W-PR)grid+=`<line x1="${x.toFixed(1)}" y1="${PT}" x2="${x.toFixed(1)}" y2="${PT+ch}" stroke="#30363d" stroke-dasharray="3,3"/><text x="${x.toFixed(1)}" y="${PT+ch+20}" fill="#8b949e" font-size="11" text-anchor="middle">${y}</text>`;}
  let yAxis=''; for(let i=0;i<=4;i++){const v=v0+i*(v1-v0)/4,yy=sy(v).toFixed(1);yAxis+=`<line x1="${PL}" y1="${yy}" x2="${W-PR}" y2="${yy}" stroke="#30363d" stroke-opacity=".5"/><text x="${PL-6}" y="${yy}" fill="#8b949e" font-size="10" text-anchor="end" dominant-baseline="middle">${fc(v)}</text>`;}
  const svg=`<svg viewBox="0 0 ${W} ${H}" style="width:100%;display:block"><defs><linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#58a6ff" stop-opacity=".22"/><stop offset="100%" stop-color="#58a6ff" stop-opacity=".02"/></linearGradient></defs>${yAxis}${grid}<polygon points="${fx},${by} ${pts} ${lx},${by}" fill="url(#${gradId})"/><polyline points="${pts}" fill="none" stroke="#58a6ff" stroke-width="2" stroke-linejoin="round"/></svg>`;
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
    <td><b>${r.yr}</b></td>
    <td style="color:var(--sub)">${fc(r.startCap)}</td>
    <td class="${rc(r.pnl)}">${fc(r.endCap)}</td>
    <td class="${rc(r.pnl)}">${r.pnl>=0?'+':''}${fm(r.pnl)}</td>
    <td><b class="${rc(r.ret)}">${r.ret>0?'+':''}${r.ret}%</b></td>
    <td>${r.taken}</td><td class="neu">${r.skipped}</td>
    <td class="pos">${r.wins}</td><td class="neu">${r.bes}</td><td class="neg">${r.losses}</td>
  </tr>`).join('')}
  </tbody></table>`;
  return `<h3 class="port-title">${label}</h3>${stats}<div class="svg-wrap">${svg}</div><div class="wrap">${tbl}</div>`;
}

// ══════════════════════════════════════════════════════════════
// RUN
// ══════════════════════════════════════════════════════════════
console.log('\nGann Confluence — Combined Backtest Report');
console.log('='.repeat(60));

process.stdout.write('Preloading OHLC … ');
for(const sym of ALL_SYMS){try{getAdj(sym);getRaw(sym);loadIntradayByDate(sym);}catch{}}
console.log('done\n');

// System 1
process.stdout.write('System 1 — Low Entry … ');
const t1s=Date.now();
const s1trades=[];
for(const sym of ALL_SYMS){try{s1trades.push(...backtest1(sym));}catch{}}
console.log(`${((Date.now()-t1s)/1000).toFixed(1)}s  ${s1trades.filter(t=>t.live==='N').length} hist trades`);

// System 2
process.stdout.write('System 2 — Breakout Long … ');
const t2s=Date.now();
const s2trades=[];
for(const sym of ALL_SYMS){try{s2trades.push(...backtest2(sym));}catch{}}
console.log(`${((Date.now()-t2s)/1000).toFixed(1)}s  ${s2trades.filter(t=>t.live==='N').length} hist trades`);

const s1hist=s1trades.filter(t=>t.live==='N');
const s2hist=s2trades.filter(t=>t.live==='N');

// Auto-select top 15 per system
const s1top15=selectTop15(s1hist,'r2');
const s2top15=selectTop15(s2hist,'r2');

console.log(`\nSystem 1 Top 15: ${s1top15.join(', ')}`);
console.log(`System 2 Top 15: ${s2top15.join(', ')}`);

const s1sel=s1hist.filter(t=>s1top15.includes(t.sym));
const s2sel=s2hist.filter(t=>s2top15.includes(t.sym));

// Portfolio simulations
const s1port_r2 = simulatePortfolio(s1sel, 'r2');
const s1port_r5 = simulatePortfolio(s1sel, 'r5');
const s2port_r2 = simulatePortfolio(s2sel, 'r2');
const s2port_r3 = simulatePortfolio(s2sel, 'r3');

console.log('\nBuilding HTML …');

// ── Full HTML ──────────────────────────────────────────────────────────
const criteriaBox1 = `
<div class="criteria-box">
  <div class="criteria-title">System 1 — Low Entry (buy near confluence Low)</div>
  <div class="criteria-grid">
    <div class="crit-item">
      <div class="crit-label">Signal</div>
      <div class="crit-val">Gann Confluence: same calendar day in ≥2 of 11 lookback years (gaps: 1,2,3,4,5,6,10,12,13,15,20)</div>
    </div>
    <div class="crit-item">
      <div class="crit-label">Entry</div>
      <div class="crit-val">Next trading day after confluence date — first <b>hourly CLOSE in [confLow, confLow × 1.003]</b> (within 0.3% above the confluence candle's Low)</div>
    </div>
    <div class="crit-item">
      <div class="crit-label">Stop Loss</div>
      <div class="crit-val">Triggered when <b>hourly CLOSE goes below confLow</b> — close-based only, intraday wicks do NOT trigger SL</div>
    </div>
    <div class="crit-item">
      <div class="crit-label">BE Ratchet</div>
      <div class="crit-val">If <b>daily close ends above confHigh</b>, SL moves up to entry price (breakeven lock)</div>
    </div>
    <div class="crit-item">
      <div class="crit-label">3R Ratchet</div>
      <div class="crit-val">If any candle's <b>HIGH reaches ep + 3×risk</b>, SL moves up to ep + 1.5×risk (locking 1.5R profit)</div>
    </div>
    <div class="crit-item">
      <div class="crit-label">5R Ratchet</div>
      <div class="crit-val">If any candle's <b>HIGH reaches ep + 5×risk</b>, SL moves up to ep + 3×risk (locking 3R profit) — r5 target only</div>
    </div>
    <div class="crit-item">
      <div class="crit-label">Exit — r2</div>
      <div class="crit-val"><b>Fixed</b>: exit when hourly close ≥ ep + 2×risk (2R target). BE ratchet still active.</div>
    </div>
    <div class="crit-item">
      <div class="crit-label">Exit — r3</div>
      <div class="crit-val"><b>Trailing only</b>: no fixed target. Run until SL is hit (confLow → BE → 1.5R lock)</div>
    </div>
    <div class="crit-item">
      <div class="crit-label">Exit — r5</div>
      <div class="crit-val"><b>Trailing only</b>: no fixed target. Run until SL is hit (confLow → BE → 1.5R → 3R at 5R high)</div>
    </div>
    <div class="crit-item">
      <div class="crit-label">ZigZag</div>
      <div class="crit-val">Dev 4% / Depth 10 bars (adjusted prices) — determines pivot points for matrix construction</div>
    </div>
    <div class="crit-item">
      <div class="crit-label">Position Sizing</div>
      <div class="crit-val">₹10L capital · ₹16,000 fixed risk per trade · Max 5 concurrent positions · FIFO flush on entry</div>
    </div>
  </div>
</div>`;

const criteriaBox2 = `
<div class="criteria-box">
  <div class="criteria-title">System 2 — Breakout Long (buy above confluence High)</div>
  <div class="criteria-grid">
    <div class="crit-item">
      <div class="crit-label">Signal</div>
      <div class="crit-val">Gann Confluence: same calendar day in ≥2 of 11 lookback years (gaps: 1,2,3,4,5,6,10,12,13,15,20)</div>
    </div>
    <div class="crit-item">
      <div class="crit-label">Entry</div>
      <div class="crit-val">Next trading day after confluence date — first <b>hourly CLOSE strictly above confHigh</b> (breakout above the confluence candle's High)</div>
    </div>
    <div class="crit-item">
      <div class="crit-label">Stop Loss</div>
      <div class="crit-val">Initial SL = <b>confLow</b> (full range of the confluence candle). Risk = confHigh − confLow</div>
    </div>
    <div class="crit-item">
      <div class="crit-label">Ratchet 1 — BE</div>
      <div class="crit-val">When any candle HIGH ≥ <b>ep + 1×risk</b>, SL moves up to ep (breakeven)</div>
    </div>
    <div class="crit-item">
      <div class="crit-label">Ratchet 2 — 1.5R lock</div>
      <div class="crit-val">When any candle HIGH ≥ <b>ep + 2×risk</b>, SL moves up to ep + 1.5×risk (locking 1.5R profit)</div>
    </div>
    <div class="crit-item">
      <div class="crit-label">Ratchet 3 — 2R lock</div>
      <div class="crit-val">When any candle HIGH ≥ <b>ep + 3×risk</b>, SL moves up to ep + 2×risk — r3 target only</div>
    </div>
    <div class="crit-item">
      <div class="crit-label">Exit — r1</div>
      <div class="crit-val"><b>Fixed</b>: exit when price reaches ep + 1×risk (1R target). Same-candle conflict check applies.</div>
    </div>
    <div class="crit-item">
      <div class="crit-label">Exit — r2</div>
      <div class="crit-val"><b>Trailing only</b>: no fixed target. Run until SL is hit (confLow → BE → 1.5R lock at 2R high)</div>
    </div>
    <div class="crit-item">
      <div class="crit-label">Exit — r3</div>
      <div class="crit-val"><b>Trailing only</b>: no fixed target. Run until SL is hit (confLow → BE → 1.5R → 2R lock at 3R high)</div>
    </div>
    <div class="crit-item">
      <div class="crit-label">ZigZag</div>
      <div class="crit-val">Dev 4% / Depth 10 bars (adjusted prices) — determines pivot points for matrix construction</div>
    </div>
    <div class="crit-item">
      <div class="crit-label">Position Sizing</div>
      <div class="crit-val">₹10L capital · ₹16,000 fixed risk per trade · Max 5 concurrent positions · FIFO flush on entry</div>
    </div>
  </div>
</div>`;

function sectionHdr(text){return `<div class="section-hdr"><span>${text}</span></div>`;}

function systemTab(sysNum, label, hist, sel, top15, port_main, port_alt, rMain, rAlt, rKeys, rLabels, criteria) {
  const s_main=calcStats(hist,rMain), s_alt=calcStats(hist,rAlt);
  const cal=calmar(hist,rMain);
  const summary=`<div class="summary-bar">
    <div class="sb-item"><div class="sb-l">Total historical trades</div><div class="sb-v">${s_main.n}</div></div>
    <div class="sb-item"><div class="sb-l">Overall win rate (${rMain})</div><div class="sb-v ${cls(s_main.wr-.5)}">${pct(s_main.wr)}</div></div>
    <div class="sb-item"><div class="sb-l">EV ${rMain}</div><div class="sb-v ${cls(s_main.ev)}">${s_main.ev.toFixed(2)}R</div></div>
    <div class="sb-item"><div class="sb-l">EV ${rAlt}</div><div class="sb-v ${cls(s_alt.ev)}">${s_alt.ev.toFixed(2)}R</div></div>
    <div class="sb-item"><div class="sb-l">Calmar (${rMain})</div><div class="sb-v ${cls(cal??0)}">${cal??'—'}</div></div>
  </div>`;

  const top15box=`<div class="top15-box">
    <div class="top15-label">Top 15 Selected (≥${MIN_TRADES_FOR_SELECTION} trades, sorted by Calmar ${rMain})</div>
    <div class="top15-chips">${top15.map((s,i)=>`<span class="chip">#${i+1} ${s}</span>`).join('')}</div>
  </div>`;

  return `
    ${criteria}
    ${summary}
    ${sectionHdr('All 74 Symbols — Per-Symbol Results (sorted by Calmar)')}
    ${symTableHtml(hist, rKeys, rLabels)}
    ${sectionHdr(`Top ${TOP_N} Selected Names — Per-Symbol Results`)}
    ${top15box}
    ${symTableHtml(sel, rKeys, rLabels)}
    ${sectionHdr(`Portfolio Simulation — Top 15 — ${rMain.toUpperCase()} Exit`)}
    ${portfolioHtml(port_main, `${label} · ${rMain.toUpperCase()} exit · ₹10L capital`, `pg${sysNum}a`)}
    ${sectionHdr(`Portfolio Simulation — Top 15 — ${rAlt.toUpperCase()} Exit`)}
    ${portfolioHtml(port_alt, `${label} · ${rAlt.toUpperCase()} exit · ₹10L capital`, `pg${sysNum}b`)}
  `;
}

const s1stats_r3=calcStats(s1hist,'r3');
const tab1=systemTab(1,'System 1 — Low Entry',s1hist,s1sel,s1top15,s1port_r2,s1port_r5,'r2','r5',
  ['r2','r3','r5'],['2R (fixed)','3R (trailing)','5R (trailing)'],criteriaBox1);
const tab2=systemTab(2,'System 2 — Breakout Long',s2hist,s2sel,s2top15,s2port_r2,s2port_r3,'r2','r3',
  ['r1','r2','r3'],['1R (fixed)','2R (trailing)','3R (trailing)'],criteriaBox2);

const html=`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Gann Confluence — Combined Backtest</title>
<style>
  :root{
    --bg:#0d1117;--panel:#161b22;--panel2:#1c2128;
    --border:#30363d;--text:#e6edf3;--sub:#8b949e;
    --accent:#58a6ff;--pos:#3fb950;--neg:#f85149;--neu:#8b949e;--gold:#ffe066;
  }
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Segoe UI',Arial,sans-serif;background:var(--bg);color:var(--text);font-size:13px;line-height:1.5;}

  /* ── header ── */
  .page-header{background:var(--panel);border-bottom:1px solid var(--border);padding:16px 28px;position:sticky;top:0;z-index:100;}
  .page-header h1{font-size:18px;font-weight:700;margin-bottom:3px;}
  .page-header p{color:var(--sub);font-size:11.5px;}

  /* ── tab nav ── */
  .tab-nav{display:flex;gap:2px;background:var(--panel2);padding:8px 28px;border-bottom:1px solid var(--border);}
  .tab-btn{background:none;border:none;color:var(--sub);padding:8px 22px;cursor:pointer;border-radius:6px;font-size:13px;font-weight:600;letter-spacing:.2px;transition:all .15s;}
  .tab-btn:hover{color:var(--text);background:rgba(255,255,255,.06);}
  .tab-btn.active{color:var(--accent);background:rgba(88,166,255,.12);}
  .tab-content{display:none;padding:24px 28px 48px;}
  .tab-content.active{display:block;}

  /* ── criteria box ── */
  .criteria-box{background:var(--panel);border:1px solid var(--border);border-radius:10px;padding:20px 24px;margin-bottom:24px;}
  .criteria-title{font-size:14px;font-weight:700;color:var(--gold);margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid var(--border);}
  .criteria-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 24px;}
  @media(max-width:900px){.criteria-grid{grid-template-columns:1fr;}}
  .crit-item{display:flex;gap:10px;align-items:baseline;padding:6px 0;border-bottom:1px solid rgba(48,54,61,.5);}
  .crit-label{min-width:130px;font-size:11px;font-weight:700;color:var(--sub);text-transform:uppercase;letter-spacing:.4px;flex-shrink:0;}
  .crit-val{font-size:12px;color:var(--text);line-height:1.5;}
  .crit-val b{color:var(--accent);}

  /* ── summary bar ── */
  .summary-bar{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:20px;}
  .sb-item{background:var(--panel);border:1px solid var(--border);border-radius:8px;padding:10px 16px;flex:1;min-width:140px;}
  .sb-l{font-size:10px;color:var(--sub);text-transform:uppercase;letter-spacing:.4px;margin-bottom:4px;}
  .sb-v{font-size:17px;font-weight:700;}

  /* ── section header ── */
  .section-hdr{display:flex;align-items:center;gap:10px;margin:28px 0 14px;color:var(--sub);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;}
  .section-hdr::after{content:'';flex:1;height:1px;background:var(--border);}

  /* ── top 15 box ── */
  .top15-box{background:rgba(88,166,255,.06);border:1px solid rgba(88,166,255,.2);border-radius:8px;padding:14px 18px;margin-bottom:16px;}
  .top15-label{font-size:11px;color:var(--sub);text-transform:uppercase;letter-spacing:.4px;margin-bottom:10px;}
  .top15-chips{display:flex;flex-wrap:wrap;gap:6px;}
  .chip{background:var(--panel2);border:1px solid var(--border);border-radius:20px;padding:4px 12px;font-size:12px;color:var(--accent);font-weight:600;}

  /* ── sym table ── */
  .sym-table{border-collapse:collapse;width:100%;font-size:12px;}
  .sym-table th,.sym-table td{border:1px solid var(--border);padding:5px 9px;text-align:right;}
  .sym-table th{background:var(--panel2);color:var(--sub);font-size:10px;text-transform:uppercase;letter-spacing:.3px;position:sticky;top:0;}
  .sym-table td:first-child,.sym-table th:first-child{text-align:left;position:sticky;left:0;background:var(--bg);z-index:1;}
  .sym-table th:first-child{background:var(--panel2);}
  .sym-table td.sym{color:var(--accent);font-weight:700;font-size:12.5px;}
  .sym-table tr:hover td{background:rgba(88,166,255,.05);}
  .sym-table td.cr2,.sym-table th.cr2{border-left:3px solid #1a3a5c;}
  .sym-table td.cr3,.sym-table th.cr3{border-left:3px solid #1a3a2a;}
  .sym-table td.cr5,.sym-table th.cr5{border-left:3px solid #3a1a3a;}
  .sym-table td.cr1,.sym-table th.cr1{border-left:3px solid #1a3a5c;}

  /* ── portfolio ── */
  .port-title{font-size:14px;font-weight:700;color:var(--text);margin:8px 0 14px;}
  .port-stats{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;}
  .ps{background:var(--panel2);border:1px solid var(--border);border-radius:8px;padding:8px 14px;min-width:120px;flex:1;}
  .ps-l{font-size:10px;color:var(--sub);text-transform:uppercase;letter-spacing:.3px;margin-bottom:3px;}
  .ps-v{font-size:15px;font-weight:700;}
  .svg-wrap{padding:0 0 12px;margin-bottom:8px;}
  .wrap{overflow-x:auto;margin-bottom:24px;}
  table{border-collapse:collapse;width:100%;font-size:12px;}
  table th,table td{border:1px solid var(--border);padding:6px 10px;text-align:right;}
  table th{background:var(--panel2);color:var(--sub);font-size:10.5px;text-transform:uppercase;letter-spacing:.3px;}
  table td:first-child{text-align:left;font-weight:600;}
  table tr:hover td{background:rgba(88,166,255,.05);}

  /* ── colours ── */
  .pos{color:var(--pos);} .neg{color:var(--neg);} .neu{color:var(--sub);}
  .empty{color:var(--sub);padding:20px;text-align:center;}

  /* ── scrollbar ── */
  ::-webkit-scrollbar{width:6px;height:6px;}
  ::-webkit-scrollbar-track{background:var(--bg);}
  ::-webkit-scrollbar-thumb{background:#30363d;border-radius:3px;}
</style>
</head>
<body>

<div class="page-header">
  <h1>Gann Confluence — Combined Backtest Report</h1>
  <p>Two entry systems · All 74 symbols (50 NIFTY50 + 24 Midcap) · ZigZag 4%/10 · ₹10L · ₹16K/trade · Max 5 open · Top 15 auto-selected by Calmar 2R</p>
</div>

<div class="tab-nav">
  <button class="tab-btn active" onclick="showTab('s1',this)">📉 System 1 — Low Entry</button>
  <button class="tab-btn" onclick="showTab('s2',this)">📈 System 2 — Breakout Long</button>
</div>

<div id="tab-s1" class="tab-content active">${tab1}</div>
<div id="tab-s2" class="tab-content">${tab2}</div>

<script>
function showTab(id,btn){
  document.querySelectorAll('.tab-content').forEach(e=>e.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(e=>e.classList.remove('active'));
  document.getElementById('tab-'+id).classList.add('active');
  btn.classList.add('active');
}
</script>
</body>
</html>`;

fs.writeFileSync(OUT_HTML, html);
console.log(`\n✓ HTML → ${OUT_HTML}`);
console.log(`\nSystem 1 top 15: ${s1top15.join(', ')}`);
console.log(`System 2 top 15: ${s2top15.join(', ')}`);
