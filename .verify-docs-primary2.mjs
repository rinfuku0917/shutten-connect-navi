import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env = fs.readFileSync('.env.local', 'utf8')
const get = (k) => { const m = env.match(new RegExp('^' + k + '=(.*)$', 'm')); return m ? m[1].trim() : null }
const sb = createClient(get('NEXT_PUBLIC_SUPABASE_URL'), get('NEXT_PUBLIC_SUPABASE_ANON_KEY'))

// pull all published, non-closed places with paging
let rows = [], from = 0
for (;;) {
  const { data, error } = await sb.from('places').select('*').range(from, from + 999)
  if (error) { console.error(error); process.exit(1) }
  rows = rows.concat(data)
  if (data.length < 1000) break
  from += 1000
}
console.log('places total rows:', rows.length)
const pub = rows.filter(r => r.status === 'published' && !r.closed)
console.log('published & not closed:', pub.length)
console.log('place columns:', Object.keys(rows[0] || {}).join(', '))

const blob = JSON.stringify(pub)

// Does the platform's own place data contain document-review info at all?
const docWords = ['営業許可', 'PL保険', '生産物賠償', '保険', '検便', '検体', '検査', '必要書類', '審査', '書類', '提出', '証明', '衛生', '保健所']
console.log('\n--- 公開中案件データ内の「書類審査」系ワード出現数 ---')
for (const w of docWords) {
  const n = blob.split(w).length - 1
  const places = pub.filter(p => JSON.stringify(p).includes(w)).length
  console.log(`${w.padEnd(8)} 出現${n}回 / ${places}件の案件に登場`)
}

// Verify the fee quotes used in the article actually exist in the data
console.log('\n--- 記事中の実例が案件データに実在するか ---')
const quotes = ['一日利用2,500円', '水道光熱費1,000円', '駐車場利用アリ', '駐車場利用ナシ', 'デジタルサイネージ']
for (const q of quotes) {
  const hits = pub.filter(p => JSON.stringify(p).includes(q))
  console.log(`${q.padEnd(16)} -> ${hits.length}件`)
}
