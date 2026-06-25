'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

export type Seller = {
  id: string
  shop_name: string | null
  genre: string[] | string | null
  areas: string[] | string | null
}

const PER_PAGE = 30
const MAX_AREA_TAGS = 4

function toArray(v: string[] | string | null): string[] {
  if (!v) return []
  let arr: unknown[]
  if (Array.isArray(v)) {
    arr = v
  } else {
    const t = v.trim()
    if (t.startsWith('[') && t.endsWith(']')) {
      try {
        const j = JSON.parse(t)
        arr = Array.isArray(j) ? j : [t]
      } catch {
        arr = t.split(/[,、，]/)
      }
    } else {
      arr = t.split(/[,、，]/)
    }
  }
  return arr
    .map((s) => (s ?? '').toString().replace(/^[\[\]"'\s]+|[\[\]"'\s]+$/g, '').trim())
    .filter(Boolean)
}

const CORPORATE_MARKERS = ['株式会社', '合同会社', '有限会社', '合資会社', '合名会社', '(株)', '（株）', '(有)', '（有）']

function isCorporateName(name: string): boolean {
  return CORPORATE_MARKERS.some((m) => name.includes(m))
}

function displayShopName(s: Seller): string | null {
  const name = (s.shop_name ?? '').trim()
  if (!name || isCorporateName(name)) return null
  return name
}

function matchesSeller(s: Seller, q: string, g: string, a: string): boolean {
  if (q && !(displayShopName(s) ?? '').toLowerCase().includes(q.toLowerCase())) return false
  if (g && !toArray(s.genre).includes(g)) return false
  if (a && !toArray(s.areas).includes(a)) return false
  return true
}

function buildPageList(current: number, total: number): (number | '…')[] {
  const show = new Set<number>([1, total, current - 1, current, current + 1])
  const out: (number | '…')[] = []
  let prev = 0
  for (let p = 1; p <= total; p++) {
    if (!show.has(p)) continue
    if (prev && p - prev > 1) out.push('…')
    out.push(p)
    prev = p
  }
  return out
}

type Option = [token: string, count: number]

export default function SellersBrowser({ initialSellers }: { initialSellers: Seller[] }) {
  const [query, setQuery] = useState('')
  const [genre, setGenre] = useState('')
  const [area, setArea] = useState('')
  const [page, setPage] = useState(1)

  const genreOptions = useMemo<Option[]>(() => {
    const counts = new Map<string, number>()
    for (const s of initialSellers) {
      if (!matchesSeller(s, query, '', area)) continue
      for (const t of new Set(toArray(s.genre))) counts.set(t, (counts.get(t) ?? 0) + 1)
    }
    return [...counts.entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0], 'ja'))
  }, [initialSellers, query, area])

  const areaOptions = useMemo<Option[]>(() => {
    const counts = new Map<string, number>()
    for (const s of initialSellers) {
      if (!matchesSeller(s, query, genre, '')) continue
      for (const t of new Set(toArray(s.areas))) counts.set(t, (counts.get(t) ?? 0) + 1)
    }
    return [...counts.entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0], 'ja'))
  }, [initialSellers, query, genre])

  const genreSelectOptions = useMemo<Option[]>(
    () => (genre && !genreOptions.some(([t]) => t === genre) ? [[genre, 0], ...genreOptions] : genreOptions),
    [genreOptions, genre],
  )
  const areaSelectOptions = useMemo<Option[]>(
    () => (area && !areaOptions.some(([t]) => t === area) ? [[area, 0], ...areaOptions] : areaOptions),
    [areaOptions, area],
  )

  const filtered = useMemo(
    () => initialSellers.filter((s) => matchesSeller(s, query, genre, area)),
    [initialSellers, query, genre, area],
  )

  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE))
  const safePage = Math.min(page, totalPages)
  const pageItems = filtered.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE)
  const hasFilters = query !== '' || genre !== '' || area !== ''

  const resetTo1 = () => setPage(1)
  const clearAll = () => {
    setQuery('')
    setGenre('')
    setArea('')
    setPage(1)
  }

  return (
    <div>
      <div className="sticky top-4 z-10 mb-8 rounded-2xl border border-stone-200/80 bg-white/95 p-4 shadow-sm backdrop-blur sm:p-5">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <div className="relative">
            <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <label htmlFor="seller-search" className="sr-only">店舗名で検索</label>
            <input
              id="seller-search"
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); resetTo1() }}
              placeholder="店舗名で検索"
              className="w-full rounded-xl border border-stone-300 bg-white py-2.5 pl-10 pr-4 text-stone-900 placeholder:text-stone-400 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/25"
            />
          </div>
          <div>
            <label htmlFor="seller-genre" className="sr-only">ジャンルで絞り込み</label>
            <select
              id="seller-genre"
              value={genre}
              onChange={(e) => { setGenre(e.target.value); resetTo1() }}
              className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-stone-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/25 sm:w-48"
            >
              <option value="">ジャンル：すべて</option>
              {genreSelectOptions.map(([t, c]) => (
                <option key={t} value={t}>{t}（{c}）</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="seller-area" className="sr-only">出店地域で絞り込み</label>
            <select
              id="seller-area"
              value={area}
              onChange={(e) => { setArea(e.target.value); resetTo1() }}
              className="w-full rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-stone-900 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/25 sm:w-48"
            >
              <option value="">地域：すべて</option>
              {areaSelectOptions.map(([t, c]) => (
                <option key={t} value={t}>{t}（{c}）</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-stone-600">
            <span className="font-semibold text-stone-900">{filtered.length.toLocaleString()}</span> / {initialSellers.length.toLocaleString()} 件
          </span>
          {genre && (
            <button onClick={() => { setGenre(''); resetTo1() }} className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-amber-800 hover:bg-amber-200">
              {genre}<span aria-hidden>×</span><span className="sr-only">ジャンルの絞り込みを解除</span>
            </button>
          )}
          {area && (
            <button onClick={() => { setArea(''); resetTo1() }} className="inline-flex items-center gap-1 rounded-full bg-stone-200 px-2.5 py-1 text-stone-700 hover:bg-stone-300">
              {area}<span aria-hidden>×</span><span className="sr-only">地域の絞り込みを解除</span>
            </button>
          )}
          {hasFilters && (
            <button onClick={clearAll} className="ml-auto text-stone-500 underline-offset-2 hover:text-stone-800 hover:underline">すべてクリア</button>
          )}
        </div>
      </div>

      {pageItems.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-6 py-16 text-center">
          <p className="text-lg font-medium text-stone-900">該当する出店者が見つかりませんでした</p>
          <p className="mt-1 text-stone-500">検索条件を変えるか、絞り込みを解除してください。</p>
          {hasFilters && (
            <button onClick={clearAll} className="mt-4 rounded-xl bg-amber-500 px-4 py-2 font-medium text-white hover:bg-amber-600">絞り込みをクリア</button>
          )}
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pageItems.map((s) => {
            const areas = toArray(s.areas)
            const genres = toArray(s.genre)
            return (
              <li key={s.id}>
                <Link href={`/sellers/${s.id}`} className="group flex h-full flex-col rounded-2xl border border-stone-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="text-lg font-semibold leading-snug text-stone-900">
                      {displayShopName(s) || <span className="text-stone-400">（店名未登録）</span>}
                    </h2>
                    <svg viewBox="0 0 24 24" className="mt-1 h-4 w-4 shrink-0 text-stone-300 transition group-hover:translate-x-0.5 group-hover:text-amber-500" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="m9 6 6 6-6 6" />
                    </svg>
                  </div>
                  {genres.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {genres.map((g) => (
                        <span key={g} className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">{g}</span>
                      ))}
                    </div>
                  )}
                  {areas.length > 0 && (
                    <div className="mt-auto pt-3">
                      <div className="flex flex-wrap gap-1.5">
                        {areas.slice(0, MAX_AREA_TAGS).map((a) => (
                          <span key={a} className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs text-stone-600">{a}</span>
                        ))}
                        {areas.length > MAX_AREA_TAGS && (
                          <span className="rounded-full px-1 py-0.5 text-xs text-stone-400">+{areas.length - MAX_AREA_TAGS}</span>
                        )}
                      </div>
                    </div>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      {totalPages > 1 && (
        <nav className="mt-10 flex items-center justify-center gap-1" aria-label="ページ送り">
          <button onClick={() => setPage(Math.max(1, safePage - 1))} disabled={safePage === 1} className="rounded-xl px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-200 disabled:pointer-events-none disabled:opacity-40">前へ</button>
          {buildPageList(safePage, totalPages).map((p, i) =>
            p === '…' ? (
              <span key={`ellipsis-${i}`} className="px-2 text-stone-400">…</span>
            ) : (
              <button key={p} onClick={() => setPage(p)} aria-current={p === safePage ? 'page' : undefined} className={p === safePage ? 'min-w-[2.5rem] rounded-xl bg-amber-500 px-3 py-2 text-center text-sm font-semibold text-white' : 'min-w-[2.5rem] rounded-xl px-3 py-2 text-center text-sm font-medium text-stone-700 hover:bg-stone-200'}>{p}</button>
            ),
          )}
          <button onClick={() => setPage(Math.min(totalPages, safePage + 1))} disabled={safePage === totalPages} className="rounded-xl px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-200 disabled:pointer-events-none disabled:opacity-40">次へ</button>
        </nav>
      )}
    </div>
  )
}
