const B='https://app.connect-navi.com'
const h = await (await fetch(B+'/blog')).text()
const opt = [...new Set([...h.matchAll(/src="(\/_next\/image[^"]*)"/g)].map(m=>m[1].replace(/&amp;/g,'&')))]
for (const u of opt.slice(0,3)) {
  const r = await fetch(B+u, { headers:{ Accept:'image/webp,image/*' } })
  const b = (await r.arrayBuffer()).byteLength
  console.log(r.status, r.headers.get('content-type'), b, 'bytes')
  console.log('   ', decodeURIComponent(u).slice(0,120))
}
console.log('\n--- トップページに記事セクションがあるか ---')
const top = await (await fetch(B)).text()
console.log('「最新記事」等の文言:', /お役立ち|最新記事|ブログ/.test(top) ? 'あり' : 'なし')
console.log('/blog/ へのリンク:', (top.match(/href="\/blog\/[a-z-]+"/g)||[]).length, '本')
