import fs from 'node:fs';
const SCRATCH = '/private/tmp/claude-501/-Users-hidekifukusada-Desktop--------shutten-connect-navi/db7d6515-4023-44ab-9971-494a02f7a39c/scratchpad';
const posts = JSON.parse(fs.readFileSync(SCRATCH + '/posts.json', 'utf8'));
const SIX = ['food-truck-fee-guide','kitchen-car-location-guide','renting-parking-space','kitchen-car-required-documents','get-food-truck-offers','weekday-food-truck-spots'];
const DRAFTS = ['get-food-truck-offers','weekday-food-truck-spots'];
const bodies = {};
for (const p of posts) bodies[p.slug] = p.content || '';
for (const s of DRAFTS) {
  const raw = fs.readFileSync('docs/blog/' + s + '.md', 'utf8');
  bodies[s] = raw.slice(raw.indexOf('\n---', 3) + 4);
}

console.log('### 見出し一覧（h2/h3）');
for (const slug of Object.keys(bodies)) {
  const hs = [...bodies[slug].matchAll(/^(#{2,3})\s*(.+)$/gm)].map(m => (m[1].length === 3 ? '   - ' : '  ') + m[2].trim());
  console.log(`\n[${SIX.includes(slug) ? '★' : ' '}${slug}]`);
  console.log(hs.join('\n'));
}

console.log('\n\n### 本文中の表（markdown table）の1行目=見出し行 比較');
for (const slug of Object.keys(bodies)) {
  const tables = [...bodies[slug].matchAll(/^\|(.+)\|\s*$\n\|[\s\-|]+\|\s*$/gm)].map(m => m[1].trim());
  if (tables.length) console.log(`[${slug}] ` + tables.join(' / '));
}

// 表の中身そのものを比較（B-1 と B-16）
function tableBlocks(s) {
  const out = [];
  const lines = s.split('\n');
  let cur = [];
  for (const l of lines) {
    if (l.trim().startsWith('|')) cur.push(l.trim());
    else { if (cur.length) out.push(cur.join('\n')); cur = []; }
  }
  if (cur.length) out.push(cur.join('\n'));
  return out;
}
console.log('\n\n### B-1 と B-16 の表の中身');
for (const s of ['kitchen-car-location-guide', 'weekday-food-truck-spots']) {
  console.log(`\n===== ${s}`);
  tableBlocks(bodies[s]).forEach((t, i) => console.log(`-- table${i + 1} (${t.length}字)\n${t}`));
}

// 文字数（本文・markdown記号を除く）
console.log('\n\n### 本文の実文字数（markdown記号・リンクURL・表の罫線を除く）');
for (const slug of Object.keys(bodies)) {
  const t = bodies[slug]
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#*`|>\-\s]/g, '');
  console.log(`${SIX.includes(slug) ? '★' : ' '}${slug.padEnd(40)} ${t.length}字`);
}
