import fs from 'node:fs';
const env = fs.readFileSync('.env.local', 'utf8');
const get = (k) => env.split('\n').find(l => l.startsWith(k + '='))?.slice(k.length + 1).trim();
const URL = get('NEXT_PUBLIC_SUPABASE_URL');
const KEY = get('NEXT_PUBLIC_SUPABASE_ANON_KEY');
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, Prefer: 'count=exact', Range: '0-0', 'Range-Unit': 'items' };

for (const t of ['applications', 'seller_documents', 'posts', 'places']) {
  const res = await fetch(`${URL}/rest/v1/${t}?select=*`, { headers: H });
  const rows = res.ok ? await res.json() : [];
  console.log(`${t}: status=${res.status} content-range=${res.headers.get('content-range')} rowsReturned=${rows.length}`);
}
