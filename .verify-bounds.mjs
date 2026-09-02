import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
const env = Object.fromEntries(
  fs.readFileSync(new URL('./.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

// applications テーブルがそもそも匿名で読めるのか
const { count, error } = await sb.from('applications').select('*', { count: 'exact', head: true })
console.log('applications 全件 count:', error ? 'ERROR ' + error.message : count)

const P = '/private/tmp/claude-501/-Users-hidekifukusada-Desktop--------shutten-connect-navi/db7d6515-4023-44ab-9971-494a02f7a39c/scratchpad/places.json'
const rows = JSON.parse(fs.readFileSync(P, 'utf8'))
const pub = rows.filter(r => r.status === 'published' && !r.closed)

function cls(f) {
  f = (f || '').trim()
  if (!f) return '空欄'
  const hasPct = /[0-9]+\s*[%％]/.test(f)
  const hasYen = /[0-9][0-9,，]*\s*円/.test(f)
  if (hasPct && hasYen) return '併用'
  if (hasPct) return '歩合'
  if (hasYen) return '固定'
  return 'その他テキスト'
}
const g = {}
for (const p of pub) (g[cls(p.fee)] ||= []).push(p)
console.log('\n=== feeテキスト分類 ===')
for (const k of Object.keys(g)) console.log(k, g[k].length)
console.log('記事: 固定51 歩合44 併用9 応相談6\n')
for (const k of ['併用', 'その他テキスト', '空欄']) {
  console.log('--- ' + k + ' ---')
  ;(g[k] || []).forEach(p => console.log('   ', p.title, '|', JSON.stringify(p.fee)))
}
