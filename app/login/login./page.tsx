'use client'
import Link from 'next/link'
import { useState } from 'react'

export default function LoginPage() {
  const [role, setRole] = useState<'seller' | 'host'>('seller')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)

  return (
    <div style={{ minHeight: '100vh', background: '#FFF9E6' }}>
      {/* ナビ */}
      

      {/* オレンジバー */}
      

      <div style={{ maxWidth: '480px', margin: '48px auto', padding: '0 16px' }}>
        <div style={{ background: '#fff', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '1px solid #E5E7EB' }}>
          {/* ヘッダー */}
          <div style={{ background: '#FFF8E1', borderBottom: '1px solid #FFE0A0', padding: '20px 28px' }}>
            <h1 style={{ fontSize: '20px', fontWeight: '900', color: '#B45309', marginBottom: '4px' }}>🔐 ログイン</h1>
            <p style={{ fontSize: '13px', color: '#888' }}>出店コネクトナビへようこそ</p>
          </div>

          <div style={{ padding: '28px' }}>
            {/* ロール選択 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '20px' }}>
              {[
                { key: 'seller', label: '出店者ログイン', icon: '👤' },
                { key: 'host', label: '募集者ログイン', icon: '🏪' },
              ].map((r) => (
                <button
                  key={r.key}
                  onClick={() => setRole(r.key as 'seller' | 'host')}
                  style={{
                    padding: '12px', borderRadius: '10px', cursor: 'pointer', fontFamily: 'inherit',
                    border: role === r.key ? '2px solid #F5A623' : '2px solid #E5E7EB',
                    background: role === r.key ? '#FFF8E1' : '#fff',
                    fontWeight: '700', fontSize: '13px', color: role === r.key ? '#B45309' : '#666',
                  }}
                >
                  <div style={{ fontSize: '22px', marginBottom: '4px' }}>{r.icon}</div>
                  {r.label}
                </button>
              ))}
            </div>

            {/* メール */}
            <div style={{ marginBottom: '14px' }}>
              <label style={{ fontSize: '12px', fontWeight: '700', color: '#555', display: 'block', marginBottom: '5px' }}>
                メールアドレス <span style={{ color: '#E53E3E', background: '#FFF0F0', padding: '1px 6px', borderRadius: '3px', fontSize: '11px' }}>必須</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@email.com"
                style={{ width: '100%', border: '1.5px solid #E5E7EB', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
              />
            </div>

            {/* パスワード */}
            <div style={{ marginBottom: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: '700', color: '#555', display: 'block', marginBottom: '5px' }}>
                パスワード <span style={{ color: '#E53E3E', background: '#FFF0F0', padding: '1px 6px', borderRadius: '3px', fontSize: '11px' }}>必須</span>
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="パスワードを入力"
                  style={{ width: '100%', border: '1.5px solid #E5E7EB', borderRadius: '8px', padding: '10px 40px 10px 12px', fontSize: '14px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }}
                />
                <button
                  onClick={() => setShowPass(!showPass)}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', color: '#aaa' }}
                >
                  {showPass ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <div style={{ textAlign: 'right', marginBottom: '18px' }}>
              <a href="#" style={{ fontSize: '12px', color: '#3A9BD5', textDecoration: 'none' }}>パスワードをお忘れですか？</a>
            </div>

            {/* ログインボタン */}
            <button
              style={{ width: '100%', background: '#F5A623', color: '#fff', border: 'none', borderRadius: '8px', padding: '14px', fontSize: '15px', fontWeight: '900', cursor: 'pointer', fontFamily: 'inherit', marginBottom: '14px' }}
            >
              ログインする
            </button>

            {/* 区切り */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <div style={{ flex: 1, height: '1px', background: '#E5E7EB' }}></div>
              <span style={{ fontSize: '12px', color: '#aaa' }}>または</span>
              <div style={{ flex: 1, height: '1px', background: '#E5E7EB' }}></div>
            </div>

            {/* Google */}
            <button style={{ width: '100%', background: '#fff', color: '#333', border: '1.5px solid #E5E7EB', borderRadius: '8px', padding: '12px', fontSize: '14px', fontWeight: '500', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Googleでログイン
            </button>

            <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: '#888' }}>
              まだ会員でない方は{' '}
              <Link href="/register" style={{ color: '#B45309', fontWeight: '700', textDecoration: 'none' }}>無料会員登録</Link>
              {' '}へ
            </div>
          </div>
        </div>
      </div>

      <footer style={{ background: '#1E2A3B', color: '#fff', padding: '24px', textAlign: 'center', marginTop: '40px' }}>
        <div style={{ fontWeight: '900', fontSize: '16px', marginBottom: '8px' }}>出店コネクトナビ</div>
        <div style={{ fontSize: '12px', color: '#666' }}>© 2026 出店コネクトナビ All Rights Reserved.</div>
      </footer>
    </div>
  )
}
