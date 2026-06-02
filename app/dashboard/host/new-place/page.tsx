'use client'
import Link from 'next/link'
import { useState } from 'react'

export default function NewPlacePage() {
  const [form, setForm] = useState({
    type:'event', title:'', summary:'', date:'', deadline:'', image:null,
    format:'kitchen', prefecture:'', address:'', mapUrl:'',募集内容:'',
    fee:'', visitors:'', loadIn:'', loadOut:'', startTime:'', endTime:'',
    menuWant:'', menuNG:'', menuOther:'', power:'yes', gas:'yes', water:'yes',
    trash:'self', eatSpace:'yes', location:'outdoor', heightLimit:'no', heightValue:'',
    rain:'go', rainNote:'', history:'no', parking:'yes', brand:'', notes:''
  })
  const set = (k:string,v:string) => setForm(p=>({...p,[k]:v}))
  const req = <span style={{background:'#F5A623',color:'#fff',fontSize:'11px',padding:'2px 8px',borderRadius:'999px',marginLeft:'8px',fontWeight:'700'}}>必須</span>

  const times = ['選択してください','6:00','7:00','8:00','9:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00','19:00','20:00','21:00']
  const prefs = ['選択してください','北海道','青森県','岩手県','宮城県','秋田県','山形県','福島県','茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県','新潟県','富山県','石川県','福井県','山梨県','長野県','岐阜県','静岡県','愛知県','三重県','滋賀県','京都府','大阪府','兵庫県','奈良県','和歌山県','鳥取県','島根県','岡山県','広島県','山口県','徳島県','香川県','愛媛県','高知県','福岡県','佐賀県','長崎県','熊本県','大分県','宮崎県','鹿児島県','沖縄県']

  const Radio = ({name,val,label}:{name:string,val:string,label:string}) => (
    <label style={{display:'flex',alignItems:'center',gap:'6px',cursor:'pointer',fontSize:'14px'}}>
      <input type='radio' name={name} checked={form[name as keyof typeof form]===val} onChange={()=>set(name,val)} style={{accentColor:'#F5A623',color:'#1a1a1a'}}/>
      {label}
    </label>
  )

  return (
    <div style={{minHeight:'100vh',background:'#FFF9E6'}}>
      

      <div style={{maxWidth:'780px',margin:'0 auto',padding:'40px 24px'}}>
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
              <label style={{fontWeight:'700',fontSize:'14px',color:'#1a1a1a'}}>イベント・施設名{req}</label>
              <input value={form.title} onChange={e=>set('title',e.target.value)} placeholder='例：春の収穫祭マルシェ' style={{width:'100%',border:'1px solid #E5C07B',borderRadius:'8px',padding:'10px 14px',fontSize:'14px',marginTop:'8px',boxSizing:'border-box',color:'#1a1a1a',background:'#fff'}}/>
            </div>

            <div style={{marginBottom:'20px'}}>
              <label style={{fontWeight:'700',fontSize:'14px',color:'#1a1a1a'}}>概要{req}</label>
              <textarea value={form.summary} onChange={e=>set('summary',e.target.value)} placeholder='イベントや施設の説明を入力してください。' rows={4} style={{width:'100%',border:'1px solid #E5C07B',borderRadius:'8px',padding:'10px 14px',fontSize:'14px',marginTop:'8px',boxSizing:'border-box',color:'#1a1a1a',background:'#fff',resize:'vertical'}}/>
            </div>

            <div className='form-grid-2' style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px',marginBottom:'20px'}}>
              <div>
                <label style={{fontWeight:'700',fontSize:'14px',color:'#1a1a1a'}}>出店日{req}</label>
                <input value={form.date} onChange={e=>set('date',e.target.value)} placeholder='例：毎週日曜日（年末年始除く）' style={{width:'100%',border:'1px solid #E5C07B',borderRadius:'8px',padding:'10px 14px',fontSize:'14px',marginTop:'8px',boxSizing:'border-box',color:'#1a1a1a',background:'#fff'}}/>
              </div>
              <div>
                <label style={{fontWeight:'700',fontSize:'14px',color:'#1a1a1a'}}>募集締め切り日{req}</label>
                <input type='date' value={form.deadline} onChange={e=>set('deadline',e.target.value)} style={{width:'100%',border:'1px solid #E5C07B',borderRadius:'8px',padding:'10px 14px',fontSize:'14px',marginTop:'8px',boxSizing:'border-box',color:'#1a1a1a',background:'#fff'}}/>
              </div>
            </div>

            <div style={{marginBottom:'20px'}}>
              <label style={{fontWeight:'700',fontSize:'14px',color:'#1a1a1a'}}>イベント画像</label>
              <div style={{marginTop:'8px'}}>
                <label style={{background:'#F5A623',color:'#fff',padding:'8px 20px',borderRadius:'8px',cursor:'pointer',fontSize:'13px',fontWeight:'700'}}>
                  ファイルを選択
                  <input type='file' accept='image/*' style={{display:'none'}}/>
                </label>
              </div>
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
              <select value={form.prefecture} onChange={e=>set('prefecture',e.target.value)} style={{width:'100%',border:'1px solid #E5C07B',borderRadius:'8px',padding:'10px 14px',fontSize:'14px',marginTop:'8px',boxSizing:'border-box',color:'#1a1a1a',background:'#fff'}}>
                {prefs.map(p=><option key={p}>{p}</option>)}
              </select>
              <input value={form.address} onChange={e=>set('address',e.target.value)} placeholder='○丁目○番地○号' style={{width:'100%',border:'1px solid #E5C07B',borderRadius:'8px',padding:'10px 14px',fontSize:'14px',marginTop:'8px',boxSizing:'border-box',color:'#1a1a1a',background:'#fff'}}/>
            </div>

            <div style={{marginBottom:'20px'}}>
              <label style={{fontWeight:'700',fontSize:'14px',color:'#1a1a1a'}}>Google Map URL</label>
              <input value={form.mapUrl} onChange={e=>set('mapUrl',e.target.value)} placeholder='https://maps.google.com/...' style={{width:'100%',border:'1px solid #E5C07B',borderRadius:'8px',padding:'10px 14px',fontSize:'14px',marginTop:'8px',boxSizing:'border-box',color:'#1a1a1a',background:'#fff'}}/>
            </div>

            <div>
              <label style={{fontWeight:'700',fontSize:'14px',color:'#1a1a1a'}}>募集内容{req}</label>
              <textarea value={form['募集内容']} onChange={e=>set('募集内容',e.target.value)} placeholder='キッチンカーブース5ブース、テント7ブース程度' rows={3} style={{width:'100%',border:'1px solid #E5C07B',borderRadius:'8px',padding:'10px 14px',fontSize:'14px',marginTop:'8px',boxSizing:'border-box',color:'#1a1a1a',background:'#fff',resize:'vertical'}}/>
            </div>
          </div>

          <div style={{background:'#fff',borderRadius:'12px',border:'2px solid #FFE0A0',padding:'28px',boxShadow:'0 2px 12px rgba(245,166,35,0.1)'}}>
            <h2 style={{fontSize:'16px',fontWeight:'900',marginBottom:'20px',borderLeft:'4px solid #F5A623',paddingLeft:'10px',color:'#1a1a1a'}}>出店条件・環境</h2>

            <div className='form-grid-2' style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px',marginBottom:'20px'}}>
              <div>
                <label style={{fontWeight:'700',fontSize:'14px',color:'#1a1a1a'}}>出店料{req}</label>
                <input value={form.fee} onChange={e=>set('fee',e.target.value)} placeholder='例：1日10,000円' style={{width:'100%',border:'1px solid #E5C07B',borderRadius:'8px',padding:'10px 14px',fontSize:'14px',marginTop:'8px',boxSizing:'border-box',color:'#1a1a1a',background:'#fff'}}/>
              </div>
              <div>
                <label style={{fontWeight:'700',fontSize:'14px',color:'#1a1a1a'}}>動員目標</label>
                <input value={form.visitors} onChange={e=>set('visitors',e.target.value)} placeholder='例：200名' style={{width:'100%',border:'1px solid #E5C07B',borderRadius:'8px',padding:'10px 14px',fontSize:'14px',marginTop:'8px',boxSizing:'border-box',color:'#1a1a1a',background:'#fff'}}/>
              </div>
            </div>

            <div className='form-grid-2' style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px',marginBottom:'20px'}}>
              <div>
                <label style={{fontWeight:'700',fontSize:'14px',color:'#1a1a1a'}}>搬入時間{req}</label>
                <select value={form.loadIn} onChange={e=>set('loadIn',e.target.value)} style={{width:'100%',border:'1px solid #E5C07B',borderRadius:'8px',padding:'10px 14px',fontSize:'14px',marginTop:'8px',boxSizing:'border-box',color:'#1a1a1a',background:'#fff'}}>
                  {times.map(t=><option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{fontWeight:'700',fontSize:'14px',color:'#1a1a1a'}}>搬出時間{req}</label>
                <select value={form.loadOut} onChange={e=>set('loadOut',e.target.value)} style={{width:'100%',border:'1px solid #E5C07B',borderRadius:'8px',padding:'10px 14px',fontSize:'14px',marginTop:'8px',boxSizing:'border-box',color:'#1a1a1a',background:'#fff'}}>
                  {times.map(t=><option key={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div className='form-grid-2' style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px',marginBottom:'20px'}}>
              <div>
                <label style={{fontWeight:'700',fontSize:'14px',color:'#1a1a1a'}}>販売開始時間{req}</label>
                <select value={form.startTime} onChange={e=>set('startTime',e.target.value)} style={{width:'100%',border:'1px solid #E5C07B',borderRadius:'8px',padding:'10px 14px',fontSize:'14px',marginTop:'8px',boxSizing:'border-box',color:'#1a1a1a',background:'#fff'}}>
                  {times.map(t=><option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={{fontWeight:'700',fontSize:'14px',color:'#1a1a1a'}}>販売終了時間{req}</label>
                <select value={form.endTime} onChange={e=>set('endTime',e.target.value)} style={{width:'100%',border:'1px solid #E5C07B',borderRadius:'8px',padding:'10px 14px',fontSize:'14px',marginTop:'8px',boxSizing:'border-box',color:'#1a1a1a',background:'#fff'}}>
                  {times.map(t=><option key={t}>{t}</option>)}
                </select>
              </div>
            </div>

            <div className='form-grid-3' style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'16px',marginBottom:'20px'}}>
              <div>
                <label style={{fontWeight:'700',fontSize:'14px',color:'#1a1a1a'}}>希望メニュー</label>
                <input value={form.menuWant} onChange={e=>set('menuWant',e.target.value)} placeholder='例：たこ焼き、クレープ' style={{width:'100%',border:'1px solid #E5C07B',borderRadius:'8px',padding:'10px 14px',fontSize:'14px',marginTop:'8px',boxSizing:'border-box',color:'#1a1a1a',background:'#fff'}}/>
              </div>
              <div>
                <label style={{fontWeight:'700',fontSize:'14px',color:'#1a1a1a'}}>NGメニュー</label>
                <input value={form.menuNG} onChange={e=>set('menuNG',e.target.value)} placeholder='例：酒' style={{width:'100%',border:'1px solid #E5C07B',borderRadius:'8px',padding:'10px 14px',fontSize:'14px',marginTop:'8px',boxSizing:'border-box',color:'#1a1a1a',background:'#fff'}}/>
              </div>
              <div>
                <label style={{fontWeight:'700',fontSize:'14px',color:'#1a1a1a'}}>他の出店予定メニュー</label>
                <input value={form.menuOther} onChange={e=>set('menuOther',e.target.value)} placeholder='例：焼きそば' style={{width:'100%',border:'1px solid #E5C07B',borderRadius:'8px',padding:'10px 14px',fontSize:'14px',marginTop:'8px',boxSizing:'border-box',color:'#1a1a1a',background:'#fff'}}/>
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
              <div style={{display:'flex',gap:'24px',marginTop:'10px'}}>
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
              <input value={form.brand} onChange={e=>set('brand',e.target.value)} placeholder='例：競合ブランドの商品販売禁止' style={{width:'100%',border:'1px solid #E5C07B',borderRadius:'8px',padding:'10px 14px',fontSize:'14px',marginTop:'8px',boxSizing:'border-box',color:'#1a1a1a',background:'#fff'}}/>
            </div>

            <div>
              <label style={{fontWeight:'700',fontSize:'14px',color:'#1a1a1a'}}>備考・要望等</label>
              <textarea value={form.notes} onChange={e=>set('notes',e.target.value)} rows={4} placeholder='その他ご要望があればご記入ください' style={{width:'100%',border:'1px solid #E5C07B',borderRadius:'8px',padding:'10px 14px',fontSize:'14px',marginTop:'8px',boxSizing:'border-box',color:'#1a1a1a',background:'#fff',resize:'vertical'}}/>
            </div>
          </div>

          <div style={{display:'flex',gap:'16px',justifyContent:'center',paddingBottom:'40px'}}>
            <Link href='/dashboard/host' style={{border:'2px solid #E5E7EB',color:'#555',borderRadius:'999px',padding:'14px 40px',fontSize:'15px',fontWeight:'700',textDecoration:'none'}}>戻る</Link>
            <button style={{background:'#F5A623',color:'#fff',border:'none',borderRadius:'999px',padding:'14px 48px',fontSize:'15px',fontWeight:'900',cursor:'pointer',boxShadow:'0 4px 15px rgba(245,166,35,0.4)'}}>この内容で登録</button>
          </div>
        </div>
      </div>
    </div>
  )
}
