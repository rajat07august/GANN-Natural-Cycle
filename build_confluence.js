// Builds Gann/6/confluence.html
// Date-centric view: for a selected Month + Analysis Year,
// shows every date that has Gann confluence in ≥1 stock,
// grouped by date so you can see multi-stock alignment at a glance.
// node build_confluence.js

const fs   = require('fs');
const path = require('path');

// ── Same name mapping & instruments as build_trial.js ────────
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
  { sym:'NIFTY',      name:'NIFTY 50 (Index)',        isIndex:true  },
  { sym:'ADANIENT',   name:'Adani Enterprises'                      },
  { sym:'ADANIPORTS', name:'Adani Ports'                            },
  { sym:'APOLLOHOSP', name:'Apollo Hospitals'                       },
  { sym:'ASIANPAINT', name:'Asian Paints'                           },
  { sym:'AXISBANK',   name:'Axis Bank'                              },
  { sym:'BAJAJ-AUTO', name:'Bajaj Auto'                             },
  { sym:'BAJAJFINSV', name:'Bajaj Finserv'                          },
  { sym:'BAJFINANCE', name:'Bajaj Finance'                          },
  { sym:'BHARTIARTL', name:'Bharti Airtel'                          },
  { sym:'BPCL',       name:'BPCL'                                   },
  { sym:'BRITANNIA',  name:'Britannia'                              },
  { sym:'CIPLA',      name:'Cipla'                                  },
  { sym:'COALINDIA',  name:'Coal India'                             },
  { sym:'DRREDDY',    name:"Dr. Reddy's"                            },
  { sym:'EICHERMOT',  name:'Eicher Motors'                          },
  { sym:'GRASIM',     name:'Grasim'                                 },
  { sym:'HCLTECH',    name:'HCL Technologies'                       },
  { sym:'HDFCBANK',   name:'HDFC Bank'                              },
  { sym:'HDFCLIFE',   name:'HDFC Life'                              },
  { sym:'HEROMOTOCO', name:'Hero MotoCorp'                          },
  { sym:'HINDALCO',   name:'Hindalco'                               },
  { sym:'HINDUNILVR', name:'Hindustan Unilever'                     },
  { sym:'ICICIBANK',  name:'ICICI Bank'                             },
  { sym:'INDUSINDBK', name:'IndusInd Bank'                          },
  { sym:'INFY',       name:'Infosys'                                },
  { sym:'ITC',        name:'ITC'                                    },
  { sym:'JSWSTEEL',   name:'JSW Steel'                              },
  { sym:'KOTAKBANK',  name:'Kotak Mahindra Bank'                    },
  { sym:'LT',         name:'Larsen & Toubro'                        },
  { sym:'M&M',        name:'Mahindra & Mahindra'                    },
  { sym:'MARUTI',     name:'Maruti Suzuki'                          },
  { sym:'NESTLEIND',  name:'Nestle India'                           },
  { sym:'NTPC',       name:'NTPC'                                   },
  { sym:'ONGC',       name:'ONGC'                                   },
  { sym:'POWERGRID',  name:'Power Grid'                             },
  { sym:'RELIANCE',   name:'Reliance Industries'                    },
  { sym:'SBIN',       name:'SBI'                                    },
  { sym:'SHRIRAMFIN', name:'Shriram Finance'                        },
  { sym:'SUNPHARMA',  name:'Sun Pharma'                             },
  { sym:'TATACONSUM', name:'Tata Consumer'                          },
  { sym:'TATAMOTORS', name:'Tata Motors'                            },
  { sym:'TATASTEEL',  name:'Tata Steel'                             },
  { sym:'TCS',        name:'TCS'                                    },
  { sym:'TECHM',      name:'Tech Mahindra'                          },
  { sym:'TITAN',      name:'Titan'                                  },
  { sym:'TRENT',      name:'Trent'                                  },
  { sym:'ULTRACEMCO', name:'UltraTech Cement'                       },
  { sym:'WIPRO',      name:'Wipro'                                  },
  { sym:'ZOMATO',     name:'Zomato'                                 },
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

