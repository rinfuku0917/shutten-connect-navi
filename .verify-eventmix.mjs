// 独立検証: 常設/単発イベント × 料金体系のクロス集計
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  fs.readFileSync(new URL('./.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const rows = [];
for (let from = 0; ; from += 500) {
  const { data, error } = await sb.from('places').select('*').order('id').range(from, from + 499);
  if (error) throw error;
  rows.push(...data);
  if (data.length < 500) break;
}
console.log('全行数:', rows.length);

const live = rows.filter(p => p.status === 'published' && p.closed !== true);
console.log('公開中:', live.length);

const byType = {};
for (const p of live) byType[p.place_type ?? '(null)'] = (byType[p.place_type ?? '(null)'] || 0) + 1;
console.log('place_type 内訳:', byType);

fs.writeFileSync(new URL('./.verify-eventmix.json', import.meta.url), JSON.stringify(live, null, 1));

// --- 単発イベント（place_type='event'）の全件を fee 原文つきで出す ---
const ev = live.filter(p => p.place_type === 'event');
console.log('\n===== place_type=event ' + ev.length + '件 =====');
ev.forEach((p, i) => {
  console.log(`\n[${i + 1}] ${p.title}  (${p.prefecture})`);
  console.log(`    fee              : ${JSON.stringify(p.fee)}`);
  console.log(`    price_fixed      : ${JSON.stringify(p.price_fixed)}  unit:${JSON.stringify(p.place_fixed_unit)}`);
  console.log(`    price_share_pct  : ${JSON.stringify(p.price_share_pct)}`);
  console.log(`    day_type_fees    : ${JSON.stringify(p.day_type_fees)}`);
  console.log(`    schedule         : ${JSON.stringify(p.schedule)}`);
});
