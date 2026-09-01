import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
const env = fs.readFileSync('.env.local', 'utf8')
const get = (k) => { const m = env.match(new RegExp('^' + k + '=(.*)$', 'm')); return m ? m[1].trim() : null }
const sb = createClient(get('NEXT_PUBLIC_SUPABASE_URL'), get('NEXT_PUBLIC_SUPABASE_ANON_KEY'))
let rows = [], from = 0
for (;;) { const { data } = await sb.from('places').select('*').range(from, from + 999); rows = rows.concat(data); if (data.length < 1000) break; from += 1000 }
const pub = rows.filter(r => r.status === 'published' && !r.closed)

const cols = Object.keys(rows[0])
console.log('=== どの列に 営業許可 / PL保険 / 衛生 が入っているか（公開中110件） ===')
for (const c of cols) {
  const n = pub.filter(p => p[c] && JSON.stringify(p[c]).match(/営業許可|PL保険|衛生/)).length
  if (n) console.log(`  ${c}: ${n}件`)
}
console.log('\n=== 実際の文言（重複除去） ===')
const seen = new Set()
for (const p of pub) {
  for (const c of cols) {
    const v = p[c]; if (!v) continue
    const s = typeof v === 'string' ? v : JSON.stringify(v)
    if (!/営業許可|PL保険|衛生/.test(s)) continue
    for (const line of s.split(/\r?\n/)) {
      if (/営業許可|PL保険|衛生/.test(line)) {
        const t = line.trim().replace(/\s+/g, ' ')
        if (t && !seen.has(t)) { seen.add(t); console.log(`  [${c}] ${t.slice(0, 200)}`) }
      }
    }
  }
}
console.log('\n(ユニーク文言数:', seen.size, ')')
