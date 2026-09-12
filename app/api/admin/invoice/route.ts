import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { perDayFee } from '../../../lib/placeFee'
import { sendSalesToSheet } from '../../../lib/sheetSend'

// 出店者への請求書を組み立てる。
// action='preview' は番号を採番せず内容だけ返す（確認用）。
// action='issue'   は番号を採番して invoices に記録する（正式発行）。
// 参照・書き込みはすべてサービスロールで行い、管理者かどうかはここで照合する。

// 2026年分は 2026-0041 まで発行済みのため、42 から採番する
// 実施日の表記。「9/5（金）」の形にする。
//
// 曜日が無いと、請求書を受け取った側が日付だけで判断することになる。
// 出店は曜日で条件が変わることが多い（平日と土日祝で出店料が違うなど）ため、
// 曜日まで出したほうが照合しやすい、という運営の判断で足した。
//
// 日付は 'YYYY-MM-DD' で渡す。読めない値のときは空文字を返す
// （請求書に「NaN/NaN」のような表記が出るのを防ぐ）。
// 画面から来た日付を受け取る。2026-09-06 の形でなければ受け取らない。
// 受け取らなかったときは null を返し、呼び出し側で
// 「その項目は触らない（既定や既存の値を残す）」ようにしている
function asDate(v: unknown): string | null {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null
}

