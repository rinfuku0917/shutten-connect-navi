import fs from 'node:fs'
const R='/Users/hidekifukusada/Desktop/コネクトナビ/shutten-connect-navi/'
const posts=JSON.parse(fs.readFileSync(R+'.verify-posts.json','utf8'))
const P=s=>posts.find(p=>p.slug===s)

for(const s of ['food-truck-fee-guide','host-fee-setting-guide2','host-fee-setting-guide']){
  const p=P(s)
  console.log(`\n===== ${s} =====`)
  console.log('title:', p.title)
  console.log('category:', p.category, '| target_keyword:', JSON.stringify(p.target_keyword))
  console.log('meta_description:', p.meta_description)
  console.log('--- 本文中のリンク ---')
  const links=[...p.content.matchAll(/\[([^\]]*)\]\(([^)]*)\)/g)]
  if(!links.length) console.log('   （なし）')
  links.forEach(m=>console.log(`   「${m[1]}」 → ${m[2]}`))
  console.log('--- 末尾400字 ---')
  console.log(p.content.slice(-400).replace(/\n/g,' / '))
}

// 相互リンクの有無
console.log('\n===== 相互リンク判定 =====')
const a=P('food-truck-fee-guide').content, b=P('host-fee-setting-guide2').content
console.log('新記事 → host2 へのリンク:', a.includes('host-fee-setting-guide2'))
console.log('host2 → 新記事へのリンク:', b.includes('food-truck-fee-guide'))

// 他記事から2本へのリンク数
console.log('\n===== 他記事からの被リンク =====')
for(const target of ['food-truck-fee-guide','host-fee-setting-guide2']){
  const from=posts.filter(p=>p.slug!==target && new RegExp(`/blog/${target}(?![\\w-])`).test(p.content))
  console.log(`  ${target}: ${from.length}本 ${from.map(p=>p.slug).join(', ')||'（なし）'}`)
}
