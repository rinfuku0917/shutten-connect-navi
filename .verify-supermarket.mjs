import fs from 'node:fs';

const env = fs.readFileSync('.env.local', 'utf8');
const get = (k) => env.split('\n').find(l => l.startsWith(k + '='))?.slice(k.length + 1).trim();
const URL = get('NEXT_PUBLIC_SUPABASE_URL');
const KEY = get('NEXT_PUBLIC_SUPABASE_ANON_KEY');

export async function fetchAll(table, query = '') {
  const out = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const to = from + size - 1;
    const url = `${URL}/rest/v1/${table}?${query}`;
    const res = await fetch(url, {
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        Range: `${from}-${to}`,
        'Range-Unit': 'items',
        Prefer: 'count=exact',
      },
    });
    if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`);
    const rows = await res.json();
    out.push(...rows);
    if (rows.length < size) break;
  }
  return out;
}

if (process.argv[2] === 'peek') {
  const rows = await fetchAll('places', 'select=*&limit=2');
  console.log(JSON.stringify(rows[0], null, 2));
}
