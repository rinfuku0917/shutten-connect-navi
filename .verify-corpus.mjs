import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const cp = s => [...s].length;
const noWs = s => cp(s.replace(/\s/g, ''));
function visibleText(md) {
  let t = md;
  t = t.replace(/^```[\s\S]*?^```/gm, '');
  t = t.replace(/!\[[^\]]*\]\([^)]*\)/g, '');
  t = t.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
  t = t.replace(/^\s{0,3}#{1,6}\s+/gm, '');
  t = t.replace(/^\s{0,3}>\s?/gm, '');
  t = t.replace(/^\s{0,3}[-*+]\s+/gm, '');
  t = t.replace(/^\s{0,3}\d+\.\s+/gm, '');
  t = t.replace(/^\s*\|?[\s:|-]{3,}\|?\s*$/gm, '');
  t = t.replace(/\|/g, ' ');
  t = t.replace(/(\*\*|__)(.*?)\1/g, '$2');
  t = t.replace(/(\*|_)(.*?)\1/g, '$2');
  t = t.replace(/`([^`]*)`/g, '$1');
  return t;
}

// paginate — PostgREST caps at 1000
let all = [], from = 0;
for (;;) {
  const { data, error } = await sb.from('posts')
    .select('slug,title,status,content,published_at')
    .order('slug').range(from, from + 999);
  if (error) { console.error(error.message); break; }
  all = all.concat(data);
  if (data.length < 1000) break;
  from += 1000;
}

const pub = all.filter(p => p.status === 'published');
console.log(`posts 全件=${all.length} / status=published=${pub.length}\n`);

const LO = 3500, HI = 4500;
const pad = (s, n) => String(s).padEnd(n);
const padL = (s, n) => String(s).padStart(n);

const rows = pub.map(p => {
  const c = (p.content ?? '').trim();
  return { slug: p.slug, raw: cp(c), nows: noWs(c), vis: cp(visibleText(c).trim()), visnows: noWs(visibleText(c)) };
}).sort((a, b) => a.raw - b.raw);

console.log(pad('slug', 42), padL('生', 6), padL('空白除', 7), padL('記号除', 7), padL('記号+空白除', 11), ' 判定(生/記号+空白除)');
let inRaw = 0, inVis = 0;
for (const r of rows) {
  const okRaw = r.raw >= LO && r.raw <= HI;
  const okVis = r.visnows >= LO && r.visnows <= HI;
  if (okRaw) inRaw++;
  if (okVis) inVis++;
  console.log(pad(r.slug, 42), padL(r.raw, 6), padL(r.nows, 7), padL(r.vis, 7), padL(r.visnows, 11),
    ' ' + (okRaw ? '○' : r.raw < LO ? '↓短' : '↑長') + ' / ' + (okVis ? '○' : r.visnows < LO ? '↓短' : '↑長'));
}
console.log(`\n3,500〜4,500字に収まる記事数: 生本文で数えると ${inRaw}/${pub.length}本、記号+空白を除いて数えると ${inVis}/${pub.length}本`);
