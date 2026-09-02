import fs from 'node:fs'
const P = '/private/tmp/claude-501/-Users-hidekifukusada-Desktop--------shutten-connect-navi/db7d6515-4023-44ab-9971-494a02f7a39c/scratchpad/places.json'
const rows = JSON.parse(fs.readFileSync(P, 'utf8'))
const pub = rows.filter(r => r.status === 'published' && !r.closed)

const sanyu = rows.filter(r => (r.title || '').includes('サンユー'))
console.log('=== サンユー全件 (published/closed 問わず):', sanyu.length)
for (const p of sanyu) {
  console.log([
    p.title,
    'status=' + p.status,
    'closed=' + p.closed,
    'host=' + String(p.host_id).slice(0, 8),
    'price_fixed=' + p.price_fixed,
    'price_share_pct=' + p.price_share_pct,
    'company_fixed=' + p.company_fixed_amount,
    'company_share_pct=' + p.company_share_pct,
    'fixed_unit=' + p.place_fixed_unit + '/' + p.company_fixed_unit,
    'fee=' + JSON.stringify(p.fee),
    'day_type_fees=' + JSON.stringify(p.day_type_fees),
  ].join(' | '))
}
