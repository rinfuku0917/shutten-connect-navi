// 施設・企業へ提出する「出店者情報」のExcelを作る。
//
// これまで運営が手作業で作っていた提出用Excelと同じ様式で出力する。
//   ・開催日ごとに1シート（シート名は「９月１日（火）」の形）
//   ・1シートの中に、その日の出店者を「出店者情報⑴⑵⑶…」と縦に並べる
//   ・各出店者: 店舗名 / Instagram / ジャンル / テイクアウト時／袋 /
//     利用可能決済 → 販売メニュー（メニュー名・詳細・価格）
//
// 見た目（フォント・色・罫線・列幅）は実際に提出しているファイルから
// 読み取った値に合わせている。変えるときは元のExcelと見比べること。
//   フォント: Hiragino Mincho ProN 12pt ／ 罫線: 全セル細線
//   列幅: A=31.5 / B=38 / C=16 ／ 行高: 22（「出店者情報⑴」の見出し行のみ24）
//   見出しの塗り: 出店者情報・販売メニュー = BDD7EE、メニュー表ヘッダ = DEEAF1

export type SubmissionMenuItem = { name: string; detail: string; price: string }
export type SubmissionSeller = {
  shopName: string
  instagram: string
  genre: string
  takeoutBag: string
  payments: string
  menus: SubmissionMenuItem[]
}
export type SubmissionSheet = { title: string; sellers: SubmissionSeller[] }

// 「2026-09-01」→「９月１日（火）」（提出ファイルのシート名の形）
export function jaSheetName(dateIso: string): string {
  const d = new Date(dateIso + 'T00:00:00')
  if (isNaN(d.getTime())) return dateIso
  const zen = (n: number) => String(n).replace(/[0-9]/g, c => '０１２３４５６７８９'[Number(c)])
  const wd = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()]
  return `${zen(d.getMonth() + 1)}月${zen(d.getDate())}日（${wd}）`
}

// 出店者情報⑴⑵… の丸括弧数字。21以降は (21) で代用する
function marukakko(n: number): string {
  if (n >= 1 && n <= 20) return String.fromCharCode(0x2474 + n - 1)
  return `(${n})`
}

// profiles.genre はJSON文字列の配列で入っていることがあるため表示用に直す
export function genreLabel(raw: string | null | undefined): string {
  if (!raw) return ''
  try {
    const a = JSON.parse(raw)
    if (Array.isArray(a)) return a.join('・')
  } catch { /* 文字列のまま */ }
  return String(raw)
}

export function paymentsLabel(raw: unknown): string {
  if (Array.isArray(raw)) return raw.filter(Boolean).join('・')
  return raw ? String(raw) : ''
}

export function menuPriceLabel(price: number | null | undefined): string {
  return price == null ? '' : price.toLocaleString() + '円'
}

