import fs from 'node:fs';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function fetchAll(table, select, extra = '') {
  const out = [];
  let from = 0;
  const size = 1000;
  for (;;) {
    const url = `${URL_}/rest/v1/${table}?select=${encodeURIComponent(select)}${extra}`;
    const res = await fetch(url, {
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        Range: `${from}-${from + size - 1}`,
        'Range-Unit': 'items',
        Prefer: 'count=exact',
      },
    });
    if (!res.ok) throw new Error(`${table} ${res.status} ${await res.text()}`);
    const rows = await res.json();
    out.push(...rows);
    if (rows.length < size) break;
    from += size;
  }
  return out;
}

const posts = await fetchAll('posts', '*', '&order=created_at.asc');
console.log('POSTS TOTAL:', posts.length);
console.log('COLUMNS:', Object.keys(posts[0] || {}).join(', '));
fs.writeFileSync('/private/tmp/claude-501/-Users-hidekifukusada-Desktop--------shutten-connect-navi/db7d6515-4023-44ab-9971-494a02f7a39c/scratchpad/posts.json', JSON.stringify(posts, null, 2));

for (const p of posts) {
  console.log([
    p.slug,
    p.status ?? p.published ?? '',
    p.category ?? '',
    (p.title ?? '').slice(0, 40),
    'body:' + String(p.content ?? p.body ?? '').length,
  ].join(' | '));
}
