import fs from 'node:fs'

const env = Object.fromEntries(
  fs.readFileSync(new URL('./.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL
const KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// ---- ページングして全件取る（1000行打ち切り対策） ----
async function fetchAll(table, select, extra = '') {
  const out = []
  const PAGE = 500
  for (let from = 0; ; from += PAGE) {
    const to = from + PAGE - 1
    const r = await fetch(`${URL_}/rest/v1/${table}?select=${select}${extra}`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Range: `${from}-${to}`, Prefer: 'count=exact' }
    })
    if (!r.ok) { console.error('ERR', table, r.status, await r.text()); process.exit(1) }
    const rows = await r.json()
    out.push(...rows)
    const cr = r.headers.get('content-range') || ''
    if (rows.length < PAGE) { console.log(`[${table}] content-range=${cr} 取得=${out.length}`); break }
    if (from > 20000) break
  }
  return out
}

const posts = await fetchAll('posts', '*', '&order=slug.asc')
console.log('posts 全件 =', posts.length)
const byStatus = {}
for (const p of posts) byStatus[p.status] = (byStatus[p.status] || 0) + 1
console.log('status 内訳 =', byStatus)

fs.writeFileSync('/private/tmp/claude-501/-Users-hidekifukusada-Desktop--------shutten-connect-navi/db7d6515-4023-44ab-9971-494a02f7a39c/scratchpad/posts-fresh.json', JSON.stringify(posts, null, 1))

const A = posts.find(p => p.slug === 'how-to-invite-kitchen-car')
const B = posts.find(p => p.slug === 'event-food-truck-guide')

for (const [name, p] of [['how-to-invite-kitchen-car', A], ['event-food-truck-guide', B]]) {
  console.log('\n===================', name, '===================')
  if (!p) { console.log('!! DBに存在しない'); continue }
  console.log('title      =', p.title)
  console.log('status     =', p.status)
  console.log('category   =', p.category)
  console.log('published  =', p.published_at)
  console.log('updated    =', p.updated_at)
  console.log('target_kw  =', p.target_keyword)
  console.log('rel_pref   =', p.related_prefecture, '/ rel_cat =', p.related_category)
  console.log('meta_desc  =', p.meta_description)
  console.log('excerpt    =', p.excerpt)
  const c = p.content || ''
  console.log('content 生の長さ =', c.length)
  // 本文の実文字数（markdown記法・空白を除いた概算）
  const plain = c
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/[*_`>|-]/g, '')
    .replace(/\s+/g, '')
  console.log('本文実文字数(記号除く) =', plain.length)
  console.log('--- 見出し ---')
  for (const line of c.split('\n')) if (/^#{1,6}\s/.test(line)) console.log('  ', line)
}
