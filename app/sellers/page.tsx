import { createClient } from '@supabase/supabase-js'
import SiteHeader from '../components/SiteHeader'
import SiteFooter from '../components/SiteFooter'
import Link from 'next/link'
import SellersBrowser, { type Seller } from './SellersBrowser'

const EXCLUDED_SHOP_NAMES = ['株式会社nav', '株式会社アーク']

export const revalidate = 600

async function fetchSellers(): Promise<Seller[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase の環境変数が設定されていません')

  const supabase = createClient(url, key, { auth: { persistSession: false } })

  const CHUNK = 1000
  const all: Seller[] = []
  for (let from = 0; ; from += CHUNK) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, shop_name, genre, areas, photos')
      .eq('role', 'seller')
      .eq('approval_status', 'approved')
      .order('shop_name', { ascending: true, nullsFirst: false })
      .range(from, from + CHUNK - 1)

    if (error) throw error
    if (!data || data.length === 0) break
    all.push(...(data as Seller[]))
    if (data.length < CHUNK) break
  }
  return all
}

export default async function SellersPage() {
  let sellers: Seller[] = []
  let errorMessage: string | null = null

  try {
    const all = await fetchSellers()
    sellers = all.filter((s) => !EXCLUDED_SHOP_NAMES.includes((s.shop_name ?? '').trim()))
  } catch (e) {
    errorMessage = e instanceof Error ? e.message : '不明なエラーが発生しました'
  }

  return (
    <div style={{ background: '#FBF7F1', minHeight: '100vh' }}>
      <SiteHeader />
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <header className="mb-10 flex items-start justify-between gap-4">
          <div>
          <div className="flex items-center gap-2 text-amber-600">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z" />
              <circle cx="7" cy="18" r="1.6" />
              <circle cx="17" cy="18" r="1.6" />
            </svg>
            <span className="text-sm font-semibold tracking-wide">出店者ディレクトリ</span>
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl">出店者一覧</h1>
          <p className="mt-2 text-stone-500">
            {errorMessage ? '読み込みに失敗しました' : `全 ${sellers.length.toLocaleString()} 店舗から探す`}
          </p>
          </div>
          <img src="/ic2-truck.png" alt="" className="hidden h-24 w-auto shrink-0 object-contain sm:block" />
        </header>

        {errorMessage ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">
            <p className="font-semibold">データを読み込めませんでした</p>
            <p className="mt-1 text-sm">{errorMessage}</p>
          </div>
        ) : (
          <SellersBrowser initialSellers={sellers} />
        )}
      </div>

      <SiteFooter />
    </div>
  )
}
