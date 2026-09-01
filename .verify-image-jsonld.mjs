import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] })
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

// firstImage() のロジックをそのまま複製
function firstImage(content) {
  if (!content) return null
  const md = content.match(/!\[[^\]]*\]\((https:\/\/[^)\s]+)\)/)
  if (md) return md[1]
  const html = content.match(/<img[^>]+src=["'](https:\/\/[^"']+)["']/)
  return html ? html[1] : null
}

// 全件を range で回す
let all = []
for (let from = 0; ; from += 1000) {
  const { data, error } = await sb.from('posts')
    .select('slug,title,status,content,cover_emoji,published_at')
    .order('published_at', { ascending: false })
    .range(from, from + 999)
  if (error) { console.error(error); process.exit(1) }
  all = all.concat(data)
  if (data.length < 1000) break
}

const pub = all.filter(p => p.status === 'published')
console.log('posts 全件:', all.length, '/ published:', pub.length)
console.log('status の内訳:', JSON.stringify(all.reduce((a, p) => (a[p.status] = (a[p.status] || 0) + 1, a), {})))

const withImg = pub.filter(p => firstImage(p.content))
const noImg = pub.filter(p => !firstImage(p.content))
console.log('\n=== published のうち firstImage が返る/返らない ===')
console.log('画像あり:', withImg.length, ' 画像なし:', noImg.length)
console.log('\n--- 画像なしの published 記事 ---')
for (const p of noImg) {
  console.log(` - ${p.slug} | emoji=${p.cover_emoji} | ![ の数=${(p.content.match(/!\[/g) || []).length} | <img の数=${(p.content.match(/<img/g) || []).length} | ${p.title.slice(0, 30)}`)
}
console.log('\n--- 画像ありの published 記事（先頭画像URL） ---')
for (const p of withImg) console.log(` - ${p.slug} -> ${firstImage(p.content).slice(0, 80)}`)

// 対象記事の詳細
const t = pub.find(p => p.slug === 'food-truck-fee-guide')
console.log('\n=== food-truck-fee-guide ===')
console.log('見つかった:', !!t, '| firstImage:', t && firstImage(t.content))
if (t) {
  console.log('本文の長さ:', t.content.length)
  console.log('画像記法の出現:', JSON.stringify({ md: (t.content.match(/!\[/g)||[]).length, img: (t.content.match(/<img/g)||[]).length, httpsAny: (t.content.match(/https:\/\//g)||[]).length }))
}