function mergeRows(sym) {
  const histNames = HIST_NAMES[sym] || [sym];
  const symSet = new Set(histNames);
  const rows = getSrc1()
    .filter(r => symSet.has(r.Symbol))
    .map(r => ({
      date: r.Date.trim(),
      high: parseFloat(r.High||0),
      low:  parseFloat(r.Low ||0),
    }))
    .filter(r => r.date && r.high > 0);

  const p2 = `j:/Swing Trading/Swing Trading/processed/${sym}.csv`;
  if (fs.existsSync(p2)) {
    const rows2 = parseCSV(fs.readFileSync(p2,'utf8'))
      .map(r => ({ date:(r.Date||r.date||'').trim(), high:parseFloat(r.High||r.high||0), low:parseFloat(r.Low||r.low||0) }))
      .filter(r => r.date && r.high > 0);
    const existing = new Set(rows.map(r => r.date));
    rows2.forEach(r => { if (!existing.has(r.date)) rows.push(r); });
  }
  return rows.filter(r => r.date >= '2000-01-01').sort((a,b) => a.date.localeCompare(b.date));
}

// ── Build OHLC embed (High/Low only — smaller than charts) ───
console.error('Processing instruments...');
const ohlcBlocks = {};
for (const { sym, isIndex } of INSTRUMENTS) {
  if (isIndex) continue;
  const rows = mergeRows(sym);
  console.error(`  ${sym}: ${rows.length} rows`);
  ohlcBlocks[sym] = rows.map(r => `['${r.date}',${r.high.toFixed(2)},${r.low.toFixed(2)}]`).join(',');
}

const ohlcDataJS = INSTRUMENTS
  .filter(i => !i.isIndex)
  .map(({ sym }) => `  '${sym}':[${ohlcBlocks[sym]}]`)
  .join(',\n');

const instrJS = JSON.stringify(INSTRUMENTS.map(({ sym, name }) => ({ sym, name })));

// ── NIFTY_F ───────────────────────────────────────────────────
const NIFTY_F_JS = `{
  1995:['','','','','','','','','','','06 H / 29 L','28 H'],
  1996:['29 L','14 H','19 L','25 H','28 L','17 H','','','','08 L','','04 L'],
  1997:['16 H','03 L / 25 L','05 H','01 L','','','10 H / 21 L','06 H','23 L','21 H','','11 L'],
  1998:['05 H / 29 L','','','22 H','06 H','23 L','17 H','19 L','01 L / 25 H','20 L','11 H / 30 L','14 H / 17 L'],
  1999:['11 H','09 L','10 H','28 L','20 H / 28 L','','','','','14 H','02 L',''],
  2000:['','23 H','','06 L / 10 H','24 L','','13 H / 25 L','','13 H','19 L','','14 H / 26 L'],
  2001:['','16 H','13 L / 16 H','16 L','30 H','','','','21 L','','','06 H'],
  2002:['','27 H','','','','','','02 L','02 H','28 L','','26 H'],
  2003:['02 H','24 H','24 H','28 L','','','15 H / 22 L','','09 H / 19 L','17 H / 24 L','06 H / 21 L',''],
  2004:['09 H','','23 L','23 H','17 L / 26 H','24 L','','','','','',''],
  2005:['04 H / 12 L','','09 H','07 H / 29 L','','','','','','05 H / 28 L','',''],
  2006:['','','','','11 H','14 L','13 H / 24 L','','','','','08 H / 13 L'],
  2007:['','08 H','05 L','','','','24 H','17 L','','','',''],
  2008:['08 H / 22 L','04 H','18 L','02 H','16 L','','','12 H','','27 L','',''],
  2009:['','','06 L','','','12 H','13 L','','','20 H','03 L',''],
  2010:['06 H','08 L','','07 H','25 L','','','','','14 H / 29 L','08 H / 26 L','06 H / 10 L'],
  2011:['04 H','11 L','','06 H','','20 L','08 H','26 L','','28 H','','20 L'],
  2012:['02 L','22 H','','','','04 L','10 H / 26 L','23 H','06 L','05 H','19 L',''],
  2013:['29 H','','','10 L','20 H','24 L','23 H','28 L','19 H','01 L','03 H / 22 L','09 H'],
  2014:['','04 L','','','','','','','08 H','17 L','','04 H'],
  2015:['07 L / 30 H','','04 H','15 H','','12 L','','10 H','08 L','26 H','',''],
  2016:['','29 L','','','','','','','07 H','','','26 L'],
  2017:['','','','','','','','02 H / 11 L','19 H / 28 L','','06 H','06 L'],
  2018:['29 H','','23 L','','15 H / 23 L','','','28 H','','26 L','',''],
  2019:['29 L','','','','','03 H','','23 L','23 H','07 L','',''],
  2020:['20 H','','24 L','30 H','18 L','','','31 H','24 L','30 L','',''],
  2021:['29 L','16 H','','22 L','','','28 L','','','19 H','',''],
  2022:['18 H','','08 L','04 H','','17 L','','','14 H / 30 L','','',''],
  2023:['','16 H','20 L','','','','','','15 H','26 L','',''],
  2024:['24 L','','11 H / 20 L','10 H','','04 L','','','27 H','','21 L','05 H'],
  2025:['27 L','05 H','04 H / 25 L','07 L','','30 H','','08 L','','','',''],
}`;

