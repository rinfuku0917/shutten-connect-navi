// 「出店者ページが公開されている1,386店舗」の指摘を、別の方法で検証する。
// 方針: (1) サーバ側 exact count と (2) 全件ページング の2通りで数え、突き合わせる。
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
)
const U = env.NEXT_PUBLIC_SUPABASE_URL, K = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const db = createClient(U, K, { auth: { persistSession: false } })

// --- 1) サーバ側 exact count（ページングのバグとは独立した数え方）---
const count = async (table, q = '') => {
  const r = await fetch(`${U}/rest/v1/${table}?select=id${q ? '&' + q : ''}`, {
    headers: { apikey: K, Authorization: `Bearer ${K}`, Prefer: 'count=exact', Range: '0-0' },
  })
  const cr = r.headers.get('content-range')
  return { ok: r.ok, n: cr ? Number(cr.split('/')[1]) : null, status: r.status }
}

console.log('=== A. サーバ側 exact count ===')
for (const [label, q] of [
  ['public_sellers 全件', ''],
  ['  role=seller', 'role=eq.seller'],
  ['  role!=seller', 'role=neq.seller'],
  ['  approval_status=approved', 'approval_status=eq.approved'],
  ['  approval_status!=approved', 'approval_status=neq.approved'],
  ['  role=seller かつ approved', 'role=eq.seller&approval_status=eq.approved'],
  ['  shop_name=株式会社nav', `shop_name=eq.${encodeURIComponent('株式会社nav')}`],
  ['  shop_name=株式会社アーク', `shop_name=eq.${encodeURIComponent('株式会社アーク')}`],
  ['  shop_name に nav を含む', `shop_name=ilike.*nav*`],
  ['  shop_name に アーク を含む', `shop_name=ilike.*${encodeURIComponent('アーク')}*`],
  ['  shop_name に 株式会社 を含む', `shop_name=ilike.*${encodeURIComponent('株式会社')}*`],
]) {
  const r = await count('public_sellers', q)
  console.log(`${label.padEnd(34)} ${r.ok ? r.n : 'ERR ' + r.status}`)
}

// --- 2) 全件ページング（スクリプトと同じ数え方）---
const all = async (t, sel = '*') => {
  const out = []
  for (let f = 0; ; f += 1000) {
    const { data, error } = await db.from(t).select(sel).range(f, f + 999)
    if (error) throw new Error(`${t}: ${error.message}`)
    out.push(...data)
    if (data.length < 1000) break
  }
  return out
}
const S = await all('public_sellers')
console.log('\n=== B. ページング実取得 ===')
console.log('public_sellers 取得行数:', S.length, '/ ユニークid:', new Set(S.map(s => s.id)).size)
console.log('列:', Object.keys(S[0] ?? {}).join(', '))

// role / approval_status の分布（ビューが何で絞られているかの裏取り）
const dist = (key) => {
  const m = {}
  for (const s of S) m[String(s[key])] = (m[String(s[key])] ?? 0) + 1
  return m
}
console.log('role 分布:', JSON.stringify(dist('role')))
console.log('approval_status 分布:', JSON.stringify(dist('approval_status')))

// --- 3) 除外2社が本当に居るか（正規化のゆれも見る）---
const EX = ['株式会社nav', '株式会社アーク']
const hit = S.filter(s => EX.includes(String(s.shop_name ?? '').trim()))
console.log('\n=== C. 除外対象（コードと同じ「trim して完全一致」）===')
console.log('該当行数:', hit.length)
for (const h of hit) {
  console.log(`  id=${h.id} shop_name=${JSON.stringify(h.shop_name)} role=${h.role} approval=${h.approval_status}`)
  console.log(`    photos=${(h.photos ?? []).length}枚 genre=${JSON.stringify(h.genre)} areas=${JSON.stringify(h.areas)}`)
}
// 惜しい表記ゆれ（全角・空白・大文字小文字）で除外を外れているものが無いか
const near = S.filter(s => {
  const t = String(s.shop_name ?? '')
  return /nav|ＮＡＶ|アーク|ａｒｋ|ark/i.test(t) && !EX.includes(t.trim())
})
console.log('除外リストに載っていないが nav/アーク を含む行:', near.length)
for (const n of near.slice(0, 15)) console.log('  ', JSON.stringify(n.shop_name), n.role, n.approval_status)

// --- 4) 記事の主要な数字を、2社ありなしの両方で計算 ---
const menus = await all('menus')
const hasMenu = new Set(menus.map(m => m.seller_id))
const calc = (rows, label) => {
  const n = rows.length
  const ph = rows.filter(s => (s.photos ?? []).length > 0).length
  const mn = rows.filter(s => hasMenu.has(s.id)).length
  const sn = rows.filter(s => String(s.shop_name ?? '').trim()).length
  const pc = x => (x / n * 100).toFixed(1)
  console.log(`${label} 母数${n} / 写真${ph}(${pc(ph)}%) メニュー${mn}(${pc(mn)}%) 店名${sn}(${pc(sn)}%)`)
}
console.log('\n=== D. 記事の割合への影響 ===')
calc(S, '2社込み（記事の母数）:')
calc(S.filter(s => !EX.includes(String(s.shop_name ?? '').trim())), '2社除く          :')

// --- 5) 除外2社は詳細ページが実際に描画されるのか（sitemap は profiles 由来）---
console.log('\n=== E. profiles を匿名キーで読めるか（sitemap の母数の裏取り）===')
const pr = await count('profiles', 'role=eq.seller&approval_status=eq.approved')
console.log('profiles role=seller&approved:', pr.ok ? pr.n : `読めない(${pr.status})`)

// --- 6) エリア/ジャンルの数字に2社が寄与しているか ---
console.log('\n=== F. 2社のエリア・ジャンル寄与 ===')
for (const h of hit) {
  console.log(`  ${h.shop_name}: areas=${JSON.stringify(h.areas)} genre=${JSON.stringify(h.genre)} menus=${menus.filter(m => m.seller_id === h.id).length}件`)
}
