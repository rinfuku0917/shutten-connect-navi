import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
const env = Object.fromEntries(
  fs.readFileSync(new URL('./.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const rows = []
for (let from = 0; ; from += 500) {
  const { data } = await sb.from('places').select('title, fee, status, closed, place_type').order('id').range(from, from + 499)
  rows.push(...data); if (data.length < 500) break
}
const pub = rows.filter(r => r.status === 'published' && !r.closed)
const ten = pub.filter(r => {
  const n = [...(r.fee || '').matchAll(/(\d+(?:\.\d+)?)\s*[%％]/g)].map(m => Number(m[1]))
  return n.length && n.every(x => x === 10)
})
const tax = ten.filter(r => /税/.test(r.fee))
const combo = ten.filter(r => /円/.test(r.fee))
const cap = ten.filter(r => /上限|最低|保証/.test(r.fee))
const bare = ten.filter(r => !/税|円|上限|最低|保証|別/.test(r.fee))
console.log('10%案件 合計:', ten.length)
console.log('  うち「＋税」等 税の記載あり(実効11%側にズレる):', tax.length)
console.log('  うち固定円が併記(単純な10%ではない):', combo.length, combo.map(r => r.fee))
console.log('  うち上限/最低保証あり:', cap.length, cap.map(r => r.fee))
console.log('  うち注釈なしの純粋な「10%」表記のみ:', bare.length, bare.map(r => r.fee))
// 記事が「およそ7割」と書いた根拠の再計算（笠寺を除いた場合）
console.log('\n7割の検算: 36/53 =', (36 / 53 * 100).toFixed(1) + '%', ' / 笠寺除外 35/52 =', (35 / 52 * 100).toFixed(1) + '%')
