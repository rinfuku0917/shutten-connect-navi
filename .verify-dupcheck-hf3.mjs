// 指摘の個別主張を1つずつ突き合わせる
import fs from 'node:fs';
const SP = '/private/tmp/claude-501/-Users-hidekifukusada-Desktop--------shutten-connect-navi/db7d6515-4023-44ab-9971-494a02f7a39c/scratchpad';
const docs = JSON.parse(fs.readFileSync(`${SP}/mydocs.json`, 'utf8'));
const by = Object.fromEntries(docs.map(d => [d.slug, d.content || '']));
const A = by['kitchen-car-location-guide'], B = by['weekday-food-truck-spots'];

const tbl = (s, key) => { const ls = s.split('\n'); const i = ls.findIndex(l => l.trim().startsWith('|') && l.includes(key)); const out = []; for (let k = i; k < ls.length && ls[k].trim().startsWith('|'); k++) out.push(ls[k].trim()); return out; };

console.log('主張(1) 都道府県表は「ヘッダ行を含めて完全に同一」か');
const pa = tbl(A, '都道府県'), pb = tbl(B, '都道府県');
console.log(`  探し方 ${pa.length}行 / 平日 ${pb.length}行`);
const max = Math.max(pa.length, pb.length);
for (let i = 0; i < max; i++) {
  const x = pa[i] ?? '(なし)', y = pb[i] ?? '(なし)';
  console.log(`   ${x === y ? '一致  ' : '相違  '} 探:${x.padEnd(26)} 平:${y}`);
}

console.log('\n主張(3) 場所内訳表の上位5行は同一数値か');
const sa = tbl(A, '場所の種類'), sb = tbl(B, '| 場所 | 件数');
console.log('  探し方:', sa.join(' '));
console.log('  平日  :', sb.join(' '));
const num = r => r.split('|').map(x => x.trim()).filter(Boolean);
for (let i = 2; i < Math.min(sa.length, sb.length); i++) {
  const ca = num(sa[i]), cb = num(sb[i]);
  console.log(`   ${ca[0] === cb[0] && ca[1] === cb[1] ? '一致' : '相違'}  探:${ca.join('/')}   平:${cb.join('/')}`);
}

console.log('\n主張(4) 「その場所で2〜3回出て、1日何食売れるかを記録する」は逐語一致か');
const q = 'その場所で2〜3回出て、1日何食売れるかを記録する';
console.log(`  探し方に完全一致で存在: ${A.replace(/\*\*/g, '').includes(q)}`);
console.log(`  平日に完全一致で存在  : ${B.replace(/\*\*/g, '').includes(q)}`);
console.log('  探し方の実際の文:', (A.split('\n').find(l => l.includes('2〜3回出て')) || '').trim());
console.log('  平日の実際の文  :', (B.split('\n').find(l => l.includes('2〜3回出て')) || '').trim());

console.log('\n主張(2) 平日側の断り書き');
B.split('\n').forEach((l, i) => { if (l.includes('平日に限らず')) console.log(`  L${i + 1}: ${l.trim()}`); });

console.log('\n=== 記事の他の場所に「別記事を見よ」の断りがあるか ===');
for (const [n, s, other] of [['探し方', A, 'weekday-food-truck-spots'], ['平日', B, 'kitchen-car-location-guide']]) {
  const ls = s.split('\n').filter(l => l.includes(other));
  console.log(`  ${n} → 相手記事へのリンク ${ls.length}件`);
  ls.forEach(l => console.log(`     ${l.trim()}`));
}
console.log('\n  都道府県データの節の近くに「詳しくは別記事」の断りがあるか:');
for (const [n, s] of [['探し方', A], ['平日', B]]) {
  const ls = s.split('\n');
  const i = ls.findIndex(l => l.includes('都道府県で分けると'));
  console.log(`  -- ${n} (該当節 L${i + 1}〜) --`);
  ls.slice(i - 2, i + 18).forEach(l => { if (l.trim()) console.log(`     ${l.trim().slice(0, 90)}`); });
}

console.log('\n=== 平日側の地域節に、平日固有の内容が1文でもあるか ===');
const sec = B.split('## 募集はどの地域にあるか')[1].split('\n## ')[0];
sec.split('\n').filter(l => l.trim() && !l.trim().startsWith('|')).forEach(l => {
  const uniq = !A.replace(/\*\*/g, '').includes(l.replace(/\*\*/g, '').trim().slice(0, 20));
  console.log(`   ${uniq ? '[平日固有]' : '[探し方にも]'} ${l.trim().slice(0, 80)}`);
});
