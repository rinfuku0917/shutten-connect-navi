// 提供されたイラスト（PNG）を、サイトに載せる形に変換する。
//
//   node scripts/convert-assets.mjs <素材フォルダ>
//
// もとの素材は1枚あたり1080x1080・400KB〜1.4MB。
// 表示は52〜80pxなので、そのまま載せると無駄に重い。
//
// アイコンは上下左右に大きな透明の余白が付いていて、
// そのまま縮めると絵が小さく見えてしまう。余白を切り落としてから縮める。
// バナーは全面が絵なので余白は切らない。
//
// 出力先は public/。変換後は1枚10〜30KB程度になる。

import sharp from 'sharp'
import fs from 'fs'
import path from 'path'

const SRC = process.argv[2]
if (!SRC) { console.error('使い方: node scripts/convert-assets.mjs <素材フォルダ>'); process.exit(1) }

// [もとのファイル, 出力名, 長辺の大きさ, 余白を切るか]
const JOBS = [
  // 下部「まずは無料で会員登録」の上のバナー
  ['新サイト下部の「まずは無料で会員登録」のバナー差し替え/新サイト一番下の「まずは無料で会員登録」のバナーの差し替え.png',
   'signup-banner.webp', 720, false],

  // ① トップ上部の4つ（表示52px）
  ['新サイト上部の4つのアイコンフォルダ①/登録出店者アイコン①.png',   'ic-top-sellers.webp', 240, true],
  ['新サイト上部の4つのアイコンフォルダ①/登録出店者アイコン② .png',  'ic-top-places.webp',  240, true],
  ['新サイト上部の4つのアイコンフォルダ①/LINE登録アイコン③.png',     'ic-top-line.webp',    240, true],
  ['新サイト上部の4つのアイコンフォルダ①/全国対応アイコン④ .png',    'ic-top-area.webp',    240, true],

  // ② 車両を売りたい方（表示80px）。「無料で掲載」は素材が無いので既存のまま
  ['車両を売りたい方へのフォルダ②/写真で魅力を伝えるアイコン② .png', 'ic2-photo.webp', 240, true],
  ['車両を売りたい方へのフォルダ②/直接交渉アイコン③.png',            'ic2-nego.webp',  240, true],
  ['車両を売りたい方へのフォルダ②/安心取引アイコン④.png',            'ic2-safe.webp',  240, true],

  // ③ 出店したい方へ（表示72px）
  ['出店場所を探したい方への箇所、アイコン③/高立地の場所を簡単発見①.png', 'ic-space-location.webp', 240, true],
  ['出店場所を探したい方への箇所、アイコン③/費用比較アイコン②.png',       'ic-space-cost.webp',     240, true],
  ['出店場所を探したい方への箇所、アイコン③/安心のマッチングアイコン③.png', 'ic-space-match.webp',   240, true],
  ['出店場所を探したい方への箇所、アイコン③/スマホで完結アイコン④ .png',   'ic-space-mobile.webp',  240, true],
]

let before = 0, after = 0
for (const [rel, out, size, doTrim] of JOBS) {
  const src = path.join(SRC, rel)
  if (!fs.existsSync(src)) { console.error(`  見つからない: ${rel}`); continue }
  before += fs.statSync(src).size

  let img = sharp(src)
  // 透明の余白を切り落とす。絵が枠いっぱいに入るようにするため
  if (doTrim) img = img.trim({ threshold: 10 })
  img = img.resize({ width: size, height: size, fit: 'inside', withoutEnlargement: true })

  const dest = path.join('public', out)
  await img.webp({ quality: 82 }).toFile(dest)

  const m = await sharp(dest).metadata()
  const kb = fs.statSync(dest).size
  after += kb
  console.log(`  ${String(Math.round(kb / 1024)).padStart(3)}KB  ${m.width}x${m.height}  ${out}`)
}
console.log(`\nもと ${(before / 1048576).toFixed(1)}MB → ${(after / 1024).toFixed(0)}KB`)
