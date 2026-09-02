import fs from 'node:fs';
const SCRATCH = '/private/tmp/claude-501/-Users-hidekifukusada-Desktop--------shutten-connect-navi/db7d6515-4023-44ab-9971-494a02f7a39c/scratchpad';
const posts = JSON.parse(fs.readFileSync(SCRATCH + '/posts.json', 'utf8'));
const SIX = ['food-truck-fee-guide','kitchen-car-location-guide','renting-parking-space','kitchen-car-required-documents','get-food-truck-offers','weekday-food-truck-spots'];
const DRAFTS = ['get-food-truck-offers','weekday-food-truck-spots'];

const bodies = {};
for (const p of posts) bodies[p.slug] = p.content || '';
for (const s of DRAFTS) bodies[s] = fs.readFileSync('docs/blog/' + s + '.md', 'utf8');

const edges = [];
const otherLinks = {};
for (const [slug, body] of Object.entries(bodies)) {
  otherLinks[slug] = [];
  for (const m of body.matchAll(/\[([^\]]*)\]\((\/[^)]*)\)/g)) {
    const [, text, href] = m;
    if (href.startsWith('/blog/')) edges.push({ from: slug, to: href.replace('/blog/', '').split(/[#?]/)[0], text });
    else otherLinks[slug].push(href);
  }
}
console.log('### /blog/ 内部リンク（発リンク）');
for (const slug of Object.keys(bodies)) {
  const out = edges.filter(e => e.from === slug);
  const tag = SIX.includes(slug) ? '★' : ' ';
  console.log(`${tag}${slug}  →  ${out.length ? out.map(e => e.to).join(', ') : '(なし)'}`);
}
console.log('\n### 被リンク（誰から張られているか）');
const allSlugs = new Set([...Object.keys(bodies), ...edges.map(e => e.to)]);
for (const slug of [...allSlugs].sort()) {
  const inn = edges.filter(e => e.to === slug);
  const tag = SIX.includes(slug) ? '★' : ' ';
  const exists = bodies[slug] !== undefined ? '' : ' ※記事が存在しない！';
  console.log(`${tag}${slug}  ←  ${inn.length ? inn.map(e => e.from).join(', ') : '(被リンク0)'}${exists}`);
}
console.log('\n### 6本の非blog内部リンク');
for (const s of SIX) console.log(` ${s}: ${[...new Set(otherLinks[s])].join(', ')}`);

console.log('\n### 6本のリンクのアンカーテキスト');
for (const e of edges.filter(e => SIX.includes(e.from))) console.log(`  ${e.from} → ${e.to} :「${e.text}」`);
