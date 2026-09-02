import fs from 'node:fs'
const pub = JSON.parse(fs.readFileSync('/private/tmp/claude-501/-Users-hidekifukusada-Desktop--------shutten-connect-navi/db7d6515-4023-44ab-9971-494a02f7a39c/scratchpad/pub.json', 'utf8'))

console.log('=== 110件すべての fee 記載 ===')
for (const p of pub.sort((a, b) => (a.prefecture || '').localeCompare(b.prefecture || ''))) {
  console.log([
    p.place_type === 'event' ? 'EV' : '常',
    (p.prefecture || '').padEnd(5),
    (p.title || '').slice(0, 30).padEnd(32),
    'fee=' + JSON.stringify(p.fee),
    'fx=' + p.company_fixed_amount,
    'pct=' + p.company_share_pct,
    'dtf=' + JSON.stringify(p.day_type_fees),
  ].join(' | '))
}
