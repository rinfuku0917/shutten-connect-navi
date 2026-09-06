import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// 売上報告の受理。運営が「受け取った」ことを記録する。
//
// 出店者の画面にも「受理済み」と出る（メールは送らない）。
// 出店は回数が多いため、受理のたびにメールを送ると
// 出店の多い方には毎週何通も届いてしまう。
//
// 押し直すと取り消せる。当日の「受付完了」と同じ考え方。
//
// sales の更新はコード全体でここだけ。
// ブラウザからの更新ポリシーが本番にあるか確認できないため、
// サービスロールを持つこのAPIを通す。

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Ctx = { db: any; uid: string }

async function requireAdmin(req: Request): Promise<Ctx | NextResponse> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return NextResponse.json({ error: 'サーバー設定エラー' }, { status: 500 })

  const db = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

  // 呼び出し元をアクセストークンで確かめる。body のIDは信用しない
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

export async function POST(req: Request) {
  const ctx = await requireAdmin(req)
  if (ctx instanceof NextResponse) return ctx
  const { db, uid } = ctx

  const { saleId, undo } = await req.json().catch(() => ({}))
  if (!saleId) return NextResponse.json({ error: 'パラメータ不足' }, { status: 400 })

  // 対象が実在するか確かめてから書く
  const { data: sale } = await db
    .from('sales').select('id, accepted_at').eq('id', saleId).maybeSingle()
  if (!sale) return NextResponse.json({ error: '対象の売上報告が見つかりません' }, { status: 404 })

  const patch = undo
    ? { accepted_at: null, accepted_by: null }
    : { accepted_at: new Date().toISOString(), accepted_by: uid }

  const { data, error } = await db
    .from('sales').update(patch).eq('id', saleId).select('id, accepted_at')
  if (error) return NextResponse.json({ error: '保存に失敗: ' + error.message }, { status: 500 })
  // 権限で弾かれると「エラー無しで0件」になる。件数を見ないと気づけない
  if (!data || data.length === 0) {
    return NextResponse.json({ error: '更新できませんでした（権限をご確認ください）' }, { status: 500 })
  }

  return NextResponse.json({ success: true, acceptedAt: data[0].accepted_at })
}
