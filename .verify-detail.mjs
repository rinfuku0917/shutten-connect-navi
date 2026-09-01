import fs from 'node:fs';
const all = JSON.parse(fs.readFileSync(new URL('./.verify-places.json', import.meta.url), 'utf8'));
const live = all.filter((p) => p.status === 'published' && !p.closed);

for (const key of ['地域猫マルシェ', '美食EXPO', '放課後等デイサービス', '尼涼祭', 'まちかどスペース', 'イオンモール与野', 'イオンモール富谷']) {
  const p = live.find((x) => (x.title || '').includes(key));
  if (!p) continue;
  console.log(`\n### ${p.title}  (type=${p.place_type})`);
  console.log('  fee:', JSON.stringify(p.fee));
  console.log('  recruit:', JSON.stringify(p.recruit));
  console.log('  desc:', JSON.stringify((p.description || '').slice(0, 400)));
}

// 同じ会場が重複掲載されていないか
const norm = (t) => (t || '').replace(/[【】\s　（）()]/g, '').replace(/【.*?】/g, '');
const groups = {};
for (const p of live) {
  const k = norm(p.title).replace(/\d+月.*$|スケジュール.*$|学内.*$|生田キャンパス.*$|急募.*$/g, '').slice(0, 10);
  (groups[k] ||= []).push(p.title);
}
console.log('\n=== 同一会場が複数掲載されている可能性 ===');
for (const [k, v] of Object.entries(groups)) if (v.length > 1 && !/Olympic|サンユー/.test(k)) console.log(` ${k} → ${v.length}件: ${v.join(' / ')}`);
