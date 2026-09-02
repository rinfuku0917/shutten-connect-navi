import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env = fs.readFileSync('.env.local', 'utf8')
const get = (k) => env.split('\n').find(l => l.startsWith(k + '='))?.slice(k.length + 1).trim()
const supabase = createClient(get('NEXT_PUBLIC_SUPABASE_URL'), get('NEXT_PUBLIC_SUPABASE_ANON_KEY'))

// places の列を確認
{
  const { data, error } = await supabase.from('places').select('*').limit(1)
  console.log('places 列:', error ? 'ERROR ' + error.message : Object.keys(data[0] ?? {}).join(', '))
}

// places 全件を range で回して、募集者(host)のユニーク数を数える
const all = []
for (let from = 0; ; from += 1000) {
  const { data, error } = await supabase.from('places').select('id,status,closed,prefecture,user_id,host_id,owner_id,created_by').range(from, from + 999)
  if (error) { console.log('places 取得 ERROR:', error.message); break }
  all.push(...data)
  if (data.length < 1000) break
}
if (all.length) {
  console.log('places 全件:', all.length)
  const pub = all.filter(p => p.status === 'published' && !p.closed)
  console.log('公開中:', pub.length)
  for (const key of ['user_id', 'host_id', 'owner_id', 'created_by']) {
    if (all[0] && key in all[0]) {
      const s = new Set(all.map(p => p[key]).filter(Boolean))
      console.log(`  ${key} ユニーク数(全案件):`, s.size)
    }
  }
}

// public_sellers に「未承認」が混ざらないことの再確認 + role の他値が取れるか
for (const filt of [['role', 'host'], ['approval_status', 'pending'], ['approval_status', 'rejected'], ['approval_status', 'unsubmitted']]) {
  const { count, error } = await supabase.from('public_sellers').select('*', { count: 'exact', head: true }).eq(filt[0], filt[1])
  console.log(`public_sellers ${filt[0]}=${filt[1]}:`, error ? 'ERROR ' + error.message : count)
}

// menus / posts
{
  const { count, error } = await supabase.from('posts').select('*', { count: 'exact', head: true })
  console.log('posts:', error ? 'ERROR ' + error.message : count)
}
{
  const { data, error } = await supabase.from('posts').select('slug,status,title').order('slug')
  if (!error) console.log('posts 一覧:', data.map(p => `${p.slug}(${p.status})`).join(', '))
}
