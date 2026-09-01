import fs from 'node:fs'
const posts = JSON.parse(fs.readFileSync('/Users/hidekifukusada/Desktop/コネクトナビ/shutten-connect-navi/.verify-posts.json','utf8'))
const P = s => posts.find(p=>p.slug===s)

// --- 主張1: タイトルに「出店料」を含む記事は2本だけか
console.log('===== 主張1: タイトルに「出店料」 =====')
const t = posts.filter(p=>p.title.includes('出店料'))
t.forEach(p=>console.log(`  ${p.slug}: ${p.title}`))
console.log(`  → ${t.length}本`)

console.log('\n--- 参考: 本文に「出店料」を含む記事 ---')
posts.forEach(p=>{
  const n = (p.content.match(/出店料/g)||[]).length
  if(n>0) console.log(`  ${String(n).padStart(3)}回  ${p.slug}  (${p.category})`)
})

console.log('\n--- 参考: 料金系の語をタイトルに含む記事 ---')
for (const w of ['料金','費用','相場','いくら','価格','コスト']) {
  const hit = posts.filter(p=>p.title.includes(w))
  console.log(`  「${w}」: ${hit.length}本 ${hit.map(p=>p.slug).join(', ')}`)
}

// --- 主張2: 両方とも先頭が「キッチンカーの出店料」
console.log('\n===== 主張2: タイトル先頭 =====')
t.forEach(p=>console.log(`  ${p.slug}: 先頭10字=「${p.title.slice(0,10)}」 「キッチンカーの出店料」で始まる=${p.title.startsWith('キッチンカーの出店料')}`))

// --- 主張4: H2見出し比較
console.log('\n===== 主張4: H2/H3見出し =====')
for (const s of ['food-truck-fee-guide','host-fee-setting-guide2']) {
  const p = P(s)
  console.log(`\n【${s}】${p.title}`)
  const hs = [...p.content.matchAll(/<(h[1-4])[^>]*>([\s\S]*?)<\/\1>/g)]
  if (hs.length) hs.forEach(m=>console.log(`   <${m[1]}> ${m[2].replace(/<[^>]+>/g,'').trim()}`))
  else [...p.content.matchAll(/^(#{1,4})\s+(.+)$/gm)].forEach(m=>console.log(`   ${m[1]} ${m[2]}`))
}
