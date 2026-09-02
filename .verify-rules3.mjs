import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n')
  .filter(l => l.includes('=') && !l.trim().startsWith('#'))
  .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

async function all(table, sel, filter) {
  const rows = []
  for (let from = 0; ; from += 1000) {
    let q = sb.from(table).select(sel)
    if (filter) q = filter(q)
    const { data, error } = await q.range(from, from + 999)
    if (error) { console.error(table, error.message); return rows }
    if (!data || data.length === 0) break
    rows.push(...data)
    if (data.length < 1000) break
  }
  return rows
}

const posts = await all('posts', 'id, slug, title, status, published_at, category, meta_description, content')
console.log('posts total(匿名で見えた):', posts.length)
for (const s of ['food-truck-fee-guide', 'kitchen-car-location-guide', 'renting-parking-space', 'kitchen-car-required-documents']) {
  const p = posts.find(x => x.slug === s)
  if (!p) { console.log(' ', s, '=> 見えない（下書き or 無い）'); continue }
  const body = p.content || ''
  const plain = body.replace(/```[\s\S]*?```/g, '').replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/[#*>|`\-]/g, '').replace(/\s/g, '')
  console.log(' ', s, '| status=', p.status, '| category=', p.category, '| 本文字数(記号/空白除く)=', plain.length, '| md長=', body.length)
}

// 案件の曜日情報が本文に書かれているか（日程が「要相談」の案件）
const places = await all('places', '*')
const open = places.filter(p => p.status === 'published' && !p.closed)
const noDate = open.filter(p => {
  if (Array.isArray(p.schedule) && p.schedule.filter(d => d && d.date).length > 0) return false
  const od = (p.open_days || []).map(x => (x || '').trim()).filter(Boolean)
  return od.length === 0
})
const dayWord = /曜|毎週|毎月|平日|土日|週末|祝/
const noDayAnywhere = noDate.filter(p => !dayWord.test([p.title, p.recruit, p.description, JSON.stringify(p.details || {})].join(' ')))
console.log('--- 日程欄が「要相談」:', noDate.length, 'そのうち本文・タイトルにも曜日の手がかり無し:', noDayAnywhere.length)
noDayAnywhere.slice(0, 15).forEach(p => console.log('    ', p.title?.slice(0, 45)))

// 出店料に数字が一切ない案件
const noNum = open.filter(p => !/[0-9０-９]/.test(String(p.fee || '')) && !(p.price_fixed || p.price_share_pct || p.company_fixed_amount || p.company_share_pct))
console.log('--- 出店料に金額の数字が一切ない案件:', noNum.length)
noNum.forEach(p => console.log('    ', JSON.stringify(p.fee), '|', p.title?.slice(0, 40)))
