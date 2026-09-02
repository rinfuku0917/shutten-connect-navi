import fs from 'node:fs'
const all = JSON.parse(fs.readFileSync('/private/tmp/claude-501/-Users-hidekifukusada-Desktop--------shutten-connect-navi/db7d6515-4023-44ab-9971-494a02f7a39c/scratchpad/places.json','utf8'))
const pub = all.filter(r=>r.status==='published' && !r.closed)
// hand-transcribed weekday/weekend pairs read off the fee text (first キッチンカー line where multi-line)
const pairs = [
 ['サンユーストアー 千波店',5000,5000],['サンユーストアー 磯原中央店　本店',5000,5000],['サンユーストアー秋山店',5000,5000],
 ['サンユーストアー 中郷店',5000,5000],['サンユーストアー 勝田店',5000,5000],['サンユーストアー まちなか大工町店',5000,5000],
 ['サンユーストアー 渡里店',5000,5000],['サンユーストアー 堀口店',5000,5000],['サンユーストアー 東町店',5000,5000],
 ['サンユーストアー おおみか店',5000,5000],['サンユーストアー 新鮎川店',5000,5000],['サンユーストアー 新手綱店',5000,5000],
 ['サンユーストアー 生鮮市場 ひたちなか店',5000,5000],['サンユーストアー 東多賀店',5000,5000],
 ['イオンタウンふじみ野',7000,8000],['アクロスモール新鎌ヶ谷',7000,9000],
 ['MEGAドン・キホーテ 高井戸店（旧Olympic 高井戸店）',5500,7500],
 ['【イオン八街店】　毎週月曜日〜日曜日',5000,7500],['【常設案件】イオンスタイル河辺',5000,7000],
 ['イオンスタイル千葉みなと',4500,6500],['イオンスタイル南栗橋',5000,7500],
 ...['太田','馬橋','三ノ輪','志村坂下','東川口','相模大塚','千葉東','所沢西','川崎鹿島田','小金井','瑞穂','藤沢','朝霞泉水','墨田文花','千葉桜木','国立'].map(n=>[`Olympic ${n}店`,3000,4500]),
 ['【常設案件】イオンモール与野',2000,7500],['イオンモール富谷（宮城）',2000,7500],
]
const med = a => {const s=[...a].sort((x,y)=>x-y); return s.length%2? s[(s.length-1)/2] : (s[s.length/2-1]+s[s.length/2])/2}
const hist = a => a.reduce((m,v)=>(m[v]=(m[v]||0)+1,m),{})
const fixedOnly = pairs.filter(p=>!/与野|富谷/.test(p[0]))
const differing = pairs.filter(p=>p[1]!==p[2])
const diffFixed = fixedOnly.filter(p=>p[1]!==p[2])
console.log('total pairs transcribed:', pairs.length)
console.log('  fixed-only (48内):', fixedOnly.length, ' equal:', fixedOnly.filter(p=>p[1]===p[2]).length, ' differing:', diffFixed.length)
console.log('\nARTICLE 25-set = differing incl. 与野/富谷 ->', differing.length)
console.log('  diff histogram:', JSON.stringify(hist(differing.map(p=>p[2]-p[1]))))
console.log('  median diff:', med(differing.map(p=>p[2]-p[1])))
console.log('\nIF 与野/富谷 removed -> n =', diffFixed.length)
console.log('  diff histogram:', JSON.stringify(hist(diffFixed.map(p=>p[2]-p[1]))))
console.log('  median diff:', med(diffFixed.map(p=>p[2]-p[1])))
console.log('\nMedians over the 48-fixed set (article table check):')
const wdv = fixedOnly.map(p=>p[1]), wev = fixedOnly.map(p=>p[2])
console.log('  weekday median/min/max among these 37:', med(wdv), Math.min(...wdv), Math.max(...wdv))
console.log('  weekend median/min/max among these 37:', med(wev), Math.min(...wev), Math.max(...wev))
console.log('\nIncluding 与野/富谷 the weekday MIN would be:', Math.min(...pairs.map(p=>p[1])))
