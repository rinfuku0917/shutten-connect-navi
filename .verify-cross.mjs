import fs from 'node:fs'
const P = '/private/tmp/claude-501/-Users-hidekifukusada-Desktop--------shutten-connect-navi/db7d6515-4023-44ab-9971-494a02f7a39c/scratchpad/places.json'
const rows = JSON.parse(fs.readFileSync(P, 'utf8'))
const pub = rows.filter(r => r.status === 'published' && !r.closed)

// 都道府県分布（記事: 東京31/埼玉18/神奈川18/茨城17/千葉15/群馬3/愛知3/栃木2/兵庫1/熊本1/宮城1）
const pref = {}
for (const p of pub) pref[p.prefecture] = (pref[p.prefecture] || 0) + 1
console.log('=== 都道府県 ===')
console.log(Object.entries(pref).sort((a, b) => b[1] - a[1]).map(([k, v]) => k + ':' + v).join(' '))
console.log('記事: 東京31 埼玉18 神奈川18 茨城17 千葉15 群馬3 愛知3 栃木2 兵庫1 熊本1 宮城1')

// place_type 分布
const pt = {}
for (const p of pub) pt[p.place_type] = (pt[p.place_type] || 0) + 1
console.log('\n=== place_type ===', pt)

// おおみか店と兄弟店の全項目比較
const sanyu = pub.filter(p => (p.title || '').includes('サンユー'))
console.log('\n=== サンユー created_at / posted_at ===')
for (const p of sanyu.sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))) {
  console.log(String(p.created_at).slice(0, 19), '| posted=' + String(p.posted_at).slice(0, 10),
    '| pct=' + (p.company_share_pct || 0), '|', p.title)
}

const oo = pub.find(p => (p.title || '').includes('おおみか'))
const sib = pub.find(p => p.title.includes('千波'))
console.log('\n=== おおみか店 全項目 ===')
for (const k of Object.keys(oo)) {
  const a = JSON.stringify(oo[k]), b = JSON.stringify(sib[k])
  const mark = a === b ? '  同じ' : '≠ 千波店と違う'
  console.log(mark, k, '=', String(a).slice(0, 300))
}
console.log('\n=== 千波店(比較用) description ===')
console.log(String(sib.description).slice(0, 600))
console.log('\n=== 千波店 details ===', JSON.stringify(sib.details))
