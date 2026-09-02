import fs from 'node:fs';
const env = fs.readFileSync('.env.local', 'utf8');
const get = (k) => env.split('\n').find(l => l.startsWith(k + '='))?.slice(k.length + 1).trim();
const URL = get('NEXT_PUBLIC_SUPABASE_URL');
const KEY = get('NEXT_PUBLIC_SUPABASE_ANON_KEY');
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

// 1. what can anon actually read?
for (const t of ['applications', 'seller_documents', 'posts', 'places', 'public_sellers']) {
  const res = await fetch(`${URL}/rest/v1/${t}?select=*&limit=1`, { headers: H });
  console.log(`${t}: HTTP ${res.status} ${res.ok ? '(readable)' : (await res.text()).slice(0, 120)}`);
}

// 2. the draft post in DB vs the md on disk
const res = await fetch(`${URL}/rest/v1/posts?select=slug,title,status,content&slug=eq.supermarket-food-truck`, { headers: H });
const rows = res.ok ? await res.json() : [];
console.log('\nposts row for supermarket-food-truck:', rows.length ? `status=${rows[0].status}` : 'NOT VISIBLE to anon');
if (rows.length) {
  const dbHas = rows[0].content.includes('キッチンカー側も嫌がらない');
  console.log('DB content contains the disputed sentence:', dbHas);
  const m = rows[0].content.match(/### なぜ歩合にしないのか[\s\S]{0,600}/);
  console.log('\n--- DB text of the disputed section ---\n', m ? m[0] : '(section not found)');
}
