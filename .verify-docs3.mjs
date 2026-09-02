import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env = Object.fromEntries(
  fs.readFileSync(new URL('./.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('=')).map(l => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    })
)
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

async function all(table, cols) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select(cols).range(from, from + 999)
    if (error) { console.log(table + ' error:', error.message); return out }
    out.push(...data)
    if (data.length < 1000) break
  }
  return out
}

const places = await all('places', '*')
const pub = places.filter(p => p.status === 'published' && !p.closed)
const text = p => [p.title, p.description, p.address, p.nearest_station].filter(Boolean).join(' ')

console.log('公開中:', pub.length)
console.log('\n■ 記事の「学校・専門学校が30件」に当たる数え方を総当たりで探す')
const schoolPats = {
  'title に 学校|大学|専門': p => /学校|大学|専門/.test(p.title || ''),
  '全文に 学校|大学|専門': p => /学校|大学|専門/.test(text(p)),
  'title に 学校|専門学校': p => /学校/.test(p.title || ''),
  'genres に 大学・学校': p => (p.genres || []).includes('大学・学校'),
}
for (const [k, f] of Object.entries(schoolPats)) console.log('   ' + pub.filter(f).length + '\t' + k)

console.log('\n■ 記事の「商業施設が29件」に当たる数え方')
const mallPats = {
  'title に 商業施設': p => /商業施設/.test(p.title || ''),
  '全文に 商業施設': p => /商業施設/.test(text(p)),
  '全文に 商業施設|ショッピング|モール|百貨店': p => /商業施設|ショッピング|モール|百貨店/.test(text(p)),
  'genres に 商業施設': p => (p.genres || []).includes('商業施設'),
  'genres に 商業施設|スーパーマーケット': p => (p.genres || []).some(g => g === '商業施設' || g === 'スーパーマーケット'),
}
for (const [k, f] of Object.entries(mallPats)) console.log('   ' + pub.filter(f).length + '\t' + k)

console.log('\n■ 参考：公開中110件のタイトル先頭30件')
pub.slice(0, 30).forEach(p => console.log('   - ' + (p.title || '').slice(0, 58) + '  [genres=' + JSON.stringify(p.genres) + ']'))

console.log('\n■ 記事本文（DB）と原稿(.md)の一致確認')
const posts = await all('posts', 'slug, content, status')
const t = posts.find(p => p.slug === 'kitchen-car-required-documents')
const md = fs.readFileSync(new URL('./docs/blog/kitchen-car-required-documents.md', import.meta.url), 'utf8')
const body = md.split('---')[2] ? md.split(/^---$/m).slice(2).join('---').trim() : ''
console.log('   DB status:', t.status)
console.log('   DB本文に「30件」を含む:', t.content.includes('30件'))
console.log('   DB本文に「学校・専門学校が30件、商業施設が29件」:', t.content.includes('学校・専門学校が30件'))
console.log('   DB本文 == 原稿本文:', t.content.trim() === body)
console.log('   DB本文 文字数:', t.content.length, '／ 原稿本文 文字数:', body.length)
const i = t.content.indexOf('学校・専門学校')
console.log('   該当箇所:', i >= 0 ? t.content.slice(i - 40, i + 90).replace(/\n/g, ' ') : '(なし)')
