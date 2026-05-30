'use client'
import Link from 'next/link'
import { useState } from 'react'

export default function RegisterPage() {
  const [role, setRole] = useState<'seller' | 'host'>('seller')
  const [step, setStep] = useState(1)
  const [showPass, setShowPass] = useState(false)

  return (
    <div style={{ minHeight: '100vh', background: '#FFF9E6' }}>
      {/* ナビ */}
      <nav style={{ background: '#fff', borderBottom: '3px solid #F5A623', padding: '0 24px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
          <span style={{ background: '#F5A623', color: '#fff', fontWeight: '900', fontSize: '14px', padding: '5px 10px', borderRadius: '5px' }}>出店</span>
          <span style={{ fontWeight: '900', fontSize: '18px', color: '#1a1a1a' }}>コネクト<span style={{ color: '#F5A623' }}>ナビ</span></span>
        </Link>
        <Link href="/login" style={{ border: '1px solid #ddd', color: '#555', borderRadius: '999px', padding: '6px 16px', fontSize: '13px', textDecoration: 'none' }}>
          ログイン
        </Link>
      </nav>

      {/* オレンジバー */}
      <div style={{ background: '#F5A623', display: 'flex' }}>
        {['ホーム', '出店したい', 'お店を呼びたい', '出店者を探す', '出店場所を探す', '制作・中古販売', '車両を売りたい'].map((item, i, arr) => (
          <button key={item} style={{ flex: 1, color: '#fff', fontWeight: '900', fontSize: '13px', padding: '12px 0', background: 'transparent', border: 'none', borderRight: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.3)' : 'none', cursor: 'pointer' }}>{item}</button>
        ))}
      </div>

      <div style={{ maxWidth: '520px', margin: '48px auto', padding: '0 16px' }}>
        {/* ステップインジケーター */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px', gap: '8px' }}>
          {[1, 2, 3].map((s) => (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: '900', fontSize: '13px',
                background: step >= s ? '#F5A623' : '#fff',
                color: step >= s ? '#fff' : '#aaa',
                border: step >= s ? '2px solid #F5A623' : '2px solid #E5E7EB',
              }}>{s}</div>
              {s < 3 && <div style={{ width: '40px', height: '2px', background: step > s ? '#F5A623' : '#E5E7EB' }}></div>}
            </div>
          ))}
        </div>

        <div style={{ background: '#fff', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: '1px solid #E5E7EB' }}>
          <div style={{ background: '#FFF8E1', borderBottom: '1px solid #FFE0A0', padding: '20px 28px' }}>
            <h1 style={{ fontSize: '18px', fontWeight: '900', color: '#B45309', marginBottom: '4px' }}>👤 新規会員登録（無料）</h1>
            <p style={{ fontSize: '12px', color: '#888' }}>
              {step === 1 ? '登録種別を選択してください' : step === 2 ? '基本情報を入力してください' : '登録完了'}
            </p>
          </div>

          <div style={{ padding: '28px' }}>
            {step === 1 && (
              <>
                <p style={{ fontSize: '13px', fontWeight: '700', color: '#555', marginBottom: '12px' }}>どちらで登録しますか？</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
                  {[
                    { key: 'seller', icon: '🛒', title: '出店したい', desc: 'イベント・施設に出店' },
                    { key: 'host', icon: '📣', title: 'お店を呼びたい', desc: '出店者を募集する' },
                  ].map((r) => (
                    <button
                      key={r.key}
                      onClick={() => setRole(r.key as 'seller' | 'host')}
                      style={{
                        padding: '16px 12px', borderRadius: '12px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center',
                        border: role === r.key ? '2px solid #F5A623' : '2px solid #E5E7EB',
                        background: role === r.key ? '#FFF8E1' : '#fff',
                      }}
                    >
                      <div style={{ fontSize: '28px', marginBottom: '6px' }}>{r.icon}</div>
                      <div style={{ fontWeight: '900', fontSize: '13px', color: role === r.key ? '#B45309' : '#333', marginBottom: '3px' }}>{r.title}</div>
                      <div style={{ fontSize: '11px', color: '#888' }}>{r.desc}</div>
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setStep(2)}
                  style={{ width: '100%', background: '#F5A623', color: '#fff', border: 'none', borderRadius: '8px', padding: '14px', fontSize: '15px', fontWeight: '900', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  次へ →
                </button>
              </>
            )}

            {step === 2 && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '14px' }}>
                  {[{ label: '姓', placeholder: '山田' }, { label: '名', placeholder: '太郎' }].map((f) => (
                    <div key={f.label}>
                      <label style={{ fontSize: '12px', fontWeight: '700', color: '#555', display: 'block', marginBottom: '5px' }}>
                        {f.label} <span style={{ color: '#E53E3E', background: '#FFF0F0', padding: '1px 5px', borderRadius: '3px', fontSize: '10px' }}>必須</span>
                      </label>
                      <input type="text" placeholder={f.placeholder} style={{ width: '100%', border: '1.5px solid #E5E7EB', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                  ))}
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#555', display: 'block', marginBottom: '5px' }}>
                    メールアドレス <span style={{ color: '#E53E3E', background: '#FFF0F0', padding: '1px 5px', borderRadius: '3px', fontSize: '10px' }}>必須</span>
                  </label>
                  <input type="email" placeholder="example@email.com" style={{ width: '100%', border: '1.5px solid #E5E7EB', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
                </div>

                <div style={{ marginBottom: '14px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#555', display: 'block', marginBottom: '5px' }}>
                    電話番号 <span style={{ color: '#888', background: '#F0F0F0', padding: '1px 5px', borderRadius: '3px', fontSize: '10px' }}>任意</span>
                  </label>
                  <input type="tel" placeholder="090-0000-0000" style={{ width: '100%', border: '1.5px solid #E5E7EB', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ fontSize: '12px', fontWeight: '700', color: '#555', display: 'block', marginBottom: '5px' }}>
                    パスワード <span style={{ color: '#E53E3E', background: '#FFF0F0', padding: '1px 5px', borderRadius: '3px', fontSize: '10px' }}>必須</span>
                  </label>
                  <div style={{ position: 'relative' }}>
                    <input type={showPass ? 'text' : 'password'} placeholder="8文字以上" style={{ width: '100%', border: '1.5px solid #E5E7EB', borderRadius: '8px', padding: '10px 40px 10px 12px', fontSize: '14px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
                    <button onClick={() => setShowPass(!showPass)} style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px' }}>
                      {showPass ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>

                <p style={{ fontSize: '12px', color: '#888', textAlign: 'center', marginBottom: '16px', lineHeight: 1.7 }}>
                  <a href="#" style={{ color: '#3A9BD5', textDecoration: 'none' }}>利用規約</a>・
                  <a href="#" style={{ color: '#3A9BD5', textDecoration: 'none' }}>プライバシーポリシー</a>
                  に同意の上、登録してください。<br />登録完了後、確認メールをお送りします。
                </p>

                <button
                  onClick={() => setStep(3)}
                  style={{ width: '100%', background: '#F5A623', color: '#fff', border: 'none', borderRadius: '8px', padding: '14px', fontSize: '15px', fontWeight: '900', cursor: 'pointer', fontFamily: 'inherit', marginBottom: '10px' }}
                >
                  無料で会員登録する →
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                  <div style={{ flex: 1, height: '1px', background: '#E5E7EB' }}></div>
                  <span style={{ fontSize: '12px', color: '#aaa' }}>または</span>
                  <div style={{ flex: 1, height: '1px', background: '#E5E7EB' }}></div>
                </div>

                <button style={{ width: '100%', background: '#fff', color: '#333', border: '1.5px solid #E5E7EB', borderRadius: '8px', padding: '12px', fontSize: '14px', fontWeight: '500', cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Googleで登録
                </button>

                <button onClick={() => setStep(1)} style={{ width: '100%', background: 'none', border: 'none', color: '#888', fontSize: '13px', cursor: 'pointer', marginTop: '12px', fontFamily: 'inherit' }}>← 戻る</button>
              </>
            )}

            {step === 3 && (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: '56px', marginBottom: '16px' }}>🎉</div>
                <h2 style={{ fontSize: '20px', fontWeight: '900', color: '#B45309', marginBottom: '10px' }}>登録完了！</h2>
                <p style={{ fontSize: '13px', color: '#888', lineHeight: 1.8, marginBottom: '24px' }}>
                  ご登録いただきありがとうございます。<br />
                  確認メールをお送りしましたのでご確認ください。
                </p>
                <Link href="/" style={{ display: 'inline-block', background: '#F5A623', color: '#fff', borderRadius: '8px', padding: '12px 32px', fontWeight: '900', fontSize: '14px', textDecoration: 'none' }}>
                  出店場所を探す
                </Link>
              </div>
            )}
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px', color: '#888' }}>
          すでに会員の方は{' '}
          <Link href="/login" style={{ color: '#B45309', fontWeight: '700', textDecoration: 'none' }}>ログイン</Link>
          {' '}へ
        </div>
      </div>

      <footer style={{ background: '#1E2A3B', color: '#fff', padding: '24px', textAlign: 'center', marginTop: '40px' }}>
        <div style={{ fontWeight: '900', fontSize: '16px', marginBottom: '8px' }}>出店コネクトナビ</div>
        <div style={{ fontSize: '12px', color: '#666' }}>© 2026 出店コネクトナビ All Rights Reserved.</div>
      </footer>
    </div>
  )
}
