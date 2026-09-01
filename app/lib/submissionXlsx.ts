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
  /** イオン様式でだけ使う。「8月18日（火）8月20日（木）」の形 */
  wishDates?: string
  /**
   * 承認待ちを含めて出したときだけ入る。「（承認待ち）」の形。
   * そのまま施設へ提出すると事故になるため、見出しに必ず出す。
   */
  statusNote?: string
}
export type SubmissionSheet = { title: string; sellers: SubmissionSeller[] }

// 提出様式。施設によって決まった書き方があるため、案件ごとに選べるようにしている。
//   daily … 開催日ごとに1シート（群馬県美容専門学校ほか）
//   aeon  … 月ごとに1シート、施設名と希望日程の欄あり（イオンモール八潮南ほか）
export type SubmissionFormat = 'daily' | 'aeon'

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

// イオン様式の価格は「¥600」の書き方
export function menuPriceYen(price: number | null | undefined): string {
  return price == null ? '' : '¥' + price.toLocaleString()
}

// 「2026-08-01」→「８月」（イオン様式のシート名）
export function jaMonthSheetName(dateIso: string): string {
  const m = Number(dateIso.slice(5, 7))
  if (!m) return dateIso
  const zen = (n: number) => String(n).replace(/[0-9]/g, c => '０１２３４５６７８９'[Number(c)])
  return `${zen(m)}月`
}

// 「2026-08-18」→「8月18日（火）」（イオン様式の希望日程。こちらは半角）
export function jaShortDate(dateIso: string): string {
  const d = new Date(dateIso + 'T00:00:00')
  if (isNaN(d.getTime())) return dateIso
  const wd = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()]
  return `${d.getMonth() + 1}月${d.getDate()}日（${wd}）`
}

// 【クレープ】のように括った行は、メニューの区切りとして扱う
function isMenuHeading(name: string): boolean {
  return /^\s*【.*】\s*$/.test(name)
}

