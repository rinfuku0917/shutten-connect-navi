import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env = Object.fromEntries(
  fs.readFileSync(new URL('./.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('=')).map(l => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    })
)
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
})

const ids = [
  'e3d42eda-bff0-40ba-9bb9-4909f59559cf',
  '6e61e57a-ce36-4975-b0bf-82e6c60da6e6',
  'bf44df87-7775-4934-9365-7b83f027f725',
  '58dd9dc9-9642-483f-ad12-8dcb0550118d',
]

const { data, error } = await db.from('places').select('*').in('id', ids)
if (error) throw error
console.log('--- related places ---')
for (const id of ids) {
  const p = data.find(r => r.id === id)
  if (!p) { console.log(id, 'NOT FOUND (匿名キーでは読めない)'); continue }
  console.log(JSON.stringify({
    id: p.id, title: p.title, status: p.status, closed: p.closed,
    prefecture: p.prefecture, created_at: p.created_at,
    event_date: p.event_date ?? null, end_date: p.end_date ?? null,
    deadline: p.deadline ?? null, is_event: p.is_event ?? null,
  }, null, 1))
}
console.log('columns:', Object.keys(data[0] ?? {}).join(', '))

// 東京都で募集中の件数と、最新4件（ページ表示と一致するか）
const { data: tokyo, error: e2 } = await db
  .from('places').select('id, title, created_at')
  .eq('status', 'published').eq('closed', false).eq('prefecture', '東京都')
  .order('created_at', { ascending: false }).limit(8)
if (e2) throw e2
console.log('\n--- 東京都・募集中の新しい順 8件 ---')
tokyo.forEach((p, i) => console.log(i + 1, p.id.slice(0, 8), p.title, p.created_at))

// 全件ページング（1000行打ち切り対策）
let all = [], from = 0
for (;;) {
  const { data: page, error: e3 } = await db
    .from('places').select('id, status, closed, prefecture').range(from, from + 999)
  if (e3) throw e3
  all = all.concat(page)
  if (page.length < 1000) break
  from += 1000
}
const open = all.filter(p => p.status === 'published' && !p.closed)
console.log('\n全places:', all.length, ' 公開中:', open.length,
  ' 東京都の公開中:', open.filter(p => p.prefecture === '東京都').length)

// 記事レコードそのもの
const { data: post } = await db.from('posts').select('slug, title, status, published_at, updated_at, meta_description, related_prefecture, related_category, target_keyword').eq('slug', 'food-truck-fee-guide').maybeSingle()
console.log('\n--- post ---')
console.log(JSON.stringify(post, null, 1))
