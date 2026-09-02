const BASE='https://app.connect-navi.com'
const PUB=['food-truck-fee-guide','kitchen-car-location-guide','renting-parking-space']
const TARGET='/blog/kitchen-car-required-documents'

// A. 公開中3本の「実際に配信されるHTML」に <a href> として出ているか
for (const s of PUB) {
  const r = await fetch(`${BASE}/blog/${s}`, {redirect:'manual'})
  const h = await r.text()
  const anchors = [...h.matchAll(/<a[^>]+href="([^"]*kitchen-car-required-documents[^"]*)"[^>]*>([\s\S]{0,60}?)<\/a>/g)]
  console.log(`\n[${s}] HTTP ${r.status}`)
  console.log(`  レンダ後HTMLの<a>: ${anchors.length}件`)
  anchors.forEach(a=>console.log(`    href="${a[1]}" text="${a[2].replace(/<[^>]*>/g,'')}"`))
  // 前後の文（読者が何を約束されているか）
  const i = h.indexOf('kitchen-car-required-documents')
  if (i>0) console.log('  周辺:', h.slice(Math.max(0,i-230), i+120).replace(/<[^>]*>/g,'').replace(/\s+/g,' ').trim())
}

// B. リンク先の実応答（リダイレクト追跡なし／ありの両方）
for (const mode of ['manual','follow']) {
  const r = await fetch(BASE+TARGET, {redirect:mode})
  const h = await r.text()
  const title = (h.match(/<title[^>]*>([\s\S]*?)<\/title>/)||[])[1]
  const robots = (h.match(/<meta name="robots" content="([^"]*)"/)||[])[1]
  console.log(`\n[リンク先 redirect=${mode}] HTTP ${r.status} url=${r.url}`)
  console.log(`  title="${title}" robots="${robots}" location=${r.headers.get('location')}`)
  console.log(`  本文に「見つかりません」: ${h.includes('見つかりません')}`)
}

// C. sitemap に入っているか（=公開扱いされているか）
const sm = await (await fetch(BASE+'/sitemap.xml')).text()
console.log(`\n[sitemap] 総URL数 ${(sm.match(/<loc>/g)||[]).length}`)
console.log(`  対象slugを含む: ${sm.includes('kitchen-car-required-documents')}`)
console.log(`  ブログURL一覧: ${JSON.stringify([...sm.matchAll(/<loc>[^<]*\/blog\/([^<]+)<\/loc>/g)].map(m=>m[1]))}`)

// D. 記事一覧ページに対象が出ているか
const bl = await (await fetch(BASE+'/blog')).text()
console.log(`\n[/blog 一覧] 対象slugを含む: ${bl.includes('kitchen-car-required-documents')}`)
