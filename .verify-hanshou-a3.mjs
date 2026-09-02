import fs from 'node:fs';
const pub = JSON.parse(fs.readFileSync('/private/tmp/claude-501/-Users-hidekifukusada-Desktop--------shutten-connect-navi/db7d6515-4023-44ab-9971-494a02f7a39c/scratchpad/pub-hanshou.json','utf8'));

const yen = s => Number(String(s).replace(/,/g,''));

// 平日額 / 週末額 を fee 文字列から取り出す（両方が明記されているものだけ）
function parsePair(fee) {
  if (!fee) return null;
  const f = String(fee);

  // (A) 「平日/週末 5,000円/日」「平日・週末：5,000円+（税）/日」= 平日と週末が同一表記でひとまとめ
  let m = f.match(/平日\s*[\/・]\s*週末\s*[：:]?\s*([\d,]+)\s*円/);
  if (m) return { wd: yen(m[1]), we: yen(m[1]), how: '平日週末まとめ表記' };

  // (B) 平日◯円 … 週末/土日祝/休日◯円 を個別に拾う
  const mw = f.match(/平日\s*[：:]?\s*([\d,]+)\s*円/);
  const mk = f.match(/(?:週末|土日祝|土日|休日)\s*[：:]?\s*([\d,]+)\s*円/);
  if (mw && mk) return { wd: yen(mw[1]), we: yen(mk[1]), how: '平日/週末 個別表記' };
  return null;
}

const both = [];
for (const p of pub) {
  const r = parsePair(p.fee);
  if (r) both.push({ title: p.title, pref: p.prefecture, ...r, fee: String(p.fee).split('\n')[0] });
}

console.log('■ 平日と週末の両方の金額が書かれた件数:', both.length);
const cheaper = both.filter(x => x.wd < x.we);
const equal   = both.filter(x => x.wd === x.we);
const higher  = both.filter(x => x.wd > x.we);
console.log('  平日が安い:', cheaper.length);
console.log('  同額      :', equal.length);
console.log('  平日が高い:', higher.length);

console.log('\n■ 同額の内訳（全件）');
for (const x of equal) console.log(`   [${x.pref}] ${x.title} … ${x.wd}/${x.we}  (${x.how})  fee="${x.fee}"`);
console.log('  都道府県:', JSON.stringify(equal.reduce((a,x)=>(a[x.pref]=(a[x.pref]||0)+1,a),{})));

console.log('\n■ 差額の分布（平日が安い件）');
const dist = {};
for (const x of cheaper) dist[x.we - x.wd] = (dist[x.we - x.wd] || 0) + 1;
for (const k of Object.keys(dist).sort((a,b)=>a-b)) console.log(`   ${k}円 … ${dist[k]}件`);

console.log('\n■ サンユーストアー（公開中）');
const sanyu = pub.filter(p => String(p.title).includes('サンユー'));
console.log('  店舗数:', sanyu.length);
for (const p of sanyu) console.log(`   ${p.title} … fee="${p.fee}"`);
const sanyuPriced = sanyu.filter(p => parsePair(p.fee));
console.log('  うち平日・週末の金額が書かれている:', sanyuPriced.length);
console.log('  金額なし:', sanyu.filter(p=>!parsePair(p.fee)).map(p=>p.title).join(', '));

// 同額がすべてサンユーか
console.log('\n  同額の全件がサンユーか:', equal.every(x => x.title.includes('サンユー')));
