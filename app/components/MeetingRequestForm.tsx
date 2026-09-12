'use client'
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { track } from '../lib/ga'
import { CONTACT_SOURCES, CONTACT_HISTORIES, asksRepName } from '../lib/signupSource'

// 打ち合わせ・ご相談の申し込みフォーム。
// 会員登録の前でも相談できるよう、ログインしていなくても送信できる。
// 募集者ダッシュボードと「お店を呼びたい方へ」の両方から使う。

const METHODS = [
  { v: 'zoom', l: 'Zoomを希望' },
  { v: 'in_person', l: '直接お会いしたい' },
  { v: 'both', l: 'どちらでも可' },
]

const empty = {
  name: '', company: '', email: '', phone: '', method: 'both', preferredDates: '', message: '',
  // どこ経由で来たか。相談はお問い合わせより成約に近いので、
  // こちらのほうが経路を知る価値が高い
  foundVia: '', foundNote: '',
  // 初めての方か、すでに関係がある方か。社内の引き継ぎ先が変わる
  contactHistory: '', repName: '',
}

export default function MeetingRequestForm({
  onClose,
  compact = false,
  source = 'unknown',
}: {
  onClose?: () => void
  compact?: boolean
  /** どのページに置かれたフォームか（計測用） */
  source?: string
}) {
  const [form, setForm] = useState(empty)
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')

  const send = async () => {
    setErr('')
    if (!form.name.trim()) { setErr('ご担当者名を入力してください'); return }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) { setErr('メールアドレスをご確認ください'); return }
    if (!form.foundVia) { setErr('「当サービスを知ったきっかけ」をお選びください'); return }
    if (!form.contactHistory) { setErr('「弊社とのやり取り」をお選びください'); return }
    setSending(true)
    // ログインしていれば、どのアカウントからの相談か分かるようにIDも送る
    const { data: { user } } = await supabase.auth.getUser()
    const res = await fetch('/api/meeting-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        // 担当者名をたずねない選択に変えたあとも値が残らないよう、ここで落とす
        repName: asksRepName(form.contactHistory) ? form.repName : '',
        hostId: user?.id || null,
      }),
    })
    const j = await res.json()
    setSending(false)
    if (!res.ok) { setErr(j.error || '送信できませんでした'); return }
    setDone(true)
    // どのページ経由の相談かを記録する
    track('soudan_submit', { source, method: form.method })
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

      {/* どこ経由で来たかと、すでに関係がある方かどうか。
          お問い合わせフォーム（app/contact/page.tsx）と同じ選択肢・同じ値。
          値は app/lib/signupSource.ts が唯一の正で、会員登録の
          「何を見て知ったか」とも揃えてある（まとめて数えられるようにするため） */}
      <div style={{ marginBottom: '14px' }}>
        <label style={{ ...label, fontWeight: 700, color: '#1a1a1a', fontSize: '13px', marginBottom: '6px' }}>
          当サービスを知ったきっかけ<span style={{ color: '#DC2626' }}> *</span>
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
          {CONTACT_SOURCES.map(o => (
            <label key={o.value} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '7px 2px', minHeight: '40px', fontSize: '13.5px', color: '#1a1a1a' }}>
              <input type='radio' name='mrFoundVia' value={o.value}
                checked={form.foundVia === o.value}
                onChange={() => setForm({ ...form, foundVia: o.value })}
                style={{ width: '18px', height: '18px', accentColor: '#1D4ED8', cursor: 'pointer', flex: '0 0 auto' }} />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
        {/* 「その他」の中身が分からないままにならないよう、書ける場所を出す */}
        {form.foundVia === 'other' && (
          <input value={form.foundNote} maxLength={200}
            onChange={e => setForm({ ...form, foundNote: e.target.value })}
            placeholder='どこでお知りになりましたか（任意）'
            style={{ ...input, marginTop: '6px' }} />
        )}
      </div>

      <div style={{ marginBottom: '14px' }}>
        <label style={{ ...label, fontWeight: 700, color: '#1a1a1a', fontSize: '13px', marginBottom: '6px' }}>
          弊社とのやり取り<span style={{ color: '#DC2626' }}> *</span>
        </label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
          {CONTACT_HISTORIES.map(o => (
            <label key={o.value} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '7px 2px', minHeight: '40px', fontSize: '13.5px', color: '#1a1a1a' }}>
              <input type='radio' name='mrHistory' value={o.value}
                checked={form.contactHistory === o.value}
                onChange={() => setForm({ ...form, contactHistory: o.value })}
                style={{ width: '18px', height: '18px', accentColor: '#1D4ED8', cursor: 'pointer', flex: '0 0 auto' }} />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
        {/* すでに関係がある方のときだけ、担当者名の欄を出す。
            分かる場合だけでよいので任意。社内の引き継ぎが早くなる */}
        {asksRepName(form.contactHistory) && (
          <div style={{ marginTop: '6px' }}>
            <input value={form.repName} maxLength={100}
              onChange={e => setForm({ ...form, repName: e.target.value })}
              placeholder='弊社の担当者名（例：山田）' style={input} />
            <div style={{ fontSize: '11.5px', color: '#64748B', marginTop: '5px', lineHeight: 1.7 }}>
              お分かりになる場合のみご記入ください。空欄でも送信できます。
            </div>
          </div>
        )}
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
