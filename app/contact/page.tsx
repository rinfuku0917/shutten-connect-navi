'use client'
import SiteHeader from '../components/SiteHeader'
import BackButton from '../components/BackButton'
import SiteFooter from '../components/SiteFooter'
import Image from 'next/image'
import Link from 'next/link'
import { useState } from 'react'
import { CONTACT_SOURCES, CONTACT_HISTORIES, asksRepName } from '../lib/signupSource'
import { track } from '../lib/ga'

// お問い合わせ本文の上限。API 側（app/api/contact/route.ts）と同じ数字にする
const MAX_MESSAGE = 5000

export default function ContactPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  // どこ経由で来たか。経路が分からないと、次に力を入れる場所が決められない
  const [foundVia, setFoundVia] = useState('')
  const [foundNote, setFoundNote] = useState('')
  // 初めての方か、すでに関係がある方か。社内の引き継ぎ先が変わる
  const [history, setHistory] = useState('')
  const [repName, setRepName] = useState('')
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle')
  const [errMsg, setErrMsg] = useState('')

  const submit = async () => {
    if (!name.trim() || !email.trim() || !message.trim()) {
      setErrMsg('すべての項目を入力してください')
      setStatus('error')
      return
    }
    if (!foundVia) {
      setErrMsg('「当サービスを知ったきっかけ」をお選びください')
      setStatus('error')
      return
    }
    if (!history) {
      setErrMsg('「弊社とのやり取り」をお選びください')
      setStatus('error')
      return
    }
    setStatus('sending')
    setErrMsg('')
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, email, message,
          foundVia,
          foundNote,
          contactHistory: history,
          // 担当者名をたずねない選択に変えたあとも値が残らないよう、ここで落とす
          repName: asksRepName(history) ? repName : '',
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setErrMsg(data.error || '送信に失敗しました')
        setStatus('error')
        return
      }
      setStatus('done')
      track('contact_submit')
      setName(''); setEmail(''); setMessage('')
      setFoundVia(''); setFoundNote(''); setHistory(''); setRepName('')
    } catch {
      setErrMsg('通信エラーが発生しました')
      setStatus('error')
    }
  }

  const labelStyle: React.CSSProperties = { display: 'block', fontSize: '14px', fontWeight: 700, color: '#92400E', marginBottom: '6px' }
  const inputStyle: React.CSSProperties = { width: '100%', padding: '12px 14px', borderRadius: '10px', border: '1px solid #E5D5B8', fontSize: '15px', boxSizing: 'border-box', background: '#fff', color: '#1a1a1a' }

  return (
    <div style={{ minHeight: '100vh', background: '#FFF9E6', width: '100%', maxWidth: '100vw', overflowX: 'hidden' }}>
      <SiteHeader />
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '14px 16px 0' }}>
        <BackButton fallback='/' />
      </div>

      <div style={{ background: 'linear-gradient(rgba(245,166,35,0.78), rgba(232,130,12,0.88)), url(/hero-contact.webp) center/cover no-repeat', padding: '72px 16px', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <h1 style={{ fontSize: 'clamp(24px,5vw,36px)', fontWeight: 900, color: '#fff', margin: 0, textShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>お問い合わせ</h1>
          {/* 見出しの右に置く案内係のアイコン。飾りなので読み上げには出さない */}
          <Image src='/ic-c-head.webp' alt='' width={52} height={52} priority style={{ width: 'clamp(38px,8vw,52px)', height: 'auto', filter: 'drop-shadow(0 2px 6px rgba(0,0,0,.25))' }} />
        </div>
        <p style={{ fontSize: '14px', color: '#fff', marginTop: '10px', opacity: 0.95, textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>ご質問・ご相談はこちらから</p>
      </div>

      <div style={{ maxWidth: '640px', margin: '0 auto', padding: '40px 16px' }}>
        {status === 'done' ? (
          <div style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', padding: '40px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
            <h2 style={{ fontSize: '20px', fontWeight: 900, color: '#1a1a1a', marginBottom: '12px' }}>送信が完了しました</h2>
            <p style={{ fontSize: '14px', color: '#555', lineHeight: 1.8, marginBottom: '24px' }}>お問い合わせありがとうございます。<br />内容を確認のうえ、担当者よりご連絡いたします。</p>
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', padding: '32px 24px' }}>
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}><Image src='/ic-c-name.webp' alt='' width={18} height={18} style={{ display: 'inline-block', width: '18px', height: '18px', verticalAlign: '-3px', marginRight: '7px' }} />お名前 <span style={{ color: '#DC2626' }}>*</span></label>
              <input style={inputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder="山田 太郎" />
            </div>
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}><Image src='/ic-c-mail.webp' alt='' width={18} height={18} style={{ display: 'inline-block', width: '18px', height: '18px', verticalAlign: '-3px', marginRight: '7px' }} />メールアドレス <span style={{ color: '#DC2626' }}>*</span></label>
              <input style={inputStyle} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="example@email.com" />
            </div>
            {/* どこ経由で来たかと、すでに関係がある方かどうか。
                問い合わせを受けたあとの動きが変わるので、内容より前に置く。
                選択肢の値は app/lib/signupSource.ts が唯一の正で、
                会員登録の「何を見て知ったか」と同じ値にしてある
                （ダッシュボードで同じ物差しで数えられるようにするため） */}
            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>当サービスを知ったきっかけ <span style={{ color: '#DC2626' }}>*</span></label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {CONTACT_SOURCES.map(o => (
                  <label key={o.value} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '9px 4px', minHeight: '44px', fontSize: '15px', color: '#1a1a1a' }}>
                    <input type='radio' name='foundVia' value={o.value}
                      checked={foundVia === o.value}
                      onChange={() => setFoundVia(o.value)}
                      style={{ width: '20px', height: '20px', accentColor: '#F5A623', cursor: 'pointer', flex: '0 0 auto' }} />
                    <span>{o.label}</span>
                  </label>
                ))}
              </div>
              {/* 「その他」を選んだ方に、どこで知ったのかを書ける場所を出す。
                  ここが無いと「その他」の中身が分からないままになる */}
              {foundVia === 'other' && (
                <input style={{ ...inputStyle, marginTop: '8px' }} value={foundNote}
                  onChange={(e) => setFoundNote(e.target.value)} maxLength={200}
                  placeholder='どこでお知りになりましたか（任意）' />
              )}
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={labelStyle}>弊社とのやり取り <span style={{ color: '#DC2626' }}>*</span></label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {CONTACT_HISTORIES.map(o => (
                  <label key={o.value} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', padding: '9px 4px', minHeight: '44px', fontSize: '15px', color: '#1a1a1a' }}>
                    <input type='radio' name='contactHistory' value={o.value}
                      checked={history === o.value}
                      onChange={() => setHistory(o.value)}
                      style={{ width: '20px', height: '20px', accentColor: '#F5A623', cursor: 'pointer', flex: '0 0 auto' }} />
                    <span>{o.label}</span>
                  </label>
                ))}
              </div>
              {/* すでに関係がある方のときだけ、担当者名の欄を出す。
                  分かる場合だけでよいので任意。社内の引き継ぎが早くなる */}
              {asksRepName(history) && (
                <div style={{ marginTop: '8px' }}>
                  <input style={inputStyle} value={repName}
                    onChange={(e) => setRepName(e.target.value)} maxLength={100}
                    placeholder='弊社の担当者名（例：山田）' />
                  <div style={{ fontSize: '12px', color: '#92400E', marginTop: '6px', lineHeight: 1.7 }}>
                    お分かりになる場合のみご記入ください。空欄でも送信できます。
                  </div>
                </div>
              )}
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={labelStyle}><Image src='/ic-c-message.webp' alt='' width={18} height={18} style={{ display: 'inline-block', width: '18px', height: '18px', verticalAlign: '-3px', marginRight: '7px' }} />お問い合わせ内容 <span style={{ color: '#DC2626' }}>*</span></label>
              <textarea style={{ ...inputStyle, minHeight: '140px', resize: 'vertical', fontFamily: 'inherit' }} value={message} onChange={(e) => setMessage(e.target.value)} maxLength={MAX_MESSAGE} placeholder="お問い合わせ内容をご記入ください" />
              {/* 上限が近づいたときだけ出す。書いた末尾が黙って消えることがないように */}
              {message.length > MAX_MESSAGE * 0.8 && (
                <div style={{ fontSize: '12px', color: message.length >= MAX_MESSAGE ? '#DC2626' : '#92400E', textAlign: 'right', marginTop: '6px' }}>
                  {message.length.toLocaleString()} / {MAX_MESSAGE.toLocaleString()}文字
                  {message.length >= MAX_MESSAGE && '（上限です。お手数ですが分けてお送りください）'}
                </div>
              )}
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

      <SiteFooter />
    </div>
  )
}
