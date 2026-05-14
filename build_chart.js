// Generates Gann/reports/<SYMBOL>_zigzag.html for all NIFTY50 stocks
// + Gann/reports/index.html for navigation
// Usage: node build_chart.js

const fs = require('fs');
const path = require('path');

// ── Name mapping & display names ─────────────────────────────
const HIST_NAMES = {
  BHARTIARTL: ['BHARTI','BHARTIARTL'],
  HINDUNILVR: ['HINDLEVER','HINDUNILVR'],
  INFY:       ['INFOSYSTCH','INFY'],
  JSWSTEEL:   ['JSWSTL','JSWSTEEL'],
  HINDALCO:   ['HINDALC0','HINDALCO'],
  TATASTEEL:  ['TISCO','TATASTEEL'],
  TATAMOTORS: ['TELCO','TATAMOTORS'],
  AXISBANK:   ['UTIBANK','AXISBANK'],
  KOTAKBANK:  ['KOTAKMAH','KOTAKBANK'],
  HEROMOTOCO: ['HEROHONDA','HEROMOTOCO'],
  BAJFINANCE: ['BAJAUTOFIN','BAJFINANCE'],
};

const INSTRUMENTS = [
  { sym:'ADANIENT',   name:'Adani Enterprises'       },
  { sym:'ADANIPORTS', name:'Adani Ports'              },
  { sym:'APOLLOHOSP', name:'Apollo Hospitals'         },
  { sym:'ASIANPAINT', name:'Asian Paints'             },
  { sym:'AXISBANK',   name:'Axis Bank'                },
  { sym:'BAJAJ-AUTO', name:'Bajaj Auto'               },
  { sym:'BAJAJFINSV', name:'Bajaj Finserv'            },
  { sym:'BAJFINANCE', name:'Bajaj Finance'            },
  { sym:'BHARTIARTL', name:'Bharti Airtel'            },
  { sym:'BPCL',       name:'BPCL'                     },
  { sym:'BRITANNIA',  name:'Britannia'                },
  { sym:'CIPLA',      name:'Cipla'                    },
  { sym:'COALINDIA',  name:'Coal India'               },
  { sym:'DRREDDY',    name:"Dr. Reddy's"              },
  { sym:'EICHERMOT',  name:'Eicher Motors'            },
  { sym:'GRASIM',     name:'Grasim'                   },
  { sym:'HCLTECH',    name:'HCL Technologies'         },
  { sym:'HDFCBANK',   name:'HDFC Bank'                },
  { sym:'HDFCLIFE',   name:'HDFC Life'                },
  { sym:'HEROMOTOCO', name:'Hero MotoCorp'            },
  { sym:'HINDALCO',   name:'Hindalco'                 },
  { sym:'HINDUNILVR', name:'Hindustan Unilever'       },
  { sym:'ICICIBANK',  name:'ICICI Bank'               },
  { sym:'INDUSINDBK', name:'IndusInd Bank'            },
  { sym:'INFY',       name:'Infosys'                  },
  { sym:'ITC',        name:'ITC'                      },
  { sym:'JSWSTEEL',   name:'JSW Steel'                },
  { sym:'KOTAKBANK',  name:'Kotak Mahindra Bank'      },
  { sym:'LT',         name:'Larsen & Toubro'          },
  { sym:'M&M',        name:'Mahindra & Mahindra'      },
  { sym:'MARUTI',     name:'Maruti Suzuki'            },
  { sym:'NESTLEIND',  name:'Nestle India'             },
  { sym:'NTPC',       name:'NTPC'                     },
  { sym:'ONGC',       name:'ONGC'                     },
  { sym:'POWERGRID',  name:'Power Grid'               },
  { sym:'RELIANCE',   name:'Reliance Industries'      },
  { sym:'SBIN',       name:'SBI'                      },
  { sym:'SHRIRAMFIN', name:'Shriram Finance'          },
  { sym:'SUNPHARMA',  name:'Sun Pharma'               },
  { sym:'TATACONSUM', name:'Tata Consumer'            },
  { sym:'TATAMOTORS', name:'Tata Motors'              },
  { sym:'TATASTEEL',  name:'Tata Steel'               },
  { sym:'TCS',        name:'TCS'                      },
  { sym:'TECHM',      name:'Tech Mahindra'            },
  { sym:'TITAN',      name:'Titan'                    },
  { sym:'TRENT',      name:'Trent'                    },
  { sym:'ULTRACEMCO', name:'UltraTech Cement'         },
  { sym:'WIPRO',      name:'Wipro'                    },
  { sym:'ZOMATO',     name:'Zomato'                   },
];

