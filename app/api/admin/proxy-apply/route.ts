import { NextResponse } from 'next/server'
import { requireAdmin } from '../../../lib/apiAuth'

// 運営が、出店者に代わって申込（エントリー）を作る。
//
// 【なぜ要るか】（2026-09-27 の運営からの相談）
//   旧サイトでエントリー済みだった出店者が、新サイトへの移行中に
//   エントリーし直さないまま出店日を迎えることがある。
//   出店日を過ぎるとカレンダーから選べないので、本人はもう申し込めない。
//   申込が無いと売上報告もできず、請求も立てられない
//   （売上の記録は承認済みの申込に紐づける作りのため）。
//   実際に 2026-09-25 の東群馬看護専門学校で起きた。
//
//   画面から申込を作れるのは出店者本人だけで（RLS の
//   「sellers insert own applications」は auth.uid() = seller_id）、
//   運営には入口が無かった。サービスロールで作る。
//
// 【権限】
//   運営だけ。呼び出し元のIDは body から受け取らず、
//   アクセストークンで確かめる（AGENTS.md）。
//
// 【止めていること】
//   ・案件の日程に入っていない日は作らない
//     （日程外の日に売上が立つと、料金の計算がどの日にも当たらない）
//   ・同じ出店者・同じ案件・同じ日の申込が既にあるときは作らない
//   ・募集終了・応募締切は、DB のトリガー（check_apply_window）が見る。
//     そこで弾かれたら、そのまま理由を返す
//
// 【過去の日付を許す理由】
//   これは「これから申し込む」ではなく「出店した事実を記録する」入口。
//   出店者の画面では過去日を選べないままにしてある（誤申込を防ぐため）。

export async function POST(req: Request) {
  try {
    const ctx = await requireAdmin(req)
    if (ctx instanceof NextResponse) return ctx
    const { db } = ctx

    const body = await req.json().catch(() => ({}))
    const placeId = String(body.placeId ?? '').trim()
    const sellerId = String(body.sellerId ?? '').trim()
    const applyDate = String(body.applyDate ?? '').trim()
    const format = body.format ? String(body.format).trim() : null
    if (!placeId || !sellerId || !applyDate) {
      return NextResponse.json({ error: '案件・出店者・出店日をすべて指定してください' }, { status: 400 })
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(applyDate)) {
      return NextResponse.json({ error: '出店日の形式が不正です' }, { status: 400 })
    }

    // 案件の日程に入っている日か
    const { data: place, error: pErr } = await db
      .from('places').select('id, title, schedule, closed').eq('id', placeId).maybeSingle()
    if (pErr) return NextResponse.json({ error: '案件を読み込めませんでした' }, { status: 500 })
    if (!place) return NextResponse.json({ error: '案件が見つかりません' }, { status: 404 })
    const dates = new Set(
      (Array.isArray(place.schedule) ? place.schedule : [])
        .map((d: { date?: string }) => String(d?.date || '')).filter(Boolean),
    )
    if (dates.size > 0 && !dates.has(applyDate)) {
      return NextResponse.json(
        { error: 'この日は案件の日程に入っていません。先に日程を足してください' },
        { status: 400 },
      )
    }

    // 相手が出店者か。募集者や運営のIDを入れられても困る
    const { data: seller, error: sErr } = await db
      .from('profiles').select('id, name, shop_name, role').eq('id', sellerId).maybeSingle()
    if (sErr) return NextResponse.json({ error: '出店者を読み込めませんでした' }, { status: 500 })
    if (!seller) return NextResponse.json({ error: '出店者が見つかりません' }, { status: 404 })
    if (seller.role && seller.role !== 'seller') {
      return NextResponse.json({ error: 'この方は出店者として登録されていません' }, { status: 400 })
    }

    // 同じ日の申込が既にあるか（取消し済みは数えない）
    const { data: dup } = await db
      .from('applications').select('id, status')
      .eq('place_id', placeId).eq('seller_id', sellerId).eq('apply_date', applyDate)
      .neq('status', 'cancelled')
    if (dup && dup.length > 0) {
      return NextResponse.json(
        { error: 'この出店者のこの日の申込は、すでにあります（' + dup[0].status + '）' },
        { status: 409 },
      )
    }

    // 運営が事実を記録するための入口なので、承認済みで入れる。
    // 確認の時刻も入れておく（当日の進行の画面が「確認済み」から始まる）
    const { data: made, error: iErr } = await db
      .from('applications')
      .insert({
        place_id: placeId,
        seller_id: sellerId,
        apply_date: applyDate,
        format,
        status: 'approved',
        confirmed_at: new Date().toISOString(),
      })
      .select('id').maybeSingle()
    if (iErr) {
      // トリガー（募集終了・応募締切・申込の上限）で弾かれたときは、
      // その文面をそのまま返す。運営が次に何をすればよいか分かる
      return NextResponse.json({ error: 'エントリーを作れませんでした：' + iErr.message }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      applicationId: made?.id ?? null,
      seller: seller.shop_name || seller.name || '',
      placeTitle: place.title || '',
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '不明なエラー'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