// 対象月の締めが終わっているか。
//
// 出店料は末締めで、当月分は月が終わるまで確定しない。
// 事前請求のあとも出店が続く方が大半なので、月の途中で「当月分」を渡すと、
// そのあとの出店が入っていない請求書が相手の手元に残ってしまう。
// 翌月1日を過ぎてから渡す。
//
// サーバーは世界標準時で動いているので、日本時間に直してから比べる。
// そうしないと、日本で1日になっても前日として扱われる時間帯ができる。
function periodClosed(period: string | null | undefined): boolean {
  const m = /^(\d{4})-(\d{2})$/.exec(String(period ?? ''))
  if (!m) return true      // 形が読めないものは止めない（既存の行を巻き込まないため）
  const y = Number(m[1]), mo = Number(m[2])
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000)
  const today = Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate())
  const openOn = Date.UTC(y, mo, 1)   // 月は0から数えるので、mo がそのまま翌月
  return today >= openOn
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']
function mdLabel(isoDate: string | null | undefined): string {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}/.test(isoDate)) return ''
  const [y, mm, dd] = isoDate.slice(0, 10).split('-').map(Number)
  // 月は0から数える。時刻を付けないと、環境によって前日になることがある
  const w = WEEKDAYS[new Date(y, mm - 1, dd).getDay()]
  return `${mm}/${dd}（${w}）`
}

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
    const { requesterId, sellerId, period, action, dueOn, edited, amount, label, applicationId, applicationIds, invoiceNo: invoiceNoParam, force, forReceipt } = await req.json()

    const url0 = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key0 = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url0 || !key0) {
      return NextResponse.json({ error: 'サーバー設定エラー' }, { status: 500 })
    }

    // ===== 発行済みの請求書を、番号だけで開き直す =====
    //
    // 一度発行した請求書は、何度でもPDFにできる必要がある。
    // 印刷を失敗した、送り先を間違えた、控えを無くした——どれも普通に起きる。
    // 番号は変わらないので、開き直しても二重請求にはならない。
    //
    // 売上からの請求（sales）と事前請求（advance）の両方をここで扱う。
    // 事前請求は売上に紐づかないため、出店者と対象月から組み立て直すことができず、
    // 記録した invoices の行をそのまま返すしかない。
    if (action === 'open') {
      const no = typeof invoiceNoParam === 'string' ? invoiceNoParam.trim() : ''
      if (!requesterId || !no) {
        return NextResponse.json({ error: '請求書番号が指定されていません' }, { status: 400 })
      }
      const adminO = createClient(url0, key0, { auth: { autoRefreshToken: false, persistSession: false } })
      const isAdmin = await verifyAdmin(adminO, requesterId)

      const { data: row } = await adminO
        .from('invoices')
        .select('invoice_no, seller_id, period, kind, items, subtotal, tax, total, item_count, due_on, issued_on, to_name, to_person, note, created_at, voided_at, void_reason, paid_status, paid_on, paid_confirmed_at')
        .eq('invoice_no', no).maybeSingle()

      // 運営でなければ、自分あての請求書だけを開ける。
      //
      // 「見つからない」と「あなたのものではない」を同じ答えにしているのは、
      // 番号を順に試すことで他社の請求書の有無を調べられないようにするため。
      // 取り消した請求書も、出店者には出さない（無効になったものが
      // 手元に残ると、支払い済みかどうかの取り違えが起きる）。
      if (!isAdmin) {
        if (!row || row.seller_id !== requesterId || row.voided_at) {
          return NextResponse.json({ error: '請求書 ' + no + ' が見つかりませんでした' }, { status: 404 })
        }
        // 当月分はまだ確定していないので渡さない。
        // 事前請求は出店日の前に払っていただくものなので、この制限の対象外。
        // 画面のボタンを隠すだけでは、URLを直接指定されたときに防げない
        if (row.kind !== 'advance' && !periodClosed(row.period)) {
          const [y, mo] = String(row.period).split('-').map(Number)
          const d = new Date(Date.UTC(y, mo, 1))
          return NextResponse.json({
            error: `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月1日 よりダウンロードいただけます。`
              + '当月分の出店をまとめた請求書は、月が終わってから確定するためです。',
          }, { status: 409 })
        }
      }
      if (!row) {
        return NextResponse.json({ error: '請求書 ' + no + ' が見つかりませんでした' }, { status: 404 })
      }
      // 領収書として開くときは、入金を確認できているものだけを渡す。
      // まだ受け取っていないお金の領収書が作れてしまうと、
      // 帳簿と実際の入金が合わなくなる。
      // 画面側の出し分けだけでは、URLを直接叩かれたときに防げない
      if (forReceipt === true && row.paid_status !== 'paid') {
        return NextResponse.json({
          error: 'この請求書はまだ入金を確認できていません。領収書は入金の確認後に発行できます。',
        }, { status: 409 })
      }

      const { data: sl } = await adminO
        .from('profiles').select('shop_name, name').eq('id', row.seller_id).maybeSingle()
      const pm = parseInt(String(row.period).slice(5, 7), 10)
      return NextResponse.json({
        seller: {
          shopName: row.to_name ?? sl?.shop_name ?? '',
          personName: row.to_person ?? sl?.name ?? '',
        },
        sellerId: row.seller_id,
        period: row.period,
        periodLabel: `${String(row.period).slice(0, 4)}年${pm}月分`,
        items: row.items || [],
        subtotal: row.subtotal ?? 0,
        tax: row.tax ?? 0,
        total: row.total ?? 0,
        itemCount: row.item_count ?? (row.items?.length ?? 0),
        invoiceNo: row.invoice_no,
        dueOn: row.due_on,
        note: row.note ?? null,
        kind: row.kind,
        // 紙面に出す発行日は issued_on。画面から直せる。
        // 記録が無い古い行のためだけに、作成日時を控えにしている
        issuedOn: row.issued_on || row.created_at,
        voidedAt: row.voided_at,
        voidReason: row.void_reason,
        // 領収書に使う。領収日は出店者が申告した振込日を使い、
        // 申告が無い古い行だけ、運営が確認した日を控えにする
        paidStatus: row.paid_status,
        paidOn: row.paid_on,
        paidConfirmedAt: row.paid_confirmed_at,
      })
    }

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
      // 金額は「1日あたり（税抜）」。複数日をまとめるときは日数ぶん明細が並ぶ
      const yen = Math.floor(Number(amount))
      if (!Number.isFinite(yen) || yen <= 0) {
        return NextResponse.json({ error: '金額を1円以上で入力してください' }, { status: 400 })
      }

      // どの出店に対するものかを控えておく（売上に紐づかないため）。
      //
      // 2日間の催しのように、同じ出店者の複数の出店日を1枚にまとめたい
      // ことがある。以前は1日ずつしか出せず、2日分は発行後に明細を
      // 手で足すしかなかった。applicationIds で複数を受け取れるようにする。
      // 1件だけの applicationId もこれまでどおり受け付ける。
      const wantIds: string[] = Array.from(new Set(
        (Array.isArray(applicationIds) ? applicationIds : (applicationId ? [applicationId] : []))
          .map((x: unknown) => String(x || '').trim()).filter(Boolean),
      ))
      if (wantIds.length > 31) {
        return NextResponse.json({ error: 'まとめられるのは31日分までです' }, { status: 400 })
      }

      type AppRow = { id: string; seller_id: string; place_id: string | null; apply_date: string | null; places?: { title?: string } | null }
      let apps: AppRow[] = []
      let placeTitle = ''
      if (wantIds.length > 0) {
        const { data: found } = await admin
          .from('applications')
          .select('id, seller_id, place_id, apply_date, places(title)')
          .in('id', wantIds)
        apps = ((found || []) as unknown as AppRow[])
        if (apps.length !== wantIds.length) {
          return NextResponse.json({ error: '申込が見つかりませんでした' }, { status: 404 })
        }
        if (apps.some(a => a.seller_id !== sellerId)) {
          return NextResponse.json({ error: 'この申込は選んだ出店者のものではありません' }, { status: 400 })
        }
        // 別の案件の出店を1枚に混ぜない（請求件名も宛先の現場も変わってしまう）
        const placeIds = new Set(apps.map(a => a.place_id || ''))
        if (placeIds.size > 1) {
          return NextResponse.json({ error: '別の案件の出店が混ざっています。同じ案件の出店日だけをまとめてください' }, { status: 400 })
        }
        apps.sort((a, b) => String(a.apply_date || '').localeCompare(String(b.apply_date || '')))
        placeTitle = apps[0]?.places?.title || ''

        // 月をまたぐ組み合わせは1枚にしない。
        // 請求書の対象月（period）は月ごとの締め・出店取消しの判定・売上請求の
        // 二重請求の注意に使われていて、「請求書の月 ≠ 出店日の月」の日が生まれると
        // 後ろの月の日が請求済みなのに取り消せる／売上請求で固定分が二重になる、が起きる
        const months = Array.from(new Set(apps.map(a => String(a.apply_date || '').slice(0, 7)).filter(Boolean)))
        if (months.length > 1) {
          const names = months.map(m => parseInt(m.slice(5, 7), 10) + '月分').join('と')
          return NextResponse.json(
            { error: '月をまたぐ出店日は1枚にまとめられません（月ごとの締めのため）。' + names + 'に分けて発行してください' },
            { status: 400 },
          )
        }
      }
      const appId: string | null = apps[0]?.id ?? null

      // 同じ申込に事前請求が既にあれば、いったん知らせる。
      //
      // ただし「もう出せない」にはしない。金額を間違えた、条件が変わった、
      // 先方の求めで出し直す——やり直したい場面のほうが多い。
      // 既にあることを伝えたうえで、force を付けて呼び直せば発行できる。
      // 既存の番号も返すので、画面側で「発行済みを開く」を出せる。
      //
      // 複数日をまとめた請求書は application_id に先頭の1件しか入らないため、
      // 明細（items[].applicationId）に控えた分も見る。
      if (apps.length > 0 && force !== true) {
        const { data: cand } = await admin
          .from('invoices').select('invoice_no, total, due_on, created_at, application_id, items')
          .eq('seller_id', sellerId).eq('kind', 'advance')
          // 取り消した請求書は「既にある」に数えない。取り消したなら出し直せるべき
          .is('voided_at', null)
          .order('created_at', { ascending: false })
        const idSet = new Set(wantIds)
        // 請求書ごとに「選んだ日のうち、どれが載っているか」を出す。
        // 複数日をまとめられるようになったので、一部の日だけ重なることがある。
        // どの日かを返さないと、画面側で「重なった日を外して出す」ができない
        const dup = (cand || []).map(d => {
          const hit = new Set<string>()
          if (d.application_id && idSet.has(d.application_id)) hit.add(d.application_id)
          const its = Array.isArray(d.items) ? d.items : []
          for (const it of its as { applicationId?: string }[]) {
            if (it?.applicationId && idSet.has(it.applicationId)) hit.add(it.applicationId)
          }
          return { d, hit }
        }).filter(x => x.hit.size > 0)
        if (dup.length > 0) {
          const labelOf = (id: string) => mdLabel(apps.find(a => a.id === id)?.apply_date) || '日程の指定なし'
          const overlapIds = Array.from(new Set(dup.flatMap(x => Array.from(x.hit))))
          return NextResponse.json({
            error: '選んだ出店日のうち ' + overlapIds.map(labelOf).join('・') + ' には、すでに事前請求（'
              + dup.map(x => x.d.invoice_no).join('、') + '）を発行しています',
            existing: dup.map(x => ({
              invoiceNo: x.d.invoice_no,
              total: x.d.total,
              dueOn: x.d.due_on,
              dates: Array.from(x.hit).map(labelOf),
            })),
            // 重なっている申込。画面側でこれを外して出し直せる
            overlap: overlapIds.map(id => ({ applicationId: id, label: labelOf(id) })),
            canReissue: true,
          }, { status: 409 })
        }
      }

      const title = (typeof label === 'string' && label.trim())
        ? label.trim()
        : `${placeTitle || '出店'} 出店料（事前）`
      // 出店日ごとに1行。日付が無い申込（旧データ）でも1行は出す
      const advItems = (apps.length > 0 ? apps : [null]).map((a, i) => ({
        no: i + 1, saleId: null, applicationId: a?.id ?? null,
        date: mdLabel(a?.apply_date), title, amount: yen,
      }))
      const advSubtotal = yen * advItems.length
      const advTax = Math.floor(advSubtotal * 0.1)
      // 対象月は出店日の月（同じ月しか混ざらないことは上で確かめている）。
      // 日付の無い申込だけのときは、画面から来た period を使う
      const firstDated = apps.map(a => String(a.apply_date || '')).find(d => /^\d{4}-\d{2}/.test(d)) || ''
      const advPeriod = firstDated ? firstDated.slice(0, 7) : period

      const yearA = String(new Date().getFullYear())
      const { data: lastA } = await admin
        .from('invoices').select('invoice_no')
        .like('invoice_no', yearA + '-%')
        .order('invoice_no', { ascending: false }).limit(1)
      const lastSeqA = lastA && lastA.length > 0 ? parseInt(lastA[0].invoice_no.split('-')[1], 10) : 0
      const noA = `${yearA}-${String(Math.max(lastSeqA + 1, NUMBER_START[yearA] ?? 1)).padStart(4, '0')}`

      const dueA = asDate(dueOn)
      const rowA: Record<string, unknown> = {
        invoice_no: noA, seller_id: sellerId, period: advPeriod, kind: 'advance',
        application_id: appId,
        subtotal: advSubtotal, tax: advTax, total: advSubtotal + advTax, item_count: advItems.length,
        sale_ids: null, items: advItems, due_on: dueA,
        to_name: edited?.toName ?? null,
        to_person: edited?.toPerson ?? null,
        note: edited?.note ?? null,
      }
      // 発行日。指定が無ければ記録側の既定（今日）に任せる。
      // 事前請求は管理画面から直接出すため、通常ここには来ない。
      // 出したあとで直したいときは、番号で開いて日付を保存すればよい
      const issuedA = asDate(edited?.issuedOn)
      if (issuedA) rowA.issued_on = issuedA
      const { error: aErr } = await admin.from('invoices').insert(rowA)
      if (aErr) {
        return NextResponse.json({ error: '事前請求の記録に失敗しました: ' + aErr.message }, { status: 500 })
      }
      return NextResponse.json({
        success: true, kind: 'advance', invoiceNo: noA, dueOn: dueA,
        seller: { shopName: seller.shop_name || '', personName: seller.name || '' },
        period: advPeriod, periodLabel: `${advPeriod.slice(0, 4)}年${parseInt(advPeriod.slice(5, 7), 10)}月分`,
        items: advItems, subtotal: advSubtotal, tax: advTax, total: advSubtotal + advTax, itemCount: advItems.length,
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
      // 「9/5（金）」の形にする（曜日まで出す）
      const md = mdLabel(s.sale_date)
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
      const patch: Record<string, unknown> = {
        items: edited.items || null,
        to_name: edited.toName ?? null,
        to_person: edited.toPerson ?? null,
        note: edited.note ?? null,
        due_on: asDate(edited.dueOn),
        subtotal: sub, tax: tx, total: sub + tx, item_count: (edited.items || []).length,
      }
      // 発行日は、送られてきたときだけ書き換える。
      // 常に書くと、日付を送らない古い画面から保存されたときに
      // 発行日が消えてしまう
      const issuedS = asDate(edited.issuedOn)
      if (issuedS) patch.issued_on = issuedS
      // 番号で開いている場合はその1枚だけを直す。
      // 事前請求は同じ出店者・同じ月に複数あり得るため、番号で特定しないと
      // 関係のない請求書まで書き換えてしまう
      const q = typeof invoiceNoParam === 'string' && invoiceNoParam.trim()
        ? admin.from('invoices').update(patch).eq('invoice_no', invoiceNoParam.trim())
        : admin.from('invoices').update(patch).eq('seller_id', sellerId).eq('period', period).eq('kind', 'sales')
      const { data: upd, error: uErr } = await q.select('invoice_no')
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
          invoiceNo: saved.invoice_no, dueOn: saved.due_on,
          issuedOn: saved.issued_on ?? null,
          alreadyIssued: exist || [],
        })
      }
      return NextResponse.json({
        ...payload, invoiceNo: saved?.invoice_no ?? null,
        dueOn: saved?.due_on ?? null,
        // 発行済みなら、そのときの発行日を返す。未発行なら null で、画面は今日を出す
        issuedOn: saved?.issued_on ?? null,
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

    const due = asDate(dueOn)
    // 画面で修正されていれば、その内容で発行する
    const useItems = edited?.items?.length ? edited.items : items
    const sub2 = useItems.reduce((t: number, i: { amount?: number }) => t + (Number(i.amount) || 0), 0)
    const tax2 = Math.floor(sub2 * 0.1)
    const row: Record<string, unknown> = {
      invoice_no: invoiceNo, seller_id: sellerId, period, kind: 'sales',
      subtotal: sub2, tax: tax2, total: sub2 + tax2, item_count: useItems.length,
      sale_ids: items.map(i => i.saleId),
      due_on: due,
      items: edited?.items?.length ? edited.items : null,
      to_name: edited?.toName ?? null,
      to_person: edited?.toPerson ?? null,
      note: edited?.note ?? null,
    }
    // 発行日。画面で指定されていればそれを、無ければ記録側の既定（今日）に任せる
    const issuedI = asDate(edited?.issuedOn)
    if (issuedI) row.issued_on = issuedI
    const { error: iErr } = await admin.from('invoices').insert(row)
    if (iErr) {
      return NextResponse.json({ error: '請求書の記録に失敗しました: ' + iErr.message }, { status: 500 })
    }
    // 経理用シートの「請求書ID」「発行状況」が変わるので送り直す。
    // 待つが、失敗しても発行は成功として返す（送れなかった売上は
    // sheet_error に残り、管理画面から送り直せる）
    await sendSalesToSheet(admin, items.map((i: { saleId: string }) => i.saleId))
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
