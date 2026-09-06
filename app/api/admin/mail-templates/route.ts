import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { MAIL_DEFS, MAIL_DEF_BY_KEY, fillVars } from '../../../lib/mailTemplates'

// 送信メールの文面の編集。
//
// mail_templates には「上書き」だけを置く。行が無ければ
// コード側の既定の文面が使われる（app/lib/mailTemplates.ts）。
// 「既定に戻す」は行を消すだけで済む。
//
// 文面は出店者・募集者へ送られるもので、運営だけが書き換えてよい。
// ブラウザから書き換えられると、なりすましのメールを作れてしまうため、
// mail_templates は RLS を有効にしてポリシーを作っていない。
// サービスロールを持つこのAPIだけが読み書きできる。

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

// 一覧。既定の文面と、上書きがあればその内容も返す
export async function GET(req: Request) {
  const ctx = await requireAdmin(req)
  if (ctx instanceof NextResponse) return ctx
  const { db } = ctx

  const { data, error } = await db
    .from('mail_templates').select('key, subject, body, updated_at, profiles:updated_by(name)')
  if (error) return NextResponse.json({ error: '読み込みに失敗: ' + error.message }, { status: 500 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const overrides = new Map<string, any>((data || []).map((r: any) => [r.key, r]))

  return NextResponse.json({
    templates: MAIL_DEFS.map(d => {
      const o = overrides.get(d.key)
      return {
        key: d.key,
        label: d.label,
        to: d.to,
        when: d.when,
        vars: d.vars,
        // 既定の文面。「元に戻す」と、いま何が違うかを画面で見せるために返す
        defaultSubject: d.subject,
        defaultBody: d.body,
        // いま実際に使われている文面
        subject: o?.subject ?? d.subject,
        body: o?.body ?? d.body,
        edited: !!o,
        updatedAt: o?.updated_at ?? null,
        updatedBy: o?.profiles?.name ?? null,
      }
    }),
  })
}

// 上書きを保存する
export async function POST(req: Request) {
  const ctx = await requireAdmin(req)
  if (ctx instanceof NextResponse) return ctx
  const { db, uid } = ctx

  const { key, subject, body } = await req.json().catch(() => ({}))
  const def = MAIL_DEF_BY_KEY[key]
  if (!def) return NextResponse.json({ error: '対象のメールが見つかりません' }, { status: 400 })

  const s = typeof subject === 'string' ? subject.trim() : ''
  const b = typeof body === 'string' ? body.trim() : ''
  if (!s) return NextResponse.json({ error: '件名を入れてください' }, { status: 400 })
  if (!b) return NextResponse.json({ error: '本文を入れてください' }, { status: 400 })

  // 使えない差し込みが書かれていないか確かめる。
  // 打ち間違えると、送るメールにその記号がそのまま出る…わけではなく
  // 空文字に置き換わるので、気づかないまま情報が抜ける。ここで止める
  const known = new Set(def.vars.map(v => v.name))
  const used = [...(s + '\n' + b).matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)].map(m => m[1])
  const unknown = [...new Set(used.filter(v => !known.has(v)))]
  if (unknown.length > 0) {
    return NextResponse.json({
      error: 'このメールでは使えない差し込みがあります：' + unknown.map(v => '{{' + v + '}}').join('、')
        + '\n使えるのは ' + def.vars.map(v => '{{' + v.name + '}}').join('、') + ' です。',
    }, { status: 400 })
  }

  const { error } = await db.from('mail_templates').upsert({
    key, subject: s, body: b, updated_by: uid, updated_at: new Date().toISOString(),
  }, { onConflict: 'key' })
  if (error) return NextResponse.json({ error: '保存に失敗: ' + error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}

// 既定に戻す（上書きの行を消すだけ）
export async function DELETE(req: Request) {
  const ctx = await requireAdmin(req)
  if (ctx instanceof NextResponse) return ctx
  const { db } = ctx

  const key = new URL(req.url).searchParams.get('key') || ''
  if (!MAIL_DEF_BY_KEY[key]) return NextResponse.json({ error: '対象のメールが見つかりません' }, { status: 400 })

  const { error } = await db.from('mail_templates').delete().eq('key', key)
  if (error) return NextResponse.json({ error: '削除に失敗: ' + error.message }, { status: 500 })

  const def = MAIL_DEF_BY_KEY[key]
  return NextResponse.json({ success: true, subject: def.subject, body: def.body })
}

// 差し込みを入れた見本を返す（保存する前に、届く形を確かめるため）
export async function PUT(req: Request) {
  const ctx = await requireAdmin(req)
  if (ctx instanceof NextResponse) return ctx

  const { key, subject, body } = await req.json().catch(() => ({}))
  const def = MAIL_DEF_BY_KEY[key]
  if (!def) return NextResponse.json({ error: '対象のメールが見つかりません' }, { status: 400 })

  // 見本の値。実際の値が入る場所が分かるように、かぎ括弧で囲む
  const sample: Record<string, string> = {}
  for (const v of def.vars) sample[v.name] = '［' + v.name + '］'

  return NextResponse.json({
    subject: fillVars(typeof subject === 'string' ? subject : def.subject, sample),
    body: fillVars(typeof body === 'string' ? body : def.body, sample),
  })
}
