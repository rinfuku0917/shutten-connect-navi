import fs from 'node:fs'
const R = '/Users/hidekifukusada/Desktop/コネクトナビ/shutten-connect-navi/'
const posts = JSON.parse(fs.readFileSync(R+'.verify-posts.json','utf8'))
const P = s => posts.find(p=>p.slug===s)

const stripFM = s => { const m = s.match(/^---\r?\n[\s\S]*?\r?\n---\r?\n([\s\S]*)$/); return m ? m[1] : s }

// マークダウン記法・画像・リンク・記号を落として素の日本語テキストにする
function norm(s){
  return s
    .replace(/!\[[^\]]*\]\([^)]*\)/g,'')      // 画像
    .replace(/\[([^\]]*)\]\([^)]*\)/g,'$1')   // リンク→テキスト
    .replace(/`[^`]*`/g,'')
    .replace(/[*_#>|~\-]/g,'')                // 記法記号
    .replace(/\s+/g,'')                       // 空白・改行すべて除去
}
const grams = (s,n) => { const S=new Set(); for(let i=0;i+n<=s.length;i++) S.add(s.slice(i,i+n)); return S }
// A の n-gram のうち B にも出るものの割合
function contain(a,b,n){
  const A=grams(a,n), B=grams(b,n)
  if(!A.size) return {pct:0,hits:[],A:0}
  const hits=[...A].filter(g=>B.has(g))
  return {pct: hits.length/A.size*100, hits, A:A.size, B:B.size}
}

const NEW  = norm(P('food-truck-fee-guide').content)
const HOST2= norm(P('host-fee-setting-guide2').content)
const HOST1= norm(P('host-fee-setting-guide').content)
const PREV = norm(stripFM(fs.readFileSync(R+'docs/blog/food-truck-fee-guide.previous.md','utf8')))
const MDNEW= norm(stripFM(fs.readFileSync(R+'docs/blog/food-truck-fee-guide.md','utf8')))

console.log('文字数(正規化後): 新=%d 旧=%d host2=%d host1=%d  / 原稿md=%d', NEW.length, PREV.length, HOST2.length, HOST1.length, MDNEW.length)
console.log('原稿md と DB本文 が一致:', MDNEW===NEW)

console.log('\n===== 12文字 n-gram 含有率 =====')
const pairs = [
  ['旧本文 → host2', PREV, HOST2],
  ['新本文 → host2', NEW,  HOST2],
  ['host2 → 旧本文', HOST2, PREV],
  ['host2 → 新本文', HOST2, NEW],
  ['新本文 → host1', NEW,  HOST1],
  ['新本文 → 旧本文', NEW, PREV],
]
for(const [label,a,b] of pairs){
  const r = contain(a,b,12)
  console.log(`${label.padEnd(16)} ${r.pct.toFixed(1)}%  (A=${r.A} gram中 ${r.hits.length}一致)`)
}

console.log('\n===== 旧本文→host2 で一致した12-gram（重複区間をまとめて表示）=====')
{
  const r = contain(PREV,HOST2,12)
  // 連続する一致区間を復元
  const B=grams(HOST2,12); const segs=[]; let cur=null
  for(let i=0;i+12<=PREV.length;i++){
    const g=PREV.slice(i,i+12)
    if(B.has(g)){ if(cur && i<=cur.end) cur.end=i+12; else {cur={start:i,end:i+12}; segs.push(cur)} }
  }
  segs.forEach(s=>console.log(`  「${PREV.slice(s.start,s.end)}」(${s.end-s.start}字)`))
  console.log(`  → ${segs.length}区間`)
}

console.log('\n===== n を変えて（新本文↔host2）=====')
for(const n of [6,8,10,12,16,20]){
  const f=contain(NEW,HOST2,n), b=contain(HOST2,NEW,n)
  console.log(`  n=${String(n).padStart(2)}  新→host2 ${f.pct.toFixed(1)}%   host2→新 ${b.pct.toFixed(1)}%`)
}
console.log('\n===== n を変えて（旧本文↔host2）=====')
for(const n of [6,8,10,12,16,20]){
  const f=contain(PREV,HOST2,n), b=contain(HOST2,PREV,n)
  console.log(`  n=${String(n).padStart(2)}  旧→host2 ${f.pct.toFixed(1)}%   host2→旧 ${b.pct.toFixed(1)}%`)
}
