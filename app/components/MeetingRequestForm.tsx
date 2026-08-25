'use client'
import { useState } from 'react'
import { supabase } from '../lib/supabase'

// 打ち合わせ・ご相談の申し込みフォーム。
// 会員登録の前でも相談できるよう、ログインしていなくても送信できる。
// 募集者ダッシュボードと「お店を呼びたい方へ」の両方から使う。

const METHODS = [
  { v: 'zoom', l: 'Zoomを希望' },
  { v: 'in_person', l: '直接お会いしたい' },
  { v: 'both', l: 'どちらでも可' },
]

const empty = { name: '', company: '', email: '', phone: '', method: 'both', preferredDates: '', message: '' }

export default function MeetingRequestForm({
  onClose,
  compact = false,
}: {
  onClose?: () => void
  compact?: boolean
}) {
  const [form, setForm] = useState(empty)
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')

  const send = async () => {
    setErr('')
    if (!form.name.trim()) { setErr('ご担当者名を入力してください'); return }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) { setErr('メールアドレスをご確認ください'); return }
    setSending(true)
    // ログインしていれば、どのアカウントからの相談か分かるようにIDも送る
    const { data: { user } } = await supabase.auth.getUser()
    const res = await fetch('/api/meeting-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, hostId: user?.id || null }),
    })
    const j = await res.json()
    setSending(false)
    if (!res.ok) { setErr(j.error || '送信できませんでした'); return }
    setDone(true)
  }

  const input: React.CSSProperties = {
    width: '100%', border: '1.5px solid #E2E8F0', borderRadius: '8px',
    padding: '10px 12px', fontSize: '14px', boxSizing: 'border-box', color: '#1a1a1a',
  }
  const label: React.CSSProperties = { fontSize: '12px', color: '#64748B', display: 'block', marginBottom: '4px' }

  if (done) {
    return (
      <div style={{ textAlign: 'center', padding: '20px 0' }}>
        <div style={{ fontSize: '16px', fontWeight: 900, color: '#16A34A', marginBottom: '10px' }}>お申し込みを受け付けました</div>
        <p style={{ fontSize: '14px', color: '#555', lineHeight: 1.9, marginBottom: '18px' }}>
          担当者より、ご記入のご連絡先へご連絡いたします。<br />
          お時間をいただく場合がございますのでご了承ください。
        </p>
        {onClose && (
          <button onClick={() => { setDone(false); setForm(empty); onClose() }}
            style={{ background: '#F5A623', color: '#fff', border: 'none', borderRadius: '8px', padding: '11px 28px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>
            閉じる
          </button>
        )}
      </div>
    )
  }

  return (
    <div>
      {!compact && (
        <p style={{ fontSize: '13px', color: '#64748B', lineHeight: 1.9, marginBottom: '16px' }}>
          会員登録の前でもご相談いただけます。「呼べるかどうか分からない」「費用感を知りたい」といった段階でも構いません。担当者より、条件やスケジュールをご一緒に整理いたします。
        </p>
      )}

      <div style={{ marginBottom: '16px' }}>
        <label style={{ fontSize: '13px', fontWeight: 700, color: '#1a1a1a', display: 'block', marginBottom: '8px' }}>打ち合わせの方法</label>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {METHODS.map(o => (
            <label key={o.v} style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: 'pointer',
              border: form.method === o.v ? '2px solid #1D4ED8' : '1.5px solid #E2E8F0',
              background: form.method === o.v ? '#EFF6FF' : '#fff',
              borderRadius: '999px', padding: '9px 18px', fontSize: '13px', color: '#1a1a1a',
            }}>
              <input type='radio' name='meetingMethod' checked={form.method === o.v}
                onChange={() => setForm({ ...form, method: o.v })} style={{ accentColor: '#1D4ED8' }} />
              {o.l}
            </label>
          ))}
        </div>
      </div>

      <div className='form-grid-2' style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
        {[
          { k: 'name', l: 'ご担当者名', ph: '例：山田 太郎', req: true },
          { k: 'company', l: '会社・施設名', ph: '例：株式会社◯◯' },
          { k: 'email', l: 'メールアドレス', ph: '例：info@example.com', req: true },
          { k: 'phone', l: '電話番号', ph: '例：03-1234-5678' },
        ].map(f => (
          <div key={f.k}>
            <label style={label}>{f.l}{f.req && <span style={{ color: '#DC2626' }}> *</span>}</label>
            <input value={(form as Record<string, string>)[f.k]}
              onChange={e => setForm({ ...form, [f.k]: e.target.value })}
              placeholder={f.ph} style={input} />
          </div>
        ))}
      </div>

      <div style={{ marginBottom: '12px' }}>
        <label style={label}>ご希望の日時（任意）</label>
        <input value={form.preferredDates} onChange={e => setForm({ ...form, preferredDates: e.target.value })}
          placeholder='例：平日の午後、9/10以降など' style={input} />
      </div>
      <div style={{ marginBottom: '16px' }}>
        <label style={label}>ご相談内容（任意）</label>
        <textarea value={form.message} onChange={e => setForm({ ...form, message: e.target.value })} rows={3}
          placeholder='例：商業施設の一角でキッチンカーを呼べるか相談したい'
          style={{ ...input, resize: 'vertical', fontFamily: 'inherit' }} />
      </div>

      {err && <div style={{ color: '#DC2626', fontSize: '13px', marginBottom: '10px' }}>{err}</div>}
      <button onClick={send} disabled={sending}
        style={{ width: '100%', background: sending ? '#ccc' : '#1D4ED8', color: '#fff', border: 'none', borderRadius: '8px', padding: '14px', fontSize: '15px', fontWeight: 900, cursor: sending ? 'not-allowed' : 'pointer' }}>
        {sending ? '送信中...' : 'この内容で相談する'}
      </button>
      <p style={{ fontSize: '11px', color: '#94A3B8', textAlign: 'center', marginTop: '10px', lineHeight: 1.7 }}>
        ご相談は無料です。この時点で掲載が確定するものではありません。
      </p>
    </div>
  )
}
