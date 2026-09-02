import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const slugs = [
  'food-truck-fee-guide',
  'kitchen-car-location-guide',
  'renting-parking-space',
  'kitchen-car-required-documents',
];

// ---- counting helpers -------------------------------------------------
const cp = s => [...s].length;                       // code points
const graph = s => {
  const seg = new Intl.Segmenter('ja', { granularity: 'grapheme' });
  return [...seg.segment(s)].length;
};
const noWs = s => cp(s.replace(/\s/g, ''));

// strip markdown *syntax* but keep the words a reader sees
function visibleText(md) {
  let t = md;
  t = t.replace(/^```[\s\S]*?^```/gm, '');           // fenced code
  t = t.replace(/!\[[^\]]*\]\([^)]*\)/g, '');        // images -> gone
  t = t.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');     // links -> label
  t = t.replace(/^\s{0,3}#{1,6}\s+/gm, '');          // heading markers
  t = t.replace(/^\s{0,3}>\s?/gm, '');               // blockquote
  t = t.replace(/^\s{0,3}[-*+]\s+/gm, '');           // bullets
  t = t.replace(/^\s{0,3}\d+\.\s+/gm, '');           // ordered list
  t = t.replace(/^\s*\|?[\s:|-]{3,}\|?\s*$/gm, '');  // table separator rows
  t = t.replace(/\|/g, ' ');                         // table pipes
  t = t.replace(/(\*\*|__)(.*?)\1/g, '$2');          // bold
  t = t.replace(/(\*|_)(.*?)\1/g, '$2');             // italic
  t = t.replace(/`([^`]*)`/g, '$1');                 // inline code
  t = t.replace(/^\s{0,3}(-{3,}|\*{3,})\s*$/gm, ''); // hr
  return t;
}

function splitFrontmatter(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!m) return { fm: '', body: raw };
  return { fm: m[1], body: raw.slice(m[0].length) };
}

const rows = [];
for (const slug of slugs) {
  const p = path.join('docs/blog', slug + '.md');
  const raw = fs.readFileSync(p, 'utf8');
  const { body } = splitFrontmatter(raw);
  const trimmed = body.trim();
  const vis = visibleText(trimmed).replace(/\n{2,}/g, '\n\n').trim();

  const { data, error } = await sb
    .from('posts')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  rows.push({ slug, raw: trimmed, vis, db: data, dbErr: error?.message });
}

console.log('=== DB columns available ===');
console.log(rows[0].db ? Object.keys(rows[0].db).join(', ') : 'no row / ' + rows[0].dbErr);
console.log();

const pad = (s, n) => String(s).padEnd(n);
console.log(pad('slug', 32), pad('生本文', 8), pad('空白除', 8), pad('記号除', 8), pad('記号除空白除', 12), pad('書記素', 8));
for (const r of rows) {
  console.log(
    pad(r.slug, 32),
    pad(cp(r.raw), 8),
    pad(noWs(r.raw), 8),
    pad(cp(r.vis), 8),
    pad(noWs(r.vis), 12),
    pad(graph(r.raw), 8),
  );
}

console.log('\n=== DB body vs docs/blog (別ソースでの照合) ===');
for (const r of rows) {
  if (!r.db) { console.log(r.slug, '-> DBに行なし', r.dbErr ?? ''); continue; }
  const cand = ['content', 'body', 'content_md', 'markdown', 'html'].filter(k => k in r.db);
  const key = cand.find(k => typeof r.db[k] === 'string' && r.db[k].length > 500) ?? cand[0];
  const dbBody = (r.db[key] ?? '').trim();
  const dbVis = visibleText(dbBody).trim();
  console.log(
    pad(r.slug, 32),
    'col=' + key,
    'DB生=' + cp(dbBody),
    'DB空白除=' + noWs(dbBody),
    'DB記号除=' + cp(dbVis),
    'published=' + (r.db.published ?? r.db.status ?? '?'),
    '一致=' + (dbBody === r.raw ? 'YES' : 'NO(差' + (cp(dbBody) - cp(r.raw)) + ')'),
  );
}
