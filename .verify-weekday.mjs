import fs from 'node:fs'
const pub = JSON.parse(fs.readFileSync('/private/tmp/claude-501/-Users-hidekifukusada-Desktop--------shutten-connect-navi/db7d6515-4023-44ab-9971-494a02f7a39c/scratchpad/pub.json','utf8'))
const both = pub.filter(p => /平日/.test(p.fee||'') && /週末|土日|休日|祝/.test(p.fee||''))
console.log('fee本文に「平日」と「週末/土日/休日/祝」の両方が出る案件:', both.length)
let i=0
for (const p of both) console.log(String(++i).padStart(3), '|', (p.prefecture||'').padEnd(5), '|', p.title.slice(0,26).padEnd(28), '|', (p.fee||'').split('\n')[0].slice(0,60))
