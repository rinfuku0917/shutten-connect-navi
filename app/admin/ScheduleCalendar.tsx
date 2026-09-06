'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// 出店管理スケジュール。
//
// 承認された出店を月のカレンダーに並べ、日を選ぶとその日の出店が一覧で出る。
// 出店を開くと、出店場所・屋号・提出済みの企業情報・現場メモが見られる。
//
// 出店者ダッシュボードにも似たカレンダーがあるが、そちらは
// 「自分の申込」を出すもので、扱うデータも用途も違うため作りは分けている
// （共通化すると、動いている出店者側を触ることになる）。

type Slot = {
  applicationId: string
  placeId: string
  sellerId: string
  date: string          // YYYY-MM-DD
  placeTitle: string
  shopName: string      // 屋号。未登録なら代表者名
  sellerName: string
  format: string
  // 当日の進行。どこまで進んだかを一目で分かるようにする
  confirmedAt: string | null
  checkedInAt: string | null
  leftAt: string | null
}

type Submission = {
  shopName: string
  instagram: string
  genre: string
  takeoutBag: string
  paymentMethods: string[]
  menus: { name: string, detail?: string, price?: string | number }[]
  note: string
} | null

type Note = { id: string, body: string, authorName: string, createdAt: string, updatedAt: string }

// 売上報告。出店枠ごとに引いて、報告が来ているかどうかと中身を出す
type Sale = {
  id: string
  revenue: number
  totalPay: number | null
  items: { name: string, qty: number, price: number | null }[]
  weather: string
  customers: number | null
  note: string
  saleDate: string
  createdAt: string
  acceptedAt: string | null
}

