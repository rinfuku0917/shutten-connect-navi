import fs from 'fs'
const env = Object.fromEntries(fs.readFileSync('/Users/hidekifukusada/Desktop/コネクトナビ/shutten-connect-navi/.env.local','utf8')
  .split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim()]}))
const r = await fetch(env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/', {
  headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, Authorization: 'Bearer ' + env.NEXT_PUBLIC_SUPABASE_ANON_KEY, Accept: 'application/openapi+json' }
})
const spec = await r.json()
console.log('トップレベルキー:', Object.keys(spec))
const paths = Object.keys(spec.paths || {}).filter(p=>p!=='/')
console.log('\n=== 匿名キーで到達できるテーブル/ビュー（' + paths.length + '件） ===')
console.log(paths.map(p=>p.replace('/','')).join('\n'))
const hits = paths.filter(t=>/search|query|impress|click|rank|position|analytic|gsc|console|traffic|metric|stat|view|pageview|session|log/i.test(t))
console.log('\n=== 検索/流入データっぽい名前 ===')
console.log(hits.length ? hits.join('\n') : '(該当なし)')
