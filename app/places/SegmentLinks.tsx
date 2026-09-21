import Link from 'next/link'
import {
  AREA_SEGMENTS, CATEGORY_SEGMENTS, CROSS_SEGMENTS,
  CATEGORIES_WITHOUT_PAGE, APTITUDE_CATEGORIES, THRESHOLDS,
} from './segments'
import { loadBrowseCounts } from './segmentData'

// /places と /space に置く、サーバー描画のリンク帯。
//
// **use client を付けないこと。** ここをクライアント側で描くと、
// 公開ページに不要なJSが増える（AGENTS.md のパフォーマンス項）。
//
// なぜ要るか:
//   /places の絞り込みは select の onChange と history.replaceState でできていて、
//   クローラーがたどれる <a> が1本も無い。ページ送りも button で href が無く、
//   2ページ目以降は noindex。結果として13件目以降の案件は、
//   サイトマップ経由以外に発見経路が無かった。ここが実質の内部リンクになる。
//
// ページを作らない県の扱い:
//   固有ページを作るのは開設線（掲載12件以上）を満たした6県だけ。
//   残りはクエリURL（/places?pref=◯◯）へつなぐ。掲載1〜2件の県は、
//   県のページを作らずに案件そのもの（/places/{id}）を直接並べてクロール経路を通す。
//   薄い県ページを11枚に足すより、案件へ直に繋ぐほうが中身がある。

const PILL: React.CSSProperties = {
  display: 'inline-block', background: '#fff', border: '1px solid #E7DCC8', borderRadius: '999px',
  padding: '8px 15px', fontSize: '13px', fontWeight: 700, color: '#B45309', textDecoration: 'none',
}
const PILL_SUB: React.CSSProperties = {
  ...PILL, borderColor: '#EEE', color: '#64748B', fontWeight: 400,
}
const H3: React.CSSProperties = { fontSize: '13px', fontWeight: 800, color: '#666', margin: '0 0 9px' }
const ROW: React.CSSProperties = { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '18px' }
const NOTE: React.CSSProperties = { fontSize: '11.5px', color: '#999', lineHeight: 1.8, margin: '0 0 18px' }

export default async function SegmentLinks() {
  const counts = await loadBrowseCounts()
  const n = (label: string, list: { label: string; count: number }[]) =>
    list.find(e => e.label === label)?.count ?? 0

  // 固有ページを持たない県。件数の多い順に並べる。
  // 掲載1〜2件の県は、県のページを作らずに案件そのものへ直接つなぐ
  const otherPrefs = counts.byPref
    .filter(e => !AREA_SEGMENTS.some(s => s.pref === e.label))
    .flatMap(e => {
      const thin = counts.thinPrefPlaces.get(e.label) ?? []
      if (thin.length > 0) {
        return thin.map(p => ({ key: p.id, href: `/places/${p.id}`, label: `${e.label}：${p.title}` }))
      }
      return [{
        key: e.label,
        href: `/places?pref=${encodeURIComponent(e.label)}`,
        label: `${e.label} ${e.count}件`,
      }]
    })

  return (
    <section
      style={{
        background: '#FBF7F1', border: '1px solid #F0E6D6', borderRadius: '12px',
        padding: '18px 18px 4px', marginBottom: '20px',
      }}
    >
      <h2 style={{ fontSize: '15px', fontWeight: 900, color: '#111', margin: '0 0 14px' }}>
        エリア・場所の種類から探す
      </h2>

      <h3 style={H3}>都道府県から探す</h3>
      <div style={ROW}>
        {AREA_SEGMENTS.map(s => (
          <Link key={s.slug} href={s.path} style={PILL}>
            {s.shortName}
            {counts.ok && <span style={{ fontWeight: 400 }}> {n(s.pref ?? '', counts.byPref)}件</span>}
          </Link>
        ))}
      </div>

      {otherPrefs.length > 0 && (
        <>
          <h3 style={H3}>そのほかの都道府県</h3>
          <div style={ROW}>
            {otherPrefs.map(e => (
              <Link key={e.key} href={e.href} style={PILL_SUB}>{e.label}</Link>
            ))}
          </div>
          <p style={NOTE}>
            掲載{THRESHOLDS.areaOpen}件以上の都道府県には、都道府県ごとのページを用意しています。
            それ以外の県は絞り込んだ一覧へ、掲載1〜2件の県は案件のページへ直接つないでいます。
          </p>
        </>
      )}

      {/* 段階公開の途中（segments.ts の WAVE が 1）では、この枠に出すページがまだ無い。
          見出しだけ残すと中身の無い節ができるので、0本のときは節ごと出さない
          （カテゴリーの行き先は、下の「そのほかの場所の種類」が引き受ける） */}
      {CATEGORY_SEGMENTS.length > 0 && (
        <>
          <h3 style={H3}>場所の種類から探す</h3>
          <div style={ROW}>
            {CATEGORY_SEGMENTS.map(s => (
              <Link key={s.slug} href={s.path} style={PILL}>
                {s.shortName}
                {counts.ok && <span style={{ fontWeight: 400 }}> {n(s.genre ?? '', counts.byGenre)}件</span>}
              </Link>
            ))}
          </div>
        </>
      )}

      {CATEGORIES_WITHOUT_PAGE.length > 0 && (
        <>
          <h3 style={H3}>そのほかの場所の種類</h3>
          <div style={ROW}>
            {/* 掲載0件のカテゴリーはリンクにしない。
                /places?genre=◯◯ を開いても「条件に合う出店場所が見つかりませんでした。」
                だけの行き止まりになり、利用者にもクローラーにも無価値なため。
                件数が取れなかったとき（counts.ok が false）は全部0件に見えるので、
                そのときは今までどおりリンクにする */}
            {CATEGORIES_WITHOUT_PAGE.map(g => (
              counts.ok && n(g, counts.byGenre) === 0
                ? <span key={g} style={PILL_SUB}>{g} 0件</span>
                : (
                  <Link key={g} href={`/places?genre=${encodeURIComponent(g)}`} style={PILL_SUB}>
                    {g} {n(g, counts.byGenre)}件
                  </Link>
                )
            ))}
          </div>
          {/* 将来の担当者が同じ検討を繰り返さないよう、作らない理由を画面に残す */}
          <p style={NOTE}>
            場所の種類ごとのページは、掲載{THRESHOLDS.categoryOpen}件以上で、かつ「会場の種類」であるものだけ作っています。
            「{APTITUDE_CATEGORIES.join('」「')}」は会場の種類ではなく、どんな出店者に向く募集かという印なので、
            件数が増えてもページは作りません（都道府県のページとほぼ同じ集合になるため）。
          </p>
        </>
      )}

      {CROSS_SEGMENTS.length > 0 && (
        <>
          <h3 style={H3}>都道府県 × 場所の種類</h3>
          <div style={ROW}>
            {CROSS_SEGMENTS.map(s => (
              <Link key={s.slug} href={s.path} style={PILL}>
                {s.shortName}
              </Link>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
