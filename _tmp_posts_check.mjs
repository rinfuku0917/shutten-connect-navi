import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n')
  .filter(l=>l.includes('=')).map(l=>[l.slice(0,l.indexOf('=')).trim(), l.slice(l.indexOf('=')+1).trim()]))
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {auth:{persistSession:false}})
const { data, error } = await db.from('posts')
  .select('slug,title,content,category,related_prefecture,related_category,target_keyword,published_at')
  .eq('status','published').order('published_at')
if (error) { console.log('ERR', error.message); process.exit(1) }

const HOST_SLUGS = ['how-to-invite-kitchen-car','vacant-space-food-truck','host-fee-setting-guide','host-fee-setting-guide2','regular-event-schedule','renting-parking-space','auto-mtgh64lh-jwwkxe','supermarket-food-truck','mall-food-truck-event','request-food-truck','how-to-call-food-truck','invite-food-truck-free']

console.log('=== 全公開記事のカテゴリ一覧 ===')
const catCount = {}
for (const p of data) catCount[p.category ?? '(null)'] = (catCount[p.category ?? '(null)']||0)+1
console.log(JSON.stringify(catCount, null, 1))
console.log('total published:', data.length)

console.log('\n=== 募集者向け12本のリンク内訳 ===')
for (const slug of HOST_SLUGS) {
  const p = data.find(x=>x.slug===slug)
  if (!p) { console.log(`${slug}\tNOT PUBLISHED`); continue }
  const c = p.content
  const count = (re) => (c.match(re)||[]).length
  const reg = count(/\/register/g)
  const vendor = count(/\/vendor/g)
  const places = count(/\/places/g)
  const login = count(/\/login/g)
  const blog = count(/\/blog\//g)
  console.log([
    slug,
    'cat=' + (p.category ?? 'null'),
    'chars=' + c.length,
    'register=' + reg,
    'vendor=' + vendor,
    'places=' + places,
    'login=' + login,
    'blog=' + blog,
    'relPref=' + (p.related_prefecture ?? '-'),
    'relCat=' + (p.related_category ?? '-'),
    'kw=' + (p.target_keyword ?? '-'),
  ].join('\t'))
}

console.log('\n=== 実際のリンク文字列（募集者向け12本）===')
for (const slug of HOST_SLUGS) {
  const p = data.find(x=>x.slug===slug); if(!p) continue
  const links = [...p.content.matchAll(/\[([^\]]{0,80})\]\((\/[^)]*)\)/g)].map(m=>`${m[2]}  「${m[1]}」`)
  const bare = [...p.content.matchAll(/https?:\/\/app\.connect-navi\.com[^\s)"'、。]*/g)].map(m=>m[0])
  console.log(`--- ${slug}`)
  if (links.length===0 && bare.length===0) console.log('   (内部リンクなし)')
  for (const l of links) console.log('   md: ' + l)
  for (const b of bare) console.log('   url: ' + b)
}
