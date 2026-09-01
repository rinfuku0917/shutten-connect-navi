import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

const env = Object.fromEntries(
  fs.readFileSync(new URL('./.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')];
    })
);

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const all = [];
for (let from = 0; ; from += 500) {
  const { data, error } = await sb.from('places').select('*').range(from, from + 499);
  if (error) { console.error(error); process.exit(1); }
  all.push(...data);
  if (data.length < 500) break;
}

console.log('total rows:', all.length);
console.log('columns:', Object.keys(all[0] || {}).join(', '));

const byStatus = {};
for (const p of all) {
  const k = `${p.status} / closed=${p.closed}`;
  byStatus[k] = (byStatus[k] || 0) + 1;
}
console.log('status breakdown:', byStatus);

fs.writeFileSync(new URL('./.verify-places.json', import.meta.url), JSON.stringify(all, null, 2));