const pad = (n: number) => String(n).padStart(2, '0')
const todayJst = () => {
  // サーバーはUTCで動くが、ここはブラウザなので端末の時計でよい。
  // 日本で使う画面なので、端末の日付をそのまま「今日」とする
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

const CARD: React.CSSProperties = {
  background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '18px',
}

export default function ScheduleCalendar({
  onOpenDocs,
  onOpenSeller,
}: {
  /** 出店者の書類だけを絞って開く。管理画面の openSellerDocs を渡す */
  onOpenDocs?: (sellerId: string, sellerName: string) => void
  /** 出店者の登録情報（連絡先・エリア）を開く。管理画面の openSellerInfo を渡す */
  onOpenSeller?: (sellerId: string, sellerName: string) => void
} = {}) {
  const [month, setMonth] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() } })
  const [slots, setSlots] = useState<Slot[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [picked, setPicked] = useState<string | null>(null)
  // いま開いている出店枠。企業情報とメモはここを開いたときに読む
  const [openSlot, setOpenSlot] = useState<Slot | null>(null)
  const [submission, setSubmission] = useState<Submission>(null)
  const [subLoading, setSubLoading] = useState(false)
  const [notes, setNotes] = useState<Note[]>([])
  const [noteDraft, setNoteDraft] = useState('')
  const [noteBusy, setNoteBusy] = useState(false)
  const [noteErr, setNoteErr] = useState('')
  // 出店枠ごとの売上報告。月を読み込むときに一括で引く
  const [salesByApp, setSalesByApp] = useState<Map<string, Sale[]>>(new Map())
  // 受理と督促の操作中フラグ・結果
  const [actBusy, setActBusy] = useState('')
  const [actErr, setActErr] = useState('')
  // 開いた出店枠の督促の履歴（前回いつ送ったか）
  const [remind, setRemind] = useState<{ count: number, lastSentAt: string | null } | null>(null)

  const token = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || ''
  }

  // 売上報告を受理する／受理を取り消す
  const toggleAccept = async (sale: Sale) => {
    if (actBusy) return
    setActBusy(sale.id)
    setActErr('')
    const t = await token()
    if (!t) { setActErr('ログインの有効期限が切れています。読み込み直してください。'); setActBusy(''); return }
    const res = await fetch('/api/admin/sales-accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
      body: JSON.stringify({ saleId: sale.id, undo: !!sale.acceptedAt }),
    })
    const j = await res.json().catch(() => ({}))
    setActBusy('')
    if (!res.ok) { setActErr(j.error || '受理の記録に失敗しました'); return }
    await load()
  }

  // この出店枠へ督促を送る
  const sendRemind = async (s: Slot) => {
    if (actBusy) return
    setActBusy(s.applicationId)
    setActErr('')
    const t = await token()
    if (!t) { setActErr('ログインの有効期限が切れています。読み込み直してください。'); setActBusy(''); return }
    const res = await fetch('/api/admin/sales-remind', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
      body: JSON.stringify({ applicationId: s.applicationId }),
    })
    const j = await res.json().catch(() => ({}))
    setActBusy('')
    if (!res.ok) { setActErr(j.error || '督促を送れませんでした'); return }
    setRemind({ count: j.count || 0, lastSentAt: j.lastSentAt || null })
  }

  const loadRemind = async (applicationId: string) => {
    setRemind(null)
    const t = await token()
    if (!t) return
    const res = await fetch('/api/admin/sales-remind?applicationId=' + encodeURIComponent(applicationId), {
      headers: { Authorization: 'Bearer ' + t },
    })
    const j = await res.json().catch(() => ({}))
    if (res.ok) setRemind({ count: j.count || 0, lastSentAt: j.lastSentAt || null })
  }

  // 表示している月の出店を読む。
  // 前後の月へ動くたびに読み直す（全期間を一度に読むと、件数が増えたときに詰まる）
  const load = useCallback(async () => {
    setLoading(true)
    setErr('')
    const { y, m } = month
    const start = `${y}-${pad(m + 1)}-01`
    const endD = new Date(y, m + 1, 1)
    const end = `${endD.getFullYear()}-${pad(endD.getMonth() + 1)}-01`

    // profiles への結合は外部キー名を明示する。
    // applications から profiles への関係が seller_id と cancelled_by の2本あり、
    // 名前を書かないと「どちらか決められない」と拒否されるため
    const { data, error } = await supabase
      .from('applications')
      .select('id, place_id, seller_id, apply_date, format, confirmed_at, checked_in_at, left_at, places(title), profiles!applications_seller_id_fkey(name, shop_name)')
      .eq('status', 'approved')
      .not('apply_date', 'is', null)
      .gte('apply_date', start)
      .lt('apply_date', end)
      .order('apply_date', { ascending: true })

    if (error) { setErr('出店の読み込みに失敗しました：' + error.message); setLoading(false); return }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapped: Slot[] = (data || []).map((a: any) => ({
      applicationId: a.id,
      placeId: a.place_id,
      sellerId: a.seller_id,
      date: a.apply_date,
      placeTitle: a.places?.title || '(案件名なし)',
      shopName: a.profiles?.shop_name || a.profiles?.name || '(出店者)',
      sellerName: a.profiles?.name || '',
      format: a.format || '',
      confirmedAt: a.confirmed_at ?? null,
      checkedInAt: a.checked_in_at ?? null,
      leftAt: a.left_at ?? null,
    }))
    setSlots(mapped)

    // その月の出店に売上報告が来ているかを、まとめて1回で引く。
    // 「当日の進行ボタンを押したか」よりも、運営が知りたいのは
    // 「売上の報告が来ているか」なので、それを枠に出せるようにする。
    //
    // 本日の受付状況（TodayCheckins）が同じ引き方をしている。
    const ids = mapped.map(x => x.applicationId)
    const map = new Map<string, Sale[]>()
    if (ids.length > 0) {
      const { data: rows, error: sErr } = await supabase
        .from('sales')
        .select('id, application_id, sale_date, revenue, total_pay, items, weather, customers, note, created_at, accepted_at')
        .in('application_id', ids)
      // 取れなかったときに黙って「全部未報告」と出さない。
      // 報告済みの出店者に催促を送る判断をしてしまうため
      if (sErr) {
        setErr('売上の読み込みに失敗しました：' + sErr.message)
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const r of ((rows || []) as any[])) {
          if (!r.application_id) continue
          const list = map.get(r.application_id) || []
          list.push({
            id: r.id,
            revenue: r.revenue ?? 0,
            totalPay: r.total_pay ?? null,
            items: Array.isArray(r.items) ? r.items : [],
            weather: r.weather || '',
            customers: r.customers ?? null,
            note: r.note || '',
            saleDate: r.sale_date || '',
            createdAt: r.created_at || '',
            acceptedAt: r.accepted_at ?? null,
          })
          map.set(r.application_id, list)
        }
      }
    }
    setSalesByApp(map)
    setLoading(false)
  }, [month])

  useEffect(() => { load() }, [load])

  // 出店枠を開いたら、企業情報とメモを読む
  const openDetail = async (s: Slot) => {
    setOpenSlot(s)
    setSubmission(null)
    setNotes([])
    setNoteDraft('')
    setNoteErr('')
    setSubLoading(true)

    // 提出済みの企業情報。案件×出店者で1件（出店日ごとではない）
    const { data: sub } = await supabase
      .from('application_submissions')
      .select('shop_name, instagram, genre, takeout_bag, payment_methods, menus, note')
      .eq('place_id', s.placeId)
      .eq('seller_id', s.sellerId)
      .maybeSingle()
    if (sub) {
      setSubmission({
        shopName: sub.shop_name || '',
        instagram: sub.instagram || '',
        genre: sub.genre || '',
        takeoutBag: sub.takeout_bag || '',
        paymentMethods: Array.isArray(sub.payment_methods) ? sub.payment_methods : [],
        menus: Array.isArray(sub.menus) ? sub.menus : [],
        note: sub.note || '',
      })
    }
    setSubLoading(false)
    setActErr('')
    await loadNotes(s.applicationId)
    await loadRemind(s.applicationId)
  }

  const loadNotes = async (applicationId: string) => {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) { setNoteErr('ログインの有効期限が切れています。読み込み直してください。'); return }
    const res = await fetch('/api/admin/onsite-notes?applicationId=' + encodeURIComponent(applicationId), {
      headers: { Authorization: 'Bearer ' + token },
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) { setNoteErr(j.error || 'メモを読み込めませんでした'); return }
    setNotes(j.notes || [])
  }

  const addNote = async () => {
    if (!openSlot || !noteDraft.trim() || noteBusy) return
    setNoteBusy(true)
    setNoteErr('')
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) { setNoteErr('ログインの有効期限が切れています。'); setNoteBusy(false); return }
    const res = await fetch('/api/admin/onsite-notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ applicationId: openSlot.applicationId, body: noteDraft }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) { setNoteErr(j.error || 'メモを保存できませんでした'); setNoteBusy(false); return }
    setNoteDraft('')
    await loadNotes(openSlot.applicationId)
    setNoteBusy(false)
  }

  const removeNote = async (id: string) => {
    if (!openSlot || noteBusy) return
    setNoteBusy(true)
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) { setNoteErr('ログインの有効期限が切れています。'); setNoteBusy(false); return }
    const res = await fetch('/api/admin/onsite-notes?id=' + encodeURIComponent(id), {
      method: 'DELETE',
      headers: { Authorization: 'Bearer ' + token },
    })
    if (!res.ok) { const j = await res.json().catch(() => ({})); setNoteErr(j.error || 'メモを削除できませんでした') }
    await loadNotes(openSlot.applicationId)
    setNoteBusy(false)
  }

  const { y, m } = month
  const shift = (n: number) => { const d = new Date(y, m + n, 1); setMonth({ y: d.getFullYear(), m: d.getMonth() }); setPicked(null); setOpenSlot(null) }
  const firstDow = new Date(y, m, 1).getDay()
  const daysInMonth = new Date(y, m + 1, 0).getDate()
  const today = todayJst()

  // 日付ごとにまとめる
  const byDate = new Map<string, Slot[]>()
  for (const s of slots) {
    const list = byDate.get(s.date)
    if (list) list.push(s); else byDate.set(s.date, [s])
  }

  const pickedSlots = picked ? (byDate.get(picked) || []) : []

  // 当日の進行のどこまで来ているか。
  //
  // これは「出店者が当日の進行ボタンを押したか」であって、
  // 「出店があったか」ではない。押さない出店者も多い。
  // 以前は何も押されていないと一律「未着手」と出していたが、
  // 終わった出店にもそう出るため「実施済みなのに未着手で紛らわしい」と
  // 指摘を受けた。出店日を過ぎているかどうかで言い分けを変える。
  const progressOf = (s: Slot) => {
    if (s.leftAt) return { label: '撤収済み', color: '#64748B', bg: '#F1F5F9' }
    if (s.checkedInAt) return { label: '現場入り', color: '#166534', bg: '#DCFCE7' }
    if (s.confirmedAt) return { label: '前日確認済み', color: '#1D4ED8', bg: '#EFF6FF' }
    // 出店日が過ぎているのに何も押されていない場合。
    // 出店そのものは行われている可能性が高いので「未着手」とは言わない
    if (s.date < today) return { label: '当日の記録なし', color: '#64748B', bg: '#F1F5F9' }
    return { label: '当日の記録待ち', color: '#92400E', bg: '#FEF3C7' }
  }

  // 売上報告が来ているか。運営がいちばん知りたいのはここ
  const reportOf = (s: Slot) => {
    const list = salesByApp.get(s.applicationId) || []
    if (list.length > 0) {
      const total = list.reduce((t, x) => t + (x.revenue || 0), 0)
      return { list, done: true, label: '報告済み ¥' + total.toLocaleString(), color: '#166534', bg: '#DCFCE7' }
    }
    // 出店日が来ていないうちは「未報告」とは言わない。まだ出店していないため
    if (s.date >= today) return { list, done: false, label: '', color: '', bg: '' }
    return { list, done: false, label: '売上の報告待ち', color: '#B45309', bg: '#FEF3C7' }
  }

  return (
    <>
      <div style={{ ...CARD, marginBottom: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <button onClick={() => shift(-1)} aria-label='前の月' style={{ border: '1px solid #E2E8F0', borderRadius: '6px', padding: '5px 12px', background: '#fff', cursor: 'pointer', fontSize: '14px' }}>‹</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ fontWeight: 700, fontSize: '16px' }}>{y}年{m + 1}月</div>
            <button onClick={() => { const d = new Date(); setMonth({ y: d.getFullYear(), m: d.getMonth() }); setPicked(null); setOpenSlot(null) }}
              style={{ border: '1px solid #E2E8F0', borderRadius: '6px', padding: '3px 10px', background: '#fff', cursor: 'pointer', fontSize: '11px', color: '#64748B' }}>今月</button>
          </div>
          <button onClick={() => shift(1)} aria-label='次の月' style={{ border: '1px solid #E2E8F0', borderRadius: '6px', padding: '5px 12px', background: '#fff', cursor: 'pointer', fontSize: '14px' }}>›</button>
        </div>

        <div style={{ textAlign: 'center', fontSize: '11px', color: '#64748B', marginBottom: '12px' }}>
          {loading ? '読み込み中…' : slots.length > 0 ? `この月の出店 ${slots.length}件（日付を押すと内容が出ます）` : 'この月に確定した出店はありません'}
        </div>
        {err && <div style={{ textAlign: 'center', fontSize: '12px', color: '#DC2626', marginBottom: '10px' }}>{err}</div>}

        {/* 1fr のままだと、長い屋号がマスを押し広げて列幅がバラバラになる。
            1fr は minmax(auto,1fr) と同じで、auto の下限が中身の最小幅になるため。
            minmax(0,1fr) にすると下限が0になり、7列が必ず等幅で並ぶ。
            フッターの列（globals.css）でも同じ理由でこの書き方にしている */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,minmax(0,1fr))', gap: '6px' }}>
          {['日', '月', '火', '水', '木', '金', '土'].map((d, i) => (
            <div key={d} style={{ textAlign: 'center', fontSize: '12px', fontWeight: 700, color: i === 0 ? '#DC2626' : i === 6 ? '#1D4ED8' : '#64748B', padding: '6px 0' }}>{d}</div>
          ))}
          {Array.from({ length: firstDow }).map((_, i) => <div key={'pad' + i} style={{ minHeight: '64px' }} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const d = i + 1
            const ds = `${y}-${pad(m + 1)}-${pad(d)}`
            const items = byDate.get(ds) || []
            const isToday = ds === today
            const isPicked = ds === picked
            return (
              <button
                key={ds}
                type='button'
                onClick={() => { setPicked(isPicked ? null : ds); setOpenSlot(null) }}
                style={{
                  minHeight: '64px', textAlign: 'left', padding: '5px 6px', cursor: 'pointer',
                  border: isPicked ? '2px solid #F5A623' : isToday ? '1.5px solid #3A9BD5' : '1px solid #E2E8F0',
                  borderRadius: '8px',
                  background: items.length > 0 ? '#F8FDF9' : '#fff',
                  font: 'inherit', color: '#1a1a1a',
                }}
              >
                <div style={{ fontSize: '12px', fontWeight: 700, color: isToday ? '#1D4ED8' : '#334155' }}>{d}</div>
                {items.slice(0, 2).map(s => (
                  <div key={s.applicationId} style={{ fontSize: '9.5px', color: '#166534', background: '#DCFCE7', borderRadius: '4px', padding: '1px 4px', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.shopName}
                  </div>
                ))}
                {items.length > 2 && (
                  <div style={{ fontSize: '9.5px', color: '#64748B', marginTop: '2px' }}>ほか{items.length - 2}件</div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* 選んだ日の出店一覧 */}
      {picked && (
        <div style={{ ...CARD, marginBottom: '16px' }}>
          <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '12px', color: '#B45309' }}>
            {picked.replaceAll('-', '/')} の出店（{pickedSlots.length}件）
          </div>
          {pickedSlots.length === 0 && (
            <div style={{ fontSize: '13px', color: '#94A3B8' }}>この日に確定した出店はありません。</div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {pickedSlots.map(s => {
              const p = progressOf(s)
              const rep = reportOf(s)
              const isOpen = openSlot?.applicationId === s.applicationId
              return (
                <div key={s.applicationId} style={{ border: isOpen ? '1.5px solid #F5A623' : '1px solid #E2E8F0', borderRadius: '10px', overflow: 'hidden' }}>
                  <button
                    type='button'
                    onClick={() => isOpen ? setOpenSlot(null) : openDetail(s)}
                    style={{ width: '100%', textAlign: 'left', background: isOpen ? '#FFFBEB' : '#fff', border: 'none', padding: '12px 14px', cursor: 'pointer', font: 'inherit', color: '#1a1a1a' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 700, fontSize: '14px' }}>{s.shopName}</span>
                      {/* 売上の報告が来ているかを先に出す。運営がいちばん知りたいところ */}
                      {rep.label && (
                        <span style={{ fontSize: '11px', color: rep.color, background: rep.bg, borderRadius: '999px', padding: '2px 10px', fontWeight: 700 }}>{rep.label}</span>
                      )}
                      <span style={{ fontSize: '11px', color: p.color, background: p.bg, borderRadius: '999px', padding: '2px 10px', fontWeight: 700 }}>{p.label}</span>
                      {s.format && <span style={{ fontSize: '11px', color: '#64748B' }}>{s.format}</span>}
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748B', marginTop: '3px' }}>{s.placeTitle}</div>
                  </button>

                  {isOpen && (
                    <div style={{ borderTop: '1px solid #F1F5F9', padding: '14px', background: '#FCFCFD' }}>
                      {/* 出店者そのものを見に行く導線。
                          現場で「この人の書類は大丈夫か」を確かめたい場面が多いため、
                          企業情報より先に置いている */}
                      {(onOpenSeller || onOpenDocs) && (
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
                          {onOpenSeller && (
                            <button type='button' onClick={() => onOpenSeller(s.sellerId, s.shopName)}
                              style={{ background: '#fff', color: '#1D4ED8', border: '1px solid #BFDBFE', borderRadius: '8px', padding: '7px 14px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', minHeight: '34px' }}>
                              出店者の登録情報
                            </button>
                          )}
                          {onOpenDocs && (
                            <button type='button' onClick={() => onOpenDocs(s.sellerId, s.shopName)}
                              style={{ background: '#fff', color: '#B45309', border: '1px solid #FDE68A', borderRadius: '8px', padding: '7px 14px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', minHeight: '34px' }}>
                              書類を確認
                            </button>
                          )}
                        </div>
                      )}

                      {/* 売上報告。施設へ出す報告書に載る項目をそのまま出す */}
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>売上報告</div>
                      {rep.list.length === 0 && (
                        <div style={{ fontSize: '12px', color: s.date < today ? '#B45309' : '#94A3B8', background: s.date < today ? '#FFFBEB' : '#F8FAFC', border: '1px solid ' + (s.date < today ? '#FDE68A' : '#E2E8F0'), borderRadius: '8px', padding: '9px 11px', marginBottom: '16px' }}>
                          {s.date < today
                            ? 'まだ報告がありません。'
                            : 'これからの出店です。出店日を過ぎると、報告の有無がここに出ます。'}
                        </div>
                      )}

                      {/* 督促。報告が無く、出店日を過ぎているときだけ出す。
                          何度でも送れるので、前回いつ送ったかを添えて連打を防ぐ */}
                      {rep.list.length === 0 && s.date < today && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
                          <button type='button' onClick={() => sendRemind(s)} disabled={actBusy === s.applicationId}
                            style={{ background: actBusy === s.applicationId ? '#ccc' : '#B45309', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 18px', fontSize: '12px', fontWeight: 700, cursor: actBusy === s.applicationId ? 'not-allowed' : 'pointer', fontFamily: 'inherit', minHeight: '36px' }}>
                            {actBusy === s.applicationId ? '送信中…' : '売上報告を督促する'}
                          </button>
                          {remind && remind.count > 0 && remind.lastSentAt && (
                            <span style={{ fontSize: '11.5px', color: '#64748B' }}>
                              前回 {remind.lastSentAt.slice(0, 16).replace('T', ' ')} に送信済み（計{remind.count}回）
                            </span>
                          )}
                          {remind && remind.count === 0 && (
                            <span style={{ fontSize: '11.5px', color: '#94A3B8' }}>まだ送っていません</span>
                          )}
                        </div>
                      )}

                      {actErr && (
                        <div style={{ fontSize: '12px', color: '#B91C1C', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '9px 11px', marginBottom: '16px' }}>{actErr}</div>
                      )}
                      {rep.list.map(sa => {
                        const qty = sa.items.reduce((t, it) => t + (it.qty || 0), 0)
                        return (
                          <div key={sa.id} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '11px 13px', marginBottom: '8px', fontSize: '12.5px', color: '#334155', lineHeight: 1.9 }}>
                            <div style={{ fontSize: '15px', fontWeight: 900, color: '#166534' }}>¥{sa.revenue.toLocaleString()}</div>
                            <div>販売食数：{qty > 0 ? qty + '食' : '—'}／天候：{sa.weather || '—'}／来客数：{sa.customers != null ? sa.customers : '—'}</div>
                            {sa.items.length > 0 && (
                              <div style={{ color: '#64748B' }}>
                                {sa.items.filter(it => (it.qty || 0) > 0).map(it => it.name + ' ' + it.qty + '食').join('／')}
                              </div>
                            )}
                            {sa.note && <div style={{ color: '#B45309', marginTop: '2px' }}>所感：{sa.note}</div>}
                            {/* 運営が代理で入れた場合はその時刻になるため「登録」と書く */}
                            <div style={{ fontSize: '10.5px', color: '#94A3B8', marginTop: '3px' }}>
                              売上日 {sa.saleDate.replaceAll('-', '/')}
                              {sa.createdAt ? '／登録 ' + sa.createdAt.slice(0, 16).replace('T', ' ') : ''}
                            </div>

                            {/* 受理。押すと出店者の画面にも「受理済み」と出る（メールは送らない）。
                                押し直すと取り消せる */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #F1F5F9' }}>
                              {sa.acceptedAt && (
                                <span style={{ fontSize: '11px', color: '#166534', background: '#DCFCE7', borderRadius: '999px', padding: '2px 10px', fontWeight: 700 }}>
                                  受理済み {sa.acceptedAt.slice(0, 10).replaceAll('-', '/')}
                                </span>
                              )}
                              <button type='button' onClick={() => toggleAccept(sa)} disabled={actBusy === sa.id}
                                style={{ background: sa.acceptedAt ? '#fff' : '#16A34A', color: sa.acceptedAt ? '#64748B' : '#fff', border: sa.acceptedAt ? '1px solid #E2E8F0' : 'none', borderRadius: '8px', padding: '7px 16px', fontSize: '12px', fontWeight: 700, cursor: actBusy === sa.id ? 'not-allowed' : 'pointer', fontFamily: 'inherit', minHeight: '34px' }}>
                                {actBusy === sa.id ? '保存中…' : sa.acceptedAt ? '受理を取り消す' : '報告を受理する'}
                              </button>
                            </div>
                          </div>
                        )
                      })}
                      {rep.list.length > 0 && <div style={{ marginBottom: '16px' }} />}

                      {/* 提出済みの企業情報 */}
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>提出済みの企業情報</div>
                      {subLoading && <div style={{ fontSize: '12px', color: '#94A3B8' }}>読み込み中…</div>}
                      {!subLoading && !submission && (
                        <div style={{ fontSize: '12px', color: '#B45309', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '8px', padding: '9px 11px' }}>
                          この案件ではまだ提出されていません。提出があるまでは、プロフィールの内容が使われます。
                        </div>
                      )}
                      {!subLoading && submission && (
                        <div style={{ fontSize: '12px', color: '#334155', lineHeight: 1.9 }}>
                          {submission.shopName && <div>店舗名：{submission.shopName}</div>}
                          {submission.genre && <div>ジャンル：{(() => { try { const g = JSON.parse(submission.genre); return Array.isArray(g) ? g.join('・') : submission.genre } catch { return submission.genre } })()}</div>}
                          {submission.takeoutBag && <div>テイクアウト袋：{submission.takeoutBag}</div>}
                          {submission.paymentMethods.length > 0 && <div>決済：{submission.paymentMethods.join('・')}</div>}
                          {submission.instagram && <div>Instagram：{submission.instagram}</div>}
                          {submission.menus.length > 0 && (
                            <div style={{ marginTop: '4px' }}>
                              メニュー：
                              <ul style={{ margin: '2px 0 0', paddingLeft: '18px' }}>
                                {submission.menus.map((mn, k) => (
                                  <li key={k}>{mn.name}{mn.price ? `（${mn.price}円）` : ''}{mn.detail ? ` — ${mn.detail}` : ''}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {submission.note && <div style={{ marginTop: '4px', color: '#B45309' }}>現場への連絡事項：{submission.note}</div>}
                        </div>
                      )}

                      {/* 現場メモ */}
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#334155', margin: '16px 0 6px' }}>
                        現場メモ
                        <span style={{ fontWeight: 400, color: '#94A3B8', marginLeft: '8px' }}>運営だけが見られます</span>
                      </div>
                      {noteErr && <div style={{ fontSize: '12px', color: '#DC2626', marginBottom: '8px' }}>{noteErr}</div>}
                      {notes.length === 0 && <div style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '8px' }}>まだメモはありません。</div>}
                      {notes.map(n => (
                        <div key={n.id} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '9px 11px', marginBottom: '6px' }}>
                          <div style={{ fontSize: '12.5px', color: '#1a1a1a', whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{n.body}</div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '5px' }}>
                            <span style={{ fontSize: '10.5px', color: '#94A3B8' }}>
                              {n.authorName}／{n.createdAt.slice(0, 16).replace('T', ' ')}
                            </span>
                            <button type='button' onClick={() => removeNote(n.id)} disabled={noteBusy}
                              style={{ border: 'none', background: 'none', color: '#DC2626', fontSize: '11px', cursor: noteBusy ? 'not-allowed' : 'pointer', padding: 0 }}>削除</button>
                          </div>
                        </div>
                      ))}
                      <textarea
                        value={noteDraft}
                        onChange={e => setNoteDraft(e.target.value)}
                        rows={2}
                        placeholder='例：搬入は北側のゲートから。現場の担当は佐藤さん。'
                        style={{ width: '100%', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '9px 11px', fontSize: '13px', color: '#1a1a1a', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
                      />
                      <button type='button' onClick={addNote} disabled={noteBusy || !noteDraft.trim()}
                        style={{ marginTop: '6px', background: (noteBusy || !noteDraft.trim()) ? '#ccc' : '#F5A623', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 18px', fontSize: '12px', fontWeight: 700, cursor: (noteBusy || !noteDraft.trim()) ? 'not-allowed' : 'pointer' }}>
                        {noteBusy ? '保存中…' : 'メモを追加'}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}
