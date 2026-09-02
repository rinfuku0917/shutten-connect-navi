import fs from 'node:fs';
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n')
  .filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim()];}));
const URL_=env.NEXT_PUBLIC_SUPABASE_URL, KEY=env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const h={apikey:KEY,Authorization:`Bearer ${KEY}`};

// 1) posts をページングで全件取得（1000行打ち切り対策）
let all=[],from=0;
for(;;){
  const r=await fetch(`${URL_}/rest/v1/posts?select=slug,title,status,content&order=slug.asc`,{headers:{...h,Range:`${from}-${from+999}`}});
  const j=await r.json();
  if(!Array.isArray(j)){console.log('ERR',j);break;}
  all=all.concat(j);
  if(j.length<1000) break;
  from+=1000;
}
console.log('posts 総件数:', all.length);

const targets=['renting-parking-space','supermarket-food-truck'];
for(const s of targets){
  const p=all.find(x=>x.slug===s);
  if(!p){console.log(`\n[${s}] DBに無し`);continue;}
  console.log(`\n===== ${s} (status=${p.status}) =====`);
  const c=p.content||'';
  const keys=['臨時営業','主催者名義','管轄の保健所','施設側にも確認','保健所'];
  for(const k of keys) console.log(`  "${k}" 出現 ${(c.split(k).length-1)}回`);
  // 該当箇所の前後を出す
  for(const m of c.matchAll(/[^\n]*(臨時営業|施設側にも確認|保健所)[^\n]*/g)){
    console.log('  > '+m[0].trim().slice(0,160));
  }
}
// 2) 他記事にも同種の無出典な法令記述があるか（DB側で確認）
console.log('\n===== 公開記事に含まれる無出典の法令・行政記述 =====');
const laws=['用途地域','建築基準法','消防法','都市計画法','又貸し','消防署','食品衛生法','臨時営業'];
for(const p of all.filter(x=>x.status==='published')){
  const hit=laws.filter(l=>(p.content||'').includes(l));
  if(hit.length) console.log(`  ${p.slug}: ${hit.join(', ')}`);
}