// ── Year options (2020–2030) ───────────────────────────────────
const yearOptions = Array.from({length:11},(_,i)=>2020+i)
  .map(y => `<option value="${y}"${y===2026?' selected':''}>${y}</option>`)
  .join('');

const monthOptions = ['January','February','March','April','May','June',
  'July','August','September','October','November','December']
  .map((m,i) => `<option value="${i}"${i===4?' selected':''}>${m}</option>`)
  .join('');

// ── HTML ──────────────────────────────────────────────────────
const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Gann Confluence Calendar – NIFTY50</title>
<style>
  :root {
    --bg:#0d1117; --panel:#161b22; --border:#30363d;
    --accent:#58a6ff; --green:#3fb950; --red:#f85149; --orange:#e3b341;
    --text:#c9d1d9; --sub:#8b949e;
    --hbg:#0d2818; --lbg:#2d1010; --hlbg:#2d2010; --conf:#ffe066;
  }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { background:var(--bg); color:var(--text); font-family:'Segoe UI',system-ui,sans-serif; font-size:13px; padding:24px; }

  h2 { color:var(--accent); font-size:17px; margin-bottom:4px; }
  .desc { color:var(--sub); font-size:12px; margin-bottom:20px; }

  /* ── Controls ── */
  .controls { display:flex; align-items:flex-end; gap:16px; flex-wrap:wrap; background:var(--panel); border:1px solid var(--border); border-radius:8px; padding:14px 20px; margin-bottom:20px; }
  .ctrl { display:flex; flex-direction:column; gap:5px; }
  .ctrl label { color:var(--sub); font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; }
  .ctrl select { background:var(--bg); border:1px solid var(--accent); color:var(--accent); border-radius:6px; padding:7px 12px; font-size:14px; font-weight:700; outline:none; cursor:pointer; min-width:140px; }
  .ctrl select option { background:var(--bg); }

  .summary-bar { display:flex; gap:12px; align-items:center; flex-wrap:wrap; margin-left:auto; }
  .stat { background:#1a2a3a; border:1px solid var(--border); border-radius:5px; padding:4px 12px; font-size:11px; color:var(--sub); }
  .stat span { color:var(--accent); font-weight:700; }

  /* ── Filter strip ── */
  .filter-strip { display:flex; gap:8px; align-items:center; margin-bottom:16px; flex-wrap:wrap; }
  .filter-strip label { color:var(--sub); font-size:11px; }
  .filter-btn { background:#21262d; border:1px solid var(--border); color:var(--sub); border-radius:4px; padding:3px 10px; font-size:11px; cursor:pointer; }
  .filter-btn.active { background:#388bfd22; border-color:var(--accent); color:var(--accent); }
  .sep { width:1px; height:16px; background:var(--border); }
  .zz-inline { display:flex; gap:10px; align-items:center; }
  .zz-inline label { color:var(--sub); font-size:11px; }
  .zz-inline select { background:#21262d; border:1px solid var(--border); color:var(--text); border-radius:4px; padding:2px 6px; font-size:11px; cursor:pointer; }

  /* ── View toggle ── */
  .view-toggle { display:flex; gap:6px; margin-left:auto; }
  .vtbtn { background:#21262d; border:1px solid var(--border); color:var(--sub); border-radius:4px; padding:3px 12px; font-size:11px; cursor:pointer; }
  .vtbtn.active { background:#388bfd22; border-color:var(--accent); color:var(--accent); }

  /* ── Date-centric cards ── */
  #dateView { display:flex; flex-direction:column; gap:12px; }
  .date-card { background:var(--panel); border:1px solid var(--border); border-radius:8px; overflow:hidden; }
  .date-header { display:flex; align-items:center; gap:12px; padding:10px 16px; background:#1c2128; border-bottom:1px solid var(--border); }
  .date-num { font-size:28px; font-weight:700; color:var(--conf); line-height:1; min-width:42px; }
  .date-label { color:var(--sub); font-size:12px; }
  .stock-count { margin-left:auto; background:#3a3010; border:1px solid #6a5a10; color:var(--conf); border-radius:4px; padding:2px 8px; font-size:11px; font-weight:700; }
  .stock-count.multi { background:#0d2818; border-color:#1a4a28; color:var(--green); }

  .stocks-grid { display:flex; flex-wrap:wrap; gap:8px; padding:12px 16px; }
  .stock-chip { border-radius:6px; padding:6px 10px; font-size:11px; border:1px solid; min-width:140px; }
  .chip-h  { background:var(--hbg);  border-color:#1a4a28; }
  .chip-l  { background:var(--lbg);  border-color:#4a1a1a; }
  .chip-hl { background:var(--hlbg); border-color:#4a3a1a; }
  .chip-sym  { font-weight:700; font-size:12px; margin-bottom:2px; }
  .chip-sym.h  { color:var(--green);  }
  .chip-sym.l  { color:var(--red);    }
  .chip-sym.hl { color:var(--orange); }
  .chip-name { color:var(--sub); font-size:10px; margin-bottom:4px; }
  .chip-meta { font-size:10px; }
  .chip-meta .yr { color:var(--sub); margin-right:3px; }
  .chip-count { float:right; font-weight:700; font-size:11px; }
  .chip-count.h  { color:var(--green);  }
  .chip-count.l  { color:var(--red);    }
  .chip-count.hl { color:var(--orange); }

  /* ── Stock-centric table ── */
  #stockView { display:none; }
  .stock-table { width:100%; border-collapse:collapse; }
  .stock-table th { background:#1c2128; color:var(--sub); font-size:10px; font-weight:700; text-transform:uppercase; letter-spacing:.5px; padding:8px 12px; border:1px solid var(--border); text-align:left; position:sticky; top:0; }
  .stock-table td { border:1px solid var(--border); padding:8px 12px; vertical-align:top; }
  .stock-table td:first-child { font-weight:700; color:var(--accent); min-width:130px; }
  .stock-table td:nth-child(2) { color:var(--sub); font-size:11px; min-width:180px; }
  .stock-table tr:hover td { background:#1a2130; }
  .no-conf { color:#2a3040; font-style:italic; font-size:11px; }
  .ev { border-radius:3px; padding:2px 6px; font-size:11px; display:inline-block; margin:1px; white-space:nowrap; font-weight:600; cursor:default; }
  .ev-h  { background:var(--hbg);  color:var(--green);  border:1px solid #1a4a28; }
  .ev-l  { background:var(--lbg);  color:var(--red);    border:1px solid #4a1a1a; }
  .ev-hl { background:var(--hlbg); color:var(--orange); border:1px solid #4a3a1a; }

  .empty-state { text-align:center; padding:60px 20px; color:var(--sub); font-size:13px; }
  .loading { text-align:center; padding:40px; color:var(--orange); }
</style>
</head>
<body>

<h2>Gann Confluence Calendar</h2>
<p class="desc">For the selected month &amp; analysis year, shows every calendar date where a stock's pivot history repeats across ≥2 of the 11 Gann cycle years. Multi-stock alignment on the same date = stronger signal.</p>

<div class="controls">
  <div class="ctrl">
    <label>Month</label>
    <select id="monthSel" onchange="render()">${monthOptions}</select>
  </div>
  <div class="ctrl">
    <label>Analysis Year</label>
    <select id="yearSel" onchange="render()">${yearOptions}</select>
  </div>
  <div class="ctrl">
    <label>ZigZag Deviation</label>
    <select id="devSel" onchange="invalidateCache(); render()">
      <option value="2">2%</option><option value="3">3%</option>
      <option value="4" selected>4%</option><option value="5">5%</option>
      <option value="7">7%</option><option value="10">10%</option>
    </select>
  </div>
  <div class="ctrl">
    <label>Min Bars (Depth)</label>
    <select id="depSel" onchange="invalidateCache(); render()">
      <option value="5">5</option><option value="8">8</option>
      <option value="10" selected>10</option><option value="12">12</option>
      <option value="15">15</option><option value="20">20</option>
    </select>
  </div>
  <div class="summary-bar">
    <div class="stat">Confluence dates <span id="statDates">—</span></div>
    <div class="stat">Stocks with signal <span id="statStocks">—</span></div>
    <div class="stat">Multi-stock dates <span id="statMulti">—</span></div>
  </div>
</div>

<div class="filter-strip">
  <label>Min stocks per date:</label>
  <button class="filter-btn active" data-min="1" onclick="setMin(1,this)">Any (≥1)</button>
  <button class="filter-btn" data-min="2" onclick="setMin(2,this)">≥2 stocks</button>
  <button class="filter-btn" data-min="3" onclick="setMin(3,this)">≥3 stocks</button>
  <button class="filter-btn" data-min="4" onclick="setMin(4,this)">≥4 stocks</button>
  <div class="sep"></div>
  <div class="view-toggle">
    <button class="vtbtn active" onclick="setView('date',this)">By Date</button>
    <button class="vtbtn" onclick="setView('stock',this)">By Stock</button>
  </div>
</div>

<div id="dateView"></div>
<div id="stockView"><table class="stock-table" id="stockTable"><thead><tr><th>Stock</th><th>Instrument</th><th>Confluence Dates</th><th>Lookback Years Hit</th></tr></thead><tbody id="stockTbody"></tbody></table></div>

<script>
const INSTRUMENTS = ${instrJS};
const NIFTY_F = ${NIFTY_F_JS};
const OHLC_DATA = {
${ohlcDataJS}
};

const MONTHS_LONG = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const GAPS = [20,15,13,12,10,6,5,4,3,2,1];

let _minStocks = 1;
let _view = 'date';
let _zzCache = null;

function invalidateCache() { _zzCache = null; }

// ── ZigZag ────────────────────────────────────────────────────
function computeZigZag(rows, dev, dep) {
  const pivots = [];
  if (!rows || !rows.length) return pivots;
  let trend=null, lhP=rows[0][1], lhD=rows[0][0], lhI=0, llP=rows[0][2], llD=rows[0][0], llI=0;
  for (let i=1;i<rows.length;i++) {
    const [date,high,low]=rows[i];
    if (trend===null||trend==='UP') {
      if (high>=lhP){lhP=high;lhD=date;lhI=i;}
      if (low<=lhP*(1-dev/100)&&(i-lhI)>=dep){pivots.push({date:lhD,type:'H'});trend='DOWN';llP=low;llD=date;llI=i;}
    }
    if (trend==='DOWN') {
      if (low<=llP){llP=low;llD=date;llI=i;}
      if (high>=llP*(1+dev/100)&&(i-llI)>=dep){pivots.push({date:llD,type:'L'});trend='UP';lhP=high;lhD=date;lhI=i;}
    }
  }
  if (trend==='UP') pivots.push({date:lhD,type:'H'});
  else if (trend==='DOWN') pivots.push({date:llD,type:'L'});
  return pivots;
}

function getZZMatrix(sym, dev, dep) {
  if (!_zzCache) _zzCache = {};
  const key = sym+'|'+dev+'|'+dep;
  if (_zzCache[key]) return _zzCache[key];
  const rows = OHLC_DATA[sym];
  const pivots = computeZigZag(rows, dev, dep);
  const matrix = {};
  pivots.forEach(({date,type}) => {
    const yr = parseInt(date.substring(0,4));
    const mi = parseInt(date.substring(5,7))-1;
    const dd = date.substring(8,10);
    if (!matrix[yr]) matrix[yr] = Array.from({length:12},()=>[]);
    matrix[yr][mi].push({day:dd,type});
  });
  _zzCache[key] = matrix;
  return matrix;
}

// ── Get confluence entries for one stock, one month ───────────
// Returns {day → [{year,type}]} for days with ≥2 occurrences
function getConfluence(sym, analysisYear, monthIdx, dev, dep) {
  const lookbackYears = GAPS.map(g => analysisYear - g);
  const freq = {}; // day → [{year,type}]

  if (sym === 'NIFTY') {
    lookbackYears.forEach(yr => {
      const row = NIFTY_F[yr];
      if (!row || !row[monthIdx]) return;
      const val = row[monthIdx];
      val.split(/\\s*\\/\\s*/).forEach(p => {
        const m = p.trim().match(/^(\\d{1,2})\\s*([HL])/i);
        if (!m) return;
        const day = m[1].padStart(2,'0');
        const type = m[2].toUpperCase();
        if (!freq[day]) freq[day] = [];
        freq[day].push({year:yr, type});
      });
    });
  } else {
    const matrix = getZZMatrix(sym, dev, dep);
    lookbackYears.forEach(yr => {
      const yrData = matrix[yr];
      if (!yrData || !yrData[monthIdx]) return;
      yrData[monthIdx].forEach(({day,type}) => {
        if (!freq[day]) freq[day] = [];
        freq[day].push({year:yr, type});
      });
    });
  }

  // Return only days with ≥2 occurrences
  const result = {};
  for (const [day, arr] of Object.entries(freq)) {
    if (arr.length >= 2) result[day] = arr;
  }
  return result;
}

// ── Render ────────────────────────────────────────────────────
function render() {
  const monthIdx = parseInt(document.getElementById('monthSel').value);
  const year     = parseInt(document.getElementById('yearSel').value);
  const dev      = parseFloat(document.getElementById('devSel').value);
  const dep      = parseInt(document.getElementById('depSel').value);

  // Compute confluence for every instrument
  // Structure: dateMap[day] = [{sym, name, arr:[{year,type}]}]
  const dateMap   = {}; // day → [stockConf]
  const stockConf = {}; // sym → {day→arr}

  let totalStocksWithSignal = new Set();

  INSTRUMENTS.forEach(({sym, name}) => {
    const conf = getConfluence(sym, year, monthIdx, dev, dep);
    if (Object.keys(conf).length === 0) return;

    stockConf[sym] = { name, conf };
    totalStocksWithSignal.add(sym);

    for (const [day, arr] of Object.entries(conf)) {
      if (!dateMap[day]) dateMap[day] = [];
      dateMap[day].push({sym, name, arr});
    }
  });

  const sortedDays = Object.keys(dateMap).sort();
  const multiDays  = sortedDays.filter(d => dateMap[d].length >= 2);

  // Update stats
  document.getElementById('statDates').textContent  = sortedDays.length;
  document.getElementById('statStocks').textContent = totalStocksWithSignal.size;
  document.getElementById('statMulti').textContent  = multiDays.length;

  // Filter by min stocks
  const filteredDays = sortedDays.filter(d => dateMap[d].length >= _minStocks);

  if (_view === 'date') {
    renderDateView(filteredDays, dateMap, monthIdx, year);
  } else {
    renderStockView(stockConf, monthIdx, year);
  }
}

function chipClass(arr) {
  const hasH = arr.some(e=>e.type==='H'), hasL = arr.some(e=>e.type==='L');
  return (hasH&&hasL)?'hl':hasH?'h':'l';
}
function chipLabel(arr, day) {
  const hasH = arr.some(e=>e.type==='H'), hasL = arr.some(e=>e.type==='L');
  return day + ' ' + ((hasH&&hasL)?'H/L':hasH?'H':'L');
}

// ── Date-centric view ─────────────────────────────────────────
function renderDateView(days, dateMap, monthIdx, year) {
  const el = document.getElementById('dateView');
  if (days.length === 0) {
    el.innerHTML = \`<div class="empty-state">No confluence dates found for <strong>\${MONTHS_LONG[monthIdx]} \${year}</strong> with current filters.<br>Try lowering the minimum stock count or adjusting ZigZag parameters.</div>\`;
    return;
  }

  const monthName = MONTHS_LONG[monthIdx];
  el.innerHTML = days.map(day => {
    const stocks = dateMap[day];
    const isMulti = stocks.length >= 2;
    const stocksHTML = stocks
      .sort((a,b) => b.arr.length - a.arr.length)
      .map(({sym,name,arr}) => {
        const cls = chipClass(arr);
        const years = arr.map(e=>\`<span class="yr">\${e.year}:\${e.type}</span>\`).join('');
        return \`<div class="stock-chip chip-\${cls}">
          <div class="chip-sym \${cls}">\${sym} <span class="chip-count \${cls}">×\${arr.length}</span></div>
          <div class="chip-name">\${name}</div>
          <div class="chip-meta">\${years}</div>
        </div>\`;
      }).join('');

    return \`<div class="date-card">
      <div class="date-header">
        <div class="date-num">\${day}</div>
        <div>
          <div style="color:var(--conf);font-weight:700">\${day} \${monthName} \${year}</div>
          <div class="date-label">\${stocks.length} stock\${stocks.length>1?'s':''} with Gann confluence</div>
        </div>
        <div class="stock-count \${isMulti?'multi':''}">\${stocks.length} stock\${stocks.length>1?'s':''}</div>
      </div>
      <div class="stocks-grid">\${stocksHTML}</div>
    </div>\`;
  }).join('');
}

// ── Stock-centric view ────────────────────────────────────────
function renderStockView(stockConf, monthIdx, year) {
  const tbody = document.getElementById('stockTbody');
  const monthName = MONTHS_LONG[monthIdx];

  if (Object.keys(stockConf).length === 0) {
    tbody.innerHTML = \`<tr><td colspan="4" class="empty-state">No confluence dates found for \${monthName} \${year}.</td></tr>\`;
    return;
  }

  tbody.innerHTML = INSTRUMENTS.map(({sym,name}) => {
    const sc = stockConf[sym];
    if (!sc) {
      if (_minStocks > 1) return ''; // hide empty rows when filtering
      return \`<tr><td>\${sym}</td><td style="color:var(--sub);font-size:11px">\${name}</td><td colspan="2" class="no-conf">—</td></tr>\`;
    }
    const days = Object.keys(sc.conf).sort();
    const badgesHTML = days.map(day => {
      const arr = sc.conf[day];
      const hasH = arr.some(e=>e.type==='H'), hasL = arr.some(e=>e.type==='L');
      const cls  = (hasH&&hasL)?'ev-hl':hasH?'ev-h':'ev-l';
      const lbl  = chipLabel(arr, day);
      const tip  = arr.map(e=>\`\${e.year}:\${e.type}\`).join(', ');
      return \`<span class="ev \${cls}" title="\${tip}">⚡ \${lbl} ×\${arr.length}</span>\`;
    }).join(' ');
    const yrsHit = [...new Set(days.flatMap(d=>sc.conf[d].map(e=>e.year)))].sort().join(', ');
    return \`<tr><td>\${sym}</td><td style="color:var(--sub);font-size:11px">\${name}</td><td>\${badgesHTML}</td><td style="color:var(--sub);font-size:11px">\${yrsHit}</td></tr>\`;
  }).filter(Boolean).join('');
}

function setMin(n, btn) {
  _minStocks = n;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  render();
}

function setView(v, btn) {
  _view = v;
  document.querySelectorAll('.vtbtn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('dateView').style.display  = v==='date'  ? 'flex'  : 'none';
  document.getElementById('stockView').style.display = v==='stock' ? 'block' : 'none';
  render();
}

render();
</script>
</body>
</html>`;

fs.writeFileSync('j:/GANN Claude/Gann/6/confluence.html', html, 'utf8');
const size = (fs.statSync('j:/GANN Claude/Gann/6/confluence.html').size/1024/1024).toFixed(1);
console.error(`Done. confluence.html — ${size} MB`);
