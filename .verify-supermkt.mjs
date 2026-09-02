import fs from 'node:fs';
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim()];}));
const U = env.NEXT_PUBLIC_SUPABASE_URL, K = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
async function all(path){
  const out=[]; let from=0; const step=500;
  for(;;){
    const r = await fetch(`${U}/rest/v1/${path}`, {headers:{apikey:K, Authorization:`Bearer ${K}`, Range:`${from}-${from+step-1}`, 'Range-Unit':'items'}});
    if(!r.ok){ console.error(r.status, await r.text()); process.exit(1); }
    const j = await r.json();
    out.push(...j);
    if(j.length < step) break;
    from += step;
  }
  return out;
}
const rows = await all('places?select=id,title,address,prefecture,place_type,status,closed,price_fixed,price_share_pct,fee,day_type_fees,company_fixed_amount,host_id&status=eq.published&order=id');
const open = rows.filter(r=>!r.closed);
console.log('published total:', rows.length, ' open(=公開中):', open.length);
const byType = {};
for(const r of open) byType[r.place_type||'(null)'] = (byType[r.place_type||'(null)']||0)+1;
console.log('place_type breakdown:', JSON.stringify(byType, null, 1));
