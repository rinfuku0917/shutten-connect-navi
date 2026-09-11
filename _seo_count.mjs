import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n')
  .filter(l=>l.includes('=')).map(l=>[l.slice(0,l.indexOf('=')).trim(), l.slice(l.indexOf('=')+1).trim()]))
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, key, {auth:{persistSession:false}})
console.log('key type:', env.SUPABASE_SERVICE_ROLE_KEY ? 'service_role' : 'anon')

async function cnt(table, fn) {
  let q = db.from(table).select('*', {count:'exact', head:true})
  if (fn) q = fn(q)
  const { count, error } = await q
  if (error) return 'ERR:' + error.message
  return count
}

console.log('--- places ---')
console.log('places 全件                          ', await cnt('places'))
console.log('places status=published              ', await cnt('places', q=>q.eq('status','published')))
console.log('places published & closed=false      ', await cnt('places', q=>q.eq('status','published').eq('closed',false)))
console.log('places published & closed=true       ', await cnt('places', q=>q.eq('status','published').eq('closed',true)))
console.log('places published & closed IS NULL    ', await cnt('places', q=>q.eq('status','published').is('closed',null)))
console.log('places status!=published             ', await cnt('places', q=>q.neq('status','published')))

console.log('--- profiles (sellers) ---')
console.log('role=seller 全件                     ', await cnt('profiles', q=>q.eq('role','seller')))
console.log('role=seller approved                 ', await cnt('profiles', q=>q.eq('role','seller').eq('approval_status','approved')))
console.log('role=seller not approved             ', await cnt('profiles', q=>q.eq('role','seller').neq('approval_status','approved')))
console.log('role=seller approval_status NULL     ', await cnt('profiles', q=>q.eq('role','seller').is('approval_status',null)))
console.log('role=host 全件                       ', await cnt('profiles', q=>q.eq('role','host')))
console.log('profiles 全件                        ', await cnt('profiles'))

console.log('--- posts ---')
console.log('posts published                      ', await cnt('posts', q=>q.eq('status','published')))
console.log('posts 全件                           ', await cnt('posts'))

// 運営アカウント
const EXCLUDED = ['株式会社nav', '株式会社アーク']
for (const nm of EXCLUDED) {
  const { data } = await db.from('profiles').select('id, shop_name, name, role, approval_status').eq('shop_name', nm)
  console.log(`shop_name="${nm}" 件数:`, (data||[]).length, JSON.stringify(data))
}
// displayName = shop_name || name なので name 側も見る
for (const nm of EXCLUDED) {
  const { data } = await db.from('profiles').select('id, shop_name, name, role, approval_status').is('shop_name', null).eq('name', nm)
  console.log(`shop_name無しで name="${nm}":`, (data||[]).length)
}

// approved seller 全部を取って写真・bio・メニューを数える
let sellers = []
for (let from=0;;from+=1000) {
  const { data, error } = await db.from('profiles')
    .select('id, name, shop_name, photos, bio, genre, areas, menu, sales_type, vehicle_type, equipment, payment_methods')
    .eq('role','seller').eq('approval_status','approved').range(from, from+999)
  if (error) { console.log('sellers ERR', error.message); break }
  if (!data || data.length===0) break
  sellers = sellers.concat(data)
  if (data.length<1000) break
}
console.log('approved seller 取得数:', sellers.length)

// menus テーブル: seller_id ごとの件数
let menuRows = []
for (let from=0;;from+=1000) {
  const { data, error } = await db.from('menus').select('seller_id').range(from, from+999)
  if (error) { console.log('menus ERR', error.message); break }
  if (!data || data.length===0) break
  menuRows = menuRows.concat(data)
  if (data.length<1000) break
}
const menuCount = {}
for (const m of menuRows) menuCount[m.seller_id] = (menuCount[m.seller_id]||0)+1
console.log('menus 行数:', menuRows.length, '/ メニューを持つ出店者:', Object.keys(menuCount).length)

// reviews
let revRows = []
for (let from=0;;from+=1000) {
  const { data, error } = await db.from('reviews').select('seller_id,status').range(from, from+999)
  if (error) { console.log('reviews ERR', error.message); break }
  if (!data || data.length===0) break
  revRows = revRows.concat(data)
  if (data.length<1000) break
}
const revCount = {}
for (const r of revRows) if (r.status==='approved') revCount[r.seller_id]=(revCount[r.seller_id]||0)+1
console.log('reviews 行数:', revRows.length, '/ 承認済みレビューを持つ出店者:', Object.keys(revCount).length)

const nPhotos = s => Array.isArray(s.photos) ? s.photos.filter(Boolean).length : 0
const bioLen = s => (s.bio ?? '').replace(/\s+/g,' ').trim().length

let noPhoto=0, noMenu=0, noPhotoNoMenu=0, noBio30=0, bare=0, noGenre=0, noAreas=0, noBioAtAll=0
const bareSamples=[]
for (const s of sellers) {
  const p = nPhotos(s), m = menuCount[s.id]||0, b = bioLen(s)
  if (p===0) noPhoto++
  if (m===0) noMenu++
  if (p===0 && m===0) noPhotoNoMenu++
  if (b<30) noBio30++
  if (b===0) noBioAtAll++
  const g = s.genre ? (Array.isArray(s.genre)? s.genre.filter(Boolean).length : String(s.genre).trim().length?1:0) : 0
  const a = Array.isArray(s.areas) ? s.areas.filter(Boolean).length : 0
  if (g===0) noGenre++
  if (a===0) noAreas++
  if (p===0 && m===0 && b<30) { bare++; if (bareSamples.length<5) bareSamples.push({id:s.id, shop:s.shop_name, name:s.name, genre:s.genre, areas:s.areas, bio:s.bio, menu:s.menu}) }
}
console.log('写真0枚                              ', noPhoto)
console.log('メニュー0件(menusテーブル)           ', noMenu)
console.log('写真0枚かつメニュー0件               ', noPhotoNoMenu)
console.log('bio 30字未満(定型文になる)           ', noBio30)
console.log('bio 空                               ', noBioAtAll)
console.log('写真0・メニュー0・bio30字未満        ', bare)
console.log('genre 空                             ', noGenre)
console.log('areas 空                             ', noAreas)
console.log('レビュー0件の approved seller        ', sellers.filter(s=>!(revCount[s.id]>0)).length)
console.log('サンプル:', JSON.stringify(bareSamples, null, 1).slice(0,2000))

// profiles.menu カラム(自由記述?)の中身
const withMenuCol = sellers.filter(s=>s.menu && String(s.menu).trim()).length
console.log('profiles.menu に何か入っている        ', withMenuCol)
