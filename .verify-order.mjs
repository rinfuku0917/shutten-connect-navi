import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
)
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
})

// --- 1. 独立した方法での総数: PostgREST の exact count（ページングを一切使わない） ---
async function exactCount(table) {
  const { count, error } = await db.from(table).select('*', { count: 'exact', head: true })
  if (error) throw new Error(`${table} count: ${error.message}`)
  return count
}

// --- 2. blog-metrics.mjs と同じ「order なし .range()」ページング ---
async function pagedNoOrder(table, cols = '*', size = 1000) {
  const out = []
  for (let from = 0; ; from += size) {
    const { data, error } = await db.from(table).select(cols).range(from, from + size - 1)
    if (error) throw new Error(`${table}: ${error.message}`)
    out.push(...data)
    if (data.length < size) break
  }
  return out
}

// --- 3. 別方式: id 昇順のキーセットページング（offset を使わない＝取りこぼし原理的になし） ---
async function keyset(table, idcol = 'id', size = 500) {
  const out = []
  let last = null
  for (;;) {
    let q = db.from(table).select(idcol).order(idcol, { ascending: true }).limit(size)
    if (last !== null) q = q.gt(idcol, last)
    const { data, error } = await q
    if (error) throw new Error(`${table} keyset: ${error.message}`)
    out.push(...data.map(r => r[idcol]))
    if (data.length < size) break
    last = data[data.length - 1][idcol]
  }
  return out
}

const dup = a => { const s = new Set(), d = new Set(); for (const x of a) { if (s.has(x)) d.add(x); s.add(x) } return [...d] }

for (const t of ['places', 'public_sellers', 'menus']) {
  const c = await exactCount(t)
  console.log(`\n=== ${t} : exact count = ${c} ===`)

  // order なしページングを 5 回まわして、毎回同じ集合になるか
  const runs = []
  for (let i = 0; i < 5; i++) {
    const rows = await pagedNoOrder(t, 'id')
    const ids = rows.map(r => r.id)
    runs.push(ids)
    const d = dup(ids)
    console.log(`  [order無 run${i + 1}] 行数=${ids.length} 一意=${new Set(ids).size} 重複=${d.length}${d.length ? ' ' + d.slice(0, 5).join(',') : ''}`)
  }
  const base = new Set(runs[0])
  for (let i = 1; i < runs.length; i++) {
    const s = new Set(runs[i])
    const miss = [...base].filter(x => !s.has(x))
    const extra = [...s].filter(x => !base.has(x))
    if (miss.length || extra.length) console.log(`  !! run1 と run${i + 1} で集合が違う 欠=${miss.length} 増=${extra.length}`)
    // 順序そのものが同じか
    console.log(`  run1 と run${i + 1}: 集合一致=${miss.length === 0 && extra.length === 0} / 並び順まで一致=${runs[i].join()===runs[0].join()}`)
  }

  // キーセット（別方式）と突き合わせ
  try {
    const ks = keyset(t)
    const ids = await ks
    const a = new Set(runs[0]), b = new Set(ids)
    console.log(`  [keyset] 行数=${ids.length} 一意=${new Set(ids).size}`)
    console.log(`  keyset vs order無: 一致=${a.size === b.size && [...a].every(x => b.has(x))}`)
    console.log(`  exact count と keyset 一致=${c === ids.length} / exact count と order無 一致=${c === runs[0].length}`)
  } catch (e) { console.log(`  [keyset] 失敗: ${e.message}`) }

  // 500件ページングでも同じ結果か（ページ境界を変える＝別方式の検算）
  const half = (await pagedNoOrder(t, 'id', 500)).map(r => r.id)
  const a = new Set(runs[0]), b = new Set(half)
  console.log(`  [order無 size500] 行数=${half.length} 一意=${new Set(half).size} / size1000と集合一致=${a.size===b.size && [...a].every(x=>b.has(x))}`)

  // 先頭10件が id 順に並んでいるか（ビュー側の ORDER BY があるか判定）
  const { data: head } = await db.from(t).select('id').range(0, 9)
  const hs = head.map(r => String(r.id))
  console.log(`  先頭10件が id 昇順か: ${JSON.stringify(hs) === JSON.stringify([...hs].sort())}`)
}
