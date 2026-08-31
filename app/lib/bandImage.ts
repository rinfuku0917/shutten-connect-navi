// 案件の写真に、案件名の帯を入れる。
//
// 一覧に並んだときの見え方をそろえるためのもの。
// 写真の縦横比がばらばらだと大きさが揃わないので、
// 600×450（4:3）に切り出したうえで、中央より少し上に帯を敷く。
//
// 寸法は、すでに掲載している写真に合わせてある。
//   帯の高さ … 画像の11.6%
//   帯の位置 … 上から44.2%
//   帯の色   … 濃紺の半透明

const W = 600
const H = 450
const BAND_TOP = 0.442
const BAND_H = 0.116
// 日本語が出るフォントを順に試す。端末に無い場合は次を使う。
const FONT_STACK = '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic", sans-serif'

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('画像を読み込めませんでした')) }
    img.src = url
  })
}

/**
 * 写真を600×450に切り出し、帯と文字を入れた新しいファイルを返す。
 * label が空のときは帯を入れず、切り出しだけ行う。
 */
export async function addBand(file: File, label: string): Promise<File> {
  const img = await loadImage(file)

  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return file

  // 縦横比を保ったまま、はみ出す分を切り落とす
  const scale = Math.max(W / img.width, H / img.height)
  const dw = img.width * scale
  const dh = img.height * scale
  // 空より被写体が写るよう、中央より少し上を残す
  ctx.drawImage(img, (W - dw) / 2, (H - dh) * 0.42, dw, dh)

  const text = label.trim()
  if (text) {
    const bandH = Math.round(H * BAND_H)
    const bandY = Math.round(H * BAND_TOP)
    ctx.fillStyle = 'rgba(17,28,40,0.85)'
    ctx.fillRect(0, bandY, W, bandH)

    // 帯に収まる大きさまで、文字を少しずつ小さくする
    let size = 34
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    while (size > 14) {
      ctx.font = `700 ${size}px ${FONT_STACK}`
      if (ctx.measureText(text).width <= W - 60) break
      size -= 1
    }
    ctx.fillStyle = '#ffffff'
    ctx.fillText(text, W / 2, bandY + bandH / 2, W - 40)
  }

  const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, 'image/jpeg', 0.9))
  if (!blob) return file
  const name = file.name.replace(/\.[^.]+$/, '') + '.jpg'
  return new File([blob], name, { type: 'image/jpeg' })
}
