#!/usr/bin/env node
// Quick single-trade visualizer for the new entry/exit logic
// Entry : next day after conf date, hourly close within 0.3% of conf date Low
// SL    : conf date Low (hard)
// Exit  : daily close > conf High → hold (SL stays at conf Low)
//         daily close ≤ conf High → check hourly close < conf Low → exit

const fs   = require('fs');
const path = require('path');

const RAW_DIR      = 'j:/Swing Trading/Swing Trading/processed';
const ADJ_DIR      = 'j:/Swing Trading/Swing Trading/processed_adj';
const INTRADAY_DIR = 'j:/Swing Trading/Swing Trading/processed_intraday';
const SRC1         = 'j:/GANN Claude/Dataset/NIFTY50_all.csv';

const GAPS = [20,15,13,12,10,6,5,4,3,2,1];
const DEV = 4, DEP = 10;

// ── Data loading ──────────────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map(h=>h.trim());
  return lines.slice(1).map(l => {
    const vals = l.split(',');
    const o = {};
    headers.forEach((h,i) => o[h]=vals[i]?.trim());
    return o;
  });
}

function loadRaw(sym) {
  const file = path.join(RAW_DIR, sym+'.csv');
  if (!fs.existsSync(file)) return [];
  return parseCSV(fs.readFileSync(file,'utf8'))
    .map(r=>({date:(r.Date||r.date||'').trim(),open:+r.Open||+r.open,high:+r.High||+r.high,low:+r.Low||+r.low,close:+r.Close||+r.close}))
    .filter(r=>r.date&&r.high>0).sort((a,b)=>a.date<b.date?-1:1);
}

function loadAdj(sym) {
  const adj = path.join(ADJ_DIR, sym+'.csv');
  if (fs.existsSync(adj)) {
    return parseCSV(fs.readFileSync(adj,'utf8'))
      .map(r=>({date:(r.Date||r.date||'').trim(),open:+r.Open||+r.open,high:+r.High||+r.high,low:+r.Low||+r.low,close:+r.Close||+r.close}))
      .filter(r=>r.date&&r.high>0).sort((a,b)=>a.date<b.date?-1:1);
  }
  return loadRaw(sym);
}

function loadIntraday(sym) {
  const f = path.join(INTRADAY_DIR, sym+'_60min.csv');
  if (!fs.existsSync(f)) return {};
  const byDate = {};
  // format: SYMBOL,date,time,open,high,low,close,volume
  fs.readFileSync(f,'utf8').trim().split('\n').slice(1).forEach(l => {
    const p = l.split(',');
    const dt=p[1], tm=p[2], open=+p[3], high=+p[4], low=+p[5], close=+p[6];
    if (!dt||!high) return;
    if (!byDate[dt]) byDate[dt]=[];
    byDate[dt].push({time:tm,open,high,low,close});
  });
  return byDate;
}

// ── ZigZag ────────────────────────────────────────────────────────────
function computeZigZag(ohlc) {
  const dev=DEV/100, dep=DEP;
  const pivots=[];
  let dir=0, extI=0, extP=0;
  function addPivot(i,type) { pivots.push({date:ohlc[i].date,type,price:type==='H'?ohlc[i].high:ohlc[i].low,idx:i}); }
  for (let i=0;i<ohlc.length;i++) {
    const {high,low}=ohlc[i];
    if (dir===0) {
      if (i===0){dir=1;extI=0;extP=high;}
      else if (high>extP){extI=i;extP=high;}
      else if (extP-low>=extP*dev&&i-extI>=dep){addPivot(extI,'H');dir=-1;extI=i;extP=low;}
    } else if (dir===1) {
      if (high>extP){extI=i;extP=high;}
      else if (extP-low>=extP*dev&&i-extI>=dep){addPivot(extI,'H');dir=-1;extI=i;extP=low;}
    } else {
      if (low<extP){extI=i;extP=low;}
      else if (high-extP>=extP*dev&&i-extI>=dep){addPivot(extI,'L');dir=1;extI=i;extP=high;}
    }
  }
  if (dir===1) addPivot(extI,'H'); else if(dir===-1) addPivot(extI,'L');
  return pivots;
}

function buildMatrix(pivots) {
  const m={};
  pivots.forEach(p=>{
    const d=new Date(p.date);
    const yr=d.getFullYear(), mi=d.getMonth(), day=String(d.getDate()).padStart(2,'0');
    if(!m[yr])m[yr]={}; if(!m[yr][mi])m[yr][mi]=[];
    m[yr][mi].push({day,type:p.type});
  });
  return m;
}

