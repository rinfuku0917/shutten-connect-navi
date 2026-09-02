import fs from 'node:fs'
const open = JSON.parse(fs.readFileSync(new URL('.verify-shinnosuke-open.json', import.meta.url), 'utf8'))
const rows = open.map(p => ({
  t: p.title,
  pref: p.prefecture,
  type: p.place_type,
  fee: p.fee,
  fixed: p.price_fixed,
  share: p.price_share_pct,
  day: p.day_type_fees ? JSON.stringify(p.day_type_fees) : '',
  created: (p.created_at ?? '').slice(0, 10),
  posted: (p.posted_at ?? '').slice(0, 10),
  open_days: p.open_days,
}))
rows.sort((a, b) => (a.t ?? '').localeCompare(b.t ?? '', 'ja'))
for (const r of rows) {
  console.log([r.t, r.pref, r.type, `fee=${r.fee}`, `fixed=${r.fixed}`, `share=${r.share}`, r.day, `c=${r.created}`, `p=${r.posted}`, `days=${JSON.stringify(r.open_days)}`].join(' | '))
}
