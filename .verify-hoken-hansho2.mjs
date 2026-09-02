import fs from 'node:fs';
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n')
  .filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim()];}));
const h={apikey:env.NEXT_PUBLIC_SUPABASE_ANON_KEY,Authorization:`Bearer ${env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`};
const r=await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/posts?select=slug,status,content&slug=eq.kitchen-car-business-license`,{headers:h});
const j=await r.json();
const c=j[0]?.content||'';
console.log('status=',j[0]?.status);
for(const m of c.matchAll(/[^\n]*(食品衛生法|許可|届出)[^\n]*/g)) console.log('> '+m[0].trim().slice(0,150));
