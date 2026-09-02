import { fetchAll } from './.verify-hikaru.mjs';

const all = await fetchAll('places', 'select=id,title,description,prefecture,address,place_type,fee,price_fixed,price_share_pct,day_type_fees,status,closed&order=created_at');
console.log('places total rows fetched:', all.length);

const pub = all.filter(p => p.status === 'published' && !p.closed);
console.log('published & not closed:', pub.length);

// --- classification helpers ---
const txt = (p) => `${p.title || ''} ${p.description || ''} ${p.address || ''}`;

const SUPER = /スーパー|ストア|マート|食品館|生鮮|マルエツ|ヤオコー|ベルク|カスミ|イオン|ライフ|オーケー|サミット|業務スーパー|フードオフ|食品/;
const SCHOOL = /学校|大学|高校|中学|小学|学園|学院|専門学校|キャンパス|短大|幼稚園|保育園/;

const supers = pub.filter(p => SUPER.test(txt(p)));
const schools = pub.filter(p => SCHOOL.test(txt(p)));

console.log('\n=== keyword-hit counts (my own classifier) ===');
console.log('supermarket-ish:', supers.length);
console.log('school-ish:', schools.length);

function feeKind(p) {
  const f = (p.fee || '').replace(/\s/g, '');
  const hasShare = p.price_share_pct != null && p.price_share_pct > 0;
  const hasFixed = p.price_fixed != null && p.price_fixed > 0;
  const dtf = p.day_type_fees ? JSON.stringify(p.day_type_fees) : '';
  const textShare = /歩率|歩合|％|%|パーセント/.test(f);
  const textFixed = /円/.test(f);
  const consult = /応相談|要相談|相談/.test(f);
  let kind = [];
  if (hasShare || textShare) kind.push('歩合');
  if (hasFixed || textFixed || /"amount"/.test(dtf)) kind.push('固定');
  if (!kind.length && consult) kind.push('応相談');
  if (!kind.length) kind.push('不明');
  return kind.join('+');
}

function tally(label, list) {
  const m = {};
  for (const p of list) m[feeKind(p)] = (m[feeKind(p)] || 0) + 1;
  console.log(`\n=== ${label} (n=${list.length}) fee kind ===`);
  console.log(m);
}
tally('SUPERMARKET', supers);
tally('SCHOOL', schools);

console.log('\n=== SCHOOL rows detail ===');
for (const p of schools) {
  console.log([p.title, '|', p.prefecture, '|', p.place_type, '| fee=', JSON.stringify(p.fee),
    '| fixed=', p.price_fixed, '| share=', p.price_share_pct,
    '| dtf=', p.day_type_fees ? JSON.stringify(p.day_type_fees) : null, '=>', feeKind(p)].join(' '));
}
