import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
const env = Object.fromEntries(
  fs.readFileSync(new URL('./.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')] })
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

const { data, error } = await sb.from('posts').select('*').limit(1000)
if (error) { console.log('posts error:', error.message) }
else {
  for (const p of data) {
    const slug = p.slug
    if (!['food-truck-fee-guide', 'weekday-food-truck-spots', 'kitchen-car-location-guide', 'get-food-truck-offers'].includes(slug)) continue
    console.log('\n===', slug, '| status/published:', p.status ?? p.published, '| updated:', p.updated_at)
    console.log('  meta_description:', p.meta_description)
    console.log('  excerpt:', p.excerpt)
    const body = p.body || p.content || ''
    const hits = body.split(/\r?\n/).filter(l => /25件|同額|すべて平日|全件/.test(l))
    hits.forEach(h => console.log('  >>', h.trim()))
  }
}
