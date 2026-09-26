'use client'
import Link from 'next/link'
import { useState, useEffect, useMemo, Fragment } from 'react'
import type { ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import SiteHeader from '../../components/SiteHeader'
import ConfirmDialog from '../../components/ConfirmDialog'
import BackButton from '../../components/BackButton'
import SiteFooter from '../../components/SiteFooter'
import { allowedFormats, hasFormatFees, formatFeeOf, formatAllowsDate, sortedDows, feeCondition, dayFeeLabelOn, perEventFeeOf, type FormatFees } from '../../lib/placeFee'
import { minApplyDays, applyDaysShortfall } from '../../lib/applyRules'
import ApplyDateCalendar, { type CalendarDay } from '../../components/ApplyDateCalendar'
import { showsToSeller } from '../../lib/cancelledVisibility'
import { missingSellerFields, SELLER_PROFILE_COLUMNS } from '../../lib/sellerProfile'
const PlacesMap = dynamic(() => import('../../components/PlacesMap'), { ssr: false, loading: () => <div style={{height:'320px',background:'#F1F5F9',borderRadius:'12px',display:'flex',alignItems:'center',justifyContent:'center',color:'#94A3B8',fontSize:'13px'}}>地図を読み込み中...</div> })

export type Place = {
  id: string
  title: string
  description: string | null
  prefecture: string | null
  address: string | null
  place_type: string | null
  closed: boolean | null
  fee: string | null
  price_fixed: number | null
  price_share_pct: number | null
  place_fixed_unit: string | null
  company_fixed_amount: number | null
  company_fixed_unit: string | null
  company_share_pct: number | null
  /** 1回の申込で選ばないといけない最低の日数。空か1なら1日から（app/lib/applyRules.ts） */
  min_apply_days: number | null
  map_url: string | null
  // 出店場所のカテゴリー（複数選択）。この画面では使わないが、
  // サーバー側（page.tsx）がエリア別・カテゴリ別ページへのリンクを組み立てるのに読む
  genres: string[] | null
  recruit: string | null
  schedule: { date: string, start: string, end: string }[] | null
  open_days: string[] | null
  image_url: string | null
  images: string[] | null
  latitude: number | null
  longitude: number | null
  open_time: string | null
  close_time: string | null
  max_slots: number | null
  details: Record<string, string> | null
  // 何ヶ月先まで申し込めるか。null は上限なし
  apply_within_months: number | null
  // 平日／土日祝で決めた金額（案件全体）
  day_type_fees: unknown
  // 歩合が少ない日の最低保証（案件全体）。
  // 移行SQLを流すまで列が無いので、undefined でも壊れない作りにしている
  min_guarantee?: unknown
  // 形態（キッチンカー・物販・催事PR・テント・ブース）ごとの出店料と条件。
  // 未設定なら、これまでどおり全部の形態を選べて金額も案件全体の設定を使う。
  // 形は app/lib/placeFee.ts の FormatFees が唯一の正（二重に書かない）
  format_fees: FormatFees
}

// 案件フォームで選んだ値を、画面に出す日本語に直す
const CHOICE: Record<string, Record<string, string>> = {
  power: { yes: '有り', no: '無し' },
  gas: { yes: '有り', no: '無し' },
  water: { yes: '有り', no: '無し' },
  eatSpace: { yes: '有り', no: '無し' },
  trash: { self: '各自', host: '主催者処理' },
  location: { outdoor: '屋外', outdoor_roof: '屋外（屋根あり）', indoor: '屋内' },
  heightLimit: { no: '制限なし', yes: '制限あり' },
  rain: { go: '雨天決行', cancel: '中止', other: 'その他' },
  history: { yes: '有り', no: '無し' },
  parking: { yes: '可', no: '不可' },
  format: { kitchen: 'キッチンカー', tent: 'テント', both: 'キッチンカー・テント' },
}

function detailText(key: string, raw: string | undefined): string {
  const v = (raw ?? '').trim()
  if (!v) return ''
  return CHOICE[key]?.[v] ?? v
}

// 申込がデータベース側のトリガー（check_apply_window）で弾かれたかどうか。
//
// 申込は画面から直接 insert していてサーバを経由しないため、
// 募集終了・応募締切・申込期間の3つはテーブル側で止めている。
// トリガーは出店者がそのまま読める日本語で返すので、
// それと分かったらエラー文言を作り直さず、そのまま画面に出す。
//
// 文面を変えるときは、トリガー側（supabase/migrations の
// 20260904_apply_window_gate.sql）と、この目印を一緒に直すこと。
function fromApplyWindow(message: string): boolean {
  return message.includes('募集を終了')       // 募集終了の案件
    || message.includes('応募締切')            // 締切を過ぎた案件
    || message.includes('お申し込みとなります') // 申込期間の上限より先の日付
}

// 出店料の表示。
//
// 「2,000円〜3,000円/日 ＋ 売上の10%」を1本の文字列で流すと、
// 日本語はどの文字の間でも改行できる扱いのため、スマホでは
// 「2,000円〜3,000円/」「日」のように金額と単位が離れて読めなくなる。
// そこで金額のまとまりごとに .nowrap-unit（display:inline-block）で包み、
// 折り返る場所を「＋」の前後と「（」の前だけに絞っている。
//
// 何をいくらと出すかは app/lib/placeFee.ts の feeCondition が決める。
// 以前はここで price_share_pct などを直接足しており、
// 平日/土日祝の額（day_type_fees）と形態ごとの額（format_fees）を
// 見ていなかったため、実際に請求される額と違う表示になっていた。
// 最低保証も同じ理由で、ここでは組み立てない。
function feeNodes(p: Place): ReactNode {
  // 形態ごとの料金が1種類だけの案件（イオンモール与野など）は、
  // その形態の条件を出す。案件全体の列だけを見ると、
  // 形態側に入れた歩合や最低保証が画面に出ないままになる。
  const fmts = hasFormatFees(p.format_fees) ? allowedFormats(p.format_fees) : []
  const solo = fmts.length === 1 ? fmts[0] : null
  const { parts, minNote, empty } = feeCondition(p, solo)
  // 金額を登録していない案件は、募集者が書いた文言をそのまま出す。
  // 長さも書き方も決まっていないため、まとまりでは包まない
  if (empty) return p.fee || '要相談'
  // 形態ごとの料金（format_fees）を入れていない案件は、物販・催事PRなどの額が
  // 自由文（places.fee）にしか無い。計算値はキッチンカー相当の1種類しか出せないため、
  // 自由文があれば併記する。
  // 計算値は day_type_fees も見るようになったので、これを出さないと
  // Olympic 各店（11件）のように「平日3,000円/日」だけが出て、
  // 実際は4,500円の物販大型や18,000円の催事PRで申し込む人に別の額を告げてしまう。
  // 自動で作った文言（「10,000円/日 ＋ 売上の10%」）は計算値と同じなので出さない
  const free = (p.fee || '').trim()
  const showFree = !hasFormatFees(p.format_fees) && free !== '' && free !== parts.join(' ＋ ')
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={part}>
          {i > 0 ? ' ＋ ' : ''}
          <span className='nowrap-unit'>{part}</span>
        </Fragment>
      ))}
      {minNote && (
        <>
          {parts.length > 0 ? ' ' : ''}
          <span className='nowrap-unit'>（{minNote}）</span>
        </>
      )}
      {/* 形態によって金額が違う案件は、ここに出した額が
          すべての形態に当てはまるわけではない。申込の画面で形態ごとに出している */}
      {fmts.length > 1 && <span className='nowrap-unit'>（形態によって異なります）</span>}
      {showFree && (
        <span className='jp-text' style={{ display: 'block', marginTop: '6px', fontSize: '13px', color: '#475569', lineHeight: 1.9, whiteSpace: 'pre-wrap' }}>
          {free}
        </span>
      )}
    </>
  )
}

