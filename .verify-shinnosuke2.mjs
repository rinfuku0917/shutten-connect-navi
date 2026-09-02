import fs from 'node:fs'
const open = JSON.parse(fs.readFileSync(new URL('.verify-shinnosuke-open.json', import.meta.url), 'utf8'))

const isSuper = p => /スーパー|食品館|マート|マーケット|生鮮|食品店/.test(`${p.title} ${p.description ?? ''} ${p.address ?? ''}`)
const sup = open.filter(isSuper)
console.log('スーパーらしき案件:', sup.length)

// 会社（系列）ごとに host_id でまとめる
const byHost = {}
for (const p of sup) (byHost[p.host_id] ??= []).push(p)
for (const [host, rows] of Object.entries(byHost).sort((a, b) => b[1].length - a[1].length)) {
  const dates = rows.map(r => (r.posted_at ?? r.created_at ?? '').slice(0, 10)).sort()
  const created = rows.map(r => (r.created_at ?? '').slice(0, 10)).sort()
  const fees = [...new Set(rows.map(r => `fixed=${r.price_fixed} share=${r.price_share_pct} day=${JSON.stringify(r.day_type_fees)}`))]
  console.log('---')
  console.log('host', host.slice(0, 8), '件数', rows.length)
  console.log('  タイトル例:', rows.slice(0, 3).map(r => r.title).join(' / '))
  console.log('  created_at 最初/最後:', created[0], created[created.length - 1], '種類:', [...new Set(created)].join(','))
  console.log('  posted_at 最初/最後:', dates[0], dates[dates.length - 1])
  console.log('  place_type:', [...new Set(rows.map(r => r.place_type))].join(','))
  console.log('  条件の種類:', fees.length)
  fees.forEach(f => console.log('    ', f))
}