// 案件の承認済み出店者を集めて提出用Excelをダウンロードする。
// 管理画面と募集者ダッシュボードの両方から使う（内容は同じ）。
// 戻り値: 出力した日数（0 = 出力するものが無かった）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function exportPlaceSubmission(supabase: any, placeId: string, placeTitle: string): Promise<number> {
  const { data: apps, error } = await supabase
    .from('applications')
    .select('apply_date, seller_id, profiles!applications_seller_id_fkey(shop_name, name, genre, takeout_bag, payment_methods)')
    .eq('place_id', placeId)
    .eq('status', 'approved')
    .not('apply_date', 'is', null)
    .order('apply_date', { ascending: true })
  if (error) throw new Error('申込の取得に失敗しました: ' + error.message)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows = (apps || []).filter((a: any) => a.apply_date && a.seller_id)
  if (rows.length === 0) return 0

  // Instagram とメニューをまとめて引く
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sellerIds = Array.from(new Set(rows.map((a: any) => a.seller_id)))
  const [{ data: sns }, { data: menuRows }] = await Promise.all([
    supabase.from('sns_links').select('seller_id, url').eq('platform', 'instagram').in('seller_id', sellerIds),
    supabase.from('menus').select('seller_id, name, detail, price, sort_order, created_at')
      .in('seller_id', sellerIds)
      .order('sort_order', { ascending: true }).order('created_at', { ascending: true }),
  ])
  const instaBySeller = new Map<string, string>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const l of sns || []) if (l.url) instaBySeller.set(l.seller_id, l.url)
  const menusBySeller = new Map<string, SubmissionMenuItem[]>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const m of menuRows || []) {
    const list = menusBySeller.get(m.seller_id) || []
    list.push({ name: m.name || '', detail: m.detail || '', price: menuPriceLabel(m.price) })
    menusBySeller.set(m.seller_id, list)
  }

  // 日付ごとにシートを作る（同じ出店者が同じ日に重複していたら1回にする）
  const byDate = new Map<string, SubmissionSeller[]>()
  const seen = new Set<string>()
  for (const a of rows) {
    const key = a.apply_date + '|' + a.seller_id
    if (seen.has(key)) continue
    seen.add(key)
    const p = a.profiles || {}
    const seller: SubmissionSeller = {
      shopName: p.shop_name || p.name || '',
      instagram: instaBySeller.get(a.seller_id) || '',
      genre: genreLabel(p.genre),
      takeoutBag: p.takeout_bag || '',
      payments: paymentsLabel(p.payment_methods),
      menus: menusBySeller.get(a.seller_id) || [],
    }
    const list = byDate.get(a.apply_date) || []
    list.push(seller)
    byDate.set(a.apply_date, list)
  }

  const dates = Array.from(byDate.keys()).sort()
  const sheets: SubmissionSheet[] = dates.map(d => ({ title: jaSheetName(d), sellers: byDate.get(d)! }))

  // ファイル名は「案件名_出店者情報_9月10月.xlsx」の形
  const months = Array.from(new Set(dates.map(d => Number(d.slice(5, 7)) + '月'))).join('')
  const safeTitle = placeTitle.replace(/[\\/:*?"<>|]/g, '')
  await downloadSubmissionXlsx(sheets, `${safeTitle}_出店者情報_${months}.xlsx`)
  return dates.length
}

// Excelを組み立てる（ダウンロードと検証の両方から使うため分けている）
export async function buildSubmissionWorkbook(sheets: SubmissionSheet[]) {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()

  const FONT = { name: 'Hiragino Mincho ProN', size: 12 }
  const BOLD = { ...FONT, bold: true }
  const THIN = { style: 'thin' as const }
  const BORDER = { top: THIN, bottom: THIN, left: THIN, right: THIN }
  const FILL_HEAD = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFBDD7EE' } }
  const FILL_MENU = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFDEEAF1' } }
  const ALIGN = { horizontal: 'left' as const, vertical: 'middle' as const }

  for (const sheet of sheets) {
    const ws = wb.addWorksheet(sheet.title.slice(0, 31))
    ws.columns = [{ width: 31.5 }, { width: 38 }, { width: 16 }]

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
      setRow([`出店者情報${marukakko(i + 1)}`, '', ''], { bold: true, fill: FILL_HEAD, mergeAll: true, tall: true })
      setRow(['店舗名', s.shopName, ''], { mergeBC: true })
      setRow(['Instagram', s.instagram, ''], { mergeBC: true })
      setRow(['ジャンル', s.genre, ''], { mergeBC: true })
      setRow(['テイクアウト時／袋', s.takeoutBag, ''], { mergeBC: true })
      setRow(['利用可能決済', s.payments, ''], { mergeBC: true })
      setRow(['販売メニュー', '', ''], { bold: true, fill: FILL_HEAD, mergeAll: true })
      setRow(['メニュー名', '詳細', '（価格）'], { bold: true, fill: FILL_MENU })
      for (const m of s.menus) setRow([m.name, m.detail, m.price])
    })
  }

  return wb
}

// Excelを組み立ててブラウザからダウンロードさせる
export async function downloadSubmissionXlsx(sheets: SubmissionSheet[], fileName: string) {
  const wb = await buildSubmissionWorkbook(sheets)
  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}
