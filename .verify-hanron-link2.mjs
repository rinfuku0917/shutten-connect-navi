import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
const env = Object.fromEntries(
  fs.readFileSync(new URL('./.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

const { data } = await sb.from('posts')
  .select('slug,title,status,published_at,updated_at,meta_description')
  .in('slug', ['kitchen-car-required-documents', 'food-truck-fee-guide', 'kitchen-car-location-guide', 'renting-parking-space', 'how-to-find-food-truck-spots'])
console.log('=== DB上の状態')
for (const p of data) console.log(`  ${p.slug}\n    status=${p.status} published_at=${p.published_at} updated_at=${p.updated_at}`)

const BASE = 'https://app.connect-navi.com'
// 対象ページが本物か（h1・タイトル・noindex）
const h = await (await fetch(BASE + '/blog/kitchen-car-required-documents')).text()
console.log('\n=== /blog/kitchen-car-required-documents の中身')
console.log('  <title>:', (h.match(/<title>([^<]*)<\/title>/) || [])[1])
console.log('  h1 を含む:', /<h1[^>]*>[\s\S]{0,200}?書類/.test(h))
console.log('  「記事が見つかりません」:', h.includes('記事が見つかりません'))
console.log('  noindex:', /noindex/.test(h))
console.log('  canonical:', (h.match(/rel="canonical"[^>]*href="([^"]*)"/) || h.match(/href="([^"]*)"[^>]*rel="canonical"/) || [])[1])
console.log('  本文の長さ(文字):', h.length)

// 公開3本の描画済みアンカーが実際にどこを指しているか＋その先の応答
for (const s of ['food-truck-fee-guide', 'kitchen-car-location-guide', 'renting-parking-space']) {
  const p = await (await fetch(`${BASE}/blog/${s}`)).text()
  const anchors = [...p.matchAll(/<a[^>]+href="([^"]*required-documents[^"]*)"[^>]*>([\s\S]{0,60}?)<\/a>/g)]
  console.log(`\n[${s}] 描画済みアンカー ${anchors.length} 本`)
  for (const a of anchors) {
    const r = await fetch(BASE + a[1], { redirect: 'manual' })
    console.log(`  href=${a[1]} text=${a[2].replace(/<[^>]*>/g, '')} -> HTTP ${r.status}`)
  }
}

// sitemap と /blog 一覧に載っているか
const sm = await (await fetch(BASE + '/sitemap.xml')).text()
console.log('\n=== sitemap.xml に対象URLが載っている:', sm.includes('/blog/kitchen-car-required-documents'))
const bl = await (await fetch(BASE + '/blog')).text()
console.log('=== /blog 一覧に対象slugが載っている:', bl.includes('kitchen-car-required-documents'))
