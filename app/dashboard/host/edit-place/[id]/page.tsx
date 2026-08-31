'use client'
import Link from 'next/link'
import { Suspense, useState, useEffect } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import { supabase } from '../../../../lib/supabase'
import { geocodeAddress } from '../../../../lib/geocode'
import { PLACE_CATEGORIES } from '../../../../lib/categories'
import { toYen, hasPerDayFee } from '../../../../lib/placeFee'
import PlaceImagePicker from '../../../../components/PlaceImagePicker'


// 案件フォームのうち、専用の列を持たない詳細項目。
// places.details（JSON）にまとめて保存し、読み込み時に復元する。
// これが無いと保存のたびに初期値へ戻ってしまう。
const DETAIL_KEYS = ['deadline', 'format', 'visitors', 'loadIn', 'loadOut', 'menuWant', 'menuNG', 'menuOther', 'power', 'gas', 'water', 'trash', 'eatSpace', 'location', 'heightLimit', 'heightValue', 'rain', 'rainNote', 'history', 'parking', 'brand', 'notes'] as const

// eslint-disable-next-line @typescript-eslint/no-explicit-any
// 募集者が入力した金額を、そのまま計算用の設定として保存する。
// 出店料の文章だけを書いて計算設定が空のままだと、売上を報告しても
// 出店料が0円になってしまうため、入力欄と計算設定を必ず一致させる。
function buildFeeColumns(form: { feeFixed?: string; feePct?: string; feeUnit?: string; fee?: string }) {
  const fixed = parseInt((form.feeFixed || '').replace(/[^0-9]/g, ''), 10) || 0
  const pct = parseFloat((form.feePct || '').replace(/[^0-9.]/g, '')) || 0
  const unit = form.feeUnit === 'per_event' ? 'per_event' : 'per_day'
  // 表示用の文章は入力から自動で作る（自由記述があればそちらを優先）
  const parts: string[] = []
  if (fixed > 0) parts.push(fixed.toLocaleString() + '円/' + (unit === 'per_event' ? '期間' : '日'))
  if (pct > 0) parts.push('売上の' + pct + '%')
  const auto = parts.join(' ＋ ')
  return {
    // 募集時に決めた歩合は「弊社の利益」として登録する。
    // 施設提供者に渡す分（取引先の取り分）は、管理画面の「料金」から別途設定する。
    company_fixed_amount: fixed,
    company_share_pct: pct,
    company_fixed_unit: unit,
    fee: (form.fee || '').trim() || auto || null,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function pickDetails(form: any) {
  const out: Record<string, unknown> = {}
  for (const k of DETAIL_KEYS) out[k] = form[k] ?? ''
  return out
}

function EditPlacePageInner() {
  const params = useParams()
  const id = params.id as string
  // 管理画面から開いた場合は、保存後も「戻る」も管理画面へ返す。
  // 管理者は募集者ダッシュボードに自分の案件を持たないため、
  // そちらへ飛ばすと空の画面に着いてしまう。
  const searchParams = useSearchParams()
  const backTo = searchParams.get('from') === 'admin' ? '/admin' : '/dashboard/host'
  const [form, setForm] = useState({
    type:'event', title:'', summary:'', deadline:'', image:null,
    format:'kitchen', prefecture:'', address:'', mapUrl:'', 募集内容:'',
    fee:'', feeFixed:'', feePct:'', feeUnit:'per_day', reminderDays:'7', visitors:'', loadIn:'', loadOut:'',
    menuWant:'', menuNG:'', menuOther:'', power:'yes', gas:'yes', water:'yes',
    trash:'self', eatSpace:'yes', location:'outdoor', heightLimit:'no', heightValue:'',
    rain:'go', rainNote:'', history:'no', parking:'yes', brand:'', notes:''
  })
  const [schedule, setSchedule] = useState<{date:string,start:string,end:string,placeFee?:number,companyFee?:number}[]>([{date:'', start:'選択してください', end:'選択してください'}])
  // 日ごとに金額を入れるかどうか
  const [perDayOn, setPerDayOn] = useState(false)
  const [genres, setGenres] = useState<string[]>([])
  const toggleGenre = (g:string) => setGenres(prev => prev.includes(g) ? prev.filter(x=>x!==g) : [...prev, g])
  // 登録済みの写真URL（先頭がサムネイル）。× で外せる。
  const [existingImages, setExistingImages] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const set = (k:string,v:string) => setForm(p=>({...p,[k]:v}))
  // 金額（placeFee / companyFee）は数値で持つ。空欄は未設定として消す。
  const setDay = (i:number,k:'date'|'start'|'end'|'placeFee'|'companyFee',v:string) => setSchedule(prev=>prev.map((d,idx)=>{
    if(idx!==i) return d
    if(k==='placeFee'||k==='companyFee'){
      const n = toYen(v)
      const next = {...d} as Record<string, unknown>
      if(n==null) delete next[k]; else next[k]=n
      return next as typeof d
    }
    return {...d,[k]:v}
  }))
  const addDay = () => setSchedule(prev=>prev.length<31 ? [...prev,{date:'',start:'選択してください',end:'選択してください'}] : prev)
  const removeDay = (i:number) => setSchedule(prev=>prev.filter((_,idx)=>idx!==i))
  const req = <span style={{background:'#F5A623',color:'#fff',fontSize:'11px',padding:'2px 8px',borderRadius:'999px',marginLeft:'8px',fontWeight:'700'}}>必須</span>

  const times = ['選択してください', ...Array.from({length:18},(_,i)=>i+6).flatMap(h=>[`${h}:00`,`${h}:30`])]
  const prefs = ['選択してください','北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県','茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県','新潟県','富山県','石川県','福井県','山梨県','長野県','岐阜県','静岡県','愛知県','三重県','滋賀県','京都府','大阪府','兵庫県','奈良県','和歌山県','鳥取県','島根県','岡山県','広島県','山口県','徳島県','香川県','愛媛県','高知県','福岡県','佐賀県','長崎県','熊本県','大分県','宮崎県','鹿児島県','沖縄県']
  const inputStyle = {width:'100%',border:'1px solid #E5C07B',borderRadius:'8px',padding:'10px 14px',fontSize:'14px',marginTop:'8px',boxSizing:'border-box' as const,color:'#1a1a1a',background:'#fff'}

  const router = useRouter()
  const [imageFiles, setImageFiles] = useState<File[]>([])
  // 募集者が手動で「急募」にできる（自動判定は開催7日前から）
  const [urgent, setUrgent] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errMsg, setErrMsg] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase.from('places').select('*').eq('id', id).single()
      if(error || !data) { setErrMsg('案件の読み込みに失敗しました'); setLoading(false); return }
      setForm(p => ({...p,
        type: data.place_type || 'event',
        title: data.title || '',
        summary: data.description || '',
        prefecture: data.prefecture || '',
        address: data.address || '',
        mapUrl: data.map_url || '',
        '募集内容': data.recruit || '',
        fee: data.fee || '',
        feeFixed: data.company_fixed_amount ? String(data.company_fixed_amount) : '',
        feePct: data.company_share_pct ? String(data.company_share_pct) : '',
        feeUnit: data.company_fixed_unit === 'per_event' ? 'per_event' : 'per_day',
        reminderDays: data.reminder_days != null ? String(data.reminder_days) : '7',
      }))
      // 詳細項目を復元する（未保存の案件は初期値のまま）
      if(data.details && typeof data.details === 'object') {
        setForm(p => {
          const next = {...p}
          for(const k of DETAIL_KEYS) {
            const v = (data.details as Record<string, unknown>)[k]
            if(v !== undefined && v !== null && v !== '') (next as Record<string, unknown>)[k] = v
          }
          return next
        })
      }
      if(Array.isArray(data.schedule) && data.schedule.length>0) setSchedule(data.schedule)
      if(hasPerDayFee(data.schedule)) setPerDayOn(true)
      if(Array.isArray(data.genres)) setGenres(data.genres)
      // images が未設定の古い案件は、image_url の1枚だけを持っているものとして扱う
      const imgs = Array.isArray(data.images) && data.images.length > 0
        ? (data.images as string[]).filter(Boolean)
        : (data.image_url ? [data.image_url] : [])
      setExistingImages(imgs)
      setUrgent(!!data.urgent)
      setLoading(false)
    }
    load()
  }, [id])

  const handleSubmit = async () => {
    setErrMsg('')
    if(!form.title || !form.prefecture || form.prefecture==='選択してください') {
      setErrMsg('イベント・施設名と都道府県は必須です'); return
    }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if(!user) { setErrMsg('ログインが必要です'); setSaving(false); return }

    // 残した写真 ＋ 新しく足した写真。並びはそのまま案件ページの並びになる。
    const imageUrls = [...existingImages]
    for(let i = 0; i < imageFiles.length; i++) {
      const f = imageFiles[i]
      const ext = f.name.split('.').pop()
      const path = user.id + '/' + Date.now() + '-' + i + '.' + ext
      const { error: upErr } = await supabase.storage.from('place-images').upload(path, f)
      if(upErr) { setErrMsg('画像アップロード失敗: ' + upErr.message); setSaving(false); return }
      const { data: pub } = supabase.storage.from('place-images').getPublicUrl(path)
      imageUrls.push(pub.publicUrl)
    }

    const geo = await geocodeAddress((form.prefecture || '') + (form.address || ''))
    const { error: updErr } = await supabase.from('places').update({
      title: form.title,
      description: form.summary,
      prefecture: form.prefecture,
      address: form.address,
      latitude: geo?.lat ?? null,
      longitude: geo?.lon ?? null,
      place_type: form.type,
      ...buildFeeColumns(form),
      reminder_days: parseInt(form.reminderDays, 10) || 7,
      map_url: form.mapUrl,
      recruit: form['募集内容'],
      schedule: schedule,
      genres: genres,
      image_url: imageUrls[0] || '',
      images: imageUrls,
      urgent: urgent,
      details: pickDetails(form),
    }).eq('id', id)
    if(updErr) { setErrMsg('更新失敗: ' + updErr.message); setSaving(false); return }
    router.push(backTo)
  }

  const Radio = ({name,val,label}:{name:string,val:string,label:string}) => (
    <label style={{display:'flex',alignItems:'center',gap:'6px',cursor:'pointer',fontSize:'14px'}}>
      <input type='radio' name={name} checked={form[name as keyof typeof form]===val} onChange={()=>set(name,val)} style={{accentColor:'#F5A623',color:'#1a1a1a'}}/>
      {label}
    </label>
  )

  if(loading) return <div style={{minHeight:'100vh',background:'#FFF9E6',display:'flex',alignItems:'center',justifyContent:'center',color:'#B45309',fontWeight:'700'}}>読み込み中...</div>

  return (
    <div style={{minHeight:'100vh',background:'#FFF9E6'}}>
      <div style={{maxWidth:'780px',margin:'0 auto',padding:'40px 24px'}}>
        <div style={{marginBottom:'16px'}}>
          <Link href={backTo} style={{display:'inline-flex',alignItems:'center',gap:'6px',background:'#fff',border:'1.5px solid #E2E8F0',borderRadius:'999px',padding:'8px 18px',fontSize:'13px',fontWeight:700,color:'#475569',textDecoration:'none'}}>← 戻る</Link>
        </div>
        <h1 style={{fontSize:'26px',fontWeight:'900',marginBottom:'8px',textAlign:'center',color:'#1a1a1a'}}>イベント編集</h1>
        <p style={{textAlign:'center',color:'#B45309',fontSize:'13px',marginBottom:'36px'}}>登録済みの内容を編集できます</p>

        <div style={{display:'flex',flexDirection:'column',gap:'24px'}}>

          <div style={{background:'#fff',borderRadius:'12px',border:'2px solid #FFE0A0',padding:'28px',boxShadow:'0 2px 12px rgba(245,166,35,0.1)'}}>
            <h2 style={{fontSize:'16px',fontWeight:'900',marginBottom:'20px',borderLeft:'4px solid #F5A623',paddingLeft:'10px',color:'#1a1a1a'}}>基本情報</h2>

            <div style={{marginBottom:'20px'}}>
              <label style={{fontWeight:'700',fontSize:'14px',color:'#1a1a1a'}}>種類{req}</label>
              <div style={{display:'flex',gap:'24px',marginTop:'10px'}}>
                <Radio name='type' val='event' label='イベント'/>
                <Radio name='type' val='regular' label='常設'/>
              </div>
            </div>

            <div style={{marginBottom:'20px'}}>
              <label style={{fontWeight:'700',fontSize:'14px',color:'#1a1a1a'}}>カテゴリー</label>
              <p style={{fontSize:'12px',color:'#B45309',margin:'4px 0 0'}}>当てはまるものを選んでください（複数選択可）。出店者の検索で使われます。</p>
              <div style={{display:'flex',flexWrap:'wrap',gap:'10px',marginTop:'10px'}}>
                {PLACE_CATEGORIES.map(g=>(
                  <label key={g} style={{display:'flex',alignItems:'center',gap:'6px',cursor:'pointer',fontSize:'13px',border:'1px solid #E5C07B',borderRadius:'999px',padding:'6px 12px',background:genres.includes(g)?'#FFF3D6':'#fff',color:'#1a1a1a'}}>
                    <input type='checkbox' checked={genres.includes(g)} onChange={()=>toggleGenre(g)} style={{accentColor:'#F5A623'}}/>
                    {g}
                  </label>
                ))}
              </div>
            </div>

            <div style={{marginBottom:'20px'}}>
              <label style={{fontWeight:'700',fontSize:'14px',color:'#1a1a1a'}}>イベント・施設名{req}</label>
              <input value={form.title} onChange={e=>set('title',e.target.value)} placeholder='例：春の収穫祭マルシェ' style={inputStyle}/>
            </div>

            <div style={{marginBottom:'20px'}}>
              <label style={{fontWeight:'700',fontSize:'14px',color:'#1a1a1a'}}>概要{req}</label>
              <textarea value={form.summary} onChange={e=>set('summary',e.target.value)} placeholder='イベントや施設の説明を入力してください。' rows={4} style={{...inputStyle,resize:'vertical'}}/>
            </div>

            <div style={{marginBottom:'20px'}}>
              <label style={{fontWeight:'700',fontSize:'14px',color:'#1a1a1a'}}>募集締め切り日{req}</label>
              <input type='date' value={form.deadline} onChange={e=>set('deadline',e.target.value)} style={inputStyle}/>
            </div>

            <div style={{marginBottom:'20px'}}>
              <label style={{fontWeight:'700',fontSize:'14px',color:'#1a1a1a'}}>出店日程{req}</label>
              <p style={{fontSize:'12px',color:'#B45309',margin:'4px 0 0'}}>1日ごとに日付と時間を登録できます（最大31日・連続でなくてもOK）</p>
              <div style={{display:'flex',flexDirection:'column',gap:'10px',marginTop:'10px'}}>
                {schedule.map((d,i)=>(
                  <div key={i} style={{border:'1px solid #E5C07B',borderRadius:'10px',padding:'12px',background:'#FFFDF7'}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'8px'}}>
                      <span style={{fontSize:'13px',fontWeight:'700',color:'#B45309'}}>{i+1}日目</span>
                      {schedule.length>1 && <button type='button' onClick={()=>removeDay(i)} style={{background:'#FEF2F2',color:'#DC2626',border:'none',borderRadius:'6px',padding:'4px 10px',fontSize:'12px',fontWeight:'700',cursor:'pointer'}}>削除</button>}
                    </div>
                    <input type='date' value={d.date} onChange={e=>setDay(i,'date',e.target.value)} style={{width:'100%',border:'1px solid #E5C07B',borderRadius:'8px',padding:'9px 12px',fontSize:'14px',boxSizing:'border-box',color:'#1a1a1a',background:'#fff'}}/>
                    <div className='form-grid-2' style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginTop:'8px'}}>
                      <div>
                        <label style={{fontSize:'12px',fontWeight:'700',color:'#64748B'}}>販売開始</label>
                        <select value={d.start} onChange={e=>setDay(i,'start',e.target.value)} style={{...inputStyle,marginTop:'4px'}}>{times.map(t=><option key={t}>{t}</option>)}</select>
                      </div>
                      <div>
                        <label style={{fontSize:'12px',fontWeight:'700',color:'#64748B'}}>販売終了</label>
                        <select value={d.end} onChange={e=>setDay(i,'end',e.target.value)} style={{...inputStyle,marginTop:'4px'}}>{times.map(t=><option key={t}>{t}</option>)}</select>
                      </div>
                    </div>
                    {/* 日によって金額が変わる案件（平日2,000円・週末3,000円など）向け。
                        入れた日はこの金額を使い、空欄の日は案件全体の設定を使う。 */}
                    {perDayOn && (
                      <div className='form-grid-2' style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginTop:'8px'}}>
                        <div>
                          <label style={{fontSize:'12px',fontWeight:'700',color:'#B45309'}}>取引先へ渡す額（円）</label>
                          <input inputMode='numeric' value={d.placeFee ?? ''} onChange={e=>setDay(i,'placeFee',e.target.value.replace(/[^0-9]/g,''))} placeholder='例：2000' style={{...inputStyle,marginTop:'4px'}}/>
                        </div>
                        <div>
                          <label style={{fontSize:'12px',fontWeight:'700',color:'#1D4ED8'}}>弊社の固定額（円）</label>
                          <input inputMode='numeric' value={d.companyFee ?? ''} onChange={e=>setDay(i,'companyFee',e.target.value.replace(/[^0-9]/g,''))} placeholder='空欄可' style={{...inputStyle,marginTop:'4px'}}/>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {/* 日によって金額が違う案件のための切り替え */}
              <label style={{display:'flex',alignItems:'center',gap:'8px',marginTop:'10px',fontSize:'13px',color:'#1a1a1a',cursor:'pointer'}}>
                <input type='checkbox' checked={perDayOn} onChange={e=>setPerDayOn(e.target.checked)} style={{accentColor:'#F5A623',cursor:'pointer'}}/>
                日によって金額を変える（平日2,000円・週末3,000円など）
              </label>
              {perDayOn && (
                <div style={{fontSize:'11px',color:'#64748B',marginTop:'6px',lineHeight:1.7}}>
                  金額を入れた日はその額を使います。空欄の日は「料金設定」の金額がそのまま使われます。
                </div>
              )}
              {schedule.length<31 && (
                <button type='button' onClick={addDay} style={{marginTop:'10px',background:'#fff',color:'#B45309',border:'1.5px dashed #F5A623',borderRadius:'8px',padding:'10px',fontSize:'13px',fontWeight:'700',cursor:'pointer',width:'100%'}}>＋ 日程を追加（{schedule.length}/31）</button>
              )}
            </div>

            {/* 開催日が先でも「今すぐ埋めたい」案件があるため、募集者が自分で急募にできる */}
            <div style={{marginBottom:'20px'}}>
              <label style={{display:'flex',alignItems:'flex-start',gap:'10px',cursor:'pointer',background:'#FFF1F1',border:'1.5px solid #FCA5A5',borderRadius:'10px',padding:'14px 16px'}}>
                <input type='checkbox' checked={urgent} onChange={e=>setUrgent(e.target.checked)} style={{marginTop:'3px',width:'16px',height:'16px',accentColor:'#d13b3b'}}/>
                <span>
                  <span style={{fontWeight:'700',fontSize:'14px',color:'#1a1a1a'}}>この案件を「急募」として表示する</span>
                  <span style={{display:'block',fontSize:'12px',color:'#64748B',marginTop:'4px',lineHeight:1.7}}>
                    トップページのカードに赤い「急募」バッジが付きます。チェックしなくても、開催日が7日以内になると自動で急募になります。
                  </span>
                </span>
              </label>
            </div>

            <div style={{marginBottom:'20px'}}>
              <label style={{fontWeight:'700',fontSize:'14px',color:'#1a1a1a'}}>イベント画像（最大4枚）</label>
              <PlaceImagePicker existing={existingImages} onChangeExisting={setExistingImages}
                files={imageFiles} onChangeFiles={setImageFiles} bandLabel={form.title} />
            </div>

            <div style={{marginBottom:'20px'}}>
              <label style={{fontWeight:'700',fontSize:'14px',color:'#1a1a1a'}}>出店形式{req}</label>
              <div style={{display:'flex',gap:'24px',marginTop:'10px'}}>
                <Radio name='format' val='kitchen' label='キッチンカー'/>
                <Radio name='format' val='tent' label='テント'/>
                <Radio name='format' val='both' label='両方'/>
              </div>
            </div>

            <div style={{marginBottom:'20px'}}>
              <label style={{fontWeight:'700',fontSize:'14px',color:'#1a1a1a'}}>出店場所の住所{req}</label>
              <select value={form.prefecture} onChange={e=>set('prefecture',e.target.value)} style={inputStyle}>
                {prefs.map(p=><option key={p}>{p}</option>)}
              </select>
              <input value={form.address} onChange={e=>set('address',e.target.value)} placeholder='○丁目○番地○号' style={inputStyle}/>
            </div>

            <div style={{marginBottom:'20px'}}>
              <label style={{fontWeight:'700',fontSize:'14px',color:'#1a1a1a'}}>Google Map URL</label>
              <input value={form.mapUrl} onChange={e=>set('mapUrl',e.target.value)} placeholder='https://maps.google.com/...' style={inputStyle}/>
            </div>

            <div>
              <label style={{fontWeight:'700',fontSize:'14px',color:'#1a1a1a'}}>募集内容{req}</label>
              <textarea value={form['募集内容']} onChange={e=>set('募集内容',e.target.value)} placeholder='キッチンカーブース5ブース、テント7ブース程度' rows={3} style={{...inputStyle,resize:'vertical'}}/>
            </div>
          </div>

          <div style={{background:'#fff',borderRadius:'12px',border:'2px solid #FFE0A0',padding:'28px',boxShadow:'0 2px 12px rgba(245,166,35,0.1)'}}>
            <h2 style={{fontSize:'16px',fontWeight:'900',marginBottom:'20px',borderLeft:'4px solid #F5A623',paddingLeft:'10px',color:'#1a1a1a'}}>出店条件・環境</h2>

            <div className='form-grid-2' style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px',marginBottom:'20px'}}>
              <div>
                <label style={{fontWeight:'700',fontSize:'14px',color:'#1a1a1a'}}>出店料の表示文（任意）</label>
                <input value={form.fee} onChange={e=>set('fee',e.target.value)} placeholder='未入力なら下の金額から自動で作ります' style={inputStyle}/>
              </div>
              <div>
                <label style={{fontWeight:'700',fontSize:'14px',color:'#1a1a1a'}}>動員目標</label>
                <input value={form.visitors} onChange={e=>set('visitors',e.target.value)} placeholder='例：200名' style={inputStyle}/>
              </div>

            <div className='form-grid-2' style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px',marginBottom:'8px'}}>
              <div>
                <label style={{fontWeight:'700',fontSize:'14px',color:'#1a1a1a'}}>出店料（1日あたりの固定額）</label>
                <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                  <input type='number' value={form.feeFixed} onChange={e=>set('feeFixed',e.target.value)} placeholder='例：10000' style={inputStyle}/>
                  <span style={{fontSize:'14px',color:'#555',whiteSpace:'nowrap'}}>円</span>
                </div>
              </div>
              <div>
                <label style={{fontWeight:'700',fontSize:'14px',color:'#1a1a1a'}}>売上歩合</label>
                <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                  <input type='number' value={form.feePct} onChange={e=>set('feePct',e.target.value)} placeholder='例：15' style={inputStyle}/>
                  <span style={{fontSize:'14px',color:'#555',whiteSpace:'nowrap'}}>%</span>
                </div>
              </div>
            </div>
            <div style={{marginBottom:'8px'}}>
              <label style={{fontSize:'13px',color:'#555',display:'inline-flex',alignItems:'center',gap:'6px',cursor:'pointer'}}>
                <input type='checkbox' checked={form.feeUnit==='per_event'} onChange={e=>set('feeUnit', e.target.checked ? 'per_event' : 'per_day')} style={{accentColor:'#F5A623'}}/>
                固定額は1日ごとではなく、期間で1回のみ
              </label>
            </div>
            <div style={{background:'#FFFBEB',border:'1px solid #FDE68A',borderRadius:'8px',padding:'10px 14px',fontSize:'12px',color:'#B45309',lineHeight:1.8,marginBottom:'20px'}}>
              ここで入力した金額が、出店者の売上報告の計算にそのまま使われます。<br/>
              {(() => {
                const fx = parseInt((form.feeFixed||'').replace(/[^0-9]/g,''),10)||0
                const pc = parseFloat((form.feePct||'').replace(/[^0-9.]/g,''))||0
                if (fx===0 && pc===0) return '※ 未入力のままだと、売上を報告しても出店料が0円になります。'
                const base = Math.floor(30000/1.08)
                const total = fx + Math.floor(base*pc/100)
                return '例：売上30,000円のとき、この設定分は約' + total.toLocaleString() + '円です（税抜換算8%）。施設提供者へお渡しする分がある場合は、運営が別途加算します。'
              })()}
            </div>
            </div>

            <div style={{marginBottom:'20px'}}>
              <label style={{fontWeight:'700',fontSize:'14px',color:'#1a1a1a'}}>リマインド通知（出店日の何日前から出店者に表示するか）</label>
              <input type='number' min='0' value={form.reminderDays} onChange={e=>set('reminderDays',e.target.value)} placeholder='例：7' style={{...inputStyle, maxWidth:'200px'}}/>
              <div style={{fontSize:'12px',color:'#64748B',marginTop:'4px'}}>未入力の場合は7日前から表示されます。急ぎの案件は短め（3日など）に設定できます。</div>
            </div>

            <div className='form-grid-2' style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px',marginBottom:'20px'}}>
              <div>
                <label style={{fontWeight:'700',fontSize:'14px',color:'#1a1a1a'}}>搬入時間{req}</label>
                <select value={form.loadIn} onChange={e=>set('loadIn',e.target.value)} style={inputStyle}>
                  {times.map(t=><option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{fontWeight:'700',fontSize:'14px',color:'#1a1a1a'}}>搬出時間{req}</label>
                <select value={form.loadOut} onChange={e=>set('loadOut',e.target.value)} style={inputStyle}>
                  {times.map(t=><option key={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div className='form-grid-3' style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'16px',marginBottom:'20px'}}>
              <div>
                <label style={{fontWeight:'700',fontSize:'14px',color:'#1a1a1a'}}>希望メニュー</label>
                <input value={form.menuWant} onChange={e=>set('menuWant',e.target.value)} placeholder='例：たこ焼き、クレープ' style={inputStyle}/>
              </div>
              <div>
                <label style={{fontWeight:'700',fontSize:'14px',color:'#1a1a1a'}}>NGメニュー</label>
                <input value={form.menuNG} onChange={e=>set('menuNG',e.target.value)} placeholder='例：酒' style={inputStyle}/>
              </div>
              <div>
                <label style={{fontWeight:'700',fontSize:'14px',color:'#1a1a1a'}}>他の出店予定メニュー</label>
                <input value={form.menuOther} onChange={e=>set('menuOther',e.target.value)} placeholder='例：焼きそば' style={inputStyle}/>
              </div>
            </div>

            <div className='form-grid-4' style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'16px',marginBottom:'20px'}}>
              {[{k:'power',l:'電源'},{k:'gas',l:'ガス機器'},{k:'water',l:'水道設備'},{k:'eatSpace',l:'飲食スペース'}].map(item=>(
                <div key={item.k}>
                  <label style={{fontWeight:'700',fontSize:'14px',color:'#1a1a1a'}}>{item.l}{req}</label>
                  <div style={{display:'flex',gap:'16px',marginTop:'10px'}}>
                    <Radio name={item.k} val='yes' label='有り'/>
                    <Radio name={item.k} val='no' label='無し'/>
                  </div>
                </div>
              ))}
            </div>

            <div style={{marginBottom:'20px'}}>
              <label style={{fontWeight:'700',fontSize:'14px',color:'#1a1a1a'}}>ゴミの処理{req}</label>
              <div style={{display:'flex',gap:'24px',marginTop:'10px'}}>
                <Radio name='trash' val='self' label='各自'/>
                <Radio name='trash' val='host' label='主催者処理'/>
              </div>
            </div>

            <div style={{marginBottom:'20px'}}>
              <label style={{fontWeight:'700',fontSize:'14px',color:'#1a1a1a'}}>屋内 / 屋外{req}</label>
              <div style={{display:'flex',gap:'24px',marginTop:'10px',flexWrap:'wrap'}}>
                <Radio name='location' val='outdoor' label='屋外'/>
                <Radio name='location' val='outdoor_roof' label='屋外（屋根あり）'/>
                <Radio name='location' val='indoor' label='屋内'/>
              </div>
            </div>

            <div style={{marginBottom:'20px'}}>
              <label style={{fontWeight:'700',fontSize:'14px',color:'#1a1a1a'}}>高さ制限{req}</label>
              <div style={{display:'flex',gap:'24px',alignItems:'center',marginTop:'10px'}}>
                <Radio name='heightLimit' val='no' label='無し'/>
                <Radio name='heightLimit' val='yes' label='有り'/>
                {form.heightLimit==='yes' && <input value={form.heightValue} onChange={e=>set('heightValue',e.target.value)} placeholder='例：3m' style={{border:'1px solid #E5E7EB',borderRadius:'8px',padding:'8px 12px',fontSize:'14px',width:'100px'}}/>}
              </div>
            </div>

            <div style={{marginBottom:'20px'}}>
              <label style={{fontWeight:'700',fontSize:'14px',color:'#1a1a1a'}}>雨天時の対応{req}</label>
              <div style={{display:'flex',gap:'24px',alignItems:'center',marginTop:'10px',flexWrap:'wrap'}}>
                <Radio name='rain' val='go' label='雨天決行'/>
                <Radio name='rain' val='cancel' label='中止'/>
                <Radio name='rain' val='other' label='その他'/>
                {form.rain==='other' && <input value={form.rainNote} onChange={e=>set('rainNote',e.target.value)} placeholder='例：小雨の場合は開催' style={{border:'1px solid #E5E7EB',borderRadius:'8px',padding:'8px 12px',fontSize:'14px',width:'200px'}}/>}
              </div>
            </div>

            <div className='form-grid-2' style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px',marginBottom:'20px'}}>
              <div>
                <label style={{fontWeight:'700',fontSize:'14px',color:'#1a1a1a'}}>過去の開催実績</label>
                <div style={{display:'flex',gap:'24px',marginTop:'10px'}}>
                  <Radio name='history' val='no' label='無し'/>
                  <Radio name='history' val='yes' label='有り'/>
                </div>
              </div>
              <div>
                <label style={{fontWeight:'700',fontSize:'14px',color:'#1a1a1a'}}>車両の留め置き{req}</label>
                <div style={{display:'flex',gap:'24px',marginTop:'10px'}}>
                  <Radio name='parking' val='yes' label='可'/>
                  <Radio name='parking' val='no' label='不可'/>
                </div>
              </div>
            </div>

            <div style={{marginBottom:'20px'}}>
              <label style={{fontWeight:'700',fontSize:'14px',color:'#1a1a1a'}}>ブランドコントロール / 販売禁止物</label>
              <input value={form.brand} onChange={e=>set('brand',e.target.value)} placeholder='例：競合ブランドの商品販売禁止' style={inputStyle}/>
            </div>

            <div>
              <label style={{fontWeight:'700',fontSize:'14px',color:'#1a1a1a'}}>備考・要望等</label>
              <textarea value={form.notes} onChange={e=>set('notes',e.target.value)} rows={4} placeholder='その他ご要望があればご記入ください' style={{...inputStyle,resize:'vertical'}}/>
            </div>
          </div>

          {errMsg && <div style={{background:'#FEF2F2',border:'1px solid #FECACA',borderRadius:'8px',padding:'12px',fontSize:'13px',color:'#DC2626',textAlign:'center'}}>{errMsg}</div>}
          <div style={{display:'flex',gap:'16px',justifyContent:'center',paddingBottom:'40px',flexWrap:'wrap'}}>
            <Link href={backTo} style={{border:'2px solid #E5E7EB',color:'#555',borderRadius:'999px',padding:'14px 40px',fontSize:'15px',fontWeight:'700',textDecoration:'none'}}>戻る</Link>
            <button onClick={handleSubmit} disabled={saving} style={{background:saving?'#ccc':'#F5A623',color:'#fff',border:'none',borderRadius:'999px',padding:'14px 48px',fontSize:'15px',fontWeight:'900',cursor:saving?'not-allowed':'pointer',boxShadow:'0 4px 15px rgba(245,166,35,0.4)'}}>{saving?'保存中...':'変更を保存'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// useSearchParams を使うページは Suspense で包まないと本番ビルドが失敗する
export default function EditPlacePage() {
  return (
    <Suspense fallback={<div style={{minHeight:'100vh',background:'#FFF9E6',display:'flex',alignItems:'center',justifyContent:'center',color:'#B45309',fontWeight:'700'}}>読み込み中...</div>}>
      <EditPlacePageInner />
    </Suspense>
  )
}
