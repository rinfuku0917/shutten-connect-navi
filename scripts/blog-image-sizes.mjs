// 記事の本文に入っている画像の、もとの大きさを調べて一覧を作る。
//
//   npm run blog:images
//
// できあがるのは app/lib/postImageSizes.ts。
// 記事の表示で、img に width と height を入れるために使う。
// これが無いと、画像を読み込むまで高さが 0 のままで、
// 読み込んだ瞬間に本文が下へ飛ぶ（読んでいる行を見失う）。
//
// 本文のマークダウンには大きさが書けないので、ここで実物を見て記録する。
// 記事に画像を足したら、このコマンドをもう一度実行すること。
// 一覧に無い画像は、これまでどおり大きさ無しで表示される（表示は崩れない）。

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
)
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
})

// PNG と JPEG のヘッダから、幅と高さを読む。
// 画像全体を読み込まずに済むよう、先頭だけを見る。
function readSize(buf) {
  if (buf[0] === 0x89 && buf[1] === 0x50) {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }
  }
  if (buf[0] === 0xFF && buf[1] === 0xD8) {
    let i = 2
    while (i < buf.length - 8) {
      if (buf[i] !== 0xFF) { i += 1; continue }
      const marker = buf[i + 1]
      // SOF0〜SOF15。ただし DHT(C4) DNL(C8) DAC(CC) は大きさを持たない
      if (marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
        return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) }
      }
      i += 2 + buf.readUInt16BE(i + 2)
    }
  }
  return null
}

const { data: posts, error } = await db.from('posts').select('slug, content')
if (error) { console.error('記事を取れませんでした:', error.message); process.exit(1) }

const urls = new Set()
for (const p of posts ?? []) {
  const c = String(p.content ?? '')
  for (const m of c.matchAll(/!\[[^\]]*\]\((https?:\/\/[^)\s]+)\)/g)) urls.add(m[1])
  for (const m of c.matchAll(/<img[^>]+src=["'](https?:\/\/[^"']+)["']/g)) urls.add(m[1])
}

const sizes = {}
let failed = 0
for (const url of [...urls].sort()) {
  try {
    const res = await fetch(url)
    if (!res.ok) { console.error(`  取得できず(${res.status}): ${url}`); failed += 1; continue }
    const size = readSize(Buffer.from(await res.arrayBuffer()))
    if (!size) { console.error(`  大きさを読めず: ${url}`); failed += 1; continue }
    sizes[url] = size
  } catch (e) {
    console.error(`  取得できず: ${url} (${e.message})`)
    failed += 1
  }
}

const body = Object.entries(sizes)
  .map(([url, s]) => `  '${url}': { w: ${s.w}, h: ${s.h} },`)
  .join('\n')

const out = `// このファイルは自動生成です。手で書き換えないこと。
//   npm run blog:images
//
// 記事の本文に入っている画像の、もとの大きさ。
// 表示するときに width と height を入れて、読み込み時に本文がずれないようにする。
// 記事に画像を足したら、上のコマンドをもう一度実行して作り直す。

export type ImageSize = { w: number; h: number }

export const POST_IMAGE_SIZES: Record<string, ImageSize> = {
${body}
}
`
fs.writeFileSync(path.join('app', 'lib', 'postImageSizes.ts'), out)
console.log(`画像 ${Object.keys(sizes).length} 枚の大きさを記録しました${failed ? `（${failed}枚は読めず）` : ''}`)
