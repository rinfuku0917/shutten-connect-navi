import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
async function all(t, sel = '*') {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(t).select(sel).range(from, from + 999)
    if (error) throw new Error(t + ': ' + error.message)
    out.push(...data); if (data.length < 1000) break
  }
  return out
}
const s = await all('public_sellers')
const odd = s.filter(x => (x.areas || []).some(a => ['東京都', '千葉県', '佐賀先'].includes(String(a).trim())))
console.log('表記ゆれ(東京都/千葉県/佐賀先)を持つ店:', odd.length)
for (const x of odd) console.log(JSON.stringify({ id: x.id, name: x.name, shop: x.shop_name, genre: x.genre, areas: x.areas }, null, 1))

// 「その1店を除くと記事の数字になるか？」を検証
function toArr(v) {
  if (v == null) return []
  if (Array.isArray(v)) return v
  const str = String(v).trim(); if (!str) return []
  if (str.startsWith('[')) { try { const p = JSON.parse(str); return Array.isArray(p) ? p : [String(p)] } catch { return [str] } }
  return [str]
}
function tally(rows) {
  const a = {}, g = {}
  for (const x of rows) {
    for (const y of new Set(toArr(x.areas).map(v => String(v).trim()))) a[y] = (a[y] || 0) + 1
    for (const y of new Set(toArr(x.genre).map(v => String(v).trim()))) g[y] = (g[y] || 0) + 1
  }
  return { a, g }
}
const oddIds = new Set(odd.map(x => x.id))
const full = tally(s), minus = tally(s.filter(x => !oddIds.has(x.id)))
const keys = ['東京', '埼玉', '神奈川', '千葉', '茨城', '大阪']
console.log('\n県 | 全1386 | 表記ゆれ店を除く | 記事')
const art = { 東京: 765, 埼玉: 549, 神奈川: 544, 千葉: 468, 茨城: 278, 大阪: 288 }
for (const k of keys) console.log(k, full.a[k] || 0, minus.a[k] || 0, art[k])
const artg = { 食事: 600, スイーツ: 509, ドリンク: 475, 物販: 36 }
console.log('\nジャンル | 全1386 | 除外後 | 記事')
for (const k of Object.keys(artg)) console.log(k, full.g[k] || 0, minus.g[k] || 0, artg[k])
console.log('\n除外後の母数:', s.length - oddIds.size)

// 記事の数字ちょうどになる「1店除外」パターンがあるか総当たり
console.log('\n=== 1店だけ除けば 神奈川544/食事600/スイーツ509/ドリンク475 になる店を総当たり ===')
const hit = s.filter(x => {
  const a = new Set(toArr(x.areas).map(v => String(v).trim()))
  const g = new Set(toArr(x.genre).map(v => String(v).trim()))
  return a.has('神奈川') && g.has('食事') && g.has('スイーツ') && g.has('ドリンク') &&
    !g.has('物販') && !a.has('東京') && !a.has('埼玉') && !a.has('千葉') && !a.has('茨城') && !a.has('大阪')
})
console.log('条件に合う店:', hit.length)
for (const x of hit.slice(0, 10)) console.log(JSON.stringify({ id: x.id, shop: x.shop_name, genre: x.genre, areas: x.areas }))
