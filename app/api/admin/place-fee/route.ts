import { NextResponse } from 'next/server'
import { getAdminClient, serverConfigResponse } from '../../../lib/apiAuth'
import { verifyCronCaller } from '../../../lib/cronAuth'
import { isMissingColumn } from '../../../lib/optionalColumn'

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
  // 最低保証（歩合が少ない日の下限。円・税別）。
  // 上の固定額とは別の列（places.min_guarantee）に入る。
  // 4つとも渡さなかった案件は、最低保証を触らない（消さない）
  minWeekdayPlaceFee?: number | null
  minWeekdayCompanyFee?: number | null
  minWeekendPlaceFee?: number | null
  minWeekendCompanyFee?: number | null
}

export async function POST(req: Request) {
  try {
    // 名乗りを先に見る。鍵の有無（サーバーの設定状態）を先に返すと、
    // トークンも鍵も持たない相手に 500 を教えることになる
    // （AGENTS.md「APIの権限判定ルール」の見る順）
    const auth = await verifyCronCaller(req)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const db = getAdminClient()
    if (!db) return serverConfigResponse()

    const body = await req.json()
    const items: Item[] = Array.isArray(body.items) ? body.items : []
    if (items.length === 0) return NextResponse.json({ error: '対象がありません' }, { status: 400 })
    if (items.length > 500) return NextResponse.json({ error: '一度に直せるのは500件までです' }, { status: 400 })

    const num = (v: unknown) => (typeof v === 'number' && isFinite(v) && v >= 0 ? Math.round(v) : null)
    // 最低保証の 0 は「下限なし」＝未設定と同じ動きなので落とす。
    // 残すと hasMinGuarantee が「設定あり」と見て、案件一覧のカードが
    // 自由文を捨てて「（最低保証あり）」だけを出す（額は1円も出ない）。
    // 画面側の buildMinGuaranteeJson と同じ形にそろえる
    const minNum = (v: unknown) => { const n = num(v); return n != null && n > 0 ? n : null }
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

        const mkSide = (toNum: (v: unknown) => number | null) => (p: unknown, c: unknown) => {
          const o: Record<string, number> = {}
          const a = toNum(p), b = toNum(c)
          if (a != null) o.placeFee = a
          if (b != null) o.companyFee = b
          return Object.keys(o).length ? o : null
        }
        const side = mkSide(num)
        const minSide = mkSide(minNum)
        const wd = side(it.weekdayPlaceFee, it.weekdayCompanyFee)
        const we = side(it.weekendPlaceFee, it.weekendCompanyFee)
        const dtf: Record<string, unknown> = {}
        if (wd) dtf.weekday = wd
        if (we) dtf.weekend = we

        const patch: Record<string, unknown> = { day_type_fees: Object.keys(dtf).length ? dtf : null }
        // 最低保証は、項目を1つでも渡されたときだけ書き換える。
        // 渡されていない案件で null にしてしまうと、
        // 固定額を直すだけの呼び出しで最低保証が消える
        const minGiven = ['minWeekdayPlaceFee', 'minWeekdayCompanyFee', 'minWeekendPlaceFee', 'minWeekendCompanyFee']
          .some(k => (it as Record<string, unknown>)[k] !== undefined)
        if (minGiven) {
          const mwd = minSide(it.minWeekdayPlaceFee, it.minWeekdayCompanyFee)
          const mwe = minSide(it.minWeekendPlaceFee, it.minWeekendCompanyFee)
          const mg: Record<string, unknown> = {}
          if (mwd) mg.weekday = mwd
          if (mwe) mg.weekend = mwe
          patch.min_guarantee = Object.keys(mg).length ? mg : null
        }

        let { data: upd, error } = await db.from('places')
          .update(patch)
          .eq('id', id).select('id, title')
        // min_guarantee は移行SQLを流すまで列が無い。列が無い環境では
        // 固定額（day_type_fees）だけ保存し、最低保証が入っていないことを知らせる。
        // まとめて入れるための入口なので、ここで update 全体が失敗すると
        // 同じ呼び出しで指定した固定額まで保存されない
        if (isMissingColumn(error) && 'min_guarantee' in patch) {
          const rest = { ...patch }
          delete rest.min_guarantee
          const retry = await db.from('places').update(rest).eq('id', id).select('id, title')
          upd = retry.data; error = retry.error
          if (!error) errors.push(name + ': 最低保証は列が未作成のため保存していません（ほかの料金は保存しました）')
        }
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
