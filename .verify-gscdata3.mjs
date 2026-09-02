import fs from 'fs'
const env = Object.fromEntries(fs.readFileSync('/Users/hidekifukusada/Desktop/コネクトナビ/shutten-connect-navi/.env.local','utf8')
  .split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim()]}))
const H = { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, Authorization: 'Bearer ' + env.NEXT_PUBLIC_SUPABASE_ANON_KEY }
const r = await fetch(env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/', { headers: H })
console.log('ルート introspection:', r.status, JSON.stringify(await r.json()))

// 検索データが入りそうなテーブル名を総当たりで叩く
const cands = ['search_console','search_console_data','gsc','gsc_data','gsc_queries','search_queries',
 'search_analytics','analytics','page_analytics','page_views','pageviews','post_views','blog_views',
 'article_stats','post_stats','traffic','metrics','impressions','clicks','rankings','keyword_rankings',
 'keywords','seo_keywords','seo_metrics','site_metrics','events','access_logs','visits']
console.log('\n=== テーブル総当たり ===')
for (const t of cands) {
  const res = await fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${t}?select=*&limit=1`, { headers: H })
  const body = await res.text()
  if (res.status === 200) console.log(`✅ ${t}: 200 存在して読める -> ${body.slice(0,200)}`)
  else {
    let m=''; try{ m=JSON.parse(body).message }catch{ m=body.slice(0,80) }
    console.log(`   ${t}: ${res.status} ${m}`)
  }
}
