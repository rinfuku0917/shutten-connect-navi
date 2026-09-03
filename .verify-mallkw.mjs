import fs from 'fs'
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n')
  .filter(l=>l.includes('=')).map(l=>[l.slice(0,l.indexOf('=')).trim(), l.slice(l.indexOf('=')+1).trim()]))
const URL = env.NEXT_PUBLIC_SUPABASE_URL, KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY

async function all(table, select, extra='') {
  const out = []
  for (let from=0;;from+=1000) {
    const r = await fetch(`${URL}/rest/v1/${table}?select=${select}${extra}`, {
      headers:{apikey:KEY, Authorization:`Bearer ${KEY}`, Range:`${from}-${from+999}`}})
    if (!r.ok) throw new Error(await r.text())
    const j = await r.json()
    out.push(...j)
    if (j.length < 1000) break
  }
  return out
}

const posts = await all('posts','*')
console.log('posts 総数 =', posts.length)
console.log('カラム =', Object.keys(posts[0]).join(', '))

for (const s of ['host-fee-setting-guide','host-fee-setting-guide2','mall-food-truck-event','supermarket-food-truck']) {
  const p = posts.find(x=>x.slug===s)
  if (!p) { console.log(`\n### ${s} … DBに無い`); continue }
  console.log(`\n### ${s}`)
  for (const k of Object.keys(p)) {
    if (k==='content') { console.log(`  content長=${p.content?.length}`); continue }
    console.log(`  ${k} = ${JSON.stringify(p[k])?.slice(0,200)}`)
  }
}
fs.writeFileSync('/private/tmp/claude-501/-Users-hidekifukusada-Desktop--------shutten-connect-navi/db7d6515-4023-44ab-9971-494a02f7a39c/scratchpad/posts.json', JSON.stringify(posts,null,1))
console.log('\n=== 公開中の記事一覧（slug / title / category）===')
for (const p of posts.filter(x=>x.status==='published')) {
  console.log(` ${p.slug} | ${p.title} | ${p.category ?? ''}`)
}
