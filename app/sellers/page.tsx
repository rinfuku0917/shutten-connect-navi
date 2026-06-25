import { createClient } from '@supabase/supabase-js'
import SellersBrowser, { type Seller } from './SellersBrowser'

// 一覧から完全に除外する店舗（運営法人など）
const EXCLUDED_SHOP_NAMES = ['株式会社nav', '株式会社アーク']

// このロースターはほぼ静的。10分キャッシュ（常に最新にしたい場合は 0 か "force-dynamic" に）
export const revalidate = 600

// Supabase の 1 リクエスト上限（1,000 行）を回避して全件取得する
async function fetchAllSellers(): Promise<Seller[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  // ※ Server Component 内でのみ使用。service role キーはブラウザには送信されません。
  //   anon + RLS 運用にしたい場合は下行を NEXT_PUBLIC_SUPABASE_ANON_KEY に変更し、
  //   imported_sellers に「public が SELECT 可」の RLS ポリシーを追加してください。
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase の環境変数（URL / キー）が設定されていません')

  const supabase = createClient(url, key, { auth: { persistSession: false } })

  const CHUNK = 1000
  const all: Seller[] = []
  for (let from = 0; ; from += CHUNK) {
    const { data, error } = await supabase
      .from('imported_sellers')
      // 表示に必要な列のみ取得（rep_name / email / phone は個人情報のため取得しない）
      .select('id, reg_no, shop_name, genre, area')
      .order('reg_no', { ascending: true })
      .range(from, from + CHUNK - 1)

    if (error) throw error
    if (!data || data.length === 0) break
    all.push(...(data as Seller[]))
    if (data.length < CHUNK) break // 最終チャンク
  }
  return all
}

export default async function SellersPage() {
  let sellers: Seller[] = []
  let errorMessage: string | null = null

  try {
    const all = await fetchAllSellers()
    sellers = all.filter((s) => !EXCLUDED_SHOP_NAMES.includes((s.shop_name ?? '').trim()))
  } catch (e) {
    errorMessage = e instanceof Error ? e.message : '不明なエラーが発生しました'
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <header className="mb-8">
          <p className="text-sm font-medium tracking-wide text-orange-600">出店者ディレクトリ</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            出店者一覧
          </h1>
          <p className="mt-2 text-slate-600">
            {errorMessage
              ? '読み込みに失敗しました'
              : `全 ${sellers.length.toLocaleString()} 店舗が登録されています`}
          </p>
        </header>

        {errorMessage ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-800">
            <p className="font-semibold">データを読み込めませんでした</p>
            <p className="mt-1 text-sm">{errorMessage}</p>
            <p className="mt-3 text-sm text-red-700">
              環境変数（NEXT_PUBLIC_SUPABASE_URL / キー）と、imported_sellers テーブルの読み取り権限を確認してください。
            </p>
          </div>
        ) : (
          <SellersBrowser initialSellers={sellers} />
        )}
      </div>
    </main>
  )
}
