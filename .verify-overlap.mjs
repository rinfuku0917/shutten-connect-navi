import fs from 'node:fs';
const dir='/Users/hidekifukusada/Desktop/コネクトナビ/shutten-connect-navi/docs/blog/';
const slugs=['food-truck-fee-guide','kitchen-car-location-guide','renting-parking-space','kitchen-car-required-documents'];
function body(s){
  let t=fs.readFileSync(dir+s+'.md','utf8');
  t=t.replace(/^---[\s\S]*?\n---\n/,'');            // frontmatter除去
  t=t.replace(/!\[[^\]]*\]\([^)]*\)/g,'');          // 画像
  return t;
}
function norm(t){
  return t.replace(/\[([^\]]*)\]\([^)]*\)/g,'$1')   // リンクはテキストのみ
          .replace(/[*#>|`\-—―\s]/g,'')
          .replace(/[（）()「」、。，．,\.:：；;！!？?〜~／\/％%\d０-９]/g,'');
}
const N=12;
function grams(t){const s=new Set();for(let i=0;i+N<=t.length;i++)s.add(t.slice(i,i+N));return s;}
const raw={},nz={},g={};
for(const s of slugs){raw[s]=body(s);nz[s]=norm(raw[s]);g[s]=grams(nz[s]);}
console.log('=== 本文長（正規化後の文字数 / 元の文字数） ===');
for(const s of slugs)console.log(s.padEnd(32),nz[s].length,'/',raw[s].length);

console.log('\n=== '+N+'文字n-gram 一致率（分母=各ペアの短いほう） ===');
const pairs=[];
for(let i=0;i<slugs.length;i++)for(let j=i+1;j<slugs.length;j++){
  const a=slugs[i],b=slugs[j];
  const inter=[...g[a]].filter(x=>g[b].has(x));
  const denom=Math.min(g[a].size,g[b].size);
  pairs.push({a,b,n:inter.length,rate:(inter.length/denom*100),inter});
}
pairs.sort((x,y)=>y.rate-x.rate);
for(const p of pairs)console.log(`${p.a} × ${p.b}`.padEnd(66),String(p.n).padStart(4),'gram',p.rate.toFixed(2)+'%');

// 一致n-gramを連結して読める断片に復元
function merge(list){
  const arr=[...list].sort();
  const out=[];
  for(const s of arr){
    const last=out[out.length-1];
    if(last){
      let ov=0;
      for(let k=Math.min(last.length,s.length)-1;k>0;k--){if(last.slice(-k)===s.slice(0,k)){ov=k;break;}}
      if(ov>=N-1){out[out.length-1]=last+s.slice(ov);continue;}
    }
    out.push(s);
  }
  return out;
}
console.log('\n=== 一致した断片（連結して復元・長い順） ===');
for(const p of pairs){
  if(p.n===0)continue;
  const frags=merge(p.inter).filter(f=>f.length>=N).sort((a,b)=>b.length-a.length);
  console.log(`\n--- ${p.a} × ${p.b} （${p.n}gram / 断片${frags.length}件）`);
  for(const f of frags.slice(0,25))console.log('   ['+f.length+'] '+f);
}