// 公開中の案件はサーバー側（page.tsx）で取得して渡す。
// そうしないと、検索エンジンが見るHTMLが「読み込み中...」だけになってしまう。
//
// initialPlace が null のときは、公開前の案件を募集者本人が見ている場合。
// その場合だけ、以前と同じようにブラウザ側で読み込む
// （誰に見せてよいかはデータベース側の権限設定が判断する）。
//
// openNearby / openNearbyCount は、募集終了した案件のときだけサーバーから渡す、
// 同じ都道府県で募集中の案件の一覧（描画済み）とその件数。
//
// segmentLinks は、この案件が属するエリア別・カテゴリ別ページへのリンク（描画済み）。
// 募集終了・募集中のどちらでも出す（AGENTS.md：終了案件は実績としてリンクしてよい）。
//
// areaListHref は「◯◯で募集中の案件を見る」の行き先。
// サーバー（app/places/[id]/page.tsx）で app/places/segments.ts から組んで渡す。
// ここで segments.ts を import すると、'use client' なので11セグメントぶんの表が
// 案件詳細のクライアントJSに載る（AGENTS.md「公開ページに不要なクライアントJSを足さない」）。
export default function PlaceDetail({ id, initialPlace, openNearby = null, openNearbyCount = 0, segmentLinks = null, areaListHref = null }: {
  id: string
  initialPlace: Place | null
  openNearby?: ReactNode
  openNearbyCount?: number
  segmentLinks?: ReactNode
  areaListHref?: string | null
}) {
  const [place, setPlace] = useState<Place | null>(initialPlace)
  const [loading, setLoading] = useState(initialPlace === null)
  // 料金はログイン済みなら表示する（エントリー可否の判定とは別）。
  // サーバーでは常に false なので、ログイン前提の内容がHTMLに出ることはない。
  const [canSeeFee, setCanSeeFee] = useState(false)
  // いま大きく出している写真の番号
  const [photoIndex, setPhotoIndex] = useState(0)
  const router = useRouter()
  const [showEntry, setShowEntry] = useState(false)
  // 出店形式。受け入れる形式が1つだけの案件（イオン系など）は最初から選んでおく。
  // 未選択のままだと、カレンダーの金額が案件全体の設定（歩合だけ）で出てしまい、
  // 形式を選ぶまで「歩合」と表示されて額が分からない。選択肢が1つなら選ぶ意味も無い
  const [format, setFormat] = useState(() => {
    const fs = initialPlace ? allowedFormats(initialPlace.format_fees) : []
    return fs.length === 1 ? fs[0] : ''
  })
  const [selectedDates, setSelectedDates] = useState<string[]>([])
  const [entryDate, setEntryDate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [entryErr, setEntryErr] = useState('')
  const [entryDone, setEntryDone] = useState(false)
  // この案件に自分がすでに申し込んでいるか。申込済みなのに
  // 「エントリーする」と出ていると、済んでいないように見えてしまう。
  type MyEntry = { id: string, apply_date: string | null, status: string }
  const [myEntries, setMyEntries] = useState<MyEntry[]>([])
  // プロフィールの未入力項目。1件以上あるあいだは申し込めない（2026-09-24）
  const [profileMissing, setProfileMissing] = useState<{ key: string, label: string }[]>([])

  const loadMyEntries = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !id) { setMyEntries([]); return }
    const { data } = await supabase
      .from('applications')
      .select('id, apply_date, status')
      .eq('place_id', id).eq('seller_id', user.id)
      .order('apply_date', { ascending: true })
    // 取り消したものは出店者に出さない（app/lib/cancelledVisibility.ts）。
    // ここに絞り込みを入れ忘れていたため、取り消した申込がいつまでも
    // 「エントリー済み・審査中」として残っていた。
    // 混ざっていると、申し込めるのに申し込み済みに見える
    // （実際に再エントリーはできる状態だった）
    setMyEntries(((data || []) as MyEntry[]).filter(e => showsToSeller(e)))
  }

  // プロフィールの未入力項目を数える。
  //
  // 施設へ出す資料と公開ページの中身はプロフィールで決まるのに、
  // 出店者1,386人のうち全部そろっていたのは7人だけだった（2026-09-24 実測）。
  // 運営が申込のたびに個別に催促していたため、申込の入口で入れてもらう形にした。
  // 必須の定義は app/lib/sellerProfile.ts（出店者ダッシュボードと同じものを読む）
  const checkProfile = async (uid: string): Promise<{ key: string, label: string }[]> => {
    const [{ data: prof }, { count }] = await Promise.all([
      supabase.from('profiles').select(SELLER_PROFILE_COLUMNS).eq('id', uid).single(),
      supabase.from('menus').select('id', { count: 'exact', head: true }).eq('seller_id', uid),
    ])
    if (!prof) return []
    return missingSellerFields({ ...prof, menuCount: count ?? 0 })
  }

  const handleEntryClick = async () => {
    setEntryErr('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'seller') { router.push('/login'); return }
    // プロフィールが未完成なら、申込フォームを開かずに不足項目を出す
    const miss = await checkProfile(user.id)
    setProfileMissing(miss)
    if (miss.length > 0) return
    setShowEntry(true)
  }

  const toggleDate = (d: string) => {
    setSelectedDates(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])
  }

  // 今日（YYYY-MM-DD）。自由入力日程の下限・過去日付チェックに使う。
  //
  // 端末の時計ではなく日本時間で出す。案件の日程は日本の日付で入っているので、
  // 端末が海外時間・時計がずれていると、日本ではもう過ぎた日が
  // 「今日より前ではない」と判定され、過去日の申込が通ってしまう
  // （データベース側のトリガー check_apply_window は過去日を見ていない）。
  const todayStr = () => {
    const jst = new Date(new Date().getTime() + 9 * 60 * 60 * 1000)
    return jst.getUTCFullYear() + '-' + String(jst.getUTCMonth() + 1).padStart(2, '0') + '-' + String(jst.getUTCDate()).padStart(2, '0')
  }

  // 何ヶ月先まで申し込めるかの上限（places.apply_within_months）。
  // 施設が先の予定に答えられないため、イオン系は1ヶ月、Olympic・ドンキ系は4ヶ月に絞っている
  // （2026-09-14 に3ヶ月から4ヶ月へ。公開した12月後半の日程に申し込めなかったため）。
  // 未設定の案件は null＝上限なしで、これまでどおりどの日でも選べる。
  //
  // 月末は暦どおりに丸める（1月31日の1ヶ月先は2月28日）。
  // Postgres の interval と同じ数え方にして、
  // 画面で選べた日がサーバ側のトリガーで弾かれることがないようにする。
  const applyLimitStr = (() => {
    const m = place?.apply_within_months
    if (!m) return null
    const base = new Date()
    const d = new Date(base.getFullYear(), base.getMonth(), 1)
    d.setMonth(d.getMonth() + m)
    const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
    d.setDate(Math.min(base.getDate(), lastDay))
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
  })()

  // 出店希望日のカレンダーに渡す、日ごとの状態。
  //
  // 選べる日は「案件の日程（places.schedule）に入っている日」だけ。
  // カレンダーは月全体を並べるが、日程に無い日は押せないマスにする。
  // 申込は画面から直接 applications に insert する作りで、
  // データベース側のトリガー（check_apply_window）は日程に入っている日かを見ていないため、
  // ここで集合を守らないと、募集していない日の申込がそのまま入ってしまう。
  //
  // 金額は app/lib/placeFee.ts の dayFeeLabelOn（＝請求の初期額と同じ dayFeeOf）で作る。
  const todayForCal = todayStr()
  const { calendarDays, wrongDowCount } = useMemo(() => {
    if (!place) return { calendarDays: [] as CalendarDay[], wrongDowCount: 0 }
    const applied = new Set(myEntries.map(e => e.apply_date).filter((d): d is string => !!d))
    // 曜日で選べない日の件数は、日付の集合で数える。
    // 日程は同じ日付が2行あることがある（時間帯が2枠）ので、要素の数で数えると二重になる
    const wrongDates = new Set<string>()
    const days: CalendarDay[] = (place.schedule || []).filter(d => d.date).map(d => {
      // 過ぎた日は選べない。以前のリストでは押せたままで、
      // 「当月を全選択」を足すとまとめて選ばれてしまう（トリガーも過去日は弾かない）
      const past = d.date < todayForCal
      // 申込の上限より先の日は選べない（places.apply_within_months）
      const over = !!applyLimitStr && d.date > applyLimitStr
      // 選んだ形式で出られない曜日の日は選べない
      const wrongDow = !!format && !formatAllowsDate(place.format_fees, format, d.date)
      // 申込済みの日は「済」と出ていて × にならないので、曜日の件数には入れない
      if (wrongDow && !past && !over && !applied.has(d.date)) wrongDates.add(d.date)
      const label = dayFeeLabelOn(place, format || null, d.date)
      return {
        date: d.date,
        times: d.start && d.end ? [`${d.start}〜${d.end}`] : [],
        amount: label.amount,
        amountNote: label.short,
        amountMark: label.mark,
        amountText: label.text,
        disabled: past || over || wrongDow,
        disabledReason: past ? '過ぎた日'
          : over ? `${applyLimitStr?.replaceAll('-', '/')} までのお申し込みです`
          : wrongDow ? `この曜日は${format}では出店できません` : '',
        applied: applied.has(d.date),
      }
    })
    return { calendarDays: days, wrongDowCount: wrongDates.size }
  }, [place, format, applyLimitStr, myEntries, todayForCal])

  // 出店形式を選び直したときは、その形式で出られない曜日の日を選択から外す。
  // 残したままにすると、画面では選べない色なのに送信され、
  // データベース側のトリガーも曜日を見ないのでそのまま入ってしまう
  const chooseFormat = (opt: string) => {
    setFormat(opt)
    if (place) setSelectedDates(prev => prev.filter(d => formatAllowsDate(place.format_fees, opt, d)))
  }

  const submitEntry = async () => {
    setEntryErr('')
    if (!format) { setEntryErr('出店形式を選択してください'); return }
    // 開催日がある案件は最低1日選択を必須に
    const hasSchedule = !!(place && place.schedule && place.schedule.filter(d => d.date).length > 0)
    const dates = hasSchedule ? selectedDates : (entryDate ? [entryDate] : [])
    if (hasSchedule && dates.length === 0) { setEntryErr('出店希望日を1日以上選択してください'); return }
    // 日程未設定の案件（自由入力）は、日付必須＋過去日付を禁止して誤エントリーを防ぐ
    if (!hasSchedule) {
      if (!entryDate) { setEntryErr('出店希望日を選択してください'); return }
      if (entryDate < todayStr()) { setEntryErr('過去の日付は選択できません'); return }
    }
    // 上限より先の日付。日付欄の max とチェックの disabled で選べないようにしてあるが、
    // 手入力や画面を開いたまま日をまたいだ場合に通ってしまうため、送信前にも見る。
    // ここで止めておくと、データベース側のトリガーの文言が出店者に出ずに済む
    if (applyLimitStr && dates.some(d => d > applyLimitStr)) {
      setEntryErr(`この案件は ${applyLimitStr.replaceAll('-', '/')} までのお申し込みとなります`)
      return
    }
    // 過ぎた日を送らない。カレンダーでは押せないようにしてあるが、
    // 画面を開いたまま日をまたいだ場合に通ってしまう
    // （データベース側のトリガーは過去日を弾かない）
    if (dates.some(d => d < todayStr())) { setEntryErr('過ぎた日は選択できません'); return }
    // 選んだ形式で出られない曜日を送らない。
    // 形式を選び直したときに選択から外しているが、送信前にも見る
    if (place && dates.some(d => !formatAllowsDate(place.format_fees, format, d))) {
      setEntryErr(`選んだ日に、${format}では出店できない曜日が含まれています`)
      return
    }
    // 日程のある案件は、案件の日程に無い日を送らない。
    // 運営の出店日振替（app/api/applications/change-date）も
    // 「案件の日程に入っていない日へは振り替えられない」を強制している
    if (hasSchedule) {
      const known = new Set((place?.schedule || []).map(d => d.date))
      if (dates.some(d => !known.has(d))) { setEntryErr('この案件の日程にない日は選択できません'); return }
    }
    // 最低出店日数。1日だけの出店を受け付けない案件がある
    // （美食EXPO：3日間または2日間のみ。2026-09-26 の運営からの説明）。
    // カレンダーでも足りないことを知らせているが、送信前にも見る
    if (place && hasSchedule) {
      const pickable = calendarDays.filter(d => !d.disabled && !d.applied).length
      const short = applyDaysShortfall(place, dates.length, pickable)
      if (short) { setEntryErr(short.message); return }
    }
    // すでに申し込んでいる日を送らない。
    // 申込は選んだ日ぜんぶを1回の insert で入れるので、1日でも重複すると
    // その回の全部が落ちる（applications_active_unique_idx）。
    // 何が重複したのか分かるように、日付を出してから止める
    const already = dates.filter(d => myEntries.some(e => e.apply_date === d))
    if (already.length > 0) {
      setEntryErr(`${already.map(d => d.replaceAll('-', '/')).join('、')} はすでに申込済みです。選択から外してください`)
      return
    }
    setSubmitting(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setEntryErr('ログインが必要です'); setSubmitting(false); return }
    // 送信の直前にもう一度確かめる。別のタブでプロフィールを空に戻した場合や、
    // 画面を開いたままにしていた場合に、未完成のまま申込が入るのを防ぐ
    const missNow = await checkProfile(user.id)
    if (missNow.length > 0) {
      setProfileMissing(missNow)
      // フォームは閉じない。閉じると選んだ日付が見えなくなり、
      // 何が起きたのか分からないまま画面が変わってしまう
      setEntryErr('プロフィールに未入力の項目があります：' + missNow.map(m => m.label).join('、'))
      setSubmitting(false)
      return
    }
    // 選んだ日ごとに1行ずつ申込を作成（日付が無い案件は1件だけ作成）
    const rows: { place_id: string; seller_id: string; format: string; apply_date: string | null; status: string }[] =
      dates.length > 0
        ? dates.map(d => ({ place_id: id, seller_id: user.id, format, apply_date: d, status: 'pending' }))
        : [{ place_id: id, seller_id: user.id, format, apply_date: null, status: 'pending' }]
    const { error } = await supabase.from('applications').insert(rows)
    if (error) {
      const msg = error.message.includes('duplicate key')
        ? 'この案件には既に申込済みの日があります。'
        // データベース側のトリガー（check_apply_window）で弾かれた場合。
        // 募集終了・応募締切・申込期間の3つがここに来る。
        // どれも出店者がそのまま読める日本語で返しているので、加工せずに出す。
        : fromApplyWindow(error.message)
          ? error.message
          : 'エントリー失敗: ' + error.message
      setEntryErr(msg); setSubmitting(false); return
    }
    setSubmitting(false)
    setEntryDone(true)
    // 送った日は選択から外す。「別の日程を追加でエントリーする」で開き直したときに
    // 前回選んだ日が残っていると、申込済みの日をもう一度送ることになり、
    // 部分一意インデックス（place_id・seller_id・apply_date）で今回の全行が落ちる
    setSelectedDates([])
    await loadMyEntries()
    // ホストへ申込通知（失敗しても応募は成功させる）。
    // 通知の入口は body の sellerId を信じないので、アクセストークンを添える
    try {
      const { data: sess } = await supabase.auth.getSession()
      await fetch('/api/notify/new-application', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + (sess.session?.access_token || ''),
        },
        body: JSON.stringify({ placeId: id, sellerId: user.id, dates }),
      })
    } catch (e) {
      console.error('申込通知に失敗しましたが応募は完了しました', e)
    }
  }

  useEffect(() => {
    const load = async () => {
      // サーバーで取れなかった案件だけ、ここで読み直す
      if (initialPlace === null) {
        const { data } = await supabase.from('places').select('*').eq('id', id).maybeSingle()
        setPlace(data)
        setLoading(false)
      }
      const { data: { user } } = await supabase.auth.getUser()
      if (user) { setCanSeeFee(true); await loadMyEntries() }
    }
    if (id) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#FFF9E6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#999' }}>読み込み中...</div>
      </div>
    )
  }

  if (!place) {
    return (
      <div style={{ minHeight: '100vh', background: '#FFF9E6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>😢</div>
          <div style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px' }}>案件が見つかりません</div>
          <Link href="/" style={{ color: '#3A9BD5', textDecoration: 'none' }}>トップに戻る</Link>
        </div>
      </div>
    )
  }

  const tag = place.place_type === 'event' ? 'イベント' : '常設'
  // 募集終了した案件から案内する先。同じ県に募集中の案件があれば、その県で絞った一覧へ。
  // 無ければ全国の一覧へ（0件の絞り込み一覧に送ると、そこでまた行き止まりになる）
  // 固有ページ（/places/area/{県}）がある県はそちらへ。無い県は従来どおり絞り込んだ一覧へ。
  // どのページがあるかの判定は app/places/segments.ts が唯一の正で、
  // その参照はサーバー側（page.tsx）で済ませて areaListHref として受け取る
  const openListHref = place.closed && place.prefecture && openNearbyCount > 0
    ? (areaListHref ?? '/places?pref=' + encodeURIComponent(place.prefecture))
    : '/places'
  // images に入っていない古い案件は、image_url の1枚だけを表示する
  const photos = (Array.isArray(place.images) ? place.images.filter(Boolean) : [])
  if (photos.length === 0 && place.image_url) photos.push(place.image_url)
  const shownPhoto = photos[photoIndex] || photos[0] || ''
  // 日程は、日付と時刻をつないだ1本の文字列にすると、スマホで
  // 「2026-10-」「01 10:00〜」のように日付の数字の途中で割れてしまう
  // （ハイフンや「〜」の後ろはブラウザが改行してよい場所と見なすため）。
  // 日付・時刻をそれぞれ .nowrap-unit で包み、折り返るのは日付と時刻のあいだ、
  // または日と日の区切りだけにしている。
  // 構造化された日程が無い案件は、旧サイトから移行した日程テキストを表示する
  const scheduleDays = (place.schedule || []).filter(d => d.date)
  const scheduleNode: ReactNode = scheduleDays.length > 0
    ? scheduleDays.map((d, i) => (
        <Fragment key={d.date + '-' + i}>
          {i > 0 ? ' / ' : ''}
          <span className='nowrap-unit'>{d.date}</span>{' '}
          <span className='nowrap-unit'>{d.start}〜{d.end}</span>
        </Fragment>
      ))
    : ((place.open_days || []).map(x => (x || '').trim()).filter(Boolean)[0] || '要相談')

  return (
    <>
    <SiteHeader />
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '14px 16px 0' }}>
        <BackButton fallback='/places' />
      </div>
    <div style={{ minHeight: '100vh', background: '#FFF9E6' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '32px 24px' }}>
        <Link href="/places" style={{ color: '#3A9BD5', textDecoration: 'none', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '4px', marginBottom: '20px' }}>
          ← 一覧に戻る
        </Link>

        {/* 募集終了のお知らせ。
            終了した案件も実績として検索に出すので、検索から直接来た人が最初に目にする位置に置く。
            これまでは案件名の上の小さな「募集終了」の札と、右の申込欄の見出しだけで、
            スマホでは申込欄がページの下に回るため、読み進めるまで応募できないと分からなかった。
            見出し（h2〜）にはしない。ページの主題は案件名の h1 で、これはお知らせのため */}
        {place.closed && (
          <div style={{ background: '#FEF2F2', border: '2px solid #E02020', borderRadius: '12px', padding: '16px 20px', marginBottom: '24px' }}>
            <p className='jp-text' style={{ fontSize: '17px', fontWeight: 900, color: '#C81E1E', margin: 0, lineHeight: 1.5 }}>
              この案件の募集は終了しました
            </p>
            <p className='jp-text' style={{ fontSize: '13px', color: '#475569', margin: '6px 0 12px', lineHeight: 1.8 }}>
              {openNearbyCount > 0
                ? `このページは出店実績として掲載しています。${place.prefecture}で募集中の案件はページの下でもご覧いただけます。`
                : 'このページは出店実績として掲載しています。募集中の案件は一覧からお探しください。'}
            </p>
            <Link href={openListHref} style={{ display: 'inline-block', background: '#F5A623', color: '#fff', textDecoration: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '14px', fontWeight: 900 }}>
              {openNearbyCount > 0 ? `${place.prefecture}で募集中の案件を見る →` : '募集中の案件を探す →'}
            </Link>
          </div>
        )}

        <div className='detail-2col' style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '28px', alignItems: 'start' }}>
          <div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <span style={{ background: '#F5A623', color: '#fff', fontSize: '12px', fontWeight: '700', padding: '3px 12px', borderRadius: '999px' }}>{tag}</span>
              {place.closed && (
                <span style={{ background: '#E02020', color: '#fff', fontSize: '12px', fontWeight: 700, padding: '3px 12px', borderRadius: '999px' }}>募集終了</span>
              )}
              {place.prefecture && <span style={{ background: '#EBF6FD', color: '#1D4ED8', fontSize: '12px', fontWeight: '700', padding: '3px 12px', borderRadius: '999px' }}>📍{place.prefecture}</span>}
            </div>
            {/* 案件名は文節の切れ目で折り返す。付けないと「イオンモール幕張新都心 キッ」「チンカー出店募集」のように語の途中で割れる */}
            <h1 className='jp-head' style={{ fontSize: '24px', fontWeight: '900', color: '#1a1a1a', marginBottom: '20px', lineHeight: 1.4 }}>{place.title}</h1>

            {/* 写真は複数枚登録できる。サムネイルを押すと大きい写真が入れ替わる。 */}
            <div style={{ background: '#fff', borderRadius: '12px', overflow: 'hidden', marginBottom: '20px', border: '1px solid #E5E7EB' }}>
              <div style={{ height: '260px', background: shownPhoto ? `url(${shownPhoto}) center/cover no-repeat` : 'linear-gradient(135deg,#FFF3CD,#FFE082)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '80px' }}>
                {!shownPhoto && (place.place_type === 'event' ? '🎪' : '🏪')}
              </div>
              {photos.length > 1 && (
                <div style={{ display: 'flex', gap: '8px', padding: '10px', flexWrap: 'wrap', borderTop: '1px solid #F1F5F9' }}>
                  {photos.map((url, i) => (
                    <button key={url + i} type='button' onClick={() => setPhotoIndex(i)}
                      style={{ padding: 0, border: i === photoIndex ? '2px solid #F5A623' : '2px solid transparent', borderRadius: '8px', background: `url(${url}) center/cover no-repeat`, width: '72px', height: '54px', cursor: 'pointer' }}
                      aria-label={'写真' + (i + 1) + 'を表示'} />
                  ))}
                </div>
              )}
            </div>

            {place.description && (
              <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E5E7EB', padding: '20px', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '900', marginBottom: '10px', color: '#1a1a1a' }}>概要</h3>
                <p style={{ fontSize: '14px', color: '#555', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{place.description}</p>
              </div>
            )}

            <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E5E7EB', overflow: 'hidden', marginBottom: '20px' }}>
              {/* detail-kv … スマホではラベル列を狭くして、右の値が潰れないようにする（指定は globals.css 側） */}
              <table className='detail-kv' style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {[
                    { label: '日程', value: scheduleNode },
                    { label: 'アクセス', value: place.address || '要相談' },
                    { label: '出店料', value: canSeeFee ? feeNodes(place) : '🔒 ログイン後に表示' },
                    { label: '出店形態', value: tag },
                  ].map((row, i) => (
                    <tr key={row.label} style={{ borderBottom: i < 3 ? '1px solid #F3F4F6' : 'none' }}>
                      <td style={{ padding: '14px 20px', background: '#FFFBEB', fontWeight: '700', fontSize: '13px', color: '#B45309', width: '160px', whiteSpace: 'nowrap' }}>{row.label}</td>
                      <td style={{ padding: '14px 20px', fontSize: '14px', color: '#1a1a1a' }}>{row.label === 'アクセス' && place.address ? (<a href={'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(place.address)} target='_blank' rel='noopener noreferrer' style={{ color: '#1D4ED8', textDecoration: 'underline', fontWeight: 700 }}>{row.value} 🗺️</a>) : row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {place.latitude != null && place.longitude != null && (
              <div style={{ marginBottom: '20px' }}>
                <PlacesMap pins={[{ id: place.id, title: place.title, prefecture: place.prefecture, fee: place.fee, latitude: place.latitude, longitude: place.longitude }]} />
              </div>
            )}

            {(() => {
              const d = place.details || {}
              const val = (k: string) => detailText(k, d[k])
              // 高さ制限・雨天時の対応は補足を添えて1項目にまとめる
              const height = val('heightLimit') + (d.heightValue ? '（' + d.heightValue + '）' : '')
              const rain = val('rain') + (d.rainNote ? '（' + d.rainNote + '）' : '')
              const time = place.open_time || place.close_time
                ? [place.open_time, place.close_time].filter(Boolean).join(' 〜 ') : ''
              const rows: { label: string, value: string }[] = [
                { label: '開催時間', value: time },
                { label: '搬入時間', value: d.loadIn || '' },
                { label: '搬出時間', value: d.loadOut || '' },
                { label: '応募締切', value: d.deadline ? d.deadline.replaceAll('-', '/') : '' },
                { label: '想定来場者数', value: d.visitors || '' },
                { label: '募集台数', value: place.max_slots != null ? place.max_slots + '台' : '' },
                { label: '屋内 / 屋外', value: val('location') },
                { label: '電源', value: val('power') },
                { label: 'ガス機器', value: val('gas') },
                { label: '水道設備', value: val('water') },
                { label: '飲食スペース', value: val('eatSpace') },
                { label: 'ゴミの処理', value: val('trash') },
                { label: '高さ制限', value: height },
                { label: '雨天時の対応', value: rain },
                { label: '車両の留め置き', value: val('parking') },
                { label: '過去の開催実績', value: val('history') },
                { label: '希望メニュー', value: d.menuWant || '' },
                { label: 'NGメニュー', value: d.menuNG || '' },
                { label: '他の出店予定メニュー', value: d.menuOther || '' },
                { label: '販売禁止・ブランド制限', value: d.brand || '' },
              ].filter(r => r.value)
              const hasNotes = !!place.details?.notes

              // 未ログインのときは、出店条件と備考をまとめて1つの案内にする。
              // 同じ案内が2つ並ぶと、くどく見えてしまうため。
              if (!canSeeFee) {
                if (rows.length === 0 && !hasNotes) return null
                const items: string[] = []
                if (rows.length > 0) items.push('出店条件（開催時間・搬入搬出・電源・ガス・水道など' + rows.length + '項目）')
                if (hasNotes) items.push('備考・ご案内（募集者からの注意事項）')
                return (
                  <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #FDE68A', overflow: 'hidden', marginBottom: '20px' }}>
                    <div style={{ padding: '22px 20px', textAlign: 'center' }}>
                      <div style={{ fontSize: '15px', color: '#B45309', fontWeight: 900, marginBottom: '10px' }}>🔒 くわしい内容はログイン後にご覧いただけます</div>
                      <div style={{ display: 'inline-block', textAlign: 'left', fontSize: '12px', color: '#475569', lineHeight: 2, marginBottom: '14px' }}>
                        {items.map(x => <div key={x}>・{x}</div>)}
                        <div>・出店料</div>
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '14px' }}>会員登録・ご利用はすべて無料です。</div>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap' }}>
                        <Link href='/login' style={{ background: '#3A9BD5', color: '#fff', textDecoration: 'none', borderRadius: '8px', padding: '11px 26px', fontSize: '14px', fontWeight: 700 }}>ログイン</Link>
                        <Link href='/register' style={{ background: '#fff', color: '#E08A00', border: '2px solid #F5A623', textDecoration: 'none', borderRadius: '8px', padding: '10px 24px', fontSize: '14px', fontWeight: 700 }}>新規会員登録（無料）</Link>
                      </div>
                    </div>
                  </div>
                )
              }

              if (rows.length === 0) return null
              return (
                <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E5E7EB', overflow: 'hidden', marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: '900', padding: '16px 20px 0', color: '#1a1a1a' }}>出店条件</h3>
                  {/* 上の表と同じく、スマホではラベル列を狭くする。
                      ラベルは「他の出店予定メニュー」のように長いものがあり、
                      jp-head で文節の切れ目に寄せて折り返す（iPhone の Safari では効かないため列幅の指定と併用する） */}
                  <table className='detail-kv' style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
                    <tbody>
                      {rows.map((row, i) => (
                        <tr key={row.label} style={{ borderBottom: i < rows.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                          <td className='jp-head' style={{ padding: '12px 20px', background: '#FFFBEB', fontWeight: '700', fontSize: '13px', color: '#B45309', width: '160px', verticalAlign: 'top' }}>{row.label}</td>
                          <td style={{ padding: '12px 20px', fontSize: '14px', color: '#1a1a1a', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{row.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            })()}

            {/* 未ログインのときは、上の「くわしい内容は…」にまとめて出している */}
            {canSeeFee && place.details?.notes && (
              <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E5E7EB', padding: '20px', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '900', marginBottom: '10px', color: '#1a1a1a' }}>備考・ご案内</h3>
                <p style={{ fontSize: '14px', color: '#555', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{place.details.notes}</p>
              </div>
            )}

            {place.recruit && (
              <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E5E7EB', padding: '20px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '900', marginBottom: '10px', color: '#1a1a1a' }}>募集内容</h3>
                <p style={{ fontSize: '14px', color: '#555', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{place.recruit}</p>
              </div>
            )}
          </div>

          <div style={{ position: 'sticky', top: '20px' }}>
            <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E5E7EB', overflow: 'hidden', marginBottom: '16px' }}>
              <div style={{ background: place.closed ? '#E02020' : '#F5A623', padding: '14px 20px' }}>
                <div style={{ color: '#fff', fontWeight: '900', fontSize: '15px' }}>
                  {place.closed ? 'この案件は募集を終了しました' : 'この案件に出店する'}
                </div>
              </div>
              <div style={{ padding: '20px' }}>
                {/* プロフィールが未完成のときの案内。
                    分岐（募集終了／完了／エントリー済み／未開封／フォーム）より手前に1回だけ置く。
                    以前は「未開封」の枝の中にだけ置いていたため、同じ案件に申込履歴がある人が
                    「別の日程を追加でエントリーする」を押すと画面が何も変わらず、
                    ボタンが壊れているように見えた（2026-09-24 の反映前チェックで判明）。
                    送信直前の確認で止まったときも、ここに出る */}
                {profileMissing.length > 0 && !place.closed && (
                  <div style={{ background: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: '8px', padding: '12px 14px', marginBottom: '14px' }}>
                    <div style={{ fontSize: '13px', fontWeight: 900, color: '#DC2626', marginBottom: '6px' }}>
                      プロフィールの入力が必要です（未入力 {profileMissing.length}件）
                    </div>
                    <div className='jp-text' style={{ fontSize: '12px', color: '#7F1D1D', lineHeight: 1.8, marginBottom: '10px' }}>
                      出店が決まると、ここに入れた内容がそのまま施設へ提出されます。
                      すべて入力すると、この案件に申し込めます。
                      <br /><strong>未入力：{profileMissing.map(m => m.label).join('、')}</strong>
                    </div>
                    <Link href='/dashboard/seller' style={{ display: 'block', background: '#DC2626', color: '#fff', textAlign: 'center', padding: '11px', borderRadius: '8px', fontWeight: 900, fontSize: '13px', textDecoration: 'none' }}>
                      プロフィールを入力する
                    </Link>
                  </div>
                )}
                {/* 募集が終わった案件は、掲載は残したままエントリーだけ止める */}
                {place.closed ? (
                  <div style={{ textAlign: 'center' }}>
                    {/* 改行はブラウザに任せる。br で3行に固定するとパソコンのサイドバー幅にしか合わず、
                        枠が画面いっぱいに広がるスマホでは「で、」だけが次の行に残ってしまうため */}
                    <div className='jp-text' style={{ fontSize: '13px', color: '#64748B', lineHeight: 1.9, marginBottom: '16px' }}>
                      この案件の募集は終了しています。同じ場所で新しい募集が出ることがありますので、ほかの案件もご覧ください。
                    </div>
                    <Link href={openListHref} style={{ display: 'block', background: '#F5A623', color: '#fff', textAlign: 'center', padding: '13px', borderRadius: '8px', fontWeight: 900, fontSize: '14px', textDecoration: 'none' }}>
                      募集中の案件を探す
                    </Link>
                  </div>
                ) : entryDone ? (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '40px', marginBottom: '10px' }}>🎉</div>
                    <div style={{ fontSize: '15px', fontWeight: '900', color: '#16A34A', marginBottom: '8px' }}>エントリーが完了しました</div>
                    <div style={{ fontSize: '13px', color: '#666', marginBottom: '16px', lineHeight: 1.7 }}>申込内容はマイページでご確認いただけます。</div>
                    <Link href="/dashboard/seller" style={{ display: 'block', background: '#F5A623', color: '#fff', textAlign: 'center', padding: '14px', borderRadius: '8px', fontWeight: '900', fontSize: '15px', textDecoration: 'none' }}>マイページへ</Link>
                    {/* 完了の画面から申込フォームへ戻れる道を作る。
                        以前は entryDone を false に戻す場所がどこにも無く、
                        続けて別の日を申し込むには再読み込みが必要だった。
                        申し込んだ日は選択から外してあり（submitEntry）、
                        マスにも「済」が付くので、同じ日をもう一度送ることはない */}
                    {calendarDays.length > 0 && (
                      <button
                        type='button'
                        // ここも handleEntryClick と同じ確認を通す。
                        // 素通しにすると、未入力の人がフォームを開いてから
                        // 送信の直前で止められることになる
                        onClick={async () => { setEntryErr(''); setEntryDone(false); await handleEntryClick() }}
                        style={{ width: '100%', marginTop: '10px', background: 'transparent', border: '2px solid #F5A623', color: '#E08A00', textAlign: 'center', padding: '12px', borderRadius: '8px', fontWeight: 700, fontSize: '13px', cursor: 'pointer' }}
                      >
                        続けて別の日をエントリーする
                      </button>
                    )}
                  </div>
                ) : (!showEntry && myEntries.length > 0) ? (
                  /* すでに申し込んでいる場合は、その状態を出す。
                     「エントリーする」だけだと未申込に見えてしまうため。 */
                  <>
                    <div style={{ background: '#ECFDF5', border: '1px solid #BBF7D0', borderRadius: '8px', padding: '12px 14px', marginBottom: '14px' }}>
                      <div style={{ fontSize: '14px', fontWeight: 900, color: '#16A34A', marginBottom: '8px' }}>この案件はエントリー済みです</div>
                      <div style={{ display: 'grid', gap: '8px' }}>
                        {myEntries.map(e => {
                          const st = e.status === 'approved'
                            ? { label: '承認済', color: '#16A34A' }
                            : e.status === 'rejected'
                              ? { label: '不採用', color: '#DC2626' }
                              : e.status === 'cancelled'
                                ? { label: '取消し', color: '#475569' }
                                : { label: '審査中', color: '#B45309' }
                          return (
                            <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', background: '#fff', borderRadius: '6px', padding: '8px 10px' }}>
                              <span style={{ color: st.color, border: `1px solid ${st.color}`, borderRadius: '4px', padding: '1px 8px', fontSize: '11px', fontWeight: 700 }}>{st.label}</span>
                              <span style={{ fontSize: '13px', color: '#1a1a1a', fontWeight: 700 }}>
                                {e.apply_date ? e.apply_date.replace(/-/g, '/') : '日程調整中'}
                              </span>
                              {e.status === 'approved' || e.status === 'pending' ? (
                                // 出店者からの取り消しは受け付けない。
                                // 気軽に取り消せると当日の欠席が増え、
                                // 募集者は会場や書類の準備を進めているため。
                                // やむを得ない事情は運営が個別に判断する。
                                //
                                // 取り消しの連絡先を伝える案内文なので、バッジと同じ11pxでは小さすぎる。
                                // 13pxに上げ、折り返して自分の行に落ちたときに読めるよう右寄せもやめている
                                //
                                // 不採用と取消しには出さない。取消しに出すと
                                // 「取消し」の札の横に「審査中です」と並んで出ていた
                                <span className='jp-text' style={{ marginLeft: 'auto', fontSize: '13px', color: '#64748B', lineHeight: 1.7 }}>
                                  {e.status === 'approved' ? '出店が決定しています。' : '審査中です。'}
                                  <br />
                                  取り消しをご希望の場合は運営までご連絡ください。
                                </span>
                              ) : null}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                    <Link href="/dashboard/seller" style={{ display: 'block', background: '#F5A623', color: '#fff', textAlign: 'center', padding: '13px', borderRadius: '8px', fontWeight: '900', fontSize: '14px', textDecoration: 'none', marginBottom: '10px' }}>マイページで確認する</Link>
                    <button onClick={handleEntryClick} style={{ width: '100%', display: 'block', background: '#fff', color: '#3A9BD5', textAlign: 'center', padding: '12px', borderRadius: '8px', fontWeight: '700', fontSize: '13px', border: '1.5px solid #BFDBFE', cursor: 'pointer' }}>
                      別の日程を追加でエントリーする
                    </button>
                  </>
                ) : !showEntry ? (
                  <>
                    <div style={{ fontSize: '13px', color: '#888', marginBottom: '16px', lineHeight: 1.7 }}>
                      出店者ログイン後、この案件にエントリーできます。
                    </div>
                    <button onClick={handleEntryClick} style={{ width: '100%', display: 'block', background: '#3A9BD5', color: '#fff', textAlign: 'center', padding: '14px', borderRadius: '8px', fontWeight: '900', fontSize: '15px', border: 'none', cursor: 'pointer', marginBottom: '10px' }}>
                      この案件にエントリーする
                    </button>
                    <Link href="/register" style={{ display: 'block', border: '2px solid #F5A623', color: '#E08A00', textAlign: 'center', padding: '12px', borderRadius: '8px', fontWeight: '700', fontSize: '13px', textDecoration: 'none' }}>
                      新規会員登録はこちら(無料)
                    </Link>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: '14px', fontWeight: '900', color: '#1a1a1a', marginBottom: '14px' }}>出店形式を選択してください</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '18px' }}>
                      {/* 受け入れる形態は案件ごとに決める。
                          設定していない案件は、これまでどおり全部出す */}
                      {allowedFormats(place.format_fees).map(opt => {
                        const ff = formatFeeOf(place.format_fees, opt)
                        const dows = sortedDows(ff?.dows)
                        // 金額の文は app/lib/placeFee.ts の feeCondition で作る。
                        // 以前はここで price_fixed と company_fixed_amount を手で足し、
                        // 単位を見ずに「円/日」と直書きしていた。そのため
                        // 「期間で1回のみ」の案件が「80,000円/日」と出て、3日間で8万円の案件が
                        // 1日8万円に見えていた（2026-09-25 の運営からの指摘）。
                        // 平日/土日祝の出し分け・歩合・最低保証も feeCondition が同じ言い方で作る
                        const { parts: feeParts, minNote, empty: feeEmpty } = feeCondition(place, opt)
                        return (
                          <label key={opt} style={{ display: 'block', cursor: 'pointer', border: format === opt ? '2px solid #F5A623' : '1px solid #E5E7EB', borderRadius: '8px', padding: '12px 14px', fontSize: '14px', color: '#1a1a1a', background: format === opt ? '#FFFBEB' : '#fff' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <input type="radio" name="format" checked={format === opt} onChange={() => chooseFormat(opt)} style={{ accentColor: '#F5A623' }} />
                              <span style={{ fontWeight: 700 }}>{opt}</span>
                            </span>
                            {/* 形態ごとの金額と条件。以前は概要欄に文章で書いていたので見落とされていた */}
                            {ff && (
                              <span style={{ display: 'block', marginTop: '6px', paddingLeft: '26px', fontSize: '12.5px', color: '#475569', lineHeight: 1.8 }}>
                                出店料：
                                {feeEmpty
                                  ? <span style={{ color: '#B45309' }}>要相談</span>
                                  : feeParts.map((part, i) => (
                                      <Fragment key={part}>
                                        {i > 0 ? ' ＋ ' : ''}
                                        <strong className='nowrap-unit'>{part}</strong>
                                      </Fragment>
                                    ))}
                                {/* 最低保証。歩合しか無い形態（売上が少ない日でもこの額）は、
                                    これが出ないと当日の負担が分からない */}
                                {minNote && <><br /><strong style={{ color: '#B45309' }}>{minNote}</strong>（売上が少ない日は、この額をいただきます）</>}
                                {ff.note && <><br />区画：{ff.note}</>}
                                {dows.length > 0 && <><br />出店できる曜日：{dows.map(d => ['日','月','火','水','木','金','土'][d]).join('・')}</>}
                              </span>
                            )}
                          </label>
                        )
                      })}
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: '900', color: '#1a1a1a', marginBottom: '8px' }}>出店希望日</div>
                    {calendarDays.length > 0 ? (
                      <>
                        <div style={{ fontSize: '12px', color: '#888', marginBottom: '8px' }}>出店したい日をカレンダーから選んでください（複数選択可）</div>
                        {/* 以前は1日1枚のカードを縦に並べていた。日程が最長31日ある案件では
                            申込枠が極端に縦長になり、選ぶ途中でやめてしまう人がいた（2026-09-23 の依頼）。
                            選べる日・その日の額・選べない理由は calendarDays で作って渡す */}
                        <ApplyDateCalendar
                          days={calendarDays}
                          selected={selectedDates}
                          onToggle={toggleDate}
                          onSelectMany={dates => setSelectedDates(prev => Array.from(new Set([...prev, ...dates])))}
                          onClearMonth={dates => setSelectedDates(prev => prev.filter(d => !dates.includes(d)))}
                          feeState={!canSeeFee ? 'login' : !format ? 'format' : 'ok'}
                          periodFee={perEventFeeOf(place)}
                          minDays={minApplyDays(place)}
                        />
                        {/* 選んだ形式で出店できない曜日があるときは、理由を文でも出す。
                            マスが灰色になっているだけでは、なぜ選べないのか分からない */}
                        {wrongDowCount > 0 && (
                          <div style={{ fontSize: '11.5px', color: '#DC2626', marginBottom: '10px' }}>
                            {wrongDowCount}日は{format}では出店できない曜日のため選べません
                          </div>
                        )}
                      </>
                    ) : (
                      <div style={{ marginBottom: '16px' }}>
                        <div style={{ fontSize: '12px', color: '#888', marginBottom: '6px' }}>この案件は出店日が未設定です。ご希望の日付を入力してください（過去の日付は選べません）。</div>
                        <input type="date" value={entryDate} min={todayStr()} max={applyLimitStr ?? undefined} onChange={e => setEntryDate(e.target.value)} style={{ width: '100%', border: '1px solid #E5C07B', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', boxSizing: 'border-box', color: '#1a1a1a', background: '#fff' }} />
                      </div>
                    )}
                    {entryErr && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px', fontSize: '13px', color: '#DC2626', marginBottom: '12px' }}>{entryErr}</div>}
                    <button onClick={submitEntry} disabled={submitting} style={{ width: '100%', background: submitting ? '#ccc' : '#3A9BD5', color: '#fff', textAlign: 'center', padding: '14px', borderRadius: '8px', fontWeight: '900', fontSize: '15px', border: 'none', cursor: submitting ? 'not-allowed' : 'pointer', marginBottom: '8px' }}>
                      {submitting ? '送信中...' : 'エントリーする'}
                    </button>
                    <button onClick={() => setShowEntry(false)} style={{ width: '100%', background: 'transparent', color: '#888', textAlign: 'center', padding: '8px', borderRadius: '8px', fontWeight: '700', fontSize: '13px', border: 'none', cursor: 'pointer' }}>
                      キャンセル
                    </button>
                  </>
                )}
              </div>
            </div>

            <div style={{ background: '#FFF9E6', borderRadius: '12px', border: '1px solid #FFE0A0', padding: '16px' }}>
              <h4 style={{ fontSize: '13px', fontWeight: '900', marginBottom: '10px', color: '#B45309' }}>📋 基本情報</h4>
              <div style={{ fontSize: '12px', color: '#666', lineHeight: 2 }}>
                {place.prefecture && <div>📍 {place.prefecture}</div>}
                <div>💴 {canSeeFee ? feeNodes(place) : '🔒 ログイン後に表示'}</div>
                <div>🚚 {tag}</div>
              </div>
            </div>
          </div>
        </div>

        {/* 募集終了した案件のときだけ、同じ県で募集中の案件を並べる（サーバーで描いたもの） */}
        {place.closed && openNearby}

        {/* この案件が属するエリア別・カテゴリ別ページへ（サーバーで描いたもの）。
            289件ある案件詳細から新しい一覧ページへの入り口になる */}
        {segmentLinks}
      </div>


      <SiteFooter />
    </div>
    </>
  )
}
