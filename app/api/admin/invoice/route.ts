import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { perDayFee } from '../../../lib/placeFee'

// 出店者への請求書を組み立てる。
// action='preview' は番号を採番せず内容だけ返す（確認用）。
// action='issue'   は番号を採番して invoices に記録する（正式発行）。
// 参照・書き込みはすべてサービスロールで行い、管理者かどうかはここで照合する。

// 2026年分は 2026-0041 まで発行済みのため、42 から採番する
const NUMBER_START: Record<string, number> = { '2026': 42 }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function verifyAdmin(admin: any, requesterId: string) {
  const { data, error } = await admin.from('profiles').select('role').eq('id', requesterId).maybeSingle()
  if (error || !data || data.role !== 'admin') return false
  return true
}

// 案件の料金設定から、請求件名に載せる条件（「10%」「5,000円/日」など）を作る。
// 日ごとに金額を決めている案件は、その日の金額を出す。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function feeLabel(place: any, saleDate?: string | null): string {
  const pct = (place?.company_share_pct || 0) + (place?.price_share_pct || 0)
  const parts: string[] = []
  if (pct > 0) parts.push(pct + '%')

  const day = perDayFee(place?.schedule, saleDate)
  if (day.placeFee != null || day.companyFee != null) {
    const total = (day.placeFee ?? 0) + (day.companyFee ?? 0)
    if (total > 0) parts.push(total.toLocaleString() + '円')
    return parts.join(' ＋ ')
  }

  const fixed = (place?.company_fixed_amount || 0) + (place?.price_fixed || 0)
  const perEvent = place?.company_fixed_unit === 'per_event' || place?.place_fixed_unit === 'per_event'
  if (fixed > 0) parts.push(fixed.toLocaleString() + '円/' + (perEvent ? '期間' : '日'))
  return parts.join(' ＋ ')
}

