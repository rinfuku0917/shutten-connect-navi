// 匿名キーで seller_documents が読めるかだけを確かめる（読み取りのみ）
import fs from 'node:fs'

const env = fs.readFileSync('.env.local', 'utf8')
const get = (k) => {
  const m = env.match(new RegExp('^' + k + '=(.*)$', 'm'))
  return m ? m[1].trim() : null
}
const url = get('NEXT_PUBLIC_SUPABASE_URL')
const key = get('NEXT_PUBLIC_SUPABASE_ANON_KEY')

async function q(path) {
  const r = await fetch(url + '/rest/v1/' + path, {
    headers: { apikey: key, Authorization: 'Bearer ' + key, Prefer: 'count=exact' },
  })
  const body = await r.text()
  return { status: r.status, range: r.headers.get('content-range'), body: body.slice(0, 300) }
}

console.log('seller_documents 全件:', JSON.stringify(await q('seller_documents?select=id&limit=1')))
console.log('seller_documents rejected:', JSON.stringify(await q('seller_documents?select=id,reject_reason&status=eq.rejected&limit=5')))
