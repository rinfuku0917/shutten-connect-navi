import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
const env=Object.fromEntries(fs.readFileSync('/Users/hidekifukusada/Desktop/コネクトナビ/shutten-connect-navi/.env.local','utf8')
  .split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#'))
  .map(l=>[l.slice(0,l.indexOf('=')).trim(),l.slice(l.indexOf('=')+1).trim()]));
const sb=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
async function all(table,cols,mod){
  const out=[];let from=0;
  for(;;){let q=sb.from(table).select(cols).range(from,from+999);if(mod)q=mod(q);
    const{data,error}=await q;if(error){console.log(table,'ERROR',error.message);break;}
    out.push(...data);if(data.length<1000)break;from+=1000;}
  return out;
}
const posts=await all('posts','*');
console.log('posts 件数:',posts.length);
if(posts[0])console.log('列:',Object.keys(posts[0]).join(', '));
console.log('\nslug | published | category | title | target_keyword? | 本文字数 | created/updated');
for(const p of posts.sort((a,b)=>String(a.slug).localeCompare(String(b.slug)))){
  console.log([p.slug,p.published??p.status??'?',p.category,String(p.title).slice(0,42),
    (p.content||p.body||'').length, (p.published_at||p.created_at||'').slice(0,10)].join(' | '));
}
fs.writeFileSync('/private/tmp/claude-501/-Users-hidekifukusada-Desktop--------shutten-connect-navi/db7d6515-4023-44ab-9971-494a02f7a39c/scratchpad/posts.json',JSON.stringify(posts));
