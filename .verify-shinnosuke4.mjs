import fs from 'node:fs'
const env = Object.fromEntries(fs.readFileSync(new URL('.env.local', import.meta.url),'utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim()]}))
const U=env.NEXT_PUBLIC_SUPABASE_URL, K=env.NEXT_PUBLIC_SUPABASE_ANON_KEY
for (const t of ['sales','applications','messages','reviews','contracts','place_slots','favorites']) {
  const r = await fetch(`${U}/rest/v1/${t}?select=*&limit=2`, {headers:{apikey:K,Authorization:`Bearer ${K}`, Prefer:'count=exact', Range:'0-1'}})
  console.log(t, r.status, (r.headers.get('content-range')||''), (await r.text()).slice(0,100))
}
