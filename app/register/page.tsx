'use client'
import Link from 'next/link'
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useRouter } from 'next/navigation'

export default function RegisterPage() {
  const router = useRouter()
  const [role, setRole] = useState<'seller'|'host'>('seller')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const handleRegister = async () => {
    if(!name || !email || !password) { setError('すべての項目を入力してください'); return }
    if(password.length < 6) { setError('パスワードは6文字以上で入力してください'); return }
    setLoading(true); setError('')
    const { data, error: err } = await supabase.auth.signUp({
      email, password,
      options: { data: { name, role } }
    })
    if(err) { setError(err.message); setLoading(false); return }
    if(data.user) {
      await supabase.from('profiles').upsert({ id: data.user.id, role, name, email })
      setDone(true)
    }
    setLoading(false)
  }

  if(done) return (
    <div style={{minHeight:'100vh',background:'#FFF9E6',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:'-apple-system,BlinkMacSystemFont,sans-serif'}}>
      <div style={{background:'#fff',borderRadius:'12px',border:'1px solid #FFE0A0',padding:'48px 32px',maxWidth:'420px',textAlign:'center',boxShadow:'0 4px 16px rgba(0,0,0,0.08)'}}>
        <div style={{fontSize:'clamp(28px, 6vw, 48px)',marginBottom:'16px'}}>📧</div>
        <h2 style={{fontSize:'20px',fontWeight:'900',marginBottom:'12px',color:'#1a1a1a'}}>確認メールを送信しました</h2>
        <p style={{fontSize:'14px',color:'#666',lineHeight:1.8,marginBottom:'24px'}}>{email} に確認メールを送りました。メール内のリンクをクリックして登録を完了してください。</p>
        <Link href='/login' style={{background:'#F5A623',color:'#fff',fontWeight:'900',fontSize:'14px',padding:'12px 32px',borderRadius:'8px',textDecoration:'none'}}>ログインへ</Link>
      </div>
    </div>
  )

  const inputStyle = {
    width:'100%',
    border:'1px solid #E5D5A0',
    borderRadius:'8px',
    padding:'10px 14px',
    fontSize:'14px',
    boxSizing:'border-box' as const,
    outline:'none',
    background:'#fff',
    color:'#1a1a1a'
  }

  return (
    <div style={{minHeight:'100vh',background:'#FFF9E6',fontFamily:'-apple-system,BlinkMacSystemFont,sans-serif',display:'flex',flexDirection:'column'}}>
      
      <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:'40px 16px'}}>
        <div style={{background:'#fff',borderRadius:'16px',border:'2px solid #FFE0A0',boxShadow:'0 4px 20px rgba(245,166,35,0.15)',width:'100%',maxWidth:'440px',padding:'36px'}}>
          <h1 style={{fontSize:'22px',fontWeight:'900',marginBottom:'24px',textAlign:'center',color:'#1a1a1a'}}>無料会員登録</h1>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginBottom:'24px'}}>
            {[
              {val:'seller',label:'出店したい'},
              {val:'host',label:'お店を呼びたい'}
            ].map(r=>(
              <button key={r.val} onClick={()=>setRole(r.val as 'seller'|'host')} style={{border:role===r.val?'2px solid #F5A623':'1px solid #E5D5A0',borderRadius:'10px',padding:'16px 12px',background:role===r.val?'#FFF3C4':'#FFFBF0',cursor:'pointer',textAlign:'center',display:'flex',flexDirection:'column',alignItems:'center',gap:'8px'}}>
                {r.val==='seller'
                  ? <span style={{height:'48px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'40px',lineHeight:1}}>🚚</span>
                  : <span style={{height:'48px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'40px',lineHeight:1}}>📣</span>
                }
                <span style={{fontSize:'13px',fontWeight:'700',color:role===r.val?'#E08A00':'#555'}}>{r.label}</span>
              </button>
            ))}
          </div>
          {error && <div style={{background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:'8px',padding:'12px',fontSize:'13px',color:'#DC2626',marginBottom:'16px'}}>{error}</div>}
          <div style={{marginBottom:'14px'}}>
            <label style={{fontSize:'13px',fontWeight:'700',color:'#B45309',display:'block',marginBottom:'6px'}}>お名前・店舗名</label>
            <input value={name} onChange={e=>setName(e.target.value)} placeholder='例：田中太郎 / たこ焼き大阪屋' style={inputStyle}/>
          </div>
          <div style={{marginBottom:'14px'}}>
            <label style={{fontSize:'13px',fontWeight:'700',color:'#B45309',display:'block',marginBottom:'6px'}}>メールアドレス</label>
            <input value={email} onChange={e=>setEmail(e.target.value)} type='email' placeholder='example@email.com' style={inputStyle}/>
          </div>
          <div style={{marginBottom:'24px'}}>
            <label style={{fontSize:'13px',fontWeight:'700',color:'#B45309',display:'block',marginBottom:'6px'}}>パスワード（6文字以上）</label>
            <input value={password} onChange={e=>setPassword(e.target.value)} type='password' placeholder='パスワードを入力' style={inputStyle}/>
          </div>
          <button onClick={handleRegister} disabled={loading} style={{width:'100%',background:loading?'#ccc':'#F5A623',color:'#fff',border:'none',borderRadius:'8px',padding:'14px',fontSize:'15px',fontWeight:'900',cursor:loading?'not-allowed':'pointer',marginBottom:'16px',boxShadow:'0 4px 12px rgba(245,166,35,0.3)'}}>
            {loading?'登録中...':'無料で登録する'}
          </button>
          <div style={{textAlign:'center',fontSize:'13px',color:'#888'}}>
            すでにアカウントをお持ちの方は <Link href='/login' style={{color:'#F5A623',fontWeight:'700',textDecoration:'none'}}>ログイン</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
