import fs from 'node:fs';
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim()];}));
const U = env.NEXT_PUBLIC_SUPABASE_URL, K = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
async function all(path){
  const out=[]; let from=0; const step=500;
  for(;;){
    const r = await fetch(`${U}/rest/v1/${path}`, {headers:{apikey:K, Authorization:`Bearer ${K}`, Range:`${from}-${from+step-1}`, 'Range-Unit':'items'}});
    if(!r.ok){ console.error(r.status, await r.text()); process.exit(1); }
    const j = await r.json(); out.push(...j);
    if(j.length < step) break; from += step;
  }
  return out;
}
const rows = (await all('places?select=id,title,address,prefecture,place_type,closed,price_fixed,price_share_pct,fee,day_type_fees,host_id&status=eq.published&order=id')).filter(r=>!r.closed);
for(const r of rows) console.log([r.id.slice(0,8), r.prefecture, r.place_type, r.title, '| addr:', r.address].join(' \t'));
