import fs from 'node:fs';
const SP = '/private/tmp/claude-501/-Users-hidekifukusada-Desktop--------shutten-connect-navi/db7d6515-4023-44ab-9971-494a02f7a39c/scratchpad';
const posts = JSON.parse(fs.readFileSync(`${SP}/posts.json`, 'utf8'));

// 下書きのスーパー記事は DB に無いので原稿から足す
const sm = fs.readFileSync('docs/blog/supermarket-food-truck.md', 'utf8');
const smBody = sm.replace(/^---[\s\S]*?\n---\n/, '');
posts.push({ slug: 'supermarket-food-truck', title: 'スーパーの駐車場にキッチンカーを誘致するには？条件の決め方を実データで', content: smBody, status: 'draft(未公開)', category: '募集者向け', target_keyword: 'スーパー 駐車場 キッチンカー 誘致' });

const norm = (s) => (s || '')
  .replace(/!\[[^\]]*\]\([^)]*\)/g, '')      // 画像
  .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')   // リンクはテキストだけ残す
  .replace(/[#*|>`\-\s\n\r]/g, '');

// 文字4-gram の Jaccard / 含有率
function grams(s, n = 4) {
  const set = new Set();
  for (let i = 0; i + n <= s.length; i++) set.add(s.slice(i, i + n));
  return set;
}

const docs = posts.map(p => ({ ...p, n: norm(p.content), g: null }));
for (const d of docs) d.g = grams(d.n);

function pair(a, b) {
  let inter = 0;
  const [s, l] = a.g.size < b.g.size ? [a.g, b.g] : [b.g, a.g];
  for (const x of s) if (l.has(x)) inter++;
  const uni = a.g.size + b.g.size - inter;
  return { jac: inter / uni, containA: inter / a.g.size, containB: inter / b.g.size, inter };
}

const results = [];
for (let i = 0; i < docs.length; i++)
  for (let j = i + 1; j < docs.length; j++) {
    const r = pair(docs[i], docs[j]);
    results.push({ a: docs[i].slug, b: docs[j].slug, ...r });
  }
results.sort((x, y) => y.jac - x.jac);
console.log('### 本文の重なり（文字4-gram Jaccard）上位25組');
for (const r of results.slice(0, 25)) {
  console.log(`${(r.jac * 100).toFixed(1)}%  ${r.a} × ${r.b}  (含有率 ${(r.containA * 100).toFixed(0)}% / ${(r.containB * 100).toFixed(0)}%)`);
}

// 見出しの重なり
console.log('\n### 見出し一覧');
for (const d of docs) {
  const hs = (d.content || '').split('\n').filter(l => /^#{2,3}\s/.test(l)).map(l => l.replace(/^#+\s*/, ''));
  console.log(`\n-- ${d.slug} [${d.status}] kw=${d.target_keyword ?? 'null'}`);
  console.log('   ' + hs.join(' / '));
}

// 内部リンク
console.log('\n### 内部リンク（記事 → リンク先）');
const links = {};
for (const d of docs) {
  const ls = [...(d.content || '').matchAll(/\]\((\/[^)]*)\)/g)].map(m => m[1]);
  links[d.slug] = ls;
  console.log(`${d.slug} -> ${ls.length ? ls.join(', ') : '(なし)'}`);
}
fs.writeFileSync(`${SP}/links.json`, JSON.stringify(links, null, 2));

// 被リンク集計（記事→記事のみ）
const inbound = {};
for (const d of docs) inbound[d.slug] = [];
for (const [from, ls] of Object.entries(links))
  for (const l of ls) {
    const m = l.match(/^\/blog\/([a-z0-9-]+)/);
    if (m && inbound[m[1]] !== undefined && m[1] !== from) inbound[m[1]].push(from);
  }
console.log('\n### 記事どうしの被リンク数');
for (const d of docs) {
  const inb = [...new Set(inbound[d.slug])];
  const outb = [...new Set(links[d.slug].filter(l => /^\/blog\//.test(l)).map(l => l.replace('/blog/', '').split(/[#?]/)[0]))];
  console.log(`${d.slug} [${d.status}]  被リンク${inb.length}: ${inb.join(',') || '—'}  |  発リンク${outb.length}: ${outb.join(',') || '—'}`);
}
