import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n')
  .filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim()]}))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

// 1. posts 全件（1000行打ち切り対策で range 送り）
let all = [], from = 0
for(;;){
  const { data, error } = await sb.from('posts').select('slug,title,status,published_at,updated_at,content').range(from, from+499)
  if (error) { console.log('ERR', error.message); break }
  all = all.concat(data); if (data.length < 500) break; from += 500
}
console.log('=== posts 総数:', all.length)
for (const p of all) console.log(`  ${p.status.padEnd(10)} ${p.slug}`)

const TARGET = 'kitchen-car-required-documents'
const t = all.find(p=>p.slug===TARGET)
console.log('\n=== 対象記事の行:', t ? JSON.stringify({slug:t.slug,status:t.status,published_at:t.published_at,len:t.content.length}) : '行そのものが無い')

// 2. 公開中3本の DB本文に、対象へのリンクが実在するか（docs/ ではなく DB を見る）
const PUB = ['food-truck-fee-guide','kitchen-car-location-guide','renting-parking-space']
console.log('\n=== 公開中3本のDB本文中のリンク ===')
for (const s of PUB) {
  const p = all.find(x=>x.slug===s)
  if (!p) { console.log(`  ${s}: DBに無い`); continue }
  const hits = [...p.content.matchAll(new RegExp(`\\[([^\\]]*)\\]\\(/blog/${TARGET}\\)`,'g'))]
  console.log(`  ${s}  status=${p.status}  該当リンク=${hits.length}件  ${hits.map(h=>`「${h[1]}」`).join(' ')}`)
  // 本文中の全内部リンクも数える
  const allLinks = [...p.content.matchAll(/\]\((\/[^)]*)\)/g)].map(m=>m[1])
  console.log(`     本文中の内部リンク全部: ${JSON.stringify([...new Set(allLinks)])}`)
}
