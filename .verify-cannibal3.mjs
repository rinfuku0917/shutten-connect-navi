import fs from 'node:fs';
const SP = '/private/tmp/claude-501/-Users-hidekifukusada-Desktop--------shutten-connect-navi/db7d6515-4023-44ab-9971-494a02f7a39c/scratchpad';
const posts = JSON.parse(fs.readFileSync(`${SP}/posts.json`, 'utf8'));
const sm = fs.readFileSync('docs/blog/supermarket-food-truck.md', 'utf8').replace(/^---[\s\S]*?\n---\n/, '');
posts.push({ slug: 'supermarket-food-truck', content: sm });
const by = Object.fromEntries(posts.map(p => [p.slug, p.content || '']));

const norm = s => s.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[#*|>`\-\s\n\r]/g, '');
const grams = (s, n = 4) => { const t = new Set(); for (let i = 0; i + n <= s.length; i++) t.add(s.slice(i, i + n)); return t; };
function score(a, b) {
  const ga = grams(norm(by[a])), gb = grams(norm(by[b]));
  let inter = 0; for (const x of ga) if (gb.has(x)) inter++;
  return { jac: inter / (ga.size + gb.size - inter), cA: inter / ga.size, cB: inter / gb.size };
}

console.log('### 指定ペアの重なり');
const pairs = [
  ['kitchen-car-location-guide', 'weekday-food-truck-spots'],
  ['renting-parking-space', 'supermarket-food-truck'],
  ['choose-profitable-food-truck-location', 'kitchen-car-location-guide'],
  ['choose-profitable-food-truck-location', 'weekday-food-truck-spots'],
  ['choose-profitable-food-truck-location', 'how-to-find-food-truck-spots'],
  ['host-fee-setting-guide2', 'renting-parking-space'],
  ['host-fee-setting-guide2', 'supermarket-food-truck'],
  ['host-fee-setting-guide2', 'food-truck-fee-guide'],
  ['host-fee-setting-guide2', 'vacant-space-food-truck'],
  ['host-fee-setting-guide2', 'host-fee-setting-guide'],
  ['vacant-space-food-truck', 'renting-parking-space'],
  ['regular-event-schedule', 'supermarket-food-truck'],
  ['event-food-truck-guide', 'how-to-invite-kitchen-car'],
];
for (const [a, b] of pairs) {
  const s = score(a, b);
  console.log(`${(s.jac * 100).toFixed(1).padStart(5)}%  ${a} × ${b}  (含有 ${(s.cA * 100).toFixed(0)}%/${(s.cB * 100).toFixed(0)}%)`);
}

// 共通する長い文字列（丸ごと共有している箇所）を探す
function commonChunks(a, b, min = 14) {
  const A = norm(by[a]), B = norm(by[b]);
  const out = [];
  const seen = new Set();
  for (let i = 0; i < A.length; i++) {
    let len = 0;
    while (i + len < A.length && B.includes(A.slice(i, i + len + 1))) len++;
    if (len >= min) {
      const s = A.slice(i, i + len);
      if (![...seen].some(x => x.includes(s))) { out.push(s); seen.add(s); }
      i += len - 1;
    }
  }
  return out;
}
for (const [a, b] of [['kitchen-car-location-guide', 'weekday-food-truck-spots'], ['renting-parking-space', 'supermarket-food-truck'], ['host-fee-setting-guide2', 'renting-parking-space']]) {
  console.log(`\n### ${a} と ${b} で丸ごと一致する14文字以上の並び`);
  const c = commonChunks(a, b);
  console.log(`件数: ${c.length} / 一致文字数合計: ${c.reduce((s, x) => s + x.length, 0)}`);
  for (const x of c.sort((p, q) => q.length - p.length).slice(0, 25)) console.log(`  [${x.length}] ${x}`);
}
