import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
)
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
})

// スクリプトとは別の取り方: created_at 昇順、300行ずつ
async function all(table) {
  const out = []
  for (let from = 0; ; from += 300) {
    const { data, error } = await db.from(table).select('*').order('created_at', { ascending: true }).range(from, from + 299)
    if (error) throw new Error(`${table}: ${error.message}`)
    out.push(...data)
    if (data.length < 300) break
  }
  return out
}

const places = await all('places')
const live = places.filter(p => p.status === 'published' && p.closed !== true)
console.log('places全行:', places.length, '/ 公開中:', live.length)

const norm = s => String(s ?? '')
  .replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
  .replace(/,/g, '').replace(/％/g, '%').replace(/\s+/g, ' ')

// ---- 独自方式: 施設名で「商業施設らしいもの」を拾わず、
//      まず「平日と週末/土日祝/休日の両方に金額が書かれている案件」を fee 本文から全部拾う ----
console.log('\n===== 独自方式: 平日◯円 と 土日祝/休日/週末◯円 が両方書かれた案件を全件列挙 =====')
const rows = []
for (const p of live) {
  const t = norm(p.fee)
  const wd = t.match(/平日[^0-9]{0,8}(\d{3,6})\s*円/)
  const we = t.match(/(?:土日祝|土日|週末|休日|祝日)[^0-9]{0,8}(\d{3,6})\s*円/)
  if (!wd || !we) continue
  rows.push({ p, wd: +wd[1], we: +we[1] })
}
rows.sort((a, b) => (a.we - a.wd) - (b.we - b.wd))
for (const r of rows) {
  console.log(`差${String(r.we - r.wd).padStart(5)}  平日${r.wd}/週末${r.we}  ${r.p.prefecture}  ${r.p.title}`)
}
console.log('該当件数:', rows.length)
const dist = {}
for (const r of rows) dist[r.we - r.wd] = (dist[r.we - r.wd] ?? 0) + 1
console.log('差額分布:', dist)

// ---- 商業施設の判定を「イオン/モール/ショッピング/タウン/プラザ/アリオ/ペリエ/ワールドポーターズ/ステラ」で ----
const isMall = p => /イオン|モール|ショッピング|商業施設|プラザ|アウトレット|百貨店|アリオ|Ario|ステラ|ペリエ|ワールドポーターズ|ららぽーと|タウン/.test(p.title)
const isSuper = p => /スーパー|Olympic|オリンピック|マルエツ|ライフ|ヤオコー|食品館|生鮮|ストアー|ドン・キホーテ/.test(p.title)

console.log('\n===== 商業施設に限った差額 =====')
for (const r of rows.filter(r => isMall(r.p) && !isSuper(r.p))) {
  const pct = /%/.test(norm(r.p.fee))
  console.log(`差${r.we - r.wd}  平日${r.wd}/週末${r.we}  歩合を含む:${pct}  ${r.p.title}`)
  console.log(`    fee="${norm(r.p.fee)}"`)
}
const mallRows = rows.filter(r => isMall(r.p) && !isSuper(r.p))
const mallFixed = mallRows.filter(r => !/%/.test(norm(r.p.fee)))
console.log('商業施設で曜日差あり:', mallRows.length, '/ うち歩合を含まない(固定):', mallFixed.length)
const ds = mallFixed.map(r => r.we - r.wd).sort((a, b) => a - b)
console.log('固定のみの差額:', ds.join(' / '))
console.log('最小:', ds[0], '最大:', ds[ds.length - 1])
console.log('平日レンジ:', Math.min(...mallFixed.map(r => r.wd)), '〜', Math.max(...mallFixed.map(r => r.wd)))
console.log('週末レンジ:', Math.min(...mallFixed.map(r => r.we)), '〜', Math.max(...mallFixed.map(r => r.we)))
const mode = {}
for (const d of ds) mode[d] = (mode[d] ?? 0) + 1
console.log('差額の内訳:', mode)
console.log('中央値:', ds.length % 2 ? ds[(ds.length - 1) / 2] : (ds[ds.length / 2 - 1] + ds[ds.length / 2]) / 2)

console.log('\n===== 差額1500円の案件は商業施設に1件でもあるか =====')
const d1500 = rows.filter(r => r.we - r.wd === 1500)
console.log('全体で1500円差:', d1500.length, '件')
console.log('うち商業施設:', d1500.filter(r => isMall(r.p) && !isSuper(r.p)).length, '件')
console.log('うちOlympic系:', d1500.filter(r => /Olympic/i.test(r.p.title)).length, '件')

console.log('\n===== 商業施設で、曜日に触れず単一額の固定案件（記事の「曜日で分けない」行）=====')
const mallAll = live.filter(p => isMall(p) && !isSuper(p))
console.log('商業施設 総数:', mallAll.length)
for (const p of mallAll) {
  const t = norm(p.fee)
  if (/平日/.test(t)) continue
  if (/%/.test(t)) continue
  const m = [...t.matchAll(/(.{0,6}?)(\d{3,6})\s*円/g)].filter(x => !/電源|電気|光熱|水道|駐車|広告|サイネージ/.test(x[1])).map(x => +x[2]).filter(v => v >= 1000)
  console.log(`  ${m.join(',') || '-'}  ${p.title}  fee="${t}"`)
}
