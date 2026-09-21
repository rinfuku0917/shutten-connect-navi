import { NextResponse } from 'next/server'
import { requireCaller, denyNotAdmin } from '../../lib/apiAuth'

// 案件を複製する。
//
// 同じ会場で月ごとに募集を出し直すことが多いため、
// 前の案件をそのまま複製して、日程や題名だけ直せるようにする。
//
// 複製したものは必ず「下書き」で作る。中身を直さないまま
// 公開されてしまうと、古い日程のまま募集が出てしまうため。

// 複製しない項目。これらは新しい案件として作り直す。
const SKIP = new Set([
  'id',
  'created_at',
  'posted_at',   // 掲載日は公開したときに入る
  'closed',      // 募集終了の状態は引き継がない
  'closed_at',
  'pinned',      // 上位表示は引き継がない
  'urgent',      // 急募も引き継がない
])

export async function POST(req: Request) {
  try {
    // 「持ち主か運営か」で分かれるので、関門は requireCaller を使う。
    // 403 の条件（案件の持ち主か）は案件を読んでからしか決まらないので、
    // 足切りは下に残す。401 の文面は画面の言い方に合わせて差し替える。
    // 引数の検査より先に見る（もとは「案件が指定されていません」400 が先に出ていた）
    const ctx = await requireCaller(req, undefined, 'ログインが必要です')
    if (ctx instanceof NextResponse) return ctx
    const { caller, db } = ctx

    const { placeId } = await req.json()
    if (!placeId) return NextResponse.json({ error: '案件が指定されていません' }, { status: 400 })

    const { data: src } = await db.from('places').select('*').eq('id', placeId).maybeSingle()
    if (!src) return NextResponse.json({ error: '案件が見つかりません' }, { status: 404 })

    const isAdmin = caller.isAdmin
    const isOwner = src.host_id === caller.uid
    if (!isAdmin && !isOwner) {
      // 持ち主なら役割を見ずに通る。運営でないと通らないと決まった今だけ、
      // 役割が読めていたかを確かめる（読めていなければ 403 ではなく 503）
      return denyNotAdmin(caller, 'この案件を複製する権限がありません')
    }

    const copy: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(src)) {
      if (!SKIP.has(k)) copy[k] = v
    }
    copy.title = String(src.title || '(無題)') + '（コピー）'
    // 中身を直してから公開してもらう
    copy.status = 'draft'
    // 募集者本人が複製したときは、その人の案件として作る
    if (!isAdmin) copy.host_id = caller.uid

    const { data: created, error } = await db.from('places').insert(copy).select('id, title').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, place: created })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '不明なエラー'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
