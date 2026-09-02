// 反証テスト: 指摘された4か所を取り除いたら、重なりは平常値に戻るか？
// 戻るなら「4か所が原因」、戻らないなら「単に話題が近いだけ」＝指摘は的外れ
import fs from 'node:fs';
const SP = '/private/tmp/claude-501/-Users-hidekifukusada-Desktop--------shutten-connect-navi/db7d6515-4023-44ab-9971-494a02f7a39c/scratchpad';
const docs = JSON.parse(fs.readFileSync(`${SP}/mydocs.json`, 'utf8'));
const by = Object.fromEntries(docs.map(d => [d.slug, d.content || '']));
const A = 'kitchen-car-location-guide', B = 'weekday-food-truck-spots';

const norm = s => (s || '').replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[#*|>`~\-\s\r\n]/g, '');
const gs = (s, n) => { const t = new Set(); for (let i = 0; i + n <= s.length; i++) t.add(s.slice(i, i + n)); return t; };
const J = (a, b, n = 4) => { const ga = gs(norm(a), n), gb = gs(norm(b), n); let i = 0; for (const x of ga) if (gb.has(x)) i++; return i / (ga.size + gb.size - i); };

// 節を見出し単位で切る
function sections(md) {
  const out = []; let cur = { h: '(前文)', body: [] };
  for (const l of md.split('\n')) {
    if (/^#{2,3}\s/.test(l)) { out.push(cur); cur = { h: l.replace(/^#+\s*/, '').trim(), body: [] }; }
    else cur.body.push(l);
  }
  out.push(cur); return out;
}
const secA = sections(by[A]), secB = sections(by[B]);
console.log('=== 探し方の節と文字数 ===');
secA.forEach(s => console.log(`  ${String(norm(s.body.join('\n')).length).padStart(4)}字  ${s.h}`));
console.log('=== 平日の節と文字数 ===');
secB.forEach(s => console.log(`  ${String(norm(s.body.join('\n')).length).padStart(4)}字  ${s.h}`));

const rebuild = (secs, drop) => secs.filter(s => !drop.includes(s.h)).map(s => '## ' + s.h + '\n' + s.body.join('\n')).join('\n');

console.log('\n=== 素の値 ===');
console.log(` 探し方 × 平日 = ${(J(by[A], by[B]) * 100).toFixed(1)}%   (全210組の中央値2.8% / 95pct 6.3%)`);

// 指摘の提案どおりに削ってみる
const dropB = ['募集はどの地域にあるか'];
const b1 = rebuild(secB, dropB);
console.log(`\n(1) 平日から「募集はどの地域にあるか」を削除 → ${(J(by[A], b1) * 100).toFixed(1)}%`);

const dropB2 = ['募集はどの地域にあるか', '平日に出られるのはどんな場所か'];
const b2 = rebuild(secB, dropB2);
console.log(`(1)+(3) さらに場所内訳の節も削除 → ${(J(by[A], b2) * 100).toFixed(1)}%`);

const b3 = rebuild(secB, [...dropB2, '場所と合うメニュー']);
console.log(`(1)+(3)+(4) さらにメニュー表の節も削除 → ${(J(by[A], b3) * 100).toFixed(1)}%`);

// 逆に探し方側を削る案（指摘の提案(3)）
const a1 = rebuild(secA, ['場所の種類ごとの向き・不向き']);
console.log(`\n提案(3)案: 探し方から「場所の種類ごとの向き・不向き」を削除 → ${(J(a1, by[B]) * 100).toFixed(1)}%`);
const a2 = rebuild(secA, ['場所の種類ごとの向き・不向き', '地域によって募集の数はかなり違う']);
console.log(`  ＋探し方の地域節も削除（両方消す極端案） → ${(J(a2, by[B]) * 100).toFixed(1)}%`);

// 定型文（CTA・内部リンク文）だけを共通と数えていないか
console.log('\n=== 共通の並び438文字の内訳（定型文かどうか） ===');
function chunks(a, b, min = 14) {
  const X = norm(a), Y = norm(b); const f = []; let i = 0;
  while (i < X.length) { let len = 0; while (i + len < X.length && Y.includes(X.slice(i, i + len + 1))) len++; if (len >= min) { f.push(X.slice(i, i + len)); i += len; } else i++; }
  return f;
}
const cs = chunks(by[A], by[B]);
// 他の記事にも出てくる＝サイト共通の定型文
const others = docs.filter(d => d.slug !== A && d.slug !== B).map(d => norm(d.content));
let boiler = 0, real = 0;
for (const c of cs.sort((p, q) => q.length - p.length)) {
  const alsoIn = others.filter(o => o.includes(c)).length;
  const tag = alsoIn > 0 ? `他${alsoIn}本にもある=定型文` : 'この2本だけ';
  if (alsoIn > 0) boiler += c.length; else real += c.length;
  console.log(`  [${String(c.length).padStart(2)}] ${tag}  ${c.slice(0, 40)}`);
}
console.log(`\n  定型文ぶん ${boiler}字 / この2本固有 ${real}字 (計${boiler + real}字)`);
console.log(`  平日の本文 ${norm(by[B]).length}字 に占める固有重複の割合 = ${(real / norm(by[B]).length * 100).toFixed(1)}%`);
