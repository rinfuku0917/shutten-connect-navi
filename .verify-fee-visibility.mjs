// 出店料が未ログインでも見えるか（概要文への埋め込み）を確かめる。
// PostgREST は1回1000行で切られるので range でページングする。
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  readFileSync(new URL('./.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  { auth: { persistSession: false } })

async function all(table, select) {
  const out = []
  const step = 500
  for (let from = 0; ; from += step) {
    const { data, error } = await sb.from(table).select(select)
      .order('id', { ascending: true }).range(from, from + step - 1)
    if (error) throw new Error(table + ': ' + error.message)
    out.push(...data)
    if (data.length < step) break
  }
  return out
}

const rows = await all('places', 'id,title,status,closed,fee,description,details,place_type,prefecture')
console.log('places 全行:', rows.length)

const open = rows.filter(p => p.status === 'published' && !p.closed)
console.log('公開中(status=published かつ closed が真でない):', open.length)

const hasFee = open.filter(p => (p.fee || '').trim() !== '')
console.log('fee 欄に記載あり:', hasFee.length, '/ 空:', open.length - hasFee.length)

// 未ログインでも見える公開テキスト = title + description（+アクセス）
// ここに金額（円 / ％ / 歩合）が書かれていれば、ログインなしでも金額がわかる
const money = /([0-9０-９][0-9０-９,，]*\s*円)|([0-9０-９]+\s*[%％])|(売上の[0-9０-９]+)/
const pubHasMoney = open.filter(p => money.test(((p.title || '') + ' ' + (p.description || ''))))
console.log('公開テキスト(タイトル+概要)に金額らしき記載がある:', pubHasMoney.length)
for (const p of pubHasMoney.slice(0, 12)) {
  const m = ((p.title || '') + ' ' + (p.description || '')).match(money)
  console.log('  -', p.title.slice(0, 34), '||', m[0], '||', (p.description || '').replace(/\s+/g, ' ').slice(0, 90))
}

// fee に金額があるのに、公開テキストには出ていない件数（＝ログインしないと金額不明）
const hiddenOnly = hasFee.filter(p => !money.test(((p.title || '') + ' ' + (p.description || ''))))
console.log('金額が fee にしかない（未ログインでは金額不明）:', hiddenOnly.length)