function getConfluence(matrix,year,mi) {
  const freq={};
  GAPS.map(g=>year-g).forEach(yr=>{
    const yd=matrix[yr]; if(!yd||!yd[mi]) return;
    yd[mi].forEach(({day,type})=>{if(!freq[day])freq[day]=[];freq[day].push({year:yr,type});});
  });
  const r={};
  for(const [d,a] of Object.entries(freq)) if(a.length>=2) r[d]=a;
  return r;
}

// ── Find first trade for a symbol ─────────────────────────────────────
const SYM = process.argv[2] || 'HCLTECH';
const TARGET_YEAR = parseInt(process.argv[3]) || 2023;
const FORCE_CONF_DATE = process.argv[4] || null;  // e.g. '2024-06-12'

const rawOHLC = loadRaw(SYM);
const adjOHLC = loadAdj(SYM);
const intraday = loadIntraday(SYM);

const rawMap = {}; rawOHLC.forEach(r=>rawMap[r.date]=r);
const rawIdx = {}; rawOHLC.forEach((r,i)=>rawIdx[r.date]=i);

const pivots = computeZigZag(adjOHLC);
const matrix = buildMatrix(pivots);

const MONTH_NAMES=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

let found = null;

outer:
for (const analysisYear of [TARGET_YEAR, TARGET_YEAR-1, TARGET_YEAR+1]) {
  for (let mi=0; mi<12; mi++) {
    const conf = getConfluence(matrix, analysisYear, mi);
    for (const [day, arr] of Object.entries(conf)) {
      const mm = String(mi+1).padStart(2,'0');
      const confDate = `${analysisYear}-${mm}-${day.padStart(2,'0')}`;

      // Find ref bar (conf date or next trading day in same month)
      let refDate = rawMap[confDate] ? confDate : null;
      if (!refDate) {
        const nd = rawOHLC.find(r=>r.date>confDate && r.date<=`${analysisYear}-${mm}-31`);
        refDate = nd?.date||null;
      }
      if (!refDate) continue;

      const refBar = rawMap[refDate];
      const confLow  = refBar.low;
      const confHigh = refBar.high;
      const entryZoneTop = +(confLow * 1.003).toFixed(2);

      // Entry day = next trading day after refDate
      const refIdx = rawIdx[refDate];
      if (refIdx===undefined||refIdx>=rawOHLC.length-1) continue;
      const entryDate = rawOHLC[refIdx+1].date;
      const entryCandles = intraday[entryDate]||[];
      if (!entryCandles.length) continue;

      // Look for entry: first hourly close within 0.3% above confLow (close <= entryZoneTop)
      let ep=null, entryTime=null, trigIdx=-1;
      for (let ci=0;ci<entryCandles.length;ci++) {
        const c = entryCandles[ci];
        if (c.close <= entryZoneTop && c.close >= confLow) {
          ep = c.close; entryTime = c.time; trigIdx = ci; break;
        }
      }
      if (!ep) continue;
      if (FORCE_CONF_DATE && confDate !== FORCE_CONF_DATE) continue;

      found = {
        sym: SYM, analysisYear, confDate, refDate,
        confLow, confHigh, entryZoneTop,
        entryDate, entryTime, ep,
        cfType: arr.some(e=>e.type==='H')&&arr.some(e=>e.type==='L')?'HL':arr[0].type,
        cfCount: arr.length,
        trigIdx, entryCandles, rawOHLC, rawMap, rawIdx, intraday,
      };
      break outer;
    }
  }
}

if (!found) {
  console.log(`No trade found for ${SYM} around ${TARGET_YEAR}`);
  process.exit(1);
}

const f = found;
console.log(`\n  Symbol     : ${f.sym}`);
console.log(`  Conf Date  : ${f.confDate}  (${f.cfType}×${f.cfCount})`);
console.log(`  Conf Low   : ${f.confLow}   ← SL level`);
console.log(`  Conf High  : ${f.confHigh}  ← daily close above this = hold`);
console.log(`  Entry Zone : ≤ ${f.entryZoneTop} (within 0.3% of conf Low)`);
console.log(`  Entry Day  : ${f.entryDate}  at ${f.entryTime}  ep=${f.ep}`);
console.log(`  Risk (1R)  : ${+(f.ep - f.confLow).toFixed(2)}`);

// ── Simulate exit ─────────────────────────────────────────────────────
// Each day: if daily close > confHigh → hold (SL stays at confLow, skip intraday SL)
//           else → check each hourly close < confLow → exit
const confLow  = f.confLow;
const confHigh = f.confHigh;
const ep       = f.ep;
const risk     = ep - confLow;

