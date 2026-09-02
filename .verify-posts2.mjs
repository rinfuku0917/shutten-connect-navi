import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
const env=Object.fromEntries(fs.readFileSync('/Users/hidekifukusada/Desktop/コネクトナビ/shutten-connect-navi/.env.local','utf8')
  .split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#'))
  .map(l=>[l.slice(0,l.indexOf('=')).trim(),l.slice(l.indexOf('=')+1).trim()]));
const sb=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
// 下書きが匿名キーで見えるか確認
for(const s of ['kitchen-car-required-documents','how-to-find-food-truck-spots','auto-mtgh64lh-jwwkxe']){
  const{data,error}=await sb.from('posts').select('slug,status').eq('slug',s);
  console.log('slug検索',s,'→',error?error.message:JSON.stringify(data));
}
const{count}=await sb.from('posts').select('*',{count:'exact',head:true});
console.log('posts 総数(count):',count);
const{data:st}=await sb.from('posts').select('status');
console.log('statusの分布:',JSON.stringify(st.reduce((a,r)=>(a[r.status]=(a[r.status]||0)+1,a),{})));
const{data:posts}=await sb.from('posts').select('slug,title,category,target_keyword,related_prefecture,related_category,status,published_at,meta_description');
console.log('\nslug | category | target_keyword | related_pref | related_cat');
for(const p of posts.sort((a,b)=>a.category.localeCompare(b.category)||a.slug.localeCompare(b.slug)))
  console.log([p.slug,p.category,p.target_keyword||'(なし)',p.related_prefecture||'-',p.related_category||'-'].join(' | '));
console.log('\nカテゴリ別件数:',JSON.stringify(posts.reduce((a,r)=>(a[r.category]=(a[r.category]||0)+1,a),{})));
