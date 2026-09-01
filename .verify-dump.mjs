import fs from 'node:fs';
const all = JSON.parse(fs.readFileSync(new URL('./.verify-places.json', import.meta.url), 'utf8'));
const live = all.filter((p) => p.status === 'published' && !p.closed);
console.log('live count:', live.length);
live.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'ja'));
live.forEach((p, i) => {
  console.log(`\n--- [${i + 1}] ${p.title}`);
  console.log(`  pref=${p.prefecture} type=${p.place_type} recruit=${JSON.stringify(p.recruit)}`);
  console.log(`  fee=${JSON.stringify(p.fee)}`);
  console.log(`  price_fixed=${p.price_fixed} price_share_pct=${p.price_share_pct} place_fixed_unit=${p.place_fixed_unit}`);
  console.log(`  day_type_fees=${JSON.stringify(p.day_type_fees)}`);
  console.log(`  open_days=${JSON.stringify(p.open_days)} schedule=${JSON.stringify(p.schedule)?.slice(0, 300)}`);
});
