'use client'
import Link from 'next/link'
import { useState } from 'react'
import { supabase } from '../lib/supabase'
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
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).single()
      const role = profile?.role
      alert('デバッグ: profile=' + JSON.stringify(profile) + ' / tab=' + tab)
      if(tab === 'seller' && role !== 'seller') {
        await supabase.auth.signOut()
        setError('このアカウントは出店者として登録されていません。募集者の方は「募集者ログイン」をお選びください。')
        setLoading(false); return
      }
      if(tab === 'host' && role !== 'host' && role !== 'admin') {
        await supabase.auth.signOut()
        setError('このアカウントは募集者として登録されていません。出店者の方は「出店者ログイン」をお選びください。')
        setLoading(false); return
      }
      if(role === 'host') router.push('/dashboard/host')
      else if(role === 'admin') router.push('/admin')
      else router.push('/dashboard/seller')
    }
    setLoading(false)
  }

  return (
    <div style={{minHeight:'100vh',width:'100%',maxWidth:'100vw',overflowX:'hidden',background:'#f6f6f6',fontFamily:'-apple-system,BlinkMacSystemFont,sans-serif',display:'flex',flexDirection:'column'}}>
      
      <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:'40px 16px',overflowY:'auto'}}>
        <div style={{background:'#fff',borderRadius:'12px',border:'1px solid #e0e0e0',boxShadow:'0 4px 16px rgba(0,0,0,0.08)',width:'100%',maxWidth:'420px',overflow:'hidden'}}>
          <div style={{display:'flex',borderBottom:'1px solid #e0e0e0'}}>
            <button onClick={()=>setTab('seller')} style={{flex:1,padding:'16px',fontSize:'14px',fontWeight:'700',border:'none',background:'none',cursor:'pointer',borderBottom:tab==='seller'?'2px solid #F5A623':'2px solid transparent',color:tab==='seller'?'#F5A623':'#888'}}>
              出店者ログイン
            </button>
            <button onClick={()=>setTab('host')} style={{flex:1,padding:'16px',fontSize:'14px',fontWeight:'700',border:'none',background:'none',cursor:'pointer',borderBottom:tab==='host'?'2px solid #F5A623':'2px solid transparent',color:tab==='host'?'#F5A623':'#888'}}>
              募集者ログイン
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
            <div style={{textAlign:'center',fontSize:'12px'}}>
              <a href='#' style={{color:'#999',textDecoration:'none'}}>パスワードをお忘れの方</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
