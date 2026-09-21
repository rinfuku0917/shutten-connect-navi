import { NextResponse } from 'next/server'
import { requireCaller, denyNotAdmin } from '../../lib/apiAuth'

// 案件の「募集終了」を切り替える。
//
// 押せるのは、管理者と、その案件を出している募集者本人だけ。
// places の更新は RLS で無言のうちに弾かれることがあるため、
// 権限を確かめたうえでサービスロールで実行する。
//
// 「持ち主か運営か」で分かれるので、関門は requireCaller を使う。
// 403 の条件（案件の持ち主か）は案件を読んでからしか決まらないので、
// 足切りは下に残す。401 の文面は画面の言い方に合わせて差し替える

export async function POST(req: Request) {
  try {
    // 引数の検査より先に、名乗っているかを見る。
    // もとは「パラメータ不足」400 が先に出ていて、ログインしていない相手にも
    // 引数の当たり外れを教えていた
    const ctx = await requireCaller(req, undefined, 'ログインが必要です')
    if (ctx instanceof NextResponse) return ctx
    const { caller, db } = ctx

    const { placeId, closed } = await req.json()
    if (!placeId || typeof closed !== 'boolean') {
      return NextResponse.json({ error: 'パラメータ不足' }, { status: 400 })
    }

    const { data: place } = await db.from('places').select('id, host_id').eq('id', placeId).maybeSingle()
    if (!place) return NextResponse.json({ error: '案件が見つかりません' }, { status: 404 })

    const isAdmin = caller.isAdmin
    const isOwner = place.host_id === caller.uid
    if (!isAdmin && !isOwner) {
      // 持ち主なら役割を見ずに通る。運営でないと通らないと決まった今だけ、
      // 役割が読めていたかを確かめる（読めていなければ 403 ではなく 503）
      return denyNotAdmin(caller, 'この案件を変更する権限がありません')
    }

    const { data: upd, error } = await db
      .from('places')
      .update({ closed, closed_at: closed ? new Date().toISOString() : null })
      .eq('id', placeId)
      .select('id, title, closed')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!upd || upd.length === 0) return NextResponse.json({ error: '更新できませんでした' }, { status: 500 })

    return NextResponse.json({ success: true, place: upd[0] })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '不明なエラー'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
