import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function fetchAll(table, select) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(table).select(select).range(from, from + 999);
    if (error) { console.log('ERR', table, error.message); return out; }
    out.push(...data);
    if (data.length < 1000) break;
  }
  return out;
}

const posts = await fetchAll('posts', '*');
console.log('=== posts count:', posts.length);
if (posts[0]) console.log('columns:', Object.keys(posts[0]).join(', '));
console.log('---');
for (const p of posts) {
  console.log([
    p.slug,
    p.status ?? '?',
    (p.published ?? '?'),
    p.category ?? '-',
    (p.content ?? p.body ?? '').length,
    p.published_at ?? p.created_at ?? '',
    p.title,
  ].join(' | '));
}
fs.writeFileSync('/private/tmp/claude-501/-Users-hidekifukusada-Desktop--------shutten-connect-navi/db7d6515-4023-44ab-9971-494a02f7a39c/scratchpad/posts.json', JSON.stringify(posts, null, 1));
