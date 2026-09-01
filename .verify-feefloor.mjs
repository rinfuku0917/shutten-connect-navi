import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env = fs.readFileSync('/Users/hidekifukusada/Desktop/コネクトナビ/shutten-connect-navi/.env.local', 'utf8')
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim()
const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)[1].trim()
const sb = createClient(url, key)

const all = []
for (let from = 0; ; from += 500) {
  const { data, error } = await sb.from('places').select('*').range(from, from + 499)
  if (error) throw error
  all.push(...data)
  if (data.length < 500) break
}
console.log('全行数:', all.length)

const pub = all.filter(p => p.status === 'published' && !p.closed)
console.log('公開中(status=published かつ closed偽):', pub.length)

fs.writeFileSync('/private/tmp/claude-501/-Users-hidekifukusada-Desktop--------shutten-connect-navi/db7d6515-4023-44ab-9971-494a02f7a39c/scratchpad/pub.json', JSON.stringify(pub, null, 2))

// ---- 出店料テキストを全部出す（分類は後で自分の目でやる）----
console.log('\n===== 公開中 全件の fee / price_fixed / price_share_pct / day_type_fees =====')
for (const p of pub) {
  console.log('---')
  console.log('id:', p.id)
  console.log('title:', p.title)
  console.log('fee:', JSON.stringify(p.fee))
  console.log('price_fixed:', p.price_fixed, '| price_share_pct:', p.price_share_pct, '| place_fixed_unit:', p.place_fixed_unit)
  console.log('day_type_fees:', JSON.stringify(p.day_type_fees))
}
