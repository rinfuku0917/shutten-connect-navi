import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env = Object.fromEntries(
  fs.readFileSync(new URL('./.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('=')).map(l => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    })
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

// まず places の全カラムを1件見る
const { data: one } = await sb.from('places').select('*').limit(1)
console.log('places のカラム:', Object.keys(one[0]).join(', '))

async function all(select) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from('places').select(select).range(from, from + 999)
    if (error) { console.log('ERR', error.message); return out }
    out.push(...data)
    if (data.length < 1000) break
  }
  return out
}
const rows = await all('*')
const pub = rows.filter(r => r.status === 'published' && !r.closed)
console.log('\n公開中:', pub.length, '件')

const has = x => x && typeof x === 'object' &&
  ['weekday','weekend'].some(k => x[k] && (typeof x[k].placeFee === 'number' || typeof x[k].companyFee === 'number'))

// ---- fee 自由記述の中身 ----
console.log('\n=== fee(自由記述) がある公開中案件 ===')
const withFee = pub.filter(r => r.fee && String(r.fee).trim() !== '')
console.log('件数:', withFee.length)
for (const r of withFee) console.log(`  [${r.title}] fee="${r.fee}" dtf=${has(r.day_type_fees)} pct=${(r.price_share_pct||0)+(r.company_share_pct||0)}`)

// ---- 固定/歩合の分類を記事の言う 51/44 に合わせられるか ----
const pctOnly = pub.filter(r => ((r.price_share_pct||0)+(r.company_share_pct||0)) > 0)
console.log('\n歩合(pct>0):', pctOnly.length)
const fixedStruct = pub.filter(r => has(r.day_type_fees) || (r.price_fixed||0)+(r.company_fixed_amount||0) > 0)
console.log('固定(構造化フィールド):', fixedStruct.length)

// fee テキストから円の数字を拾って「固定制」とみなす
const yen = s => [...String(s||'').matchAll(/([0-9][0-9,]*)\s*円/g)].map(m => parseInt(m[1].replace(/,/g,''),10))
const fixedText = pub.filter(r => !has(r.day_type_fees) && (r.price_fixed||0)+(r.company_fixed_amount||0)===0 && yen(r.fee).length>0)
console.log('固定(fee テキストに「◯円」あり、構造化なし):', fixedText.length)
console.log('固定 合計(構造化+テキスト):', fixedStruct.length + fixedText.length)

console.log('\n=== fee テキストだけの固定制案件の金額 ===')
const textAmts = []
for (const r of fixedText) {
  const a = yen(r.fee)
  textAmts.push(...a)
  console.log(`  [${r.title}] "${r.fee}" -> ${a.join(',')}`)
}

// ---- 常設フラグ ----
const flags = ['is_recurring','recurring','ongoing','permanent','frequency','recruit_type','place_type','kind','category']
for (const f of flags) {
  if (one[0] && f in one[0]) {
    const c = {}
    for (const r of pub) { const v = String(r[f]); c[v] = (c[v]||0)+1 }
    console.log(`\n${f} の分布(公開中):`, JSON.stringify(c))
  }
}
