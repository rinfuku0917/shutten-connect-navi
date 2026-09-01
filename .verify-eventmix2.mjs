// 全110件を fee 原文で分類しなおす（自動ルール＋原文表示）
import fs from 'node:fs';
const live = JSON.parse(fs.readFileSync(new URL('./.verify-eventmix.json', import.meta.url), 'utf8'));

const norm = (s) => (s ?? '').replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).replace(/％/g, '%').replace(/，/g, ',');

// 自動ルール: 「%」を含めば歩合要素、円/金額を含めば固定要素
const hasShare = (f) => /\d+\s*%/.test(f);
const hasYen = (f) => /[0-9][0-9,]*\s*(円|万円)/.test(f);

const cls = [];
for (const p of live) {
  const f = norm(p.fee);
  const s = hasShare(f), y = hasYen(f);
  let kind;
  if (!f.trim()) kind = 'ask/空';
  else if (s && y) kind = 'both?';
  else if (s) kind = 'share';
  else if (y) kind = 'fixed?';
  else kind = 'ask/文字のみ';
  cls.push({ ...p, f, kind });
}

const tally = {};
for (const r of cls) tally[r.kind] = (tally[r.kind] || 0) + 1;
console.log('=== 自動ルールの粗い分類（全110）===');
console.log(tally);

console.log('\n=== 「%」も「円」も無い＝応相談候補 ===');
cls.filter(r => r.kind.startsWith('ask')).forEach(r =>
  console.log(` [${r.place_type}] ${r.title}\n     fee=${JSON.stringify(r.fee)}`));

console.log('\n=== 「%」と「円」が両方ある＝併用 or 最低保証 or 但し書き ===');
cls.filter(r => r.kind === 'both?').forEach(r =>
  console.log(` [${r.place_type}] ${r.title}\n     fee=${JSON.stringify(r.fee)}`));

console.log('\n=== 円のみ（固定候補）を place_type 別に ===');
for (const t of ['regular', 'event']) {
  const g = cls.filter(r => r.kind === 'fixed?' && r.place_type === t);
  console.log(`\n--- ${t}: ${g.length}件 ---`);
  g.forEach(r => console.log(`   ${r.title}  |  ${JSON.stringify(r.fee)}`));
}

console.log('\n=== 歩合のみ を place_type 別に ===');
for (const t of ['regular', 'event']) {
  const g = cls.filter(r => r.kind === 'share' && r.place_type === t);
  console.log(` ${t}: ${g.length}件`);
}
