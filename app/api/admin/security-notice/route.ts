import { Resend } from 'resend'
import { NextResponse } from 'next/server'
import { requireAdmin } from '../../../lib/apiAuth'
import { renderMail, MAIL_DEF_BY_KEY } from '../../../lib/mailTemplates'

// 会員ぜんぶ（出店者・募集者）へ、注意喚起をまとめて送る。
//
// なぜ要るか（2026-10-02）:
//   弊社の社員を名乗り、LINEのQRコードと所属・役職を返信させようとする
//   偽のメールが info@ に届いた（差出人「山根拓也（業務連絡）株式会社ｎａｖ」、
//   返信先 kenneth_maddencmkp@outlook.jp）。
//   会員にも同じものが届いている可能性があり、至急お知らせする必要があった。
//
//   それまで一斉にお知らせする手立てが無かった。
//   あったのは「案件の応募者へまとめて」（/api/messages/broadcast）と
//   「1件だけのテスト送信」（/api/admin/mail-templates/send）だけ。
//
// 【安全のための決めごと】
//   ・運営だけが使える（requireAdmin）
//   ・dryRun=true が既定。送るときは send=true を明示する。
//     1,400通を超える送信なので、押し間違いで飛ばないようにする
//   ・1回の実行で送る上限を置き、offset で続きから送る。
//     Resend には秒あたりの上限があるので間隔を空けて1通ずつ送る
//   ・並びは id の昇順で固定する。並びが変わると offset が意味を失い、
//     二重に送る人と送られない人が出る
//
// 文面は管理画面（メール文面タブ）の security-notice。
// 「偽メールの特徴」は、実際に届いたものを運営が入れる。

export const maxDuration = 300

const FROM_EMAIL = 'noreply@mail.connect-navi.com'
// Resend の秒あたりの上限に当たらない間隔（既存の /api/messages/broadcast と同じ）
const SEND_INTERVAL_MS = 600
// 1回の実行で送る上限。600ms × 400 = 240秒で、maxDuration の 300秒に収まる
const MAX_PER_RUN = 400

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

type Member = { id: string; name: string | null; shop_name: string | null; email: string | null }

export async function POST(req: Request) {
  const ctx = await requireAdmin(req)
  if (ctx instanceof NextResponse) return ctx
  const { db } = ctx

  try {
    const body = await req.json().catch(() => ({}))
    // 既定は送らない。送るときだけ send: true を明示させる
    const send = body?.send === true
    const offset = Math.max(0, Math.floor(Number(body?.offset) || 0))
    const asked = Number(body?.limit)
    const limit = Math.min(Number.isFinite(asked) && asked > 0 ? Math.floor(asked) : MAX_PER_RUN, MAX_PER_RUN)
    // 偽メールの特徴。運営が実際に届いたものを入れる
    const detail = typeof body?.detail === 'string' ? body.detail.trim() : ''

    // 運営は宛先に入れない（自分たちには届いているので）
    const { data: rows, error } = await db
      .from('profiles')
      .select('id, name, shop_name, email')
      .in('role', ['seller', 'host'])
      .not('email', 'is', null)
      .order('id', { ascending: true })
      .range(offset, offset + limit - 1)
    if (error) return NextResponse.json({ error: '宛先の取得に失敗: ' + error.message }, { status: 500 })

    const members = ((rows || []) as Member[]).filter(m => (m.email || '').trim() !== '')

    // 全体の件数も返す。何回に分けて送ればよいかが分かる
    const { count: total } = await db
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .in('role', ['seller', 'host'])
      .not('email', 'is', null)

    const def = MAIL_DEF_BY_KEY['security-notice']
    const vars = (m: Member) => ({
      '屋号': m.shop_name || m.name || 'ご利用者',
      '偽メールの特徴': detail || '（運営が入力）',
    })

    if (!send) {
      const sample = members[0]
      const preview = sample ? await renderMail(db, 'security-notice', { subject: def.subject, body: def.body }, vars(sample)) : null
      return NextResponse.json({
        success: true, dryRun: true, sent: 0,
        宛先の総数: total ?? null,
        この回の宛先: members.length,
        この回の範囲: `${offset + 1}〜${offset + members.length}件目`,
        次のoffset: offset + members.length,
        送るには: 'send: true を付けて同じ内容で呼ぶ',
        文面の見本: preview ? { 件名: preview.subject, 本文: preview.text } : null,
      })
    }

    if (!detail) {
      return NextResponse.json({ error: '「偽メールの特徴」を入れてください（本文に入ります）' }, { status: 400 })
    }

    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'サーバー設定エラー' }, { status: 500 })
    const resend = new Resend(apiKey)

    let sent = 0
    const errors: string[] = []
    let first = true
    for (const m of members) {
      if (!first) await sleep(SEND_INTERVAL_MS)
      first = false
      const mail = await renderMail(db, 'security-notice', { subject: def.subject, body: def.body }, vars(m))
      const { error: mErr } = await resend.emails.send({
        from: '出店コネクトナビ運営事務局 <' + FROM_EMAIL + '>',
        to: (m.email as string).trim(),
        subject: mail.subject,
        text: mail.text,
      })
      if (mErr) { errors.push(`${m.email}: ${String(mErr.message || mErr)}`); continue }
      sent += 1
    }

    return NextResponse.json({
      success: true, sent,
      宛先の総数: total ?? null,
      この回の範囲: `${offset + 1}〜${offset + members.length}件目`,
      次のoffset: offset + members.length,
      残り: Math.max(0, (total ?? 0) - (offset + members.length)),
      errors: errors.slice(0, 5),
      エラー件数: errors.length,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '不明なエラー'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
