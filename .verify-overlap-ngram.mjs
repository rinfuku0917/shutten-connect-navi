import fs from 'node:fs';

const SCRATCH = '/private/tmp/claude-501/-Users-hidekifukusada-Desktop--------shutten-connect-navi/db7d6515-4023-44ab-9971-494a02f7a39c/scratchpad';
const posts = JSON.parse(fs.readFileSync(SCRATCH + '/posts.json', 'utf8'));
const DOCS = 'docs/blog/';

const SIX = [
  'food-truck-fee-guide',
  'kitchen-car-location-guide',
  'renting-parking-space',
  'kitchen-car-required-documents',
  'get-food-truck-offers',
  'weekday-food-truck-spots',
];

function stripFrontmatter(s) {
  return s.startsWith('---') ? s.slice(s.indexOf('\n---', 3) + 4) : s;
}
// normalize: remove markdown decoration, links -> keep anchor text, collapse ws
function norm(s) {
  return stripFrontmatter(s)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')       // images
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')      // links -> text
    .replace(/[#>*`|:_\-\[\]()]/g, ' ')
    .replace(/\s+/g, '')
    .trim();
}

const docs = {};
for (const s of SIX) docs[s] = norm(fs.readFileSync(DOCS + s + '.md', 'utf8'));
const pub = {};
for (const p of posts) pub[p.slug] = norm(p.content || '');

const all = { ...pub, ...docs }; // docs override for the 4 published (same text anyway)

const N = 12;
function grams(s) {
  const set = new Set();
  for (let i = 0; i + N <= s.length; i++) set.add(s.slice(i, i + N));
  return set;
}
const G = Object.fromEntries(Object.entries(all).map(([k, v]) => [k, grams(v)]));

// longest common substrings between a and b (>= MIN), greedy non-overlapping
function commonRuns(aSlug, bSlug, MIN = 18) {
  const a = all[aSlug];
  const gb = G[bSlug];
  const runs = [];
  let i = 0;
  while (i + N <= a.length) {
    if (gb.has(a.slice(i, i + N))) {
      let end = i + N;
      while (end < a.length && gb.has(a.slice(end - N + 1, end + 1))) end++;
      runs.push(a.slice(i, end));
      i = end - N + 1;
    } else i++;
  }
  return runs.filter(r => r.length >= MIN).sort((x, y) => y.length - x.length);
}

function containment(a, b) {
  const ga = G[a], gb = G[b];
  let hit = 0;
  for (const g of ga) if (gb.has(g)) hit++;
  return { pct: (100 * hit / ga.size), hit, size: ga.size };
}

console.log('### 6本の長さ(正規化後・文字数)');
for (const s of SIX) console.log(' ', s, all[s].length);

console.log('\n### 6本どうし 12-gram 一致率（行=A, A のうち B にもある割合）');
const hdr = SIX.map(s => s.slice(0, 10).padStart(11));
console.log('              ' + hdr.join(''));
for (const a of SIX) {
  const row = SIX.map(b => (a === b ? '     -' : containment(a, b).pct.toFixed(1) + '%').padStart(11));
  console.log(a.slice(0, 13).padEnd(14) + row.join(''));
}

console.log('\n### 危険な組み合わせの共有区間（18文字以上）');
const PAIRS = [
  ['kitchen-car-location-guide', 'weekday-food-truck-spots'],
  ['kitchen-car-location-guide', 'get-food-truck-offers'],
  ['food-truck-fee-guide', 'weekday-food-truck-spots'],
  ['get-food-truck-offers', 'kitchen-car-required-documents'],
  ['kitchen-car-location-guide', 'food-truck-fee-guide'],
  ['kitchen-car-location-guide', 'kitchen-car-required-documents'],
  ['renting-parking-space', 'food-truck-fee-guide'],
  ['renting-parking-space', 'kitchen-car-required-documents'],
  ['weekday-food-truck-spots', 'get-food-truck-offers'],
];
for (const [a, b] of PAIRS) {
  const runs = commonRuns(a, b);
  const chars = runs.reduce((s, r) => s + r.length, 0);
  console.log(`\n--- ${a} × ${b}  共有区間${runs.length}本 / 計${chars}字 (${(100*chars/all[a].length).toFixed(1)}% of A)`);
  for (const r of runs.slice(0, 12)) console.log(`  [${r.length}] ${r}`);
}

console.log('\n\n### 既存記事16本 × 6本 の一致率（既存記事のうち6本に含まれる割合が高い順）');
const rows = [];
for (const p of posts) {
  for (const s of SIX) {
    if (p.slug === s) continue;
    const c = containment(p.slug, s);
    const c2 = containment(s, p.slug);
    rows.push({ existing: p.slug, six: s, aInB: c.pct, bInA: c2.pct });
  }
}
rows.sort((x, y) => Math.max(y.aInB, y.bInA) - Math.max(x.aInB, x.bInA));
for (const r of rows.slice(0, 20)) {
  console.log(`${r.existing.padEnd(38)} × ${r.six.padEnd(32)} 既存→6本 ${r.aInB.toFixed(1)}%  6本→既存 ${r.bInA.toFixed(1)}%`);
}

console.log('\n### choose-profitable-food-truck-location 全文');
console.log(posts.find(p => p.slug === 'choose-profitable-food-truck-location').content);
