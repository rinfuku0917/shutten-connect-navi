'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'

type DbMessage = { id: string, application_id: string, sender_id: string, body: string, sent_at: string, read_at?: string | null }

const applies = [
  { id: '1', place: '日本体育大学医療専門学校', area: '東京', date: '6月3日（水）', time: '11:00〜16:00', type: 'キッチンカー', plan: '日額固定 5,000円', status: '承認済', statusColor: '#16A34A', statusBg: '#ECFDF5' },
  { id: '2', place: '大阪公立大学りんくうキャンパス', area: '大阪', date: '7月2日（水）', time: '11:00〜14:00', type: 'キッチンカー', plan: '日額固定 4,000円', status: '審査中', statusColor: '#92400E', statusBg: '#FEF3C7' },
  { id: '3', place: 'イオンモール富谷', area: '宮城', date: '6月14日（土）', time: '10:00〜18:00', type: 'キッチンカー・物販', plan: '売上15%', status: '否認', statusColor: '#DC2626', statusBg: '#FEE2E2' },
  { id: '4', place: '横浜みなとみらいマルシェ', area: '神奈川', date: '6月21日（土）', time: '10:00〜17:00', type: '物販・飲食', plan: '日額固定 6,000円', status: '審査中', statusColor: '#92400E', statusBg: '#FEF3C7' },
]

const messages = [
  { id: '1', from: '渋谷マルシェ実行委員会', msg: '書類の確認が完了しました。当日よろしくお願いします！', time: '14:32', unread: true },
  { id: '2', from: '管理者（出店コネクトナビ）', msg: '書類提出ありがとうございます。審査中です。', time: '昨日', unread: false },
  { id: '3', from: 'イオンモール富谷', msg: '今回はご応募いただきありがとうございました。', time: '2日前', unread: false },
]

const calDates = [
  { date: '6/3', day: '水', status: '承認済', place: '日体大医療', color: '#ECFDF5', border: '#86EFAC', text: '#16A34A' },
  { date: '6/7', day: '土', status: '申込可', place: '', color: '#FFF8E1', border: '#FCD34D', text: '#92400E' },
  { date: '6/8', day: '日', status: '申込可', place: '', color: '#FFF8E1', border: '#FCD34D', text: '#92400E' },
  { date: '6/14', day: '土', status: '否認', place: 'イオンモール', color: '#FEE2E2', border: '#FCA5A5', text: '#DC2626' },
  { date: '6/21', day: '土', status: '審査中', place: 'みなとみらい', color: '#FEF3C7', border: '#FCD34D', text: '#92400E' },
  { date: '6/28', day: '土', status: '申込可', place: '', color: '#FFF8E1', border: '#FCD34D', text: '#92400E' },
]

const docTypes = [
  { key: 'license_front', name: '運転免許証（表面）', required: true, icon: '🪪' },
  { key: 'license_back', name: '運転免許証（裏面）', required: true, icon: '🪪' },
  { key: 'food_hygiene', name: '食品衛生責任者証', required: true, icon: '📄' },
  { key: 'liability_insurance', name: '損害賠償保険証書', required: true, icon: '🛡️' },
  { key: 'other_permit', name: 'その他許可証', required: false, icon: '📋' },
]

const docStatusLabel = (s: string | undefined) =>
  s === 'approved' ? '承認済' : s === 'pending' ? '審査中' : s === 'rejected' ? '否認' : '未提出'