export async function POST(req: Request) {
  try {
    const { requesterId, sellerId, period, action, dueOn, edited, amount, label, applicationId } = await req.json()
    if (!requesterId || !sellerId || !period) {
      return NextResponse.json({ error: 'パラメータ不足' }, { status: 400 })
    }
    if (!/^\d{4}-\d{2}$/.test(period)) {
      return NextResponse.json({ error: '対象月の形式が不正です' }, { status: 400 })
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceKey) {
      return NextResponse.json({ error: 'サーバー設定エラー' }, { status: 500 })
    }
    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
    if (!(await verifyAdmin(admin, requesterId))) {
      return NextResponse.json({ error: '管理者権限がありません' }, { status: 403 })
    }

    // 対象月の範囲
    const [y, m] = period.split('-').map(Number)
    const start = `${period}-01`
    const end = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`

    const { data: seller } = await admin
      .from('profiles').select('id, shop_name, name').eq('id', sellerId).maybeSingle()
    if (!seller) return NextResponse.json({ error: '出店者が見つかりませんでした' }, { status: 404 })

    // ===== 事前請求: 出店日の前に出す出店料 =====
    //
    // 大きなイベントでは、出店料を先に払ってもらって出店が確定し、
    // 当日の売上の◯％はそのあと別に請求する。この入口は前者を作る。
    // 売上の記録は見ない（まだ出店していないので当然無い）。
    //
    // 金額は手で決める。案件に固定額の設定があれば画面側で初期値に使うが、
    // 交渉で決まることが多いため、ここでは渡された額をそのまま使う。
    if (action === 'advance') {
      const yen = Math.floor(Number(amount))
      if (!Number.isFinite(yen) || yen <= 0) {
        return NextResponse.json({ error: '金額を1円以上で入力してください' }, { status: 400 })
      }

      // どの出店に対するものかを控えておく（売上に紐づかないため）
      let appId: string | null = null
      let placeTitle = ''
      let applyDate = ''
      if (applicationId) {
        const { data: ap } = await admin
          .from('applications')
          .select('id, seller_id, apply_date, places(title)')
          .eq('id', applicationId).maybeSingle()
        if (!ap) return NextResponse.json({ error: '申込が見つかりませんでした' }, { status: 404 })
        if (ap.seller_id !== sellerId) {
          return NextResponse.json({ error: 'この申込は選んだ出店者のものではありません' }, { status: 400 })
        }
        appId = ap.id
        applyDate = ap.apply_date || ''
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        placeTitle = (ap as any).places?.title || ''
      }

      // 同じ申込に事前請求を二重に出さないようにする
      if (appId) {
        const { data: dup } = await admin
          .from('invoices').select('invoice_no')
          .eq('application_id', appId).eq('kind', 'advance').limit(1)
        if (dup && dup.length > 0) {
          return NextResponse.json(
            { error: 'この出店には、すでに事前請求（' + dup[0].invoice_no + '）を発行しています' },
            { status: 409 },
          )
        }
      }

      const md = applyDate ? `${parseInt(applyDate.slice(5, 7), 10)}/${parseInt(applyDate.slice(8, 10), 10)}` : ''
      const title = (typeof label === 'string' && label.trim())
        ? label.trim()
        : `${placeTitle || '出店'} 出店料（事前）`
      const advItems = [{ no: 1, saleId: null, date: md, title, amount: yen }]
      const advTax = Math.floor(yen * 0.1)

      const yearA = String(new Date().getFullYear())
      const { data: lastA } = await admin
        .from('invoices').select('invoice_no')
        .like('invoice_no', yearA + '-%')
        .order('invoice_no', { ascending: false }).limit(1)
      const lastSeqA = lastA && lastA.length > 0 ? parseInt(lastA[0].invoice_no.split('-')[1], 10) : 0
      const noA = `${yearA}-${String(Math.max(lastSeqA + 1, NUMBER_START[yearA] ?? 1)).padStart(4, '0')}`

      const dueA = typeof dueOn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dueOn) ? dueOn : null
      const { error: aErr } = await admin.from('invoices').insert({
        invoice_no: noA, seller_id: sellerId, period, kind: 'advance',
        application_id: appId,
        subtotal: yen, tax: advTax, total: yen + advTax, item_count: 1,
        sale_ids: null, items: advItems, due_on: dueA,
        to_name: edited?.toName ?? null,
        to_person: edited?.toPerson ?? null,
        note: edited?.note ?? null,
      })
      if (aErr) {
        return NextResponse.json({ error: '事前請求の記録に失敗しました: ' + aErr.message }, { status: 500 })
      }
      return NextResponse.json({
        success: true, kind: 'advance', invoiceNo: noA, dueOn: dueA,
        seller: { shopName: seller.shop_name || '', personName: seller.name || '' },
        period, periodLabel: `${period.slice(0, 4)}年${parseInt(period.slice(5, 7), 10)}月分`,
        items: advItems, subtotal: yen, tax: advTax, total: yen + advTax, itemCount: 1,
      })
    }

    const { data: sales, error: sErr } = await admin
      .from('sales')
      .select('id, sale_date, revenue, total_pay, fee, place_id')
      .eq('seller_id', sellerId)
      .gte('sale_date', start).lt('sale_date', end)
      .order('sale_date', { ascending: true })
    if (sErr) return NextResponse.json({ error: '売上の取得に失敗しました' }, { status: 500 })
    if (!sales || sales.length === 0) {
      return NextResponse.json({ error: 'この月の売上記録がありません' }, { status: 404 })
    }

    const placeIds = Array.from(new Set(sales.map(s => s.place_id).filter(Boolean)))
    const { data: places } = await admin
      .from('places')
      .select('id, title, company_share_pct, price_share_pct, company_fixed_amount, price_fixed, company_fixed_unit, place_fixed_unit, schedule')
      .in('id', placeIds)
    const placeOf = new Map((places || []).map(p => [p.id, p]))

    // 出店料が0円の売上は明細に載せない（案件の料金設定が未入力のケース）。
    // ただし件数は返して、管理画面で気づけるようにする。
    const zero = sales.filter(s => (s.total_pay ?? s.fee ?? 0) <= 0)
    const billable = sales.filter(s => (s.total_pay ?? s.fee ?? 0) > 0)
    if (billable.length === 0) {
      return NextResponse.json({
        error: 'この月の請求対象がありません。出店料が0円の売上が' + zero.length + '件あります。案件の料金設定をご確認ください。',
      }, { status: 404 })
    }

    const items = billable.map((s, i) => {
      const p = placeOf.get(s.place_id)
      const amount = s.total_pay ?? s.fee ?? 0
      const cond = feeLabel(p, s.sale_date)
      // 元の請求書と同じ「7/1」形式にする（月・日とも先頭のゼロを外す）
      const [mm, dd] = s.sale_date.slice(5).split('-')
      const md = `${parseInt(mm, 10)}/${parseInt(dd, 10)}`
      return {
        no: i + 1,
        saleId: s.id,
        date: md,
        // 例: 「7月 中央医療技術専門学校 出店料 10%」
        title: `${m}月 ${p?.title || '(案件名なし)'} 出店料${cond ? ' ' + cond : ''}`,
        amount,
      }
    })

    const subtotal = items.reduce((t, i) => t + i.amount, 0)
    const tax = Math.floor(subtotal * 0.1)
    const total = subtotal + tax

    const payload = {
      seller: { shopName: seller.shop_name || '', personName: seller.name || '' },
      period,
      periodLabel: `${y}年${m}月分`,
      items,
      subtotal, tax, total,
      itemCount: items.length,
      zeroCount: zero.length,
    }

    if (action === 'save') {
      // 既に発行済みの請求書の内容を修正して保存する
      if (!edited) return NextResponse.json({ error: '保存する内容がありません' }, { status: 400 })
      const sub = (edited.items || []).reduce((t: number, i: { amount?: number }) => t + (Number(i.amount) || 0), 0)
      const tx = Math.floor(sub * 0.1)
      const { data: upd, error: uErr } = await admin.from('invoices').update({
        items: edited.items || null,
        to_name: edited.toName ?? null,
        to_person: edited.toPerson ?? null,
        note: edited.note ?? null,
        due_on: /^\d{4}-\d{2}-\d{2}$/.test(edited.dueOn || '') ? edited.dueOn : null,
        subtotal: sub, tax: tx, total: sub + tx, item_count: (edited.items || []).length,
      }).eq('seller_id', sellerId).eq('period', period).eq('kind', 'sales').select('invoice_no')
      if (uErr) return NextResponse.json({ error: '保存に失敗しました: ' + uErr.message }, { status: 500 })
      if (!upd || upd.length === 0) return NextResponse.json({ error: '対象の請求書が見つかりませんでした' }, { status: 404 })
      return NextResponse.json({ success: true })
    }

    if (action !== 'issue') {
      // 既に発行済みなら、その番号もあわせて返す
      const { data: exist } = await admin
        .from('invoices').select('invoice_no, issued_on, due_on, items, to_name, to_person, note')
        .eq('seller_id', sellerId).eq('period', period).eq('kind', 'sales')
        .order('created_at', { ascending: false })
      const saved = exist && exist.length > 0 ? exist[0] : null
      // 一度修正して保存してある場合は、その内容を優先して返す
      if (saved?.items) {
        const sub = saved.items.reduce((t: number, i: { amount?: number }) => t + (Number(i.amount) || 0), 0)
        const tx = Math.floor(sub * 0.1)
        return NextResponse.json({
          ...payload,
          seller: { shopName: saved.to_name ?? payload.seller.shopName, personName: saved.to_person ?? payload.seller.personName },
          items: saved.items, subtotal: sub, tax: tx, total: sub + tx, itemCount: saved.items.length,
          note: saved.note ?? null,
          invoiceNo: saved.invoice_no, dueOn: saved.due_on, alreadyIssued: exist || [],
        })
      }
      return NextResponse.json({
        ...payload, invoiceNo: saved?.invoice_no ?? null,
        dueOn: saved?.due_on ?? null,
        alreadyIssued: exist || [],
      })
    }

    // ===== 正式発行: 番号を採番して記録する =====
    const year = String(new Date().getFullYear())
    const { data: last } = await admin
      .from('invoices').select('invoice_no')
      .like('invoice_no', year + '-%')
      .order('invoice_no', { ascending: false })
      .limit(1)
    const lastSeq = last && last.length > 0 ? parseInt(last[0].invoice_no.split('-')[1], 10) : 0
    const startFrom = NUMBER_START[year] ?? 1
    const seq = Math.max(lastSeq + 1, startFrom)
    const invoiceNo = `${year}-${String(seq).padStart(4, '0')}`

    const due = typeof dueOn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dueOn) ? dueOn : null
    // 画面で修正されていれば、その内容で発行する
    const useItems = edited?.items?.length ? edited.items : items
    const sub2 = useItems.reduce((t: number, i: { amount?: number }) => t + (Number(i.amount) || 0), 0)
    const tax2 = Math.floor(sub2 * 0.1)
    const { error: iErr } = await admin.from('invoices').insert({
      invoice_no: invoiceNo, seller_id: sellerId, period, kind: 'sales',
      subtotal: sub2, tax: tax2, total: sub2 + tax2, item_count: useItems.length,
      sale_ids: items.map(i => i.saleId),
      due_on: due,
      items: edited?.items?.length ? edited.items : null,
      to_name: edited?.toName ?? null,
      to_person: edited?.toPerson ?? null,
      note: edited?.note ?? null,
    })
    if (iErr) {
      return NextResponse.json({ error: '請求書の記録に失敗しました: ' + iErr.message }, { status: 500 })
    }
    return NextResponse.json({
      ...payload, invoiceNo, dueOn: due,
      items: useItems, subtotal: sub2, tax: tax2, total: sub2 + tax2, itemCount: useItems.length,
      seller: { shopName: edited?.toName ?? payload.seller.shopName, personName: edited?.toPerson ?? payload.seller.personName },
      note: edited?.note ?? null,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '不明なエラー'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
