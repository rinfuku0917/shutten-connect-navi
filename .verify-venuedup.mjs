import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env = Object.fromEntries(
  fs.readFileSync(new URL('./.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')] })
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

let all = []
for (let from = 0; ; from += 500) {
  const { data, error } = await sb.from('places')
    .select('id,title,address,prefecture,place_type,status,closed,fee,price_fixed,price_share_pct,company_fixed_amount,company_share_pct,day_type_fees,schedule,description')
    .range(from, from + 499)
  if (error) { console.error(error); process.exit(1) }
  all = all.concat(data)
  if (data.length < 500) break
}
const pub = all.filter(p => p.status === 'published' && !p.closed)
console.log('全行:', all.length, '/ 公開中:', pub.length)

const pctOf = p => (p.price_share_pct || 0) + (p.company_share_pct || 0)
const fixedOf = p => (p.price_fixed || 0) + (p.company_fixed_amount || 0)
const dtf = p => (p.day_type_fees && typeof p.day_type_fees === 'object') ? p.day_type_fees : null
const side = (p, k) => { const d = dtf(p); if (!d || !d[k]) return null
  const a = typeof d[k].placeFee === 'number' ? d[k].placeFee : null
  const b = typeof d[k].companyFee === 'number' ? d[k].companyFee : null
  return (a === null && b === null) ? null : (a || 0) + (b || 0) }
const schedFeeDays = p => (Array.isArray(p.schedule) ? p.schedule : []).filter(d => d && (typeof d.placeFee === 'number' || typeof d.companyFee === 'number'))
const cat = p => {
  const hasFixed = fixedOf(p) > 0 || side(p, 'weekday') !== null || side(p, 'weekend') !== null || schedFeeDays(p).length > 0
  const hasPct = pctOf(p) > 0
  if (hasFixed && hasPct) return '併用'
  if (hasFixed) return '固定'
  if (hasPct) return '歩合'
  return '応相談'
}

// ---------- 1) 記事の元の数字を再現 ----------
const rate = {}
for (const p of pub) { const r = pctOf(p); if (r > 0) rate[r] = (rate[r] || 0) + 1 }
const totalPct = Object.values(rate).reduce((a, b) => a + b, 0)
console.log('\n=== 名寄せ前（記事の数え方） ===')
console.log('料率分布:', rate, '歩合を含む母数:', totalPct)
console.log('10%の割合:', (rate[10] / totalPct * 100).toFixed(1) + '%')

// ---------- 2) 会場名の重複を機械的に洗い出す ----------
// 正規化: 全角英数→半角、空白除去、括弧内の補足を落とす、末尾の連番/回次を落とす
const norm = s => (s || '')
  .replace(/[Ａ-Ｚａ-ｚ０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
  .replace(/[（(].*?[）)]/g, '')
  .replace(/[\s　]/g, '')
  .replace(/[〜~ー－-]/g, '')
  .toLowerCase()

const byTitle = new Map()
for (const p of pub) {
  const k = norm(p.title)
  if (!byTitle.has(k)) byTitle.set(k, [])
  byTitle.get(k).push(p)
}
const dupTitle = [...byTitle.entries()].filter(([, v]) => v.length > 1)
console.log('\n=== 完全一致（正規化タイトル）で重複する会場 ===')
console.log('重複グループ数:', dupTitle.length, '/ 関与する案件数:', dupTitle.reduce((a, [, v]) => a + v.length, 0))
for (const [k, v] of dupTitle.sort((a, b) => b[1].length - a[1].length)) {
  console.log(` [${v.length}件] ${v[0].title}`)
  for (const p of v) console.log(`    - type=${p.place_type} cat=${cat(p)} pct=${pctOf(p)} fixed=${fixedOf(p)} fee=${JSON.stringify(p.fee)} addr=${p.address}`)
}

// ---------- 3) 指摘が名指しした会場を個別に確認 ----------
console.log('\n=== 指摘が名指しした会場の実件数 ===')
const named = ['国際理容美容専門学校', '東京保育専門学校', '町田美容専門学校', '専修大学生田', '昭和薬科大学', 'さいたま看護専門学校', '群馬県美容専門学校']
for (const n of named) {
  const hits = pub.filter(p => norm(p.title).includes(norm(n)))
  console.log(`\n[${n}] ${hits.length}件`)
  for (const p of hits) console.log(`   - "${p.title}" type=${p.place_type} cat=${cat(p)} pct=${pctOf(p)} fee=${JSON.stringify(p.fee)}`)
}

// ---------- 4) 会場単位で名寄せしたときの料率分布 ----------
// 名寄せキー = 正規化タイトル（完全一致のみ。安全側＝過剰に潰さない）
console.log('\n=== 会場単位で名寄せした料率分布 ===')
for (const mode of ['title', 'title+addr']) {
  const groups = new Map()
  for (const p of pub) {
    const k = mode === 'title' ? norm(p.title) : norm(p.title) + '|' + norm(p.address)
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k).push(p)
  }
  // 各グループの代表料率: そのグループ内で最頻の料率（同数なら最小）
  const r2 = {}
  for (const [, v] of groups) {
    const rs = v.map(pctOf).filter(x => x > 0)
    if (!rs.length) continue
    const c = {}; for (const x of rs) c[x] = (c[x] || 0) + 1
    const best = Object.entries(c).sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0]
    r2[best] = (r2[best] || 0) + 1
  }
  const t2 = Object.values(r2).reduce((a, b) => a + b, 0)
  console.log(`  [${mode}] 分布:`, r2, '母数:', t2, '10%割合:', (r2[10] / t2 * 100).toFixed(1) + '%')
}

// ---------- 5) 「同じ運営会社が複数店舗」の側も数える ----------
console.log('\n=== 参考: Olympic系 / サンユー系 ===')
for (const kw of ['オリンピック', 'olympic', 'サンユー']) {
  const hits = pub.filter(p => norm(p.title).includes(norm(kw)))
  if (hits.length) console.log(`  ${kw}: ${hits.length}件 (cat: ${JSON.stringify(hits.reduce((a, p) => (a[cat(p)] = (a[cat(p)] || 0) + 1, a), {}))})`)
}
