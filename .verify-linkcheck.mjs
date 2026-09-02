import fs from 'node:fs'

const env = Object.fromEntries(
  fs.readFileSync('.env.local','utf8').split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()] })
)
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL
const KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY

async function pageAll(table, select) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${URL_}/rest/v1/${table}?select=${select}&order=id.asc`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Range: `${from}-${from+999}`, 'Range-Unit': 'items' }
    })
    if (!r.ok) throw new Error(table + ' ' + r.status + ' ' + await r.text())
    const rows = await r.json()
    out.push(...rows)
    if (rows.length < 1000) break
  }
  return out
}

const posts = await pageAll('posts', 'id,slug,title,status,content')
console.log('posts total rows fetched:', posts.length)
const bySlug = new Map(posts.map(p => [p.slug, p]))
const publishedSlugs = new Set(posts.filter(p => p.status === 'published').map(p => p.slug))
console.log('published count:', publishedSlugs.size)
console.log('published slugs:', [...publishedSlugs].sort().join(', '))

// 全記事の状態
for (const s of ['renting-parking-space','supermarket-food-truck']) {
  const p = bySlug.get(s)
  console.log(`\n[${s}] exists=${!!p} status=${p?.status} len=${p?.content?.length}`)
}

// 公開記事の本文から /blog/ リンクを全部拾い、リンク先が公開かを判定
console.log('\n=== 公開記事 → /blog/ 内部リンク 全数チェック ===')
const redirectSources = new Set(['how-to-find-food-truck-spots','auto-mtarczbg-37pazo','auto-mtgh64lh-jwwkxe','auto-mta8z1w9-vazfy1'])
for (const p of posts.filter(p => p.status === 'published').sort((a,b)=>a.slug.localeCompare(b.slug))) {
  const links = [...p.content.matchAll(/\]\(\/blog\/([a-zA-Z0-9_-]+)\)/g)].map(m => m[1])
  const hrefLinks = [...p.content.matchAll(/href="\/blog\/([a-zA-Z0-9_-]+)"/g)].map(m => m[1])
  const all = [...new Set([...links, ...hrefLinks])]
  if (!all.length) continue
  for (const t of all) {
    const tp = bySlug.get(t)
    const state = !tp ? 'DB非存在' : tp.status
    const redir = redirectSources.has(t) ? ' (301転送あり)' : ''
    const bad = (state !== 'published' && !redirectSources.has(t)) ? '  <<<< 404になる' : ''
    console.log(`  ${p.slug} -> /blog/${t}  [${state}]${redir}${bad}`)
  }
}

// renting-parking-space の該当箇所を原稿と突き合わせ
const rp = bySlug.get('renting-parking-space')
const md = fs.readFileSync('docs/blog/renting-parking-space.md','utf8').replace(/^---[\s\S]*?\n---\n/, '').trim()
console.log('\nDB本文と原稿の一致:', rp.content.trim() === md)
console.log('\n--- DB本文中で supermarket-food-truck を含む行 ---')
rp.content.split('\n').forEach((l,i) => { if (l.includes('supermarket-food-truck')) console.log(`  L${i+1}: ${l}`) })
console.log('\n--- DB本文中で「スーパー」を含む行 ---')
rp.content.split('\n').forEach((l,i) => { if (l.includes('スーパー')) console.log(`  L${i+1}: ${l}`) })
