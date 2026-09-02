import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').filter(Boolean).map(l => {
    const i = l.indexOf('=')
    return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
  })
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
})

// 1000行で切られるので必ずページングする
async function all(table, select) {
  const out = []
  const size = 1000
  for (let from = 0; ; from += size) {
    const { data, error } = await sb.from(table).select(select).range(from, from + size - 1)
    if (error) { console.error(table, 'ERROR', error.message); return null }
    out.push(...data)
    if (data.length < size) break
  }
  return out
}

const rows = await all('places', '*')
if (!rows) process.exit(1)
console.log('places 全行数:', rows.length)

const open = rows.filter(r => r.status === 'published' && !r.closed)
console.log('公開中(published かつ closed でない):', open.length)

const withSlots = open.filter(r => r.max_slots !== null && r.max_slots !== undefined)
console.log('max_slots あり:', withSlots.length, '/', open.length,
  '=', Math.round(withSlots.length / open.length * 100) + '%')
console.log('max_slots なし:', open.length - withSlots.length)

// max_slots の値の分布
const dist = {}
for (const r of withSlots) dist[r.max_slots] = (dist[r.max_slots] || 0) + 1
console.log('max_slots の値の分布:', JSON.stringify(dist))

// 未ログインでも見える欄に台数が書かれていないか
// 未ログインで表示されるのは description(概要) / recruit(募集内容) / title
const slotWord = /(\d+\s*台|台数|何台|[一二三四五六七八九十]台)/
const pubTextHasSlots = open.filter(r =>
  slotWord.test([r.title, r.description, r.recruit].filter(Boolean).join('\n'))
)
console.log('未ログインでも見える欄(title/description/recruit)に台数の記載:', pubTextHasSlots.length)
console.log('  例:', pubTextHasSlots.slice(0, 5).map(r => {
  const t = [r.title, r.description, r.recruit].filter(Boolean).join(' / ')
  const m = t.match(/.{0,25}(\d+\s*台|台数|何台).{0,25}/)
  return m ? m[0].replace(/\s+/g, ' ') : ''
}))

// max_slots が無くても公開文に台数がある案件は何件か
const noSlotButText = pubTextHasSlots.filter(r => r.max_slots === null || r.max_slots === undefined)
console.log('max_slots は無いが公開文に台数の記載:', noSlotButText.length)

// どちらでも分からない案件
const unknown = open.filter(r =>
  (r.max_slots === null || r.max_slots === undefined) &&
  !slotWord.test([r.title, r.description, r.recruit].filter(Boolean).join('\n'))
)
console.log('ログインしても max_slots が無く、公開文にも台数が無い:', unknown.length,
  '=', Math.round(unknown.length / open.length * 100) + '%')

// details 側にも台数めいた項目がないか（ログイン後に見える）
const detailKeys = new Set()
for (const r of open) if (r.details && typeof r.details === 'object') Object.keys(r.details).forEach(k => detailKeys.add(k))
console.log('details のキー一覧:', [...detailKeys].sort().join(', '))

// 記事本文の110件と突き合わせ（記事の集計母数の確認）
console.log('---')
console.log('published 全体(closed 含む):', rows.filter(r => r.status === 'published').length)
console.log('status の分布:', JSON.stringify(rows.reduce((a, r) => (a[r.status] = (a[r.status] || 0) + 1, a), {})))
