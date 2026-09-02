import { fetchAll } from './.verify-hikaru.mjs';

const all = await fetchAll('places', 'select=id,title,description,prefecture,address,place_type,fee,price_fixed,price_share_pct,day_type_fees,status,closed');
const pub = all.filter(p => p.status === 'published' && !p.closed);
const txt = (p) => `${p.title || ''} ${p.description || ''} ${p.address || ''}`;

// why did AEON match school?
const aeon = pub.find(p => (p.title || '').includes('イオン海浜幕張'));
const SCHOOL = /学校|大学|高校|中学|小学|学園|学院|専門学校|キャンパス|短大|幼稚園|保育園/;
console.log('AEON matched school on:', txt(aeon).match(SCHOOL), '| context:',
  txt(aeon).slice(Math.max(0, txt(aeon).search(SCHOOL) - 40), txt(aeon).search(SCHOOL) + 40).replace(/\n/g, ' '));

// school by TITLE only (stricter)
const schoolsStrict = pub.filter(p => SCHOOL.test(p.title || ''));
console.log('\nschool by TITLE only:', schoolsStrict.length);
const isShare = (p) => /歩率|歩合|％|%|パーセント|売上の/.test((p.fee || ''));
console.log('  of which share-based:', schoolsStrict.filter(isShare).length);
console.log('  NOT share-based:', schoolsStrict.filter(p => !isShare(p)).map(p => `${p.title} :: ${p.fee}`));

// tighter supermarket: exclude school hits
const SUPER = /スーパー|マート|食品館|生鮮|マルエツ|ヤオコー|ベルク|カスミ|イオン|ライフ|オーケー|サミット|業務スーパー|フードオフ/;
const supers = pub.filter(p => SUPER.test(txt(p)) && !SCHOOL.test(p.title || ''));
console.log('\nsupermarket-ish (excl. school titles):', supers.length);
const cat = { share: [], fixed: [], other: [] };
for (const p of supers) {
  if (isShare(p)) cat.share.push(p);
  else if (/円/.test(p.fee || '') || (p.price_fixed > 0)) cat.fixed.push(p);
  else cat.other.push(p);
}
console.log('  fixed:', cat.fixed.length, 'share:', cat.share.length, 'other:', cat.other.length);
console.log('  share rows:', cat.share.map(p => `${p.title} :: ${p.fee}`));
console.log('  other rows:', cat.other.map(p => `${p.title} :: ${JSON.stringify(p.fee)}`));
console.log('  place_type of supers:', supers.reduce((m, p) => (m[p.place_type] = (m[p.place_type] || 0) + 1, m), {}));

// whole-corpus fee split for context
const allFixed = pub.filter(p => !isShare(p) && (/円/.test(p.fee || '') || p.price_fixed > 0)).length;
const allShare = pub.filter(isShare).length;
console.log('\nALL published: fixed-ish', allFixed, '/ share-ish', allShare, '/ total', pub.length);

// can we read applications?
for (const t of ['applications', 'seller_documents']) {
  const res = await fetch(`${process.env.X || ''}`, {}).catch(() => null);
}
