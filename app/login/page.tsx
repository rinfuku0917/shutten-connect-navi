'use client'
import Link from 'next/link'
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import SiteHeader from '../components/SiteHeader'
import SiteFooter from '../components/SiteFooter'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'seller'|'host'>('seller')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPass, setShowPass] = useState(false)

  const handleLogin = async () => {
    if(!email || !password) { setError('メールアドレスとパスワードを入力してください'); return }
    setLoading(true); setError('')
    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password })
    if(err) { setError('メールアドレスまたはパスワードが正しくありません'); setLoading(false); return }
    if(data.user) {
      // ログイン直後はセッション反映前にRLSで0行になることがあるため、取れなければ少し待ってリトライ
      let role: string | undefined
      for (let i = 0; i < 5; i++) {
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle()
        if (profile?.role) { role = profile.role; break }
        await new Promise(res => setTimeout(res, 300))
      }
      // タブの選び間違いでログアウトさせない。
      //
      // 以前は、選んだタブと登録の種別が違うと signOut していた。
      // 初期表示が「出店者ログイン」なので、募集者の方は必ずここに当たり、
      // 正しいパスワードを入れたのに追い出される形になっていた。
      // パスワードが合っているなら入れるべきで、行き先だけ正しく振り分ければよい。
      if(role === 'host') router.push('/dashboard/host')
      else if(role === 'admin') router.push('/admin')
      else if(role === 'seller') router.push('/dashboard/seller')
      else {
        // 種別が取れなかったときだけ止める。
        // ここで signOut しないのは、入れているのに追い出すと
        // 「パスワードが違う」と誤解されるため
        setError('会員情報を読み込めませんでした。少し待ってからもう一度お試しください。')
        setLoading(false); return
      }
    }
    setLoading(false)
  }

  return (
    <div style={{minHeight:'100vh',width:'100%',maxWidth:'100vw',overflowX:'hidden',background:'#f6f6f6',fontFamily:'-apple-system,BlinkMacSystemFont,sans-serif',display:'flex',flexDirection:'column'}}>
      <SiteHeader />
      
      <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:'40px 16px',overflowY:'auto'}}>
        <div style={{background:'#fff',borderRadius:'12px',border:'1px solid #e0e0e0',boxShadow:'0 4px 16px rgba(0,0,0,0.08)',width:'100%',maxWidth:'420px',overflow:'hidden'}}>
          <div style={{display:'flex',borderBottom:'1px solid #e0e0e0'}}>
            <button onClick={()=>setTab('seller')} style={{flex:1,padding:'16px',fontSize:'14px',fontWeight:'700',border:'none',background:'none',cursor:'pointer',borderBottom:tab==='seller'?'2px solid #F5A623':'2px solid transparent',color:tab==='seller'?'#F5A623':'#888',display:'flex',alignItems:'center',justifyContent:'center',gap:'8px'}}>
              出店者ログイン
              <img src='/ic2-truck.webp' alt='' style={{height:'26px',width:'auto',objectFit:'contain',opacity:tab==='seller'?1:.5}} />
            </button>
            <button onClick={()=>setTab('host')} style={{flex:1,padding:'16px',fontSize:'14px',fontWeight:'700',border:'none',background:'none',cursor:'pointer',borderBottom:tab==='host'?'2px solid #F5A623':'2px solid transparent',color:tab==='host'?'#F5A623':'#888',display:'flex',alignItems:'center',justifyContent:'center',gap:'8px'}}>
              募集者ログイン
              <img src='/ic-mikan.webp' alt='' style={{height:'24px',width:'auto',objectFit:'contain',opacity:tab==='host'?1:.5}} />
            </button>
          </div>
          <div style={{padding:'32px'}}>
            <h1 style={{fontSize:'20px',fontWeight:'900',marginBottom:'24px',textAlign:'center',color:'#1a1a1a'}}>
              {tab==='seller'?'出店者':'募集者'}としてログイン
            </h1>
            {error && <div style={{background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:'8px',padding:'12px',fontSize:'13px',color:'#DC2626',marginBottom:'16px'}}>{error}</div>}
            <div style={{marginBottom:'16px'}}>
              <label style={{fontSize:'13px',fontWeight:'600',color:'#555',display:'block',marginBottom:'6px'}}>メールアドレス</label>
              <input value={email} onChange={e=>setEmail(e.target.value)} type='email' placeholder='example@email.com' style={{width:'100%',border:'1px solid #e0e0e0',borderRadius:'8px',padding:'10px 14px',fontSize:'14px',boxSizing:'border-box',outline:'none',color:'#1a1a1a',background:'#fff'}}/>
            </div>
            <div style={{marginBottom:'24px'}}>
              <label style={{fontSize:'13px',fontWeight:'600',color:'#555',display:'block',marginBottom:'6px'}}>パスワード</label>
              <div style={{position:'relative'}}>
                <input value={password} onChange={e=>setPassword(e.target.value)} type={showPass?'text':'password'} placeholder='パスワードを入力' onKeyDown={e=>e.key==='Enter'&&handleLogin()} style={{width:'100%',border:'1px solid #e0e0e0',borderRadius:'8px',padding:'10px 40px 10px 14px',fontSize:'14px',boxSizing:'border-box',outline:'none'}}/>
                <button onClick={()=>setShowPass(!showPass)} style={{position:'absolute',right:'12px',top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',fontSize:'16px'}}>{showPass?'🙈':'👁️'}</button>
              </div>
            </div>
            <button onClick={handleLogin} disabled={loading} style={{width:'100%',background:loading?'#ccc':'#F5A623',color:'#fff',border:'none',borderRadius:'8px',padding:'14px',fontSize:'15px',fontWeight:'900',cursor:loading?'not-allowed':'pointer',marginBottom:'16px'}}>
              {loading?'ログイン中...':'ログイン'}
            </button>
            <div style={{textAlign:'center',fontSize:'13px',color:'#888',marginBottom:'12px'}}>
              <Link href='/register' style={{color:'#F5A623',fontWeight:'700',textDecoration:'none'}}>新規会員登録はこちら</Link>
            </div>
            {/* パスワード再設定は、忘れた人がたどり着く唯一の道。
                以前は薄い灰色の小さな字で、探さないと見つからなかった。
                お問い合わせの多くがここに来られないことによるものだったため、
                押せる大きさの枠にして目に入るようにした */}
            <div style={{textAlign:'center'}}>
              <Link href='/reset-password' style={{display:'inline-block',color:'#1D4ED8',fontWeight:700,fontSize:'13.5px',textDecoration:'none',border:'1px solid #BFDBFE',background:'#EFF6FF',borderRadius:'8px',padding:'10px 20px',minHeight:'42px',boxSizing:'border-box'}}>
                パスワードをお忘れの方はこちら
              </Link>
            </div>
            {/* 旧サイトから会員情報を引き継いでいるため、新規登録が不要なことを伝える */}
            <div style={{background:'#FFFBEB',border:'1px solid #FDE68A',borderRadius:'8px',padding:'10px 14px',marginTop:'14px',fontSize:'12px',color:'#B45309',lineHeight:1.8}}>
              以前の出店コネクトナビをご利用の方へ<br />
              会員情報を引き継いでいるため<strong>新規登録は不要</strong>です。
              <Link href='/reset-password' style={{color:'#1D4ED8',fontWeight:700}}>パスワードの再設定</Link>
              から、旧サイトでご登録のメールアドレスでパスワードを設定してご利用ください。
            </div>
          </div>
        </div>
      </div>
      <SiteFooter />
    </div>
  )
}
