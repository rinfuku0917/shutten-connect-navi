import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { verifyCronCaller } from '../../../lib/cronAuth'
import { renderMail, MAIL_DEF_BY_KEY } from '../../../lib/mailTemplates'

// 提出書類の有効期限のお知らせ。Vercel の定期実行（毎朝9時）から呼ばれる。
//
// なぜ要るか（2026-10-01）:
//   有効期限は出店者の画面に印が出るだけで、メールでの知らせが無かった。
//   その結果、お預かりしている損害賠償保険証書818件のうち565件が
//   期限を過ぎたまま残っていた（更新したのに出し直していないだけのものも
//   含むが、こちらの写しが古いままなのは変わらない）。
//   施設へは「運営が書類を確認しています」とお伝えしているので、
//   写しが古いままなのは実務上のまずさになる。
//
// 対象にする期間（ここが一番大事な決めごと）:
//   期限の前後30日だけを見る。
//     ・あと30日以内に切れる … 更新前に気づいてもらう
//     ・切れてから30日以内   … 出し直しをお願いする
//   **30日より前に切れた書類は送らない。**
//   1年以上前に切れたものが321件あり（2026-10-01 時点）、
//   全部に送ると初回だけ数百通が一斉に飛ぶ。古い分をどう扱うかは
//   運営が決めることなので、自動のお知らせからは外しておく。
//   この窓だと初回の対象は76人（同日時点）。
//
// 同じ書類に二度送らない:
//   送ったら seller_documents.expiry_reminded_at に時刻を入れる。
//   書類を出し直して expiry_date が変わったときは、
//   画面側（出店者ダッシュボード）で null に戻すので、新しい期限で改めて届く。
//
// 送る前に中身を見たいとき:
//   ?dryRun=1 を付けると、1通も送らずに対象の件数と内訳だけを返す。
//   初回は必ずこれで確かめてから走らせること。

const FROM_EMAIL = 'noreply@mail.connect-navi.com'

/** 期限の前後、何日ぶんを対象にするか */
const WINDOW_DAYS = 30
/** 1回の実行で送る通数の上限。読み違えたときに一斉送信にならないようにする */
const MAX_MAILS = 60

const DOC_LABELS: Record<string, string> = {
  license_front: '運転免許証（表面）',
  license_back: '運転免許証（裏面）',
  food_hygiene: '食品衛生責任者証',
  liability_insurance: '損害賠償保険証書',
  business_permit: '営業許可証',
  pl_insurance: 'PL保険証券',
  inspection_sample: '検体（検査結果）',
  other_permit: 'その他許可証',
}

// 出店者ごとに1通ずつ順に送るため、既定の実行時間では足りないことがある
export const maxDuration = 300

type DocRow = {
  id: string
  seller_id: string
  doc_type: string
  expiry_date: string
  profiles?: { shop_name?: string | null; name?: string | null; email?: string | null } | null
}

/** 「2026年9月30日」の形。日付はそのまま読める形で文面に出す */
const jpDate = (d: string) => {
  const [y, m, day] = String(d).slice(0, 10).split('-')
  return `${Number(y)}年${Number(m)}月${Number(day)}日`
}

