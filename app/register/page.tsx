'use client'
import Link from 'next/link'
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import SiteHeader from '../components/SiteHeader'
import SiteFooter from '../components/SiteFooter'
import { sourcesFor } from '../lib/signupSource'
import { track } from '../lib/ga'

const AREA_GROUPS: { region: string, prefs: string[] }[] = [
  { region: '関東', prefs: ['東京','神奈川','千葉','埼玉','茨城','群馬','栃木'] },
  { region: '関西', prefs: ['大阪','兵庫','奈良','京都','滋賀','和歌山'] },
  { region: '東海', prefs: ['愛知','静岡','三重','岐阜'] },
  { region: '甲信越・北陸', prefs: ['山梨','長野','石川','新潟','富山','福井'] },
  { region: '中国・四国', prefs: ['岡山','広島','島根','鳥取','山口','愛媛','香川','高知','徳島'] },
  { region: '九州・沖縄', prefs: ['福岡','佐賀','長崎','熊本','大分','宮崎','鹿児島','沖縄'] },
  { region: '北海道・東北', prefs: ['北海道','青森','岩手','秋田','宮城','山形','福島'] },
]

export default function RegisterPage() {
  // 呼びたい方の導線から来たときは「お店を呼びたい」を選んだ状態で開く。
  //
  // これまでURLから役割を受け取れず、募集者向けのページから来ても
  // 「出店したい」が選ばれていた。選び直しは1クリックだが、
  // 気づかないまま出店者として登録してしまう
  // （出店エリアの入力を求められて、そこで初めて気づく）。
  //
  // useSearchParams を使うと Suspense の囲みが要るので、
  // 初期値を決めるときに一度だけ URL を読む。
  // サーバー描画では window が無いので既定の seller になり、
  // ブラウザで動き出した時点で入れ替わる
  const [role, setRole] = useState<'seller'|'host'>(() => {
    if (typeof window === 'undefined') return 'seller'
    const r = new URLSearchParams(window.location.search).get('role')
    return r === 'host' ? 'host' : 'seller'
  })
  const [name, setName] = useState('')
  const [nameKana, setNameKana] = useState('')
  const [company, setCompany] = useState('')
  // 何を見て知ったか。どの入口から来た方なのかが分からないと、
  // どこに手をかけるべきかの判断ができない
  const [foundVia, setFoundVia] = useState('')
  const [foundNote, setFoundNote] = useState('')
  const [address, setAddress] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [areas, setAreas] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const toggleArea = (pref: string) => {
    setAreas(prev => prev.includes(pref) ? prev.filter(p => p !== pref) : [...prev, pref])
  }

  const handleRegister = async () => {
    if(!name || !nameKana || !address || !email || !phone || !password) {
      setError('必須項目をすべて入力してください'); return
    }
    if(password.length < 6) { setError('パスワードは6文字以上で入力してください'); return }
    if(role === 'seller' && areas.length === 0) {
      setError('出店エリアを1つ以上選択してください。'
        + 'キッチンカーを呼びたい方は、上の「お店を呼びたい」をお選びください')
      return
    }
    setLoading(true); setError('')

    // Supabase の signUp は既存アドレスでもエラーを返さないため、先に重複を確認する。
    // （確認できなかった場合は登録処理をそのまま続行する）
    try {
      const res = await fetch('/api/auth/check-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const j = await res.json()
      if (j?.exists) {
        const roleLabel = j.role === 'seller' ? '出店者' : j.role === 'host' ? '募集者' : null
        setError(
          'このメールアドレスは既に登録されています。'
          + (roleLabel ? '（' + roleLabel + 'として登録済みです）' : '')
          + ' ログインするか、別のメールアドレスをご利用ください。'
        )
        setLoading(false)
        return
      }
    } catch (e) {
      console.error('メールアドレスの重複確認に失敗しました', e)
    }

    const metadata: Record<string, unknown> = {
      name, role, name_kana: nameKana, address, phone,
    }
    if (company) metadata.shop_name = company
    if (foundVia) metadata.found_via = foundVia
    if (foundNote.trim()) metadata.found_note = foundNote.trim()
    if (role === 'seller' && areas.length > 0) metadata.areas = areas
    const { error: err } = await supabase.auth.signUp({
      email, password,
      options: { data: metadata, emailRedirectTo: 'https://app.connect-navi.com/login' }
    })
    if(err) { setError(err.message); setLoading(false); return }
    // 管理者へ新規登録メール通知（失敗しても登録は成功させる）
    try {
      await fetch('/api/notify/new-seller', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role, name,
          shop_name: company || null,
          email, phone,
          areas: role === 'seller' ? areas : null,
          // 何を見て知ったか。この API で記録も行う
          found_via: foundVia || null,
          found_note: foundNote.trim() || null,
        }),
      })
    } catch (e) {
      console.error('メール通知に失敗しましたが登録は完了しました', e)
    }
    setDone(true)
    // 出店者・募集者どちらの登録かも記録する
    track('signup', { role })
    setLoading(false)
  }

  if(done) return (
    // スマホではカードが画面いっぱいまで縮むため、左右に余白を置いて枠が画面の端に貼り付かないようにする。
    // 入力フォーム側（下の 40px 16px）と同じ考え方。box-sizing を border-box にして、
    // 余白のぶんだけ縦に伸びて不要なスクロールが出るのを防ぐ。
    <div style={{minHeight:'100vh',boxSizing:'border-box',padding:'24px 16px',background:'#FFF9E6',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'-apple-system,BlinkMacSystemFont,sans-serif'}}>
      <div style={{background:'#fff',borderRadius:'12px',border:'1px solid #FFE0A0',padding:'48px 32px',maxWidth:'420px',textAlign:'center',boxShadow:'0 4px 16px rgba(0,0,0,0.08)'}}>
        <div style={{fontSize:'clamp(28px, 6vw, 48px)',marginBottom:'16px'}}>📧</div>
        <h2 style={{fontSize:'20px',fontWeight:'900',marginBottom:'12px',color:'#1a1a1a'}}>確認メールを送信しました</h2>
        {/* メールアドレスは日本語と違って途中で改行できず、長いアドレスだとその長さが枠の下限になって
            スマホではみ出す。アドレスだけを .kv-value で包み、そこだけ途中でも折り返せるようにする。
            文章側の改行位置は変えないため、アドレス以外の見え方はこれまでと同じ。 */}
        <p style={{fontSize:'14px',color:'#666',lineHeight:1.8,marginBottom:'24px'}}><span className='kv-value'>{email}</span> に確認メールを送りました。メール内のリンクをクリックして登録を完了してください。</p>
        <Link href='/login' style={{background:'#F5A623',color:'#fff',fontWeight:'900',fontSize:'14px',padding:'12px 32px',borderRadius:'8px',textDecoration:'none'}}>ログインへ</Link>
      </div>
    </div>
  )

  const inputStyle = {
    width:'100%', border:'1px solid #E5D5A0', borderRadius:'8px',
    padding:'10px 14px', fontSize:'14px', boxSizing:'border-box' as const,
    outline:'none', background:'#fff', color:'#1a1a1a'
  }
  const labelStyle = { fontSize:'13px', fontWeight:'700', color:'#B45309', display:'block', marginBottom:'6px' }
  const reqBadge = <span style={{background:'#F5A623',color:'#fff',fontSize:'10px',fontWeight:'700',padding:'2px 8px',borderRadius:'6px',marginLeft:'8px'}}>必須</span>

  return (
    <div style={{minHeight:'100vh',background:'#FFF9E6',fontFamily:'-apple-system,BlinkMacSystemFont,sans-serif',display:'flex',flexDirection:'column'}}>
      <SiteHeader />
      <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:'40px 16px'}}>
        <div style={{background:'#fff',borderRadius:'16px',border:'2px solid #FFE0A0',boxShadow:'0 4px 20px rgba(245,166,35,0.15)',width:'100%',maxWidth:'520px',padding:'36px'}}>
          <h1 style={{fontSize:'22px',fontWeight:'900',marginBottom:'24px',textAlign:'center',color:'#1a1a1a'}}>無料会員登録</h1>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginBottom:'24px'}}>
            {[
              {val:'seller',label:'出店したい',icon:'🚚'},
              {val:'host',label:'お店を呼びたい',icon:'📣'}
            ].map(r=>(
              <button key={r.val} onClick={()=>setRole(r.val as 'seller'|'host')} style={{border:role===r.val?'2px solid #F5A623':'1px solid #E5D5A0',borderRadius:'10px',padding:'16px 12px',background:role===r.val?'#FFF3C4':'#FFFBF0',cursor:'pointer',textAlign:'center',display:'flex',flexDirection:'column',alignItems:'center',gap:'8px'}}>
                <span style={{height:'48px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'40px',lineHeight:1}}>{r.icon}</span>
                <span style={{fontSize:'13px',fontWeight:'700',color:role===r.val?'#E08A00':'#555'}}>{r.label}</span>
              </button>
            ))}
          </div>
          {error && <div style={{background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:'8px',padding:'12px',fontSize:'13px',color:'#DC2626',marginBottom:'16px'}}>{error}</div>}

          <div style={{marginBottom:'14px'}}>
            <label style={labelStyle}>担当者名{reqBadge}</label>
            <input value={name} onChange={e=>setName(e.target.value)} placeholder='例：田中太郎' style={inputStyle}/>
          </div>
          <div style={{marginBottom:'14px'}}>
            <label style={labelStyle}>担当者名ふりがな{reqBadge}</label>
            <input value={nameKana} onChange={e=>setNameKana(e.target.value)} placeholder='例：たなかたろう' style={inputStyle}/>
          </div>
          <div style={{marginBottom:'14px'}}>
            <label style={labelStyle}>企業名</label>
            <input value={company} onChange={e=>setCompany(e.target.value)} placeholder='例：株式会社○○ / たこ焼き大阪屋' style={inputStyle}/>
          </div>
          <div style={{marginBottom:'14px'}}>
            <label style={labelStyle}>住所{reqBadge}</label>
            <input value={address} onChange={e=>setAddress(e.target.value)} placeholder='例：東京都渋谷区○○1-2-3' style={inputStyle}/>
          </div>
          <div style={{marginBottom:'14px'}}>
            <label style={labelStyle}>メールアドレス{reqBadge}</label>
            <input value={email} onChange={e=>setEmail(e.target.value)} type='email' placeholder='example@email.com' style={inputStyle}/>
          </div>
          <div style={{marginBottom:'14px'}}>
            <label style={labelStyle}>電話番号{reqBadge}</label>
            <input value={phone} onChange={e=>setPhone(e.target.value)} placeholder='例：090-1234-5678' style={inputStyle}/>
          </div>
          <div style={{marginBottom: role==='seller' ? '20px' : '24px'}}>
            <label style={labelStyle}>パスワード{reqBadge}</label>
            <input value={password} onChange={e=>setPassword(e.target.value)} type='password' placeholder='パスワードを入力' style={inputStyle}/>
            <div style={{fontSize:'12px',color:'#999',marginTop:'4px'}}>半角英数字混合6〜20文字</div>
          </div>

          {role==='seller' && (
            <div style={{marginBottom:'24px'}}>
              <label style={labelStyle}>出店エリア{reqBadge}</label>
              <div style={{border:'1px solid #E5D5A0',borderRadius:'8px',padding:'14px',background:'#FFFBF0'}}>
                {AREA_GROUPS.map(g => (
                  <div key={g.region} style={{marginBottom:'12px'}}>
                    <div style={{fontSize:'13px',fontWeight:'700',color:'#1a1a1a',marginBottom:'6px'}}>{g.region}</div>
                    <div style={{display:'flex',flexWrap:'wrap',gap:'6px'}}>
                      {g.prefs.map(p => (
                        <label key={p} style={{display:'inline-flex',alignItems:'center',gap:'4px',fontSize:'13px',color:'#333',cursor:'pointer',padding:'4px 10px',borderRadius:'999px',border: areas.includes(p) ? '1.5px solid #F5A623' : '1px solid #E5E7EB',background: areas.includes(p) ? '#FFF3C4' : '#fff'}}>
                          <input type='checkbox' checked={areas.includes(p)} onChange={()=>toggleArea(p)} style={{accentColor:'#F5A623'}}/>
                          {p}
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 何を見て知ったか。任意にしているのは、
              必須にして登録の手前で離脱されるほうが損だから */}
          <div style={{marginBottom:'24px'}}>
            <label style={labelStyle}>
              当サイトを何でお知りになりましたか？
              <span style={{fontSize:'11px',fontWeight:400,color:'#999',marginLeft:'6px'}}>任意</span>
            </label>
            <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
              {sourcesFor(role).map(o => (
                <label key={o.value} style={{display:'flex',alignItems:'center',gap:'8px',cursor:'pointer',border:foundVia===o.value?'2px solid #F5A623':'1px solid #E5D5A0',borderRadius:'8px',padding:'11px 13px',fontSize:'13.5px',color:'#1a1a1a',background:foundVia===o.value?'#FFF3C4':'#FFFBF0',minHeight:'44px'}}>
                  <input type='radio' name='found_via' checked={foundVia===o.value}
                    onChange={()=>{ setFoundVia(o.value); if(o.value!=='other') setFoundNote('') }}
                    style={{accentColor:'#F5A623',width:'18px',height:'18px'}}/>
                  {o.label}
                </label>
              ))}
            </div>
            {/* 「その他」と「紹介」は、中身が分かると次の手が打てる */}
            {(foundVia === 'other' || foundVia === 'referral') && (
              <input value={foundNote} onChange={e=>setFoundNote(e.target.value)}
                placeholder={foundVia === 'referral' ? '紹介してくださった方・会社名（任意）' : 'どちらでお知りになりましたか（任意）'}
                style={{...inputStyle,marginTop:'8px'}}/>
            )}
          </div>

          <button onClick={handleRegister} disabled={loading} style={{width:'100%',background:loading?'#ccc':'#F5A623',color:'#fff',border:'none',borderRadius:'8px',padding:'14px',fontSize:'15px',fontWeight:'900',cursor:loading?'not-allowed':'pointer',marginBottom:'16px',boxShadow:'0 4px 12px rgba(245,166,35,0.3)'}}>
            {loading?'登録中...':'この内容で無料登録する'}
          </button>
          <div style={{textAlign:'center',fontSize:'13px',color:'#888'}}>
            すでにアカウントをお持ちの方は <Link href='/login' style={{color:'#F5A623',fontWeight:'700',textDecoration:'none'}}>ログイン</Link>
          </div>
        </div>
      </div>
      <SiteFooter />
    </div>
  )
}
