#!/usr/bin/env node
// Exports the full Claude conversation to a print-ready HTML (open in Chrome → Ctrl+P → Save as PDF)

const fs   = require('fs');
const path = require('path');

const JSONL = 'C:/Users/pc/.claude/projects/j--GANN-Claude/94653698-9108-4339-9eae-11fb9756907c.jsonl';
const OUT   = 'j:/GANN Claude/conversation_export.html';

// ── Parse JSONL ────────────────────────────────────────────────────────────────
const lines = fs.readFileSync(JSONL, 'utf8').split('\n').filter(Boolean);
const records = [];
for (const line of lines) {
  try { records.push(JSON.parse(line)); } catch {}
}

// Keep only user/assistant turns, sort by timestamp
const turns = records
  .filter(r => r.type === 'user' || r.type === 'assistant')
  .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

// ── Extract text from a content block array ────────────────────────────────────
function extractText(content) {
  if (!Array.isArray(content)) return typeof content === 'string' ? content : '';
  const parts = [];
  for (const block of content) {
    if (block.type === 'text') {
      // Skip system-reminder tags and ide_ tags injected by the shell
      const txt = block.text
        .replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '')
        .replace(/<ide_[^>]*>[\s\S]*?<\/ide_[^>]*>/g, '')
        .replace(/<ide_[^/][^>]*\/>/g, '')
        .trim();
      if (txt) parts.push(txt);
    } else if (block.type === 'tool_use') {
      // Show tool name + key params as a collapsed note
      let hint = `[Tool: ${block.name}`;
      if (block.input) {
        const inp = block.input;
        if (inp.command)      hint += ` — ${String(inp.command).substring(0, 120)}`;
        else if (inp.pattern) hint += ` — pattern: ${inp.pattern}`;
        else if (inp.file_path) hint += ` — ${inp.file_path}`;
        else if (inp.description) hint += ` — ${inp.description}`;
      }
      hint += ']';
      parts.push(`<span class="tool-call">${escHtml(hint)}</span>`);
    }
    // skip: thinking, tool_result
  }
  return parts.join('\n\n');
}

// ── Simple Markdown → HTML ─────────────────────────────────────────────────────
function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function mdToHtml(md) {
  if (!md) return '';
  // Already contains <span> tool-call tags — split on them and process the rest
  const chunks = md.split(/(<span class="tool-call">.*?<\/span>)/s);
  return chunks.map((chunk, i) => {
    if (chunk.startsWith('<span class="tool-call">')) return chunk;
    return convertMarkdown(chunk);
  }).join('');
}

