// 既存の募集者向け記事との食い合い（本文が違っても検索意図が同じ組）
import fs from 'fs'
const SC = '/private/tmp/claude-501/-Users-hidekifukusada-Desktop--------shutten-connect-navi/db7d6515-4023-44ab-9971-494a02f7a39c/scratchpad'
const posts = JSON.parse(fs.readFileSync(`${SC}/posts.json`, 'utf8'))
const MS = ['food-truck-fee-guide', 'kitchen-car-location-guide', 'renting-parking-space',
  'kitchen-car-required-documents', 'get-food-truck-offers', 'weekday-food-truck-spots',
  'supermarket-food-truck', 'mall-food-truck-event']
const body = raw => raw.replace(/^---\n[\s\S]*?\n---\n/, '')
const doc = {}, title = {}, meta = {}
for (const s of MS) {
  const raw = fs.readFileSync(`docs/blog/${s}.md`, 'utf8')
  const fm = raw.match(/^---\n([\s\S]*?)\n---\n/)[1]
  doc[s] = body(raw)
  title[s] = (fm.match(/^title:\s*(.+)$/m) ?? [, ''])[1]
  meta[s] = (fm.match(/^meta_description:\s*(.+)$/m) ?? [, ''])[1]
}
for (const p of posts) if (!doc[p.slug]) { doc[p.slug] = String(p.content ?? ''); title[p.slug] = p.title; meta[p.slug] = p.meta_description ?? '' }

const hard = t => t.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
  .replace(/[#*>`|:\-—–…「」『』（）()【】\[\]"'\/]/g, '').replace(/\s+/g, '')
function cov(a, b, n = 12) {
  const B = new Set(); for (let i = 0; i + n <= b.length; i++) B.add(b.slice(i, i + n))
  const hit = new Array(a.length).fill(false)
  for (let i = 0; i + n <= a.length; i++) if (B.has(a.slice(i, i + n))) for (let k = i; k < i + n; k++) hit[k] = true
  return hit.filter(Boolean).length / a.length
}
// 語の重なり（2〜4文字の名詞っぽい塊をざっくり）
const words = t => new Set((hard(t).match(/[一-龥ァ-ヴー]{2,6}/g) ?? []))
const wjac = (a, b) => { const A = words(doc[a]), B = words(doc[b]); let i = 0; for (const x of A) if (B.has(x)) i++; return i / (A.size + B.size - i) }

const PAIRS = [
  ['mall-food-truck-event', 'host-fee-setting-guide', '商業施設×募集者。seo-keywords の棚卸しは host-fee-setting-guide を D-30 と書いている'],
  ['mall-food-truck-event', 'regular-event-schedule', '商業施設で定期開催する設計'],
  ['mall-food-truck-event', 'how-to-invite-kitchen-car', '呼ぶ側の手順'],
  ['renting-parking-space', 'vacant-space-food-truck', '空きスペースを貸す。どちらも D-33'],
  ['supermarket-food-truck', 'vacant-space-food-truck', '駐車場を貸す側'],
  ['supermarket-food-truck', 'host-fee-setting-guide', '施設に入れる効果'],
  ['renting-parking-space', 'host-fee-setting-guide', '貸す側'],
  ['kitchen-car-location-guide', 'first-food-truck-checklist', '出店の準備'],
  ['kitchen-car-required-documents', 'kitchen-car-business-license', '営業許可・書類'],
  ['food-truck-fee-guide', 'kitchen-car-profit-menu', '儲け'],
  ['get-food-truck-offers', 'first-food-truck-checklist', '出店者の準備'],
]
console.log('slug ペア / 12字被覆(A,B) / 語のJaccard / 備考')
for (const [a, b, note] of PAIRS) {
  const A = hard(doc[a]), B = hard(doc[b])
  console.log(`\n${a}\n  × ${b}`)
  console.log(`  12字被覆 A側${(cov(A, B) * 100).toFixed(1)}% / B側${(cov(B, A) * 100).toFixed(1)}%   語のJaccard ${(wjac(a, b) * 100).toFixed(1)}%`)
  console.log(`  A: ${title[a]}`)
  console.log(`  B: ${title[b]}`)
  console.log(`  → ${note}`)
}
console.log('\n\n=== タイトル・meta のひな型の重なり（8本） ===')
for (const s of MS) console.log(`  ${s.padEnd(32)} ${title[s]}`)
console.log()
for (const s of MS) console.log(`  ${s.padEnd(32)} ${meta[s].slice(0, 60)}…`)
