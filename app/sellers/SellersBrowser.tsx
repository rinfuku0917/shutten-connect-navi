'use client'

import { useMemo, useState } from 'react'

export type Seller = {
  id: string
  reg_no: number
  shop_name: string | null
  genre: string | null
  area: string | null
}

const PER_PAGE = 30
const MAX_AREA_TAGS = 4

// 「東京,神奈川,千葉」のような複数値セルを個別トークンに分解
function splitTokens(v: string | null): string[] {
  if (!v) return []
  return v
    .split(/[,、，]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

// 法人格を示す語。これらを含む shop_name は店名として表示しない（行は残す）
const CORPORATE_MARKERS = ['株式会社', '合同会社', '有限会社', '合資会社', '合名会社', '(株)', '（株）', '(有)', '（有）']

function isCorporateName(name: string): boolean {
  return CORPORATE_MARKERS.some((m) => name.includes(m))
}

// 表示用の店舗名。法人名・空欄なら null（→「（店名未登録）」表示）。検索もこの値が対象
function displayShopName(s: Seller): string | null {
  const name = (s.shop_name ?? '').trim()
  if (!name || isCorporateName(name)) return null
  return name
}

function matchesSeller(s: Seller, q: string, g: string, a: string): boolean {
  if (q && !(displayShopName(s) ?? '').toLowerCase().includes(q.toLowerCase())) return false
  if (g && !splitTokens(s.genre).includes(g)) return false
  if (a && !splitTokens(s.area).includes(a)) return false
  return true
}

// 先頭・末尾・現在ページ前後だけを表示するページ番号リスト（… で省略）
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

  // ジャンル選択肢：検索＋地域を反映した件数（自分自身=ジャンルは無視）
  const genreOptions = useMemo<Option[]>(() => {
    const counts = new Map<string, number>()
    for (const s of initialSellers) {
      if (!matchesSeller(s, query, '', area)) continue
      for (const t of new Set(splitTokens(s.genre))) counts.set(t, (counts.get(t) ?? 0) + 1)
    }
    return [...counts.entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0], 'ja'))
  }, [initialSellers, query, area])

  // 地域選択肢：検索＋ジャンルを反映した件数（自分自身=地域は無視）
  const areaOptions = useMemo<Option[]>(() => {
    const counts = new Map<string, number>()
    for (const s of initialSellers) {
      if (!matchesSeller(s, query, genre, '')) continue
      for (const t of new Set(splitTokens(s.area))) counts.set(t, (counts.get(t) ?? 0) + 1)
    }
    return [...counts.entries()].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0], 'ja'))
  }, [initialSellers, query, genre])

  // 選択中の値が件数0でも選択肢に残す（プルダウン表示とstateのズレ防止）
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
      {/* フィルタバー（スクロール時も上部に固定） */}
      <div className="sticky top-0 z-10 -mx-4 mb-6 border-b border-slate-200 bg-slate-50/90 px-4 py-4 backdrop-blur sm:mx-0 sm:rounded-xl sm:border sm:px-5">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <div>
            <label htmlFor="seller-search" className="sr-only">店舗名で検索</label>
            <input
              id="seller-search"
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                resetTo1()
              }}
              placeholder="店舗名で検索"
              className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30"
            />
          </div>

          <div>
            <label htmlFor="seller-genre" className="sr-only">ジャンルで絞り込み</label>
            <select
              id="seller-genre"
              value={genre}
              onChange={(e) => {
                setGenre(e.target.value)
                resetTo1()
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30 sm:w-48"
            >
              <option value="">ジャンル：すべて</option>
              {genreSelectOptions.map(([t, c]) => (
                <option key={t} value={t}>
                  {t}（{c}）
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="seller-area" className="sr-only">出店地域で絞り込み</label>
            <select
              id="seller-area"
              value={area}
              onChange={(e) => {
                setArea(e.target.value)
                resetTo1()
              }}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30 sm:w-48"
            >
              <option value="">地域：すべて</option>
              {areaSelectOptions.map(([t, c]) => (
                <option key={t} value={t}>
                  {t}（{c}）
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* 件数 ＋ 適用中フィルタ */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-slate-600">
            <span className="font-semibold text-slate-900">{filtered.length.toLocaleString()}</span> /{' '}
            {initialSellers.length.toLocaleString()} 件
          </span>

          {genre && (
            <button
              onClick={() => {
                setGenre('')
                resetTo1()
              }}
              className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-1 text-orange-800 hover:bg-orange-200"
            >
              {genre}
              <span aria-hidden>×</span>
              <span className="sr-only">ジャンルの絞り込みを解除</span>
            </button>
          )}

          {area && (
            <button
              onClick={() => {
                setArea('')
                resetTo1()
              }}
              className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2.5 py-1 text-slate-700 hover:bg-slate-300"
            >
              {area}
              <span aria-hidden>×</span>
              <span className="sr-only">地域の絞り込みを解除</span>
            </button>
          )}

          {hasFilters && (
            <button
              onClick={clearAll}
              className="ml-auto text-slate-500 underline-offset-2 hover:text-slate-800 hover:underline"
            >
              すべてクリア
            </button>
          )}
        </div>
      </div>

      {/* 一覧 */}
      {pageItems.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-16 text-center">
          <p className="text-lg font-medium text-slate-900">該当する出店者が見つかりませんでした</p>
          <p className="mt-1 text-slate-500">検索条件を変えるか、絞り込みを解除してください。</p>
          {hasFilters && (
            <button
              onClick={clearAll}
              className="mt-4 rounded-lg bg-orange-600 px-4 py-2 font-medium text-white hover:bg-orange-700"
            >
              絞り込みをクリア
            </button>
          )}
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pageItems.map((s) => {
            const areas = splitTokens(s.area)
            const genres = splitTokens(s.genre)
            return (
              <li
                key={s.id}
                className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 transition hover:border-orange-300 hover:shadow-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-lg font-semibold leading-snug text-slate-900">
                    {displayShopName(s) || <span className="text-slate-400">（店名未登録）</span>}
                  </h2>
                  <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-500">
                    No.{s.reg_no}
                  </span>
                </div>

                {genres.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {genres.map((g) => (
                      <span
                        key={g}
                        className="rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-medium text-orange-700"
                      >
                        {g}
                      </span>
                    ))}
                  </div>
                )}

                {areas.length > 0 && (
                  <div className="mt-auto pt-3">
                    <div className="flex flex-wrap gap-1.5">
                      {areas.slice(0, MAX_AREA_TAGS).map((a) => (
                        <span key={a} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600">
                          {a}
                        </span>
                      ))}
                      {areas.length > MAX_AREA_TAGS && (
                        <span className="rounded-full px-1 py-0.5 text-xs text-slate-400">
                          +{areas.length - MAX_AREA_TAGS}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {/* ページネーション */}
      {totalPages > 1 && (
        <nav className="mt-8 flex items-center justify-center gap-1" aria-label="ページ送り">
          <button
            onClick={() => setPage(Math.max(1, safePage - 1))}
            disabled={safePage === 1}
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 disabled:pointer-events-none disabled:opacity-40"
          >
            前へ
          </button>

          {buildPageList(safePage, totalPages).map((p, i) =>
            p === '…' ? (
              <span key={`ellipsis-${i}`} className="px-2 text-slate-400">
                …
              </span>
            ) : (
              <button
                key={p}
                onClick={() => setPage(p)}
                aria-current={p === safePage ? 'page' : undefined}
                className={
                  p === safePage
                    ? 'min-w-[2.5rem] rounded-lg bg-orange-600 px-3 py-2 text-center text-sm font-semibold text-white'
                    : 'min-w-[2.5rem] rounded-lg px-3 py-2 text-center text-sm font-medium text-slate-700 hover:bg-slate-200'
                }
              >
                {p}
              </button>
            ),
          )}

          <button
            onClick={() => setPage(Math.min(totalPages, safePage + 1))}
            disabled={safePage === totalPages}
            className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 disabled:pointer-events-none disabled:opacity-40"
          >
            次へ
          </button>
        </nav>
      )}
    </div>
  )
}
