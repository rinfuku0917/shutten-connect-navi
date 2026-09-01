// 週末列は「土日祝の額が明記されている案件だけ」で数えているはず（38件に合わせるため）。
// 一律料金（例「1日7,500円」）は平日列にだけ入り、週末列には入っていない、という読み方を検証する。
const W = [ // [名称, 週末額, 分類]
  ...Array.from({length:14},(_,i)=>[`サンユー(平日/週末 5,000円/日) #${i+1}`,5000,'固定']),
  ...Array.from({length:16},(_,i)=>[`Olympic(週末4,500円) #${i+1}`,4500,'固定']),
  ['MEGAドンキ高井戸(週末7,500)',7500,'固定'],
  ['イオンタウンふじみ野(土日祝8,000)',8000,'固定'],
  ['アクロスモール新鎌ヶ谷(土日祝9,000)',9000,'固定'],
  ['イオン八街(休日7,500)',7500,'固定'],
  ['イオンスタイル河辺(土日祝7,000)',7000,'固定'],
  ['イオンスタイル千葉みなと(土日祝6,500)',6500,'固定'],
  ['イオンスタイル南栗橋(土日祝7,500)',7500,'固定'],
  ['イオンモール与野(休日7,500)',7500,'併用'],
  ['イオンモール富谷(休日7,500)',7500,'併用'],
]
const med = a=>{const s=[...a].sort((x,y)=>x-y);const n=s.length;return n%2?s[(n-1)/2]:(s[n/2-1]+s[n/2])/2}
const dist= a=>{const d={};for(const v of a)d[v]=(d[v]||0)+1;return Object.entries(d).sort((x,y)=>x[0]-y[0]).map(([k,v])=>`${Number(k).toLocaleString()}:${v}`).join('  ')}
const all = W.map(r=>r[1]), pure = W.filter(r=>r[2]==='固定').map(r=>r[1])
console.log('週末・土日祝の額が明記されている案件だけを数えた場合')
console.log(`  全部（固定＋併用）: ${all.length}件 / 中央値 ${med(all).toLocaleString()}円 / 最低 ${Math.min(...all).toLocaleString()} / 最高 ${Math.max(...all).toLocaleString()}`)
console.log(`     ${dist(all)}`)
console.log(`  併用2件を除く      : ${pure.length}件 / 中央値 ${med(pure).toLocaleString()}円 / 最低 ${Math.min(...pure).toLocaleString()} / 最高 ${Math.max(...pure).toLocaleString()}`)
console.log(`     ${dist(pure)}`)
console.log('\n記事の週末行: 38件 / 中央値5,000 / 最低4,500 / 最高9,000 / 4,500円16件・5,000円13件')
console.log('→ サンユーを14件と数えると39件・5,000円14件になり、記事より1件多い（記事は13件）。')
console.log('→ いずれにせよ、週末列に入っている併用は「与野」「富谷」の2件。')
console.log(`→ したがって併用を除いた週末の件数は ${all.length-2}件（記事の38件を正とするなら36件）。指摘の「37件」とは一致しない。`)
