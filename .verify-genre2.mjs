// 公開中の記事本文（DB側）に、どの数字が入っているかを直接見る
import fs from 'fs'
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
)
const BASE = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, '') + '/rest/v1'
const KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` }

for (const t of ['blog_posts', 'posts', 'articles', 'blogs']) {
  const r = await fetch(`${BASE}/${t}?select=slug&limit=1`, { headers: H })
  console.log(t, r.status)
}
console.log('---')
const slugs = ['get-food-truck-offers', 'supermarket-food-truck', 'mall-food-truck-event', 'how-to-invite-kitchen-car']
const r = await fetch(`${BASE}/posts?select=slug,status,content,updated_at&slug=in.(${slugs.join(',')})`, { headers: H })
if (!r.ok) { console.log('取得失敗', r.status, await r.text()); process.exit(0) }
const rows = await r.json()
for (const s of slugs) {
  const row = rows.find(x => x.slug === s)
  if (!row) { console.log(`\n[${s}] DBに無し`); continue }
  const c = String(row.content ?? '')
  const hits = [...c.matchAll(/(食事\s*\|?\s*(\d{3})|食事(\d{3})店|スイーツ\s*\|?\s*(\d{3})|スイーツ(\d{3})店|ドリンク\s*\|?\s*(\d{3})|ドリンク(\d{3})店)/g)].map(m => m[0])
  const dates = [...new Set([...c.matchAll(/2026年9月\d日時点/g)].map(m => m[0]))]
  console.log(`\n[${s}] status=${row.status} updated=${row.updated_at}`)
  console.log('  本文中のジャンル数字:', JSON.stringify(hits))
  console.log('  本文中の「時点」表記:', JSON.stringify(dates))
  console.log('  602/511/477 を含むか:', /602|511店|477店/.test(c))
}
