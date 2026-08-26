// キッチンカーの車両サイズの表記をそろえるためのまとめ。
//
// 出店者ごとに「2.5」「250cm」「3440」と入れ方がばらばらだと、
// 募集者が案件のスペースに入るかどうかを見比べられない。
// 業界で使われている書き方に合わせて、次の形に統一する。
//
//   全長 3,440mm、全幅 1,520mm、高さ 2,460mm
//
// 入力欄は mm の数字だけを受け取るが、これまでに単位ちがいで
// 入れられた値も残っているため、読み取るときに mm へそろえる。

// 入力された文字を mm の数値に直す。数字が読み取れなければ null。
export function toMm(raw: string | null | undefined): number | null {
  if (raw == null) return null
  const s = String(raw).trim().replace(/[,，\s]/g, '').replace(/[０-９．]/g, c =>
    c === '．' ? '.' : String.fromCharCode(c.charCodeAt(0) - 0xfee0))
  if (!s) return null
  const m = s.match(/^([0-9]*\.?[0-9]+)\s*(mm|cm|m|ミリ|センチ|メートル)?$/i)
  if (!m) return null
  const n = parseFloat(m[1])
  if (!isFinite(n) || n <= 0) return null

  const unit = (m[2] || '').toLowerCase()
  if (unit === 'mm' || unit === 'ミリ') return Math.round(n)
  if (unit === 'cm' || unit === 'センチ') return Math.round(n * 10)
  if (unit === 'm' || unit === 'メートル') return Math.round(n * 1000)

  // 単位なしの場合は、キッチンカーとしてありえる大きさから単位を推測する。
  //   3.44 → メートル / 344 → センチ / 3440 → ミリ
  if (n < 100) return Math.round(n * 1000)
  if (n < 1000) return Math.round(n * 10)
  return Math.round(n)
}

// 3440 → "3,440mm"
export function formatMm(mm: number | null): string {
  return mm == null ? '' : mm.toLocaleString() + 'mm'
}

// 「全長 3,440mm、全幅 1,520mm、高さ 2,460mm」の形にする。
// 入っていない項目は飛ばし、3つとも空なら空文字を返す。
export function formatVehicleSize(
  length: string | null | undefined,
  width: string | null | undefined,
  height: string | null | undefined,
): string {
  const parts: string[] = []
  const add = (label: string, raw: string | null | undefined) => {
    const mm = toMm(raw)
    if (mm != null) parts.push(`${label} ${formatMm(mm)}`)
  }
  add('全長', length)
  add('全幅', width)
  add('高さ', height)
  return parts.join('、')
}
