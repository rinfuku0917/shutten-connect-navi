import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
const txt = fs.readFileSync(new URL('./.env.local', import.meta.url), 'utf8')
const g = k => (txt.match(new RegExp('^' + k + '=(.*)$', 'm')) || [])[1].trim()
const sb = createClient(g('NEXT_PUBLIC_SUPABASE_URL'), g('NEXT_PUBLIC_SUPABASE_ANON_KEY'))

const rows = []
for (let f = 0; ; f += 1000) {
  const { data, error } = await sb.from('places')
    .select('title,prefecture,place_type,status,closed,fee').range(f, f + 999)
  if (error) throw error
  rows.push(...data); if (data.length < 1000) break
}
const pub = rows.filter(r => r.status === 'published' && !r.closed)
console.log('公開中の案件:', pub.length)

const norm = s => (s || '').replace(/\r?\n/g, ' ').replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
const kcLine = p => {
  const l = (p.fee || '').split(/\r?\n/).find(x => /キッチンカー出店料/.test(x))
  return norm(l || p.fee)
}
const yen = s => parseInt(s.replace(/,/g, ''), 10)

const both = []
for (const p of pub) {
  const f = kcLine(p)
  if (!/平日/.test(f) || !/週末|土日|休日|土曜|日曜|祝/.test(f)) continue
  const wd = f.match(/平日\s*[：:]?\s*([\d,]+)\s*円/)
  const we = f.match(/(?:週末|土日祝|土日|休日)\s*[：:]?\s*([\d,]+)\s*円/)
  let a = null, b = null
  if (wd && we) { a = yen(wd[1]); b = yen(we[1]) }
  else if (/平日\s*[\/／・]\s*週末|平日・週末\s*[：:]/.test(f)) {
    const m = f.match(/([\d,]+)\s*円/); if (m) a = b = yen(m[1])
  }
  both.push({ t: p.title, pref: p.prefecture, type: p.place_type, f, a, b })
}
const amt = both.filter(x => x.a != null)
const lower = amt.filter(x => x.a < x.b), eq = amt.filter(x => x.a === x.b), higher = amt.filter(x => x.a > x.b)

console.log('平日と週末の両方に言及  :', both.length)
console.log('  両方の金額あり        :', amt.length)
console.log('    平日が安い          :', lower.length)
console.log('    同額                :', eq.length)
console.log('    平日が高い          :', higher.length)
console.log('  金額なし              :', both.length - amt.length, both.filter(x => x.a == null).map(x => x.t))
const d = lower.map(x => x.b - x.a).sort((x, y) => x - y)
console.log('差額分布(平日が安い25件):', d.reduce((o, v) => (o[v] = (o[v] || 0) + 1, o), {}))
console.log('中央値 差がある分のみ    :', d[(d.length - 1) / 2])
const all = [...d, ...eq.map(() => 0)].sort((x, y) => x - y)
console.log('中央値 同額も含む        :', all.length % 2 ? all[(all.length - 1) / 2] : (all[all.length / 2 - 1] + all[all.length / 2]) / 2)
console.log('同額14件の運営/県        :',
  [...new Set(eq.map(x => x.t.replace(/[ 　].*$/, '') + '/' + x.pref + '/' + x.type))])
console.log('同額14件はすべて常設か   :', eq.every(x => x.type === 'regular'))
