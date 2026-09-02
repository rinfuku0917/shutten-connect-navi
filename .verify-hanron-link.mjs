import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env = Object.fromEntries(
  fs.readFileSync(new URL('./.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('=')).map(l => {
      const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    })
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

// 1) posts を .range() で全件（匿名キーで読める範囲）
let all = [], from = 0
for (;;) {
  const { data, error } = await sb.from('posts')
    .select('slug,title,status,published_at,category')
    .order('slug').range(from, from + 999)
  if (error) { console.log('ERR', error.message); break }
  all = all.concat(data)
  if (data.length < 1000) break
  from += 1000
}
console.log('=== 匿名キーで読める posts:', all.length, '件')
for (const p of all) console.log(`  ${p.status.padEnd(10)} ${p.slug}`)

const TARGET = 'kitchen-car-required-documents'
console.log(`\n=== ${TARGET} は匿名キーで見えるか:`,
  all.some(p => p.slug === TARGET) ? 'はい（＝published）' : 'いいえ')

// 2) 公開3本のDB本文に、リンクが何本入っているか＋前後の文脈
const PUB = ['food-truck-fee-guide', 'kitchen-car-location-guide', 'renting-parking-space']
for (const slug of PUB) {
  const { data } = await sb.from('posts').select('content,status').eq('slug', slug).maybeSingle()
  if (!data) { console.log(`\n[${slug}] DBから取得できず`); continue }
  const c = data.content
  const links = [...c.matchAll(/\[([^\]]*)\]\(([^)]*required-documents[^)]*)\)/g)]
  console.log(`\n[${slug}] status=${data.status} 本文中のリンク数=${links.length}`)
  for (const m of links) {
    const i = c.indexOf(m[0])
    console.log('  --- 前後200字 ---')
    console.log('  ' + c.slice(Math.max(0, i - 200), i + m[0].length + 120).replace(/\n/g, '\n  '))
  }
  // 「近日公開」等の断り書きがないか
  for (const w of ['近日', '公開予定', '準備中', 'まもなく', '執筆中']) {
    if (c.includes(w)) console.log(`  ※断り書き候補「${w}」が本文にあり`)
  }
}
