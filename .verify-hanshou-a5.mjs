import fs from 'node:fs';
const env = Object.fromEntries(fs.readFileSync('/Users/hidekifukusada/Desktop/コネクトナビ/shutten-connect-navi/.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')];}));
const U = env.NEXT_PUBLIC_SUPABASE_URL, K = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const H = { apikey: K, Authorization: `Bearer ${K}` };

// blog テーブル名を探る
for (const t of ['blog_posts','posts','blogs','articles','blog']) {
  const r = await fetch(`${U}/rest/v1/${t}?select=*&limit=1`, { headers: H });
  if (r.ok) { const j = await r.json(); console.log('OK table:', t, '| cols:', j[0] ? Object.keys(j[0]).join(', ') : '(empty)'); }
}
