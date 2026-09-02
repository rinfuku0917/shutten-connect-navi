import fs from 'node:fs';
const dir='/Users/hidekifukusada/Desktop/コネクトナビ/shutten-connect-navi/docs/blog/';
const posts=JSON.parse(fs.readFileSync('/private/tmp/claude-501/-Users-hidekifukusada-Desktop--------shutten-connect-navi/db7d6515-4023-44ab-9971-494a02f7a39c/scratchpad/posts.json','utf8'));
const docs={};for(const p of posts)docs[p.slug]={t:p.title,c:p.category,x:p.content};
docs['kitchen-car-required-documents']={t:'キッチンカーの出店に必要な書類は？',c:'書類・保険(下書き)',
 x:fs.readFileSync(dir+'kitchen-car-required-documents.md','utf8').replace(/^---[\s\S]*?\n---\n/,'')};
function norm(t){return t.replace(/!\[[^\]]*\]\([^)]*\)/g,'').replace(/\[([^\]]*)\]\([^)]*\)/g,'$1')
 .replace(/[*#>|`\-—―\s（）()「」、。，．,\.:：；;！!？?〜~／\/]/g,'');}
// 文字2-gramのTF-IDFコサイン（日本語の話題の近さを測る一般的なやり方）
const slugs=Object.keys(docs);const tf={},df={};
for(const s of slugs){const t=norm(docs[s].x);const m={};
 for(let i=0;i+2<=t.length;i++){const g=t.slice(i,i+2);m[g]=(m[g]||0)+1;}
 tf[s]=m;for(const g in m)df[g]=(df[g]||0)+1;}
const Nd=slugs.length,vec={};
for(const s of slugs){const v={};let n=0;
 for(const g in tf[s]){const w=(1+Math.log(tf[s][g]))*Math.log(Nd/df[g]);if(w>0){v[g]=w;n+=w*w;}}
 n=Math.sqrt(n)||1;for(const g in v)v[g]/=n;vec[s]=v;}
const rows=[];
for(let i=0;i<Nd;i++)for(let j=i+1;j<Nd;j++){const a=slugs[i],b=slugs[j];let d=0;
 for(const g in vec[a])if(vec[b][g])d+=vec[a][g]*vec[b][g];
 rows.push({a,b,s:d});}
rows.sort((x,y)=>y.s-x.s);
console.log('=== 話題の近さ（TF-IDFコサイン・上位25）1.0=同一 ===');
const T=['food-truck-fee-guide','kitchen-car-location-guide','renting-parking-space','kitchen-car-required-documents'];
for(const r of rows.slice(0,25))
 console.log(((T.includes(r.a)||T.includes(r.b))?'★ ':'  ')+`${r.a} × ${r.b}`.padEnd(74)+r.s.toFixed(3));
console.log('\n=== 主要語の出現回数 ===');
const terms=['出店料','相場','歩合','固定','PL保険','損害賠償','施設賠償','保険','書類','営業許可','食品衛生責任者','検便','検体','駐車場','貸す','又貸し','近隣','発電機','中央値','％'];
console.log('slug'.padEnd(40)+terms.map(t=>t.padStart(7)).join(''));
for(const s of slugs.sort()){const t=docs[s].x;
 console.log(s.padEnd(40)+terms.map(k=>String((t.match(new RegExp(k,'g'))||[]).length).padStart(7)).join(''));}
