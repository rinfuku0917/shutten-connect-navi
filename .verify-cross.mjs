import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env = Object.fromEntries(
  fs.readFileSync(new URL('./.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

const sellers = JSON.parse(fs.readFileSync('/private/tmp/claude-501/-Users-hidekifukusada-Desktop--------shutten-connect-navi/db7d6515-4023-44ab-9971-494a02f7a39c/scratchpad/sellers.json', 'utf8'))
const zeroIds = sellers.filter(s => !Array.isArray(s.photos) || s.photos.length === 0).map(s => s.id)
console.log('プロフィール写真0の出店者:', zeroIds.length)

// --- 別ルート: サーバ側フィルタで数える ---
const found = new Set()
for (let i = 0; i < zeroIds.length; i += 200) {
  const chunk = zeroIds.slice(i, i + 200)
  const { data, error } = await sb.from('menus').select('seller_id')
    .in('seller_id', chunk).not('photo_url', 'is', null)
  if (error) { console.log('ERR', error.message); break }
  for (const r of data) found.add(r.seller_id)
}
console.log('[別ルート] 写真0の出店者のうち メニュー写真ありの人数:', found.size)
console.log('[別ルート] 画像が本当に0の出店者:', zeroIds.length - found.size,
  `(${((zeroIds.length - found.size) / sellers.length * 100).toFixed(2)}%)`)

// --- photo_url が空文字のケース ---
{
  const { count } = await sb.from('menus').select('id', { count: 'exact', head: true }).eq('photo_url', '')
  console.log('photo_url が空文字のメニュー:', count)
  const { count: c2 } = await sb.from('menus').select('id', { count: 'exact', head: true }).is('photo_url', null)
  console.log('photo_url が null のメニュー:', c2)
  const { count: c3 } = await sb.from('menus').select('id', { count: 'exact', head: true })
  console.log('menus 全件:', c3)
}

// --- 価格の内訳（記事は3,675品と書いている） ---
{
  const { count: cNull } = await sb.from('menus').select('id', { count: 'exact', head: true }).is('price', null)
  const { count: cZero } = await sb.from('menus').select('id', { count: 'exact', head: true }).eq('price', 0)
  const { count: cPos } = await sb.from('menus').select('id', { count: 'exact', head: true }).gt('price', 0)
  console.log(`価格: null=${cNull} / 0円=${cZero} / 1円以上=${cPos}`)
}

// --- profiles.menu（応募者一覧が出しているフリーテキスト欄）は匿名で読めるか ---
{
  const { data, error } = await sb.from('profiles').select('id, menu').limit(1)
  console.log('profiles 直読み:', error ? 'NG: ' + error.message : `OK (${data.length}件)`)
}
