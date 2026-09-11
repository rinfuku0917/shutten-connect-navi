import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n')
  .filter(l=>l.includes('=')).map(l=>[l.slice(0,l.indexOf('=')).trim(), l.slice(l.indexOf('=')+1).trim()]))
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {auth:{persistSession:false}})
const { data, error } = await db.from('places')
  .select('id,title,description,place_type,prefecture,status,closed,price_fixed,price_share_pct,genres,details')
if (error) { console.error('ERR', error); process.exit(1) }
console.log('TOTAL rows', data.length)
const open = data.filter(p => p.status === 'published' && !p.closed)
console.log('published & not closed:', open.length)
const byType = {}
for (const p of data) { const k = `${p.place_type}`; byType[k] = (byType[k]||0)+1 }
console.log('\n--- place_type (all rows) ---')
console.log(Object.entries(byType).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${v}\t${k}`).join('\n'))
const byTypeOpen = {}
for (const p of open) { const k = `${p.place_type}`; byTypeOpen[k] = (byTypeOpen[k]||0)+1 }
console.log('\n--- place_type (published & open) ---')
console.log(Object.entries(byTypeOpen).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${v}\t${k}`).join('\n'))

const kws = ['ゴルフ','マンション','団地','大学','学食','専門学校','高校','学校','社','オフィス','役所','市役所','公園','病院','スーパー','ショッピング','モール','駅','道の駅','工場','ホームセンター','キャンパス','寮','自治','商工','庁']
console.log('\n--- keyword hits in title+description+details (all rows / published&open) ---')
for (const kw of kws) {
  const hit = data.filter(p => `${p.title} ${p.description} ${JSON.stringify(p.details||'')}`.includes(kw))
  const hitOpen = hit.filter(p => p.status==='published' && !p.closed)
  if (hit.length) console.log(`${kw}\tall=${hit.length}\topen=${hitOpen.length}`)
}
console.log('\n--- ゴルフ rows ---')
data.filter(p=>`${p.title}${p.description}`.includes('ゴルフ')).forEach(p=>console.log(`${p.status}/${p.closed?'closed':'open'}\t${p.place_type}\t${p.prefecture}\t${p.title}`))
console.log('\n--- マンション/団地 rows ---')
data.filter(p=>/マンション|団地/.test(`${p.title}${p.description}`)).forEach(p=>console.log(`${p.status}/${p.closed?'closed':'open'}\t${p.place_type}\t${p.prefecture}\t${p.title}`))
console.log('\n--- 大学/キャンパス/学食 rows ---')
data.filter(p=>/大学|キャンパス|学食/.test(`${p.title}${p.description}`)).forEach(p=>console.log(`${p.status}/${p.closed?'closed':'open'}\t${p.place_type}\t${p.prefecture}\t${p.title}`))
