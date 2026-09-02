import fs from 'node:fs';
const env = Object.fromEntries(fs.readFileSync('/Users/hidekifukusada/Desktop/コネクトナビ/shutten-connect-navi/.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')];}));
const U = env.NEXT_PUBLIC_SUPABASE_URL, K = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const H = { apikey: K, Authorization: `Bearer ${K}` };

for (const slug of ['weekday-food-truck-spots','food-truck-fee-guide','supermarket-food-truck']) {
  const r = await fetch(`${U}/rest/v1/posts?slug=eq.${slug}&select=slug,status,excerpt,meta_description,content`, { headers: H });
  const j = await r.json();
  if (!j.length) { console.log(`\n### ${slug}: DBに無し`); continue; }
  const p = j[0];
  console.log(`\n### ${slug}  status=${p.status}`);
  console.log('excerpt:', p.excerpt);
  console.log('meta_description:', p.meta_description);
  const lines = String(p.content).split('\n');
  console.log('-- 「13件」「14件」「38件」「39件」を含む行 --');
  lines.forEach((l,i)=>{ if (/13件|14件|38件|39件/.test(l)) console.log(`  L${i+1}: ${l.trim()}`); });
}
