import { NextResponse } from 'next/server'
import { requireAdmin } from '../../../lib/apiAuth'

// 出店者の本名（profiles.name）を、運営だけが引けるようにする入口。
//
// 【なぜ要るか】
//   これまで本名は公開用ビュー public_sellers の name 列から引いていた。
//   ビューは anon に読ませているので、ブラウザに置いてある鍵だけで
//   承認済み出店者ぜんぶの本名が取れてしまっていた
//   （2026-09-19 に出店者ご本人から申し出。移行SQLは
//    supabase/migrations/20260919_public_sellers_no_name.sql）。
//
//   とはいえ運営の業務では本名が要る（請求書の宛名、提出書類の照合、
//   当日の出欠合わせなど）。そこで「誰でも読める経路」を閉じたうえで、
//   運営だけが通れる経路をここに1つ作る。
//
// 【守り方】
//   ・アクセストークンで呼び出し元を確かめ、profiles.role='admin' でなければ 403。
//     ほかの /api/admin/* と共通の requireAdmin（app/lib/apiAuth.ts）を使う。
//   ・profiles を読むのはサービスロールキーなので、RLS ではなくその関門が唯一の砦。
//     呼び出し元の id を body で受け取る作りにはしない（詐称できるため）。
//   ・渡された id の分だけ返す。総なめできないよう件数に上限を付け、
//     id は UUID の形のものだけ通す。
//   ・返すのは名前だけ。メール・電話・住所は返さない。

// 1回に引ける人数の上限。
// 施設へ出す提出用Excelがいちばん多くて、1案件あたり数十人。
// 200 あれば足り、これ以上は総なめの疑いがある（クライアント側で分割して呼ぶ）
const MAX_IDS = 200

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(req: Request) {
  try {
    const ctx = await requireAdmin(req)
    if (ctx instanceof NextResponse) return ctx
    const { db } = ctx

    const body = await req.json().catch(() => ({}))
    const raw = Array.isArray(body?.ids) ? body.ids : []
    // 形の合わない id は落とす。重複も1回にまとめる
    const ids = Array.from(new Set(
      raw.map((x: unknown) => String(x ?? '')).filter((x: string) => UUID_RE.test(x)),
    )) as string[]

    if (ids.length === 0) return NextResponse.json({ sellers: [] })
    if (ids.length > MAX_IDS) {
      return NextResponse.json(
        { error: '一度に引けるのは' + MAX_IDS + '件までです（' + ids.length + '件を受け取りました）' },
        { status: 400 },
      )
    }

    // 出店者に絞る。
    // この入口は「出店者の本名を引く」ためのものなので、渡された id が
    // 募集者やほかの運営でも返ってしまう形にはしない（返すものを仕組みで縛る）。
    // 出店者でない id は返らないだけなので、呼び出し側は今までどおり
    // 屋号・定型文で埋まる
    const { data, error } = await db
      .from('profiles')
      .select('id, name, shop_name')
      .eq('role', 'seller')
      .in('id', ids)
    if (error) {
      console.error('出店者名の取得に失敗しました', error.message)
      return NextResponse.json({ error: '読み込めませんでした。時間をおいてお試しください' }, { status: 500 })
    }

    return NextResponse.json({
      sellers: (data || []).map((p: { id: string; name: string | null; shop_name: string | null }) => ({
        id: p.id,
        name: p.name || '',
        shopName: p.shop_name || '',
      })),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '不明なエラー'
    console.error('出店者名の取得でエラー', msg)
    return NextResponse.json({ error: '読み込めませんでした' }, { status: 500 })
  }
}
