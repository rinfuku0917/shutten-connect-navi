import fs from 'node:fs';
const rows = JSON.parse(fs.readFileSync(new URL('.verify-bcheck-places.json', import.meta.url), 'utf8'));
const pub = rows.filter(r => r.status === 'published' && !r.closed);

// 全110件の fee テキストを見る（スーパー判定の見落としがないか）
console.log('--- 全110件の fee ---');
for (const r of pub.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'ja'))) {
  const fee = (r.fee || '').replace(/\n/g, ' / ');
  console.log(`${r.title}\n    fee=「${fee}」 dayfee=${r.day_type_fees ? 'あり' : '-'} share%=${r.company_share_pct} fixed=${r.price_fixed}`);
}

// 記事のスーパー35件の内訳を、fee テキストの型で分類
const isSuper = r => /サンユーストアー|Olympic|さがみや|スーパーあさの|ガッツ/.test(r.title);
const sup = pub.filter(isSuper);
const cls = r => {
  const f = r.fee || '';
  if (/[%％]|歩合/.test(f)) return '歩合';
  if (r.day_type_fees || /円/.test(f)) return '固定';
  return '応相談/金額なし';
};
const tally = {};
for (const r of sup) tally[cls(r)] = (tally[cls(r)] ?? 0) + 1;
console.log('\n--- スーパー35件 fee本文での分類 ---');
console.log(tally);
console.log('固定でないもの:');
for (const r of sup) if (cls(r) !== '固定') console.log('  ', cls(r), '|', r.title, '|', JSON.stringify(r.fee), '| share%=', r.company_share_pct);

// チェーンB（サンユー）の5,000円記載を数える
const b = sup.filter(r => /サンユーストアー/.test(r.title));
console.log('\n--- サンユーストアー ---');
console.log('店舗数 =', b.length);
console.log('fee に 5,000 の記載あり =', b.filter(r => /5,?000/.test(r.fee || '')).length);
console.log('記載なし:', b.filter(r => !/5,?000/.test(r.fee || '')).map(r => r.title + ' → ' + JSON.stringify(r.fee)));

// チェーンA（Olympic系）
const a = sup.filter(r => /Olympic/.test(r.title));
console.log('\n--- Olympic系 ---');
console.log('店舗数 =', a.length);
const grp = {};
for (const r of a) {
  const d = r.day_type_fees;
  const k = d ? `平日${d.weekday.placeFee + d.weekday.companyFee} / 週末${d.weekend.placeFee + d.weekend.companyFee}` : 'なし';
  (grp[k] ??= []).push(r.title);
}
for (const [k, v] of Object.entries(grp)) console.log(' ', k, '→', v.length, '件', v.length <= 2 ? JSON.stringify(v) : '');
console.log('\n各店の fee テキスト先頭行:');
for (const r of a) console.log('  ', r.title, '→', (r.fee || '').split('\n')[0]);
