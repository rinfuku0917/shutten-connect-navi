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
const rows = (await all('places?select=id,title,prefecture,address,place_type,closed,price_fixed,price_share_pct,fee,day_type_fees,place_fixed_unit,description&status=eq.published&order=title')).filter(r=>!r.closed);
const show = r => `${r.prefecture}\t fixed=${r.price_fixed} unit=${r.place_fixed_unit} share=${r.price_share_pct}\t dtf=${JSON.stringify(r.day_type_fees)}\t fee=${JSON.stringify(r.fee)}\t ${r.title}`;
console.log('=== Olympic系 ===');
const oly = rows.filter(r=>/Olympic/i.test(r.title));
oly.forEach(r=>console.log(show(r)));
console.log('件数:', oly.length);
const p={}; for(const r of oly) p[r.prefecture]=(p[r.prefecture]||0)+1;
console.log('都道府県内訳:', JSON.stringify(p));
console.log('\n=== サンユーストアー ===');
const sun = rows.filter(r=>/サンユー/.test(r.title));
sun.forEach(r=>console.log(show(r)));
console.log('件数:', sun.length);
const p2={}; for(const r of sun) p2[r.prefecture]=(p2[r.prefecture]||0)+1;
console.log('都道府県内訳:', JSON.stringify(p2));
