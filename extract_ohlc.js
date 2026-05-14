// Extract compact OHLC data for embedding in HTML
// Output: JS const with [date, high, low] arrays per instrument
// Usage: node extract_ohlc.js <SYMBOL> <nifty50_all.csv> [processed_csv]

const fs = require('fs');

const [,, symbol, src1Path, src2Path] = process.argv;
if (!symbol || !src1Path) {
  console.error('Usage: node extract_ohlc.js <SYMBOL> <nifty50_all.csv> [processed_csv]');
  process.exit(1);
}

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

function loadRows(path, filterSymbol) {
  const text = fs.readFileSync(path, 'utf8');
  const rows = parseCSV(text);
  return rows
    .filter(r => !filterSymbol || r.Symbol === filterSymbol || r.symbol === filterSymbol)
    .map(r => ({
      date: (r.Date || r.date || '').trim(),
      high: parseFloat(r.High || r.HIGH || r.high || 0),
      low:  parseFloat(r.Low  || r.LOW  || r.low  || 0),
    }))
    .filter(r => r.date && !isNaN(r.high) && r.high > 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

let rows = loadRows(src1Path, symbol);
if (src2Path) {
  const rows2 = loadRows(src2Path, null);
  const existing = new Set(rows.map(r => r.date));
  rows2.forEach(r => { if (!existing.has(r.date)) rows.push(r); });
  rows.sort((a, b) => a.date.localeCompare(b.date));
}

// From 2000 onwards
rows = rows.filter(r => r.date >= '2000-01-01');
console.error(`${symbol}: ${rows.length} rows (${rows[0]?.date} → ${rows[rows.length-1]?.date})`);

// Compact format: [date, high, low] — round to 2dp
const data = rows.map(r => `['${r.date}',${r.high.toFixed(2)},${r.low.toFixed(2)}]`);
process.stdout.write(`  ${symbol}: [\n    ${data.join(',\n    ')}\n  ],\n`);
