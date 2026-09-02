const B='https://app.connect-navi.com'
const src='https://mieflxcdthcpyrysfahs.supabase.co/storage/v1/object/public/blog-images/posts/auto-1787788913729.png'
for (const [w,q] of [[256,70],[256,75],[96,75],[828,75]]) {
  const u=`${B}/_next/image?url=${encodeURIComponent(src)}&w=${w}&q=${q}`
  const r=await fetch(u,{headers:{Accept:'image/webp,image/*'}})
  const t=r.headers.get('content-type')||''
  const body=t.startsWith('text')? (await r.text()).slice(0,90) : `${((await r.arrayBuffer()).byteLength/1024).toFixed(0)}KB`
  console.log(`w=${w} q=${q} → ${r.status} ${t.split(';')[0]}  ${body}`)
}
