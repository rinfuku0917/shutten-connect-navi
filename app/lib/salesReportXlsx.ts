// 施設・企業へ提出する「売上報告」のExcelを作る。
//
// 出店者から届いた報告（売上・品目ごとの販売食数・天候・来客数・所感）を、
// 出店者情報の提出用Excelと同じ体裁でまとめる。
//   ・開催日ごとに1シート（シート名は「９月１日（火）」の形）
//   ・1シートの中に、その日の出店者を「売上報告⑴⑵⑶…」と縦に並べる
//   ・各出店者: 店舗名 / 売上金額 / 販売食数の合計 / 天候 / 来客数
//     → 販売実績（品目名・単価・販売数）→ 所感
//
// 見た目は出店者情報のExcelに合わせている（Hiragino Mincho ProN 12pt・
// 全セル細線・列幅 A=28 / B=38 / C=16）。

import { jaSheetName } from './submissionXlsx'

export type SalesReportItem = { name: string; price: number | null; qty: number }
export type SalesReportSeller = {
  shopName: string
  revenue: number
  weather: string
  customers: number | null
  note: string
  items: SalesReportItem[]
}
export type SalesReportSheet = { title: string; sellers: SalesReportSeller[] }

function marukakko(n: number): string {
  if (n >= 1 && n <= 20) return String.fromCharCode(0x2474 + n - 1)
  return `(${n})`
}

export async function buildSalesReportWorkbook(sheets: SalesReportSheet[]) {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()

  const FONT = { name: 'Hiragino Mincho ProN', size: 12 }
  const BOLD = { ...FONT, bold: true }
  const THIN = { style: 'thin' as const }
  const BORDER = { top: THIN, bottom: THIN, left: THIN, right: THIN }
  const FILL_HEAD = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFBDD7EE' } }
  const FILL_SUB = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFDEEAF1' } }
  const ALIGN = { horizontal: 'left' as const, vertical: 'middle' as const }

  for (const sheet of sheets) {
    const ws = wb.addWorksheet(sheet.title.slice(0, 31))
    ws.columns = [{ width: 28 }, { width: 38 }, { width: 16 }]

    let r = 1
    const setRow = (vals: [string, string, string], opts?: { bold?: boolean; fill?: typeof FILL_HEAD; mergeAll?: boolean; mergeBC?: boolean; tall?: boolean }) => {
      const row = ws.getRow(r)
      row.height = opts?.tall ? 24 : 22
      for (let c = 1; c <= 3; c++) {
        const cell = row.getCell(c)
        cell.value = vals[c - 1]
        cell.font = opts?.bold ? BOLD : FONT
        cell.border = BORDER
        cell.alignment = ALIGN
        if (opts?.fill) cell.fill = opts.fill
      }
      if (opts?.mergeAll) ws.mergeCells(r, 1, r, 3)
      else if (opts?.mergeBC) ws.mergeCells(r, 2, r, 3)
      r += 1
    }

    sheet.sellers.forEach((s, i) => {
      const totalQty = s.items.reduce((t, it) => t + (it.qty || 0), 0)
      setRow([`売上報告${marukakko(i + 1)}`, '', ''], { bold: true, fill: FILL_HEAD, mergeAll: true, tall: true })
      setRow(['店舗名', s.shopName, ''], { mergeBC: true })
      setRow(['売上金額', s.revenue.toLocaleString() + '円', ''], { mergeBC: true })
      setRow(['販売食数（合計）', totalQty > 0 ? totalQty + '食' : '—', ''], { mergeBC: true })
      setRow(['天候', s.weather || '—', ''], { mergeBC: true })
      setRow(['来客数', s.customers != null ? String(s.customers) : '—', ''], { mergeBC: true })

      setRow(['販売実績', '', ''], { bold: true, fill: FILL_HEAD, mergeAll: true })
      setRow(['メニュー名', '（単価）', '販売数'], { bold: true, fill: FILL_SUB })
      if (s.items.length === 0) {
        setRow(['（品目別の報告はありません）', '', ''], { mergeAll: true })
      } else {
        for (const it of s.items) {
          setRow([it.name, it.price != null ? it.price.toLocaleString() + '円' : '', it.qty + '食'])
        }
      }
      if (s.note) {
        setRow(['所感・特記事項', '', ''], { bold: true, fill: FILL_HEAD, mergeAll: true })
        setRow([s.note, '', ''], { mergeAll: true })
      }
    })
  }
  return wb
}

// 案件の売上報告を集めてExcelでダウンロードする。
// 戻り値: 出力した日数（0 = 報告がまだ無い）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function exportPlaceSalesReport(supabase: any, placeId: string, placeTitle: string): Promise<number> {
  const { data, error } = await supabase
    .from('sales')
    .select('sale_date, revenue, items, weather, customers, note, seller_id')
    .eq('place_id', placeId)
    .order('sale_date', { ascending: true })
  if (error) throw new Error('売上の取得に失敗しました: ' + error.message)
  if (!data || data.length === 0) return 0

  // 出店者の表示名は公開用のビューから引く。
  // profiles には連絡先が入っているため、募集者からは直接読ませない。
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sellerIds = Array.from(new Set((data as any[]).map(s => s.seller_id).filter(Boolean)))
  const nameById = new Map<string, string>()
  if (sellerIds.length > 0) {
    const { data: sellers } = await supabase
      .from('public_sellers').select('id, name, shop_name').in('id', sellerIds)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const x of (sellers ?? []) as any[]) {
      nameById.set(x.id, x.shop_name || x.name || '(出店者)')
    }
  }

  const byDate = new Map<string, SalesReportSeller[]>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const s of data as any[]) {
    if (!s.sale_date) continue
    const seller: SalesReportSeller = {
      shopName: nameById.get(s.seller_id) || '(出店者)',
      revenue: s.revenue || 0,
      weather: s.weather || '',
      customers: s.customers ?? null,
      note: s.note || '',
      items: Array.isArray(s.items)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? (s.items as any[]).map(it => ({ name: it.name || '', price: it.price ?? null, qty: it.qty || 0 })).filter(it => it.name)
        : [],
    }
    const list = byDate.get(s.sale_date) || []
    list.push(seller)
    byDate.set(s.sale_date, list)
  }

  const dates = Array.from(byDate.keys()).sort()
  if (dates.length === 0) return 0
  const sheets: SalesReportSheet[] = dates.map(d => ({ title: jaSheetName(d), sellers: byDate.get(d)! }))

  const months = Array.from(new Set(dates.map(d => Number(d.slice(5, 7)) + '月'))).join('')
  const safeTitle = placeTitle.replace(/[\\/:*?"<>|]/g, '')

  const wb = await buildSalesReportWorkbook(sheets)
  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${safeTitle}_売上報告_${months}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
  return dates.length
}
