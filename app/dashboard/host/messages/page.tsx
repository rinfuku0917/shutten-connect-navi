'use client'
import { useState, useEffect } from 'react'
import MessageAttachment from '../../../components/MessageAttachment'
import { supabase } from '../../../lib/supabase'
import BackButton from '../../../components/BackButton'

type DbMessage = { id: string, application_id: string, sender_id: string | null, body: string, sent_at: string, file_url?: string | null }
// 申込1件＝やり取り1スレッド。どの案件・どの出店者かが分かるようにまとめて持つ
type Thread = { applicationId: string, placeTitle: string, sellerName: string, applyDate: string | null, status: string, lastBody: string, lastAt: string | null }

const STATUS_LABEL: Record<string, { label: string, color: string, bg: string }> = {
  pending: { label: '審査中', color: '#92400E', bg: '#FEF3C7' },
  approved: { label: '承認済', color: '#16A34A', bg: '#ECFDF5' },
  rejected: { label: '否認', color: '#DC2626', bg: '#FEE2E2' },
  cancelled: { label: '取消し', color: '#475569', bg: '#F1F5F9' },
}

export default function HostMessages() {
  const [threads, setThreads] = useState<Thread[]>([])
  const [dbMessages, setDbMessages] = useState<DbMessage[]>([])
  const [myId, setMyId] = useState<string | null>(null)
  const [appId, setAppId] = useState<string | null>(null)
  const [msg, setMsg] = useState('')
  const [msgFile, setMsgFile] = useState<File | null>(null)
  const [msgUploading, setMsgUploading] = useState(false)
  const [loading, setLoading] = useState(true)

  // ===== まとめて連絡 =====
  //
  // 「搬入時間が変わりました」のような、応募者全員へ同じことを伝えたい連絡が
  // 1対1のやり取りだと書き写しになる。実際には公式LINEで流していた。
  // 案件を選んで一度に送れるようにする（受け取る側はふだんのメッセージと同じ）。
  const [bcOpen, setBcOpen] = useState(false)
  const [bcPlaceId, setBcPlaceId] = useState('')
  const [bcTarget, setBcTarget] = useState<'approved' | 'all'>('approved')
  // 'upcoming' … これからの出店日だけ（既定）／'past' … 終わった日も含む。
  // 日付で絞らないと、先月出店して終わった人にも当日の連絡が飛ぶ
  const [bcScope, setBcScope] = useState<'upcoming' | 'past'>('upcoming')
  const [bcBody, setBcBody] = useState('')
  const [bcBusy, setBcBusy] = useState(false)
  const [bcErr, setBcErr] = useState('')
  const [bcDone, setBcDone] = useState('')
  // 送る前に確かめる宛先。押す前に「誰に届くか」を見せる
  const [bcPreview, setBcPreview] = useState<{ count: number; recipients: { name: string; days: string[] }[] } | null>(null)
  // 自分の案件（まとめて連絡の宛先を選ぶのに使う）。応募の数も一緒に持つ
  const [myPlaces, setMyPlaces] = useState<{ id: string; title: string; approved: number; pending: number }[]>([])

  const callBroadcast = async (payload: Record<string, unknown>) => {
    const { data: { session } } = await supabase.auth.getSession()
    let res: Response
    try {
      res = await fetch('/api/messages/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (session?.access_token || '') },
        body: JSON.stringify(payload),
      })
    } catch {
      setBcErr('通信に失敗しました。電波の状態を確認してください。送信できていない可能性と、送信できている可能性の両方があります。もう一度押す前に、下の一覧で届いているかご確認ください。')
      return null
    }
    const j = await res.json().catch(() => ({}))
    if (!res.ok) { setBcErr(j.error || 'うまくいきませんでした。'); return null }
    return j
  }

  // 宛先の下見。本文を書く前でも押せる
  const loadBcPreview = async (placeId: string, target: string, scope: string) => {
    setBcPreview(null)
    if (!placeId) return
    setBcErr('')
    const j = await callBroadcast({ placeId, target, scope, preview: true })
    if (j) setBcPreview({ count: j.count, recipients: j.recipients || [] })
  }

  const sendBroadcast = async () => {
    if (bcBusy) return
    if (!bcPlaceId) { setBcErr('案件を選んでください。'); return }
    if (!bcBody.trim()) { setBcErr('本文を入力してください。'); return }
    setBcBusy(true); setBcErr(''); setBcDone('')
    try {
      const j = await callBroadcast({ placeId: bcPlaceId, body: bcBody.trim(), target: bcTarget, scope: bcScope })
      if (!j) return
      // メールが届かなかった分は隠さない。「送れた」と思い込ませない
      const parts = [j.sent + '名の出店者へ送りました。']
      if (j.mailSkipped) parts.push('※ お知らせメールは送られていません（メールの設定が未完了です）。')
      else if (j.failedCount > 0) parts.push('※ うち' + j.failedCount + '名にはお知らせメールが届きませんでした（' + (j.failed || []).join('、') + '）。マイページには残っています。')
      setBcDone(parts.join('\n'))
      setBcBody('')
      setBcPreview(null)
      await loadThreads()
    } finally {
      setBcBusy(false)
    }
  }

  // 自分が募集している案件への申込を、すべてスレッドとして読み込む
  const loadThreads = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }
    setMyId(user.id)

    const { data: places } = await supabase.from('places').select('id, title').eq('host_id', user.id)
    const placeIds = (places || []).map(p => p.id)
    if (placeIds.length === 0) { setThreads([]); setLoading(false); return }
    const titleOf = new Map((places || []).map(p => [p.id, p.title as string]))

    const { data: apps } = await supabase
      .from('applications')
      .select('id, place_id, seller_id, apply_date, status')
      .in('place_id', placeIds)
      .order('apply_date', { ascending: false })
    if (!apps || apps.length === 0) { setThreads([]); setLoading(false); return }

    // まとめて連絡の宛先を選ぶための一覧。案件名だけだと
    // 「◯◯マルシェ」と「◯◯マルシェ（コピー）」の区別が付かないので、
    // これから出店予定の人数を添える
    {
      const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
      const cnt = new Map<string, { approved: Set<string>; pending: Set<string> }>()
      for (const a of apps) {
        if (!a.seller_id || !a.apply_date || a.apply_date < today) continue
        const c = cnt.get(a.place_id) || { approved: new Set<string>(), pending: new Set<string>() }
        if (a.status === 'approved') c.approved.add(a.seller_id)
        else if (a.status === 'pending') c.pending.add(a.seller_id)
        cnt.set(a.place_id, c)
      }
      setMyPlaces((places || []).map(p => {
        const c = cnt.get(p.id)
        return { id: p.id, title: p.title as string, approved: c?.approved.size ?? 0, pending: c?.pending.size ?? 0 }
      }).sort((x, y) => (y.approved + y.pending) - (x.approved + x.pending)))
    }

    // 出店者名をまとめて引く
    const sellerIds = Array.from(new Set(apps.map(a => a.seller_id).filter(Boolean)))
    const nameOf = new Map<string, string>()
    if (sellerIds.length > 0) {
      // 出店者の表示名は公開用のビューから引く。
      // profiles には連絡先が入っているため、募集者からは直接読ませない。
      const { data: profs } = await supabase.from('public_sellers').select('id, shop_name, name').in('id', sellerIds)
      for (const p of profs || []) nameOf.set(p.id, p.shop_name || p.name || '（名称未設定）')
    }

    // 各スレッドの最新メッセージ
    const appIds = apps.map(a => a.id)
    const { data: msgs } = await supabase
      .from('messages')
      .select('id, application_id, sender_id, body, sent_at, file_url')
      .in('application_id', appIds)
      .order('sent_at', { ascending: true })
    const lastOf = new Map<string, DbMessage>()
    for (const m of (msgs || []) as DbMessage[]) lastOf.set(m.application_id, m)

    const built: Thread[] = apps.map(a => {
      const last = lastOf.get(a.id)
      return {
        applicationId: a.id,
        placeTitle: titleOf.get(a.place_id) || '(案件名なし)',
        sellerName: nameOf.get(a.seller_id) || '出店者',
        applyDate: a.apply_date || null,
        status: a.status,
        lastBody: last ? (last.body || '📎 添付ファイル') : 'メッセージはまだありません',
        lastAt: last ? last.sent_at : null,
      }
    })
    // やり取りがあるスレッドを上に、その中でも新しい順に並べる
    built.sort((x, y) => (y.lastAt || '').localeCompare(x.lastAt || ''))
    setThreads(built)
    setLoading(false)
  }

  const openThread = async (id: string) => {
    setAppId(id)
    const { data } = await supabase
      .from('messages').select('id, application_id, sender_id, body, sent_at, file_url')
      .eq('application_id', id).order('sent_at', { ascending: true })
    setDbMessages((data || []) as DbMessage[])
  }

  useEffect(() => { loadThreads() }, [])

  // 開いている間、相手からの新着を自動で取りに行く
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      loadThreads()
      if (appId) openThread(appId)
    }, 15000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appId])

  // 別のタブで申込や承認があったときに備え、画面に戻ったら読み直す
  useEffect(() => {
    const reload = () => { if (document.visibilityState === 'visible') loadThreads() }
    document.addEventListener('visibilitychange', reload)
    window.addEventListener('focus', reload)
    return () => {
      document.removeEventListener('visibilitychange', reload)
      window.removeEventListener('focus', reload)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 添付ファイルを表示する（画像はインライン、それ以外はリンク）
  // 添付ファイルの表示。期限付きURLを使う共通の部品にまとめてある
  // （公開URLだと、URLを知っていれば誰でも見られてしまうため）
  const renderAttachment = (filePath: string, isMine: boolean) => (
    <MessageAttachment filePath={filePath} isMine={isMine} />
  )


  // 自分が送ったメッセージを取り消す（打ち間違いの取り消し用）
  const retractMessage = async (messageId: string) => {
    if (!window.confirm('このメッセージを取り消しますか？\n相手の画面からも削除されます。')) return
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { alert('ログインが必要です'); return }
    const res = await fetch('/api/messages/retract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token },
      body: JSON.stringify({ messageId }),
    })
    const result = await res.json()
    if (!res.ok) { alert('取り消せませんでした: ' + (result.error || '不明なエラー')); return }
    if (appId) openThread(appId)
    loadThreads()
  }

  const sendMessage = async () => {
    const text = msg.trim()
    if (!text && !msgFile) return
    // 送り先が決まっていないまま押されたときは、黙って何もしないのではなく理由を伝える
    if (!appId) { alert('先に左のリストからやり取りする案件を選んでください。'); return }
    if (!myId) { alert('ログイン情報を確認できませんでした。再度ログインしてください。'); return }
    setMsgUploading(true)
    let fileUrl: string | null = null
    if (msgFile) {
      const rawExt = (msgFile.name.split('.').pop() || '').toLowerCase()
      const ext = /^[a-z0-9]{1,5}$/.test(rawExt) ? rawExt : 'dat'
      const path = myId + '/msg-' + Date.now() + '.' + ext
      const up = await supabase.storage.from('message-attachments').upload(path, msgFile, { upsert: true })
      if (up.error) { alert('添付に失敗しました: ' + up.error.message); setMsgUploading(false); return }
      fileUrl = path
    }
    const { error } = await supabase
      .from('messages').insert({ application_id: appId, sender_id: myId, body: text, file_url: fileUrl })
    if (error) { alert('送信に失敗しました: ' + error.message); setMsgUploading(false); return }
    // 相手へ新着メッセージ通知（失敗しても送信は成功扱い）
    try {
      await fetch('/api/notify/new-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId: appId, senderId: myId }),
      })
    } catch (e) {
      console.error('メッセージ通知に失敗しました', e)
    }
    setMsg('')
    setMsgFile(null)
    setMsgUploading(false)
    openThread(appId)
    loadThreads()
  }

  const current = threads.find(t => t.applicationId === appId) || null

  return (
    <div style={{ padding: '20px 24px' }}>
      <div style={{ marginBottom: '12px' }}>
        <BackButton fallback='/dashboard/host' />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h1 style={{ fontSize: '20px', fontWeight: '800', color: '#1a1a1a', margin: 0 }}>メッセージ</h1>
        {myPlaces.length > 0 && (
          <button type='button' onClick={() => { setBcOpen(o => !o); setBcErr(''); setBcDone('') }}
            style={{ background: bcOpen ? '#B45309' : '#F5A623', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 16px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', minHeight: '40px' }}>
            {bcOpen ? '閉じる' : 'まとめて連絡'}
          </button>
        )}
      </div>

      {/* 案件を選んで、応募している出店者全員へ同じ連絡を送る */}
      {bcOpen && (
        <div style={{ background: '#fff', border: '1.5px solid #FDE68A', borderRadius: '12px', padding: '16px 18px', marginBottom: '16px' }}>
          <div style={{ fontSize: '13px', fontWeight: 800, color: '#B45309', marginBottom: '4px' }}>案件の出店者へまとめて連絡する</div>
          <div style={{ fontSize: '12px', color: '#64748B', lineHeight: 1.8, marginBottom: '12px' }}>
            選んだ案件に応募している出店者へ、同じ本文を一度に送ります。受け取る側はふだんのメッセージと同じように見え、返信はひとりずつ返ってきます。
          </div>

          <div style={{ fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>案件</div>
          <select value={bcPlaceId} onChange={e => { setBcPlaceId(e.target.value); loadBcPreview(e.target.value, bcTarget, bcScope) }} disabled={bcBusy}
            style={{ width: '100%', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '10px 12px', fontSize: '16px', color: '#1a1a1a', boxSizing: 'border-box', marginBottom: '12px', minHeight: '44px', fontFamily: 'inherit', background: '#fff' }}>
            <option value=''>選んでください</option>
            {myPlaces.map(p => (
              <option key={p.id} value={p.id}>
                {p.title}（これから出店 承認{p.approved}名・審査中{p.pending}名）
              </option>
            ))}
          </select>

          <div style={{ fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>送る相手</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
            {([
              { v: 'approved' as const, label: '承認した出店者だけ', note: '現場の連絡はこちら' },
              { v: 'all' as const, label: '審査中の方も含む', note: '募集の案内など' },
            ]).map(o => (
              <label key={o.v} style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', border: '1.5px solid', borderColor: bcTarget === o.v ? '#F5A623' : '#E2E8F0', background: bcTarget === o.v ? '#FFF8E1' : '#fff', color: bcTarget === o.v ? '#B45309' : '#475569', borderRadius: '8px', padding: '9px 14px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', minHeight: '40px' }}>
                <input type='radio' name='bc-target' checked={bcTarget === o.v} onChange={() => { setBcTarget(o.v); loadBcPreview(bcPlaceId, o.v, bcScope) }} disabled={bcBusy}
                  style={{ width: '16px', height: '16px' }} />
                {o.label}
                <span style={{ fontWeight: 400, color: '#94A3B8' }}>{o.note}</span>
              </label>
            ))}
          </div>

          {/* 案件は日程を何日も持てる。日付で絞らないと、
              先月出店して終わった人にも当日の連絡が飛ぶ */}
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>いつの出店日</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
            {([
              { v: 'upcoming' as const, label: 'これからの出店日だけ', note: 'ふだんはこちら' },
              { v: 'past' as const, label: '終わった日も含む', note: 'お礼やご案内など' },
            ]).map(o => (
              <label key={o.v} style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', border: '1.5px solid', borderColor: bcScope === o.v ? '#F5A623' : '#E2E8F0', background: bcScope === o.v ? '#FFF8E1' : '#fff', color: bcScope === o.v ? '#B45309' : '#475569', borderRadius: '8px', padding: '9px 14px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', minHeight: '40px' }}>
                <input type='radio' name='bc-scope' checked={bcScope === o.v} onChange={() => { setBcScope(o.v); loadBcPreview(bcPlaceId, bcTarget, o.v) }} disabled={bcBusy}
                  style={{ width: '16px', height: '16px' }} />
                {o.label}
                <span style={{ fontWeight: 400, color: '#94A3B8' }}>{o.note}</span>
              </label>
            ))}
          </div>

          {/* 送る前に、誰に届くかを出す。押してから気づいても取り返せない */}
          {bcPreview && (
            <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '10px 12px', marginBottom: '12px' }}>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#334155', marginBottom: '6px' }}>
                この宛先に届きます（{bcPreview.count}名）
              </div>
              {bcPreview.count === 0 ? (
                <div style={{ fontSize: '12px', color: '#DC2626' }}>該当する出店者がいません。条件を見直してください。</div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {bcPreview.recipients.map((r, i) => (
                    <span key={i} title={r.days.join('、')}
                      style={{ fontSize: '11px', color: '#475569', background: '#fff', border: '1px solid #E2E8F0', borderRadius: '999px', padding: '4px 10px' }}>
                      {r.name}
                      {r.days.length > 0 && <span style={{ color: '#94A3B8' }}>（{r.days[0].slice(5).replace('-', '/')}{r.days.length > 1 ? ' ほか' + (r.days.length - 1) + '日' : ''}）</span>}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={{ fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>本文</div>
          <textarea value={bcBody} onChange={e => setBcBody(e.target.value)} rows={5} disabled={bcBusy}
            placeholder={'例：\n当日の搬入は8:30〜9:00です。北側のゲートからお入りください。\n担当は佐藤（090-0000-0000）です。'}
            style={{ width: '100%', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '10px 12px', fontSize: '16px', color: '#1a1a1a', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.7 }} />
          <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>{bcBody.length} / 2,000文字</div>

          {bcErr && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 12px', fontSize: '12.5px', color: '#DC2626', marginTop: '12px', lineHeight: 1.8 }}>{bcErr}</div>
          )}
          {bcDone && (
            <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '8px', padding: '10px 12px', fontSize: '12.5px', color: '#16A34A', marginTop: '12px', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{bcDone}</div>
          )}

          <div style={{ marginTop: '14px' }}>
            <button type='button' onClick={sendBroadcast} disabled={bcBusy || !bcPlaceId || !bcBody.trim() || bcPreview?.count === 0}
              style={{ background: (bcBusy || !bcPlaceId || !bcBody.trim() || bcPreview?.count === 0) ? '#ccc' : '#F5A623', color: '#fff', border: 'none', borderRadius: '8px', padding: '11px 22px', fontSize: '13px', fontWeight: 800, cursor: (bcBusy || !bcPlaceId || !bcBody.trim() || bcPreview?.count === 0) ? 'not-allowed' : 'pointer', minHeight: '44px', fontFamily: 'inherit' }}>
              {bcBusy ? '送信中…' : bcPreview ? bcPreview.count + '名へ送る' : 'この内容で送る'}
            </button>
            <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '8px', lineHeight: 1.7 }}>
              出店者にはメールでもお知らせが届きます。送ったあと60分以内なら、下のやり取りから1通ずつ取り消せます（人数分ぶん押す必要があります）。
            </div>
          </div>
        </div>
      )}
      <div className='admin-two-col' style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', display: 'grid', gridTemplateColumns: '280px 1fr', minHeight: '520px', overflow: 'hidden' }}>
        <div style={{ borderRight: '1px solid #E2E8F0', minWidth: 0 }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid #E2E8F0', fontWeight: '700', color: '#F5A623', background: '#FFF8E1' }}>申込一覧</div>
          {loading ? (
            <div style={{ padding: '24px 14px', textAlign: 'center', color: '#999', fontSize: '12px' }}>読み込み中...</div>
          ) : threads.length === 0 ? (
            <div style={{ padding: '24px 14px', textAlign: 'center', color: '#999', fontSize: '12px', lineHeight: 1.8 }}>
              まだ申込がありません。<br />出店者から申込が入ると、ここでやり取りできます。
            </div>
          ) : threads.map(t => {
            const st = STATUS_LABEL[t.status] || { label: t.status, color: '#64748B', bg: '#F1F5F9' }
            const on = appId === t.applicationId
            return (
              <div key={t.applicationId} onClick={() => openThread(t.applicationId)}
                style={{ padding: '12px 14px', borderBottom: '1px solid #F1F5F9', cursor: 'pointer', background: on ? '#FFF8E1' : '#fff', borderLeft: on ? '3px solid #F5A623' : '3px solid transparent' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                  <span style={{ fontSize: '13px', fontWeight: '700', color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.sellerName}</span>
                  <span style={{ background: st.bg, color: st.color, borderRadius: '4px', padding: '1px 6px', fontSize: '10px', fontWeight: '700', flexShrink: 0 }}>{st.label}</span>
                </div>
                <div style={{ fontSize: '11px', color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {t.placeTitle}{t.applyDate ? '（' + t.applyDate.slice(5).replace('-', '/') + '）' : ''}
                </div>
                <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.lastBody}</div>
              </div>
            )
          })}
        </div>
        <div style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {current ? (
            <>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid #E2E8F0', fontWeight: '700', color: '#1a1a1a' }}>
                {current.sellerName}
                <span style={{ fontSize: '11px', fontWeight: '400', color: '#64748B', marginLeft: '8px' }}>{current.placeTitle}</span>
              </div>
              <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {dbMessages.length === 0 ? (
                  <div style={{ color: '#94A3B8', textAlign: 'center', marginTop: '40px' }}>まだメッセージがありません</div>
                ) : dbMessages.map(m => {
                  const mine = m.sender_id === myId
                  return (
                    <div key={m.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '70%' }}>
                      <div style={{ background: mine ? '#F5A623' : '#F1F5F9', color: mine ? '#fff' : '#1a1a1a', padding: '9px 14px', borderRadius: '12px', fontSize: '13px', width: 'fit-content', marginLeft: mine ? 'auto' : undefined, whiteSpace: 'pre-wrap' }}>
                        {m.body && <div>{m.body}</div>}
                        {m.file_url && renderAttachment(m.file_url, mine)}
                      </div>
                      {mine && (
                        <div style={{ textAlign: 'right', marginTop: '3px' }}>
                          <button onClick={() => retractMessage(m.id)} style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '11px', cursor: 'pointer', padding: '2px 4px', textDecoration: 'underline' }}>送信を取り消す</button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
              {msgFile ? (
                <div style={{ padding: '8px 16px', borderTop: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '8px', background: '#FFF7ED' }}>
                  <span style={{ fontSize: '12px', color: '#9A3412', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📎 {msgFile.name}</span>
                  <button onClick={() => setMsgFile(null)} style={{ background: 'none', border: 'none', color: '#9A3412', cursor: 'pointer', fontSize: '14px', fontWeight: '700' }}>✕</button>
                </div>
              ) : null}
              <div style={{ padding: '12px 16px', borderTop: msgFile ? 'none' : '1px solid #E2E8F0', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <label htmlFor="host-msg-file-input" style={{ cursor: msgUploading ? 'not-allowed' : 'pointer', fontSize: '20px', opacity: msgUploading ? 0.4 : 1, userSelect: 'none' }}>📎</label>
                <input id="host-msg-file-input" type="file" accept="image/*,application/pdf" style={{ display: 'none' }} disabled={msgUploading} onChange={e => { const file = e.target.files?.[0]; if (file) setMsgFile(file); e.currentTarget.value = '' }} />
                <textarea value={msg} onChange={e => setMsg(e.target.value)} rows={2} onKeyDown={e => {
                        if (e.key !== 'Enter' || e.shiftKey) return
                        // 日本語変換の確定Enterでは送信しない（変換中は無視する）
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const ne = e.nativeEvent as any
                        if (ne?.isComposing || ne?.keyCode === 229) return
                        // 1回目のEnterは改行。すでに末尾が改行なら2回目とみなして送信する
                        if (msg.endsWith('\n')) { e.preventDefault(); sendMessage() }
                      }} placeholder='メッセージを入力...（Enterで改行／2回続けて押すと送信）' disabled={msgUploading} style={{ flex: 1, border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', outline: 'none', color: '#1a1a1a', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }} />
                <button onClick={sendMessage} disabled={msgUploading} style={{ background: msgUploading ? '#ccc' : '#F5A623', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 16px', fontSize: '13px', fontWeight: '700', cursor: msgUploading ? 'not-allowed' : 'pointer' }}>{msgUploading ? '...' : '送信'}</button>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: '13px', padding: '24px', textAlign: 'center' }}>
              {threads.length === 0 ? '申込が入るとここに表示されます' : '左のリストから案件を選んでください'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
