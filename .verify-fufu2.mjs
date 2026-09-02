import fs from 'fs'
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n')
  .filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]))
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL, KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
async function all(table, cols) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${URL_}/rest/v1/${table}?select=${encodeURIComponent(cols)}`,
      { headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, Range: `${from}-${from + 999}` } })
    if (!r.ok) { console.log('ERR', r.status, await r.text()); break }
    const j = await r.json(); out.push(...j); if (j.length < 1000) break
  }
  return out
}
const cols = 'id,title,status,closed,fee,day_type_fees,schedule,price_fixed,price_share_pct,place_fixed_unit,company_fixed_amount,company_fixed_unit,company_share_pct,prefecture,place_type,address,genres'
const rows = await all('places', cols)
const pub = rows.filter(r => r.status === 'published' && !r.closed)
console.log('公開中:', pub.length)

const sum = s => s ? ((typeof s.placeFee === 'number' ? s.placeFee : 0) + (typeof s.companyFee === 'number' ? s.companyFee : 0)) : null
const dtf = r => (r.day_type_fees && typeof r.day_type_fees === 'object') ? r.day_type_fees : null
// fee本文から円額を全部拾う
const yens = t => [...String(t || '').matchAll(/([0-9][0-9,]*)\s*円/g)].map(m => parseInt(m[1].replace(/,/g, ''), 10))

// ---- スーパーらしき案件を、記事とは別の当たり方（店名キーワード）で拾う ----
const superRe = /スーパー|マート|マーケット|ドン・?キホーテ|ドンキ|Olympic|オリンピック|食品館|生鮮|ストア|業務スーパー|ライフ|イオン|ヨークベニマル|カスミ|ベルク|フードオアシス/i
const sup = pub.filter(r => superRe.test(r.title || '') || superRe.test(r.address || ''))
console.log('店名/住所がスーパー系:', sup.length)

// ---- day_type_fees を持つ公開案件すべてで、fee本文と設定値を突き合わせる ----
console.log('\n=== day_type_fees あり公開案件：fee本文 vs 設定値 ===')
const withDtf = pub.filter(r => dtf(r) && (dtf(r).weekday || dtf(r).weekend))
console.log('件数:', withDtf.length)
const groups = new Map()
for (const r of withDtf) {
  const d = dtf(r)
  const wd = sum(d.weekday), we = sum(d.weekend)
  const ys = yens(r.fee)
  const okWd = ys.includes(wd), okWe = ys.includes(we)
  const key = `${wd}/${we}`
  if (!groups.has(key)) groups.set(key, [])
  groups.get(key).push(r)
  const flag = (okWd && okWe) ? 'OK  ' : '★ズレ'
  console.log(`${flag} 設定 平日${wd}/週末${we} | fee内金額[${[...new Set(ys)].join(',')}] | ${r.title}`)
}
console.log('\n--- 設定値の組み合わせごとの件数 ---')
for (const [k, v] of [...groups.entries()].sort((a, b) => b[1].length - a[1].length)) console.log(k, ':', v.length, '件')

// ---- ドンキ系だけ ----
console.log('\n=== ドンキ系（公開中）一覧 ===')
const donki = pub.filter(r => /ドン・?キホーテ|ドンキ/i.test(r.title || ''))
console.log('件数:', donki.length)
for (const r of donki) {
  const d = dtf(r)
  console.log(`  平日${sum(d?.weekday)}/週末${sum(d?.weekend)} | fee[${[...new Set(yens(r.fee))].join(',')}] | schedule=${r.schedule ? 'あり' : 'null'} | ${r.title}`)
}
