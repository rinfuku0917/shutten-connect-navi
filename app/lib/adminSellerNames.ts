import { supabase } from './supabase'

// 運営の画面から、出店者の本名を引く。
//
// 公開用ビュー public_sellers は本名の列を持たなくなった
// （supabase/migrations/20260919_public_sellers_no_name.sql）。
// 本名が要る運営の処理は、ここを通して /api/admin/seller-names を呼ぶ。
// あちらはサービスキーで profiles を読むので、ビューに依存しない。
// つまり移行SQLを流す前でも後でも、運営の画面の表示は変わらない。
//
// 募集者・出店者の画面からは呼ばない（呼んでも 403 が返る）。

// API 側の上限（MAX_IDS）と合わせる。超える分は分けて呼ぶ
const CHUNK = 200

type SellerName = { id: string; name: string; shopName: string }

/**
 * id の配列から「id → 本名」を引く。
 *
 * 【引けなかったときは投げる】
 *   以前は未ログイン・403・500・通信失敗のどれでも、空の（または途中までの）
 *   Map を黙って返していた。呼び出し側は失敗を区別できないので、
 *   施設へそのまま渡す提出用Excelの店舗名が黙って「(屋号未登録)」になり、
 *   運営は気づかないまま書類を出してしまう。
 *   書類が中途半端に出来るくらいなら、出来ないほうが安全なので投げる。
 *   受け取る側（exportPlaceSubmission / exportPlaceSalesReport の呼び出し元）は
 *   すでに try/catch で画面に理由を出す作りになっている。
 *
 * 引く相手が0人のときは何も呼ばずに空の Map を返す（投げない）。
 * 屋号が埋まっている人だけのときに、余計な通信と認証を増やさないため。
 */
export async function fetchAdminSellerNames(ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const uniq = Array.from(new Set(ids.filter(Boolean)))
  if (uniq.length === 0) return out

  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token
  if (!token) throw new Error('ログインしなおしてからお試しください（出店者名を引けませんでした）')

  for (let i = 0; i < uniq.length; i += CHUNK) {
    const chunk = uniq.slice(i, i + CHUNK)
    const res = await fetch('/api/admin/seller-names', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ ids: chunk }),
    })
    if (!res.ok) {
      // 本文の error は運営向けの日本語。読めなければ状態番号だけ添える
      const j = await res.json().catch(() => null)
      throw new Error('出店者名を引けませんでした（' + (j?.error || 'HTTP ' + res.status) + '）')
    }
    const json = await res.json()
    for (const s of (json?.sellers ?? []) as SellerName[]) {
      if (s?.id && s.name) out.set(s.id, s.name)
    }
  }
  return out
}

/**
 * 運営の画面の表示名。屋号があればそれ、無ければ本名、それも無ければ fallback。
 * 屋号が空のときに本名を使う今までの動きは、運営の画面でだけ残す。
 */
export function adminDisplayName(
  shopName: string | null | undefined,
  realName: string | null | undefined,
  fallback: string,
): string {
  return (shopName ?? '').trim() || (realName ?? '').trim() || fallback
}
