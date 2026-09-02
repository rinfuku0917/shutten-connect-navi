import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env = Object.fromEntries(
  fs.readFileSync(new URL('./.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] })
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

const slugs = ['vacant-space-food-truck', 'renting-parking-space']
const { data, error } = await sb.from('posts').select('*').in('slug', slugs)
if (error) { console.log('ERR', error.message); process.exit(1) }
const bySlug = Object.fromEntries(data.map(p => [p.slug, p]))

for (const s of slugs) {
  const p = bySlug[s]
  fs.writeFileSync(`/private/tmp/claude-501/-Users-hidekifukusada-Desktop--------shutten-connect-navi/db7d6515-4023-44ab-9971-494a02f7a39c/scratchpad/${s}.txt`, p.content)
  console.log('#'.repeat(70))
  console.log('SLUG:', s, '| status:', p.status, '| kw:', JSON.stringify(p.target_keyword))
  console.log('TITLE:', p.title)
  console.log('META :', p.meta_description)
  console.log('EXCERPT:', p.excerpt)
  console.log('CAT:', p.category, '| pref:', p.related_prefecture, '| relcat:', p.related_category)
  console.log('LEN:', p.content.length)
  console.log('--- HEADINGS ---')
  console.log(p.content.split('\n').filter(l => /^#{1,4}\s/.test(l)).join('\n'))
  console.log('--- FIRST 700 CHARS ---')
  console.log(p.content.slice(0, 700))
}

// --- n-gram overlap, independent recompute ---
function norm(t) {
  return t.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
          .replace(/[#*>`|_\-\s\r\n]/g, '')
}
const A = norm(bySlug['vacant-space-food-truck'].content)
const B = norm(bySlug['renting-parking-space'].content)
for (const n of [10, 12, 15, 20]) {
  const setB = new Set()
  for (let i = 0; i + n <= B.length; i++) setB.add(B.slice(i, i + n))
  const hits = new Set()
  let matched = 0, total = 0
  for (let i = 0; i + n <= A.length; i++) {
    total++
    const g = A.slice(i, i + n)
    if (setB.has(g)) { matched++; hits.add(g) }
  }
  // merge overlapping hit positions into fragments
  const frags = []
  let cur = null
  for (let i = 0; i + n <= A.length; i++) {
    const g = A.slice(i, i + n)
    if (setB.has(g)) {
      if (cur && i <= cur.end) { cur.end = i + n; cur.text = A.slice(cur.start, cur.end) }
      else { cur = { start: i, end: i + n, text: g }; frags.push(cur) }
    }
  }
  console.log(`\n=== n=${n}: matched ${matched}/${total} = ${(matched / total * 100).toFixed(2)}%  fragments=${frags.length}`)
  for (const f of frags) console.log('   [' + f.text + ']')
}

console.log('\n=== 相互リンクの有無 ===')
console.log('vacant -> renting-parking-space:', A.includes('renting-parking-space') || bySlug['vacant-space-food-truck'].content.includes('renting-parking-space'))
console.log('renting -> vacant-space-food-truck:', bySlug['renting-parking-space'].content.includes('vacant-space-food-truck'))
console.log('vacant内のリンク:', (bySlug['vacant-space-food-truck'].content.match(/\]\(([^)]*)\)/g) || []).join(' '))
console.log('renting内のリンク:', (bySlug['renting-parking-space'].content.match(/\]\(([^)]*)\)/g) || []).join(' '))