export default function SellerDashboard() {
  const router = useRouter()
  type TabKey = 'home'|'applies'|'calendar'|'messages'|'docs'|'profile'|'sales'
  const validTabs: TabKey[] = ['home','applies','calendar','messages','docs','profile','sales']
  const getInitialTab = (): TabKey => {
    if (typeof window === 'undefined') return 'home'
    const t = new URLSearchParams(window.location.search).get('tab')
    return (t && validTabs.includes(t as TabKey)) ? (t as TabKey) : 'home'
  }
  const [tab, setTab] = useState<TabKey>(getInitialTab())
  const [chatOpen, setChatOpen] = useState<string|null>(null)
  const [msg, setMsg] = useState('')
  const [dbMessages, setDbMessages] = useState<DbMessage[]>([])
  const [myId, setMyId] = useState<string|null>(null)
  const [appId, setAppId] = useState<string|null>(null)
  type MsgThread = { application_id: string, placeTitle: string, lastBody: string, unread: number }
  const [threads, setThreads] = useState<MsgThread[]>([])
  const [unread, setUnread] = useState(0)
  type MyApply = { id: string, place: string, date: string, type: string, status: string, statusColor: string, statusBg: string }
  const [myApplies, setMyApplies] = useState<MyApply[]>([])
  type DocRow = { id: string, doc_type: string, file_url: string, status: string }
  const [myDocs, setMyDocs] = useState<DocRow[]>([])
  const [uploadingType, setUploadingType] = useState<string | null>(null)

  // ===== プロフィール（出店者） =====
  type ProfileData = { name: string, shop_name: string, email: string, phone: string, genre: string, address: string, areas: string[] }
  type SnsLinks = { instagram: string, twitter: string, youtube: string, tiktok: string }
  const emptyProfile: ProfileData = { name: '', shop_name: '', email: '', phone: '', genre: '', address: '', areas: [] }
  const emptySns: SnsLinks = { instagram: '', twitter: '', youtube: '', tiktok: '' }
  const [profile, setProfile] = useState<ProfileData>(emptyProfile)
  const [snsLinks, setSnsLinks] = useState<SnsLinks>(emptySns)
  const [profileEdit, setProfileEdit] = useState(false)
  const [profileForm, setProfileForm] = useState<ProfileData>(emptyProfile)
  const [snsForm, setSnsForm] = useState<SnsLinks>(emptySns)
  const [areasInput, setAreasInput] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)

  // 自分のプロフィールとSNSを読み込む
  const loadProfile = async () => {
    const { data: userData } = await supabase.auth.getUser()
    const uid = userData.user?.id
    if (!uid) return
    const { data: p } = await supabase
      .from('profiles')
      .select('name, shop_name, email, phone, genre, address, areas')
      .eq('id', uid).single()
    if (p) {
      const pd: ProfileData = {
        name: p.name || '', shop_name: p.shop_name || '', email: p.email || '',
        phone: p.phone || '', genre: p.genre || '', address: p.address || '',
        areas: Array.isArray(p.areas) ? p.areas : [],
      }
      setProfile(pd)
    }
    const { data: links } = await supabase
      .from('sns_links')
      .select('platform, url')
      .eq('seller_id', uid)
    const sns: SnsLinks = { instagram: '', twitter: '', youtube: '', tiktok: '' }
    ;(links || []).forEach((l: any) => {
      if (l.platform === 'instagram') sns.instagram = l.url || ''
      else if (l.platform === 'twitter') sns.twitter = l.url || ''
      else if (l.platform === 'youtube') sns.youtube = l.url || ''
      else if (l.platform === 'tiktok') sns.tiktok = l.url || ''
    })
    setSnsLinks(sns)
  }

  // 編集開始：表示値をフォームにコピー
  const startProfileEdit = () => {
    setProfileForm(profile)
    setSnsForm(snsLinks)
    setAreasInput(profile.areas.join('・'))
    setProfileEdit(true)
  }

  // プロフィール保存
  const saveProfile = async () => {
    const { data: userData } = await supabase.auth.getUser()
    const uid = userData.user?.id
    if (!uid) return
    setProfileSaving(true)
    const areasArr = areasInput.split(/[・,、]/).map(s => s.trim()).filter(Boolean)
    const payload = {
      id: uid,
      name: profileForm.name, shop_name: profileForm.shop_name, email: profileForm.email,
      phone: profileForm.phone, genre: profileForm.genre, address: profileForm.address,
      areas: areasArr,
    }
    const { data: pData, error: pErr } = await supabase.from('profiles').update(payload).eq('id', uid).select()
    if (pErr) { alert('プロフィール保存失敗: ' + pErr.message); setProfileSaving(false); return }
    if (!pData || pData.length === 0) { alert('保存できませんでした（権限設定をご確認ください）'); setProfileSaving(false); return }
    const platforms: { key: keyof SnsLinks, name: string }[] = [
      { key: 'instagram', name: 'instagram' }, { key: 'twitter', name: 'twitter' },
      { key: 'youtube', name: 'youtube' }, { key: 'tiktok', name: 'tiktok' },
    ]
    for (const pf of platforms) {
      const url = snsForm[pf.key].trim()
      const { error: dErr } = await supabase.from('sns_links').delete().eq('seller_id', uid).eq('platform', pf.name)
      if (dErr) { alert('SNS保存失敗(' + pf.name + '): ' + dErr.message); setProfileSaving(false); return }
      if (url) {
        const { error: iErr } = await supabase.from('sns_links').insert({ seller_id: uid, platform: pf.name, url })
        if (iErr) { alert('SNS保存失敗(' + pf.name + '): ' + iErr.message); setProfileSaving(false); return }
      }
    }
    setProfileSaving(false)
    setProfileEdit(false)
    await loadProfile()
    alert('プロフィールを保存しました')
  }

  const statusMap: Record<string, { label: string, color: string, bg: string }> = {
    pending: { label: '審査中', color: '#92400E', bg: '#FEF3C7' },
    approved: { label: '承認済', color: '#16A34A', bg: '#ECFDF5' },
    rejected: { label: '否認', color: '#DC2626', bg: '#FEE2E2' },
  }

  // ===== 売上（出店者） =====
  type SellerApp = { application_id: string, place_id: string, placeTitle: string, price_fixed: number, price_share_pct: number }
  type SellerSale = { id: string, sale_date: string, placeTitle: string, revenue: number, fee: number }
  const [myApprovedApps, setMyApprovedApps] = useState<SellerApp[]>([])
  const [mySales, setMySales] = useState<SellerSale[]>([])
  const [saleAppId, setSaleAppId] = useState('')
  const [saleDate, setSaleDate] = useState('')
  const [saleRevenue, setSaleRevenue] = useState('')
  const [saleSaving, setSaleSaving] = useState(false)
  const [saleMonth, setSaleMonth] = useState(() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') })
  const calcFee = (revenue: number, priceFixed: number, pricePct: number) => Math.round(revenue * (pricePct/100) + (priceFixed||0))

  // 自分の承認済み案件を読み込む
  const loadMyApprovedApps = async () => {
    const { data: userData } = await supabase.auth.getUser()
    const uid = userData.user?.id
    if (!uid) return
    const { data } = await supabase
      .from('applications')
      .select('id, place_id, places(title, price_fixed, price_share_pct)')
      .eq('seller_id', uid).eq('status', 'approved')
      .order('created_at', { ascending: false })
    const mapped: SellerApp[] = (data || []).map((a: any) => ({
      application_id: a.id, place_id: a.place_id,
      placeTitle: a.places?.title || '(案件名なし)',
      price_fixed: a.places?.price_fixed || 0, price_share_pct: a.places?.price_share_pct || 0,
    }))
    setMyApprovedApps(mapped)
  }

  // 自分の指定月の売上を読み込む
  const loadMySales = async () => {
    const { data: userData } = await supabase.auth.getUser()
    const uid = userData.user?.id
    if (!uid) return
    const start = saleMonth + '-01'
    const [y, m] = saleMonth.split('-').map(Number)
    const end = (m === 12 ? (y+1) + '-01' : y + '-' + String(m+1).padStart(2,'0')) + '-01'
    const { data } = await supabase
      .from('sales')
      .select('id, sale_date, revenue, fee, places(title)')
      .eq('seller_id', uid).gte('sale_date', start).lt('sale_date', end)
      .order('sale_date', { ascending: false })
    const mapped: SellerSale[] = (data || []).map((s: any) => ({
      id: s.id, sale_date: s.sale_date, revenue: s.revenue, fee: s.fee,
      placeTitle: s.places?.title || '(案件名なし)',
    }))
    setMySales(mapped)
  }

  // 自分の売上を保存
  const saveMySale = async () => {
    if (!saleAppId || !saleDate || !saleRevenue) { alert('案件・日付・売上金額をすべて入力してください'); return }
    const app = myApprovedApps.find(x => x.application_id === saleAppId)
    if (!app) { alert('案件が選択されていません'); return }
    const revenue = parseInt(saleRevenue, 10)
    if (isNaN(revenue) || revenue < 0) { alert('売上金額は0以上の数値で入力してください'); return }
    setSaleSaving(true)
    const fee = calcFee(revenue, app.price_fixed, app.price_share_pct)
    const { data: userData } = await supabase.auth.getUser()
    const uid = userData.user?.id
    const { error } = await supabase.from('sales').insert({
      application_id: app.application_id, place_id: app.place_id, seller_id: uid,
      sale_date: saleDate, revenue, fee
    })
    if (error) { alert('保存失敗: ' + error.message); setSaleSaving(false); return }
    setSaleAppId(''); setSaleDate(''); setSaleRevenue(''); setSaleSaving(false)
    loadMySales()
  }

  const deleteMySale = async (id: string) => {
    const { error } = await supabase.from('sales').delete().eq('id', id)
    if (error) { alert('削除失敗: ' + error.message); return }
    loadMySales()
  }

  // ログイン中ユーザーの申込一覧を読み込む
  const loadApplies = async () => {
    const { data: userData } = await supabase.auth.getUser()
    const uid = userData.user?.id
    if (!uid) return
    const { data } = await supabase
      .from('applications')
      .select('id, apply_date, format, status, places(title)')
      .eq('seller_id', uid)
      .order('created_at', { ascending: false })
    if (!data) return
    const mapped: MyApply[] = data.map((a: any) => {
      const s = statusMap[a.status] || { label: a.status, color: '#555', bg: '#F3F4F6' }
      return {
        id: a.id,
        place: a.places?.title || '(案件名なし)',
        date: a.apply_date || '日付未定',
        type: a.format || '-',
        status: s.label,
        statusColor: s.color,
        statusBg: s.bg,
      }
    })
    setMyApplies(mapped)
  }

  // ログイン中ユーザーの提出書類を読み込む
  const loadDocs = async () => {
    const { data: userData } = await supabase.auth.getUser()
    const uid = userData.user?.id
    if (!uid) return
    const { data } = await supabase
      .from('seller_documents')
      .select('id, doc_type, file_url, status')
      .eq('seller_id', uid)
    setMyDocs((data as DocRow[]) || [])
  }

  // 書類をアップロードする（docType: 書類種別キー, file: 選択ファイル）
  const uploadDoc = async (docType: string, file: File) => {
    const { data: userData } = await supabase.auth.getUser()
    const uid = userData.user?.id
    if (!uid) return
    setUploadingType(docType)
    const ext = file.name.split('.').pop() || 'dat'
    const path = uid + '/' + docType + '_' + Date.now() + '.' + ext
    const up = await supabase.storage.from('seller-documents').upload(path, file, { upsert: true })
    if (up.error) { alert('アップロード失敗: ' + up.error.message); setUploadingType(null); return }
    // 既存の同種別レコードがあれば消してから作り直す（再提出対応）
    await supabase.from('seller_documents').delete().eq('seller_id', uid).eq('doc_type', docType)
    const ins = await supabase.from('seller_documents').insert({
      seller_id: uid, doc_type: docType, file_url: path, status: 'pending'
    })
    if (ins.error) { alert('登録失敗: ' + ins.error.message); setUploadingType(null); return }
    setUploadingType(null)
    loadDocs()
  }

  // 自分の全申込のスレッド一覧を構築する
  const loadMessages = async () => {
    const { data: userData } = await supabase.auth.getUser()
    const uid = userData.user?.id
    if (!uid) return
    setMyId(uid)
    const { data: apps } = await supabase
      .from('applications')
      .select('id, places(title)')
      .eq('seller_id', uid)
      .order('created_at', { ascending: false })
    const { data: msgs } = await supabase
      .from('messages')
      .select('id, application_id, sender_id, body, sent_at, read_at')
      .order('sent_at', { ascending: true })
    const all = (msgs || []) as DbMessage[]
    const list: MsgThread[] = (apps || []).map((a: any) => {
      const mine = all.filter(m => m.application_id === a.id)
      const last = mine.length > 0 ? mine[mine.length - 1].body : 'メッセージはまだありません'
      const un = mine.filter(m => m.sender_id !== uid && !m.read_at).length
      return { application_id: a.id, placeTitle: a.places?.title || '(案件名なし)', lastBody: last, unread: un }
    })
    setThreads(list)
    setUnread(list.reduce((s, t) => s + t.unread, 0))
  }

  // スレッド（案件）を開いてメッセージ取得＋既読化
  const openThread = async (aid: string) => {
    setAppId(aid)
    setChatOpen(aid)
    const uid = myId
    const { data: msgs } = await supabase
      .from('messages')
      .select('id, application_id, sender_id, body, sent_at, read_at')
      .eq('application_id', aid)
      .order('sent_at', { ascending: true })
    if (msgs) setDbMessages(msgs as DbMessage[])
    if (uid) {
      await supabase.from('messages').update({ read_at: new Date().toISOString() })
        .eq('application_id', aid).neq('sender_id', uid).is('read_at', null)
    }
    loadMessages()
  }

  // タブが変わったらURLの ?tab= を更新（リロードしても同じタブを保つ）
  useEffect(() => {
    const url = new URL(window.location.href)
    url.searchParams.set('tab', tab)
    window.history.replaceState(null, '', url.toString())
  }, [tab])

  useEffect(() => {
    if (tab === 'messages') { loadMessages(); setChatOpen(null) }
  }, [tab])

  useEffect(() => {
    if (tab === 'sales') { loadMyApprovedApps(); loadMySales() }
  }, [tab])
  useEffect(() => {
    if (tab === 'sales') loadMySales()
  }, [saleMonth])

  // メッセージを送信する
  const sendMessage = async () => {
    const text = msg.trim()
    if (!text || !appId || !myId) return
    const { error } = await supabase
      .from('messages')
      .insert({ application_id: appId, sender_id: myId, body: text })
    if (error) { alert('送信に失敗しました: ' + error.message); return }
    setMsg('')
    openThread(appId)
  }

  useEffect(() => { loadMessages(); loadApplies(); loadDocs(); loadProfile() }, [])

  const navItems = [
    { key: 'home', icon: '🏠', label: 'ホーム' },
    { key: 'applies', icon: '📋', label: '申込一覧' },
    { key: 'calendar', icon: '📅', label: 'カレンダー' },
    { key: 'messages', icon: '💬', label: 'メッセージ', badge: unread > 0 ? unread : undefined },
    { key: 'docs', icon: '📁', label: '書類管理' },
    { key: 'sales', icon: '💰', label: '売上報告' },
    { key: 'profile', icon: '👤', label: 'プロフィール' },
  ]

  return (
    <div className='admin-shell' style={{ minHeight: '100vh', background: '#F1F5F9', display: 'flex' }}>
      {/* サイドバー */}
      <div className='admin-sidebar' style={{ width: '200px', background: '#1E2A3B', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div className='admin-sidebar-head' style={{ padding: '16px 14px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ background: '#F5A623', color: '#fff', fontWeight: '900', fontSize: '12px', padding: '3px 7px', borderRadius: '4px', display: 'inline-block', marginBottom: '4px' }}>出店</div>
          <div style={{ fontSize: '14px', fontWeight: '700', color: '#fff' }}>コネクトナビ</div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>出店者ダッシュボード</div>
        </div>
        <div className='admin-sidebar-head' style={{ padding: '12px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#F5A623', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '900', color: '#fff', flexShrink: 0 }}>山</div>
            <div>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#fff' }}>山田 花子</div>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>Hana's Sweets</div>
            </div>
          </div>
        </div>
        <nav className='admin-sidebar-nav' style={{ padding: '8px 0', flex: 1 }}>
          {navItems.map(item => (
            <div key={item.key} onClick={() => setTab(item.key as typeof tab)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', cursor: 'pointer', color: tab === item.key ? '#fff' : 'rgba(255,255,255,0.6)', background: tab === item.key ? 'rgba(255,255,255,0.1)' : 'transparent', borderLeft: tab === item.key ? '3px solid #F5A623' : '3px solid transparent', fontSize: '13px', position: 'relative' }}>
              <span>{item.icon}</span>{item.label}
              {item.badge && <span style={{ marginLeft: 'auto', background: '#DC2626', color: '#fff', borderRadius: '10px', fontSize: '10px', fontWeight: '700', padding: '1px 6px' }}>{item.badge}</span>}
            </div>
          ))}
        </nav>
        <div className='admin-sidebar-back' style={{ padding: '12px 14px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <button onClick={async () => { await supabase.auth.signOut(); router.push('/login') }} style={{ width: '100%', background: 'transparent', color: '#F5A623', border: '1px solid #F5A623', borderRadius: '6px', padding: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>ログアウト</button>
        </div>
      </div>

      {/* メイン */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div style={{ background: '#fff', borderBottom: '1px solid #E2E8F0', padding: '0 24px', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: '700', fontSize: '15px' }}>
            {tab === 'home' && 'ダッシュボード'}
            {tab === 'applies' && '申込一覧'}
            {tab === 'calendar' && '出店カレンダー'}
            {tab === 'messages' && 'メッセージ'}
            {tab === 'docs' && '書類管理'}
            {tab === 'sales' && '売上報告'}
            {tab === 'profile' && 'プロフィール'}
          </div>
          <Link href="/places" style={{ background: '#F5A623', color: '#fff', borderRadius: '8px', padding: '7px 16px', fontSize: '12px', fontWeight: '700', textDecoration: 'none' }}>＋ 新しい案件を探す</Link>
        </div>

        <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>

          {/* ホーム */}
          {tab === 'home' && (
            <>
              <div className='admin-stats' style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '20px' }}>
                {[
                  { label: '申込中', value: myApplies.filter(a => a.status === '審査中').length + '件', icon: '⏳', color: '#92400E', bg: '#FEF3C7' },
                  { label: '承認済（今月）', value: myApplies.filter(a => a.status === '承認済').length + '件', icon: '✅', color: '#16A34A', bg: '#ECFDF5' },
                  { label: '出店予定日', value: new Set(myApplies.filter(a => a.status === '承認済' && a.date && a.date !== '日付未定').map(a => a.date)).size + '日', icon: '📅', color: '#1D4ED8', bg: '#EBF6FD' },
                  { label: '未読メッセージ', value: unread + '件', icon: '💬', color: '#DC2626', bg: '#FEE2E2' },
                ].map(s => (
                  <div key={s.label} style={{ background: '#fff', borderRadius: '12px', padding: '16px', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '8px' }}>{s.label}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>{s.icon}</div>
                      <div style={{ fontSize: '24px', fontWeight: '900', color: s.color }}>{s.value}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className='admin-two-col' style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                  <div style={{ padding: '13px 18px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: '700', fontSize: '13px' }}>📋 最近の申込</div>
                    <button onClick={() => setTab('applies')} style={{ background: 'none', border: 'none', color: '#3A9BD5', fontSize: '12px', cursor: 'pointer' }}>すべて見る</button>
                  </div>
                  {myApplies.slice(0,3).map((a,i) => (
                    <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 18px', borderBottom: i<2 ? '1px solid #F1F5F9' : 'none' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '12px', fontWeight: '600', marginBottom: '2px' }}>{a.place}</div>
                        <div style={{ fontSize: '11px', color: '#64748B' }}>{a.date} ／ {a.type}</div>
                      </div>
                      <span style={{ fontSize: '10px', fontWeight: '700', padding: '3px 8px', borderRadius: '20px', background: a.statusBg, color: a.statusColor, flexShrink: 0 }}>{a.status}</span>
                    </div>
                  ))}
                </div>

                <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                  <div style={{ padding: '13px 18px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: '700', fontSize: '13px' }}>📁 書類提出状況</div>
                    <button onClick={() => setTab('docs')} style={{ background: 'none', border: 'none', color: '#3A9BD5', fontSize: '12px', cursor: 'pointer' }}>管理する</button>
                  </div>
                  <div style={{ padding: '14px 18px' }}>
                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                      {[{ label: '承認済', count: docTypes.filter(t => docStatusLabel(myDocs.find(d => d.doc_type === t.key)?.status) === '承認済').length, color: '#16A34A', bg: '#ECFDF5' }, { label: '審査中', count: docTypes.filter(t => docStatusLabel(myDocs.find(d => d.doc_type === t.key)?.status) === '審査中').length, color: '#92400E', bg: '#FEF3C7' }, { label: '未提出', count: docTypes.filter(t => docStatusLabel(myDocs.find(d => d.doc_type === t.key)?.status) === '未提出').length, color: '#DC2626', bg: '#FEE2E2' }].map(d => (
                        <div key={d.label} style={{ flex: 1, background: d.bg, borderRadius: '8px', padding: '8px', textAlign: 'center' }}>
                          <div style={{ fontSize: '18px', fontWeight: '900', color: d.color }}>{d.count}</div>
                          <div style={{ fontSize: '10px', color: d.color }}>{d.label}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ background: '#FEE2E2', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: '#DC2626', display: 'flex', gap: '6px' }}>
                      <span>⚠️</span>
                      <span>損害賠償保険証書が未提出です。出店前に提出してください。</span>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* 申込一覧 */}
          {tab === 'applies' && (
            <>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                {['すべて', '審査中', '承認済', '否認'].map((f, i) => (
                  <button key={f} style={{ padding: '6px 16px', borderRadius: '999px', border: '1.5px solid', borderColor: i === 0 ? '#F5A623' : '#E2E8F0', background: i === 0 ? '#FFF8E1' : '#fff', color: i === 0 ? '#B45309' : '#64748B', fontSize: '12px', fontWeight: i === 0 ? '700' : '400', cursor: 'pointer' }}>{f}</button>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {myApplies.map(a => (
                  <div key={a.id} style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                        <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px', background: '#F1F5F9', color: '#64748B' }}>{a.type}</span>
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: '700', marginBottom: '4px' }}>{a.place}</div>
                      <div style={{ fontSize: '12px', color: '#64748B' }}>📅 {a.date}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: '700', padding: '4px 12px', borderRadius: '20px', background: a.statusBg, color: a.statusColor }}>{a.status}</span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => { setTab('messages'); openThread(a.id) }} style={{ fontSize: '11px', padding: '4px 10px', border: '1px solid #E2E8F0', borderRadius: '6px', background: '#fff', cursor: 'pointer' }}>💬 連絡</button>
                        {a.status === '否認' && <button style={{ fontSize: '11px', padding: '4px 10px', border: '1px solid #F5A623', borderRadius: '6px', background: '#FFF8E1', color: '#B45309', cursor: 'pointer' }}>再申込</button>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* カレンダー */}
          {tab === 'calendar' && (
            <>
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                {[{ label: '承認済', color: '#16A34A', bg: '#ECFDF5' }, { label: '審査中', color: '#92400E', bg: '#FEF3C7' }, { label: '否認', color: '#DC2626', bg: '#FEE2E2' }, { label: '申込可', color: '#92400E', bg: '#FFF8E1' }].map(l => (
                  <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: l.bg, border: `1px solid ${l.color}` }}></div>
                    {l.label}
                  </div>
                ))}
              </div>
              <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '20px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <button style={{ border: '1px solid #E2E8F0', borderRadius: '6px', padding: '5px 12px', background: '#fff', cursor: 'pointer', fontSize: '14px' }}>‹</button>
                  <div style={{ fontWeight: '700', fontSize: '16px' }}>2026年6月</div>
                  <button style={{ border: '1px solid #E2E8F0', borderRadius: '6px', padding: '5px 12px', background: '#fff', cursor: 'pointer', fontSize: '14px' }}>›</button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '6px' }}>
                  {['日','月','火','水','木','金','土'].map((d,i) => (
                    <div key={d} style={{ textAlign: 'center', fontSize: '12px', fontWeight: '700', color: i===0?'#DC2626':i===6?'#1D4ED8':'#64748B', padding: '6px 0' }}>{d}</div>
                  ))}
                  {Array.from({length:6}).map((_,i) => <div key={i} style={{ minHeight: '60px' }}></div>)}
                  {Array.from({length:30}).map((_,i) => {
                    const d = i+1
                    const found = calDates.find(c => parseInt(c.date.split('/')[1]) === d)
                    const dow = (i+6)%7
                    return (
                      <div key={d} style={{ minHeight: '60px', borderRadius: '8px', border: `1px solid ${found ? found.border : '#E2E8F0'}`, background: found ? found.color : '#fff', padding: '5px', cursor: found?.status === '申込可' ? 'pointer' : 'default' }}>
                        <div style={{ fontSize: '12px', fontWeight: '600', color: dow===0?'#DC2626':dow===6?'#1D4ED8':'#333', marginBottom: '3px' }}>{d}</div>
                        {found && <div style={{ fontSize: '9px', fontWeight: '700', color: found.text, lineHeight: 1.3 }}>{found.status}{found.place && <><br/>{found.place}</>}</div>}
                      </div>
                    )
                  })}
                </div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <button onClick={() => window.location.href='/places'} style={{ background: '#F5A623', color: '#fff', border: 'none', borderRadius: '8px', padding: '12px 28px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>＋ 新しい出店日を申込む</button>
              </div>
            </>
          )}

          {/* メッセージ */}
          {tab === 'messages' && (
            <div className='admin-two-col seller-msg-grid' style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '0', background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden', minHeight: '500px' }}>
              <div style={{ borderRight: '1px solid #E2E8F0' }}>
                <div style={{ padding: '12px 14px', borderBottom: '1px solid #E2E8F0', fontWeight: '700', fontSize: '13px', background: '#FFF8E1', color: '#B45309' }}>メッセージ</div>
                {threads.length === 0 ? (
                  <div style={{ padding: '24px 14px', textAlign: 'center', color: '#999', fontSize: '12px' }}>承認済みの案件がありません。</div>
                ) : threads.map(t => (
                  <div key={t.application_id} onClick={() => openThread(t.application_id)}
                    style={{ padding: '12px 14px', borderBottom: '1px solid #F1F5F9', cursor: 'pointer', background: appId === t.application_id ? '#FFF8E1' : '#fff', borderLeft: appId === t.application_id ? '3px solid #F5A623' : '3px solid transparent' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.placeTitle}</span>
                      {t.unread > 0 && <span style={{ background: '#DC2626', color: '#fff', borderRadius: '10px', padding: '1px 7px', fontSize: '10px', fontWeight: '700', flexShrink: 0 }}>{t.unread}</span>}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748B', marginTop: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.lastBody}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {chatOpen ? (
                  <>
                    <div style={{ padding: '12px 18px', borderBottom: '1px solid #E2E8F0', fontWeight: '700', fontSize: '13px', color: '#1a1a1a' }}>{threads.find(t => t.application_id === appId)?.placeTitle || '案件'}｜運営とのやり取り</div>
                    <div style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', background: '#F8FAFC' }}>
                      {dbMessages.length === 0 ? (
                        <div style={{ color: '#94A3B8', fontSize: '13px', textAlign: 'center', marginTop: '20px' }}>まだメッセージがありません</div>
                      ) : dbMessages.map(m => (
                        m.sender_id === myId ? (
                          <div key={m.id} style={{ alignSelf: 'flex-end', maxWidth: '70%' }}>
                            <div style={{ background: '#F5A623', color: '#fff', borderRadius: '12px', padding: '10px 14px', fontSize: '13px', lineHeight: 1.6 }}>{m.body}</div>
                          </div>
                        ) : (
                          <div key={m.id} style={{ alignSelf: 'flex-start', maxWidth: '70%' }}>
                            <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '10px 14px', fontSize: '13px', lineHeight: 1.6, color: '#1a1a1a' }}>{m.body}</div>
                          </div>
                        )
                      ))}
                    </div>
                    <div style={{ padding: '12px 16px', borderTop: '1px solid #E2E8F0', display: 'flex', gap: '8px' }}>
                      <input value={msg} onChange={e => setMsg(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') sendMessage() }} placeholder="メッセージを入力..." style={{ flex: 1, border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', outline: 'none', color: '#1a1a1a' }} />
                      <button onClick={sendMessage} style={{ background: '#F5A623', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 16px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>送信</button>
                    </div>
                  </>
                ) : (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: '14px' }}>メッセージを選択してください</div>
                )}
              </div>
            </div>
          )}

          {/* 書類管理 */}
          {tab === 'docs' && (
            <>
              <div style={{ background: '#FFF8E1', border: '1px solid #FFE082', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: '#B45309', display: 'flex', gap: '8px' }}>
                <span>📎</span><span>各書類のファイルを選んでアップロードしてください。提出後は「審査中」になります。</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {docTypes.map(doc => {
                  const rec = myDocs.find(d => d.doc_type === doc.key)
                  const status = docStatusLabel(rec?.status)
                  const border = status === '承認済' ? '#86EFAC' : status === '審査中' ? '#FCD34D' : status === '否認' ? '#FCA5A5' : '#E2E8F0'
                  const badgeBg = status === '承認済' ? '#ECFDF5' : status === '審査中' ? '#FEF3C7' : status === '否認' ? '#FEE2E2' : '#F1F5F9'
                  const badgeColor = status === '承認済' ? '#16A34A' : status === '審査中' ? '#92400E' : status === '否認' ? '#DC2626' : '#64748B'
                  const isUploading = uploadingType === doc.key
                  return (
                    <div key={doc.key} style={{ background: '#fff', borderRadius: '12px', border: '1px solid ' + border, padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ fontSize: '28px' }}>{doc.icon}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', fontWeight: '700', marginBottom: '3px' }}>{doc.name} {doc.required && <span style={{ fontSize: '10px', color: '#DC2626', background: '#FEE2E2', padding: '1px 6px', borderRadius: '3px', marginLeft: '4px' }}>必須</span>}</div>
                      </div>
                      <span style={{ fontSize: '11px', fontWeight: '700', padding: '3px 10px', borderRadius: '20px', background: badgeBg, color: badgeColor, flexShrink: 0 }}>{status}</span>
                      <label style={{ background: isUploading ? '#ccc' : '#F5A623', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '12px', fontWeight: '700', cursor: isUploading ? 'not-allowed' : 'pointer', flexShrink: 0 }}>
                        {isUploading ? '送信中...' : (status === '未提出' ? '📎 アップロード' : '🔄 再提出')}
                        <input type='file' accept='image/*,application/pdf' style={{ display: 'none' }} disabled={isUploading}
                          onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadDoc(doc.key, file); e.currentTarget.value = '' }} />
                      </label>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {/* プロフィール */}
          {tab === 'profile' && (
            <div className='admin-two-col' style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '20px' }}>
                <div style={{ fontWeight: '700', fontSize: '14px', marginBottom: '16px' }}>👤 基本情報</div>
                {!profileEdit ? (
                  <>
                    {[
                      { label: '氏名', value: profile.name || '未設定' },
                      { label: '店舗名', value: profile.shop_name || '未設定' },
                      { label: 'メール', value: profile.email || '未設定' },
                      { label: '電話番号', value: profile.phone || '未設定' },
                      { label: 'ジャンル', value: profile.genre || '未設定' },
                      { label: '活動エリア', value: profile.areas.length > 0 ? profile.areas.join('・') : '未設定' },
                    ].map(fld => (
                      <div key={fld.label} style={{ display: 'flex', padding: '10px 0', borderBottom: '1px solid #F1F5F9' }}>
                        <div style={{ width: '100px', fontSize: '12px', color: '#64748B', flexShrink: 0 }}>{fld.label}</div>
                        <div style={{ fontSize: '13px', fontWeight: '500', color: fld.value === '未設定' ? '#94A3B8' : '#1a1a1a' }}>{fld.value}</div>
                      </div>
                    ))}
                    <button onClick={startProfileEdit} style={{ marginTop: '16px', width: '100%', background: '#F5A623', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>✏️ 編集する</button>
                  </>
                ) : (
                  <>
                    {[
                      { label: '氏名', key: 'name', ph: '例：山田 花子' },
                      { label: '店舗名', key: 'shop_name', ph: "例：Hana's Sweets" },
                      { label: 'メール', key: 'email', ph: '例：hanako@example.com' },
                      { label: '電話番号', key: 'phone', ph: '例：090-1234-5678' },
                      { label: 'ジャンル', key: 'genre', ph: '例：焼き菓子・スイーツ' },
                    ].map(fld => (
                      <div key={fld.key} style={{ marginBottom: '12px' }}>
                        <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '4px' }}>{fld.label}</div>
                        <input value={(profileForm as any)[fld.key]} onChange={e => setProfileForm({ ...profileForm, [fld.key]: e.target.value })} placeholder={fld.ph} style={{ width: '100%', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '8px 10px', fontSize: '13px', color: '#1a1a1a', boxSizing: 'border-box' }} />
                      </div>
                    ))}
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '4px' }}>活動エリア（「・」や「,」区切りで複数可）</div>
                      <input value={areasInput} onChange={e => setAreasInput(e.target.value)} placeholder='例：東京都・神奈川県' style={{ width: '100%', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '8px 10px', fontSize: '13px', color: '#1a1a1a', boxSizing: 'border-box' }} />
                    </div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                      <button onClick={() => setProfileEdit(false)} disabled={profileSaving} style={{ flex: 1, background: '#fff', color: '#64748B', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '10px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>キャンセル</button>
                      <button onClick={saveProfile} disabled={profileSaving} style={{ flex: 2, background: profileSaving ? '#ccc' : '#F5A623', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px', fontSize: '13px', fontWeight: '700', cursor: profileSaving ? 'not-allowed' : 'pointer' }}>{profileSaving ? '保存中...' : '保存する'}</button>
                    </div>
                  </>
                )}
              </div>
              <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '20px' }}>
                <div style={{ fontWeight: '700', fontSize: '14px', marginBottom: '16px' }}>📱 SNS・メディア</div>
                {!profileEdit ? (
                  ([
                    { label: 'Instagram', value: snsLinks.instagram, icon: '📸' },
                    { label: 'X（Twitter）', value: snsLinks.twitter, icon: '🐦' },
                    { label: 'YouTube', value: snsLinks.youtube, icon: '▶️' },
                    { label: 'TikTok', value: snsLinks.tiktok, icon: '🎵' },
                  ]).map(s => (
                    <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: '1px solid #F1F5F9' }}>
                      <span style={{ fontSize: '18px' }}>{s.icon}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '11px', color: '#64748B' }}>{s.label}</div>
                        <div style={{ fontSize: '13px', fontWeight: '500', color: !s.value ? '#94A3B8' : '#1D4ED8' }}>{s.value || '未設定'}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  ([
                    { label: 'Instagram', key: 'instagram', icon: '📸', ph: '例：@hana_sweets' },
                    { label: 'X（Twitter）', key: 'twitter', icon: '🐦', ph: '例：@hana_sweets_jp' },
                    { label: 'YouTube', key: 'youtube', icon: '▶️', ph: 'チャンネル名やURL' },
                    { label: 'TikTok', key: 'tiktok', icon: '🎵', ph: '例：@hana_sweets' },
                  ]).map(s => (
                    <div key={s.key} style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '4px' }}>{s.icon} {s.label}</div>
                      <input value={(snsForm as any)[s.key]} onChange={e => setSnsForm({ ...snsForm, [s.key]: e.target.value })} placeholder={s.ph} style={{ width: '100%', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '8px 10px', fontSize: '13px', color: '#1a1a1a', boxSizing: 'border-box' }} />
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* 売上報告 */}
          {tab === 'sales' && (
            <>
              <div style={{ background: '#FFF8E1', border: '1px solid #FFE082', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: '#B45309', display: 'flex', gap: '8px' }}>
                <span>💰</span><span>承認された案件ごとに売上を入力すると、出店料（出店コネクトナビへのお支払い額）とあなたの利益（手取り）が自動計算されます。</span>
              </div>

              <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '20px', marginBottom: '16px' }}>
                <div style={{ fontWeight: '700', fontSize: '14px', marginBottom: '16px' }}>📝 売上を入力</div>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div style={{ flex: '1 1 200px' }}>
                    <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '6px' }}>案件</div>
                    <select value={saleAppId} onChange={e => setSaleAppId(e.target.value)} style={{ width: '100%', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', color: '#1a1a1a', background: '#fff' }}>
                      <option value=''>選択してください</option>
                      {myApprovedApps.map(a => (<option key={a.application_id} value={a.application_id}>{a.placeTitle}</option>))}
                    </select>
                  </div>
                  <div style={{ flex: '0 1 160px' }}>
                    <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '6px' }}>売上日</div>
                    <input type='date' value={saleDate} onChange={e => setSaleDate(e.target.value)} style={{ width: '100%', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', color: '#1a1a1a' }} />
                  </div>
                  <div style={{ flex: '0 1 140px' }}>
                    <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '6px' }}>売上金額（円）</div>
                    <input type='number' value={saleRevenue} onChange={e => setSaleRevenue(e.target.value)} placeholder='50000' style={{ width: '100%', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', color: '#1a1a1a' }} />
                  </div>
                  <button onClick={saveMySale} disabled={saleSaving} style={{ background: saleSaving ? '#ccc' : '#F5A623', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 20px', fontSize: '13px', fontWeight: '700', cursor: saleSaving ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>{saleSaving ? '保存中...' : '記録する'}</button>
                </div>
                {saleAppId && (() => { const a = myApprovedApps.find(x => x.application_id === saleAppId); if (!a) return null; const rev = parseInt(saleRevenue || '0', 10) || 0; const fee = calcFee(rev, a.price_fixed, a.price_share_pct); return (
                  <div style={{ marginTop: '12px', fontSize: '12px', color: '#64748B' }}>売上{rev.toLocaleString()}円 − 出店料{fee.toLocaleString()}円（税別・出店コネクトナビへ）＝ あなたの利益 <strong style={{ color: '#16A34A' }}>{(rev - fee).toLocaleString()}円</strong></div>
                ) })()}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '14px', marginBottom: '20px' }}>
                {(() => {
                  const totalRev = mySales.reduce((s, r) => s + r.revenue, 0)
                  const totalFee = mySales.reduce((s, r) => s + r.fee, 0)
                  const cards = [
                    { label: '月の売上', value: totalRev, color: '#F5A623' },
                    { label: '出店料（お支払い・税別）', value: totalFee, color: '#3A9BD5' },
                    { label: 'あなたの利益（手取り）', value: totalRev - totalFee, color: '#16A34A' },
                  ]
                  return cards.map(card => (
                    <div key={card.label} style={{ background: '#fff', borderRadius: '12px', padding: '16px', border: '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '8px' }}>{card.label}</div>
                      <div style={{ fontSize: '20px', fontWeight: '900', color: card.color }}>¥{card.value.toLocaleString()}</div>
                    </div>
                  ))
                })()}
              </div>

              <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr>
                      {['売上日', '案件', '売上', '出店料(税別)', 'あなたの利益', ''].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', color: '#64748B', fontWeight: '600', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {mySales.length === 0 ? (
                      <tr><td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: '#999' }}>この月の売上記録はまだありません。</td></tr>
                    ) : mySales.map((s, i) => (
                      <tr key={s.id} style={{ borderBottom: i < mySales.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>{s.sale_date}</td>
                        <td style={{ padding: '10px 14px' }}>{s.placeTitle}</td>
                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>¥{s.revenue.toLocaleString()}</td>
                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', color: '#3A9BD5' }}>¥{s.fee.toLocaleString()}</td>
                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', color: '#16A34A', fontWeight: '700' }}>¥{(s.revenue - s.fee).toLocaleString()}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <button onClick={() => { if (window.confirm('この売上記録を削除しますか？')) deleteMySale(s.id) }} style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', borderRadius: '6px', padding: '5px 10px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}>削除</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