// ── CSV helpers ───────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g,''));
  return lines.slice(1).map(line => {
    const cols = line.split(',');
    const obj = {};
    headers.forEach((h,i) => { obj[h] = (cols[i]||'').trim().replace(/^"|"$/g,''); });
    return obj;
  });
}

let _src1Cache = null;
function getSrc1() {
  if (!_src1Cache) {
    console.error('Loading NIFTY50_all.csv...');
    _src1Cache = parseCSV(fs.readFileSync('j:/GANN Claude/Dataset/NIFTY50_all.csv','utf8'));
  }
  return _src1Cache;
}

function loadFromSrc1(symbols) {
  const symSet = new Set(symbols);
  return getSrc1()
    .filter(r => symSet.has(r.Symbol))
    .map(r => ({
      date:  r.Date.trim(),
      open:  parseFloat(r.Open  || r['Prev Close'] || 0),
      high:  parseFloat(r.High  || 0),
      low:   parseFloat(r.Low   || 0),
      close: parseFloat(r.Close || r.Last || 0),
    }))
    .filter(r => r.date && r.high > 0);
}

function loadFromProcessed(sym) {
  const p = `j:/Swing Trading/Swing Trading/processed/${sym}.csv`;
  if (!fs.existsSync(p)) return [];
  return parseCSV(fs.readFileSync(p,'utf8'))
    .map(r => ({
      date:  (r.Date||r.date||'').trim(),
      open:  parseFloat(r.Open ||r.open ||0),
      high:  parseFloat(r.High ||r.high ||0),
      low:   parseFloat(r.Low  ||r.low  ||0),
      close: parseFloat(r.Close||r.close||0),
    }))
    .filter(r => r.date && r.high > 0);
}

function mergeRows(sym) {
  const histNames = HIST_NAMES[sym] || [sym];
  const rows = loadFromSrc1(histNames);
  const rows2 = loadFromProcessed(sym);
  const existing = new Set(rows.map(r => r.date));
  rows2.forEach(r => { if (!existing.has(r.date)) rows.push(r); });
  return rows
    .filter(r => r.date >= '2000-01-01')
    .sort((a,b) => a.date.localeCompare(b.date));
}

