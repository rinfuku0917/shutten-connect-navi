import fs from 'node:fs'
const R='/Users/hidekifukusada/Desktop/コネクトナビ/shutten-connect-navi/'
const posts=JSON.parse(fs.readFileSync(R+'.verify-posts.json','utf8'))
const P=s=>posts.find(p=>p.slug===s)

for(const s of ['food-truck-fee-guide','host-fee-setting-guide2']){
  const p=P(s)
  const body=p.content.replace(/!\[[^\]]*\]\([^)]*\)/g,'').replace(/^\s+/,'')
  console.log(`\n########## ${s} ##########`)
  console.log('【タイトル】', p.title)
  console.log('【meta_desc】', p.meta_description)
  console.log('【本文の書き出し200字】')
  console.log('   ', body.replace(/\n+/g,' ').slice(0,200))
  console.log('【読者を示す語の出現回数】')
  const words=['貸す','借り','オーナー','募集者','施設','スペース','出店者','出店する','応募','事業者','主催']
  console.log('   ', words.map(w=>`${w}:${(p.content.match(new RegExp(w,'g'))||[]).length}`).join('  '))
}

// 読者語の偏りスコア
console.log('\n===== 読者の向きの偏り =====')
const host=['貸す','貸し','オーナー','募集者','設定し','集客力'], guest=['応募','出店者','払う','払い','手元に残']
for(const s of ['food-truck-fee-guide','host-fee-setting-guide2']){
  const c=P(s).content
  const h=host.reduce((a,w)=>a+(c.match(new RegExp(w,'g'))||[]).length,0)
  const g=guest.reduce((a,w)=>a+(c.match(new RegExp(w,'g'))||[]).length,0)
  console.log(`  ${s.padEnd(24)} 貸す側語=${h}  払う側語=${g}  → ${h>g?'貸す側':'払う側'}向け`)
}

// タイトル内で読者が判別できる位置
console.log('\n===== タイトルのどこで読者が分かるか =====')
for(const s of ['food-truck-fee-guide','host-fee-setting-guide2']){
  const t=P(s).title
  const marks=['場所を貸す側','相場','募集中','料金設定']
  marks.forEach(m=>{ const i=t.indexOf(m); if(i>=0) console.log(`  ${s}: 「${m}」は${i+1}文字目〜（全${t.length}字）`) })
}
