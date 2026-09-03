import fs from 'fs'
const posts = JSON.parse(fs.readFileSync('/private/tmp/claude-501/-Users-hidekifukusada-Desktop--------shutten-connect-navi/db7d6515-4023-44ab-9971-494a02f7a39c/scratchpad/posts.json','utf8'))
const merged = ['how-to-find-food-truck-spots','auto-mtarczbg-37pazo','auto-mtgh64lh-jwwkxe','auto-mta8z1w9-vazfy1','choose-profitable-food-truck-location','host-fee-setting-guide2','event-food-truck-guide']
const live = posts.filter(p=>p.status==='published' && !merged.includes(p.slug))
console.log('サイトマップ/一覧に出る記事 =', live.length, '本')
console.log('  host-fee-setting-guide は含まれるか →', live.some(p=>p.slug==='host-fee-setting-guide'))
console.log('  regular-event-schedule は含まれるか →', live.some(p=>p.slug==='regular-event-schedule'))

const mall = fs.readFileSync('docs/blog/mall-food-truck-event.md','utf8')
const mallBody = mall.replace(/^---[\s\S]*?\n---\n/,'')

// 語の出現数（別の数え方：キーワード語ごとの出現）
const terms = ['催事','商業施設','オフィスビル','出店料','固定','歩合','併用','常設','単発','台数','フードコート','消防','ジャンル','定期開催','曜日']
const targets = {
  'host-fee-setting-guide': posts.find(p=>p.slug==='host-fee-setting-guide'),
  'regular-event-schedule': posts.find(p=>p.slug==='regular-event-schedule'),
  'how-to-invite-kitchen-car': posts.find(p=>p.slug==='how-to-invite-kitchen-car'),
  'renting-parking-space': posts.find(p=>p.slug==='renting-parking-space'),
  'supermarket-food-truck': posts.find(p=>p.slug==='supermarket-food-truck'),
}
console.log('\n=== 語の出現回数（本文）===')
console.log(['語'.padEnd(12), 'mall(原稿)', ...Object.keys(targets).map(k=>k.slice(0,14))].join(' | '))
for (const t of terms) {
  const cnt = s => (String(s).match(new RegExp(t,'g'))||[]).length
  console.log([t.padEnd(12), String(cnt(mallBody)).padStart(9),
    ...Object.entries(targets).map(([,p])=>String(cnt(p?.content??'')).padStart(14))].join(' | '))
}

// 見出し比較
console.log('\n=== 見出し ===')
const heads = s => (String(s).match(/^#{2,3} .*/gm)||[])
console.log('--- mall-food-truck-event（原稿）')
heads(mallBody).forEach(h=>console.log('   '+h))
for (const [k,p] of Object.entries(targets)) {
  if (k!=='host-fee-setting-guide' && k!=='regular-event-schedule') continue
  console.log(`--- ${k}`)
  heads(p.content).forEach(h=>console.log('   '+h))
}

// 文字数（別の数え方：本文から画像・リンク記法・記号を落として数える）
const chars = s => String(s)
  .replace(/!\[[^\]]*\]\([^)]*\)/g,'')
  .replace(/\[([^\]]*)\]\([^)]*\)/g,'$1')
  .replace(/[#*|>`\-\s]/g,'').length
console.log('\n=== 文字数（自分の数え方：記号と空白を除く）===')
console.log('  mall-food-truck-event(原稿) =', chars(mallBody))
for (const [k,p] of Object.entries(targets)) console.log(`  ${k} = ${chars(p?.content)}`)

// 被リンク：公開中の記事から host-fee-setting-guide / regular-event-schedule へのリンク
console.log('\n=== 内部リンク（公開記事の本文にある /blog/ リンク先の集計）===')
const linkCount = {}
for (const p of live) {
  for (const m of String(p.content).matchAll(/\/blog\/([a-z0-9-]+)/g)) {
    linkCount[m[1]] = (linkCount[m[1]]||0)+1
  }
}
// 原稿ぶんも足す（mall と supermarket は原稿が正）
for (const f of ['mall-food-truck-event','supermarket-food-truck']) {
  const src = fs.readFileSync(`docs/blog/${f}.md`,'utf8')
  for (const m of src.matchAll(/\/blog\/([a-z0-9-]+)/g)) linkCount['(原稿)'+m[1]] = (linkCount['(原稿)'+m[1]]||0)+1
}
console.log(Object.entries(linkCount).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`  ${k}: ${v}`).join('\n'))
console.log('\n  host-fee-setting-guide への被リンク =', linkCount['host-fee-setting-guide']||0)
console.log('  regular-event-schedule への被リンク =', linkCount['regular-event-schedule']||0)
console.log('  host-fee-setting-guide から出るリンク =',
  [...String(targets['host-fee-setting-guide'].content).matchAll(/\/blog\/[a-z0-9-]+/g)].map(m=>m[0]))
