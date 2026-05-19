/**
 * OHLC Data Quality Analyzer
 * Checks processed_adj/ CSVs for: zero-volume bars, duplicate dates,
 * non-monotonic dates, large overnight gaps (>20%).
 * Also checks unadjusted processed/ for TATAMOTORS, ZOMATO, GMRINFRA.
 */

const fs = require('fs');
const path = require('path');

const ADJ_DIR = 'j:/Swing Trading/Swing Trading/processed_adj/';
const RAW_DIR = 'j:/Swing Trading/Swing Trading/processed/';

// Symbols to check in unadjusted (raw) data
const RAW_CHECK = ['TATAMOTORS', 'ZOMATO', 'GMRINFRA'];

// Gap threshold: ratio outside [0.7, 1.3] = 30%+ gap
const GAP_RATIO_LOW = 0.7;
const GAP_RATIO_HIGH = 1.3;

function parseCSV(filepath) {
  const content = fs.readFileSync(filepath, 'utf8');
  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];
  const header = lines[0].split(',').map(h => h.trim());
  const idxDate = header.indexOf('Date');
  const idxOpen = header.indexOf('Open');
  const idxHigh = header.indexOf('High');
  const idxLow = header.indexOf('Low');
  const idxClose = header.indexOf('Close');
  const idxVol = header.indexOf('Volume');

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',');
    if (parts.length < 6) continue;
    const date = parts[idxDate]?.trim();
    const open = parseFloat(parts[idxOpen]);
    const high = parseFloat(parts[idxHigh]);
    const low = parseFloat(parts[idxLow]);
    const close = parseFloat(parts[idxClose]);
    const volume = parseFloat(parts[idxVol]);
    if (!date || isNaN(open) || isNaN(close)) continue;
    rows.push({ date, open, high, low, close, volume });
  }
  return rows;
}

function analyzeFile(filepath, symbol) {
  const rows = parseCSV(filepath);
  const result = {
    symbol,
    filepath,
    totalRows: rows.length,
    zeroVolume: [],
    duplicateDates: [],
    nonMonotonicDates: [],
    largeGaps: [],
  };

  if (rows.length === 0) return result;

  const seenDates = new Map();
  let prevDate = null;
  let prevClose = null;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const { date, open, close, volume } = row;

    // 1. Zero volume
    if (volume === 0 || (isNaN(volume) && String(row.volume) === '0')) {
      result.zeroVolume.push({ date, open, high: row.high, low: row.low, close, volume });
    }

    // 2. Duplicate dates
    if (seenDates.has(date)) {
      result.duplicateDates.push({
        date,
        firstIdx: seenDates.get(date),
        secondIdx: i,
        firstRow: rows[seenDates.get(date)],
        secondRow: row,
      });
    } else {
      seenDates.set(date, i);
    }

    // 3. Non-monotonic dates
    if (prevDate !== null && date <= prevDate) {
      result.nonMonotonicDates.push({
        idx: i,
        prevDate,
        currDate: date,
        issue: date === prevDate ? 'duplicate' : 'out-of-order',
      });
    }

    // 4. Large overnight gap (prev close → next open)
    if (prevClose !== null && prevClose > 0 && !isNaN(open) && open > 0) {
      const ratio = open / prevClose;
      if (ratio < GAP_RATIO_LOW || ratio > GAP_RATIO_HIGH) {
        result.largeGaps.push({
          date,
          prevDate,
          prevClose: prevClose.toFixed(2),
          nextOpen: open.toFixed(2),
          ratio: ratio.toFixed(4),
          pctChange: ((ratio - 1) * 100).toFixed(1) + '%',
        });
      }
    }

    prevDate = date;
    prevClose = close;
  }

  return result;
}

