'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// 運営あて通知メールの宛先。
//
// これまで通知はすべて info@connect-navi.com にコード直書きで送られていて、
// 担当者が自分のアドレスでも受け取るには、メールサーバー側で転送を
// 設定してもらうしかなかった。それは製品の外の話でこちらから手が出せず、
// 「転送を設定してください」「どこで設定するのですか」というやり取りが
// 何度も続いていた。ここに足せば、その人に直接届く。

type Row = {
  id: string
  email: string
  label: string | null
  on_contact: boolean
  on_member: boolean
  on_payment: boolean
  on_cancel: boolean
  active: boolean
  created_at: string
}

// 表の列と、画面に出す名前
const KINDS: { key: 'on_contact' | 'on_member' | 'on_payment' | 'on_cancel'; label: string; note: string }[] = [
  { key: 'on_contact', label: 'お問い合わせ', note: 'サイトのお問い合わせフォームから届いたとき' },
  { key: 'on_member', label: '新しい登録', note: '出店者・募集者が新しく登録したとき' },
  { key: 'on_payment', label: '入金の報告', note: '出店者が振込を報告したとき' },
  { key: 'on_cancel', label: '出店の取消し', note: '承認済みの出店が取り消されたとき' },
]

const FIXED = 'info@connect-navi.com'

