import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env = fs.readFileSync('.env.local', 'utf8')
const get = (k) => env.split('\n').find(l => l.startsWith(k + '='))?.slice(k.length + 1).trim()
const supabase = createClient(get('NEXT_PUBLIC_SUPABASE_URL'), get('NEXT_PUBLIC_SUPABASE_ANON_KEY'))

const all = []
for (let from = 0; ; from += 1000) {
  const { data, error } = await supabase.from('places').select('id,status,closed,prefecture,host_id,recruit').range(from, from + 999)
  if (error) { console.log('ERROR:', error.message); break }
  all.push(...data)
  if (data.length < 1000) break
}
console.log('places 全件:', all.length)
const pub = all.filter(p => p.status === 'published' && !p.closed)
console.log('公開中(published かつ closed でない):', pub.length)
console.log('host_id ユニーク(全案件):', new Set(all.map(p => p.host_id).filter(Boolean)).size)
console.log('host_id ユニーク(公開中):', new Set(pub.map(p => p.host_id).filter(Boolean)).size)
const pref = {}
pub.forEach(p => { pref[p.prefecture] = (pref[p.prefecture] || 0) + 1 })
console.log('公開中の都道府県:', Object.entries(pref).sort((a, b) => b[1] - a[1]))
const rec = {}
pub.forEach(p => { rec[p.recruit] = (rec[p.recruit] || 0) + 1 })
console.log('recruit 内訳(公開中):', rec)

// DB上の記事本文（get-food-truck-offers）
const { data: post, error: pe } = await supabase.from('posts').select('slug,title,status,body,excerpt,meta_description,updated_at,created_at').eq('slug', 'get-food-truck-offers').maybeSingle()
if (pe) console.log('post ERROR:', pe.message)
else if (post) {
  console.log('\n--- DB上の記事 ---')
  console.log('status:', post.status, '/ title:', post.title)
  console.log('created_at:', post.created_at, 'updated_at:', post.updated_at)
  const md = fs.readFileSync('docs/blog/get-food-truck-offers.md', 'utf8')
  const mdBody = md.split('---\n').slice(2).join('---\n').trim()
  console.log('本文が原稿と一致:', (post.body ?? '').trim() === mdBody)
  const lines = (post.body ?? '').split('\n').filter(l => l.includes('1,386'))
  console.log('1,386 を含む行:')
  lines.forEach(l => console.log('  ' + l.slice(0, 130)))
}
