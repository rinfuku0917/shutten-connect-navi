// 書類記事の唯一の統計「学校30件 / 商業施設29件 / 募集中110件」を places から確かめる
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
const env = fs.readFileSync(new URL('./.env.local', import.meta.url), 'utf8')
const get = k => (env.match(new RegExp('^' + k + '=(.*)$', 'm')) || [])[1]?.trim()
const sb = createClient(get('NEXT_PUBLIC_SUPABASE_URL'), get('NEXT_PUBLIC_SUPABASE_ANON_KEY'))

// .range() で全件回す
let all = [], from = 0
for (;;) {
  const { data, error } = await sb.from('places').select('*').range(from, from + 499)
  if (error) { console.log('ERR', error.message); break }
  all = all.concat(data)
  if (data.length < 500) break
  from += 500
}
console.log('places 全件:', all.length)
console.log('列:', Object.keys(all[0] || {}).join(', '))

const pub = all.filter(p => p.status === 'published' && !p.closed)
console.log('公開中(status=published かつ closed偽):', pub.length)

const tally = {}
for (const p of pub) { const c = p.category ?? '(なし)'; tally[c] = (tally[c] || 0) + 1 }
console.log('カテゴリ別:', JSON.stringify(
  Object.entries(tally).sort((a, b) => b[1] - a[1]), null, 1))
