'use client'
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import SiteHeader from '../components/SiteHeader'
import SiteFooter from '../components/SiteFooter'

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const [msg, setMsg] = useState('')
  const [done, setDone] = useState(false)

  const handleSend = async () => {
    if (!email.trim()) { setMsg('メールアドレスを入力してください'); return }
    setSending(true); setMsg('')
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: 'https://app.connect-navi.com/reset-password/update',
    })
    if (error) {
      setMsg('送信に失敗しました。時間をおいて再度お試しください。')
      setSending(false)
      return
    }
    setDone(true)
    setSending(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FFF8F0', display: 'flex', flexDirection: 'column' }}>
      <SiteHeader />
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' }}>
      <div style={{ background: '#fff', borderRadius: '16px', padding: '32px 24px', maxWidth: '420px', width: '100%', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#B45309', marginBottom: '8px', textAlign: 'center' }}>パスワードの再設定</h1>

        {done ? (
          <div style={{ textAlign: 'center', marginTop: '16px' }}>
            <p style={{ fontSize: '14px', color: '#333', lineHeight: 1.8 }}>
              ご入力のメールアドレス宛に、パスワード再設定用のメールをお送りしました。メール内のリンクを開いて、新しいパスワードを設定してください。
            </p>
            <p style={{ fontSize: '12px', color: '#888', marginTop: '16px', lineHeight: 1.7 }}>
              メールが届かない場合は、迷惑メールフォルダをご確認ください。数分待っても届かない場合は、メールアドレスをご確認のうえ再度お試しください。
            </p>
          </div>
        ) : (
          <>
            <p style={{ fontSize: '13px', color: '#666', marginBottom: '20px', textAlign: 'center', lineHeight: 1.7 }}>
              ご登録のメールアドレスを入力してください。パスワード再設定用のリンクをお送りします。
            </p>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '6px' }}>メールアドレス</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              style={{ width: '100%', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '12px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', marginBottom: '16px' }}
            />
            {msg && <p style={{ fontSize: '13px', color: '#DC2626', marginBottom: '12px' }}>{msg}</p>}
            <button
              onClick={handleSend}
              disabled={sending}
              style={{ width: '100%', background: sending ? '#F1F5F9' : '#F5A623', color: sending ? '#94A3B8' : '#fff', border: 'none', borderRadius: '8px', padding: '13px', fontSize: '15px', fontWeight: 700, cursor: sending ? 'default' : 'pointer' }}
            >
              {sending ? '送信中...' : '再設定メールを送る'}
            </button>
            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <a href="/login" style={{ fontSize: '13px', color: '#B45309', textDecoration: 'none' }}>ログイン画面に戻る</a>
            </div>
          </>
        )}
      </div>
      </div>
      <SiteFooter />
    </div>
  )
}