const B='https://app.connect-navi.com'
for (const page of ['/blog','/']) {
  const h = await (await fetch(B+page)).text()
  const opt = [...new Set([...h.matchAll(/src="(\/_next\/image[^"]*)"/g)].map(m=>m[1].replace(/&amp;/g,'&')))]
  const raw = [...new Set([...h.matchAll(/src="(https:\/\/mieflxcdthcpyrysfahs[^"]*)"/g)].map(m=>m[1]))]
  let optB=0
  for (const u of opt) { const r=await fetch(B+u,{headers:{Accept:'image/webp,image/*'}}); optB += (await r.arrayBuffer()).byteLength }
  let rawB=0
  for (const u of raw) { const r=await fetch(u); rawB += (await r.arrayBuffer()).byteLength }
  console.log(`${page}`)
  console.log(`  変換ずみ ${opt.length}枚 : ${(optB/1024).toFixed(0)} KB`)
  console.log(`  元のまま ${raw.length}枚 : ${(rawB/1048576).toFixed(2)} MB`)
  if (opt[0]) console.log(`  例: ${opt[0].slice(0,90)}…`)
}
