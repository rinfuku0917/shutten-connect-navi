import fs from 'node:fs'
const R='/Users/hidekifukusada/Desktop/コネクトナビ/shutten-connect-navi/'
const posts=JSON.parse(fs.readFileSync(R+'.verify-posts.json','utf8'))
const norm=s=>s.replace(/!\[[^\]]*\]\([^)]*\)/g,'').replace(/\[([^\]]*)\]\([^)]*\)/g,'$1')
  .replace(/`[^`]*`/g,'').replace(/[*_#>|~\-]/g,'').replace(/\s+/g,'')
const grams=(s,n)=>{const S=new Set();for(let i=0;i+n<=s.length;i++)S.add(s.slice(i,i+n));return S}
const cont=(a,b,n)=>{const A=grams(a,n),B=grams(b,n);if(!A.size)return 0;return [...A].filter(g=>B.has(g)).length/A.size*100}

const body=Object.fromEntries(posts.map(p=>[p.slug,norm(p.content)]))

// --- 全ペアの本文12-gram重なり（対称: max方向）
const rows=[]
for(let i=0;i<posts.length;i++)for(let j=i+1;j<posts.length;j++){
  const a=posts[i],b=posts[j]
  const v=Math.max(cont(body[a.slug],body[b.slug],12), cont(body[b.slug],body[a.slug],12))
  rows.push({pair:`${a.slug} × ${b.slug}`, v, sameCat:a.category===b.category})
}
rows.sort((x,y)=>y.v-x.v)
console.log('===== 本文12-gram 重なり 上位15ペア（全136ペア中）=====')
rows.slice(0,15).forEach((r,i)=>console.log(`${String(i+1).padStart(2)}. ${r.v.toFixed(1)}%  ${r.pair}${r.sameCat?'  [同カテゴリ]':''}`))
const target=rows.find(r=>r.pair.includes('food-truck-fee-guide ×')&&r.pair.includes('host-fee-setting-guide2'))||rows.find(r=>r.pair.includes('host-fee-setting-guide2')&&r.pair.includes('food-truck-fee-guide'))
console.log(`\n▶ 指摘のペア(新記事 × host2): ${target.v.toFixed(1)}%  → 全${rows.length}ペア中 ${rows.indexOf(target)+1}位`)
console.log(`  中央値: ${rows[Math.floor(rows.length/2)].v.toFixed(1)}%`)

// --- タイトルの先頭一致（頭の語での食い合い）
console.log('\n===== タイトル先頭の共通接頭辞 上位15ペア =====')
const pre=(a,b)=>{let i=0;while(i<a.length&&i<b.length&&a[i]===b[i])i++;return i}
const trows=[]
for(let i=0;i<posts.length;i++)for(let j=i+1;j<posts.length;j++){
  trows.push({p:`${posts[i].slug} × ${posts[j].slug}`, n:pre(posts[i].title,posts[j].title),
              s:posts[i].title.slice(0,pre(posts[i].title,posts[j].title))})
}
trows.sort((a,b)=>b.n-a.n)
trows.slice(0,15).forEach((r,i)=>console.log(`${String(i+1).padStart(2)}. ${String(r.n).padStart(2)}字「${r.s}」  ${r.p}`))

// --- タイトル同士の4-gram重なり
console.log('\n===== タイトル4-gram 重なり 上位10ペア =====')
const rr=[]
for(let i=0;i<posts.length;i++)for(let j=i+1;j<posts.length;j++){
  const A=grams(posts[i].title,4),B=grams(posts[j].title,4)
  const inter=[...A].filter(g=>B.has(g)).length
  rr.push({p:`${posts[i].slug} × ${posts[j].slug}`, v:inter/Math.min(A.size,B.size)*100, inter})
}
rr.sort((a,b)=>b.v-a.v)
rr.slice(0,10).forEach((r,i)=>console.log(`${String(i+1).padStart(2)}. ${r.v.toFixed(1)}% (${r.inter}gram)  ${r.p}`))
