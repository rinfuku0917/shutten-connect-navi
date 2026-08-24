import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

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

// 案件の料金設定から、請求件名に載せる条件（「10%」「5,000円/日」など）を作る
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function feeLabel(place: any): string {
  const pct = (place?.company_share_pct || 0) + (place?.price_share_pct || 0)
  const fixed = (place?.company_fixed_amount || 0) + (place?.price_fixed || 0)
  const perEvent = place?.company_fixed_unit === 'per_event' || place?.place_fixed_unit === 'per_event'
  const parts: string[] = []
  if (pct > 0) parts.push(pct + '%')
  if (fixed > 0) parts.push(fixed.toLocaleString() + '円/' + (perEvent ? '期間' : '日'))
  return parts.join(' ＋ ')
}

export async function POST(req: Request) {
  try {
    const { requesterId, sellerId, period, action } = await req.json()
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
      .select('id, title, company_share_pct, price_share_pct, company_fixed_amount, price_fixed, company_fixed_unit, place_fixed_unit')
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
      const cond = feeLabel(p)
      const md = s.sale_date.slice(5).replace('-', '/').replace(/^0/, '')
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

    if (action !== 'issue') {
      // 既に発行済みなら、その番号もあわせて返す
      const { data: exist } = await admin
        .from('invoices').select('invoice_no, issued_on')
        .eq('seller_id', sellerId).eq('period', period)
        .order('created_at', { ascending: false })
      return NextResponse.json({ ...payload, invoiceNo: null, alreadyIssued: exist || [] })
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

    const { error: iErr } = await admin.from('invoices').insert({
      invoice_no: invoiceNo, seller_id: sellerId, period,
      subtotal, tax, total, item_count: items.length,
      sale_ids: items.map(i => i.saleId),
    })
    if (iErr) {
      return NextResponse.json({ error: '請求書の記録に失敗しました: ' + iErr.message }, { status: 500 })
    }
    return NextResponse.json({ ...payload, invoiceNo })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '不明なエラー'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
