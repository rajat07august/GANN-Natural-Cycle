// ZigZag Monthly H/L Extractor
// Parameters: deviation=4%, depth=10 bars (minimum bars between pivots)
// Usage: node zigzag_monthly.js <symbol> <src1_csv> <src2_csv>
// Output: JS object ready to embed in HTML

const fs = require('fs');

const DEVIATION = 4;   // % minimum reversal to confirm new pivot
const DEPTH     = 10;  // minimum bars between pivots

// ── Parse args ────────────────────────────────────────────────
const [,, symbol, src1Path, src2Path] = process.argv;
if (!symbol || !src1Path) {
  console.error('Usage: node zigzag_monthly.js <SYMBOL> <nifty50_all.csv> [processed_csv]');
  process.exit(1);
}

// ── CSV parser (handles quoted fields) ───────────────────────
function parseCSV(text) {
  const lines = text.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map(line => {
    const cols = line.split(',');
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (cols[i] || '').trim().replace(/^"|"$/g, ''); });
    return obj;
  });
}

// ── Load & normalise rows → {date, high, low} ─────────────────
function loadRows(path, filterSymbol) {
  const text = fs.readFileSync(path, 'utf8');
  const rows = parseCSV(text);
  return rows
    .filter(r => !filterSymbol || r.Symbol === filterSymbol || r.symbol === filterSymbol)
    .map(r => ({
      date : (r.Date || r.date || '').trim(),
      high : parseFloat(r.High || r.HIGH || r.high || r.HIGH_PRICE || 0),
      low  : parseFloat(r.Low  || r.LOW  || r.low  || r.LOW_PRICE  || 0),
    }))
    .filter(r => r.date && !isNaN(r.high) && !isNaN(r.low) && r.high > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ── Merge two sources, deduplicate by date ────────────────────
let rows = loadRows(src1Path, symbol);
if (src2Path) {
  const rows2 = loadRows(src2Path, null);  // processed CSVs already filtered by symbol
  const existingDates = new Set(rows.map(r => r.date));
  rows2.forEach(r => { if (!existingDates.has(r.date)) rows.push(r); });
  rows.sort((a, b) => a.date.localeCompare(b.date));
}

// Filter from 2006 onwards
rows = rows.filter(r => r.date >= '2006-01-01');
console.error(`Loaded ${rows.length} rows for ${symbol} (${rows[0]?.date} → ${rows[rows.length-1]?.date})`);

// ── ZigZag Algorithm ─────────────────────────────────────────
// Returns array of {date, type:'H'|'L', price}
function zigzag(bars, deviation, depth) {
  const pivots = [];
  let trend   = null;   // 'UP' | 'DOWN'
  let lastHigh = bars[0].high, lastHighDate = bars[0].date, lastHighIdx = 0;
  let lastLow  = bars[0].low,  lastLowDate  = bars[0].date, lastLowIdx  = 0;

  for (let i = 1; i < bars.length; i++) {
    const { date, high, low } = bars[i];

    if (trend === null || trend === 'UP') {
      // Track new high
      if (high >= lastHigh) {
        lastHigh = high; lastHighDate = date; lastHighIdx = i;
      }
      // Reversal down by deviation% from last high, and at least depth bars from last high
      if (low <= lastHigh * (1 - deviation / 100) && (i - lastHighIdx) >= depth) {
        pivots.push({ date: lastHighDate, type: 'H', price: lastHigh });
        trend = 'DOWN';
        lastLow = low; lastLowDate = date; lastLowIdx = i;
      }
    }

    if (trend === 'DOWN') {
      // Track new low
      if (low <= lastLow) {
        lastLow = low; lastLowDate = date; lastLowIdx = i;
      }
      // Reversal up by deviation% from last low, and at least depth bars from last low
      if (high >= lastLow * (1 + deviation / 100) && (i - lastLowIdx) >= depth) {
        pivots.push({ date: lastLowDate, type: 'L', price: lastLow });
        trend = 'UP';
        lastHigh = high; lastHighDate = date; lastHighIdx = i;
      }
    }
  }

  // Push the final unconfirmed pivot (last known extreme)
  if (trend === 'UP') {
    pivots.push({ date: lastHighDate, type: 'H', price: lastHigh });
  } else if (trend === 'DOWN') {
    pivots.push({ date: lastLowDate, type: 'L', price: lastLow });
  }

  return pivots;
}

const pivots = zigzag(rows, DEVIATION, DEPTH);
console.error(`Found ${pivots.length} ZigZag pivots`);

// ── Map pivots to Year×Month matrix ──────────────────────────
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const matrix = {};   // matrix[year][monthIdx] = [{day, type}]

pivots.forEach(({ date, type }) => {
  const yr = parseInt(date.substring(0, 4));
  const mi = parseInt(date.substring(5, 7)) - 1;
  const dd = date.substring(8, 10);
  if (!matrix[yr]) matrix[yr] = Array.from({length:12}, () => []);
  matrix[yr][mi].push({ day: dd, type });
});

// ── Format as JS object ───────────────────────────────────────
const years = Object.keys(matrix).map(Number).sort();
const lines = [`const ${symbol} = {`];
years.forEach(yr => {
  const cells = matrix[yr].map(entries => {
    if (entries.length === 0) return "''";
    // Sort by day, format "DD H / DD L" etc.
    const sorted = entries.sort((a, b) => parseInt(a.day) - parseInt(b.day));
    return `'${sorted.map(e => `${e.day} ${e.type}`).join(' / ')}'`;
  });
  lines.push(`  ${yr}: [${cells.join(',')}],`);
});
lines.push('};');
console.log(lines.join('\n'));