// 案件の承認済み出店者を集めて提出用Excelをダウンロードする。
// 管理画面・募集者ダッシュボード・応募者一覧から使う（中身は同じ）。
// format で提出様式を選ぶ。戻り値: 出力したシート数（0 = 出力するものが無かった）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function exportPlaceSubmission(
  supabase: any,
  placeId: string,
  placeTitle: string,
  format: SubmissionFormat = 'daily',
  // 承認前の出店者も入れるかどうか。誰に来てもらうかを決める前に、
  // 応募の中身をExcelで見比べたいときに使う。
  includePending = false,
): Promise<number> {
  const wanted = includePending ? ['approved', 'pending'] : ['approved']
  const { data: apps, error } = await supabase
    .from('applications')
    .select('apply_date, seller_id, status, profiles!applications_seller_id_fkey(shop_name, name, genre, takeout_bag, payment_methods)')
    .eq('place_id', placeId)
    .in('status', wanted)
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
  // 価格は様式ごとに書き方が違う（日付ごと様式は「600円」、イオン様式は「¥600」）ので、
  // ここでは数値のまま持っておき、組み立てるときに整える。
  const menusBySeller = new Map<string, { name: string; detail: string; price: number | null }[]>()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const m of menuRows || []) {
    const list = menusBySeller.get(m.seller_id) || []
    list.push({ name: m.name || '', detail: m.detail || '', price: m.price ?? null })
    menusBySeller.set(m.seller_id, list)
  }
  const menusFor = (sellerId: string, yen: boolean): SubmissionMenuItem[] =>
    (menusBySeller.get(sellerId) || []).map(m => ({
      name: m.name,
      detail: m.detail,
      price: yen ? menuPriceYen(m.price) : menuPriceLabel(m.price),
    }))

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sellerBase = (a: any, yen: boolean): SubmissionSeller => {
    const p = a.profiles || {}
    return {
      shopName: p.shop_name || p.name || '',
      instagram: instaBySeller.get(a.seller_id) || '',
      genre: genreLabel(p.genre),
      takeoutBag: p.takeout_bag || '',
      payments: paymentsLabel(p.payment_methods),
      menus: menusFor(a.seller_id, yen),
    }
  }

  const safeTitle = placeTitle.replace(/[\\/:*?"<>|]/g, '')
  const allDates = Array.from(new Set(rows.map((a: { apply_date: string }) => a.apply_date))).sort() as string[]
  const months = Array.from(new Set(allDates.map(d => Number(d.slice(5, 7)) + '月'))).join('')
  // 承認待ちを含めたファイルは、そのまま提出されないようファイル名でも分かるようにする
  const suffix = includePending ? '_承認待ち含む' : ''
  const note = (status: string) => (includePending && status === 'pending' ? '（承認待ち）' : '')

  if (format === 'aeon') {
    // 月ごとに1シート。出店者は月に1回だけ出し、申し込んだ日は「希望日程」にまとめる。
    const byMonth = new Map<string, Map<string, { seller: SubmissionSeller; dates: string[]; pending: boolean }>>()
    for (const a of rows) {
      const month = a.apply_date.slice(0, 7)
      let m = byMonth.get(month)
      if (!m) { m = new Map(); byMonth.set(month, m) }
      let e = m.get(a.seller_id)
      if (!e) { e = { seller: sellerBase(a, true), dates: [], pending: false }; m.set(a.seller_id, e) }
      if (!e.dates.includes(a.apply_date)) e.dates.push(a.apply_date)
      // 同じ月に承認済みと承認待ちが混ざることがあるので、1日でも残っていれば印を付ける
      if (a.status === 'pending') e.pending = true
    }
    const monthKeys = Array.from(byMonth.keys()).sort()
    const sheets: SubmissionSheet[] = monthKeys.map(mk => ({
      title: jaMonthSheetName(mk + '-01'),
      sellers: Array.from(byMonth.get(mk)!.values()).map(e => ({
        ...e.seller,
        wishDates: e.dates.sort().map(jaShortDate).join(''),
        statusNote: e.pending ? '（承認待ちを含む）' : '',
      })),
    }))
    await downloadAeonXlsx(sheets, safeTitle, `${safeTitle}_出店者情報_${months}${suffix}.xlsx`)
    return sheets.length
  }

  // 日付ごとにシートを作る（同じ出店者が同じ日に重複していたら1回にする）
  const byDate = new Map<string, SubmissionSeller[]>()
  const seen = new Set<string>()
  for (const a of rows) {
    const key = a.apply_date + '|' + a.seller_id
    if (seen.has(key)) continue
    seen.add(key)
    const list = byDate.get(a.apply_date) || []
    list.push({ ...sellerBase(a, false), statusNote: note(a.status) })
    byDate.set(a.apply_date, list)
  }

  // 承認済みを先に、承認待ちを後に並べる（そのまま上から確認できるように）
  for (const list of byDate.values()) {
    list.sort((x, y) => (x.statusNote ? 1 : 0) - (y.statusNote ? 1 : 0))
  }

  const dates = Array.from(byDate.keys()).sort()
  const sheets: SubmissionSheet[] = dates.map(d => ({ title: jaSheetName(d), sellers: byDate.get(d)! }))

  // ファイル名は「案件名_出店者情報_9月10月.xlsx」の形
  await downloadSubmissionXlsx(sheets, `${safeTitle}_出店者情報_${months}${suffix}.xlsx`)
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
      setRow([`出店者情報${marukakko(i + 1)}${s.statusNote ?? ''}`, '', ''], { bold: true, fill: FILL_HEAD, mergeAll: true, tall: true })
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

// イオン様式のExcelを組み立てる。
//
// 実際にご提出いただいたファイル（イオンモール八潮南）から読み取った値に合わせている。
//   ・月ごとに1シート（シート名は「８月」の形）
//   ・1シートの中に、その月の出店者を「出店者情報⑴⑵⑶…」と縦に並べる
//   ・各出店者: 施設名 / 店舗名 / Instagram / 希望日程 / ジャンル /
//     テイクアウトの袋 / 決済方法 → メニュー名・詳細・価格
//   見出しまわり: Hiragino Mincho ProN 12pt、塗りなし
//   メニュー行: 游ゴシック 10pt、価格は右寄せで「¥600」
//   【クレープ】のように括った行は区切りとして太字＋D9E1F2で塗る
//   列幅: A=30 / B=42.86 / C=10 ／ 罫線: 全セル細線
export async function buildAeonWorkbook(sheets: SubmissionSheet[], facilityName: string) {
  const ExcelJS = (await import('exceljs')).default
  const wb = new ExcelJS.Workbook()

  const HEAD_FONT = { name: 'Hiragino Mincho ProN', size: 12 }
  const MENU_FONT = { name: '游ゴシック', size: 10 }
  const MENU_BOLD = { ...MENU_FONT, bold: true }
  const THIN = { style: 'thin' as const }
  const BORDER = { top: THIN, bottom: THIN, left: THIN, right: THIN }
  const FILL_SEC = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFD9E1F2' } }
  // 元のファイルは横寄せを指定していない（Excelの既定のまま）。価格の列だけ右寄せ。
  const PLAIN = { vertical: 'middle' as const }
  const RIGHT = { horizontal: 'right' as const, vertical: 'middle' as const }

  for (const sheet of sheets) {
    const ws = wb.addWorksheet(sheet.title.slice(0, 31))
    ws.columns = [{ width: 30 }, { width: 42.86 }, { width: 10 }]

    let r = 1
    const put = (
      vals: [string, string, string],
      opts?: { font?: typeof HEAD_FONT; fill?: typeof FILL_SEC; rightC?: boolean },
    ) => {
      const row = ws.getRow(r)
      row.height = 22
      for (let c = 1; c <= 3; c++) {
        const cell = row.getCell(c)
        cell.value = vals[c - 1]
        cell.font = opts?.font ?? HEAD_FONT
        cell.border = BORDER
        cell.alignment = opts?.rightC && c === 3 ? RIGHT : PLAIN
        if (opts?.fill) cell.fill = opts.fill
      }
      r += 1
    }

    sheet.sellers.forEach((s, i) => {
      put(['', '', ''])                                   // 出店者ごとの区切りの空行
      put([`出店者情報${marukakko(i + 1)}${s.statusNote ?? ''}`, '', ''])
      put(['施設名', facilityName, ''])
      put(['店舗名', s.shopName, ''])
      put(['Instagram', s.instagram, ''])
      put(['希望日程', s.wishDates ?? '', ''])
      put(['ジャンル', s.genre, ''])
      put(['テイクアウトの袋', s.takeoutBag, ''])
      put(['決済方法', s.payments, ''])
      put(['メニュー名', '詳細', '価格'])
      for (const m of s.menus) {
        const heading = isMenuHeading(m.name)
        put([m.name, m.detail, m.price], {
          font: heading ? MENU_BOLD : MENU_FONT,
          fill: heading ? FILL_SEC : undefined,
          rightC: true,
        })
      }
    })
  }

  return wb
}

export async function downloadAeonXlsx(sheets: SubmissionSheet[], facilityName: string, fileName: string) {
  const wb = await buildAeonWorkbook(sheets, facilityName)
  await saveWorkbook(wb, fileName)
}

// Excelを組み立ててブラウザからダウンロードさせる
export async function downloadSubmissionXlsx(sheets: SubmissionSheet[], fileName: string) {
  const wb = await buildSubmissionWorkbook(sheets)
  await saveWorkbook(wb, fileName)
}

// 組み立てたブックを、ブラウザからファイルとして保存させる
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function saveWorkbook(wb: any, fileName: string) {
  const buf = await wb.xlsx.writeBuffer()
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}
