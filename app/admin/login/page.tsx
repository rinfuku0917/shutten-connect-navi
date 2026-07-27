'use client'
import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

export default function AdminLoginPage() {
  const router = useRouter()
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
      if(profile?.role !== 'admin') {
        await supabase.auth.signOut()
        setError('管理者権限がありません。')
        setLoading(false); return
      }
      router.push('/admin')
    }
    setLoading(false)
  }

  return (
    <div style={{minHeight:'100vh',width:'100%',maxWidth:'100vw',overflowX:'hidden',background:'#1E2A3B',fontFamily:'-apple-system,BlinkMacSystemFont,sans-serif',display:'flex',flexDirection:'column'}}>
      <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',padding:'40px 16px',overflowY:'auto'}}>
        <div style={{background:'#fff',borderRadius:'12px',boxShadow:'0 4px 24px rgba(0,0,0,0.3)',width:'100%',maxWidth:'400px',overflow:'hidden'}}>
          <div style={{padding:'32px'}}>
            <h1 style={{fontSize:'18px',fontWeight:'900',marginBottom:'4px',textAlign:'center',color:'#1a1a1a'}}>管理者ログイン</h1>
            <p style={{fontSize:'12px',color:'#999',textAlign:'center',marginBottom:'24px'}}>出店コネクトナビ 運営管理</p>
            {error && <div style={{background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:'8px',padding:'12px',fontSize:'13px',color:'#DC2626',marginBottom:'16px'}}>{error}</div>}
            <div style={{marginBottom:'16px'}}>
              <label style={{fontSize:'13px',fontWeight:'600',color:'#555',display:'block',marginBottom:'6px'}}>メールアドレス</label>
              <input value={email} onChange={e=>setEmail(e.target.value)} type='email' placeholder='admin@email.com' style={{width:'100%',border:'1px solid #e0e0e0',borderRadius:'8px',padding:'10px 14px',fontSize:'14px',boxSizing:'border-box',outline:'none',color:'#1a1a1a',background:'#fff'}}/>
            </div>
            <div style={{marginBottom:'24px'}}>
              <label style={{fontSize:'13px',fontWeight:'600',color:'#555',display:'block',marginBottom:'6px'}}>パスワード</label>
              <div style={{position:'relative'}}>
                <input value={password} onChange={e=>setPassword(e.target.value)} type={showPass?'text':'password'} placeholder='パスワードを入力' onKeyDown={e=>e.key==='Enter'&&handleLogin()} style={{width:'100%',border:'1px solid #e0e0e0',borderRadius:'8px',padding:'10px 40px 10px 14px',fontSize:'14px',boxSizing:'border-box',outline:'none'}}/>
                <button onClick={()=>setShowPass(!showPass)} style={{position:'absolute',right:'12px',top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',fontSize:'12px',color:'#64748B',fontWeight:'700'}}>{showPass?'隠す':'表示'}</button>
              </div>
            </div>
            <button onClick={handleLogin} disabled={loading} style={{width:'100%',background:loading?'#ccc':'#F5A623',color:'#fff',border:'none',borderRadius:'8px',padding:'14px',fontSize:'15px',fontWeight:'900',cursor:loading?'not-allowed':'pointer'}}>
              {loading?'ログイン中...':'ログイン'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
