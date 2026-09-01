import fs from 'node:fs';
const all = JSON.parse(fs.readFileSync(new URL('./.verify-places.json', import.meta.url), 'utf8'));
const live = all.filter((p) => p.status === 'published' && !p.closed);
live.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'ja'));

// 1) 税の明記
const taxRe = /税別|税込|税抜|[＋+]\s*[（(]?税|[（(]税[）)]|円税別|%税別/;
const withTax = live.filter((p) => taxRe.test(p.fee || ''));
console.log('税に言及している件数:', withTax.length);
console.log('言及なし:', live.filter((p) => !taxRe.test(p.fee || '')).map((p, i) => p.title).length);
live.forEach((p) => { if (!taxRe.test(p.fee || '')) console.log('  [no-tax]', p.title, '|', JSON.stringify(p.fee)); });

// 2) place_type
const ev = live.filter((p) => p.place_type === 'event');
console.log('\nevent件数:', ev.length, ' regular件数:', live.length - ev.length);

// 3) サンユー / Olympic の件数
console.log('\nサンユー:', live.filter((p) => /サンユー/.test(p.title)).length);
console.log('Olympic(3000/4500):', live.filter((p) => /平日3,000円（税別）、週末4,500円/.test(p.fee || '')).length);
console.log('サンユー5,000円明記:', live.filter((p) => /サンユー/.test(p.title) && /5,000円/.test(p.fee || '')).length);
live.filter((p) => /サンユー/.test(p.title)).forEach((p) => console.log('   ', p.title, '|', JSON.stringify(p.fee)));

// 4) 率の抽出（自分の分類と突き合わせる用）
const pct = {};
live.forEach((p) => {
  const m = [...(p.fee || '').matchAll(/(\d+)\s*[%％]/g)].map((x) => x[1]);
  if (m.length) { const k = m.join('/'); (pct[k] ||= []).push(p.title); }
});
console.log('\n率が出てくる案件:', Object.entries(pct).map(([k, v]) => `${k}%:${v.length}`).join('  '));
console.log('率を含む案件 総数:', Object.values(pct).flat().length);
