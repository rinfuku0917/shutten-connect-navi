import fs from 'node:fs'
const pub = JSON.parse(fs.readFileSync('.verify-datecheck-places.json','utf8'))
const ts = pub.map(p=>p.created_at).sort()
console.log('公開中110件の created_at 最古:', ts[0])
console.log('公開中110件の created_at 最新:', ts[ts.length-1])
const POST_PUB = '2026-07-15T02:50:54'
console.log('記事の公開時刻(2026-07-15T02:50:54Z)より後に作られた公開中案件:', pub.filter(p=>p.created_at > POST_PUB).length, '/110')
console.log('8月以降に作られた公開中案件:', pub.filter(p=>p.created_at >= '2026-08-01').length)
// 自前の出店料分類（記事の 50/44/9/7 と突き合わせる）
let fixed=0, share=0, both=0, none=0
for (const p of pub) {
  const hasShare = (p.price_share_pct != null && Number(p.price_share_pct) > 0) || (p.company_share_pct != null && Number(p.company_share_pct) > 0)
  const dayFee = p.day_type_fees && typeof p.day_type_fees === 'object' && Object.values(p.day_type_fees).some(v => Number(v) > 0)
  const hasFixed = (p.price_fixed != null && Number(p.price_fixed) > 0) || (p.company_fixed_amount != null && Number(p.company_fixed_amount) > 0) || dayFee
  if (hasFixed && hasShare) both++
  else if (hasFixed) fixed++
  else if (hasShare) share++
  else none++
}
console.log('自前分類 → 固定のみ:', fixed, '/ 歩合のみ:', share, '/ 併用:', both, '/ 記載なし:', none, '= 合計', fixed+share+both+none)
console.log('（記事の表は 固定50・歩合44・併用9・応相談7）')
// 仮に「7/15時点」に存在した公開中案件は何件か
for (const d of ['2026-07-15','2026-07-16','2026-08-01','2026-09-01']) {
  console.log(`${d} 以前に作成済み（かつ現在も公開中）の件数:`, pub.filter(p=>p.created_at < d+'T00:00:00').length)
}