let outcome='open', exitDate='', exitTime='', exitPrice=0;
let prevDayAboveHigh = false; // for the entry day, assume not yet confirmed
let dayLog = [];

// Entry day candles (from trigIdx onwards)
{
  let dailyHigh=-Infinity, dailyLow=Infinity, dailyClose=0;
  let exitThisDay=false;
  for (let ci=f.trigIdx; ci<f.entryCandles.length; ci++) {
    const c = f.entryCandles[ci];
    dailyHigh = Math.max(dailyHigh, c.high);
    dailyLow  = Math.min(dailyLow, c.low);
    dailyClose = c.close;
    // on entry day we always check SL (prevDayAboveHigh=false)
    if (!prevDayAboveHigh && c.close < confLow) {
      outcome='SL'; exitDate=f.entryDate; exitTime=c.time; exitPrice=confLow; exitThisDay=true; break;
    }
  }
  const aboveHigh = dailyClose > confHigh;
  dayLog.push({ date:f.entryDate, open:f.entryCandles[f.trigIdx]?.open, high:dailyHigh, low:dailyLow, close:dailyClose, aboveHigh, note: exitThisDay?'SL EXIT':aboveHigh?'ABOVE HIGH – hold':'BELOW HIGH – watching SL' });
  if (exitThisDay) { /* done */ }
  else prevDayAboveHigh = aboveHigh;
}

// Subsequent days
if (outcome==='open') {
  for (let di=f.rawIdx[f.entryDate]+1; di<f.rawOHLC.length && outcome==='open'; di++) {
    const dayRow  = f.rawOHLC[di];
    const date    = dayRow.date;
    const candles = f.intraday[date]||[];
    let exitThisDay=false;
    let dailyClose = dayRow.close;

    if (candles.length) {
      let dH=-Infinity,dL=Infinity;
      for (const c of candles) {
        dH=Math.max(dH,c.high); dL=Math.min(dL,c.low); dailyClose=c.close;
        if (!prevDayAboveHigh && c.close < confLow) {
          outcome='SL'; exitDate=date; exitTime=c.time; exitPrice=confLow; exitThisDay=true; break;
        }
      }
      const aboveHigh = dailyClose > confHigh;
      dayLog.push({ date, high:dH, low:dL, close:dailyClose, aboveHigh, note: exitThisDay?'SL EXIT':aboveHigh?'ABOVE HIGH – hold':'BELOW HIGH – watching SL' });
      if (!exitThisDay) prevDayAboveHigh = aboveHigh;
    } else {
      if (!prevDayAboveHigh && dayRow.low < confLow) {
        outcome='SL'; exitDate=date; exitTime='EOD'; exitPrice=confLow; exitThisDay=true;
      }
      const aboveHigh = dailyClose > confHigh;
      dayLog.push({ date, high:dayRow.high, low:dayRow.low, close:dailyClose, aboveHigh, note: exitThisDay?'SL EXIT':aboveHigh?'ABOVE HIGH – hold':'BELOW HIGH – watching SL' });
      if (!exitThisDay) prevDayAboveHigh = aboveHigh;
    }

    // Cap display at 30 days
    if (dayLog.length >= 30 && outcome==='open') {
      dayLog.push({ date:'...', note:'(capped at 30 days, trade still open)' });
      break;
    }
  }
}

const rMult = outcome!=='open' ? +((exitPrice-ep)/risk).toFixed(2) : null;
console.log(`\n  Exit       : ${outcome}  ${exitDate} ${exitTime}  @ ${exitPrice}  R=${rMult??'open'}`);

console.log(`\n  ─── Day-by-day log ───────────────────────────────────────────`);
console.log(`  ${'Date'.padEnd(12)} ${'Close'.padStart(8)} ${'vs High'.padEnd(12)} Note`);
dayLog.forEach(d=>{
  if(d.date==='...') { console.log(`  ...`); return; }
  const cls = d.close ? d.close.toFixed(2).padStart(8) : '        ';
  const vh  = d.aboveHigh!==undefined ? (d.aboveHigh ? '>HIGH ✓' : '≤HIGH ✗') : '';
  console.log(`  ${d.date.padEnd(12)} ${cls} ${vh.padEnd(12)} ${d.note||''}`);
});

// ── Generate HTML chart ───────────────────────────────────────────────
const allDates = [f.entryDate, ...dayLog.map(d=>d.date).filter(d=>d!=='...')];
const chartBars = [];

