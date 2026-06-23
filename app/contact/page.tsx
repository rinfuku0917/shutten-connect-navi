'use client'
import Nav from '../components/Nav'
import Link from 'next/link'
import { useState } from 'react'

export default function ContactPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [errMsg, setErrMsg] = useState('')

  const submit = async () => {
    if (!name.trim() || !email.trim() || !message.trim()) {
      setErrMsg('すべての項目を入力してください')
      setStatus('error')
      return
    }
    setStatus('sending')
    setErrMsg('')
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrMsg(data.error || '送信に失敗しました')
        setStatus('error')
        return
      }
      setStatus('done')
      setName(''); setEmail(''); setMessage('')
    } catch {
      setErrMsg('通信エラーが発生しました')
      setStatus('error')
    }
  }

  const labelStyle: React.CSSProperties = { display: 'block', fontSize: '14px', fontWeight: 700, color: '#92400E', marginBottom: '6px' }
  const inputStyle: React.CSSProperties = { width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #E5D5B8', fontSize: '15px', boxSizing: 'border-box', background: '#fff', color: '#1a1a1a' }

  return (
    <div style={{ minHeight: '100vh', background: '#FFF9E6', width: '100%', maxWidth: '100vw', overflowX: 'hidden' }}>
      <Nav />

      <div style={{ background: 'linear-gradient(rgba(245,166,35,0.78), rgba(232,130,12,0.88)), url(/hero-top.png) center/cover no-repeat', padding: '72px 16px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 'clamp(24px,5vw,36px)', fontWeight: 900, color: '#fff', margin: 0, textShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>お問い合わせ</h1>
        <p style={{ fontSize: '14px', color: '#fff', marginTop: '10px', opacity: 0.95, textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>ご質問・ご相談はこちらから</p>
      </div>

      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '40px 16px' }}>
        {status === 'done' ? (
          <div style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', padding: '40px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
            <h2 style={{ fontSize: '20px', fontWeight: 900, color: '#1a1a1a', marginBottom: '12px' }}>送信が完了しました</h2>
            <p style={{ fontSize: '14px', color: '#555', lineHeight: 1.8, marginBottom: '24px' }}>お問い合わせありがとうございます。<br />内容を確認のうえ、担当者よりご連絡いたします。</p>
            <Link href="/" style={{ display: 'inline-block', padding: '12px 28px', borderRadius: '10px', background: '#F5A623', color: '#fff', fontSize: '14px', fontWeight: 700, textDecoration: 'none' }}>トップへ戻る</Link>
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', padding: '32px 24px' }}>
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>お名前 <span style={{ color: '#DC2626' }}>*</span></label>
              <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="山田 太郎" />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>メールアドレス <span style={{ color: '#DC2626' }}>*</span></label>
              <input style={inputStyle} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="example@email.com" />
            </div>
            <div style={{ marginBottom: '24px' }}>
              <label style={labelStyle}>お問い合わせ内容 <span style={{ color: '#DC2626' }}>*</span></label>
              <textarea style={{ ...inputStyle, minHeight: '140px', resize: 'vertical', fontFamily: 'inherit' }} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="お問い合わせ内容をご記入ください" />
            </div>

            {status === 'error' && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '12px 14px', marginBottom: '20px', fontSize: '13px', color: '#DC2626' }}>{errMsg}</div>
            )}

            <button onClick={submit} disabled={status === 'sending'} style={{ width: '100%', padding: '14px', borderRadius: '10px', background: status === 'sending' ? '#E5B870' : '#F5A623', color: '#fff', fontSize: '16px', fontWeight: 700, border: 'none', cursor: status === 'sending' ? 'default' : 'pointer' }}>
              {status === 'sending' ? '送信中...' : '送信する'}
            </button>

            <p style={{ fontSize: '12px', color: '#999', textAlign: 'center', marginTop: '16px' }}>
              LINEでのお問い合わせは <a href="https://lin.ee/RjwxqXf" target="_blank" rel="noopener noreferrer" style={{ color: '#E8820C', fontWeight: 700 }}>こちら</a>
            </p>
          </div>
        )}
      </div>

      <div style={{ background: '#F5A623', padding: '20px', textAlign: 'center', marginTop: '40px' }}>
        <div style={{ fontSize: '12px', color: '#fff' }}>© 2026 出店コネクトナビ All Rights Reserved.</div>
      </div>
    </div>
  )
}
