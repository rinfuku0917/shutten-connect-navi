import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = Object.fromEntries(
  fs.readFileSync(new URL('./.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('=')).map(l => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    })
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

const cols = 'id, title, prefecture, place_type, status, closed, fee, price_fixed, price_share_pct, place_fixed_unit, company_fixed_amount, company_fixed_unit, company_share_pct, day_type_fees, schedule, open_days, description'

let all = []
for (let from = 0; ; from += 500) {
  const { data, error } = await sb.from('places').select(cols).range(from, from + 499)
  if (error) { console.error(error); process.exit(1) }
  all = all.concat(data)
  if (data.length < 500) break
}
console.log('全行数:', all.length)

const pub = all.filter(p => p.status === 'published' && !p.closed)
console.log('公開中:', pub.length)

// --- 対象案件の生データ ---
const target = pub.filter(p => (p.title || '').includes('尼涼') || (p.title || '').includes('アミュゼ'))
for (const t of target) {
  console.log('\n===== 対象案件 =====')
  console.log(JSON.stringify({
    id: t.id, title: t.title, prefecture: t.prefecture, place_type: t.place_type,
    fee: t.fee, price_fixed: t.price_fixed, price_share_pct: t.price_share_pct,
    place_fixed_unit: t.place_fixed_unit, company_fixed_amount: t.company_fixed_amount,
    company_share_pct: t.company_share_pct,
    day_type_fees: t.day_type_fees, schedule: t.schedule, open_days: t.open_days,
    description: (t.description || '').slice(0, 600)
  }, null, 2))
}

// --- 「駐車場」を含む fee の案件を全部見る ---
console.log('\n===== fee に「駐車場」を含む公開案件 =====')
for (const p of pub.filter(p => (p.fee || '').includes('駐車場'))) {
  console.log('-', p.title, '|', JSON.stringify(p.fee), '| place_type=', p.place_type)
}

// --- fee 中に複数金額が並ぶ案件（誤読リスク） ---
console.log('\n===== fee に円が2つ以上出る公開案件 =====')
for (const p of pub) {
  const m = (p.fee || '').match(/[\d,]+\s*円/g)
  if (m && m.length >= 2) console.log('-', p.title, '|', JSON.stringify(p.fee))
}

fs.writeFileSync(new URL('./.verify-fee-recount.json', import.meta.url), JSON.stringify(pub, null, 2))
console.log('\n書き出し完了')
