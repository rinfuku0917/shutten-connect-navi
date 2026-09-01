import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim()]}))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
// 1000行打ち切り対策: range で全件回す
let all = [], from = 0
for (;;) {
  const { data, error } = await sb.from('places').select('*').range(from, from + 499)
  if (error) { console.log('ERR', error); process.exit(1) }
  all = all.concat(data)
  if (data.length < 500) break
  from += 500
}
console.log('places 総行数:', all.length)
console.log('列:', Object.keys(all[0]).join(','))
const pub = all.filter(p => p.status === 'published' && !p.closed)
console.log('公開中(status=published かつ closed偽):', pub.length)
// created_at / updated_at の分布
const key = 'created_at'
const buckets = {}
for (const p of pub) { const d = (p[key]||'').slice(0,7); buckets[d] = (buckets[d]||0)+1 }
console.log('公開中案件の created_at 月別:', JSON.stringify(buckets))
const after715 = pub.filter(p => p.created_at && p.created_at >= '2026-07-15')
console.log('2026-07-15以降に作られた公開中案件:', after715.length)
const upd = pub.filter(p => p.updated_at && p.updated_at >= '2026-07-15')
console.log('2026-07-15以降に更新された公開中案件:', upd.length)
// 終了/非公開になったもののうち 7/15 以降に更新されたもの
const gone = all.filter(p => !(p.status === 'published' && !p.closed))
console.log('非公開or終了:', gone.length, '/ うち7/15以降更新:', gone.filter(p=>p.updated_at&&p.updated_at>='2026-07-15').length)
fs.writeFileSync('.verify-datecheck-places.json', JSON.stringify(pub, null, 1))
