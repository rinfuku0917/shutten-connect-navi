import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { renderMail, MAIL_DEF_BY_KEY } from '../../../lib/mailTemplates'

// 出店料の入金の督促を、1件ずつ送る。
//
// 売上報告の督促（/api/admin/sales-remind）は「報告してください」で、
// こちらは「入金が確認できていません」。別のものなので分けている。
//
// 自動では送らない。入金の督促は文面も時期も相手によって変わり、
// 行き違い（すでに振り込んでいる）の可能性も常にあるため、
// 運営が一覧を見て1件ずつ判断して押す。
//
// 送った日時は invoices.paid_memo に書き足して残す。
// 督促だけの表を増やさずに「前回いつ送ったか」を画面へ出せるようにするため。

const FROM_EMAIL = 'noreply@mail.connect-navi.com'
const REPLY_TO = 'info@connect-navi.com'

// 同じ請求書への連打を止める。押した本人が二度押しただけで
// 出店者に2通届くのは避けたい
const recentSends = new Map<string, number>()

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Ctx = { db: any; uid: string }

async function requireAdmin(req: Request): Promise<Ctx | NextResponse> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return NextResponse.json({ error: 'サーバー設定エラー' }, { status: 500 })

  const db = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const { data: userData, error: uErr } = await db.auth.getUser(token)
  const uid = userData?.user?.id
  if (uErr || !uid) return NextResponse.json({ error: '認証に失敗しました' }, { status: 401 })

  const { data: me } = await db.from('profiles').select('role').eq('id', uid).maybeSingle()
  if (me?.role !== 'admin') return NextResponse.json({ error: '運営のみが操作できます' }, { status: 403 })

  return { db, uid }
}

// 督促を送った記録を、メモの先頭に足す。
// 既に入っているメモは消さない（運営が手で書いた内容が消えると困る）
function stampMemo(memo: string | null, when: Date): string {
  const d = when.toISOString().slice(0, 10)
  const line = '[督促 ' + d + ']'
  const body = (memo || '').trim()
  return (line + (body ? '\n' + body : '')).slice(0, 500)
}

/** メモから、督促を送った日を新しい順に拾う */
function sentDatesOf(memo: string | null): string[] {
  return [...String(memo || '').matchAll(/\[督促 (\d{4}-\d{2}-\d{2})\]/g)].map(m => m[1])
}

// この請求書へ前回いつ送ったか。画面に出して連打を防ぐ
export async function GET(req: Request) {
  const ctx = await requireAdmin(req)
  if (ctx instanceof NextResponse) return ctx
  const { db } = ctx

  const invoiceId = new URL(req.url).searchParams.get('invoiceId') || ''
  if (!invoiceId) return NextResponse.json({ error: 'パラメータ不足' }, { status: 400 })

  const { data } = await db.from('invoices').select('paid_memo').eq('id', invoiceId).maybeSingle()
  const dates = sentDatesOf(data?.paid_memo ?? null)
  return NextResponse.json({ count: dates.length, lastSentAt: dates[0] || null })
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAdmin(req)
    if (ctx instanceof NextResponse) return ctx
    const { db } = ctx

    const { invoiceId } = await req.json().catch(() => ({}))
    if (!invoiceId) return NextResponse.json({ error: '請求書が指定されていません' }, { status: 400 })

    const { data: inv, error: gErr } = await db
      .from('invoices')
      .select('id, invoice_no, seller_id, period, total, due_on, paid_status, paid_memo, voided_at')
      .eq('id', invoiceId).maybeSingle()
    if (gErr || !inv) return NextResponse.json({ error: '請求書が見つかりません' }, { status: 404 })

    // 取り消した請求書に督促を送ってはいけない
    if (inv.voided_at) {
      return NextResponse.json({ error: 'この請求書は取り消されています' }, { status: 409 })
    }
    // すでに入金を確認しているものに送ってはいけない。
    // いちばん失礼な間違いなので、画面側だけでなくここでも止める
    if (inv.paid_status === 'paid') {
      return NextResponse.json({ error: 'この請求書は入金確認済みです' }, { status: 409 })
    }

    const dedupeKey = 'payment-remind|' + String(invoiceId)
    const nowTs = Date.now()
    const lastTs = recentSends.get(dedupeKey)
    if (lastTs && nowTs - lastTs < 10000) {
      return NextResponse.json({ error: 'たったいま送信しました。しばらくお待ちください' }, { status: 429 })
    }

    const { data: seller } = await db
      .from('profiles').select('name, shop_name, email').eq('id', inv.seller_id).maybeSingle()
    const to = seller?.email
    if (!to) return NextResponse.json({ error: 'この出店者のメールアドレスが登録されていません' }, { status: 409 })

    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) return NextResponse.json({ error: 'メールの設定がされていません' }, { status: 500 })

    // 文面は管理画面（メール文面タブ）で書き換えられる
    const def = MAIL_DEF_BY_KEY['payment-remind']
    const mail = await renderMail(db, 'payment-remind', { subject: def.subject, body: def.body }, {
      '屋号': seller?.shop_name || seller?.name || 'ご担当者',
      '請求書番号': inv.invoice_no,
      '対象月': inv.period,
      '金額': '¥' + Number(inv.total || 0).toLocaleString(),
      // 期限を決めていない請求書もある。空欄のまま送らない
      '支払期限': inv.due_on ? String(inv.due_on).replace(/-/g, '/') : 'お早めに',
    })

    recentSends.set(dedupeKey, nowTs)
    if (recentSends.size > 500) {
      for (const [k, t] of recentSends) { if (nowTs - t > 60000) recentSends.delete(k) }
    }

    const resend = new Resend(apiKey)
    const { error } = await resend.emails.send({
      from: '出店コネクトナビ <' + FROM_EMAIL + '>',
      to,
      replyTo: REPLY_TO,
      subject: mail.subject,
      text: mail.text,
    })
    if (error) {
      // 送れていないので記録もしない。記録すると
      // 「送ったのに届いていない」と取り違える
      recentSends.delete(dedupeKey)
      return NextResponse.json(
        { error: '送信に失敗しました: ' + String(error.message || error) },
        { status: 500 },
      )
    }

    const when = new Date()
    const { error: uErr } = await db
      .from('invoices').update({ paid_memo: stampMemo(inv.paid_memo, when) }).eq('id', invoiceId)
    if (uErr) {
      // 送れてはいるので成功として返す。記録できなかったことだけ伝える
      console.error('督促の記録に失敗しました', uErr.message)
      return NextResponse.json({ success: true, logged: false, sentTo: to })
    }

    return NextResponse.json({ success: true, logged: true, sentTo: to, sentOn: when.toISOString().slice(0, 10) })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '不明なエラー'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
