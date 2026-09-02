// 別粒度の検証: 行単位・表単位の完全一致を数える（n-gramを一切使わない方法）
import fs from 'node:fs';
const SP = '/private/tmp/claude-501/-Users-hidekifukusada-Desktop--------shutten-connect-navi/db7d6515-4023-44ab-9971-494a02f7a39c/scratchpad';
const docs = JSON.parse(fs.readFileSync(`${SP}/mydocs.json`, 'utf8'));
const by = Object.fromEntries(docs.map(d => [d.slug, d.content || '']));

const A = 'kitchen-car-location-guide', B = 'weekday-food-truck-spots';

// --- 行単位の完全一致（マークダウンの行をそのまま比較。装飾記号だけ落とす） ---
const lines = s => s.split('\n').map(l => l.trim()).filter(l => l.length >= 6);
const la = lines(by[A]), lb = lines(by[B]);
const setb = new Set(lb.map(l => l.replace(/\*\*/g, '')));
console.log('=== 行がそのまま両方に出てくるもの（装飾**のみ無視） ===');
let hit = 0;
for (const l of la) { const k = l.replace(/\*\*/g, ''); if (setb.has(k)) { hit++; console.log('  ' + l); } }
console.log(`一致行数 ${hit} / 探し方${la.length}行中`);

// --- 表ブロックを抜き出して比較 ---
function tables(s) {
  const out = []; const ls = s.split('\n'); let cur = [];
  for (const l of ls) {
    if (l.trim().startsWith('|')) cur.push(l.trim());
    else { if (cur.length) out.push(cur); cur = []; }
  }
  if (cur.length) out.push(cur);
  return out;
}
const ta = tables(by[A]), tb = tables(by[B]);
console.log(`\n=== 表の数: 探し方 ${ta.length} / 平日 ${tb.length} ===`);
ta.forEach((t, i) => console.log(`探し方 表${i + 1} (${t.length}行): ${t[0]}`));
tb.forEach((t, i) => console.log(`平日   表${i + 1} (${t.length}行): ${t[0]}`));

console.log('\n=== 表どうしの行の一致（完全一致行 / 探し方の行数） ===');
ta.forEach((t1, i) => tb.forEach((t2, j) => {
  const s2 = new Set(t2.map(x => x.replace(/\*\*/g, '')));
  const same = t1.filter(x => s2.has(x.replace(/\*\*/g, '')));
  if (same.length) {
    console.log(`探し方表${i + 1} × 平日表${j + 1}: 完全一致 ${same.length}行 (探し方${t1.length}行/平日${t2.length}行)`);
    same.forEach(x => console.log(`     ${x}`));
  }
}));

// --- 表のセル単位（第1列をキーに、他の列が同じか） ---
console.log('\n=== メニュー表の突き合わせ（セル単位） ===');
const menuA = ta.find(t => t[0].includes('向いているメニュー'));
const menuB = tb.find(t => t[0].includes('合うメニュー'));
if (menuA && menuB) {
  const cells = t => Object.fromEntries(t.slice(2).map(r => { const c = r.split('|').map(x => x.trim()).filter(x => x !== ''); return [c[0], c.slice(1)]; }));
  const ca = cells(menuA), cb = cells(menuB);
  for (const k of Object.keys(ca)) {
    const other = cb[k] ?? cb[Object.keys(cb).find(x => x.startsWith(k.split('・')[0])) ?? ''];
    console.log(` 「${k}」`);
    console.log(`   探し方: ${ca[k].join(' ／ ')}`);
    console.log(`   平日  : ${other ? other.join(' ／ ') : '(該当行なし)'}`);
  }
}

// --- 共通する長い並び（別実装: 全部分文字列を対象に、貪欲でなくスライディング） ---
const norm = s => s.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[#*|>`~\-\s\r\n]/g, '');
function maximalCommon(a, b, min) {
  const X = norm(a), Y = norm(b);
  const found = [];
  let i = 0;
  while (i < X.length) {
    let len = 0;
    while (i + len < X.length && Y.includes(X.slice(i, i + len + 1))) len++;
    if (len >= min) { found.push(X.slice(i, i + len)); i += len; } else i++;
  }
  return found;
}
for (const min of [14, 20, 30]) {
  const f = maximalCommon(by[A], by[B], min);
  console.log(`\n=== ${min}文字以上の共通の並び: ${f.length}か所 / 計${f.reduce((s, x) => s + x.length, 0)}文字 ===`);
  if (min === 14) f.sort((p, q) => q.length - p.length).forEach(x => console.log(`  [${x.length}] ${x}`));
}
// 比較のため既知ペアと、同分野の別ペア
for (const [x, y] of [['renting-parking-space', 'auto-mtgh64lh-jwwkxe'], ['kitchen-car-location-guide', 'how-to-find-food-truck-spots'], ['kitchen-car-location-guide', 'choose-profitable-food-truck-location'], ['weekday-food-truck-spots', 'food-truck-fee-guide']]) {
  const f = maximalCommon(by[x], by[y], 14);
  console.log(`\n[比較] ${x} × ${y}: ${f.length}か所 / 計${f.reduce((s, v) => s + v.length, 0)}文字  最長${Math.max(0, ...f.map(v => v.length))}`);
  f.sort((p, q) => q.length - p.length).slice(0, 5).forEach(v => console.log(`     [${v.length}] ${v}`));
}
console.log(`\n本文の長さ(正規化後): 探し方 ${norm(by[A]).length} / 平日 ${norm(by[B]).length}`);
