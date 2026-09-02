import fs from 'node:fs'
const posts = JSON.parse(fs.readFileSync('/private/tmp/claude-501/-Users-hidekifukusada-Desktop--------shutten-connect-navi/db7d6515-4023-44ab-9971-494a02f7a39c/scratchpad/posts-fresh.json', 'utf8'))

const A = posts.find(p => p.slug === 'how-to-invite-kitchen-car')
const B = posts.find(p => p.slug === 'event-food-truck-guide')

// ---- 1. 被リンク：全20本のどれかが この2本 へリンクしているか ----
console.log('=== 被リンク（他記事 → この2本） ===')
let inbound = 0
for (const p of posts) {
  for (const target of ['how-to-invite-kitchen-car', 'event-food-truck-guide']) {
    if (p.slug === target) continue
    if ((p.content || '').includes(target)) { console.log(`  ${p.slug} → ${target}`); inbound++ }
  }
}
console.log('  被リンク件数 =', inbound)

// ---- 2. 発リンク：この2本が張っているリンク ----
console.log('\n=== 発リンク（この2本 → どこか） ===')
for (const [n, p] of [['how-to-invite', A], ['event-guide', B]]) {
  const links = [...(p.content || '').matchAll(/\[([^\]]*)\]\((?!https:\/\/mieflxcdthcpyrysfahs)([^)]*)\)/g)]
  console.log(`  ${n}: ${links.length}本`, links.map(m => m[2]))
  // 素のURL・相対パスも探す
  const bare = [...(p.content || '').matchAll(/\/(?:blog|places|vendor)\/[a-z0-9\-\[\]]+/g)].map(m => m[0])
  console.log(`    生パス言及: ${bare.length}件`, bare)
}

// ---- 3. お互いへの言及・断り書きがあるか ----
console.log('\n=== 相互の断り書き（「別の記事」「詳しくは」等） ===')
for (const [n, p] of [['how-to-invite', A], ['event-guide', B]]) {
  const hits = (p.content || '').split('\n').filter(l => /詳しく|別の記事|こちらの記事|関連記事|あわせて|別途解説|下記の記事/.test(l))
  console.log(`  ${n}: ${hits.length}件`, hits)
}

// ---- 4. 独自の重なり計測：文字3-gram の Jaccard と 被覆率 ----
const norm = s => (s || '')
  .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
  .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
  .replace(/[#*_`>|・\-\s、。「」（）()：:，,！？!?〜~]/g, '')
const ngrams = (s, n) => { const set = new Set(); for (let i = 0; i + n <= s.length; i++) set.add(s.slice(i, i + n)); return set }
const a = norm(A.content), b = norm(B.content)
for (const n of [3, 4, 5]) {
  const sa = ngrams(a, n), sb = ngrams(b, n)
  let inter = 0; for (const g of sa) if (sb.has(g)) inter++
  const jac = inter / (sa.size + sb.size - inter)
  console.log(`\n  ${n}-gram: A=${sa.size} B=${sb.size} 共通=${inter} Jaccard=${(jac*100).toFixed(1)}% Aの被覆=${(inter/sa.size*100).toFixed(1)}% Bの被覆=${(inter/sb.size*100).toFixed(1)}%`)
}

// ---- 5. 比較対象：全20本の総当たりで この2本 の順位を見る（低さが「別記事の証拠」になるか） ----
console.log('\n=== 全ペアの 4-gram Jaccard 上位15（この2本が相対的にどこか） ===')
const cache = new Map()
const getSet = p => { if (!cache.has(p.slug)) cache.set(p.slug, ngrams(norm(p.content), 4)); return cache.get(p.slug) }
const pairs = []
for (let i = 0; i < posts.length; i++) for (let j = i + 1; j < posts.length; j++) {
  const sa = getSet(posts[i]), sb = getSet(posts[j])
  let inter = 0; for (const g of sa) if (sb.has(g)) inter++
  pairs.push({ a: posts[i].slug, b: posts[j].slug, j: inter / (sa.size + sb.size - inter) })
}
pairs.sort((x, y) => y.j - x.j)
pairs.slice(0, 15).forEach((p, i) => {
  const mark = (p.a === 'how-to-invite-kitchen-car' && p.b === 'event-food-truck-guide') || (p.b === 'how-to-invite-kitchen-car' && p.a === 'event-food-truck-guide') ? '  <<< 対象ペア' : ''
  console.log(`  ${String(i+1).padStart(2)}. ${(p.j*100).toFixed(2)}%  ${p.a} / ${p.b}${mark}`)
})
const rank = pairs.findIndex(p => (p.a === 'how-to-invite-kitchen-car' && p.b === 'event-food-truck-guide') || (p.b === 'how-to-invite-kitchen-car' && p.a === 'event-food-truck-guide'))
console.log(`\n  対象ペアの順位 = ${rank + 1} / ${pairs.length} ペア中`)
const h2 = pairs.findIndex(p => [p.a,p.b].sort().join('|') === ['host-fee-setting-guide2','renting-parking-space'].sort().join('|'))
console.log(`  参考 host-fee-setting-guide2 / renting-parking-space の順位 = ${h2 + 1}, 値=${(pairs[h2]?.j*100).toFixed(2)}%`)
