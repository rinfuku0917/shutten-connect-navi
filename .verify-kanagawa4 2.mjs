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
    if (error) { console.log('ERR', t, error.message); return out }
    out.push(...data); if (data.length < 1000) break
  }
  return out
}
// profiles が匿名で読めるか（読めれば別ルートで検証できる）
const p = await sb.from('profiles').select('id', { count: 'exact', head: true })
console.log('profiles 匿名読み:', p.error ? 'NG ' + p.error.message : 'OK ' + p.count)

// 記事の「募集中」側の数字
const places = await all('places')
console.log('places 全件:', places.length)
const pub = places.filter(x => x.status === 'published' && !x.closed)
console.log('公開中(published かつ closed でない):', pub.length)
const cnt = {}
for (const x of pub) { const k = x.prefecture ?? '(なし)'; cnt[k] = (cnt[k] || 0) + 1 }
console.log('都道府県別:', Object.entries(cnt).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(' | '))
const rec = {}
for (const x of pub) { const k = String(x.recruitment_type ?? x.type ?? '(不明)'); rec[k] = (rec[k] || 0) + 1 }
console.log('種別:', rec)
console.log('列名サンプル:', Object.keys(places[0] || {}).join(','))

// posts（記事）で下書き2本が読めるか
const posts = await all('posts', 'id,slug,status,published,title,updated_at')
console.log('\nposts 取得件数:', posts.length)
console.log(posts.filter(x => /get-food-truck-offers|weekday-food-truck-spots/.test(x.slug || '')).map(x => JSON.stringify(x)).join('\n') || '（対象2本は匿名では取得できず）')
