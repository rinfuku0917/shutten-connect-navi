import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env = Object.fromEntries(
  fs.readFileSync(new URL('./.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

async function all(table, select, tweak = q => q) {
  const out = []
  for (let from = 0; ; from += 1000) {
    let q = sb.from(table).select(select).range(from, from + 999)
    q = tweak(q)
    const { data, error } = await q
    if (error) return { error: error.message, rows: out }
    out.push(...data)
    if (data.length < 1000) break
  }
  return { rows: out }
}

// 1) applications: 決裁の痕跡があるか（誰が決めたかの列があるか）
const one = await sb.from('applications').select('*').limit(1)
console.log('=== applications columns (anon readable) ===')
console.log(one.error ? 'ERROR: ' + one.error.message : Object.keys(one.data?.[0] ?? {}).join(', ') || '(0 rows / not readable)')

const apps = await all('applications', 'id,status,created_at,place_id,seller_id')
console.log('\n=== applications ===')
if (apps.error) console.log('ERROR:', apps.error)
console.log('total rows readable:', apps.rows.length)
const byStatus = {}
for (const a of apps.rows) byStatus[a.status ?? 'null'] = (byStatus[a.status ?? 'null'] || 0) + 1
console.log('by status:', JSON.stringify(byStatus))

// 2) seller_documents は匿名で読めるか（記事の「運営側の画面に書類の状況」の裏付け対象）
const docs = await sb.from('seller_documents').select('id,seller_id,status').limit(5)
console.log('\n=== seller_documents (anon) ===')
console.log(docs.error ? 'NOT READABLE: ' + docs.error.message : `readable, sample ${docs.data.length} rows`)

// 3) profiles の role 分布（募集者=host が本当に居て、自分で決めているのか手がかり）
const profs = await all('profiles', 'id,role')
console.log('\n=== profiles ===')
if (profs.error) console.log('ERROR:', profs.error)
console.log('total readable:', profs.rows.length)
const byRole = {}
for (const p of profs.rows) byRole[p.role ?? 'null'] = (byRole[p.role ?? 'null'] || 0) + 1
console.log('by role:', JSON.stringify(byRole))

// 4) places: 募集中の件数（記事の「募集中110件」の裏取り・同記事内の別主張）
const places = await all('places', 'id,title,status,closed,host_id')
console.log('\n=== places ===')
if (places.error) console.log('ERROR:', places.error)
const open = places.rows.filter(p => p.status === 'published' && !p.closed)
console.log('total readable:', places.rows.length, '/ published & not closed:', open.length)

// 5) 募集中案件の host_id が何人にまたがるか（＝募集者が実在して自画面を使う余地があるか）
const hostIds = new Set(open.map(p => p.host_id).filter(Boolean))
console.log('distinct host_id on open places:', hostIds.size)

// 6) 応募がある案件の host が、その応募を自分で決められる立場か
const openIds = new Set(open.map(p => p.id))
const appsOnOpen = apps.rows.filter(a => openIds.has(a.place_id))
console.log('\napplications on open places:', appsOnOpen.length)

// 7) ブログ記事の公開状態（下書き確認）
const posts = await all('posts', 'slug,status,published,title')
console.log('\n=== posts ===')
if (posts.error) {
  const p2 = await all('posts', '*')
  console.log('retry cols:', p2.error ? 'ERROR ' + p2.error : Object.keys(p2.rows[0] ?? {}).join(', '))
  for (const p of p2.rows) console.log(' -', p.slug, '| status=', p.status, '| published=', p.published)
} else {
  for (const p of posts.rows) console.log(' -', p.slug, '| status=', p.status, '| published=', p.published)
}
