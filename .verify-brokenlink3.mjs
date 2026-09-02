const BASE='https://app.connect-navi.com'
// 404ページから記事に戻れるか
const h = await (await fetch(BASE+'/blog/kitchen-car-required-documents')).text()
const links = [...new Set([...h.matchAll(/<a[^>]+href="(\/[^"]*)"/g)].map(m=>m[1]))]
console.log('404ページ内のリンク:', JSON.stringify(links))
console.log('404ページから /blog へ戻れる:', links.some(l=>l==='/blog'||l.startsWith('/blog')))

// 代替になりうる公開済みの書類系記事
for (const s of ['kitchen-car-business-license','first-food-truck-checklist']) {
  const r = await fetch(`${BASE}/blog/${s}`)
  const t = await r.text()
  const title = (t.match(/<title[^>]*>([\s\S]*?)<\/title>/)||[])[1]
  const body = t.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ')
  const kw = ['営業許可','PL保険','食品衛生責任者','損害賠償'].filter(k=>body.includes(k))
  console.log(`\n[${s}] ${r.status} title="${title}"`)
  console.log(`  書類系キーワード: ${JSON.stringify(kw)}`)
}
