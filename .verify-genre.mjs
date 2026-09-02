import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

async function fetchAll(table, cols) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(table).select(cols).range(from, from + 999)
    if (error) { console.log(`[${table}] ERROR: ${error.message}`); return null }
    out.push(...data)
    if (data.length < 1000) break
  }
  return out
}

// 1) public_sellers ビュー
const view = await fetchAll('public_sellers', 'id,shop_name,genre,areas,photos,role,approval_status')
// 2) profiles 直読み（読めるか確認）
const prof = await fetchAll('profiles', 'id,shop_name,genre,role,approval_status')

console.log('public_sellers rows:', view ? view.length : 'read failed')
console.log('profiles rows      :', prof ? prof.length : 'read failed')

function parseGenres(v) {
  const t = String(v || '').trim()
  if (!t) return []
  if (t.startsWith('[')) {
    try { const j = JSON.parse(t); if (Array.isArray(j)) return j.map(x => String(x).trim()).filter(Boolean) } catch {}
  }
  return t.split(/[,、，]/).map(x => x.trim()).filter(Boolean)
}

function analyze(label, rows) {
  if (!rows) return
  console.log('\n================ ' + label + ' (n=' + rows.length + ') ================')
  const counts = new Map()
  let food = 0, sweets = 0, both = 0, either = 0, none = 0
  const comboCounts = new Map()
  let multi = 0
  for (const r of rows) {
    const gs = [...new Set(parseGenres(r.genre))]
    if (gs.length === 0) none++
    if (gs.length > 1) multi++
    const key = gs.slice().sort().join('+') || '(なし)'
    comboCounts.set(key, (comboCounts.get(key) || 0) + 1)
    for (const g of gs) counts.set(g, (counts.get(g) || 0) + 1)
    const f = gs.includes('食事'), s = gs.includes('スイーツ')
    if (f) food++
    if (s) sweets++
    if (f && s) both++
    if (f || s) either++
  }
  console.log('ジャンル別（重複あり・のべ数）:')
  ;[...counts.entries()].sort((a, b) => b[1] - a[1]).forEach(([g, c]) => console.log('  ', g, c))
  console.log('ジャンル未設定:', none, '／ 2つ以上選んでいる店:', multi)
  console.log('--- 食事／スイーツ ---')
  console.log('  食事:', food, ' スイーツ:', sweets, ' 単純合計:', food + sweets)
  console.log('  両方:', both, ' どちらか(実店舗数):', either, ' 差分(二重計上):', food + sweets - either)
  console.log('  どちらかの割合:', ((either / rows.length) * 100).toFixed(1) + '%')
  console.log('--- 組み合わせ内訳 ---')
  ;[...comboCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([k, c]) => console.log('  ', k, c))
}

analyze('public_sellers', view)
if (prof) analyze('profiles (全ロール)', prof)
if (prof) {
  analyze('profiles role=seller', prof.filter(r => r.role === 'seller'))
  analyze('profiles role=seller & approved', prof.filter(r => r.role === 'seller' && r.approval_status === 'approved'))
}