// Entry day candles (from trigIdx)
{
  const candles = f.entryCandles.slice(f.trigIdx);
  if (candles.length) {
    chartBars.push({ date:f.entryDate, type:'candles', candles,
      open:candles[0].open, high:Math.max(...candles.map(c=>c.high)),
      low:Math.min(...candles.map(c=>c.low)), close:candles[candles.length-1].close });
  }
}
for (let di=f.rawIdx[f.entryDate]+1; di<f.rawOHLC.length; di++) {
  const d = f.rawOHLC[di];
  if (outcome!=='open' && d.date > exitDate) break;
  if (d.date > exitDate && outcome!=='open') break;
  const candles = f.intraday[d.date]||[];
  chartBars.push({ date:d.date, type:'candles', candles,
    open:d.open, high:d.high, low:d.low, close:d.close });
  if (d.date === exitDate) break;
  if (chartBars.length > 25) break;
}

const allHighs = chartBars.map(b=>b.high).filter(Boolean);
const allLows  = chartBars.map(b=>b.low).filter(Boolean);
const chartMax = Math.max(...allHighs, confHigh) * 1.005;
const chartMin = Math.min(...allLows,  confLow)  * 0.995;

const W=900, H=420, PL=70, PR=20, PT=20, PB=60;
const cw=W-PL-PR, ch=H-PT-PB;
const n = chartBars.length;
const barW = Math.min(28, Math.floor(cw/n)-2);
const sx = i => PL + (i+0.5)*(cw/n);
const sy = v => PT + ch - (v-chartMin)/(chartMax-chartMin)*ch;

// Y gridlines
let yGrid='', yAxis='';
const ySteps=6;
for(let i=0;i<=ySteps;i++){
  const v=chartMin+i*(chartMax-chartMin)/ySteps;
  const y=sy(v).toFixed(1);
  yGrid+=`<line x1="${PL}" y1="${y}" x2="${W-PR}" y2="${y}" stroke="#30363d" stroke-opacity=".5"/>`;
  yAxis+=`<text x="${PL-4}" y="${y}" fill="#8b949e" font-size="10" text-anchor="end" dominant-baseline="middle">${v.toFixed(1)}</text>`;
}

// Key levels
const slY   = sy(confLow).toFixed(1);
const hiY   = sy(confHigh).toFixed(1);
const epY   = sy(ep).toFixed(1);
const ezY   = sy(f.entryZoneTop).toFixed(1);

const levels=`
<line x1="${PL}" y1="${slY}" x2="${W-PR}" y2="${slY}" stroke="#f85149" stroke-width="1.5" stroke-dasharray="6,3"/>
<text x="${W-PR+2}" y="${slY}" fill="#f85149" font-size="10" dominant-baseline="middle">SL ${confLow}</text>
<line x1="${PL}" y1="${hiY}" x2="${W-PR}" y2="${hiY}" stroke="#3fb950" stroke-width="1.5" stroke-dasharray="6,3"/>
<text x="${W-PR+2}" y="${hiY}" fill="#3fb950" font-size="10" dominant-baseline="middle">CF Hi ${confHigh}</text>
<rect x="${PL}" y="${ezY}" width="${cw}" height="${parseFloat(slY)-parseFloat(ezY)}" fill="#58a6ff" fill-opacity=".07"/>
<line x1="${PL}" y1="${ezY}" x2="${W-PR}" y2="${ezY}" stroke="#58a6ff" stroke-width="1" stroke-dasharray="3,3"/>
<text x="${W-PR+2}" y="${ezY}" fill="#58a6ff" font-size="10" dominant-baseline="middle">+0.3% ${f.entryZoneTop}</text>
<circle cx="${sx(0).toFixed(1)}" cy="${epY}" r="5" fill="#58a6ff" opacity=".9"/>
<text x="${sx(0).toFixed(1)}" y="${parseFloat(epY)-10}" fill="#58a6ff" font-size="10" text-anchor="middle">EP ${ep}</text>
`;

