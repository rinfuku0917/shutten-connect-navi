import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { verifyCronCaller } from '../../../lib/cronAuth'

// 案件の料金設定をまとめて直す。
// 移行時など、同じ条件の案件が何十件もあるときに使う。
// 管理画面の「料金」から1件ずつ直すのと同じ内容を入れる。

export const maxDuration = 300

type Item = {
  placeId?: string
  placeTitle?: string
  // 平日・土日祝で分ける場合（円）
  weekdayPlaceFee?: number | null
  weekdayCompanyFee?: number | null
  weekendPlaceFee?: number | null
  weekendCompanyFee?: number | null
}

export async function POST(req: Request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceKey) return NextResponse.json({ error: 'サーバー設定エラー' }, { status: 500 })
    const db = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

    const auth = await verifyCronCaller(req)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const body = await req.json()
    const items: Item[] = Array.isArray(body.items) ? body.items : []
    if (items.length === 0) return NextResponse.json({ error: '対象がありません' }, { status: 400 })
    if (items.length > 500) return NextResponse.json({ error: '一度に直せるのは500件までです' }, { status: 400 })

    const num = (v: unknown) => (typeof v === 'number' && isFinite(v) && v >= 0 ? Math.round(v) : null)
    let updated = 0
    const errors: string[] = []

    for (const it of items) {
      const name = it.placeTitle || it.placeId || '(不明)'
      try {
        let id = it.placeId
        if (!id && it.placeTitle) {
          const { data } = await db.from('places').select('id').eq('title', it.placeTitle).limit(2)
          if (!data || data.length === 0) { errors.push(name + ': 案件が見つかりません'); continue }
          if (data.length > 1) { errors.push(name + ': 同じ名前の案件が複数あります'); continue }
          id = data[0].id
        }
        if (!id) { errors.push(name + ': 案件が指定されていません'); continue }

        const side = (p: unknown, c: unknown) => {
          const o: Record<string, number> = {}
          const a = num(p), b = num(c)
          if (a != null) o.placeFee = a
          if (b != null) o.companyFee = b
          return Object.keys(o).length ? o : null
        }
        const wd = side(it.weekdayPlaceFee, it.weekdayCompanyFee)
        const we = side(it.weekendPlaceFee, it.weekendCompanyFee)
        const dtf: Record<string, unknown> = {}
        if (wd) dtf.weekday = wd
        if (we) dtf.weekend = we

        const { data: upd, error } = await db.from('places')
          .update({ day_type_fees: Object.keys(dtf).length ? dtf : null })
          .eq('id', id).select('id, title')
        if (error) { errors.push(name + ': ' + error.message); continue }
        if (!upd || upd.length === 0) { errors.push(name + ': 更新できませんでした'); continue }
        updated += 1
      } catch (e) {
        errors.push(name + ': ' + (e instanceof Error ? e.message : '不明なエラー'))
      }
    }

    return NextResponse.json({ success: true, updated, failed: errors.length, errors: errors.slice(0, 20) })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '不明なエラー'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
