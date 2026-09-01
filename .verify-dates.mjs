import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('=')).map(l => {
    const i = l.indexOf('=')
    return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
  })
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

const { data: post, error } = await sb.from('posts').select('*').eq('slug', 'food-truck-fee-guide').maybeSingle()
if (error) { console.error(error); process.exit(1) }

console.log('=== posts row (raw date fields) ===')
console.log('id            :', post.id)
console.log('status        :', post.status)
console.log('published_at  :', JSON.stringify(post.published_at))
console.log('updated_at    :', JSON.stringify(post.updated_at))
console.log('created_at    :', JSON.stringify(post.created_at))

const fmt = (v) => v ? new Date(v).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' }) : '(none)'
console.log('\n=== rendered exactly as page.tsx line 75 does (toLocaleDateString ja-JP, server TZ=' + Intl.DateTimeFormat().resolvedOptions().timeZone + ') ===')
console.log('dateStr from published_at :', fmt(post.published_at))
console.log('would-be from updated_at  :', fmt(post.updated_at))
console.log('UTC published_at          :', post.published_at ? new Date(post.published_at).toISOString() : '-')
console.log('UTC updated_at            :', post.updated_at ? new Date(post.updated_at).toISOString() : '-')

// どの日付文字列が本文（DB の content）に何回出るか、自分で数え直す
const body = post.content || ''
const dateHits = body.match(/20\d{2}年\d{1,2}月\d{1,2}日/g) || []
const counts = {}
for (const h of dateHits) counts[h] = (counts[h] || 0) + 1
console.log('\n=== 本文(DB content)に出てくる「◯年◯月◯日」の実測 ===')
console.log('総出現数:', dateHits.length)
console.log(counts)

// 出現箇所を行ごとに
console.log('\n=== 出現行 ===')
body.split('\n').forEach((line, i) => {
  if (/20\d{2}年\d{1,2}月\d{1,2}日/.test(line)) console.log(`L${i + 1}: ${line.trim().slice(0, 160)}`)
})

// 「更新」「時点」「集計」といった断り書きが本文にあるか
console.log('\n=== 断り書き候補（更新/時点/集計/現在/スナップショット）を含む行 ===')
body.split('\n').forEach((line, i) => {
  if (/(更新|時点|集計|現在|snapshot|データ取得)/.test(line)) console.log(`L${i + 1}: ${line.trim().slice(0, 200)}`)
})

// frontmatter が content に残っているか（data_snapshot が画面に出るか）
console.log('\n=== content 先頭200字（frontmatterが残っているか確認） ===')
console.log(JSON.stringify(body.slice(0, 200)))

// 他の記事の published_at / updated_at も見て、この記事だけの問題か確認
const { data: all } = await sb.from('posts').select('slug,status,published_at,updated_at').order('published_at', { ascending: false })
console.log('\n=== 全記事の日付 ===')
for (const p of all || []) {
  console.log(`${p.slug.padEnd(32)} status=${String(p.status).padEnd(10)} pub=${String(p.published_at).slice(0, 10)} upd=${String(p.updated_at).slice(0, 19)}`)
}

// 公開中の案件数を独自に数え直す（本文の「110件」の検証）
let from = 0, rows = []
for (;;) {
  const { data, error: e2 } = await sb.from('places').select('id,status,closed').range(from, from + 999)
  if (e2) { console.error(e2); break }
  rows = rows.concat(data)
  if (data.length < 1000) break
  from += 1000
}
const publishedOpen = rows.filter(r => r.status === 'published' && !r.closed)
console.log('\n=== places 実測 ===')
console.log('places 全行数              :', rows.length)
console.log('status=published かつ closed偽:', publishedOpen.length)