// Bars
let bars='';
chartBars.forEach((b,i) => {
  const x=sx(i).toFixed(1);
  const isGreen = b.close >= b.open;
  const col = isGreen ? '#3fb950' : '#f85149';
  const aboveHigh = b.close > confHigh;
  const bgCol = aboveHigh ? 'rgba(63,185,80,.06)' : 'rgba(248,81,73,.04)';
  const bw = (cw/n);
  bars += `<rect x="${(sx(i)-bw/2).toFixed(1)}" y="${PT}" width="${bw.toFixed(1)}" height="${ch}" fill="${bgCol}"/>`;
  if(b.high&&b.low){
    bars += `<line x1="${x}" y1="${sy(b.high).toFixed(1)}" x2="${x}" y2="${sy(b.low).toFixed(1)}" stroke="${col}" stroke-width="1.2"/>`;
    const oy=sy(Math.max(b.open,b.close)).toFixed(1), cy2=sy(Math.min(b.open,b.close)).toFixed(1);
    const bh=Math.max(2,parseFloat(oy)-parseFloat(cy2));
    bars += `<rect x="${(sx(i)-barW/2).toFixed(1)}" y="${oy}" width="${barW}" height="${bh}" fill="${col}" opacity=".85"/>`;
  }
  // date label
  bars += `<text x="${x}" y="${PT+ch+14}" fill="#8b949e" font-size="9" text-anchor="middle" transform="rotate(-45,${x},${PT+ch+14})">${b.date.slice(5)}</text>`;
});

// Exit marker
if (outcome!=='open' && exitDate) {
  const xi = chartBars.findIndex(b=>b.date===exitDate);
  if (xi>=0) {
    const xp=sx(xi).toFixed(1), yp=sy(exitPrice).toFixed(1);
    bars+=`<circle cx="${xp}" cy="${yp}" r="6" fill="#f85149" opacity=".9"/>`;
    bars+=`<text x="${xp}" y="${parseFloat(yp)-12}" fill="#f85149" font-size="10" text-anchor="middle">${outcome}</text>`;
  }
}

const svg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:${W}px;display:block">
${yGrid}${yAxis}${levels}${bars}
</svg>`;

const html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Trade Example — ${f.sym} ${f.confDate}</title>
<style>
  body{background:#0d1117;color:#c9d1d9;font-family:'Segoe UI',sans-serif;font-size:12px;padding:20px}
  h2{color:#58a6ff;margin-bottom:4px}
  .meta{color:#8b949e;margin-bottom:16px;font-size:11px;line-height:1.7}
  .meta b{color:#c9d1d9}
  table{border-collapse:collapse;margin-top:16px;width:100%}
  th{background:#161b22;color:#8b949e;font-size:10px;text-transform:uppercase;padding:6px 10px;border:1px solid #30363d;text-align:left}
  td{border:1px solid #30363d;padding:4px 10px;white-space:nowrap}
  .pos{color:#3fb950;font-weight:600} .neg{color:#f85149;font-weight:600} .neu{color:#8b949e}
  .hi{background:rgba(63,185,80,.06)} .lo{background:rgba(248,81,73,.04)}
</style></head><body>
<h2>${f.sym} — Trade Example (New Entry/Exit Logic)</h2>
<div class="meta">
  <b>Confluence Date:</b> ${f.confDate} (${f.cfType}×${f.cfCount}) &nbsp;|&nbsp;
  <b>Conf Low (SL):</b> ${confLow} &nbsp;|&nbsp;
  <b>Conf High:</b> ${confHigh}<br>
  <b>Entry Zone:</b> ≤ ${f.entryZoneTop} (within 0.3% above conf Low) &nbsp;|&nbsp;
  <b>Entry:</b> ${f.entryDate} @ ${f.entryTime} → ep = ${ep}<br>
  <b>Risk (1R):</b> ${risk.toFixed(2)} &nbsp;|&nbsp;
  <b>Exit:</b> ${outcome} on ${exitDate} ${exitTime} @ ${exitPrice}  R = ${rMult??'open'}<br><br>
  <b>Exit Logic:</b> Daily close <span class="pos">above conf High</span> → hold (SL stays at conf Low).
  Daily close <span class="neg">≤ conf High</span> → monitor hourly; exit if hourly close &lt; conf Low.
</div>
${svg}
<table>
<thead><tr><th>Date</th><th>High</th><th>Low</th><th>Close</th><th>vs Conf High</th><th>Action</th></tr></thead>
<tbody>
${dayLog.filter(d=>d.date!=='...').map(d=>`<tr class="${d.aboveHigh?'hi':'lo'}">
  <td>${d.date}</td>
  <td>${d.high?.toFixed(2)||''}</td>
  <td>${d.low?.toFixed(2)||''}</td>
  <td>${d.close?.toFixed(2)||''}</td>
  <td class="${d.aboveHigh?'pos':'neg'}">${d.aboveHigh!==undefined?(d.aboveHigh?'> HIGH ✓':'≤ HIGH — watch SL'):''}</td>
  <td>${d.note||''}</td>
</tr>`).join('')}
</tbody></table>
</body></html>`;

const out = 'j:/GANN Claude/Backtest/trade_example.html';
fs.writeFileSync(out, html, 'utf8');
console.log(`\n  → HTML: ${out}`);
