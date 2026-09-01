import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env = fs.readFileSync('.env.local', 'utf8')
const get = (k) => {
  const m = env.match(new RegExp('^' + k + '=(.*)$', 'm'))
  return m ? m[1].trim() : null
}
const sb = createClient(get('NEXT_PUBLIC_SUPABASE_URL'), get('NEXT_PUBLIC_SUPABASE_ANON_KEY'))

const { data: post, error } = await sb
  .from('posts')
  .select('*')
  .eq('slug', 'food-truck-fee-guide')
  .maybeSingle()

if (error) { console.error('ERR', error); process.exit(1) }
if (!post) { console.error('NOT FOUND'); process.exit(1) }

console.log('columns:', Object.keys(post).join(', '))
const body = post.content ?? post.body ?? post.markdown ?? ''
console.log('status:', post.status, '| body length:', String(body).length)
fs.writeFileSync('/private/tmp/claude-501/-Users-hidekifukusada-Desktop--------shutten-connect-navi/db7d6515-4023-44ab-9971-494a02f7a39c/scratchpad/db-body.md', String(body))

const words = ['営業許可', 'PL保険', '保険', '検便', '検体', '検査', '必要書類', '審査', '書類', '提出', '証明', '資格', '免許', '衛生', '保健所', '応募']
const sources = {
  'DB body': String(body),
  'DB whole row (JSON)': JSON.stringify(post),
  'docs md': fs.readFileSync('docs/blog/food-truck-fee-guide.md', 'utf8'),
}
for (const [name, text] of Object.entries(sources)) {
  const counts = words.map(w => `${w}:${(text.split(w).length - 1)}`)
  console.log(`\n[${name}] len=${text.length}\n  ` + counts.join('  '))
}
