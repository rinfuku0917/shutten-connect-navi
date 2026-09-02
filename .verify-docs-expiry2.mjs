import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
const env = fs.readFileSync(new URL('./.env.local', import.meta.url), 'utf8')
const get = (k) => env.split('\n').find((l) => l.startsWith(k + '='))?.slice(k.length + 1).trim()
const sb = createClient(get('NEXT_PUBLIC_SUPABASE_URL'), get('NEXT_PUBLIC_SUPABASE_ANON_KEY'))
const { data } = await sb.from('posts').select('*').eq('slug','kitchen-car-business-license').maybeSingle()
console.log('title:', data.title)
console.log('status:', data.status, '| published_at:', data.published_at, '| updated_at:', data.updated_at)
const idx = data.content.indexOf('有効期限は5年')
console.log('--- 前後 ---')
console.log(data.content.slice(Math.max(0, idx - 400), idx + 300))
// 免許・許可の年数表記を全記事から拾う
for (let from = 0; ; from += 1000) {
  const { data: rows } = await sb.from('posts').select('slug,content,status').range(from, from + 999)
  for (const r of rows) {
    (r.content || '').split('\n').forEach((l) => {
      if (/(免許|営業許可|有効期[限間]).*\d+\s*(〜|～|-)?\s*\d*\s*年/.test(l)) console.log(`[${r.slug}/${r.status}] ${l.trim().slice(0,180)}`)
    })
  }
  if (rows.length < 1000) break
}
