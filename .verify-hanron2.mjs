import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
const env = Object.fromEntries(
  fs.readFileSync(new URL('./.env.local', import.meta.url), 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')] }))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

async function all(cols) {
  const out = []; let from = 0; const step = 500
  for (;;) {
    const { data, error } = await sb.from('places').select(cols).order('id').range(from, from + step - 1)
    if (error) throw error
    out.push(...data); if (data.length < step) break; from += step
  }
  return out
}
// まず1行だけ取って列名を見る
const { data: one, error: e1 } = await sb.from('places').select('*').limit(1)
if (e1) throw e1
console.log('列名:', Object.keys(one[0]).join(', '))

const rows = await all('*')
const pub = rows.filter(r => r.status === 'published' && !r.closed)
console.log('\n公開中:', pub.length)

console.log('\n===== 公開中110件の title / prefecture / dtf / 固定額 =====')
for (const r of pub) {
  const fixed = (r.price_fixed || 0) + (r.company_fixed_amount || 0)
  console.log([
    (r.title || '').padEnd(28),
    (r.prefecture || '').padEnd(5),
    'type=' + r.place_type,
    'fixed=' + fixed + '(p' + r.price_fixed + '+c' + r.company_fixed_amount + ')',
    'pct=' + r.price_share_pct + '/' + r.company_share_pct,
    'dtf=' + JSON.stringify(r.day_type_fees),
    'cat=' + JSON.stringify(r.category ?? r.genres ?? null),
    'fee=' + JSON.stringify((r.fee || '').slice(0, 40)),
  ].join(' '))
}
