// 差し替えたアイコンが、実際のサイトで何ピクセルで描かれるかを並べて見せる。
//
//   node scripts/preview-assets.mjs
//
// サイトは objectFit:contain の正方形の枠にアイコンを入れている。
// 絵の形（横長・縦長）によって、枠に対する描画サイズが変わるため、
// 素材ごとに見た目の大きさが揃わないことがある。それを目で確かめるための画像。

import sharp from 'sharp'
import path from 'path'

// [見出し, 枠の1辺(px), [ファイル, ラベル]...]
const SETS = [
  ['1. トップ上部（枠 52px）', 52, [
    ['ic-top-sellers.webp', '登録出店者'],
    ['ic-top-places.webp', '出店場所'],
    ['ic-top-line.webp', 'LINE登録'],
    ['ic-top-area.webp', '対応エリア'],
  ]],
  ['2. 車両を売りたい方（高さ 80px）', 80, [
    ['ic2-truck.webp', '無料で掲載（既存）'],
    ['ic2-photo.webp', '写真で魅力を伝える'],
    ['ic2-nego.webp', '直接交渉'],
    ['ic2-safe.webp', '安心取引'],
  ]],
  ['3. 出店したい方へ（枠 72px）', 72, [
    ['ic-space-location.webp', '好立地の場所'],
    ['ic-space-cost.webp', '費用を比較'],
    ['ic-space-match.webp', '安心のマッチング'],
    ['ic-space-mobile.webp', 'スマホで完結'],
  ]],
]

const SCALE = 3        // 見やすいように3倍で描く
const CELL = 130       // 1マスの幅（拡大前）
const ROW_H = 150      // 1行の高さ（拡大前）

const rows = []
for (const [title, box, items] of SETS) {
  const cells = []
  for (const [file, label] of items) {
    const src = path.join('public', file)
    const m = await sharp(src).metadata()
    // サイトと同じ計算（枠に収める）
    const s = Math.min(box / m.width, box / m.height)
    const w = Math.round(m.width * s), h = Math.round(m.height * s)
    const img = await sharp(src).resize(w * SCALE, h * SCALE).png().toBuffer()
    cells.push({ img, w: w * SCALE, h: h * SCALE, label, size: `${w}x${h}` })
  }
  rows.push({ title, box, cells })
}

const W = CELL * 4 * SCALE
const H = rows.length * ROW_H * SCALE
const svgText = (t, x, y, size, color = '#333', weight = 400) =>
  `<text x="${x}" y="${y}" font-family="Hiragino Sans, sans-serif" font-size="${size}" fill="${color}" font-weight="${weight}" text-anchor="middle">${t}</text>`

const labels = []
const composites = []
rows.forEach((row, ri) => {
  const top = ri * ROW_H * SCALE
  labels.push(`<text x="20" y="${top + 34}" font-family="Hiragino Sans, sans-serif" font-size="26" fill="#B45309" font-weight="700">${row.title}</text>`)
  // 枠を描く
  row.cells.forEach((c, ci) => {
    const cx = (ci * CELL + CELL / 2) * SCALE
    const boxPx = row.box * SCALE
    const bx = cx - boxPx / 2, by = top + 60
    labels.push(`<rect x="${bx}" y="${by}" width="${boxPx}" height="${boxPx}" fill="none" stroke="#DDD" stroke-dasharray="6 4"/>`)
    composites.push({ input: c.img, left: Math.round(cx - c.w / 2), top: Math.round(by + (boxPx - c.h) / 2) })
    labels.push(svgText(c.label, cx, top + 60 + boxPx + 30, 20, '#333', 700))
    labels.push(svgText(`実際に描かれる ${c.size}`, cx, top + 60 + boxPx + 56, 17, '#888'))
  })
})

const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg"><rect width="${W}" height="${H}" fill="#fff"/>${labels.join('')}</svg>`
await sharp(Buffer.from(svg)).composite(composites).png()
  .toFile('/tmp/icon-preview.png')
console.log('/tmp/icon-preview.png を作りました')