function main() {
  console.log('=== OHLC DATA QUALITY REPORT ===');
  console.log(`Generated: ${new Date().toISOString()}\n`);

  // Get all CSV files from processed_adj
  const files = fs.readdirSync(ADJ_DIR)
    .filter(f => f.endsWith('.csv'))
    .sort();

  console.log(`Analyzing ${files.length} files in processed_adj/\n`);

  const allResults = [];

  for (const file of files) {
    const symbol = file.replace('.csv', '');
    const filepath = path.join(ADJ_DIR, file).replace(/\\/g, '/');
    const res = analyzeFile(filepath, symbol);
    allResults.push(res);
  }

  // Also check raw (unadjusted) files for specific symbols
  console.log(`\nAlso analyzing unadjusted processed/ for: ${RAW_CHECK.join(', ')}\n`);
  const rawResults = [];
  for (const sym of RAW_CHECK) {
    const filepath = path.join(RAW_DIR, sym + '.csv').replace(/\\/g, '/');
    if (fs.existsSync(filepath)) {
      const res = analyzeFile(filepath, sym + ' [RAW]');
      rawResults.push(res);
    } else {
      console.log(`  [NOT FOUND] ${filepath}`);
    }
  }

  // ---- REPORT ----

  // Section 1: Zero-volume bars
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('SECTION 1: ZERO-VOLUME BARS (processed_adj/)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const zeroVolumeFiles = allResults.filter(r => r.zeroVolume.length > 0);
  if (zeroVolumeFiles.length === 0) {
    console.log('  No zero-volume bars found in any file.\n');
  } else {
    console.log(`  ${zeroVolumeFiles.length} files have zero-volume bars:\n`);
    for (const r of zeroVolumeFiles) {
      console.log(`  ${r.symbol}: ${r.zeroVolume.length} zero-volume bars (of ${r.totalRows} total rows)`);
      // Show up to 5 examples
      const examples = r.zeroVolume.slice(0, 5);
      for (const ex of examples) {
        console.log(`    → ${ex.date}  O:${ex.open} H:${ex.high} L:${ex.low} C:${ex.close} Vol:${ex.volume}`);
      }
      if (r.zeroVolume.length > 5) {
        console.log(`    ... and ${r.zeroVolume.length - 5} more`);
      }
    }
  }

  // Section 2: Duplicate dates
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('SECTION 2: DUPLICATE DATES (processed_adj/)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const dupFiles = allResults.filter(r => r.duplicateDates.length > 0);
  if (dupFiles.length === 0) {
    console.log('  No duplicate dates found.\n');
  } else {
    for (const r of dupFiles) {
      console.log(`  ${r.symbol}: ${r.duplicateDates.length} duplicate date(s)`);
      for (const d of r.duplicateDates) {
        console.log(`    → ${d.date}  row[${d.firstIdx}]: C=${d.firstRow.close}  row[${d.secondIdx}]: C=${d.secondRow.close}`);
      }
    }
  }

  // Section 3: Non-monotonic dates
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('SECTION 3: NON-MONOTONIC DATES (processed_adj/)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const nmFiles = allResults.filter(r => r.nonMonotonicDates.length > 0);
  if (nmFiles.length === 0) {
    console.log('  All files have monotonically increasing dates.\n');
  } else {
    for (const r of nmFiles) {
      console.log(`  ${r.symbol}: ${r.nonMonotonicDates.length} non-monotonic date(s)`);
      for (const d of r.nonMonotonicDates) {
        console.log(`    → row[${d.idx}]: ${d.prevDate} → ${d.currDate} (${d.issue})`);
      }
    }
  }

  // Section 4: Large overnight gaps (adj)
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('SECTION 4: LARGE OVERNIGHT GAPS >30% (processed_adj/)');
  console.log('  [These might indicate unadjusted corporate actions]');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  const gapFiles = allResults.filter(r => r.largeGaps.length > 0);
  if (gapFiles.length === 0) {
    console.log('  No large overnight gaps found in adjusted data.\n');
  } else {
    for (const r of gapFiles) {
      console.log(`  ${r.symbol}: ${r.largeGaps.length} large gap(s)`);
      for (const g of r.largeGaps) {
        console.log(`    → ${g.prevDate} C=${g.prevClose}  →  ${g.date} O=${g.nextOpen}  ratio=${g.ratio} (${g.pctChange})`);
      }
    }
  }

  // Section 5: Large gaps in raw (unadjusted) files
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('SECTION 5: LARGE OVERNIGHT GAPS >30% IN RAW/UNADJUSTED DATA');
  console.log('  (TATAMOTORS, ZOMATO, GMRINFRA from processed/)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  if (rawResults.length === 0) {
    console.log('  No raw files found.\n');
  } else {
    for (const r of rawResults) {
      console.log(`\n  ${r.symbol} (${r.totalRows} rows, ${r.zeroVolume.length} zero-vol bars)`);
      if (r.largeGaps.length === 0) {
        console.log('    No large overnight gaps found.');
      } else {
        console.log(`    ${r.largeGaps.length} large gap(s):`);
        for (const g of r.largeGaps) {
          console.log(`    → ${g.prevDate} C=${g.prevClose}  →  ${g.date} O=${g.nextOpen}  ratio=${g.ratio} (${g.pctChange})`);
        }
      }
      // Also show zero-vol examples for raw
      if (r.zeroVolume.length > 0) {
        console.log(`    Zero-volume examples (first 5):`);
        for (const z of r.zeroVolume.slice(0, 5)) {
          console.log(`      ${z.date}  C:${z.close} Vol:${z.volume}`);
        }
      }
      // Also show duplicate dates for raw
      if (r.duplicateDates.length > 0) {
        console.log(`    Duplicate dates: ${r.duplicateDates.length}`);
        for (const d of r.duplicateDates) {
          console.log(`      ${d.date}  row[${d.firstIdx}] C=${d.firstRow.close}  row[${d.secondIdx}] C=${d.secondRow.close}`);
        }
      }
    }
  }

  // Summary table
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('SUMMARY TABLE (processed_adj/ — all 71 symbols)');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Symbol'.padEnd(20) + 'Rows'.padStart(7) + 'ZeroVol'.padStart(9) + 'DupDates'.padStart(10) + 'NonMono'.padStart(9) + 'LargeGaps'.padStart(11));
  console.log('─'.repeat(66));
  for (const r of allResults) {
    const hasIssue = r.zeroVolume.length > 0 || r.duplicateDates.length > 0 || r.nonMonotonicDates.length > 0 || r.largeGaps.length > 0;
    if (hasIssue) {
      console.log(
        r.symbol.padEnd(20) +
        String(r.totalRows).padStart(7) +
        String(r.zeroVolume.length).padStart(9) +
        String(r.duplicateDates.length).padStart(10) +
        String(r.nonMonotonicDates.length).padStart(9) +
        String(r.largeGaps.length).padStart(11)
      );
    }
  }
  const clean = allResults.filter(r => r.zeroVolume.length === 0 && r.duplicateDates.length === 0 && r.nonMonotonicDates.length === 0 && r.largeGaps.length === 0);
  console.log(`\n  ${clean.length} of ${allResults.length} files are CLEAN (no issues found).`);

  // Grand totals
  const totalZero = allResults.reduce((s, r) => s + r.zeroVolume.length, 0);
  const totalDup = allResults.reduce((s, r) => s + r.duplicateDates.length, 0);
  const totalNM = allResults.reduce((s, r) => s + r.nonMonotonicDates.length, 0);
  const totalGap = allResults.reduce((s, r) => s + r.largeGaps.length, 0);
  console.log(`\n  Totals: ZeroVol=${totalZero}  Dups=${totalDup}  NonMono=${totalNM}  LargeGaps=${totalGap}`);
}

main();
