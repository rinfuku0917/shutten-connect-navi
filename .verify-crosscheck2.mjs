import fs from 'fs'

const posts = JSON.parse(fs.readFileSync('.verify-crosscheck-posts.json', 'utf8'))
const byslug = Object.fromEntries(posts.map(p => [p.slug, p]))

// 原稿（.md）は front matter を落として本文だけにする
function draft(slug) {
  const raw = fs.readFileSync(`docs/blog/${slug}.md`, 'utf8')
  const m = raw.match(/^---\n[\s\S]*?\n---\n/)
  return { fm: m ? m[0] : '', body: m ? raw.slice(m[0].length) : raw }
}

// 「字数」は記号・空白・画像・リンク記法を落とした素の文字で数える
function plain(md) {
  return md
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')      // 画像
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')   // リンクはテキストだけ残す
    .replace(/[#>*`|_\-\s]/g, '')
}

const rp = draft('renting-parking-space')
const vs = byslug['vacant-space-food-truck'].content

console.log('== 字数（記号・空白除去） ==')
console.log('renting-parking-space 原稿 :', plain(rp.body).length)
console.log('renting-parking-space DB   :', plain(byslug['renting-parking-space'].content).length)
console.log('vacant-space-food-truck DB :', plain(vs).length)
console.log('vacant  raw content.length :', vs.length)

console.log('\n== 語の出現回数 ==')
const words = ['駐車場', '遊休', '空き', '地主', 'オーナー', '出店料', '相場', '歩合', '固定',
  '円', '％', '%', '誘致', '貸す', '貸し', '保険', '保健所', '契約', '又貸し', '広場',
  '商業施設', 'オフィス', 'マンション', '空き地', 'スペース']
const count = (s, w) => (s.split(w).length - 1)
for (const w of words) {
  console.log(w.padEnd(8), 'renting=', String(count(rp.body, w)).padStart(3), ' vacant=', String(count(vs, w)).padStart(3))
}

console.log('\n== 見出し ==')
const heads = s => s.split('\n').filter(l => /^#{1,4}\s/.test(l)).map(l => l.trim())
console.log('--- renting-parking-space ---'); heads(rp.body).forEach(h => console.log('  ' + h))
console.log('--- vacant-space-food-truck ---'); heads(vs).forEach(h => console.log('  ' + h))

console.log('\n== 内部リンク ==')
const links = s => [...s.matchAll(/\[([^\]]*)\]\((\/[^)]*)\)/g)].map(m => m[2] + '  «' + m[1] + '»')
console.log('renting -> ', links(rp.body))
console.log('vacant  -> ', links(vs))
console.log('全記事から vacant-space-food-truck へのリンク:')
for (const p of posts) {
  if (String(p.content).includes('vacant-space-food-truck')) console.log('  ', p.slug)
}
console.log('全記事から renting-parking-space へのリンク:')
for (const p of posts) {
  if (p.slug !== 'renting-parking-space' && String(p.content).includes('renting-parking-space')) console.log('  ', p.slug)
}

// n-gram 一致率（相手側の本文をどれだけ覆っているか）を n を変えて出す
function ngrams(s, n) {
  const t = plain(s)
  const set = new Set()
  for (let i = 0; i + n <= t.length; i++) set.add(t.slice(i, i + n))
  return set
}
console.log('\n== n-gram 一致率（分母＝それぞれの記事の n-gram 数） ==')
for (const n of [6, 8, 10, 12, 15, 20]) {
  const A = ngrams(rp.body, n), B = ngrams(vs, n)
  let hit = 0
  for (const g of B) if (A.has(g)) hit++
  const jac = hit / (A.size + B.size - hit)
  console.log(`n=${String(n).padStart(2)}  vacant側の一致 ${hit}/${B.size} = ${(hit / B.size * 100).toFixed(2)}%   renting側 ${hit}/${A.size} = ${(hit / A.size * 100).toFixed(2)}%   Jaccard ${(jac * 100).toFixed(2)}%`)
}

// 一致した長い断片を実際に出す
const A20 = ngrams(rp.body, 12), B20 = ngrams(vs, 12)
const shared = [...B20].filter(g => A20.has(g))
// 連結して読める形にする
const merged = []
for (const g of shared) {
  const last = merged[merged.length - 1]
  if (last && g.startsWith(last.slice(1))) merged[merged.length - 1] = last + g.slice(-1)
  else merged.push(g)
}
console.log('\n== 12文字以上で一致した断片 ==')
merged.forEach(s => console.log('  ' + s))
