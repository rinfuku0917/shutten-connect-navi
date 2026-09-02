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
const rows = await all('id,title,status,closed,fee,day_type_fees,price_fixed,price_share_pct,company_fixed_amount,company_share_pct,prefecture,place_type,host_id')
const pub = rows.filter(r => r.status === 'published' && !r.closed)
console.log('公開中:', pub.length, '（記事の110件と一致するか）')

const oly = pub.filter(r => /Olympic|オリンピック/i.test(r.title))
const sanyu = pub.filter(r => /サンユー/.test(r.title))
console.log('\nOlympic系:', oly.length, '件 / サンユーストアー:', sanyu.length, '件')

// Olympic の day_type_fees パターン
const pat = new Map()
for (const r of oly) {
  const k = JSON.stringify(r.day_type_fees)
  if (!pat.has(k)) pat.set(k, [])
  pat.get(k).push(r.title)
}
console.log('\n===== Olympic系の day_type_fees パターン =====')
for (const [k, t] of pat) {
  const d = k === 'null' ? null : JSON.parse(k)
  const tot = s => s ? (s.placeFee || 0) + (s.companyFee || 0) : null
  console.log(`\n${t.length}件  ${k}`)
  if (d) {
    console.log(`   出店者が払う総額: 平日${tot(d.weekday)}円 / 週末${tot(d.weekend)}円`)
    console.log(`   店舗(取引先)の受取: 平日${d.weekday?.placeFee}円 / 週末${d.weekend?.placeFee}円`)
    console.log(`   弊社の利益      : 平日${d.weekday?.companyFee}円 / 週末${d.weekend?.companyFee}円`)
  }
  console.log('   ', t.join(' / '))
}

// サンユーの分解の有無
console.log('\n===== サンユーストアー14件の構造化データ =====')
for (const r of sanyu) {
  console.log(` price_fixed=${r.price_fixed} company_fixed=${r.company_fixed_amount} pct=${r.price_share_pct}/${r.company_share_pct} dtf=${JSON.stringify(r.day_type_fees)} | ${r.title} | fee=${JSON.stringify(r.fee)}`)
}

// 公開中全体で placeFee/companyFee の分解が入っている案件
console.log('\n===== 公開中で day_type_fees に分解が入っている案件（全体） =====')
const withSplit = pub.filter(r => {
  const d = r.day_type_fees
  return d && typeof d === 'object' && ['weekday','weekend'].some(k => d[k] && (typeof d[k].placeFee === 'number' || typeof d[k].companyFee === 'number'))
})
console.log('件数:', withSplit.length)
const anySplit = pub.filter(r => (r.price_fixed || 0) > 0 || (r.company_fixed_amount || 0) > 0)
console.log('price_fixed or company_fixed_amount が0より大きい公開案件:', anySplit.length)
anySplit.forEach(r => console.log('  ', r.title, 'p=' + r.price_fixed, 'c=' + r.company_fixed_amount))

// 店舗の受取が総額と一致する案件はあるか（＝placeFeeが総額の案件）
console.log('\n===== 分解ありの案件で「店舗の受取 = 出店者の支払総額」になっているものはあるか =====')
for (const r of withSplit) {
  const d = r.day_type_fees
  const eq = ['weekday','weekend'].every(k => !d[k] || (d[k].companyFee || 0) === 0)
  console.log(`  ${eq ? '一致（会社の取り分0）' : '不一致（会社が抜いている）'} : ${r.title}`)
}
