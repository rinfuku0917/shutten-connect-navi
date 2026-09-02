import fs from 'node:fs';
const env = Object.fromEntries(fs.readFileSync('/Users/hidekifukusada/Desktop/コネクトナビ/shutten-connect-navi/.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')];}));
const U = env.NEXT_PUBLIC_SUPABASE_URL, K = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// 1000行打ち切り対策: 500件ずつ range でページング
const rows = [];
const STEP = 500;
for (let from = 0; ; from += STEP) {
  const r = await fetch(`${U}/rest/v1/places?select=*&order=id.asc`, {
    headers: { apikey: K, Authorization: `Bearer ${K}`, Range: `${from}-${from + STEP - 1}`, 'Range-Unit': 'items' }
  });
  const j = await r.json();
  if (!Array.isArray(j)) { console.error('ERR', JSON.stringify(j)); break; }
  rows.push(...j);
  if (j.length < STEP) break;
}
console.log('places 全行:', rows.length);
const ids = new Set(rows.map(r => r.id));
console.log('id ユニーク数:', ids.size, '(重複なし=' + (ids.size === rows.length) + ')');

const pub = rows.filter(p => p.status === 'published' && p.closed !== true);
console.log('published かつ closed でない:', pub.length);
console.log('status の内訳:', JSON.stringify(rows.reduce((a,r)=>(a[r.status]=(a[r.status]||0)+1,a),{})));
console.log('closed の内訳:', JSON.stringify(rows.reduce((a,r)=>(a[String(r.closed)]=(a[String(r.closed)]||0)+1,a),{})));

fs.writeFileSync('/private/tmp/claude-501/-Users-hidekifukusada-Desktop--------shutten-connect-navi/db7d6515-4023-44ab-9971-494a02f7a39c/scratchpad/pub-hanshou.json', JSON.stringify(pub, null, 1));

// day_type_fees を確認
let n = 0;
for (const p of pub) {
  const v = p.day_type_fees;
  if (v != null && JSON.stringify(v) !== '[]' && JSON.stringify(v) !== '{}' && JSON.stringify(v) !== 'null') n++;
}
console.log('day_type_fees が非空の件数:', n);
