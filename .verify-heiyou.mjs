import fs from 'node:fs';
const env = Object.fromEntries(fs.readFileSync('/Users/hidekifukusada/Desktop/コネクトナビ/shutten-connect-navi/.env.local','utf8').split('\n')
  .filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')];}));
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL, KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };
async function all(path){const out=[];let from=0;const size=500;for(;;){const r=await fetch(`${URL_}/rest/v1/${path}`,{headers:{...H,Range:`${from}-${from+size-1}`,'Range-Unit':'items'}});if(!r.ok)throw new Error(await r.text());const j=await r.json();out.push(...j);if(j.length<size)break;from+=size;}return out;}

const rows = await all('places?select=*&order=id');
console.log('places 全行:', rows.length);
const pub = rows.filter(r => r.status === 'published' && !r.closed);
console.log('公開中:', pub.length);

const z = (s) => String(s||'').replace(/[０-９]/g,c=>String.fromCharCode(c.charCodeAt(0)-0xfee0)).replace(/％/g,'%').replace(/，/g,',').replace(/＋/g,'+').replace(/\n/g,' ');
const yen = (f) => [...z(f).matchAll(/([\d,]{3,})\s*円/g)].map(m=>Number(m[1].replace(/,/g,'')));

// 1. 歩合(%)を含む案件
const pct = pub.filter(r => /\d+\s*%/.test(z(r.fee)));
console.log('\n■ fee に「%」を含む案件:', pct.length, '件  (記事の歩合53件と比較)');

// 2. 併用候補 = % と 円 の両方
const heiyou = pct.filter(r => yen(r.fee).length > 0);
console.log('\n■ 「%」と「円」の両方を含む＝併用候補:', heiyou.length, '件  (記事の併用9件と比較)');
for (const r of heiyou) console.log('   -', r.prefecture, r.title, '|', z(r.fee));

// 3. 料率別
const rate = {};
for (const r of pct) { const ms=[...new Set([...z(r.fee).matchAll(/(\d+)\s*%/g)].map(m=>m[1]))].join('/'); (rate[ms] ||= []).push(r.title); }
console.log('\n■ 料率別:'); for (const [k,v] of Object.entries(rate).sort((a,b)=>Number(a[0])-Number(b[0]))) console.log(`   ${k}% : ${v.length}件`);
console.log('   20%の中身 ->', (rate['20']||[]).join(' / '));

// 4. 平日/週末 両方に金額
const found = [];
for (const r of pub) {
  const f = z(r.fee);
  if (!/平日/.test(f)) continue;
  const sameFmt = /平日\s*[\/・]\s*週末[：:]?\s*([\d,]{3,})\s*円/.test(f) || /平日・週末[：:]\s*([\d,]{3,})\s*円/.test(f);
  const wd = [...f.matchAll(/平日[^\d]{0,8}([\d,]{3,})\s*円/g)].map(m=>Number(m[1].replace(/,/g,'')));
  const we = [...f.matchAll(/(?:週末|土日祝|土日|休日)[^\d]{0,8}([\d,]{3,})\s*円/g)].map(m=>Number(m[1].replace(/,/g,'')));
  found.push({ pref:r.prefecture, title:r.title, wd:wd[0], we:we[0], sameFmt, fee:f, isPct: /\d+\s*%/.test(f) });
}
console.log('\n■ fee に「平日」を含む案件:', found.length);
const diffs = {}; let same=0; const sameList=[];
for (const x of found) {
  if (x.sameFmt) { same++; sameList.push(x.title); continue; }
  if (x.wd==null || x.we==null) { console.log('   ※金額を両方取れず除外:', x.title, '|', x.fee); continue; }
  const d = x.we - x.wd;
  if (d===0) { same++; sameList.push(x.title); continue; }
  (diffs[d] ||= []).push(`${x.pref} ${x.title}${x.isPct?'  ★歩合を含む':''}`);
}
console.log('\n■ 差額の分布:');
for (const [d,v] of Object.entries(diffs).sort((a,b)=>a[0]-b[0])) { console.log(`   ${d}円 : ${v.length}件`); if (v.length<=4) v.forEach(t=>console.log('        -',t)); }
console.log(`   同額 : ${same}件`); sameList.forEach(t=>console.log('        -',t));
const tot = Object.values(diffs).reduce((a,b)=>a+b.length,0);
console.log(`\n   差あり ${tot}件 / 同額 ${same}件 / 合計 ${tot+same}件   (記事: 25 / 13 / 38)`);
const arr = Object.entries(diffs).flatMap(([d,v])=>v.map(()=>Number(d))).sort((a,b)=>a-b);
const med = a => a.length%2 ? a[(a.length-1)/2] : (a[a.length/2-1]+a[a.length/2])/2;
console.log('   中央値(全25件):', med(arr), '/ 5,500の2件を除く23件:', med(arr.filter(d=>d!==5500)));
// 系列を1件にまとめた場合
const collapsed = [...new Set(Object.entries(diffs).flatMap(([d,v])=>v.map(t=>`${d}|${/Olympic/.test(t)?'Olympic':t}`)))].map(s=>Number(s.split('|')[0])).sort((a,b)=>a-b);
console.log('   系列を1件に畳んだ場合:', collapsed.join(','), '→ 中央値', med(collapsed), '/ 5500除く →', med(collapsed.filter(d=>d!==5500)));
