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
const rows = (await all('places?select=id,title,prefecture,address,place_type,closed,price_fixed,price_share_pct,fee,day_type_fees,host_id&status=eq.published&order=title')).filter(r=>!r.closed);
// group by host_id
const byHost = {};
for(const r of rows) (byHost[r.host_id] ??= []).push(r);
const hosts = Object.entries(byHost).sort((a,b)=>b[1].length-a[1].length);
console.log('=== host_id ごとの件数（上位） ===');
for(const [h,list] of hosts.slice(0,6)){
  const pref = {};
  for(const r of list) pref[r.prefecture]=(pref[r.prefecture]||0)+1;
  console.log(`host ${h.slice(0,8)}: ${list.length}件  都道府県=${JSON.stringify(pref)}`);
}
console.log('\n=== Olympic系（title に Olympic を含む）詳細 ===');
const oly = rows.filter(r=>/Olympic/i.test(r.title));
for(const r of oly){
  console.log(`${r.prefecture}\t host=${r.host_id.slice(0,8)}\t fixed=${r.price_fixed} share=${r.price_share_pct}\t dtf=${JSON.stringify(r.day_type_fees)}\t fee=${JSON.stringify(r.fee)}\t ${r.title}`);
}
console.log('Olympic件数:', oly.length);
const p={}; for(const r of oly) p[r.prefecture]=(p[r.prefecture]||0)+1;
console.log('Olympic都道府県内訳:', JSON.stringify(p));
console.log('\n=== サンユーストアー詳細 ===');
const sun = rows.filter(r=>/サンユー/.test(r.title));
for(const r of sun) console.log(`${r.prefecture}\t host=${r.host_id.slice(0,8)}\t fixed=${r.price_fixed}\t dtf=${JSON.stringify(r.day_type_fees)}\t ${r.title}`);
console.log('サンユー件数:', sun.length);
