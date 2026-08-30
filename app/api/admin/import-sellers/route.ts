import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { verifyCronCaller } from '../../../lib/cronAuth'

// 旧サイトの会員CSVを取り込む。管理画面からのみ実行できる。
//
// 新サイトでログインするには次の2つが揃っている必要がある。
//   1. 認証アカウント（auth.users）… ログインの土台
//   2. 会員情報（profiles）        … 名前・店舗名などの表示用
// 片方だけだとログインできないため、両方まとめて作る。
//
// パスワードは設定しない。会員には「パスワードをお忘れの方」から
// 設定していただく（旧サイトのパスワードは引き継げないため）。
// メールは確認済みとして作る。未確認のままだとログインできない。
//
// 何度実行しても同じ結果になるようにしてある（すでにある人は飛ばす）。

export const maxDuration = 300

type Seller = {
  reg_no?: string | number
  registered_at?: string
  shop?: string
  rep?: string
  email?: string
  addr?: string
  tel?: string
  areas?: string
}

export async function POST(req: Request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceKey) return NextResponse.json({ error: 'サーバー設定エラー' }, { status: 500 })
    const db = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

    // 管理画面からのログイン、または運用の鍵（CRON_SECRET）でのみ実行できる。
    // 鍵での実行は、移行作業などで管理画面を開けないときに使う。
    const auth = await verifyCronCaller(req)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const body = await req.json()
    const dryRun = !!body.dryRun
    const list: Seller[] = Array.isArray(body.sellers) ? body.sellers : []
    if (list.length === 0) return NextResponse.json({ error: '取り込むデータがありません' }, { status: 400 })
    if (list.length > 3000) return NextResponse.json({ error: '一度に取り込めるのは3000件までです' }, { status: 400 })

    // メールアドレスで既存を判定する
    const mails = Array.from(new Set(
      list.map(s => (s.email || '').trim().toLowerCase()).filter(m => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m)),
    ))
    if (mails.length === 0) return NextResponse.json({ error: '有効なメールアドレスがありません' }, { status: 400 })

    // 既存の会員情報を集める（大量になるので分けて問い合わせる）
    const existing = new Set<string>()
    for (let i = 0; i < mails.length; i += 200) {
      const { data } = await db.from('profiles').select('email').in('email', mails.slice(i, i + 200))
      for (const p of data || []) if (p.email) existing.add(String(p.email).toLowerCase())
    }

    const targets = list.filter(s => {
      const m = (s.email || '').trim().toLowerCase()
      return m && !existing.has(m) && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m)
    })

    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        total: list.length,
        alreadyExists: list.length - targets.length,
        willCreate: targets.length,
        sample: targets.slice(0, 20).map(s => ({ email: s.email, rep: s.rep, shop: s.shop, reg_no: s.reg_no })),
      })
    }

    let created = 0
    let skipped = 0
    const errors: string[] = []

    for (const s of targets) {
      const email = (s.email || '').trim().toLowerCase()
      try {
        // 1) 認証アカウントを作る。すでにある場合はそのIDを使う。
        let authId: string | null = null
        // メタデータは通常の会員登録と同じ形にする。
        // role などが欠けていると、DB側の登録処理が失敗して
        // 「Database error creating new user」になる。
        const areasArr = (s.areas || '').split(/[,、]/).map(x => x.trim()).filter(Boolean)
        const { data: cu, error: cErr } = await db.auth.admin.createUser({
          email,
          email_confirm: true,
          user_metadata: {
            name: s.rep || '',
            role: 'seller',
            name_kana: '',
            address: s.addr || '',
            phone: s.tel || '',
            ...(s.shop ? { shop_name: s.shop } : {}),
            ...(areasArr.length > 0 ? { areas: areasArr } : {}),
            imported: true,
          },
        })
        if (cErr) {
          // 既に登録済みのメールは、認証アカウントだけ先にできている状態
          const already = /already|registered|exists/i.test(cErr.message || '')
          if (!already) { errors.push(email + ': ' + cErr.message); continue }
          // 既存アカウントのIDを探す（メールで絞り込む）
          const { data: found } = await db.auth.admin.listUsers({ page: 1, perPage: 200 })
          const hit = (found?.users || []).find(u => (u.email || '').toLowerCase() === email)
          authId = hit?.id ?? null
          if (!authId) { errors.push(email + ': 既存アカウントを特定できませんでした'); continue }
        } else {
          authId = cu.user?.id ?? null
        }
        if (!authId) { errors.push(email + ': アカウントIDを取得できませんでした'); continue }

        // 2) 会員情報を作る（認証アカウントと同じIDで作るのが必須）。
        //    登録処理が先に作っている場合もあるため、上書きして揃える。
        const { error: pErr } = await db.from('profiles').upsert({
          id: authId,
          role: 'seller',
          name: s.rep || '',
          shop_name: s.shop || '',
          email,
          phone: s.tel || '',
          address: s.addr || '',
          areas: areasArr,
          approval_status: 'approved',
        }, { onConflict: 'id' })
        if (pErr) { errors.push(email + ': 会員情報の保存に失敗 ' + pErr.message); continue }

        // 3) 取り込み元の記録も残す（次回の差分判定に使う）
        if (s.reg_no) {
          await db.from('imported_sellers').upsert({
            reg_no: Number(s.reg_no),
            registered_at: s.registered_at || null,
            shop_name: s.shop || null,
            rep_name: s.rep || null,
            email,
            phone: s.tel || null,
            address: s.addr || null,
            area: s.areas || null,
            source: 'csv',
          }, { onConflict: 'reg_no' })
        }
        created += 1
      } catch (e) {
        errors.push(email + ': ' + (e instanceof Error ? e.message : '不明なエラー'))
      }
    }
    skipped = list.length - targets.length

    return NextResponse.json({
      success: true,
      total: list.length,
      created,
      skipped,
      failed: errors.length,
      errors: errors.slice(0, 20),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '不明なエラー'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
