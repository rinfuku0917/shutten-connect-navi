import fs from 'node:fs'
const pub = JSON.parse(fs.readFileSync('/private/tmp/claude-501/-Users-hidekifukusada-Desktop--------shutten-connect-navi/db7d6515-4023-44ab-9971-494a02f7a39c/scratchpad/pub.json','utf8'))
const withTax = pub.filter(p => /税/.test(p.fee || ''))
console.log('fee に「税」を含む:', withTax.length, '/ 110')
console.log('税別/税込/＋税 などの明記:', pub.filter(p => /税別|税込|税抜|\+\s*税|＋税|（税）|\(税\)/.test(p.fee||'')).length)
console.log('share_tax_basis 分布:', pub.reduce((m,p)=>(m[p.share_tax_basis??'null']=(m[p.share_tax_basis??'null']||0)+1,m),{}))
// スーパー35の内訳確認
const superNames = p => /Olympic|サンユー|さがみや|あさの|ガッツ|ドン・キホーテ/.test(p.title)
const sup = pub.filter(superNames)
console.log('\nOlympic/サンユー/さがみや/あさの/ガッツ/ドンキ:', sup.length)
console.log('  うち place_type=event:', sup.filter(p=>p.place_type==='event').length)
console.log('イオンリテール新井宿:', pub.filter(p=>/新井宿/.test(p.title)).map(p=>[p.title,p.fee,p.place_type]))
