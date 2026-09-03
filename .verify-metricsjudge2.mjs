// 9月2日時点に巻き戻して数え直せるかを確かめる（created_at があれば）
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
)
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })

for (const t of ['menus', 'public_sellers']) {
  const { data, error } = await db.from(t).select('*').limit(1)
  console.log(`== ${t} の列 ==`)
  console.log(error ? error.message : Object.keys(data[0] ?? {}).join(', '))
}

// menus に created_at があれば、9/3 00:00(JST) より前に作られた行だけで数え直す
const cut = '2026-09-02T15:00:00Z' // JST 9/3 00:00
async function pageAll(table, cols) {
  const out = []; let last = null
  for (let i = 0; i < 200; i++) {
    let q = db.from(table).select(cols).order('id', { ascending: true }).limit(500)
    if (last !== null) q = q.gt('id', last)
    const { data, error } = await q
    if (error) { console.log(table, 'err', error.message); return out }
    out.push(...data); if (data.length < 500) break; last = data[data.length - 1].id
  }
  return out
}
const menus = await pageAll('menus', '*')
const k = Object.keys(menus[0] ?? {})
console.log('\nmenus 行数:', menus.length)
if (k.includes('created_at')) {
  const before = menus.filter(m => m.created_at && m.created_at < cut)
  console.log(`created_at < ${cut}（＝JST 9/3 より前）のメニュー:`, before.length)
  console.log('  うち価格あり:', before.filter(m => m.price != null).length)
  console.log('  うち写真あり:', before.filter(m => m.photo_url).length)
  console.log('  出店者数    :', new Set(before.map(m => m.seller_id)).size)
  const recent = menus.filter(m => m.created_at && m.created_at >= cut)
  console.log('9/3 以降に作られたメニュー:', recent.length)
  for (const m of recent.slice(0, 12)) console.log('   ', m.created_at, m.seller_id, m.price, m.photo_url ? '写真あり' : '写真なし')
}
if (k.includes('updated_at')) {
  console.log('9/3 以降に更新されたメニュー:', menus.filter(m => m.updated_at && m.updated_at >= cut).length)
}
