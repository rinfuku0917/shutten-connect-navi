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
    out.push(...data)
    if (data.length < 1000) break
  }
  return out
}
const s = await all('public_sellers')
console.log('総数', s.length)

// 型の確認
const t = {}
for (const x of s) {
  const k = `genre:${x.genre === null ? 'null' : Array.isArray(x.genre) ? 'array' : typeof x.genre} / areas:${x.areas === null ? 'null' : Array.isArray(x.areas) ? 'array' : typeof x.areas}`
  t[k] = (t[k] || 0) + 1
}
console.log('列の型分布:', t)

function toArr(v) {
  if (v == null) return []
  if (Array.isArray(v)) return v
  const str = String(v).trim()
  if (str === '') return []
  if (str.startsWith('[')) { try { const p = JSON.parse(str); return Array.isArray(p) ? p : [String(p)] } catch { return [str] } }
  return [str]
}

// --- ジャンル：店ごとに重複排除して数える ---
const gU = {}, gN = {}
let dup = []
for (const x of s) {
  const arr = toArr(x.genre).map(v => String(v).trim()).filter(v => v !== '')
  for (const y of arr) gN[y] = (gN[y] || 0) + 1
  const set = new Set(arr)
  if (set.size !== arr.length) dup.push({ id: x.id, genre: arr })
  for (const y of set) gU[y] = (gU[y] || 0) + 1
}
console.log('\n=== genre（JSON文字列をパース後）===')
console.log('店ごと重複排除:', Object.entries(gU).sort((a, b) => b[1] - a[1]))
console.log('素朴（要素数）  :', Object.entries(gN).sort((a, b) => b[1] - a[1]))
console.log('配列内に重複がある店:', dup.length, JSON.stringify(dup.slice(0, 5)))
console.log('ジャンル未設定（空）の店:', s.filter(x => toArr(x.genre).filter(v => String(v).trim() !== '').length === 0).length)

// --- エリア ---
const aU = {}
for (const x of s) {
  const arr = toArr(x.areas).map(v => String(v).trim()).filter(v => v !== '')
  for (const y of new Set(arr)) aU[y] = (aU[y] || 0) + 1
}
console.log('\n=== areas 全値（店数）===')
console.log(Object.entries(aU).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(' | '))
console.log('\n神奈川に類する値:', Object.entries(aU).filter(([k]) => k.includes('神奈川')))
console.log('東京に類する値:', Object.entries(aU).filter(([k]) => k.includes('東京')))
console.log('大阪に類する値:', Object.entries(aU).filter(([k]) => k.includes('大阪')))

// --- 神奈川 × ジャンル 交差 ---
console.log('\n=== 神奈川あり かつ 食事・スイーツ・ドリンク3つとも持つ店 ===')
const cand = s.filter(x => toArr(x.areas).some(a => String(a).trim() === '神奈川')
  && ['食事', 'スイーツ', 'ドリンク'].every(g => toArr(x.genre).map(String).includes(g)))
console.log('該当店数:', cand.length)

// --- menus price ---
const m = await all('menus', 'id,seller_id,name,price,photo_url')
const zero = m.filter(x => Number(x.price) === 0)
const nullp = m.filter(x => x.price == null)
console.log('\n=== menus ===')
console.log('総数:', m.length, '/ price null:', nullp.length, '/ price=0:', zero.length, '/ price>0:', m.filter(x => Number(x.price) > 0).length)
console.log('photo_url あり:', m.filter(x => x.photo_url != null && String(x.photo_url).trim() !== '').length)
console.log('price=0 の例:', JSON.stringify(zero.slice(0, 5).map(x => ({ name: x.name, price: x.price }))))
