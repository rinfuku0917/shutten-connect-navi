import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

let all = [], from = 0
for (;;) {
  const { data, error } = await sb.from('posts')
    .select('slug,title,status,content').order('slug').range(from, from + 499)
  if (error) { console.error(error); process.exit(1) }
  all = all.concat(data); if (data.length < 500) break; from += 500
}

// 記事本文どうしの内部リンク（アンカーテキスト付き）を洗う
console.log('=== 本文中の /blog/ 内部リンク ===')
for (const p of all) {
  const re = /\[([^\]]*)\]\((\/blog\/[a-z0-9-]+)\)/g
  let m
  while ((m = re.exec(p.content))) {
    console.log(`${p.slug} --[${m[1]}]--> ${m[2]}`)
  }
}

// host-fee-setting-guide への言及（生URL含む）
console.log('\n=== "host-fee-setting-guide" の文字列を含む記事 ===')
for (const p of all) {
  if (p.content.includes('host-fee-setting-guide')) {
    for (const line of p.content.split('\n')) {
      if (line.includes('host-fee-setting-guide')) console.log(`${p.slug}: ${line.trim()}`)
    }
  }
}

// 301 元がまだ published のままかを確認
console.log('\n=== 301転送元の状態 ===')
for (const p of all.filter(p => p.slug === 'how-to-find-food-truck-spots')) {
  console.log(p.slug, p.status)
}

console.log('\n=== 全記事 slug / status / title ===')
for (const p of all) console.log(`${p.status}\t${p.slug}\t${p.title}`)
