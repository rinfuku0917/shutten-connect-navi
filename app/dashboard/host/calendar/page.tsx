'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '../../../lib/supabase'
import { NO_SHOP_NAME } from '../../../lib/sellerNames'
import BackButton from '../../../components/BackButton'
import MonthGrid from '../../../components/MonthGrid'
import { thisMonthJst, todayJst, monthKey, type YearMonth } from '../../../lib/monthGrid'

// 募集者（イベント主催・施設）の出店カレンダー。
//
// なぜ要るか（2026-10-02 の運営からの依頼）:
//   募集者の画面には月のカレンダーが1つも無かった（調べて確認した）。
//   「場所・案件管理」に申込が縦のリストで並ぶだけで、
//   「来週の火曜は誰が来るのか」を見るには、案件ごとのリストを
//   目で追うしかなかった。
//   出店者と運営には出店カレンダーがあるので、同じものを募集者にも置く。
//
// 出店者マイページ・運営の出店管理と同じ部品（MonthGrid）を使う。
//   見た目と操作が3画面で揃う。
//
// 【見せるもの・見せないもの】
//   見せる   … 自分の案件への申込（案件名・屋号・出店形態・状態）
//   見せない … 出店者の本名・連絡先。
//              屋号は public_sellers から引く（公開してよい項目だけのビュー）。
//              2026-09-19 に出店者ご本人の申し出で、募集者には本名を出さない
//              と決めた。屋号が無い人は公開ページと同じ呼び方で揃える。
//
// データは自分の案件の申込をまとめて1回で取る。
//   募集者が持つ案件は多くて数十件で、申込もその範囲なので、
//   月ごとに取り直すより一度に持ったほうが月送りが速い
//   （運営の出店管理は全案件ぶんを見るので、あちらは月ごとに取っている）。

type HostApp = {
  id: string
  date: string
  placeTitle: string
  placeId: string
  sellerName: string
  format: string
  status: string
}

const STATUS: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: '審査中', color: '#92400E', bg: '#FEF3C7' },
  approved: { label: '承認済', color: '#16A34A', bg: '#ECFDF5' },
  rejected: { label: '否認', color: '#DC2626', bg: '#FEE2E2' },
  cancelled: { label: '取消し', color: '#475569', bg: '#F1F5F9' },
}
const stOf = (s: string) => STATUS[s] || { label: s || '—', color: '#64748B', bg: '#F1F5F9' }

