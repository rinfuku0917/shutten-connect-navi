// 施設・企業へ提出する「売上報告」のExcelを作る。
//
// なぜ要るか（2026-09-26 の運営からの依頼）:
//   ドン・キホーテやOlympicのように、施設側が売上管理の仕組みを持たない出店先が増えている。
//   弊社が売上管理を代行している建付けなので、売上や食数を取りまとめて
//   定期的に提出する必要がある。これまでは運営が手で表を作っていた。
//
// 何を出すか:
//   1行＝1日の出店。列は
//     売上日 / 出店場所 / 出店者 / 売上 / 食数 / 来客 / 天候 /
//     出店料（税抜）/ 企業お支払い / 弊社取り分 / 備考
//   最後に合計の行を入れる。合計は数字を焼き込まず SUM の式にしてある
//   （提出後に施設側が行を消したり足したりしても、合計がずれない）。
//
// 見た目は app/lib/submissionXlsx.ts の「出店者情報」の様式にそろえている
//   フォント: Hiragino Mincho ProN 12pt（明細は 11pt）／ 罫線: 全セル細線
//   見出しの塗り: D9E1F2 ／ 合計行の塗り: EDF2F9
//   金額は「¥1,234」、食数・来客は「1,234」の表示形式にする。
//   文字で入れると施設側で足し算できないため、値は必ず数値で入れる。

export type SalesXlsxRow = {
  /** 2026-09-25 の形 */
  date: string
  placeTitle: string
  /** 屋号。未登録なら代表者名 */
  shopName: string
  revenue: number
  /** 出店料の合計（出店者が払う額・税抜） */
  totalPay: number
  /** 企業（施設）へお支払いする分 */
  placeFee: number
  /** 弊社の取り分 */
  companyFee: number
  /** 販売食数。報告に入っていなければ null */
  qty: number | null
  customers: number | null
  weather: string
  note: string
}

export type SalesXlsxInput = {
  /** 提出先の企業名。「○○御中」として先頭に入れる。空なら行を出さない */
  facilityName: string
  /** 「2026年9月分」など */
  periodLabel: string
  /** 「さいたま看護専門学校」など。1案件にしぼったときだけ入れる */
  subtitle?: string
  rows: SalesXlsxRow[]
}

const HEADERS = [
  '売上日', '出店場所', '出店者', '売上', '食数', '来客', '天候',
  '出店料（税抜）', '企業お支払い', '弊社取り分', '備考',
] as const

/** 列の幅。提出したときに折り返さない幅にしてある */
const WIDTHS = [12, 26, 22, 12, 8, 8, 10, 14, 14, 12, 34]

/** 金額の列（1から数えた番号）。表示形式と合計の式に使う */
const YEN_COLS = [4, 8, 9, 10]
/** 個数の列 */
const NUM_COLS = [5, 6]

export async function buildSalesWorkbook(input: SalesXlsxInput) {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('売上報告')

  const FONT = { name: 'Hiragino Mincho ProN', size: 12 }
  const BODY = { name: 'Hiragino Mincho ProN', size: 11 }
  const BOLD = { ...FONT, bold: true }
  const THIN = { style: 'thin' as const }
  const BORDER = { top: THIN, bottom: THIN, left: THIN, right: THIN }
  const FILL_HEAD = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFD9E1F2' } }
  const FILL_SUM = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFEDF2F9' } }
  const YEN_FMT = '"¥"#,##0'
  const NUM_FMT = '#,##0'

  ws.columns = WIDTHS.map(width => ({ width }))
  const last = HEADERS.length

  let r = 1
  // 宛名と対象月。提出したときに「どこ向けの何月ぶんか」が1行で分かるようにする
  if (input.facilityName.trim()) {
    const cell = ws.getRow(r).getCell(1)
    cell.value = input.facilityName.trim() + '　御中'
    cell.font = { ...BOLD, size: 14 }
    ws.getRow(r).height = 24
    ws.mergeCells(r, 1, r, last)
    r += 1
  }
  {
    const cell = ws.getRow(r).getCell(1)
    cell.value = '売上報告　' + input.periodLabel + (input.subtitle ? '　（' + input.subtitle + '）' : '')
    cell.font = BOLD
    ws.getRow(r).height = 22
    ws.mergeCells(r, 1, r, last)
    r += 1
  }
  r += 1 // 1行あける

  // 見出し
  {
    const row = ws.getRow(r)
    row.height = 24
    HEADERS.forEach((h, i) => {
      const cell = row.getCell(i + 1)
      cell.value = h
      cell.font = BOLD
      cell.border = BORDER
      cell.fill = FILL_HEAD
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }
    })
    r += 1
  }
  const firstData = r

  // 明細。売上日の古い順にして、提出物として読みやすくする
  const rows = [...input.rows].sort((a, b) =>
    a.date.localeCompare(b.date) || a.placeTitle.localeCompare(b.placeTitle) || a.shopName.localeCompare(b.shopName))
  for (const d of rows) {
    const row = ws.getRow(r)
    row.height = 20
    const vals: (string | number | null)[] = [
      d.date, d.placeTitle, d.shopName,
      d.revenue, d.qty, d.customers, d.weather,
      d.totalPay, d.placeFee, d.companyFee, d.note,
    ]
    vals.forEach((v, i) => {
      const cell = row.getCell(i + 1)
      cell.value = v == null || v === '' ? null : v
      cell.font = BODY
      cell.border = BORDER
      const c = i + 1
      if (YEN_COLS.includes(c)) { cell.numFmt = YEN_FMT; cell.alignment = { horizontal: 'right', vertical: 'middle' } }
      else if (NUM_COLS.includes(c)) { cell.numFmt = NUM_FMT; cell.alignment = { horizontal: 'right', vertical: 'middle' } }
      else cell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: c === 11 }
    })
    r += 1
  }
  const lastData = r - 1

  // 合計。数字を焼き込まず SUM の式にする（提出後に行を触っても合計が合う）
  {
    const row = ws.getRow(r)
    row.height = 24
    for (let c = 1; c <= last; c++) {
      const cell = row.getCell(c)
      cell.font = BOLD
      cell.border = BORDER
      cell.fill = FILL_SUM
      if (c === 1) { cell.value = '合計'; cell.alignment = { horizontal: 'center', vertical: 'middle' } }
      else if (YEN_COLS.includes(c) || NUM_COLS.includes(c)) {
        const col = ws.getColumn(c).letter
        // 明細が0件のときに SUM の範囲が壊れるので、そのときは0を入れる
        cell.value = rows.length > 0 ? { formula: `SUM(${col}${firstData}:${col}${lastData})` } : 0
        cell.numFmt = YEN_COLS.includes(c) ? YEN_FMT : NUM_FMT
        cell.alignment = { horizontal: 'right', vertical: 'middle' }
      } else {
        cell.value = null
        cell.alignment = { horizontal: 'left', vertical: 'middle' }
      }
    }
    r += 1
  }

  // 見出しを固定して、行が多くても列名が見えるようにする
  ws.views = [{ state: 'frozen', ySplit: firstData - 1 }]
  return wb
}

/** ファイル名に使えない文字を落とす */
export function safeFileName(s: string): string {
  return (s || '').replace(/[\\/:*?"<>|]/g, '_').trim() || '売上報告'
}

export async function downloadSalesXlsx(input: SalesXlsxInput, fileName: string) {
  const wb = await buildSalesWorkbook(input)
  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}
