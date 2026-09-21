import type { SegmentFacts as Facts } from './segmentData'

// 「◯◯の案件の内訳」の h3 群。掲載中の案件を数えて出す。
//
// 出す柱は4本：出店形態・出店できる曜日・設備の条件・どのあたりに案件があるか。
//
// 出さないもの:
//   ・出店料（金額）。集計値も個別の額も出さない。segmentData.ts が列を読んでいない
//   ・1回の募集枠の内訳。max_slots は289件中261件が既定値の5台で分布にならないので、
//     内訳ではなく1文にまとめる（11枚に同じ1行が並ぶのを避ける）
//   ・雨天・ごみ・場所（屋外/屋内）。140件中139〜140件が同じ答えでほぼ定数なので、
//     内訳の形にしない（placeFacts.mjs の DETAIL_FLAGS で show:false にしてある）
//
// 母数の書き分け:
//   曜日の母数は「曜日が読み取れた件数」、設備の母数は「設備欄を書いている件数」で、
//   どちらも掲載合計とは違う。画面に必ず母数を書く（docs/seo-keywords.md の教訓2）。
//   市区町村は上位8件しか出さないので、上位で何件ぶんを説明できているかも書く。

const H3: React.CSSProperties = { fontSize: '15px', fontWeight: 900, color: '#111', margin: '22px 0 8px' }
const P: React.CSSProperties = { fontSize: '13.5px', color: '#444', lineHeight: 1.95, margin: 0 }
const MUTED: React.CSSProperties = { fontSize: '12px', color: '#888', lineHeight: 1.8, margin: '6px 0 0' }

function join(entries: { label: string; count: number }[], unit = '件') {
  return entries.map(e => `${e.label} ${e.count}${unit}`).join(' / ')
}

export default function SegmentFacts({ name, facts }: { name: string; facts: Facts }) {
  const { dow, cities, details } = facts
  return (
    <div>
      <h3 style={H3}>出店形態</h3>
      <p className='jp-text' style={P}>
        掲載{facts.total}件のうち、{join(facts.byType)}です。
        {facts.slots.counted > 0 && (
          <>
            {' '}1回の募集で複数台を受け入れる会場が中心で、募集枠が入っている{facts.slots.counted}件のうち
            {facts.slots.multi}件が2台以上です。
          </>
        )}
      </p>

      <h3 style={H3}>出店できる曜日</h3>
      {dow.known > 0 ? (
        <>
          <p className='jp-text' style={P}>
            出店できる曜日が読み取れたのは、掲載{facts.total}件のうち{dow.known}件です。
            その{dow.known}件のうち、平日のみが{dow.weekdayOnly}件、土日を含むものが{dow.weekendIncluded}件、
            月曜から日曜まで出せるものが{dow.allWeek}件でした。
            {dow.byDow.length > 0 && <>{' '}曜日別では{join(dow.byDow)}です。</>}
          </p>
          <p style={MUTED}>
            {dow.weekdayDays + dow.weekendDays > 0 && (
              <>日付が入っている案件を日数で数えると、平日{dow.weekdayDays}日・土日{dow.weekendDays}日です。{' '}</>
            )}
            日程に日付が入っていない案件は、出店日の自由記述から読み取っています。祝日は判定していません。
          </p>
        </>
      ) : (
        <p className='jp-text' style={P}>
          掲載{facts.total}件では、出店できる曜日を読み取れる案件がありませんでした。
          出店できる曜日は、案件ごとのページでご確認ください。
        </p>
      )}

      <h3 style={H3}>設備の条件</h3>
      {details.withDetails > 0 ? (
        <>
          <p className='jp-text' style={P}>
            設備を選択式で書いているのは、掲載{facts.total}件のうち{details.withDetails}件です。
            その{details.withDetails}件の内訳は次のとおりです。
          </p>
          <ul style={{ margin: '8px 0 0', paddingLeft: '20px', fontSize: '13.5px', color: '#444', lineHeight: 2 }}>
            {details.flags.map(f => (
              <li key={f.name}>{f.name}：{join(f.entries)}</li>
            ))}
          </ul>
          {details.withDetails < facts.total && (
            <p style={MUTED}>
              残る{facts.total - details.withDetails}件は設備の欄が空です。募集要項の本文でご確認ください。
            </p>
          )}
        </>
      ) : (
        <p className='jp-text' style={P}>
          掲載{facts.total}件では、設備を選択式で書いている案件がありませんでした。
          電源・給水・駐車の有無は、案件ごとのページでご確認ください。
        </p>
      )}

      <h3 style={H3}>どのあたりに案件があるか</h3>
      {cities.top.length > 0 ? (
        <>
          <p className='jp-text' style={P}>
            住所から数えた市区町村の上位は、{join(cities.top)}です。
            この上位{cities.top.length}件で、掲載{facts.total}件のうち{cities.shown}件を説明しています。
          </p>
          <p style={MUTED}>
            {cities.rest > 0 && <>残る{cities.rest}件は、ほかの{cities.restCities}市区町村に散っています。{' '}</>}
            {cities.unknown > 0 && <>住所の書き方から市区町村を読み取れなかった案件が{cities.unknown}件あります。{' '}</>}
            市区町村は自由記述の住所から取り出しているため、政令指定都市は区ではなく市でまとめています。
          </p>
        </>
      ) : (
        <p className='jp-text' style={P}>
          {name}の掲載案件では、住所から市区町村を読み取れませんでした。所在地は案件ごとのページでご確認ください。
        </p>
      )}
    </div>
  )
}
