import { NextResponse } from 'next/server'
import { requireCaller, denyNotAdmin } from '../../lib/apiAuth'

// 当日の進行（前日確認・車両の搬入・営業準備中・営業開始・営業終了・撤収）を記録する。
//
// なぜサーバー経由なのか:
//   出店者に applications の UPDATE を直接許すと、同じ行の status も
//   書き換えられてしまう（RLSは行単位で、列単位では止められない）。
//   自分で自分の申込を「承認済」にできては困るので、ここを通す。
//
// 押した時刻を消す（取り消す）操作も同じ入口で受ける。押し間違いは必ず起きるため。

// 出店者が押せる段階。値は applications の列名。
// 画面上の呼び名は 前日確認 / 車両の搬入 / 営業準備中 / 営業開始 / 営業終了 / 撤収。
// checked_in は昨夜「受付完了」と呼んでいたが、運営が押す「受付完了」と
// 名前がぶつかるため「車両の搬入」に改めた（列名はそのまま）。
const SELLER_STEPS = {
  confirmed: 'confirmed_at',
  checked_in: 'checked_in_at',
  ready: 'ready_at',
  opened: 'opened_at',
  closed: 'closed_at',
  left: 'left_at',
} as const
type SellerStep = keyof typeof SELLER_STEPS

export async function POST(req: Request) {
  try {
    // 呼び出し元をアクセストークンで確かめる（body の id は信用しない）。
    //
    // この入口は「本人の出店なら記録、運営なら受付完了」の2通りなので、
    // requireAdmin では足切りできない。requireCaller で uid と役割を受け取り、
    // 403 は下の枝それぞれで返す。
    // もとは運営の枝に入ったときだけ profiles を読んでいたので、
    // 出店者の記録でも役割の読み取りが1回増える（ごく小さい問い合わせ）。
    // ただし読み取りに失敗しても出店者の記録は止めない。
    // 現場のスマホから1出店で6回押される導線なので、役割を要らない枝まで
    // profiles の一瞬の不調で止めてはいけない（403/503 の書き分けは下の seen の枝）
    const ctx = await requireCaller(req)
    if (ctx instanceof NextResponse) return ctx
    const { caller, db } = ctx
    const uid = caller.uid

    const { applicationId, step, undo } = await req.json()
    if (!applicationId || !step) {
      return NextResponse.json({ error: 'パラメータ不足' }, { status: 400 })
    }

    const { data: app, error: aErr } = await db
      .from('applications')
      .select('id, seller_id, status, apply_date')
      .eq('id', applicationId)
      .single()
    if (aErr || !app) return NextResponse.json({ error: '申込が見つかりません' }, { status: 404 })

    // 運営の「受付完了」。押すと出店者の画面にも「運営が受付を完了しました」と出る。
    // 出店者側の全工程がそろうまでは押せない（そろっていないのに完了にすると、
    // 撤収まで終わったのかどうかが分からなくなる）。
    if (step === 'seen') {
      if (!caller.isAdmin) {
        // 役割が読めなかったときは 403 ではなく 503（denyNotAdmin が書き分ける）
        return denyNotAdmin(caller, '管理者権限が必要です')
      }
      const { data: prog } = await db
        .from('applications')
        .select('checked_in_at, ready_at, opened_at, closed_at, left_at')
        .eq('id', applicationId).single()
      const missing: string[] = []
      if (prog) {
        if (!prog.checked_in_at) missing.push('車両の搬入')
        if (!prog.ready_at) missing.push('営業準備中')
        if (!prog.opened_at) missing.push('営業開始')
        if (!prog.closed_at) missing.push('営業終了')
        if (!prog.left_at) missing.push('撤収')
      }
      // undo のときは、そろっていなくても取り消せる
      if (!undo && missing.length > 0) {
        return NextResponse.json(
          { error: 'まだ済んでいない工程があります：' + missing.join('、'), missing },
          { status: 409 },
        )
      }
      const { error } = await db
        .from('applications')
        .update({ checkin_seen_at: undo ? null : new Date().toISOString() })
        .eq('id', applicationId)
      if (error) return NextResponse.json({ error: '更新に失敗しました: ' + error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    if (!(step in SELLER_STEPS)) {
      return NextResponse.json({ error: '不明な操作です' }, { status: 400 })
    }
    if (app.seller_id !== uid) {
      return NextResponse.json({ error: '自分の出店のみ記録できます' }, { status: 403 })
    }
    // 出店が決まっていないものは当日の進行に入っていない
    if (app.status !== 'approved') {
      return NextResponse.json({ error: '出店が決まってから記録できます' }, { status: 409 })
    }

    const column = SELLER_STEPS[step as SellerStep]
    const patch: Record<string, string | null> = { [column]: undo ? null : new Date().toISOString() }
    // 出店者側の工程を取り消したら、運営の受付完了も戻す。
    // そろっていない状態で「受付完了」だけが残ってしまわないようにする
    if (undo) patch.checkin_seen_at = null

    const { error } = await db.from('applications').update(patch).eq('id', applicationId)
    if (error) return NextResponse.json({ error: '更新に失敗しました: ' + error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '不明なエラー' }, { status: 500 })
  }
}
