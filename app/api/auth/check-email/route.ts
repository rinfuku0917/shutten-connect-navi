import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// 登録済みメールアドレスかどうかを返す。
// Supabase の signUp は「アドレスの存在を外部に知らせない」方針のため
// 既存アドレスでもエラーを返さず成功したように見える（メールは届かない）。
// そのままだと利用者が「登録できた」と誤解するので、登録前にここで判定する。
export async function POST(req: Request) {
  try {
    const { email } = await req.json()
    const addr = typeof email === 'string' ? email.trim().toLowerCase() : ''
    if (!addr) return NextResponse.json({ error: 'メールアドレスが空です' }, { status: 400 })

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceKey) {
      // 設定不備で登録自体を止めないよう、判定不能として扱う
      return NextResponse.json({ exists: false, checked: false })
    }
    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data, error } = await admin
      .from('profiles')
      .select('id, role')
      .ilike('email', addr)
      .limit(1)
    if (error) return NextResponse.json({ exists: false, checked: false })

    const hit = data && data.length > 0 ? data[0] : null
    // 役割は出店者・募集者のときだけ返す。
    //
    // 登録画面は「（出店者として登録済みです）」と添えるためにこれを使う。
    // ただし運営（admin）まで返すと、この入口は認証なしで呼べるので、
    // アドレスを順に試して運営アカウントを見つける材料になる。
    // 運営のアドレスは、登録しようとした人に伝える必要がない
    const role = hit?.role === 'seller' || hit?.role === 'host' ? hit.role : null
    return NextResponse.json({
      exists: !!hit,
      checked: true,
      role,
    })
  } catch {
    return NextResponse.json({ exists: false, checked: false })
  }
}
