'use client'
import Link from 'next/link'
import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import { isWeekendOrHoliday } from '../../../lib/jpHoliday'
import FormatFeesEditor, { type FormatFeesValue } from '../../../components/FormatFeesEditor'
import DowPresets from '../../../components/DowPresets'
import { geocodeAddress } from '../../../lib/geocode'
import { PLACE_CATEGORIES } from '../../../lib/categories'
import { toYen } from '../../../lib/placeFee'
import PlaceImagePicker from '../../../components/PlaceImagePicker'


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

function NewPlacePageInner() {
  // 管理画面から開いた場合は管理画面へ返す。
  // 管理者は募集者ダッシュボードに自分の案件を持たないため、空の画面に着いてしまう。
  const searchParams = useSearchParams()
  const backTo = searchParams.get('from') === 'admin' ? '/admin' : '/dashboard/host'

  const [form, setForm] = useState({
    type:'event', title:'', summary:'', deadline:'', image:null,
    format:'kitchen', prefecture:'', address:'', mapUrl:'', 募集内容:'',
    fee:'', feeFixed:'', feePct:'10', feeUnit:'per_day', reminderDays:'7', visitors:'', loadIn:'', loadOut:'',
    menuWant:'', menuNG:'', menuOther:'', power:'yes', gas:'yes', water:'yes',
    trash:'self', eatSpace:'yes', location:'outdoor', heightLimit:'no', heightValue:'',
    rain:'go', rainNote:'', history:'no', parking:'yes', brand:'', notes:''
  })
  const [schedule, setSchedule] = useState<{date:string,start:string,end:string,placeFee?:number,companyFee?:number}[]>([{date:'', start:'選択してください', end:'選択してください'}])
  // 日ごとに金額を入れるかどうか
  const [perDayOn, setPerDayOn] = useState(false)
  const [genres, setGenres] = useState<string[]>([])
  const toggleGenre = (g:string) => setGenres(prev => prev.includes(g) ? prev.filter(x=>x!==g) : [...prev, g])
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

  // ===== 日程をまとめて入れる =====
  //
  // 毎日出る案件では31日ぶんを1つずつ入れることになり、
  // 日付と時間を31回選ぶだけで相当な手間になっていた。
  // 1日ぶん作れば、あとは複製か期間の指定で埋められるようにする。

  // 日付の足し算。文字列のまま扱うと月またぎで壊れるので、
  // いったん日付に直してから足す。時刻を付けないのは、
  // 時差の影響で前日にずれるのを避けるため
  const addDays = (iso:string, n:number) => {
    const [y,m,d] = iso.split('-').map(Number)
    if(!y||!m||!d) return ''
    const t = new Date(y, m-1, d+n)
    return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`
  }

  // その1日ぶんを、翌日の日付でうしろに差し込む。
  // 連続した日程を作るとき、日付だけ選び直せば済む
  const duplicateDay = (i:number) => setSchedule(prev=>{
    if(prev.length>=31) return prev
    const src = prev[i]
    const copy = { ...src, date: src.date ? addDays(src.date, 1) : '' }
    return [...prev.slice(0,i+1), copy, ...prev.slice(i+1)]
  })

  // 期間と曜日を指定して、まとめて入れる
  const [bulkFrom, setBulkFrom] = useState('')
  const [bulkTo, setBulkTo] = useState('')
  // 曜日は日曜=0。既定は全部の曜日
  const [bulkDows, setBulkDows] = useState<number[]>([0,1,2,3,4,5,6])
  const [bulkStart, setBulkStart] = useState('選択してください')
  const [bulkEnd, setBulkEnd] = useState('選択してください')
  const [bulkOpen, setBulkOpen] = useState(false)
  // まとめて入れる日の料金。入れた金額を、追加する全部の日に同じように入れる。
  // これが無いと、31日ぶん追加したあとに1日ずつ金額を打ち直すことになる
  const [bulkPlaceFee, setBulkPlaceFee] = useState('')
  const [bulkCompanyFee, setBulkCompanyFee] = useState('')
  // 平日と土日祝で金額が違う案件が多い。1回の操作で両方入れられるようにする。
  // 分けないときは、上の2つの金額を全部の日に入れる
  const [bulkSplit, setBulkSplit] = useState(false)
  const [bulkWePlaceFee, setBulkWePlaceFee] = useState('')
  const [bulkWeCompanyFee, setBulkWeCompanyFee] = useState('')

  // 毎月おなじ条件で翌月の日程を足す設定。
  // 常設の案件では毎月31日ぶんを手で入れ直していて、入れ忘れると募集が止まる
  const [repOn, setRepOn] = useState(false)
  const [repDows, setRepDows] = useState<number[]>([0,1,2,3,4,5,6])
  const [repStart, setRepStart] = useState('選択してください')
  const [repEnd, setRepEnd] = useState('選択してください')
  const [repPlaceFee, setRepPlaceFee] = useState('')
  const [repCompanyFee, setRepCompanyFee] = useState('')
  const [repLastAt, setRepLastAt] = useState<string | null>(null)
  const [repLastAdded, setRepLastAdded] = useState<number | null>(null)

  // 形態（キッチンカー・物販・催事PR）ごとの出店料と条件。
  // 以前はキッチンカーの金額しか入れられず、物販・催事PRは概要欄に文章で書いていた
  const [formatFees, setFormatFees] = useState<FormatFeesValue>({})

  // その条件で入る日付。押す前に件数を出すため、画面からも使う
  const bulkDates = (() => {
    if(!bulkFrom || !bulkTo) return [] as string[]
    const out:string[] = []
    // すでに入っている日付は入れ直さない（同じ日が二重に並ぶのを防ぐ）
    const already = new Set(schedule.map(d=>d.date).filter(Boolean))
    let cur = bulkFrom
    // 上限は31日ぶん。それ以上さかのぼらないよう、回す回数にも上限を置く
    for(let guard=0; guard<400 && cur <= bulkTo; guard++){
      const [y,m,d] = cur.split('-').map(Number)
      const dow = new Date(y, m-1, d).getDay()
      if(bulkDows.includes(dow) && !already.has(cur)) out.push(cur)
      cur = addDays(cur, 1)
      if(!cur) break
    }
    return out
  })()

  // 空のままの行（1日ぶんも入力していない最初の行）は、まとめて入れるときに捨てる
  const applyBulk = () => {
    const dates = bulkDates
    if(dates.length===0) return
    setSchedule(prev=>{
      const kept = prev.filter(d=>d.date)
      const room = 31 - kept.length
      const num = (v:string) => v.trim() === '' ? undefined : Number(v)
      const wdPf = num(bulkPlaceFee), wdCf = num(bulkCompanyFee)
      const wePf = bulkSplit ? num(bulkWePlaceFee) : wdPf
      const weCf = bulkSplit ? num(bulkWeCompanyFee) : wdCf
      return [...kept, ...dates.slice(0, Math.max(0, room)).map(date=>{
        // 土日祝はもう一方の金額を使う（祝日も土日と同じ扱い）
        const we = isWeekendOrHoliday(date)
        const pf = we ? wePf : wdPf
        const cf = we ? weCf : wdCf
        return {
          date, start: bulkStart, end: bulkEnd,
          ...(pf != null ? { placeFee: pf } : {}),
          ...(cf != null ? { companyFee: cf } : {}),
        }
      })]
    })
    // 金額を入れたのに入力欄が閉じていると、入った金額が見えない
    if([bulkPlaceFee, bulkCompanyFee, bulkWePlaceFee, bulkWeCompanyFee].some(v=>v.trim() !== '')) setPerDayOn(true)
    setBulkOpen(false)
  }
  const req = <span style={{background:'#F5A623',color:'#fff',fontSize:'11px',padding:'2px 8px',borderRadius:'999px',marginLeft:'8px',fontWeight:'700'}}>必須</span>

  const times = ['選択してください', ...Array.from({length:18},(_,i)=>i+6).flatMap(h=>[`${h}:00`,`${h}:30`])]
  const prefs = ['選択してください','北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県','茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県','新潟県','富山県','石川県','福井県','山梨県','長野県','岐阜県','静岡県','愛知県','三重県','滋賀県','京都府','大阪府','兵庫県','奈良県','和歌山県','鳥取県','島根県','岡山県','広島県','山口県','徳島県','香川県','愛媛県','高知県','福岡県','佐賀県','長崎県','熊本県','大分県','宮崎県','鹿児島県','沖縄県']
  const inputStyle = {width:'100%',border:'1px solid #E5C07B',borderRadius:'8px',padding:'10px 14px',fontSize:'14px',marginTop:'8px',boxSizing:'border-box' as const,color:'#1a1a1a',background:'#fff'}

  const router = useRouter()
  // 写真は最大4枚。1枚目が一覧に出るサムネイルになる。
  const [imageFiles, setImageFiles] = useState<File[]>([])
  // 募集者が手動で「急募」にできる（自動判定は開催7日前から）
  const [urgent, setUrgent] = useState(false)
  const [saving, setSaving] = useState(false)
  const [errMsg, setErrMsg] = useState('')

  const handleSubmit = async () => {
    setErrMsg('')
    if(!form.title || !form.prefecture || form.prefecture==='選択してください') {
      setErrMsg('イベント・施設名と都道府県は必須です'); return
    }
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if(!user) { setErrMsg('ログインが必要です'); setSaving(false); return }

    // 選んだ写真を順番にアップロードする。並び順は画面の並びのまま。
    const imageUrls: string[] = []
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
    const { error: insErr } = await supabase.from('places').insert({
      host_id: user.id,
      title: form.title,
      description: form.summary,
      prefecture: form.prefecture,
      address: form.address,
      place_type: form.type,
      ...buildFeeColumns(form),
      reminder_days: parseInt(form.reminderDays, 10) || 7,
      map_url: form.mapUrl,
      recruit: form['募集内容'],
      schedule: schedule,
      // 毎月おなじ条件で翌月の日程を足す設定
      repeat_monthly: repOn,
      repeat_dows: repOn ? repDows : null,
      repeat_start: repOn && repStart !== '選択してください' ? repStart : null,
      repeat_end: repOn && repEnd !== '選択してください' ? repEnd : null,
      repeat_place_fee: repOn && repPlaceFee.trim() !== '' ? Number(repPlaceFee) : null,
      repeat_company_fee: repOn && repCompanyFee.trim() !== '' ? Number(repCompanyFee) : null,
      // 形態ごとの出店料。1つも入れていなければ null（案件全体の設定を使う）
      format_fees: Object.keys(formatFees).length > 0 ? formatFees : null,
      genres: genres,
      image_url: imageUrls[0] || '',
      images: imageUrls,
      urgent: urgent,
      latitude: geo?.lat ?? null,
      longitude: geo?.lon ?? null,
      status: 'published',
      details: pickDetails(form),
    })
    if(insErr) { setErrMsg('登録失敗: ' + insErr.message); setSaving(false); return }
    await refreshPublicPages()
    router.push(backTo)
  }

// 保存した内容を公開ページにすぐ反映させる（キャッシュを作り直す）
async function refreshPublicPages(placeId?: string) {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) return
    await fetch('/api/revalidate-place', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ placeId }),
    })
  } catch { /* 反映が遅れるだけなので、失敗しても保存は成功として扱う */ }
}

  const Radio = ({name,val,label}:{name:string,val:string,label:string}) => (
    <label style={{display:'flex',alignItems:'center',gap:'6px',cursor:'pointer',fontSize:'14px'}}>
      <input type='radio' name={name} checked={form[name as keyof typeof form]===val} onChange={()=>set(name,val)} style={{accentColor:'#F5A623',color:'#1a1a1a'}}/>
      {label}
    </label>
  )

  return (
    <div style={{minHeight:'100vh',background:'#FFF9E6'}}>
      <div style={{maxWidth:'780px',margin:'0 auto',padding:'40px 24px'}}>
        <div style={{marginBottom:'16px'}}>
          <Link href={backTo} style={{display:'inline-flex',alignItems:'center',gap:'6px',background:'#fff',border:'1.5px solid #E2E8F0',borderRadius:'999px',padding:'8px 18px',fontSize:'13px',fontWeight:700,color:'#475569',textDecoration:'none'}}>← 戻る</Link>
        </div>
        <h1 style={{fontSize:'26px',fontWeight:'900',marginBottom:'8px',textAlign:'center',color:'#1a1a1a'}}>イベント・場所登録</h1>
        <p style={{textAlign:'center',color:'#B45309',fontSize:'13px',marginBottom:'36px'}}>出店者を募集するための情報を登録してください</p>

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
                      <div style={{display:'flex',gap:'6px'}}>
                        {/* この1日ぶんを、翌日の日付でうしろに差し込む。
                            連続した日程は、これを押して日付を直すほうが早い */}
                        {schedule.length<31 && <button type='button' onClick={()=>duplicateDay(i)} title='この日の内容を、翌日の日付でうしろに増やします' style={{background:'#EFF6FF',color:'#1D4ED8',border:'none',borderRadius:'6px',padding:'4px 10px',fontSize:'12px',fontWeight:'700',cursor:'pointer',fontFamily:'inherit'}}>複製</button>}
                        {schedule.length>1 && <button type='button' onClick={()=>removeDay(i)} style={{background:'#FEF2F2',color:'#DC2626',border:'none',borderRadius:'6px',padding:'4px 10px',fontSize:'12px',fontWeight:'700',cursor:'pointer'}}>削除</button>}
                      </div>
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
              {/* 期間と曜日を指定して、まとめて入れる。
                  毎日出る案件だと31日ぶんを1つずつ選ぶことになり、
                  日付と時間を31回選ぶだけで相当な手間になっていた */}
              <div style={{marginTop:'10px',border:'1.5px solid #BFDBFE',borderRadius:'10px',background:'#F8FBFF',overflow:'hidden'}}>
                <button type='button' onClick={()=>setBulkOpen(v=>!v)} style={{width:'100%',display:'flex',alignItems:'center',justifyContent:'space-between',gap:'10px',background:'transparent',border:'none',padding:'12px 14px',fontSize:'13px',fontWeight:'700',color:'#1D4ED8',cursor:'pointer',textAlign:'left',fontFamily:'inherit',minHeight:'44px'}}>
                  <span>📅 期間を指定して、まとめて追加</span>
                  <span style={{fontSize:'11.5px',fontWeight:700}}>{bulkOpen ? '閉じる ▲' : '開く ▼'}</span>
                </button>
                {bulkOpen && (
                  <div style={{padding:'0 14px 14px'}}>
                    <p style={{fontSize:'12px',color:'#64748B',lineHeight:1.8,margin:'0 0 10px'}}>
                      1か月ぶんをまとめて入れられます。曜日を選べば「平日だけ」「土日だけ」も作れます。
                    </p>
                    <div className='form-grid-2' style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
                      <div>
                        <label style={{fontSize:'12px',fontWeight:'700',color:'#64748B'}}>開始日</label>
                        <input type='date' value={bulkFrom} onChange={e=>setBulkFrom(e.target.value)} style={{...inputStyle,marginTop:'4px'}}/>
                      </div>
                      <div>
                        <label style={{fontSize:'12px',fontWeight:'700',color:'#64748B'}}>終了日</label>
                        <input type='date' value={bulkTo} onChange={e=>setBulkTo(e.target.value)} style={{...inputStyle,marginTop:'4px'}}/>
                      </div>
                    </div>

                    <div style={{marginTop:'12px'}}>
                      <label style={{fontSize:'12px',fontWeight:'700',color:'#64748B'}}>出店する曜日</label>
                      <div style={{display:'flex',gap:'6px',flexWrap:'wrap',marginTop:'6px'}}>
                        {['日','月','火','水','木','金','土'].map((w,idx)=>{
                          const on = bulkDows.includes(idx)
                          return (
                            <button key={w} type='button'
                              onClick={()=>setBulkDows(prev=>on ? prev.filter(x=>x!==idx) : [...prev,idx])}
                              style={{minWidth:'44px',minHeight:'44px',borderRadius:'8px',border:on?'1.5px solid #1D4ED8':'1.5px solid #E2E8F0',background:on?'#1D4ED8':'#fff',color:on?'#fff':(idx===0?'#DC2626':idx===6?'#1D4ED8':'#64748B'),fontSize:'13px',fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
                              {w}
                            </button>
                          )
                        })}
                      </div>
                      {/* 曜日のまとめ選び。形態ごとの「出られる曜日」でも
                          同じものを使っている（app/components/DowPresets.tsx） */}
                      <DowPresets current={bulkDows} onPick={setted => setBulkDows(setted)} />
                    </div>

                    <div className='form-grid-2' style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginTop:'12px'}}>
                      <div>
                        <label style={{fontSize:'12px',fontWeight:'700',color:'#64748B'}}>販売開始</label>
                        <select value={bulkStart} onChange={e=>setBulkStart(e.target.value)} style={{...inputStyle,marginTop:'4px'}}>{times.map(t=><option key={t}>{t}</option>)}</select>
                      </div>
                      <div>
                        <label style={{fontSize:'12px',fontWeight:'700',color:'#64748B'}}>販売終了</label>
                        <select value={bulkEnd} onChange={e=>setBulkEnd(e.target.value)} style={{...inputStyle,marginTop:'4px'}}>{times.map(t=><option key={t}>{t}</option>)}</select>
                      </div>
                    </div>

                    {/* 追加する日に金額も入れる。
                        ここが無いと、31日ぶん入れたあとに1日ずつ打ち直すことになっていた。
                        平日と土日祝で金額が違う案件が多いので、1回で両方入れられるようにする */}
                    <div style={{marginTop:'12px',paddingTop:'12px',borderTop:'1px solid #DBEAFE'}}>
                      <label style={{fontSize:'12px',fontWeight:'700',color:'#64748B'}}>この期間の料金（任意）</label>

                      <label style={{display:'flex',alignItems:'center',gap:'8px',marginTop:'8px',marginBottom:'8px',cursor:'pointer'}}>
                        <input type='checkbox' checked={bulkSplit} onChange={e=>setBulkSplit(e.target.checked)} style={{width:'18px',height:'18px',accentColor:'#1D4ED8',cursor:'pointer'}}/>
                        <span style={{fontSize:'12.5px',fontWeight:700,color:'#1D4ED8'}}>平日と土日祝で金額を分ける</span>
                      </label>

                      <div style={{background:'#fff',border:'1px solid #DBEAFE',borderRadius:'8px',padding:'10px 12px'}}>
                        <div style={{fontSize:'12px',fontWeight:800,color:'#334155',marginBottom:'6px'}}>{bulkSplit ? '平日の金額' : '金額'}</div>
                        <div className='form-grid-2' style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
                          <div>
                            <label style={{fontSize:'12px',fontWeight:'700',color:'#B45309'}}>取引先へ渡す額（円）</label>
                            <input inputMode='numeric' value={bulkPlaceFee} onChange={e=>setBulkPlaceFee(e.target.value.replace(/[^0-9]/g,''))} placeholder='例：2000' style={{...inputStyle,marginTop:'4px'}}/>
                          </div>
                          <div>
                            <label style={{fontSize:'12px',fontWeight:'700',color:'#1D4ED8'}}>弊社の固定額（円）</label>
                            <input inputMode='numeric' value={bulkCompanyFee} onChange={e=>setBulkCompanyFee(e.target.value.replace(/[^0-9]/g,''))} placeholder='空欄可' style={{...inputStyle,marginTop:'4px'}}/>
                          </div>
                        </div>
                      </div>

                      {bulkSplit && (
                        <div style={{background:'#fff',border:'1px solid #FECACA',borderRadius:'8px',padding:'10px 12px',marginTop:'8px'}}>
                          <div style={{fontSize:'12px',fontWeight:800,color:'#DC2626',marginBottom:'6px'}}>土日祝の金額</div>
                          <div className='form-grid-2' style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
                            <div>
                              <label style={{fontSize:'12px',fontWeight:'700',color:'#B45309'}}>取引先へ渡す額（円）</label>
                              <input inputMode='numeric' value={bulkWePlaceFee} onChange={e=>setBulkWePlaceFee(e.target.value.replace(/[^0-9]/g,''))} placeholder='例：3000' style={{...inputStyle,marginTop:'4px'}}/>
                            </div>
                            <div>
                              <label style={{fontSize:'12px',fontWeight:'700',color:'#1D4ED8'}}>弊社の固定額（円）</label>
                              <input inputMode='numeric' value={bulkWeCompanyFee} onChange={e=>setBulkWeCompanyFee(e.target.value.replace(/[^0-9]/g,''))} placeholder='空欄可' style={{...inputStyle,marginTop:'4px'}}/>
                            </div>
                          </div>
                        </div>
                      )}

                      <div style={{fontSize:'11px',color:'#64748B',marginTop:'8px',lineHeight:1.8}}>
                        {bulkSplit
                          ? <>追加する日のうち、土日と祝日には「土日祝の金額」、それ以外には「平日の金額」が入ります。<br />空欄のままの欄は「料金設定」の金額が使われます。</>
                          : <>入れると、追加する{bulkDates.length>0 ? bulkDates.length + '日' : 'すべての日'}に同じ金額が入ります。空欄のままなら「料金設定」の金額が使われます。</>}
                      </div>
                      {bulkSplit && bulkDates.length > 0 && (
                        <div style={{fontSize:'11.5px',color:'#334155',marginTop:'6px',fontWeight:700}}>
                          内訳：平日 {bulkDates.filter(d=>!isWeekendOrHoliday(d)).length}日 ／ 土日祝 {bulkDates.filter(d=>isWeekendOrHoliday(d)).length}日
                        </div>
                      )}
                    </div>

                    {/* 押す前に、何日ぶん入るかを出す。
                        31日を超えるぶんは入らないので、そのことも先に伝える */}
                    <div style={{marginTop:'12px',fontSize:'12.5px',color:'#334155',lineHeight:1.9}}>
                      {(!bulkFrom || !bulkTo)
                        ? '開始日と終了日を選んでください。'
                        : bulkDates.length===0
                          ? '選んだ条件に当てはまる日がありません。曜日か期間をご確認ください。'
                          : <><strong>{bulkDates.length}日ぶん</strong>を追加します（{bulkDates[0].replace(/-/g,'/')} 〜 {bulkDates[bulkDates.length-1].replace(/-/g,'/')}）。
                              {bulkDates.length > 31 && <span style={{color:'#DC2626'}}><br />上限は31日までです。先頭から31日ぶんだけ入ります。</span>}
                              <br /><span style={{color:'#94A3B8'}}>すでに入れてある日付は飛ばします。日付が空の行は置き換わります。</span></>}
                    </div>

                    <button type='button' onClick={applyBulk} disabled={bulkDates.length===0}
                      style={{marginTop:'10px',background:bulkDates.length===0?'#ccc':'#1D4ED8',color:'#fff',border:'none',borderRadius:'8px',padding:'11px 20px',fontSize:'13px',fontWeight:900,cursor:bulkDates.length===0?'not-allowed':'pointer',fontFamily:'inherit',minHeight:'44px'}}>
                      この条件で追加する
                    </button>
                  </div>
                )}
              </div>

              {/* 形態ごとの出店料と条件。
                  以前はキッチンカーの金額しか入れられず、物販・催事PRは
                  概要欄に文章で書いていた。文章だと出店者が見落とし、
                  売上の計算にも入らなかった */}
              <div style={{marginTop:'10px'}}>
                <FormatFeesEditor value={formatFees} onChange={setFormatFees} />
              </div>

              {/* 毎月おなじ条件で翌月の日程を足す。
                  常設の案件では毎月31日ぶんを手で入れ直していた */}
              <div style={{marginTop:'10px',border:'1.5px solid #A7F3D0',borderRadius:'10px',background:'#F0FDF4',padding:'12px 14px'}}>
                <label style={{display:'flex',alignItems:'flex-start',gap:'8px',cursor:'pointer'}}>
                  <input type='checkbox' checked={repOn} onChange={e=>setRepOn(e.target.checked)} style={{marginTop:'3px',width:'18px',height:'18px',flexShrink:0,accentColor:'#16A34A'}}/>
                  <span style={{fontSize:'13px',fontWeight:700,color:'#15803D',lineHeight:1.7}}>
                    毎月おなじ条件で、翌月の日程を自動で足す<br />
                    <span style={{fontSize:'11.5px',fontWeight:400,color:'#64748B'}}>
                      毎月1日に、下の曜日・時間・料金で翌月ぶんが入ります。入ったらメールでお知らせします。
                    </span>
                  </span>
                </label>

                {repOn && (
                  <div style={{marginTop:'12px'}}>
                    <label style={{fontSize:'12px',fontWeight:'700',color:'#64748B'}}>出店する曜日</label>
                    <div style={{display:'flex',gap:'6px',flexWrap:'wrap',marginTop:'6px'}}>
                      {['日','月','火','水','木','金','土'].map((w,idx)=>{
                        const on = repDows.includes(idx)
                        return (
                          <button key={w} type='button'
                            onClick={()=>setRepDows(prev=>on ? prev.filter(x=>x!==idx) : [...prev,idx])}
                            style={{minWidth:'44px',minHeight:'44px',borderRadius:'8px',border:on?'1.5px solid #16A34A':'1.5px solid #E2E8F0',background:on?'#16A34A':'#fff',color:on?'#fff':(idx===0?'#DC2626':idx===6?'#1D4ED8':'#64748B'),fontSize:'13px',fontWeight:700,cursor:'pointer',fontFamily:'inherit'}}>
                            {w}
                          </button>
                        )
                      })}
                    </div>
                    {/* 曜日のまとめ選び。形態ごとの「出られる曜日」でも
                        同じものを使っている（app/components/DowPresets.tsx） */}
                    <DowPresets current={repDows} onPick={setted => setRepDows(setted)} />

                    <div className='form-grid-2' style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginTop:'12px'}}>
                      <div>
                        <label style={{fontSize:'12px',fontWeight:'700',color:'#64748B'}}>販売開始</label>
                        <select value={repStart} onChange={e=>setRepStart(e.target.value)} style={{...inputStyle,marginTop:'4px'}}>{times.map(t=><option key={t}>{t}</option>)}</select>
                      </div>
                      <div>
                        <label style={{fontSize:'12px',fontWeight:'700',color:'#64748B'}}>販売終了</label>
                        <select value={repEnd} onChange={e=>setRepEnd(e.target.value)} style={{...inputStyle,marginTop:'4px'}}>{times.map(t=><option key={t}>{t}</option>)}</select>
                      </div>
                    </div>

                    <div className='form-grid-2' style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginTop:'12px'}}>
                      <div>
                        <label style={{fontSize:'12px',fontWeight:'700',color:'#B45309'}}>取引先へ渡す額（円）</label>
                        <input inputMode='numeric' value={repPlaceFee} onChange={e=>setRepPlaceFee(e.target.value.replace(/[^0-9]/g,''))} placeholder='例：2000' style={{...inputStyle,marginTop:'4px'}}/>
                      </div>
                      <div>
                        <label style={{fontSize:'12px',fontWeight:'700',color:'#1D4ED8'}}>弊社の固定額（円）</label>
                        <input inputMode='numeric' value={repCompanyFee} onChange={e=>setRepCompanyFee(e.target.value.replace(/[^0-9]/g,''))} placeholder='空欄可' style={{...inputStyle,marginTop:'4px'}}/>
                      </div>
                    </div>

                    <div style={{fontSize:'11px',color:'#64748B',marginTop:'8px',lineHeight:1.8}}>
                      ・募集を終了した案件には足しません。<br />
                      ・日程の上限は31日です。足す前に、終わった日は日程から外れます。<br />
                      ・平日と土日で金額が違う場合は、この設定では片方の金額になります。「日によって金額を変える」で個別に直してください。
                    </div>

                    {repLastAt && (
                      <div style={{fontSize:'11.5px',color:'#15803D',marginTop:'8px',fontWeight:700}}>
                        前回の自動追加：{new Date(repLastAt).toLocaleString('ja-JP')}
                        {repLastAdded != null && `（${repLastAdded}日ぶん）`}
                      </div>
                    )}
                  </div>
                )}
              </div>

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
              <PlaceImagePicker files={imageFiles} onChangeFiles={setImageFiles} bandLabel={form.title} />
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
                  {/* この4項目はスマホでも2列のままなので1列あたりが狭く、
                      折り返しを許さないと「有り」「無し」が縦に割れてしまう。
                      入りきらないときは選択肢ごと次の行へ落とす。 */}
                  <div style={{display:'flex',flexWrap:'wrap',gap:'16px',marginTop:'10px'}}>
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
              {/* 「有り」を選ぶと横に数値の入力欄が増えるため、狭い画面では
                  選択肢と入力欄が押し合って文字が縦に割れる。
                  同じ作りの「雨天時の対応」に合わせて折り返しを許す。 */}
              <div style={{display:'flex',gap:'24px',alignItems:'center',marginTop:'10px',flexWrap:'wrap'}}>
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
            <button onClick={handleSubmit} disabled={saving} style={{background:saving?'#ccc':'#F5A623',color:'#fff',border:'none',borderRadius:'999px',padding:'14px 48px',fontSize:'15px',fontWeight:'900',cursor:saving?'not-allowed':'pointer',boxShadow:'0 4px 15px rgba(245,166,35,0.4)'}}>{saving?'登録中...':'この内容で登録'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// useSearchParams を使うページは Suspense で包まないと本番ビルドが失敗する
export default function NewPlacePage() {
  return (
    <Suspense fallback={<div style={{minHeight:'100vh',background:'#FFF9E6',display:'flex',alignItems:'center',justifyContent:'center',color:'#B45309',fontWeight:'700'}}>読み込み中...</div>}>
      <NewPlacePageInner />
    </Suspense>
  )
}