export default function HostCalendar() {
  const [apps, setApps] = useState<HostApp[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [month, setMonth] = useState<YearMonth>(() => thisMonthJst())
  const [picked, setPicked] = useState<string | null>(null)

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const { data: places, error: pErr } = await supabase
      .from('places').select('id, title').eq('host_id', user.id)
    if (pErr) { setErr('案件を読み込めませんでした'); setLoading(false); return }
    const ids = (places || []).map(p => p.id)
    const titleById = new Map((places || []).map(p => [p.id, p.title || '(案件名なし)']))
    if (ids.length === 0) { setApps([]); setLoading(false); return }

    const { data: rows, error: aErr } = await supabase
      .from('applications')
      .select('id, apply_date, format, status, place_id, seller_id')
      .in('place_id', ids)
      .not('apply_date', 'is', null)
    if (aErr) { setErr('申込を読み込めませんでした'); setLoading(false); return }

    // 屋号は public_sellers から。募集者からは profiles が読めない
    const sellerIds = [...new Set((rows || []).map(r => r.seller_id).filter(Boolean))] as string[]
    const nameById = new Map<string, string>()
    if (sellerIds.length > 0) {
      const { data: sellers } = await supabase
        .from('public_sellers').select('id, shop_name').in('id', sellerIds)
      for (const s of sellers || []) nameById.set(s.id, (s.shop_name || '').trim() || NO_SHOP_NAME)
    }

    setApps((rows || []).map(r => ({
      id: r.id,
      date: String(r.apply_date).slice(0, 10),
      placeTitle: titleById.get(r.place_id) || '(案件名なし)',
      placeId: r.place_id,
      sellerName: nameById.get(r.seller_id) || NO_SHOP_NAME,
      format: r.format || '-',
      status: r.status || 'pending',
    })))
    setLoading(false)
  }

  // 読み込みは開いたときの1回だけ。月を送っても取り直さない
  // （募集者が持つ案件は多くて数十件なので、一度に持ったほうが月送りが速い。
  //  運営の出店管理は全案件を見るので、あちらは月ごとに取っている）
  //
  // set-state-in-effect を外している理由:
  //   画面を開いたときにデータを取る、という用途そのもので、
  //   取った結果を state に入れる以外の書き方が無い。
  //   同じ画面（場所・案件管理 app/dashboard/host/page.tsx）も同じ作り。
  //   月を送るたびに取り直す作りにすればルールは満たせるが、
  //   そのぶん月送りが遅くなるので、ここは取らない。
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [])

  const today = todayJst()
  // 日付ごとにまとめる。取消しは数に入れない（来ない出店なので）
  const byDate = new Map<string, HostApp[]>()
  for (const a of apps) {
    if (a.status === 'cancelled') continue
    const list = byDate.get(a.date)
    if (list) list.push(a); else byDate.set(a.date, [a])
  }
  const mk = monthKey(month)
  const monthCount = [...byDate.entries()]
    .filter(([d]) => d.startsWith(mk))
    .reduce((t, [, v]) => t + v.length, 0)

  // この月に無いときの行き先。空の月で行き止まりにしない
  const others = [...byDate.keys()].sort()
  const jump = (() => {
    if (monthCount > 0 || others.length === 0) return null
    const next = others.find(d => d.slice(0, 7) > mk) || others[others.length - 1]
    const [y, m] = next.split('-').map(Number)
    return { y, m: m - 1, count: others.reduce((t, d) => t + (byDate.get(d)?.length || 0), 0) }
  })()

  const pickedApps = picked ? (byDate.get(picked) || []) : []
  const CARD: React.CSSProperties = { background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '16px' }

  return (
    <div style={{ padding: '18px 16px 60px', maxWidth: '760px', margin: '0 auto' }}>
      <BackButton />
      <h1 style={{ fontSize: '19px', fontWeight: 900, color: '#1a1a1a', margin: '12px 0 4px' }}>出店カレンダー</h1>
      <p style={{ fontSize: '12.5px', color: '#64748B', lineHeight: 1.9, margin: '0 0 14px' }}>
        お持ちの案件への出店申込を、日付で見られます。日付を押すと、その日に来る出店者が出ます。
      </p>

      <div style={{ ...CARD, marginBottom: '14px' }}>
        <MonthGrid
          month={month}
          onMonthChange={ym => { setMonth(ym); setPicked(null) }}
          today={today}
          note={<>
            {loading ? '読み込み中…'
              : monthCount > 0 ? `この月の出店 ${monthCount}件（日付を押すと内容が出ます）`
                : 'この月の出店はありません'}
            {jump && (
              <><br />
                <button onClick={() => { setMonth({ y: jump.y, m: jump.m }); setPicked(null) }}
                  style={{ border: '1px solid #FDE68A', background: '#FFFBEB', color: '#B45309', borderRadius: '999px', padding: '5px 14px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', marginTop: '6px', fontFamily: 'inherit' }}>
                  他の月に{jump.count}件あります（{jump.y}年{jump.m + 1}月へ移動）
                </button>
              </>
            )}
            {!loading && others.length === 0 && !err && (
              <><br /><span style={{ color: '#94A3B8' }}>まだ出店申込がありません。</span></>
            )}
            {err && <><br /><span style={{ color: '#DC2626' }}>{err}</span></>}
          </>}
          cellOf={ds => {
            const items = byDate.get(ds) || []
            return {
              selected: ds === picked,
              disabled: items.length === 0,
              filled: items.length > 0,
              label: items.length ? items.map(a => `${stOf(a.status).label}：${a.sellerName}（${a.placeTitle}）`).join('\n') : undefined,
            }
          }}
          renderCell={ds => {
            const items = byDate.get(ds) || []
            if (items.length === 0) return null
            const main = items.find(a => a.status === 'approved') || items[0]
            return (
              <>
                {/* マスの中の文字は9px。スマホでは1マスに文字が入る幅が26px程度しか
                    なく読めないので、.cal-cell-shop を隠して「●2」だけにする
                    （出店者マイページ・運営の出店管理と同じ出し分け） */}
                {items.slice(0, 2).map(a => (
                  <span key={a.id} className='cal-cell-shop' style={{ fontSize: '9px', fontWeight: 700, color: stOf(a.status).color, lineHeight: 1.3, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {a.sellerName}
                  </span>
                ))}
                {items.length > 2 && <span className='cal-cell-shop' style={{ fontSize: '9px', color: '#64748B' }}>ほか{items.length - 2}件</span>}
                <span className='cal-cell-count' style={{ color: stOf(main.status).color }}>●{items.length}</span>
              </>
            )
          }}
          onPickDate={ds => setPicked(ds === picked ? null : ds)}
        >
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '10px', fontSize: '11px', color: '#64748B' }}>
            {(['approved', 'pending', 'rejected'] as const).map(k => (
              <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '9px', height: '9px', borderRadius: '2px', background: stOf(k).bg, border: `1px solid ${stOf(k).color}` }} />
                {stOf(k).label}
              </span>
            ))}
          </div>
        </MonthGrid>
      </div>

      {picked && (
        <div style={CARD}>
          <div style={{ fontSize: '14px', fontWeight: 800, color: '#B45309', marginBottom: '10px' }}>
            {picked.replaceAll('-', '/')} の出店（{pickedApps.length}件）
          </div>
          {pickedApps.length === 0 ? (
            <div style={{ fontSize: '13px', color: '#94A3B8' }}>この日の出店はありません。</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {pickedApps.map(a => {
                const st = stOf(a.status)
                return (
                  <div key={a.id} style={{ border: '1px solid #E2E8F0', borderRadius: '10px', padding: '11px 13px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: st.color, background: st.bg, border: `1px solid ${st.color}`, borderRadius: '999px', padding: '2px 10px' }}>{st.label}</span>
                      <span style={{ fontSize: '14px', fontWeight: 800, color: '#1a1a1a' }}>{a.sellerName}</span>
                      <span style={{ fontSize: '11.5px', color: '#64748B' }}>{a.format}</span>
                    </div>
                    <div style={{ fontSize: '12.5px', color: '#334155', lineHeight: 1.8 }}>{a.placeTitle}</div>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '6px' }}>
                      <Link href={'/places/' + a.placeId} target='_blank' rel='noreferrer'
                        style={{ fontSize: '11.5px', fontWeight: 700, color: '#1D4ED8', textDecoration: 'underline', textUnderlineOffset: '2px' }}>
                        案件の公開ページ
                      </Link>
                      <Link href='/dashboard/host/messages'
                        style={{ fontSize: '11.5px', fontWeight: 700, color: '#1D4ED8', textDecoration: 'underline', textUnderlineOffset: '2px' }}>
                        この出店者とやり取り
                      </Link>
                      {a.status === 'pending' && (
                        <Link href='/dashboard/host'
                          style={{ fontSize: '11.5px', fontWeight: 700, color: '#B45309', textDecoration: 'underline', textUnderlineOffset: '2px' }}>
                          承認・不採用を決める
                        </Link>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