// ── Chart HTML generator ──────────────────────────────────────
function buildChartHTML(sym, name, rows, allInstruments) {
  const dataStart = rows[0]?.date || 'n/a';
  const dataEnd   = rows[rows.length-1]?.date || 'n/a';

  const candleJS = rows.map(r =>
    `{time:'${r.date}',open:${r.open.toFixed(2)},high:${r.high.toFixed(2)},low:${r.low.toFixed(2)},close:${r.close.toFixed(2)}}`
  ).join(',');

  // Navigation options for the dropdown
  const navOptions = allInstruments.map(inst =>
    `<option value="${inst.sym}_zigzag.html"${inst.sym===sym?' selected':''}>${inst.name} (${inst.sym})</option>`
  ).join('\n        ');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${name} (${sym}) – ZigZag Chart</title>
<script src="https://unpkg.com/lightweight-charts@4.1.3/dist/lightweight-charts.standalone.production.js"><\/script>
<style>
  :root { --bg:#0d1117; --panel:#161b22; --border:#30363d; --accent:#58a6ff; --green:#3fb950; --red:#f85149; --orange:#e3b341; --text:#c9d1d9; --sub:#8b949e; }
  * { box-sizing:border-box; margin:0; padding:0; }
  html,body { height:100%; }
  body { background:var(--bg); color:var(--text); font-family:'Segoe UI',system-ui,sans-serif; display:flex; flex-direction:column; height:100vh; overflow:hidden; }

  .header { padding:10px 16px; background:var(--panel); border-bottom:1px solid var(--border); display:flex; align-items:center; gap:16px; flex-wrap:wrap; flex-shrink:0; }
  .title { color:var(--accent); font-size:15px; font-weight:700; white-space:nowrap; }
  .sym-tag { color:var(--sub); font-size:12px; }
  .badge { background:#1a2a3a; border:1px solid var(--border); border-radius:4px; padding:2px 8px; font-size:11px; color:var(--sub); white-space:nowrap; }
  .badge span { color:var(--orange); font-weight:700; }

  select.nav-select { background:var(--bg); border:1px solid var(--border); color:var(--accent); border-radius:5px; padding:4px 8px; font-size:12px; cursor:pointer; margin-left:auto; max-width:220px; }
  select.nav-select option { background:var(--bg); }

  .toolbar { padding:6px 16px; background:var(--panel); border-bottom:1px solid var(--border); display:flex; gap:8px; align-items:center; flex-shrink:0; flex-wrap:wrap; }
  .sep { width:1px; height:18px; background:var(--border); margin:0 4px; }
  .ctrl-label { font-size:10px; color:var(--sub); text-transform:uppercase; letter-spacing:.4px; }
  .btn { background:#21262d; border:1px solid var(--border); color:var(--text); border-radius:4px; padding:3px 10px; font-size:11px; cursor:pointer; transition:all .15s; }
  .btn:hover { border-color:var(--accent); color:var(--accent); }
  .btn.active { background:#388bfd22; border-color:var(--accent); color:var(--accent); }
  select.ctrl-sel { background:#21262d; border:1px solid var(--border); color:var(--text); border-radius:4px; padding:3px 8px; font-size:11px; cursor:pointer; }
  select.ctrl-sel option { background:var(--bg); }

  .chart-wrap { flex:1; position:relative; min-height:0; }
  #chart { width:100%; height:100%; }

  .legend { position:absolute; top:8px; left:10px; z-index:10; background:#161b22cc; border:1px solid var(--border); border-radius:6px; padding:7px 11px; font-size:11px; line-height:1.9; pointer-events:none; backdrop-filter:blur(4px); }
  .lh { color:var(--green); } .ll { color:var(--red); } .lo { color:var(--orange); }

  .pivot-strip { padding:5px 16px; background:var(--bg); border-top:1px solid var(--border); max-height:80px; overflow-y:auto; display:flex; flex-wrap:wrap; gap:3px; flex-shrink:0; }
  .pv { font-size:10px; border-radius:3px; padding:1px 5px; cursor:default; }
  .pv-h { background:#0d2818; color:var(--green); border:1px solid #1a4a28; }
  .pv-l { background:#2d1010; color:var(--red);   border:1px solid #4a1a1a; }
</style>
</head>
<body>

<div class="header">
  <div>
    <span class="title">${name}</span>
    <span class="sym-tag"> · ${sym} · NSE Daily</span>
  </div>
  <span class="badge">Data <span>${dataStart} → ${dataEnd}</span></span>
  <span class="badge">Rows <span>${rows.length.toLocaleString()}</span></span>
  <span class="badge">Pivots <span id="pivotCount">—</span></span>
  <select class="nav-select" onchange="location.href=this.value" title="Switch instrument">
        ${navOptions}
  </select>
</div>

<div class="toolbar">
  <span class="ctrl-label">Range:</span>
  <button class="btn" onclick="setRange(1)">1Y</button>
  <button class="btn" onclick="setRange(3)">3Y</button>
  <button class="btn" onclick="setRange(5)">5Y</button>
  <button class="btn active" id="btnAll" onclick="setRange(0)">All</button>
  <div class="sep"></div>
  <span class="ctrl-label">ZigZag Deviation:</span>
  <select class="ctrl-sel" id="devSel" onchange="recompute()">
    <option value="2">2%</option>
    <option value="3">3%</option>
    <option value="4" selected>4%</option>
    <option value="5">5%</option>
    <option value="7">7%</option>
    <option value="10">10%</option>
    <option value="15">15%</option>
  </select>
  <span class="ctrl-label">Min Bars:</span>
  <select class="ctrl-sel" id="depSel" onchange="recompute()">
    <option value="5">5</option>
    <option value="8">8</option>
    <option value="10" selected>10</option>
    <option value="12">12</option>
    <option value="15">15</option>
    <option value="20">20</option>
  </select>
</div>

<div class="chart-wrap">
  <div class="legend">
    <div><span class="lh">▲</span> Swing High &nbsp; <span class="ll">▼</span> Swing Low</div>
    <div><span class="lo">――</span> ZigZag line</div>
  </div>
  <div id="chart"></div>
</div>

<div class="pivot-strip" id="pivotStrip"></div>

<script>
const CANDLES = [${candleJS}];

// ── ZigZag ────────────────────────────────────────────────────
function computeZigZag(bars, deviation, depth) {
  const pivots = [];
  if (!bars.length) return pivots;
  let trend = null;
  let lhP = bars[0].high, lhD = bars[0].time, lhI = 0;
  let llP = bars[0].low,  llD = bars[0].time, llI = 0;
  for (let i = 1; i < bars.length; i++) {
    const {time, high, low} = bars[i];
    if (trend === null || trend === 'UP') {
      if (high >= lhP) { lhP=high; lhD=time; lhI=i; }
      if (low <= lhP*(1-deviation/100) && (i-lhI)>=depth) {
        pivots.push({time:lhD, value:lhP, type:'H'});
        trend='DOWN'; llP=low; llD=time; llI=i;
      }
    }
    if (trend === 'DOWN') {
      if (low <= llP) { llP=low; llD=time; llI=i; }
      if (high >= llP*(1+deviation/100) && (i-llI)>=depth) {
        pivots.push({time:llD, value:llP, type:'L'});
        trend='UP'; lhP=high; lhD=time; lhI=i;
      }
    }
  }
  if (trend==='UP')   pivots.push({time:lhD, value:lhP, type:'H'});
  else if (trend==='DOWN') pivots.push({time:llD, value:llP, type:'L'});
  return pivots;
}

// ── Chart setup ───────────────────────────────────────────────
const chartEl = document.getElementById('chart');
const chart = LightweightCharts.createChart(chartEl, {
  layout: { background:{color:'#0d1117'}, textColor:'#8b949e' },
  grid:   { vertLines:{color:'#21262d'}, horzLines:{color:'#21262d'} },
  crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
  rightPriceScale: { borderColor:'#30363d' },
  timeScale: { borderColor:'#30363d', timeVisible:true },
  width:  chartEl.clientWidth,
  height: chartEl.clientHeight,
});

const candleSeries = chart.addCandlestickSeries({
  upColor:'#3fb950', downColor:'#f85149',
  borderUpColor:'#3fb950', borderDownColor:'#f85149',
  wickUpColor:'#3fb950', wickDownColor:'#f85149',
});
candleSeries.setData(CANDLES);

const zzSeries = chart.addLineSeries({
  color:'#e3b341', lineWidth:2,
  crosshairMarkerVisible:false,
  lastValueVisible:false, priceLineVisible:false,
});

new ResizeObserver(() => {
  chart.applyOptions({width:chartEl.clientWidth, height:chartEl.clientHeight});
}).observe(chartEl);

// ── Compute + render ZigZag ───────────────────────────────────
function recompute() {
  const dev = parseFloat(document.getElementById('devSel').value);
  const dep = parseInt(document.getElementById('depSel').value);
  const pivots = computeZigZag(CANDLES, dev, dep);

  zzSeries.setData(pivots.map(p => ({time:p.time, value:p.value})));

  candleSeries.setMarkers(pivots.map(p => ({
    time:     p.time,
    position: p.type==='H' ? 'aboveBar' : 'belowBar',
    color:    p.type==='H' ? '#3fb950' : '#f85149',
    shape:    p.type==='H' ? 'arrowDown' : 'arrowUp',
    text:     p.type==='H' ? 'H' : 'L',
    size: 1,
  })));

  document.getElementById('pivotCount').textContent = pivots.length;

  const strip = document.getElementById('pivotStrip');
  strip.innerHTML = '';
  pivots.slice().reverse().forEach(p => {
    const d = document.createElement('div');
    d.className = 'pv pv-' + p.type.toLowerCase();
    d.title = p.type==='H' ? 'Swing High' : 'Swing Low';
    d.textContent = p.time + ' ' + p.type + ' ' + p.value.toLocaleString('en-IN',{maximumFractionDigits:2});
    strip.appendChild(d);
  });
}

// ── Range buttons ─────────────────────────────────────────────
const rangeBtns = document.querySelectorAll('.btn');
function setRange(years) {
  rangeBtns.forEach(b => b.classList.remove('active'));
  event.target.classList.add('active');
  if (years === 0) { chart.timeScale().fitContent(); return; }
  const now  = new Date();
  const from = new Date(now);
  from.setFullYear(from.getFullYear() - years);
  chart.timeScale().setVisibleRange({
    from: Math.floor(from.getTime()/1000),
    to:   Math.floor(now.getTime()/1000),
  });
}

recompute();
chart.timeScale().fitContent();
<\/script>
</body>
</html>`;
}

// ── Index HTML ────────────────────────────────────────────────
function buildIndexHTML(instruments, stats) {
  const cards = instruments.map(({ sym, name }) => {
    const s = stats[sym];
    return `
    <a class="card" href="${sym}_zigzag.html">
      <div class="card-sym">${sym}</div>
      <div class="card-name">${name}</div>
      <div class="card-meta">
        <span>${s.rows.toLocaleString()} rows</span>
        <span>${s.from} → ${s.to.substring(2)}</span>
      </div>
    </a>`;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Gann ZigZag Charts – NIFTY50</title>
<style>
  :root { --bg:#0d1117; --panel:#161b22; --border:#30363d; --accent:#58a6ff; --text:#c9d1d9; --sub:#8b949e; --orange:#e3b341; }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { background:var(--bg); color:var(--text); font-family:'Segoe UI',system-ui,sans-serif; padding:28px; }
  h1 { color:var(--accent); font-size:20px; margin-bottom:4px; }
  .sub { color:var(--sub); font-size:12px; margin-bottom:28px; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(190px,1fr)); gap:12px; }
  .card { display:block; background:var(--panel); border:1px solid var(--border); border-radius:8px; padding:14px 16px; text-decoration:none; transition:border-color .15s,background .15s; }
  .card:hover { border-color:var(--accent); background:#161b2a; }
  .card-sym  { color:var(--accent); font-size:14px; font-weight:700; margin-bottom:3px; }
  .card-name { color:var(--text); font-size:12px; margin-bottom:8px; }
  .card-meta { display:flex; flex-direction:column; gap:2px; }
  .card-meta span { color:var(--sub); font-size:10px; }
</style>
</head>
<body>
<h1>Gann ZigZag Charts — NIFTY 50</h1>
<p class="sub">Click any stock to open its interactive ZigZag chart. All charts support dynamic deviation % and depth settings.</p>
<div class="grid">${cards}</div>
</body>
</html>`;
}

// ── Main ──────────────────────────────────────────────────────
const outDir = 'j:/GANN Claude/Gann/reports';
fs.mkdirSync(outDir, { recursive: true });

const stats = {};
let count = 0;

for (const { sym, name } of INSTRUMENTS) {
  process.stderr.write(`[${++count}/${INSTRUMENTS.length}] ${sym} – ${name}... `);
  const rows = mergeRows(sym);
  stats[sym] = {
    rows: rows.length,
    from: rows[0]?.date || 'n/a',
    to:   rows[rows.length-1]?.date || 'n/a',
  };
  const html = buildChartHTML(sym, name, rows, INSTRUMENTS);
  fs.writeFileSync(path.join(outDir, `${sym}_zigzag.html`), html, 'utf8');
  const kb = Math.round(fs.statSync(path.join(outDir, `${sym}_zigzag.html`)).size / 1024);
  console.error(`${rows.length} rows, ${kb} KB`);
}

const indexHTML = buildIndexHTML(INSTRUMENTS, stats);
fs.writeFileSync(path.join(outDir, 'index.html'), indexHTML, 'utf8');
console.error(`\nDone. ${INSTRUMENTS.length} charts + index.html written to ${outDir}`);
