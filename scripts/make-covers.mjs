// 記事の表紙画像を作る。
//
//   node scripts/make-covers.mjs
//
// 本文に画像が無い記事は、一覧のサムネイルが絵文字になってしまう
// （app/blog/page.tsx と app/page.tsx が本文の1枚目の画像を使うため）。
// 絵柄が無いと一覧で目が止まらないので、表紙を用意する。
//
// 素材は、提供いただいたアイコンのイラストを流用する。
// サイトの配色（クリーム〜うすい金）の背景に載せて、記事の表紙らしい形にする。
// SNSで共有したときのサムネイル（og:image）にもこれが使われる。

import sharp from 'sharp'
import fs from 'fs'
import path from 'path'

const SRC = '/Users/hidekifukusada/Desktop/HP素材/コネクトナビ素材/サイト素材提出_2026-09-02'
const OUT = 'public/covers'
const W = 1200, H = 630   // SNSの共有で使われる比率（1.91:1）

// [記事のslug, 使うイラスト, 背景の色2つ]
const COVERS = [
  ['food-truck-fee-guide',
   '出店場所を探したい方への箇所、アイコン③/費用比較アイコン②.png',
   ['#FFF6E5', '#FFE3B0']],
  ['weekday-food-truck-spots',
   '出店場所を探したい方への箇所、アイコン③/高立地の場所を簡単発見①.png',
   ['#EAF3FB', '#CFE3F5']],
  ['get-food-truck-offers',
   '出店場所を探したい方への箇所、アイコン③/安心のマッチングアイコン③.png',
   ['#FDF0E8', '#F8D9C4']],
  ['kitchen-car-required-documents',
   '車両を売りたい方へのフォルダ②/直接交渉アイコン③.png',
   ['#EDF5EF', '#CFE6D6']],
]

fs.mkdirSync(OUT, { recursive: true })

for (const [slug, rel, [c1, c2]] of COVERS) {
  const src = path.join(SRC, rel)
  if (!fs.existsSync(src)) { console.error(`  素材が見つからない: ${rel}`); continue }

  // 透明の余白を切り、高さの7割ほどに収める
  const art = await sharp(src).trim({ threshold: 10 })
    .resize({ width: Math.round(W * 0.52), height: Math.round(H * 0.72), fit: 'inside' })
    .toBuffer()
  const m = await sharp(art).metadata()

  // 背景。斜めのグラデーションと、イラストの後ろに置く薄い円
  const bg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/>
    </linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#g)"/>
    <circle cx="${W / 2}" cy="${H / 2}" r="${H * 0.42}" fill="#ffffff" opacity="0.42"/>
  </svg>`

  const dest = path.join(OUT, `${slug}.webp`)
  await sharp(Buffer.from(bg))
    .composite([{ input: art, left: Math.round((W - m.width) / 2), top: Math.round((H - m.height) / 2) }])
    .webp({ quality: 84 })
    .toFile(dest)

  console.log(`  ${String(Math.round(fs.statSync(dest).size / 1024)).padStart(3)}KB  ${slug}.webp`)
}
