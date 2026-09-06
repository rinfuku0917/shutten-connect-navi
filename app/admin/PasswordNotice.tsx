'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// 旧サイトからの移行組へ、パスワード設定のご案内を送る画面。
//
// 本物の会員へメールが飛ぶので、押した回数だけ送る作りにしている。
// 定期実行からは呼ばれない。自動では1通も出ない。
//
// 進め方を画面の順番でも縛っている。
//   ① 誰に送るのかを見る（人数と、次に届く10人）
//   ② 文面を読む
//   ③ 自分あてにテスト送信して、実物を確かめる
//   ④ 100通ずつ送る

type Summary = { neverLoggedIn: number, alreadySent: number, remaining: number, emailMismatch: number }
type Target = { shopName: string, email: string, mismatch: boolean }

const CARD: React.CSSProperties = {
  background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '18px', marginBottom: '16px',
}

export default function PasswordNotice({ onEditMail }: { onEditMail?: (key: string) => void } = {}) {
  const [summary, setSummary] = useState<Summary | null>(null)
  const [preview, setPreview] = useState<Target[]>([])
  const [mailText, setMailText] = useState('')
  const [mailSubject, setMailSubject] = useState('')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const [testTo, setTestTo] = useState('')
  const [testBusy, setTestBusy] = useState(false)
  const [testDone, setTestDone] = useState('')

  const [sendBusy, setSendBusy] = useState(false)
  const [result, setResult] = useState<{ sent: number, failed: number, remaining: number, errors: string[] } | null>(null)
  // 送信の確認。押し間違いで100通飛ぶことがないよう、二段にする
  const [confirming, setConfirming] = useState(false)

  const token = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || ''
  }

  const load = async () => {
    setLoading(true)
    setErr('')
    const t = await token()
    if (!t) { setErr('ログインの有効期限が切れています。画面を読み込み直してください。'); setLoading(false); return }
    const res = await fetch('/api/admin/password-notice', { headers: { Authorization: 'Bearer ' + t } })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) { setErr(j.error || '読み込みに失敗しました'); setLoading(false); return }
    setSummary(j.summary)
    setPreview(j.preview || [])
    setMailText(j.sampleMail?.text || '')
    setMailSubject(j.sampleMail?.subject || '')
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const sendTest = async () => {
    if (!testTo.trim() || testBusy) return
    setTestBusy(true)
    setTestDone('')
    setErr('')
    const t = await token()
    const res = await fetch('/api/admin/password-notice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
      body: JSON.stringify({ mode: 'test', email: testTo.trim() }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) { setErr(j.error || 'テスト送信に失敗しました'); setTestBusy(false); return }
    setTestDone(testTo.trim() + ' へ送りました。受信箱をご確認ください。')
    setTestBusy(false)
  }

  const sendBatch = async () => {
    if (sendBusy) return
    setSendBusy(true)
    setErr('')
    setConfirming(false)
    const t = await token()
    const res = await fetch('/api/admin/password-notice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
      body: JSON.stringify({ mode: 'send', limit: 100 }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) { setErr(j.error || '送信に失敗しました'); setSendBusy(false); return }
    setResult({ sent: j.sent || 0, failed: j.failed || 0, remaining: j.remaining || 0, errors: j.errors || [] })
    setSendBusy(false)
    await load()
  }

  const num = (n: number) => n.toLocaleString()

  return (
    <>
      <div style={{ ...CARD, borderColor: '#FCA5A5', background: '#FEF2F2' }}>
        <div style={{ fontWeight: 700, fontSize: '14px', color: '#B91C1C', marginBottom: '6px' }}>
          本物の会員にメールが届きます
        </div>
        <div style={{ fontSize: '12.5px', color: '#7F1D1D', lineHeight: 1.9 }}>
          この画面のボタンを押したときだけ送信されます。自動では1通も出ません。<br />
          1回に送れるのは100通までです。送信元のドメインは申込通知・請求通知と同じで、
          一度に大量に送ると不達が増え、運用中のメールまで届かなくなるためです。
          日を分けてお送りください。
        </div>
      </div>

      {err && (
        <div style={{ ...CARD, borderColor: '#FCA5A5', background: '#FEF2F2', color: '#B91C1C', fontSize: '13px' }}>{err}</div>
      )}

      {/* ① 誰に送るのか */}
      <div style={CARD}>
        <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '12px', color: '#B45309' }}>① 送る相手</div>
        {loading && <div style={{ fontSize: '13px', color: '#94A3B8' }}>読み込み中…</div>}
        {summary && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: '10px', marginBottom: '14px' }}>
              {[
                { label: '一度もログインなし', v: summary.neverLoggedIn, color: '#334155' },
                { label: '案内を送った', v: summary.alreadySent, color: '#16A34A' },
                { label: 'まだ送っていない', v: summary.remaining, color: '#B45309' },
              ].map(s => (
                <div key={s.label} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '12px 14px' }}>
                  <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '3px' }}>{s.label}</div>
                  <div style={{ fontSize: '20px', fontWeight: 900, color: s.color }}>{num(s.v)}<span style={{ fontSize: '12px', fontWeight: 400, color: '#94A3B8' }}> 人</span></div>
                </div>
              ))}
            </div>

            {summary.emailMismatch > 0 && (
              <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: '#92400E', lineHeight: 1.8, marginBottom: '12px' }}>
                <strong>{num(summary.emailMismatch)}人</strong>は、会員情報のアドレスと、ログイン用のアドレスが違います。
                ご案内は会員情報のアドレスへ届きますが、再設定のメールはログイン用のアドレスへ届きます。
                この方たちは案内を読んでも受け取れない可能性があります。個別の確認が要ります。
              </div>
            )}

            <div style={{ fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>次に届く方（先頭10人）</div>
            <div style={{ border: '1px solid #E2E8F0', borderRadius: '8px', overflow: 'hidden' }}>
              {preview.length === 0 && <div style={{ padding: '12px', fontSize: '13px', color: '#94A3B8' }}>送る相手がいません。</div>}
              {preview.map((p, i) => (
                <div key={p.email + i} style={{ display: 'flex', gap: '10px', padding: '8px 12px', borderBottom: i < preview.length - 1 ? '1px solid #F1F5F9' : 'none', fontSize: '12.5px', flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, color: '#1a1a1a', minWidth: '140px' }}>{p.shopName || '（屋号なし）'}</span>
                  {/* メールアドレスは半角英数が続いて途中で改行できないため、
                      狭い画面では枠（overflow:hidden）の外へ出て末尾が切れてしまう。
                      kv-value で途中の折り返しを許し、送り先を最後まで読めるようにする */}
                  <span className='kv-value' style={{ color: '#64748B' }}>{p.email}</span>
                  {p.mismatch && <span style={{ color: '#B45309', fontSize: '11px' }}>※ログイン用のアドレスと違います</span>}
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* ② 文面 */}
      <div style={CARD}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '10px' }}>
          <div style={{ fontWeight: 700, fontSize: '14px', color: '#B45309' }}>② お送りする文面</div>
          {onEditMail && (
            <button type='button' onClick={() => onEditMail('password-notice')}
              style={{ background: '#fff', color: '#1D4ED8', border: '1px solid #BFDBFE', borderRadius: '8px', padding: '7px 14px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', minHeight: '34px' }}>
              文面を編集する
            </button>
          )}
        </div>
        <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '8px' }}>件名：{mailSubject}</div>
        <pre style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '14px', fontSize: '12.5px', color: '#1a1a1a', lineHeight: 1.9, whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'inherit' }}>{mailText}</pre>
        <div style={{ fontSize: '11.5px', color: '#94A3B8', marginTop: '8px', lineHeight: 1.8 }}>
          「ログインできていません」とは書いていません。絞り込みをすり抜けた方に届いても、
          事実に反せず、害が出ないようにするためです。文面を変えたい場合はお申しつけください。
        </div>
      </div>

      {/* ③ テスト送信 */}
      <div style={CARD}>
        <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '10px', color: '#B45309' }}>③ まず自分あてに送って確かめる</div>
        <div style={{ fontSize: '12.5px', color: '#64748B', marginBottom: '10px', lineHeight: 1.8 }}>
          実物と同じ文面が届きます（件名の先頭に [テスト] が付きます）。会員には届きません。記録にも残りません。
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <input type='email' value={testTo} onChange={e => setTestTo(e.target.value)} placeholder='送り先のメールアドレス'
            style={{ flex: '1 1 240px', minWidth: 0, border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
          <button onClick={sendTest} disabled={testBusy || !testTo.trim()}
            style={{ background: (testBusy || !testTo.trim()) ? '#ccc' : '#3A9BD5', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 20px', fontSize: '13px', fontWeight: 700, cursor: (testBusy || !testTo.trim()) ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
            {testBusy ? '送信中…' : 'テスト送信'}
          </button>
        </div>
        {testDone && <div style={{ marginTop: '8px', fontSize: '12.5px', color: '#16A34A', fontWeight: 700 }}>{testDone}</div>}
      </div>

      {/* ④ 本番送信 */}
      <div style={{ ...CARD, borderColor: '#FDE68A', background: '#FFFDF8' }}>
        <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '10px', color: '#B45309' }}>④ 会員へ送る（100通ずつ）</div>
        <div style={{ fontSize: '12.5px', color: '#64748B', marginBottom: '12px', lineHeight: 1.8 }}>
          押すたびに、まだ送っていない方の先頭から100人へ送ります。
          同じ方へ二度は届きません（送った記録が残ります）。
        </div>

        {!confirming && (
          <button onClick={() => setConfirming(true)} disabled={sendBusy || !summary || summary.remaining === 0}
            style={{ background: (sendBusy || !summary || summary.remaining === 0) ? '#ccc' : '#F5A623', color: '#fff', border: 'none', borderRadius: '8px', padding: '11px 24px', fontSize: '14px', fontWeight: 900, cursor: (sendBusy || !summary || summary.remaining === 0) ? 'not-allowed' : 'pointer' }}>
            {summary && summary.remaining === 0 ? '送る相手がいません' : '100通を送る'}
          </button>
        )}

        {confirming && summary && (
          <div style={{ background: '#fff', border: '2px solid #FCA5A5', borderRadius: '10px', padding: '14px 16px' }}>
            <div style={{ fontSize: '13.5px', color: '#B91C1C', fontWeight: 700, marginBottom: '4px' }}>
              {num(Math.min(100, summary.remaining))}人の会員へ、いまメールを送ります。
            </div>
            <div style={{ fontSize: '12.5px', color: '#7F1D1D', marginBottom: '12px', lineHeight: 1.8 }}>
              送ったあとに取り消すことはできません。テスト送信で文面を確かめましたか？
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button onClick={sendBatch} disabled={sendBusy}
                style={{ background: sendBusy ? '#ccc' : '#DC2626', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 22px', fontSize: '13px', fontWeight: 900, cursor: sendBusy ? 'not-allowed' : 'pointer' }}>
                {sendBusy ? '送信中…（閉じないでください）' : 'はい、送ります'}
              </button>
              <button onClick={() => setConfirming(false)} disabled={sendBusy}
                style={{ background: '#fff', color: '#64748B', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '10px 20px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                やめる
              </button>
            </div>
          </div>
        )}

        {result && (
          <div style={{ marginTop: '14px', background: '#fff', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '12px 14px', fontSize: '13px', lineHeight: 1.9 }}>
            <div><strong style={{ color: '#16A34A' }}>{num(result.sent)}通</strong> 送りました。</div>
            {result.failed > 0 && <div><strong style={{ color: '#DC2626' }}>{num(result.failed)}通</strong> 失敗しました（次回もう一度、対象に入ります）。</div>}
            <div style={{ color: '#64748B' }}>残り <strong>{num(result.remaining)}人</strong></div>
            {result.errors.length > 0 && (
              <ul style={{ margin: '6px 0 0', paddingLeft: '18px', fontSize: '12px', color: '#B45309' }}>
                {result.errors.map((e, i) => <li key={i}>{e}</li>)}
              </ul>
            )}
          </div>
        )}
      </div>
    </>
  )
}