export async function GET(req: Request) {
  const auth = await verifyCronCaller(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  // 送らずに対象だけ見る。初回の確認用
  const dryRun = new URL(req.url).searchParams.get('dryRun') === '1'

  try {
    const sUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const sKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const apiKey = process.env.RESEND_API_KEY
    if (!sUrl || !sKey) return NextResponse.json({ error: 'サーバー設定エラー' }, { status: 500 })
    if (!apiKey && !dryRun) return NextResponse.json({ error: 'サーバー設定エラー' }, { status: 500 })
    const db = createClient(sUrl, sKey, { auth: { autoRefreshToken: false, persistSession: false } })

    // 日付は日本時間で判定する（サーバーはUTCで動くため）
    const nowJst = new Date(Date.now() + 9 * 3600 * 1000)
    const today = nowJst.toISOString().slice(0, 10)
    const soon = new Date(nowJst.getTime() + WINDOW_DAYS * 86400000).toISOString().slice(0, 10)
    const recently = new Date(nowJst.getTime() - WINDOW_DAYS * 86400000).toISOString().slice(0, 10)

    const { data: docs, error } = await db
      .from('seller_documents')
      .select('id, seller_id, doc_type, expiry_date, profiles!seller_documents_seller_id_fkey(shop_name, name, email)')
      .not('expiry_date', 'is', null)
      .is('expiry_reminded_at', null)
      .gte('expiry_date', recently)
      .lte('expiry_date', soon)
      // 否認済みの書類は、別に出し直しをお願いしているので二重に送らない
      .neq('status', 'rejected')
    if (error) return NextResponse.json({ error: '書類の取得に失敗: ' + error.message }, { status: 500 })
    if (!docs || docs.length === 0) return NextResponse.json({ success: true, sent: 0, note: '対象なし' })

    const rows = (docs as unknown as DocRow[]).filter(d => d.profiles?.email)

    // 出店者ごとに1通にまとめる。3種類が同じ月に切れる人がいるため
    const bySeller = new Map<string, DocRow[]>()
    for (const d of rows) {
      const list = bySeller.get(d.seller_id) || []
      list.push(d)
      bySeller.set(d.seller_id, list)
    }

    // 文面に出す1行。切れているか、あと何日かで書き分ける
    const lineOf = (d: DocRow) => {
      const label = DOC_LABELS[d.doc_type] || d.doc_type
      const days = Math.round((new Date(d.expiry_date).getTime() - new Date(today).getTime()) / 86400000)
      return days < 0
        ? `・${label}：${jpDate(d.expiry_date)}で期限が切れています`
        : days === 0
          ? `・${label}：本日（${jpDate(d.expiry_date)}）が期限です`
          : `・${label}：${jpDate(d.expiry_date)}まで（あと${days}日）`
    }

    const sellers = [...bySeller.entries()]
    const targets = sellers.slice(0, MAX_MAILS)

    if (dryRun) {
      return NextResponse.json({
        success: true, dryRun: true, sent: 0,
        対象の人数: sellers.length,
        対象の書類: rows.length,
        送る通数: targets.length,
        上限で送らない人数: Math.max(0, sellers.length - MAX_MAILS),
        見る期間: `${recently} 〜 ${soon}（${today} 基準）`,
        内訳: targets.slice(0, 10).map(([, list]) => ({
          屋号: list[0].profiles?.shop_name || list[0].profiles?.name || '',
          書類: list.map(lineOf),
        })),
      })
    }

    const resend = new Resend(apiKey as string)
    let sent = 0
    const errors: string[] = []

    for (const [, list] of targets) {
      const p = list[0].profiles
      const shopName = p?.shop_name || p?.name || '出店者'
      const lines = list
        .slice()
        .sort((a, b) => (a.expiry_date < b.expiry_date ? -1 : 1))
        .map(lineOf)

      // 文面は管理画面（メール文面タブ）で書き換えられる
      const def = MAIL_DEF_BY_KEY['document-expiry']
      const mail = await renderMail(db, 'document-expiry', { subject: def.subject, body: def.body }, {
        '屋号': shopName,
        '書類の一覧': lines.join('\n'),
      })
      const { error: mErr } = await resend.emails.send({
        from: '出店コネクトナビ <' + FROM_EMAIL + '>',
        to: p!.email as string,
        subject: mail.subject,
        text: mail.text,
      })
      if (mErr) { errors.push(String(mErr.message || mErr)); continue }
      sent += 1
      // 控えに失敗すると翌朝また同じメールが飛ぶため、失敗を記録して気付けるようにする
      const { error: uErr } = await db.from('seller_documents')
        .update({ expiry_reminded_at: new Date().toISOString() })
        .in('id', list.map(d => d.id))
      if (uErr) errors.push('送信済みの記録に失敗: ' + uErr.message)
    }

    return NextResponse.json({
      success: true, sent,
      対象の人数: sellers.length,
      上限で送らなかった人数: Math.max(0, sellers.length - MAX_MAILS),
      errors: errors.slice(0, 3),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '不明なエラー'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
