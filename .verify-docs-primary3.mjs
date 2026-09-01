import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
const env = fs.readFileSync('.env.local', 'utf8')
const get = (k) => { const m = env.match(new RegExp('^' + k + '=(.*)$', 'm')); return m ? m[1].trim() : null }
const sb = createClient(get('NEXT_PUBLIC_SUPABASE_URL'), get('NEXT_PUBLIC_SUPABASE_ANON_KEY'))

let rows = [], from = 0
for (;;) {
  const { data, error } = await sb.from('places').select('*').range(from, from + 999)
  if (error) { console.error(error); process.exit(1) }
  rows = rows.concat(data); if (data.length < 1000) break; from += 1000
}
const pub = rows.filter(r => r.status === 'published' && !r.closed)

// 全302件（下書き・終了含む）でも検便/検体を探す
const allBlob = JSON.stringify(rows)
console.log('全302件での 検便:', allBlob.split('検便').length - 1, '検体:', allBlob.split('検体').length - 1, '検査:', allBlob.split('検査').length - 1)

console.log('\n=== 営業許可 / PL保険 に触れている公開中案件の実文言 ===')
const hits = pub.filter(p => /営業許可|PL保険/.test(JSON.stringify(p)))
console.log('該当:', hits.length, '件 / 公開中', pub.length, '件\n')
const seen = new Set()
for (const p of hits) {
  const txt = [p.description, p.details, p.recruit, p.fee].filter(Boolean).join('\n')
  for (const line of txt.split('\n')) {
    if (/営業許可|PL保険|保険|衛生/.test(line)) {
      const t = line.trim()
      if (t && !seen.has(t)) { seen.add(t); console.log('  -', t.slice(0, 160)) }
    }
  }
}

console.log('\n=== 「一日利用2,500円」まわりの表記ゆれ確認 ===')
for (const q of ['一日利用', '2,500', '2500', '一日利用2,500円〜', '＋売上10']) {
  console.log(`  ${q.padEnd(14)} -> ${pub.filter(p => JSON.stringify(p).includes(q)).length}件`)
}
const u = pub.filter(p => JSON.stringify(p).includes('一日利用'))
for (const p of u.slice(0, 5)) console.log('   fee/details:', JSON.stringify({ fee: p.fee, pf: p.price_fixed, ps: p.price_share_pct }).slice(0, 200))
