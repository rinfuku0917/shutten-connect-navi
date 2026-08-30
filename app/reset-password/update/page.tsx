'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [done, setDone] = useState(false)
  const [ready, setReady] = useState(false)
  // リンクが無効・期限切れのときは、入力欄ではなく案内を出す
  const [expired, setExpired] = useState(false)

  useEffect(() => {
    // メールのリンクから来たとき、セッションが確立されるのを待つ。
    // 回線が遅いと間に合わず「期限切れ」と誤判定してしまうため、
    // 状態の変化を待ちつつ、数秒かけて何度か確認する。
    let done = false
    const finish = (ok: boolean) => {
      if (done) return
      done = true
      setReady(ok)
      setExpired(!ok)
    }

    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) finish(true)
    })

    const check = async (attempt: number) => {
      if (done) return
      const { data } = await supabase.auth.getSession()
      if (data.session) { finish(true); return }
      // 最大8秒（0.5秒 → 1秒 → 2秒 …）待ってから期限切れと判断する
      if (attempt >= 5) { finish(false); return }
      setTimeout(() => check(attempt + 1), 500 * Math.pow(2, attempt))
    }
    check(0)

    return () => { sub.subscription.unsubscribe() }
  }, [])

  const handleUpdate = async () => {
    if (password.length < 6) { setMsg('パスワードは6文字以上にしてください'); return }
    if (password !== password2) { setMsg('パスワードが一致しません'); return }
    setSaving(true); setMsg('')
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setMsg('更新に失敗しました: ' + error.message)
      setSaving(false)
      return
    }
    setDone(true)
    setSaving(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FFF8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ background: '#fff', borderRadius: '16px', padding: '32px 24px', maxWidth: '420px', width: '100%', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
        <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#B45309', marginBottom: '20px', textAlign: 'center' }}>新しいパスワードの設定</h1>

        {expired ? (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '15px', color: '#DC2626', fontWeight: 700, marginBottom: '10px' }}>リンクの有効期限が切れています</p>
            <p style={{ fontSize: '13px', color: '#555', lineHeight: 1.9, marginBottom: '20px' }}>
              パスワード再設定のリンクは、送信から<strong>1時間</strong>のあいだ、<strong>1回だけ</strong>ご利用いただけます。<br />
              お手数ですが、あらためてメールをお送りください。
            </p>
            <a href="/reset-password" style={{ display: 'inline-block', background: '#F5A623', color: '#fff', textDecoration: 'none', borderRadius: '8px', padding: '13px 28px', fontSize: '15px', fontWeight: 700 }}>再設定メールを送り直す</a>
            <p style={{ fontSize: '11px', color: '#94A3B8', lineHeight: 1.8, marginTop: '16px' }}>
              メールが届いたら、なるべく早くリンクを開いてください。<br />
              解決しない場合は info@connect-navi.com までご連絡ください。
            </p>
          </div>
        ) : done ? (
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: '15px', color: '#333', lineHeight: 1.8, marginBottom: '20px' }}>
              パスワードを変更しました。<br />新しいパスワードでログインしてください。
            </p>
            <a href="/login" style={{ display: 'inline-block', background: '#F5A623', color: '#fff', textDecoration: 'none', borderRadius: '8px', padding: '12px 28px', fontSize: '15px', fontWeight: 700 }}>ログイン画面へ</a>
          </div>
        ) : (
          <>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '6px' }}>新しいパスワード（6文字以上）</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="新しいパスワード"
              style={{ width: '100%', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '12px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', marginBottom: '14px' }}
            />
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '6px' }}>新しいパスワード（確認）</label>
            <input
              type="password"
              value={password2}
              onChange={e => setPassword2(e.target.value)}
              placeholder="もう一度入力"
              style={{ width: '100%', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '12px', fontSize: '14px', outline: 'none', boxSizing: 'border-box', marginBottom: '16px' }}
            />
            {msg && <p style={{ fontSize: '13px', color: '#DC2626', marginBottom: '12px', lineHeight: 1.6 }}>{msg}</p>}
            <button
              onClick={handleUpdate}
              disabled={saving || !ready}
              style={{ width: '100%', background: (saving || !ready) ? '#F1F5F9' : '#F5A623', color: (saving || !ready) ? '#94A3B8' : '#fff', border: 'none', borderRadius: '8px', padding: '13px', fontSize: '15px', fontWeight: 700, cursor: (saving || !ready) ? 'default' : 'pointer' }}
            >
              {saving ? '更新中...' : !ready ? '準備中...' : 'パスワードを変更する'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}