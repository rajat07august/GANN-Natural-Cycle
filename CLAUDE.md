# Gann Cycle Dashboard — Project Notes

## Working Directory
`j:\GANN Claude\`

## Source Files (do not modify)
- `Gann/6/1/Natural Cycle.xlsx` — 48 sheets. NIFTY_F (1995–2025), BANKNIFTY_F (2005–2023), FINNIFTY (2012–2023), TCS, ~20 other stocks.
- `Gann/6/1/Dynamic Cycle_.xlsm` — 74 sheets. HOLIDAYS sheet, 70+ NSE instrument sheets, RESULT sheet (6112 rows).

## Output Files
- `Gann/6/Gann_Cycle_Dashboard.html` — First full dashboard (5-tab layout, embedded NIFTY/BN/FN/TCS data).
- `Gann/6/trial_natural_cycle.html` — **Current working file.** Year-input trial for Natural Cycle. APPROVED by user.

## Natural Cycle Data Format
Each sheet (e.g. NIFTY_F) is a Year × Month matrix.
Cell values like `"08 H"`, `"14 L"`, `"08 H / 14 L"` = day-of-month + High/Low marker.

## Gann Cycle Gaps
11 lookback intervals from analysis year: −1, −2, −3, −4, −5, −6, −10, −12, −13, −15, −20

## Confluence Rule
Same calendar day appearing in ≥2 of the 11 lookback years in the same month = confluence signal.
**Key:** group by day number ONLY — H and L on the same day count as one confluence (don't split by type).

## trial_natural_cycle.html — Status (APPROVED)
- Year input defaults to 2026.
- Shows 11 Gann lookback rows with NIFTY_F H/L data.
- Confluence row in table + confluence panel below.
- Confluence correctly groups by day-only (fixed bug where H and L on same date were missed).
- All NIFTY_F data (1995–2025) embedded as JS object.

## Next Step
Build full version — extend to BANKNIFTY_F, FINNIFTY, and individual stocks.
Need data extraction from remaining sheets before building.