function convertMarkdown(text) {
  let s = escHtml(text);

  // Fenced code blocks (``` ... ```)
  s = s.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) =>
    `<pre class="code-block"><code>${code}</code></pre>`);

  // Inline code
  s = s.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

  // Headers
  s = s.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  s = s.replace(/^## (.+)$/gm,  '<h2>$1</h2>');
  s = s.replace(/^# (.+)$/gm,   '<h1>$1</h1>');

  // Bold
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // Italic
  s = s.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  // Tables — detect | … | rows
  s = s.replace(/((?:^\|.+\|\n)+)/gm, (table) => {
    const rows = table.trim().split('\n');
    let html = '<table class="md-table"><tbody>';
    let isHead = true;
    for (const row of rows) {
      if (/^\|[\s\-:|]+\|/.test(row)) { isHead = false; continue; } // separator row
      const cells = row.split('|').filter((_, i, a) => i > 0 && i < a.length - 1);
      const tag = isHead ? 'th' : 'td';
      html += '<tr>' + cells.map(c => `<${tag}>${c.trim()}</${tag}>`).join('') + '</tr>';
      isHead = false;
    }
    return html + '</tbody></table>';
  });

  // Unordered lists
  s = s.replace(/((?:^[ \t]*[-*+] .+\n?)+)/gm, (block) => {
    const items = block.trim().split('\n').map(l => `<li>${l.replace(/^[ \t]*[-*+] /,'')}</li>`);
    return '<ul>' + items.join('') + '</ul>';
  });

  // Numbered lists
  s = s.replace(/((?:^[ \t]*\d+\. .+\n?)+)/gm, (block) => {
    const items = block.trim().split('\n').map(l => `<li>${l.replace(/^[ \t]*\d+\. /,'')}</li>`);
    return '<ol>' + items.join('') + '</ol>';
  });

  // Horizontal rules
  s = s.replace(/^[-*_]{3,}$/gm, '<hr>');

  // Paragraphs (double newline)
  s = s.replace(/\n{2,}/g, '</p><p>');
  s = '<p>' + s + '</p>';

  // Single newlines inside paragraphs → <br>
  s = s.replace(/([^>])\n([^<])/g, '$1<br>$2');

  // Fix: don't wrap block elements in <p>
  s = s.replace(/<p>(<(?:h[1-6]|ul|ol|pre|table|hr)[^]*?(?:<\/(?:h[1-6]|ul|ol|pre|table)>|>))<\/p>/g, '$1');
  s = s.replace(/<p><\/p>/g, '');

  return s;
}

// ── Format timestamp ───────────────────────────────────────────────────────────
function fmtTime(ts) {
  const d = new Date(ts);
  return d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}

// ── Build HTML ─────────────────────────────────────────────────────────────────
let msgCount = 0;
const msgHtml = [];

// Deduplicate consecutive identical messages (JSONL sometimes has duplicates)
const seen = new Set();
const uniqTurns = turns.filter(t => {
  const key = t.type + '|' + t.uuid;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

for (const turn of uniqTurns) {
  const content = turn.message?.content;
  if (!content) continue;
  const text = extractText(content).trim();
  if (!text) continue;

  msgCount++;
  const isUser = turn.type === 'user';
  const cls    = isUser ? 'user-turn' : 'asst-turn';
  const label  = isUser ? 'You' : 'Claude';
  const time   = fmtTime(turn.timestamp);

  msgHtml.push(`
<div class="turn ${cls}" id="msg-${msgCount}">
  <div class="turn-header">
    <span class="turn-label">${label}</span>
    <span class="turn-time">${time}</span>
    <span class="turn-num">#${msgCount}</span>
  </div>
  <div class="turn-body">${mdToHtml(text)}</div>
</div>`);
}

const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Gann Cycle Dashboard — Full Conversation</title>
<style>
  /* ── Print & Screen shared ───────────────────────────── */
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: 'Segoe UI', Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.6;
    color: #1a1a1a;
    background: #fff;
    max-width: 860px;
    margin: 0 auto;
    padding: 24px 32px;
  }

  /* ── Cover ───────────────────────────────────────────── */
  .cover {
    text-align: center;
    padding: 60px 0 40px;
    border-bottom: 2px solid #ccc;
    margin-bottom: 36px;
    page-break-after: always;
  }
  .cover h1 { font-size: 24pt; color: #111; margin-bottom: 12px; }
  .cover p  { font-size: 11pt; color: #555; }

  /* ── Turn bubbles ────────────────────────────────────── */
  .turn {
    margin-bottom: 24px;
    border-radius: 6px;
    overflow: hidden;
    border: 1px solid #ddd;
    page-break-inside: avoid;
  }

  .turn-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 14px;
    font-size: 9pt;
  }
  .user-turn .turn-header { background: #1a3a5c; color: #d0e8ff; }
  .asst-turn .turn-header { background: #1e3a1e; color: #c6e8c6; }

  .turn-label { font-weight: 700; font-size: 10pt; }
  .turn-time  { color: rgba(255,255,255,.65); flex: 1; }
  .turn-num   { color: rgba(255,255,255,.4); font-size: 8pt; }

  .turn-body {
    padding: 12px 18px;
    background: #fafafa;
  }
  .user-turn .turn-body { background: #f4f8ff; }

  /* ── Markdown elements ───────────────────────────────── */
  .turn-body p   { margin-bottom: 8px; }
  .turn-body h1  { font-size: 14pt; margin: 14px 0 6px; border-bottom: 1px solid #ccc; }
  .turn-body h2  { font-size: 12pt; margin: 12px 0 6px; border-bottom: 1px solid #eee; }
  .turn-body h3  { font-size: 11pt; margin: 10px 0 4px; }
  .turn-body ul,
  .turn-body ol  { margin: 6px 0 6px 22px; }
  .turn-body li  { margin-bottom: 3px; }
  .turn-body hr  { border: none; border-top: 1px solid #ddd; margin: 12px 0; }
  .turn-body strong { color: #111; }

  code.inline-code {
    font-family: 'Consolas', 'Courier New', monospace;
    font-size: 9.5pt;
    background: #ebebeb;
    padding: 1px 5px;
    border-radius: 3px;
  }

  pre.code-block {
    background: #1e1e1e;
    color: #d4d4d4;
    font-family: 'Consolas', 'Courier New', monospace;
    font-size: 8.5pt;
    padding: 12px 16px;
    border-radius: 5px;
    overflow-x: auto;
    white-space: pre-wrap;
    word-break: break-all;
    margin: 8px 0;
    page-break-inside: avoid;
  }

  table.md-table {
    border-collapse: collapse;
    width: 100%;
    font-size: 9pt;
    margin: 8px 0;
    page-break-inside: avoid;
  }
  table.md-table th, table.md-table td {
    border: 1px solid #ccc;
    padding: 4px 8px;
    text-align: left;
  }
  table.md-table th { background: #e8e8e8; font-weight: 700; }
  table.md-table tr:nth-child(even) td { background: #f5f5f5; }

  span.tool-call {
    display: inline-block;
    font-family: 'Consolas', monospace;
    font-size: 8.5pt;
    background: #fff3cd;
    border: 1px solid #e6c400;
    border-radius: 4px;
    padding: 2px 8px;
    color: #7a5800;
    margin: 2px 0;
  }

  /* ── Print tweaks ────────────────────────────────────── */
  @media print {
    body { max-width: 100%; padding: 0; font-size: 10pt; }
    .cover { page-break-after: always; }
    .turn { page-break-inside: avoid; border: 1px solid #bbb; }
    pre.code-block { font-size: 8pt; }
    .no-print { display: none; }
  }

  /* ── Screen-only TOC button ──────────────────────────── */
  .no-print {
    position: fixed;
    bottom: 24px;
    right: 24px;
    background: #1a3a5c;
    color: white;
    border: none;
    border-radius: 8px;
    padding: 10px 18px;
    font-size: 11pt;
    cursor: pointer;
    box-shadow: 0 4px 16px rgba(0,0,0,.3);
    z-index: 999;
  }
  .no-print:hover { background: #2a5a8c; }
</style>
</head>
<body>

<div class="cover">
  <h1>Gann Cycle Dashboard</h1>
  <h1>Full Conversation Export</h1>
  <p style="margin-top:20px">Session: 94653698-9108-4339-9eae-11fb9756907c</p>
  <p>From: ${fmtTime(uniqTurns[0]?.timestamp)} &nbsp;→&nbsp; ${fmtTime(uniqTurns[uniqTurns.length-1]?.timestamp)}</p>
  <p style="margin-top:8px">Total messages: ${msgCount}</p>
  <p style="margin-top:24px;font-size:9pt;color:#888">
    To save as PDF: File → Print (Ctrl+P) → Destination: Save as PDF → Save
  </p>
</div>

${msgHtml.join('\n')}

<button class="no-print" onclick="window.print()">🖨 Save as PDF</button>

</body>
</html>`;

fs.writeFileSync(OUT, html);
console.log(`✓ Exported ${msgCount} messages → ${OUT}`);
console.log(`  Open in Chrome and press Ctrl+P → Save as PDF`);
