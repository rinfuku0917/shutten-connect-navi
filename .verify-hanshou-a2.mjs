import fs from 'node:fs';
const pub = JSON.parse(fs.readFileSync('/private/tmp/claude-501/-Users-hidekifukusada-Desktop--------shutten-connect-navi/db7d6515-4023-44ab-9971-494a02f7a39c/scratchpad/pub-hanshou.json','utf8'));

console.log('=== day_type_fees 非空 ===');
for (const p of pub) {
  const v = p.day_type_fees;
  if (v != null && JSON.stringify(v) !== '[]' && JSON.stringify(v) !== '{}') {
    console.log(`${p.title} | ${p.prefecture} | ${JSON.stringify(v)}`);
  }
}

console.log('\n\n=== fee 全110件 ===');
let i = 0;
for (const p of pub.slice().sort((a,b)=>String(a.title).localeCompare(String(b.title),'ja'))) {
  i++;
  console.log(`${String(i).padStart(3)}. [${p.prefecture}] ${p.title}`);
  console.log(`     fee = ${JSON.stringify(p.fee)}`);
}
