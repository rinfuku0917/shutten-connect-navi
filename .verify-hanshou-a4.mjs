import fs from 'node:fs';
const pub = JSON.parse(fs.readFileSync('/private/tmp/claude-501/-Users-hidekifukusada-Desktop--------shutten-connect-navi/db7d6515-4023-44ab-9971-494a02f7a39c/scratchpad/pub-hanshou.json','utf8'));

console.log('■ サンユー各店の作成/掲載日時');
for (const p of pub.filter(p=>String(p.title).includes('サンユー')).sort((a,b)=>String(a.created_at).localeCompare(String(b.created_at)))) {
  console.log(`  created=${p.created_at} posted=${p.posted_at} closed=${p.closed} | ${p.title}`);
}

console.log('\n■ 公開中110件の created_at 最新5件（記事執筆後に増えていないか）');
for (const p of pub.slice().sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))).slice(0,5)) {
  console.log(`  ${p.created_at} | ${p.title}`);
}

// fee-guide の固定額分布を独立に再現する
const yen = s => Number(String(s).replace(/,/g,''));
function fees(fee) {
  if (!fee) return null;
  const f = String(fee);
  let m = f.match(/平日\s*[\/・]\s*週末\s*[：:]?\s*([\d,]+)\s*円/);
  if (m) return { wd: yen(m[1]), we: yen(m[1]) };
  const mw = f.match(/平日\s*[：:]?\s*([\d,]+)\s*円/);
  const mk = f.match(/(?:週末|土日祝|土日|休日)\s*[：:]?\s*([\d,]+)\s*円/);
  if (mw && mk) return { wd: yen(mw[1]), we: yen(mk[1]) };
  // 単価が1つだけ（1日◯円）= 平日も週末も同額として扱う
  const flat = f.match(/(?:^|[^%＋+])(?:1日|１日|一日)\s*[：:]?\s*([\d,]+)\s*円/);
  if (flat && !/%|％/.test(f)) return { wd: yen(flat[1]), we: yen(flat[1]), flat: true };
  return null;
}
const wdCount = {}, weCount = {};
const wdList = {}, weList = {};
for (const p of pub) {
  const r = fees(p.fee);
  if (!r) continue;
  wdCount[r.wd] = (wdCount[r.wd]||0)+1; (wdList[r.wd] ||= []).push(p.title);
  weCount[r.we] = (weCount[r.we]||0)+1; (weList[r.we] ||= []).push(p.title);
}
console.log('\n■ 平日額の分布（1日◯円の定額も平日・週末の両方に計上）');
for (const k of Object.keys(wdCount).sort((a,b)=>a-b)) console.log(`   ${k}円 … ${wdCount[k]}件`);
console.log('\n■ 週末額の分布');
for (const k of Object.keys(weCount).sort((a,b)=>a-b)) console.log(`   ${k}円 … ${weCount[k]}件`);
console.log('\n■ 平日5,000円の内訳:'); (wdList[5000]||[]).forEach(t=>console.log('   -',t));
console.log('\n■ 週末5,000円の内訳:'); (weList[5000]||[]).forEach(t=>console.log('   -',t));
