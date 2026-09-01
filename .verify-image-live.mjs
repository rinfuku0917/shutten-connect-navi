import fs from 'node:fs'
const html = fs.readFileSync('/private/tmp/claude-501/-Users-hidekifukusada-Desktop--------shutten-connect-navi/db7d6515-4023-44ab-9971-494a02f7a39c/scratchpad/live.html', 'utf8')

// JSON-LD を全部拾ってパースする
const blocks = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1])
console.log('JSON-LD ブロック数:', blocks.length)
for (const b of blocks) {
  let o
  try { o = JSON.parse(b) } catch (e) { console.log('  パース失敗:', e.message); continue }
  const t = o['@type']
  console.log(`\n--- @type=${t} ---`)
  if (t === 'Article') {
    console.log('  キー:', Object.keys(o).join(', '))
    console.log('  image プロパティ有無:', 'image' in o, '/ 値:', JSON.stringify(o.image))
    console.log('  headline:', o.headline)
  }
}

// og:image / twitter:image
for (const p of ['og:image', 'twitter:image', 'og:title']) {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${p}["'][^>]*>`, 'g')
  console.log(`\n${p}:`, (html.match(re) || []).join(' | ') || '(なし)')
}

// 本文領域の画像
const bodyM = html.match(/class="post-body"[\s\S]*?(?=<div style="margin-top:48px|RelatedPlaces|出店場所をお探し)/)
const body = bodyM ? bodyM[0] : ''
console.log('\n本文(post-body)内の <img> 数:', (body.match(/<img/g) || []).length)
console.log('ページ全体の <img> 数:', (html.match(/<img/g) || []).length)
const srcs = [...html.matchAll(/<img[^>]+src=["']([^"']+)["']/g)].map(m => m[1])
console.log('ページ全体の img src（先頭10件）:')
srcs.slice(0, 10).forEach(s => console.log('  -', s.slice(0, 110)))

// canonical / h1
console.log('\ncanonical:', (html.match(/<link[^>]+rel=["']canonical["'][^>]*>/) || ['(なし)'])[0])
console.log('h1 の数:', (html.match(/<h1/g) || []).length)
