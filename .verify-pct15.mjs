import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
const env = Object.fromEntries(
  fs.readFileSync(new URL('./.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

const P = '/private/tmp/claude-501/-Users-hidekifukusada-Desktop--------shutten-connect-navi/db7d6515-4023-44ab-9971-494a02f7a39c/scratchpad/places.json'
const rows = JSON.parse(fs.readFileSync(P, 'utf8'))
const pub = rows.filter(r => r.status === 'published' && !r.closed)

// 構造化カラムで 15% の案件
const colPct = p => (p.price_share_pct || 0) + (p.company_share_pct || 0)
const c15 = pub.filter(p => colPct(p) === 15)
console.log('=== 構造化カラムで pct=15 の案件:', c15.length, '件 ===')
c15.forEach(p => console.log('  ', p.title, '| fee=' + JSON.stringify(p.fee)))

// fee テキストに 15% と書いてある案件
const t15 = pub.filter(p => /15\s*[%％]/.test(p.fee || ''))
console.log('\n=== feeテキストに15%と書いてある案件:', t15.length, '件 ===')
t15.forEach(p => console.log('  ', p.title, '| pct列=' + colPct(p)))

// 差分
const ids = new Set(t15.map(p => p.id))
console.log('\n=== カラムは15%だが feeテキストには15%と書いていない ===')
c15.filter(p => !ids.has(p.id)).forEach(p => console.log('  ', p.title, '| fee=' + JSON.stringify(p.fee)))

// おおみか店への応募があるか
const oo = pub.find(p => (p.title || '').includes('おおみか'))
for (const t of ['applications', 'sales_reports', 'invoices']) {
  const { data, error, count } = await sb.from(t).select('*', { count: 'exact', head: true }).eq('place_id', oo.id)
  console.log(`\n${t}:`, error ? 'ERROR: ' + error.message : 'count=' + count)
}