export default function NotifyRecipients() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [needsSetup, setNeedsSetup] = useState(false)
  const [msg, setMsg] = useState('')
  const [open, setOpen] = useState(false)
  const [newEmail, setNewEmail] = useState('')
  const [newLabel, setNewLabel] = useState('')
  const [busy, setBusy] = useState(false)

  const call = useCallback(async (body: Record<string, unknown>) => {
    const { data: { session } } = await supabase.auth.getSession()
    const t = session?.access_token
    if (!t) { setErr('ログインの有効期限が切れています。読み込み直してください。'); return null }
    // 通信そのものが失敗したとき（電波が切れた等）に、画面が「追加中…」や
    // 「読み込み中…」のまま固まらないように、ここで受け止める
    let res: Response
    try {
      res = await fetch('/api/admin/notify-recipients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
        body: JSON.stringify(body),
      })
    } catch {
      setErr('通信エラーです。電波の状態を確認して、もう一度お試しください。')
      return null
    }
    const j = await res.json().catch(() => ({}))
    if (!res.ok) {
      if (j.needsSetup) { setNeedsSetup(true); setErr(''); return null }
      setErr(j.error || 'うまくいきませんでした')
      return null
    }
    setNeedsSetup(false)
    return j
  }, [])

  const load = useCallback(async (clearErr = true) => {
    setLoading(true)
    const j = await call({ action: 'list' })
    if (j) { setRows(j.items || []); if (clearErr) setErr('') }
    setLoading(false)
  }, [call])

  useEffect(() => { load() }, [load])

  const add = async () => {
    setBusy(true); setMsg('')
    const j = await call({ action: 'add', email: newEmail, label: newLabel })
    setBusy(false)
    if (!j) return
    setNewEmail(''); setNewLabel(''); setErr('')
    setMsg('宛先を追加しました。次の通知から届きます。')
    load()
  }

  const toggle = async (r: Row, field: string, value: boolean) => {
    // 押した瞬間に画面へ反映する。往復を待つとチェックが遅れて見える
    setRows(p => p.map(x => (x.id === r.id ? { ...x, [field]: value } : x)))
    const j = await call({ action: 'update', id: r.id, [field]: value })
    if (j) setErr('')
    // 失敗したらサーバーの値に戻す。理由の表示は消さない
    else load(false)
  }

  // 削除は取り消せないので、二度押しで確定する。
  // window.confirm はアプリ内ブラウザで黙って無視されるため使わない
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const remove = async (r: Row) => {
    if (confirmId !== r.id) { setConfirmId(r.id); return }
    setConfirmId(null)
    setMsg('')
    const j = await call({ action: 'delete', id: r.id })
    if (j) { setErr(''); setMsg(r.email + ' を宛先から外しました。'); load() }
  }

  const box: React.CSSProperties = {
    background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px',
    padding: '16px', marginBottom: '20px',
  }

  return (
    <div style={box}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', flexWrap: 'wrap' }}
      >
        <strong style={{ fontSize: '14px', color: '#1a1a1a' }}>通知メールの宛先</strong>
        <span style={{ fontSize: '12px', color: '#64748B' }}>
          {loading ? '読み込み中…' : err || needsSetup ? FIXED : `${FIXED} ＋ ${rows.length}件`}
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: '12px', color: '#F5A623', fontWeight: 700 }}>{open ? '閉じる ▲' : '開く ▼'}</span>
      </div>

      {!open && (
        <div style={{ fontSize: '12px', color: err ? '#DC2626' : '#64748B', marginTop: '8px', lineHeight: 1.7 }}>
          {err
            ? '読み込めませんでした：' + err
            : needsSetup
              ? '準備がもう1つ必要です。開いて手順をご確認ください。'
              : '運営あてのお知らせを、ご自分のメールアドレスでも受け取れます。メールの転送設定は要りません。'}
        </div>
      )}

      {open && (
        <div style={{ marginTop: '14px' }}>
          <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '10px', padding: '12px 14px', fontSize: '13px', color: '#1D4ED8', lineHeight: 1.8, marginBottom: '14px' }}>
            お問い合わせや新規登録のお知らせは、これまで {FIXED} だけに届いていました。<br />
            ここにご自分のメールアドレスを足すと、同じお知らせがそのアドレスにも直接届きます。<br />
            <strong>メールの転送設定は必要ありません。</strong>
          </div>

          {needsSetup && (
            <div style={{ background: '#FFF8E1', border: '1px solid #FFE082', borderRadius: '10px', padding: '14px', fontSize: '13px', color: '#B45309', lineHeight: 1.9, marginBottom: '14px' }}>
              <strong style={{ display: 'block', marginBottom: '6px' }}>あと1つだけ準備が必要です</strong>
              宛先を保存する場所がまだ作られていません。Supabase の SQL Editor で{' '}
              <code style={{ background: '#fff', border: '1px solid #FDE68A', borderRadius: '4px', padding: '1px 6px' }}>supabase/migrations/20260908_notify_recipients.sql</code>{' '}
              を実行してください。<br />
              <span style={{ fontSize: '12px' }}>※ それまでの間も、通知は {FIXED} にこれまで通り届きます。</span>
            </div>
          )}

          {err && (
            <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', color: '#DC2626', marginBottom: '14px' }}>{err}</div>
          )}
          {msg && (
            <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', color: '#16A34A', marginBottom: '14px' }}>{msg}</div>
          )}

          {/* 固定の宛先。ここは消せないことを見て分かるようにする */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', padding: '10px 12px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', marginBottom: '10px' }}>
            <strong style={{ fontSize: '13px', color: '#1a1a1a' }}>{FIXED}</strong>
            <span style={{ fontSize: '11px', color: '#64748B' }}>会社の代表アドレス／すべての通知が届きます（外せません）</span>
          </div>

          {rows.map(r => (
            <div key={r.id} style={{ border: '1px solid #E2E8F0', borderRadius: '8px', padding: '12px', marginBottom: '10px', opacity: r.active ? 1 : 0.55 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
                <strong style={{ fontSize: '13px', color: '#1a1a1a' }}>{r.email}</strong>
                {r.label && <span style={{ fontSize: '11px', color: '#64748B' }}>（{r.label}）</span>}
                {!r.active && <span style={{ fontSize: '11px', fontWeight: 700, color: '#B45309', background: '#FEF3C7', borderRadius: '4px', padding: '2px 8px' }}>受け取り停止中</span>}
                <div style={{ flex: 1 }} />
                <button onClick={() => toggle(r, 'active', !r.active)} style={{ background: '#fff', color: '#475569', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '5px 12px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                  {r.active ? 'いったん止める' : '受け取りを再開'}
                </button>
                {confirmId === r.id ? (
                  <>
                    <button onClick={() => remove(r)} style={{ background: '#DC2626', color: '#fff', border: 'none', borderRadius: '6px', padding: '5px 12px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>本当に削除する</button>
                    <button onClick={() => setConfirmId(null)} style={{ background: '#fff', color: '#475569', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '5px 12px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>やめる</button>
                  </>
                ) : (
                  <button onClick={() => remove(r)} style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', borderRadius: '6px', padding: '5px 12px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>削除</button>
                )}
              </div>
              <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
                {KINDS.map(k => (
                  <label key={k.key} title={k.note} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#475569', cursor: 'pointer' }}>
                    <input type='checkbox' checked={r[k.key]} onChange={e => toggle(r, k.key, e.target.checked)} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                    {k.label}
                  </label>
                ))}
              </div>
            </div>
          ))}

          {!loading && rows.length === 0 && !needsSetup && !err && (
            <div style={{ fontSize: '12px', color: '#94A3B8', padding: '10px 2px' }}>
              追加の宛先はまだありません。下の欄からメールアドレスを足してください。
            </div>
          )}

          {/* 追加 */}
          <div style={{ borderTop: '1px solid #E2E8F0', marginTop: '14px', paddingTop: '14px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#475569', marginBottom: '8px' }}>宛先を足す</div>
            {/* form にしておくと、ブラウザが type='email' の書式チェックをしてくれる */}
            <form onSubmit={e => { e.preventDefault(); add() }} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <input
                type='email' value={newEmail} onChange={e => setNewEmail(e.target.value)}
                placeholder='メールアドレス' autoComplete='off' required
                pattern='[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}'
                title='半角で name@example.com の形にしてください'
                style={{ flex: '2 1 220px', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '9px 12px', fontSize: '13px' }}
              />
              <input
                type='text' value={newLabel} onChange={e => setNewLabel(e.target.value)}
                placeholder='お名前（任意・例：川上）'
                style={{ flex: '1 1 140px', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '9px 12px', fontSize: '13px' }}
              />
              <button
                type='submit' disabled={busy || !newEmail.trim()}
                style={{ background: busy || !newEmail.trim() ? '#E5B870' : '#F5A623', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 20px', fontSize: '13px', fontWeight: 700, cursor: busy || !newEmail.trim() ? 'default' : 'pointer' }}
              >
                {busy ? '追加中…' : '追加する'}
              </button>
            </form>
            <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '8px', lineHeight: 1.7 }}>
              足したあと、受け取りたい通知の種類をチェックで選べます（はじめは全部オンです）。
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
