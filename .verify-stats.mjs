import fs from 'node:fs';
const all = JSON.parse(fs.readFileSync(new URL('./.verify-places.json', import.meta.url), 'utf8'));
const live = all.filter((p) => p.status === 'published' && !p.closed);
live.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'ja'));

// 私の分類（fee本文を1件ずつ読んで手で決めたもの）
// kind: fixed / share / both / ask
// wd, we: 平日・週末の「キッチンカーの出店料」金額（光熱費・駐車場・広告・物販は除外）
const C = {};
const set = (idx, kind, wd, we, note) => { C[idx] = { kind, wd, we, note }; };
set(1,'share',null,null,'10%');
set(2,'fixed',7500,null,'1日7500 単一額');
set(3,'share',null,null,'10%');
set(4,'share',null,null,'10%');
set(5,'fixed',7500,null,'光熱費1000は別');
set(6,'fixed',5000,7500);
set(7,'share');set(8,'share');set(9,'share');set(10,'share');set(11,'share');set(12,'share');
set(13,'fixed',5000,7000);
set(14,'both',3000,null,'15%+3000');
set(15,'both',2000,7500,'20% 最低保証 平日2000/休日7500');
set(16,'share');set(17,'share');set(18,'share');set(19,'share');set(20,'share');
set(21,'share');set(22,'share');set(23,'share');
set(24,'fixed',5500,7500,'KC行のみ。物販/催事は別業態');
for (let i=25;i<=40;i++) set(i,'fixed',3000,4500,'Olympic KC行');
set(41,'share');
set(42,'fixed',7000,9000);
set(43,'both',3000,null,'15%+3000');
set(44,'fixed',4500,6500);
set(45,'fixed',5000,7500);
set(46,'both',4000,null,'4000+10%');
set(47,'fixed',7000,8000,'電源500は別');
set(48,'fixed',7500,null,'光熱費500/広告3000は別');
set(49,'fixed',7500,null,'駐車料光熱費600/広告3000は別');
set(50,'both',2000,7500,'20% 最低保証');
set(51,'fixed',7500,null);
set(52,'fixed',7500,null);
set(53,'fixed',8000,null);
set(54,'ask',null,null,'お問い合わせください');
set(55,'fixed',7500,null);
set(56,'both',3000,null,'10%+3000');
set(57,'share');set(58,'share');set(59,'share');
for (const i of [60,61,62,63,64,65,66,67,69,70,71,72,73,74]) set(i,'fixed',5000,5000,'サンユー 平日/週末5,000');
set(68,'ask',null,null,'サンユー大津：feeが曜日のみ、金額なし');
set(75,'share');
set(76,'both',3000,null,'15%+3000');
set(77,'fixed',5000,null);
set(78,'share',null,null,'10%（電気代別）');
set(79,'share');
set(80,'both',2500,null,'一日利用2500+10%');
set(81,'ask',null,null,'ご相談');
set(82,'both',3000,null,'15%+3000');
set(83,'share',null,null,'10% 上限500円');
set(84,'share');set(85,'share');set(86,'share');set(87,'share');set(88,'share');set(89,'share');set(90,'share');
set(91,'fixed',5000,null);
set(92,'fixed',7500,null);
set(93,'ask',null,null,'不明');
set(94,'share');set(95,'share');
set(96,'ask',null,null,'ー');
set(97,'share');
set(98,'fixed',5000,null,'テントブース飲食5,000（物販3,000は別業態）');
set(99,'share');set(100,'share');set(101,'share');set(102,'share');set(103,'share');
set(104,'fixed',3000,null,'3,000(駐車場アリ)/2,000(ナシ) ※駐車場代込み');
set(105,'share');set(106,'share');set(107,'share');set(108,'share');
set(109,'fixed',null,null,'2日間7万円。1日あたりの額ではない');
set(110,'ask',null,null,'無料買取案件5万円税込＝出店料ではない');

const rows = live.map((p, i) => ({ n: i + 1, title: p.title, fee: p.fee, type: p.place_type, ...C[i + 1] }));
const miss = rows.filter((r) => !r.kind);
if (miss.length) { console.log('未分類:', miss.map((r) => r.n)); process.exit(1); }

const cnt = (f) => rows.filter(f).length;
console.log('=== 決め方の分類（私の判定）===');
console.log(' 固定:', cnt(r=>r.kind==='fixed'), ' 歩合:', cnt(r=>r.kind==='share'), ' 併用:', cnt(r=>r.kind==='both'), ' 応相談:', cnt(r=>r.kind==='ask'), ' 計:', rows.length);

console.log('\n=== 常設 / 単発イベント ===');
for (const t of ['regular','event']) {
  console.log(` ${t}: 計${cnt(r=>r.type===t)}  固定${cnt(r=>r.type===t&&r.kind==='fixed')} 歩合${cnt(r=>r.type===t&&r.kind==='share')} 併用${cnt(r=>r.type===t&&r.kind==='both')} 応相談${cnt(r=>r.type===t&&r.kind==='ask')}`);
}

const stat = (vals, label) => {
  const s = [...vals].sort((a,b)=>a-b);
  const mid = s.length % 2 ? s[(s.length-1)/2] : (s[s.length/2-1]+s[s.length/2])/2;
  const tally = {};
  s.forEach(v => tally[v] = (tally[v]||0)+1);
  console.log(` ${label}: ${s.length}件  中央値${mid.toLocaleString()}円  最低${s[0].toLocaleString()}円  最高${s[s.length-1].toLocaleString()}円`);
  console.log(`   内訳: ${Object.entries(tally).map(([k,v])=>`${(+k).toLocaleString()}円×${v}`).join(', ')}`);
};

console.log('\n=== A) 記事の読み方（固定＋併用を合算・109は除外）===');
stat(rows.filter(r=>(r.kind==='fixed'||r.kind==='both')&&r.wd!=null).map(r=>r.wd), '平日');
stat(rows.filter(r=>(r.kind==='fixed'||r.kind==='both')&&r.we!=null).map(r=>r.we), '週末');

console.log('\n=== B) 純粋な固定制のみ ===');
stat(rows.filter(r=>r.kind==='fixed'&&r.wd!=null).map(r=>r.wd), '平日');
stat(rows.filter(r=>r.kind==='fixed'&&r.we!=null).map(r=>r.we), '週末');

console.log('\n=== 週末の金額を持つ案件（記事の38件と突き合わせ）===');
rows.filter(r=>(r.kind==='fixed'||r.kind==='both')&&r.we!=null).forEach((r,i)=>console.log(` ${String(i+1).padStart(2)}. ${r.we.toLocaleString()}円  ${r.title}  | ${JSON.stringify(r.fee).slice(0,70)}`));

console.log('\n=== 損得の分かれ目 ===');
for (const f of [3000,5000,7500]) console.log(` ${f}円 → 10%:${Math.round(f/0.10).toLocaleString()}円  15%:${(f/0.15).toFixed(1)}円`);
