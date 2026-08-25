'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import DashboardFooter from '../../components/DashboardFooter'

type DbMessage = { id: string, application_id: string, sender_id: string, body: string, sent_at: string, read_at?: string | null, file_url?: string | null }

// ジャンル＝「何を売るか」。旧サイトから移行した1,300件超が使っている5分類に揃える。
// profiles.genre は text 型で ["食事","スイーツ"] のようなJSON文字列を保持しており、
// 出店者一覧の絞り込みもこの値で行うため、保存形式を既存データと合わせること。
const SELLER_GENRES: { value: string, label: string }[] = [
  { value: '食事', label: '食事（フード・軽食）' },
  { value: 'スイーツ', label: 'スイーツ（菓子・デザート）' },
  { value: 'ドリンク', label: 'ドリンク（カフェ・飲料）' },
  { value: '物販', label: '物販（雑貨・ハンドメイドなど）' },
  { value: 'サービス', label: 'サービス（体験・ワークショップなど）' },
]

// 販売形態＝「どう売るか」。ジャンルとは別の軸なので sales_type に持たせる。
const SELLER_SALES_TYPES = ['キッチンカー', '店頭出店（実店舗）', 'テント・ブース', '移動販売車', 'その他']

function parseGenres(v: string): string[] {
  const t = (v || '').trim()
  if (!t) return []
  if (t.startsWith('[')) {
    try { const j = JSON.parse(t); if (Array.isArray(j)) return j.map(x => String(x).trim()).filter(Boolean) } catch { /* 旧い自由入力はカンマ区切りとして扱う */ }
  }
  return t.split(/[,、，]/).map(x => x.trim()).filter(Boolean)
}

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

const docTypes = [
  { key: 'license_front', name: '運転免許証（表面）', required: true },
  { key: 'license_back', name: '運転免許証（裏面）', required: true },
  { key: 'food_hygiene', name: '食品衛生責任者証', required: true },
  { key: 'liability_insurance', name: '損害賠償保険証書', required: true },
  { key: 'business_permit', name: '営業許可証', required: true },
  { key: 'pl_insurance', name: 'PL保険証券', required: true },
  { key: 'inspection_sample', name: '検体（検査結果）', required: false },
  { key: 'other_permit', name: 'その他許可証', required: false },
]

const docStatusLabel = (s: string | undefined) =>
  s === 'approved' ? '承認済' : s === 'pending' ? '審査中' : s === 'rejected' ? '否認' : '未提出'

export default function SellerDashboard() {
  const router = useRouter()
  type TabKey = 'home'|'applies'|'calendar'|'messages'|'docs'|'profile'|'sales'
  const validTabs: TabKey[] = ['home','applies','calendar','messages','docs','profile','sales']
  const [tab, setTab] = useState<TabKey>(() => { if (typeof window === 'undefined') return 'home'; const t = new URLSearchParams(window.location.search).get('tab'); return (t && validTabs.includes(t as TabKey)) ? (t as TabKey) : 'home' })
  const [chatOpen, setChatOpen] = useState<string|null>(null)
  const [msg, setMsg] = useState('')
  const [dbMessages, setDbMessages] = useState<DbMessage[]>([])
  const [myId, setMyId] = useState<string|null>(null)
  const [appId, setAppId] = useState<string|null>(null)
  type MsgThread = { application_id: string, placeTitle: string, lastBody: string, unread: number }
  const [threads, setThreads] = useState<MsgThread[]>([])
  const [unread, setUnread] = useState(0)
  type MyApply = { id: string, place: string, date: string, rawDate: string | null, reminderDays: number, type: string, status: string, statusColor: string, statusBg: string }
  const [myApplies, setMyApplies] = useState<MyApply[]>([])
  const [appliesError, setAppliesError] = useState('')
  // この画面を見ているアカウントの種別（seller / host / admin / none）
  const [viewerRole, setViewerRole] = useState<string>('')
  const [viewerName, setViewerName] = useState('')
  const [msgError, setMsgError] = useState('')
  // カレンダーの表示月。今月を初期値にし、‹ › で前後の月に移動できる
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() } })
  type DocRow = { id: string, doc_type: string, file_url: string, status: string, expiry_date: string | null }
  const [myDocs, setMyDocs] = useState<DocRow[]>([])
  const [uploadingType, setUploadingType] = useState<string | null>(null)

  // ===== プロフィール（出店者） =====
  type ProfileData = { name: string, shop_name: string, email: string, phone: string, genre: string, address: string, areas: string[], bio: string, sales_type: string, vehicle_type: string, size_length: string, size_width: string, size_height: string, equipment: string, menu: string }
  type SnsLinks = { instagram: string, twitter: string, youtube: string, tiktok: string }
  const emptyProfile: ProfileData = { name: '', shop_name: '', email: '', phone: '', genre: '', address: '', areas: [], bio: '', sales_type: '', vehicle_type: '', size_length: '', size_width: '', size_height: '', equipment: '', menu: '' }
  const emptySns: SnsLinks = { instagram: '', twitter: '', youtube: '', tiktok: '' }
  const [profile, setProfile] = useState<ProfileData>(emptyProfile)
  const [snsLinks, setSnsLinks] = useState<SnsLinks>(emptySns)
  const [profileEdit, setProfileEdit] = useState(false)
  const [profileForm, setProfileForm] = useState<ProfileData>(emptyProfile)
  const [snsForm, setSnsForm] = useState<SnsLinks>(emptySns)
  const [areasInput, setAreasInput] = useState('')
  const [profileSaving, setProfileSaving] = useState(false)
  const [photos, setPhotos] = useState<string[]>([])
  const [photoUploading, setPhotoUploading] = useState(false)
  const [approvalStatus, setApprovalStatus] = useState<string>('unsubmitted')
  const [publishSaving, setPublishSaving] = useState(false)

  // ===== 提供メニュー =====
  type MenuItem = { id: string, name: string, price: number | null, photo_url: string | null, sort_order: number }
  const [menus, setMenus] = useState<MenuItem[]>([])
  const [menuName, setMenuName] = useState("")
  const [menuPrice, setMenuPrice] = useState("")
  const [menuPhotoUrl, setMenuPhotoUrl] = useState("")
  const [menuPhotoUploading, setMenuPhotoUploading] = useState(false)
  const [menuSaving, setMenuSaving] = useState(false)

  // 自分のプロフィールとSNSを読み込む
  const loadProfile = async () => {
    const { data: userData } = await supabase.auth.getUser()
    const uid = userData.user?.id
    // 出店者以外がこの画面を開くと、申込もメッセージも空になり
    // 「反映されない」ように見えてしまうため、誰でログインしているかを判定する
    if (!uid) { setViewerRole('none'); return }
    const { data: p } = await supabase
      .from('profiles')
      .select('name, shop_name, email, phone, genre, address, areas, bio, sales_type, vehicle_type, size_length, size_width, size_height, equipment, menu, photos, approval_status, role')
      .eq('id', uid).single()
    setViewerRole(p?.role === 'seller' ? 'seller' : (p?.role || 'unknown'))
    setViewerName(p?.shop_name || p?.name || p?.email || '')
    if (p) {
      const pd: ProfileData = {
        name: p.name || '', shop_name: p.shop_name || '', email: p.email || '',
        phone: p.phone || '', genre: p.genre || '', address: p.address || '',
        areas: Array.isArray(p.areas) ? p.areas : [],
        bio: p.bio || '', sales_type: p.sales_type || '', vehicle_type: p.vehicle_type || '',
        size_length: p.size_length || '', size_width: p.size_width || '', size_height: p.size_height || '',
        equipment: p.equipment || '', menu: p.menu || '',
      }
      setProfile(pd)
      setApprovalStatus(p.approval_status || 'unsubmitted')
      setPhotos(Array.isArray(p.photos) ? p.photos : [])
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
    await loadMenus(uid)
  }

  // 自分のメニューを読み込む
  const loadMenus = async (uid: string) => {
    const { data } = await supabase
      .from('menus')
      .select('id, name, price, photo_url, sort_order')
      .eq('seller_id', uid)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true })
    setMenus((data || []) as MenuItem[])
  }

  // 編集開始：表示値をフォームにコピー
  const startProfileEdit = () => {
    setProfileForm(profile)
    setSnsForm(snsLinks)
    setAreasInput(profile.areas.join('・'))
    setProfileEdit(true)
  }

  // 写真アップロード（最大8枚, seller-photos バケット）
  const uploadPhoto = async (file: File) => {
    if (photos.length >= 8) { alert('写真は最大8枚までです'); return }
    const { data: userData } = await supabase.auth.getUser()
    const uid = userData.user?.id
    if (!uid) return
    setPhotoUploading(true)
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const path = uid + '/' + Date.now() + '.' + ext
    const up = await supabase.storage.from('seller-photos').upload(path, file, { upsert: true })
    if (up.error) { alert('写真アップロード失敗: ' + up.error.message); setPhotoUploading(false); return }
    const { data: pub } = supabase.storage.from('seller-photos').getPublicUrl(path)
    const newPhotos = [...photos, pub.publicUrl]
    setPhotos(newPhotos)
    const { error: dbErr } = await supabase.from('profiles').update({ photos: newPhotos }).eq('id', uid)
    if (dbErr) { alert('写真の保存に失敗: ' + dbErr.message) }
    setPhotoUploading(false)
  }

  // 写真削除
  const removePhoto = async (url: string) => {
    const { data: userData } = await supabase.auth.getUser()
    const uid = userData.user?.id
    if (!uid) return
    const newPhotos = photos.filter(p => p !== url)
    setPhotos(newPhotos)
    const { error: dbErr } = await supabase.from('profiles').update({ photos: newPhotos }).eq('id', uid)
    if (dbErr) { alert('写真の削除に失敗: ' + dbErr.message); return }
    const marker = '/seller-photos/'
    const idx = url.indexOf(marker)
    if (idx !== -1) { const sp = url.substring(idx + marker.length); await supabase.storage.from('seller-photos').remove([sp]) }
  }

  // メニュー写真アップロード（seller-photos バケット, menu- 始まり）
  const uploadMenuPhoto = async (file: File) => {
    const { data: userData } = await supabase.auth.getUser()
    const uid = userData.user?.id
    if (!uid) return
    setMenuPhotoUploading(true)
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const filePath = uid + '/menu-' + Date.now() + '.' + ext
    const up = await supabase.storage.from('seller-photos').upload(filePath, file, { upsert: true })
    if (up.error) { alert('写真アップロード失敗: ' + up.error.message); setMenuPhotoUploading(false); return }
    const { data: pub } = supabase.storage.from('seller-photos').getPublicUrl(filePath)
    setMenuPhotoUrl(pub.publicUrl)
    setMenuPhotoUploading(false)
  }

  // メニュー追加
  const addMenu = async () => {
    const { data: userData } = await supabase.auth.getUser()
    const uid = userData.user?.id
    if (!uid) return
    if (!menuName.trim()) { alert('メニュー名を入力してください'); return }
    setMenuSaving(true)
    const priceNum = menuPrice.trim() === '' ? null : parseInt(menuPrice.replace(/[^0-9]/g, ''), 10)
    const nextOrder = menus.length > 0 ? Math.max(...menus.map(m => m.sort_order)) + 1 : 0
    const { error } = await supabase.from('menus').insert({
      seller_id: uid,
      name: menuName.trim(),
      price: priceNum,
      photo_url: menuPhotoUrl || null,
      sort_order: nextOrder,
    })
    if (error) { alert('メニューの追加に失敗: ' + error.message); setMenuSaving(false); return }
    setMenuName(''); setMenuPrice(''); setMenuPhotoUrl('')
    await loadMenus(uid)
    setMenuSaving(false)
  }

  // メニュー削除
  const deleteMenu = async (m: MenuItem) => {
    if (!confirm('このメニューを削除しますか？')) return
    const { data: userData } = await supabase.auth.getUser()
    const uid = userData.user?.id
    if (!uid) return
    const { error } = await supabase.from('menus').delete().eq('id', m.id)
    if (error) { alert('メニューの削除に失敗: ' + error.message); return }
    if (m.photo_url) {
      const mk = '/seller-photos/'
      const idx = m.photo_url.indexOf(mk)
      if (idx !== -1) { const sp = m.photo_url.substring(idx + mk.length); await supabase.storage.from('seller-photos').remove([sp]) }
    }
    await loadMenus(uid)
  }

  // 公開を申請する（unsubmitted/rejected -> pending）
  const requestPublish = async () => {
    const { data: userData } = await supabase.auth.getUser()
    const uid = userData.user?.id
    if (!uid) return
    setPublishSaving(true)
    const { error } = await supabase.from('profiles').update({
      approval_status: 'pending',
      publish_requested: true,
      submitted_at: new Date().toISOString(),
    }).eq('id', uid)
    setPublishSaving(false)
    if (error) { alert('申請に失敗しました: ' + error.message); return }
    setApprovalStatus('pending')
    alert('公開を申請しました。運営の承認をお待ちください。')
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
      bio: profileForm.bio, sales_type: profileForm.sales_type, vehicle_type: profileForm.vehicle_type,
      size_length: profileForm.size_length, size_width: profileForm.size_width, size_height: profileForm.size_height,
      equipment: profileForm.equipment, menu: profileForm.menu, photos,
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
  type SellerApp = { application_id: string, place_id: string, placeTitle: string, price_fixed: number, price_share_pct: number, place_fixed_unit: string, company_fixed_amount: number, company_fixed_unit: string, company_share_pct: number, share_tax_basis: string, share_tax_rate: number, apply_date: string }
  type SellerSale = { id: string, sale_date: string, placeTitle: string, revenue: number, fee: number }
  const [myApprovedApps, setMyApprovedApps] = useState<SellerApp[]>([])
  const [mySales, setMySales] = useState<SellerSale[]>([])
  const [saleAppId, setSaleAppId] = useState('')
  const [saleDate, setSaleDate] = useState('')
  const [saleRevenue, setSaleRevenue] = useState('')
  const [saleSaving, setSaleSaving] = useState(false)
  const [saleTaxOv, setSaleTaxOv] = useState('')
  // 税率ごとに分けて入力するモード（任意）。フードは8%・お酒や物販は10%など混在するイベント向け
  const [saleSplit, setSaleSplit] = useState(false)
  const [saleRev8, setSaleRev8] = useState('')
  const [saleRev10, setSaleRev10] = useState('')
  const taxOf = (a: { share_tax_basis: string, share_tax_rate: number }, ov: string) =>
    ov === 'ex8' ? { basis: 'tax_excluded', rate: 8 }
    : ov === 'ex10' ? { basis: 'tax_excluded', rate: 10 }
    : ov === 'as_entered' ? { basis: 'as_entered', rate: 10 }
    : { basis: a.share_tax_basis || 'as_entered', rate: a.share_tax_rate || 8 }
  const [saleMonth, setSaleMonth] = useState(() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') })
  // 税率ごとに分けて入力した場合も、出店料は売上の合計額から計算する。
  // 分けた内訳は記録用に保存するだけで、金額は分けても分けなくても同じになる。

  const calcFee = (revenue: number, a: SellerApp, ov: string = '', baseOverride: number | null = null) => {
    const { basis, rate } = taxOf(a, ov)
    const base = baseOverride != null ? baseOverride : (basis === 'tax_excluded' ? Math.floor(revenue / (1 + rate / 100)) : revenue)
    const placeFixed = a.place_fixed_unit === 'per_event' ? 0 : (a.price_fixed || 0)
    const companyFixed = a.company_fixed_unit === 'per_event' ? 0 : (a.company_fixed_amount || 0)
    const placeFee = Math.floor(placeFixed + base * (a.price_share_pct || 0) / 100)
    const companyFee = Math.floor(companyFixed + base * (a.company_share_pct || 0) / 100)
    return { placeFee, companyFee, total: placeFee + companyFee }
  }
  const todayStr = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') }

  // 自分の承認済み案件を読み込む
  const loadMyApprovedApps = async () => {
    const { data: userData } = await supabase.auth.getUser()
    const uid = userData.user?.id
    if (!uid) return
    const { data } = await supabase
      .from('applications')
      .select('id, place_id, apply_date, places(title, price_fixed, price_share_pct, place_fixed_unit, company_fixed_amount, company_fixed_unit, company_share_pct, share_tax_basis, share_tax_rate)')
      .eq('seller_id', uid).eq('status', 'approved')
      .order('created_at', { ascending: false })
    const mapped: SellerApp[] = (data || []).map((a: any) => ({
      application_id: a.id, place_id: a.place_id,
      placeTitle: a.places?.title || '(案件名なし)',
      price_fixed: a.places?.price_fixed || 0, price_share_pct: a.places?.price_share_pct || 0,
      place_fixed_unit: a.places?.place_fixed_unit || 'per_day', company_fixed_amount: a.places?.company_fixed_amount || 0,
      company_fixed_unit: a.places?.company_fixed_unit || 'per_day', company_share_pct: a.places?.company_share_pct || 0,
      share_tax_basis: a.places?.share_tax_basis || 'as_entered', share_tax_rate: a.places?.share_tax_rate || 8,
      apply_date: a.apply_date || '',
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
      .select('id, sale_date, revenue, fee, total_pay, places(title)')
      .eq('seller_id', uid).gte('sale_date', start).lt('sale_date', end)
      .order('sale_date', { ascending: false })
    const mapped: SellerSale[] = (data || []).map((s: any) => ({
      id: s.id, sale_date: s.sale_date, revenue: s.revenue, fee: s.total_pay ?? s.fee,
      placeTitle: s.places?.title || '(案件名なし)',
    }))
    setMySales(mapped)
  }

  // 自分の売上を保存
  const saveMySale = async () => {
    if (!saleAppId || !saleDate || (saleSplit ? (!saleRev8 && !saleRev10) : !saleRevenue)) { alert('案件・日付・売上金額をすべて入力してください'); return }
    const app = myApprovedApps.find(x => x.application_id === saleAppId)
    if (!app) { alert('案件が選択されていません'); return }
    const rev8 = saleSplit ? (parseInt(saleRev8 || '0', 10) || 0) : 0
    const rev10 = saleSplit ? (parseInt(saleRev10 || '0', 10) || 0) : 0
    if (saleSplit && (rev8 < 0 || rev10 < 0)) { alert('売上金額は0以上の数値で入力してください'); return }
    const revenue = saleSplit ? rev8 + rev10 : parseInt(saleRevenue, 10)
    if (isNaN(revenue) || revenue < 0) { alert('売上金額は0以上の数値で入力してください'); return }
    const td = todayStr()
    if (app.apply_date && td < app.apply_date) { alert('この案件の出店日は ' + app.apply_date + ' です。出店日を過ぎてから売上を入力してください。'); return }
    if (app.apply_date && saleDate < app.apply_date) { alert('売上日は出店日（' + app.apply_date + '）以降を指定してください。'); return }
    if (saleDate > td) { alert('未来の日付では売上を記録できません。'); return }
    setSaleSaving(true)
    const { placeFee, companyFee, total } = calcFee(revenue, app, saleTaxOv)
    const applied = taxOf(app, saleTaxOv)
    const { data: userData } = await supabase.auth.getUser()
    const uid = userData.user?.id
    const row: Record<string, unknown> = {
      application_id: app.application_id, place_id: app.place_id, seller_id: uid,
      sale_date: saleDate, revenue, fee: companyFee, place_fee: placeFee, company_fee: companyFee, total_pay: total,
      // 分割したかどうかは revenue_reduced / revenue_standard の有無で判別する
      tax_basis: applied.basis, tax_rate: applied.rate,
    }
    // 内訳は分けて入力したときだけ渡す
    if (saleSplit) { row.revenue_reduced = rev8; row.revenue_standard = rev10 }
    const { error } = await supabase.from('sales').insert(row)
    if (error) { alert('保存失敗: ' + error.message); setSaleSaving(false); return }
    setSaleAppId(''); setSaleDate(''); setSaleRevenue(''); setSaleRev8(''); setSaleRev10(''); setSaleSaving(false)
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
    const { data, error } = await supabase
      .from('applications')
      .select('id, apply_date, format, status, places(title, reminder_days)')
      .eq('seller_id', uid)
      .order('created_at', { ascending: false })
    // 読み込みに失敗したときに、申込が無いのと同じ見た目にならないようにする
    if (error) { setAppliesError('申込の読み込みに失敗しました: ' + error.message); return }
    setAppliesError('')
    if (!data) return
    const mapped: MyApply[] = data.map((a: any) => {
      const s = statusMap[a.status] || { label: a.status, color: '#555', bg: '#F3F4F6' }
      return {
        id: a.id,
        place: a.places?.title || '(案件名なし)',
        date: a.apply_date || '日付未定',
        rawDate: a.apply_date || null,
        reminderDays: a.places?.reminder_days ?? 7,
        type: a.format || '-',
        status: s.label,
        statusColor: s.color,
        statusBg: s.bg,
      }
    })
    setMyApplies(mapped)
  }

  // 申込のキャンセル（審査中・承認済のどちらも本人なら取消可）
  const [cancelingId, setCancelingId] = useState<string | null>(null)
  const cancelApplication = async (appId: string, statusLabel: string) => {
    const ok = window.confirm(
      statusLabel === '承認済'
        ? 'この承認済みの申込をキャンセルしますか？募集者にも通知されます。この操作は取り消せません。'
        : 'この申込をキャンセルしますか？この操作は取り消せません。'
    )
    if (!ok) return
    setCancelingId(appId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) { alert('ログインが必要です。再度ログインしてください。'); return }
      const res = await fetch('/api/applications/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ applicationId: appId }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { alert('キャンセルに失敗しました: ' + (json.error || res.status)); return }
      await loadApplies()
      loadMyApprovedApps()
      loadMySales()
    } finally {
      setCancelingId(null)
    }
  }

  // ログイン中ユーザーの提出書類を読み込む
  const loadDocs = async () => {
    const { data: userData } = await supabase.auth.getUser()
    const uid = userData.user?.id
    if (!uid) return
    const { data } = await supabase
      .from('seller_documents')
      .select('id, doc_type, file_url, status, expiry_date')
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

  // 有効期限だけを保存する（免許証は表裏の両方に同じ期限を書き込む）
  const saveExpiry = async (docType: string, value: string) => {
    const { data: userData } = await supabase.auth.getUser()
    const uid = userData.user?.id
    if (!uid) return
    const expiry = value === '' ? null : value
    // 免許証の表面で入力したら、表・裏の両方を更新する
    const targets = (docType === 'license_front' || docType === 'license_back')
      ? ['license_front', 'license_back']
      : [docType]
    for (const t of targets) {
      await supabase.from('seller_documents')
        .update({ expiry_date: expiry })
        .eq('seller_id', uid)
        .eq('doc_type', t)
    }
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
      .select('id, application_id, sender_id, body, sent_at, read_at, file_url')
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
    // myId はまだ入っていないことがあるため、その場で取り直す
    const { data: ud } = await supabase.auth.getUser()
    const uid = ud.user?.id || myId
    if (uid && uid !== myId) setMyId(uid)
    const { data: msgs, error } = await supabase
      .from('messages')
      .select('id, application_id, sender_id, body, sent_at, read_at, file_url')
      .eq('application_id', aid)
      .order('sent_at', { ascending: true })
    if (error) { setMsgError('メッセージを読み込めませんでした: ' + error.message); return }
    setMsgError('')
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

  const [msgFile, setMsgFile] = useState<File | null>(null)
  const [msgUploading, setMsgUploading] = useState(false)
  // 添付ファイルを表示する（画像はインライン、それ以外はリンク）
  const renderAttachment = (filePath: string, isMine: boolean) => {
    const { data } = supabase.storage.from('message-attachments').getPublicUrl(filePath)
    const url = data.publicUrl
    const isImage = /\.(jpe?g|png|gif|webp)$/i.test(filePath)
    if (isImage) {
      return (
        <a href={url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', marginTop: '6px' }}>
          <img src={url} alt="添付画像" style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px', display: 'block' }} />
        </a>
      )
    }
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: '6px', fontSize: '12px', textDecoration: 'underline', color: isMine ? '#fff' : '#2563EB' }}>📎 ファイルを開く</a>
    )
  }


  // 自分が送ったメッセージを取り消す（打ち間違いの取り消し用）
  const retractMessage = async (messageId: string) => {
    if (!window.confirm('このメッセージを取り消しますか？\n相手の画面からも削除されます。')) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { alert('ログインが必要です'); return }
    const res = await fetch('/api/messages/retract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messageId, requesterId: user.id }),
    })
    const result = await res.json()
    if (!res.ok) { alert('取り消せませんでした: ' + (result.error || '不明なエラー')); return }
    if (appId) openThread(appId)
    loadMessages()
  }

  // メッセージを送信する
  const sendMessage = async () => {
    const text = msg.trim()
    if (!text && !msgFile) return
    // 送り先が決まっていないまま押されたときは、黙って何もしないのではなく理由を伝える
    if (!appId) { alert('先に左のリストからやり取りする案件を選んでください。'); return }
    if (!myId) { alert('ログイン情報を確認できませんでした。再度ログインしてください。'); return }
    setMsgUploading(true)
    let fileUrl = null
    if (msgFile) {
      const rawExt = (msgFile.name.split('.').pop() || '').toLowerCase()
      const ext = /^[a-z0-9]{1,5}$/.test(rawExt) ? rawExt : 'dat'
      const path = myId + '/msg-' + Date.now() + '.' + ext
      const up = await supabase.storage.from('message-attachments').upload(path, msgFile, { upsert: true })
      if (up.error) { alert('添付に失敗しました: ' + up.error.message); setMsgUploading(false); return }
      fileUrl = path
    }
    const { error } = await supabase
      .from('messages')
      .insert({ application_id: appId, sender_id: myId, body: text, file_url: fileUrl })
    if (error) { alert('送信に失敗しました: ' + error.message); setMsgUploading(false); return }
    setMsg('')
    setMsgFile(null)
    setMsgUploading(false)
    openThread(appId)
  }

  useEffect(() => { loadMessages(); loadApplies(); loadDocs(); loadProfile() }, [])

  // 別のタブで申込や承認をしたあとに戻ってきたとき、古い表示のままにならないよう読み直す。
  // 画面を開いたときに一度読むだけだと「承認したのに反映されない」ように見えてしまう。
  useEffect(() => {
    const reload = () => {
      if (document.visibilityState !== 'visible') return
      loadApplies(); loadMessages(); loadDocs()
    }
    document.addEventListener('visibilitychange', reload)
    window.addEventListener('focus', reload)
    return () => {
      document.removeEventListener('visibilitychange', reload)
      window.removeEventListener('focus', reload)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // タブを切り替えたときも最新にする
  useEffect(() => {
    if (tab === 'calendar' || tab === 'applies') loadApplies()
    if (tab === 'messages') loadMessages()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  // メッセージ画面を開いている間は、相手からの新着が自動で入るようにする。
  // 画面を開いたままだと届いたメッセージに気づけないため。
  useEffect(() => {
    if (tab !== 'messages') return
    const timer = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      loadMessages()
      if (appId) openThread(appId)
    }, 15000)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, appId])

  const navItems = [
    { key: 'home', label: 'ホーム' },
    { key: 'applies', label: '申込一覧' },
    { key: 'calendar', label: 'カレンダー' },
    { key: 'messages', label: 'メッセージ', badge: unread > 0 ? unread : undefined },
    { key: 'docs', label: '書類管理' },
    { key: 'sales', label: '売上報告' },
    { key: 'profile', label: 'プロフィール' },
  ]

  // 出店者以外がこの画面を開いた場合は、空の画面ではなく理由を伝える
  if (viewerRole && viewerRole !== 'seller') {
    const label = viewerRole === 'host' ? '募集者' : viewerRole === 'admin' ? '管理者' : null
    return (
      <div style={{ minHeight: '100vh', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '28px 24px', maxWidth: '420px', textAlign: 'center' }}>
          <div style={{ fontSize: '15px', fontWeight: 800, color: '#1a1a1a', marginBottom: '10px' }}>ここは出店者用の画面です</div>
          <p style={{ fontSize: '13px', color: '#475569', lineHeight: 1.9, marginBottom: '18px' }}>
            {viewerRole === 'none'
              ? 'ログインしていないため、申込やメッセージを表示できません。'
              : `現在${label ? label + 'の' : ''}「${viewerName || 'ほかのアカウント'}」でログインしています。出店者としての申込・メッセージは、出店者アカウントでログインするとご覧いただけます。`}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {viewerRole === 'host' && <Link href='/dashboard/host' style={{ background: '#F5A623', color: '#fff', borderRadius: '8px', padding: '11px', fontSize: '13px', fontWeight: 700, textDecoration: 'none' }}>募集者の画面へ</Link>}
            {viewerRole === 'admin' && <Link href='/admin' style={{ background: '#F5A623', color: '#fff', borderRadius: '8px', padding: '11px', fontSize: '13px', fontWeight: 700, textDecoration: 'none' }}>管理画面へ</Link>}
            <button onClick={async () => { await supabase.auth.signOut(); router.push('/login') }} style={{ background: '#fff', color: '#64748B', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '11px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
              ログアウトして出店者でログイン
            </button>
            <Link href='/' style={{ fontSize: '12px', color: '#94A3B8', textDecoration: 'none', marginTop: '4px' }}>トップページに戻る</Link>
          </div>
        </div>
      </div>
    )
  }

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
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#F5A623', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '900', color: '#fff', flexShrink: 0 }}>{(profile.shop_name || profile.name) ? (profile.shop_name || profile.name).charAt(0) : '出'}</div>
            <div>
              <div style={{ fontSize: '12px', fontWeight: '700', color: '#fff' }}>{profile.shop_name || profile.name || '（未設定）'}</div>
              {profile.name && <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>{profile.name} 様</div>}
            </div>
          </div>
        </div>
        <nav className='admin-sidebar-nav' style={{ padding: '8px 0', flex: 1 }}>
          {navItems.map(item => (
            <div key={item.key} onClick={() => setTab(item.key as typeof tab)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', cursor: 'pointer', color: tab === item.key ? '#fff' : 'rgba(255,255,255,0.6)', background: tab === item.key ? 'rgba(255,255,255,0.1)' : 'transparent', borderLeft: tab === item.key ? '3px solid #F5A623' : '3px solid transparent', fontSize: '13px', position: 'relative' }}>
              <span>{item.label}</span>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            {/* スマホではサイドバーのアカウント表示が隠れるため、ここにも出す */}
            <span style={{ fontSize: '11px', color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '150px' }}>
              {profile.shop_name || profile.name || profile.email || ''}
            </span>
            <Link href="/places" style={{ background: '#F5A623', color: '#fff', borderRadius: '8px', padding: '7px 16px', fontSize: '12px', fontWeight: '700', textDecoration: 'none', whiteSpace: 'nowrap' }}>＋ 新しい案件を探す</Link>
          </div>
        </div>

        <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>

          {/* ホーム */}
          {tab === 'home' && (
            <>
              {(() => {
                const today = new Date(); today.setHours(0,0,0,0)
                const soon = myApplies
                  .filter(a => a.status === '承認済' && a.rawDate)
                  .map(a => {
                    const d = new Date(a.rawDate + 'T00:00:00')
                    const diff = Math.round((d.getTime() - today.getTime()) / 86400000)
                    return { ...a, diff }
                  })
                  .filter(a => a.diff >= 0 && a.diff <= a.reminderDays)
                  .sort((x, y) => x.diff - y.diff)
                if (soon.length === 0) return null
                return (
                  <div style={{ background: '#FFF8E1', border: '1.5px solid #FCD34D', borderRadius: '12px', padding: '16px 18px', marginBottom: '20px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <span style={{ fontSize: '15px', fontWeight: '900', color: '#B45309' }}>もうすぐ出店日です</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {soon.map(a => (
                        <div key={a.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', background: '#fff', borderRadius: '8px', padding: '10px 14px', border: '1px solid #FDE68A' }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '13px', fontWeight: '700', color: '#1a1a1a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.place}</div>
                            <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>{a.date}</div>
                          </div>
                          <span style={{ flexShrink: 0, background: a.diff <= 3 ? '#FEE2E2' : '#FEF3C7', color: a.diff <= 3 ? '#DC2626' : '#B45309', borderRadius: '999px', padding: '4px 12px', fontSize: '13px', fontWeight: '900', whiteSpace: 'nowrap' }}>{a.diff === 0 ? '本日' : 'あと' + a.diff + '日'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}
              <div className='admin-stats' style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '12px', marginBottom: '20px' }}>
                {[
                  { label: '申込中', value: myApplies.filter(a => a.status === '審査中').length + '件', color: '#92400E', bg: '#FEF3C7' },
                  { label: '承認済（今月）', value: myApplies.filter(a => a.status === '承認済').length + '件', color: '#16A34A', bg: '#ECFDF5' },
                  { label: '出店予定日', value: new Set(myApplies.filter(a => a.status === '承認済' && a.date && a.date !== '日付未定').map(a => a.date)).size + '日', color: '#1D4ED8', bg: '#EBF6FD' },
                  { label: '未読メッセージ', value: unread + '件', color: '#DC2626', bg: '#FEE2E2' },
                ].map(s => (
                  <div key={s.label} style={{ background: '#fff', borderRadius: '12px', padding: '16px', border: '1px solid #E2E8F0' }}>
                    <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '8px' }}>{s.label}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ fontSize: '24px', fontWeight: '900', color: s.color }}>{s.value}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className='admin-two-col sales-input-grid' style={{ display: 'grid', gap: '16px' }}>
                <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                  <div style={{ padding: '13px 18px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontWeight: '700', fontSize: '13px' }}>最近の申込</div>
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
                    <div style={{ fontWeight: '700', fontSize: '13px' }}>書類提出状況</div>
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
                      <div style={{ fontSize: '12px', color: '#64748B' }}>{a.date}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: '700', padding: '4px 12px', borderRadius: '20px', background: a.statusBg, color: a.statusColor }}>{a.status}</span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button onClick={() => { setTab('messages'); openThread(a.id) }} style={{ fontSize: '11px', padding: '4px 10px', border: '1px solid #E2E8F0', borderRadius: '6px', background: '#fff', cursor: 'pointer' }}>連絡</button>
                        {(a.status === '審査中' || a.status === '承認済') && <button onClick={() => cancelApplication(a.id, a.status)} disabled={cancelingId === a.id} style={{ fontSize: '11px', padding: '4px 10px', border: '1px solid #FCA5A5', borderRadius: '6px', background: '#FEF2F2', color: '#DC2626', cursor: cancelingId === a.id ? 'not-allowed' : 'pointer' }}>{cancelingId === a.id ? '取消中...' : '取消'}</button>}
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
                {[{ label: '承認済', color: '#16A34A', bg: '#ECFDF5' }, { label: '審査中', color: '#92400E', bg: '#FEF3C7' }, { label: '否認', color: '#DC2626', bg: '#FEE2E2' }].map(l => (
                  <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' }}>
                    <div style={{ width: '12px', height: '12px', borderRadius: '3px', background: l.bg, border: `1px solid ${l.color}` }}></div>
                    {l.label}
                  </div>
                ))}
              </div>
              <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '20px', marginBottom: '16px' }}>
                {(() => {
                  const { y, m } = calMonth
                  const shift = (n: number) => { const d = new Date(y, m + n, 1); setCalMonth({ y: d.getFullYear(), m: d.getMonth() }) }
                  const firstDow = new Date(y, m, 1).getDay()
                  const daysInMonth = new Date(y, m + 1, 0).getDate()
                  const pad = (n: number) => String(n).padStart(2, '0')
                  const keyOf = (d: number) => `${y}-${pad(m + 1)}-${pad(d)}`
                  const today = todayStr()

                  // 申込を日付ごとにまとめる。同じ日に複数件あればすべて表示する
                  const byDate = new Map<string, MyApply[]>()
                  for (const a of myApplies) {
                    if (!a.rawDate) continue
                    const list = byDate.get(a.rawDate)
                    if (list) list.push(a); else byDate.set(a.rawDate, [a])
                  }
                  const monthCount = myApplies.filter(a => a.rawDate && a.rawDate.startsWith(`${y}-${pad(m + 1)}`)).length

                  return (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <button onClick={() => shift(-1)} aria-label='前の月' style={{ border: '1px solid #E2E8F0', borderRadius: '6px', padding: '5px 12px', background: '#fff', cursor: 'pointer', fontSize: '14px' }}>‹</button>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ fontWeight: '700', fontSize: '16px' }}>{y}年{m + 1}月</div>
                          <button onClick={() => { const d = new Date(); setCalMonth({ y: d.getFullYear(), m: d.getMonth() }) }} style={{ border: '1px solid #E2E8F0', borderRadius: '6px', padding: '3px 10px', background: '#fff', cursor: 'pointer', fontSize: '11px', color: '#64748B' }}>今月</button>
                        </div>
                        <button onClick={() => shift(1)} aria-label='次の月' style={{ border: '1px solid #E2E8F0', borderRadius: '6px', padding: '5px 12px', background: '#fff', cursor: 'pointer', fontSize: '14px' }}>›</button>
                      </div>
                      <div style={{ textAlign: 'center', fontSize: '11px', color: '#64748B', marginBottom: '12px' }}>
                        {monthCount > 0 ? `この月の申込 ${monthCount}件` : 'この月の申込はありません'}
                      </div>
                      {monthCount === 0 && (() => {
                        // 表示中の月に無くても他の月にあるなら、その月へ移動できるようにする
                        const others = myApplies.map(a => a.rawDate).filter(Boolean).sort() as string[]
                        if (others.length === 0) {
                          return appliesError ? null : (
                            <div style={{ textAlign: 'center', fontSize: '11px', color: '#94A3B8', marginBottom: '12px' }}>
                              このアカウントにはまだ申込がありません。
                            </div>
                          )
                        }
                        const cur = `${y}-${pad(m + 1)}`
                        const next = others.find(d => d.slice(0, 7) > cur) || others[others.length - 1]
                        const [ny, nm] = next.split('-')
                        return (
                          <div style={{ textAlign: 'center', marginBottom: '12px' }}>
                            <button onClick={() => setCalMonth({ y: parseInt(ny, 10), m: parseInt(nm, 10) - 1 })}
                              style={{ border: '1px solid #FDE68A', background: '#FFFBEB', color: '#B45309', borderRadius: '999px', padding: '5px 14px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
                              他の月に{others.length}件の申込があります（{parseInt(ny, 10)}年{parseInt(nm, 10)}月へ移動）
                            </button>
                          </div>
                        )
                      })()}
                      {appliesError && (
                        <div style={{ textAlign: 'center', fontSize: '11px', color: '#DC2626', marginBottom: '12px' }}>{appliesError}</div>
                      )}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '6px' }}>
                        {['日','月','火','水','木','金','土'].map((d, i) => (
                          <div key={d} style={{ textAlign: 'center', fontSize: '12px', fontWeight: '700', color: i === 0 ? '#DC2626' : i === 6 ? '#1D4ED8' : '#64748B', padding: '6px 0' }}>{d}</div>
                        ))}
                        {Array.from({ length: firstDow }).map((_, i) => <div key={'pad' + i} style={{ minHeight: '60px' }}></div>)}
                        {Array.from({ length: daysInMonth }).map((_, i) => {
                          const d = i + 1
                          const ds = keyOf(d)
                          const items = byDate.get(ds) || []
                          const main = items.find(a => a.status === '承認済') || items[0]
                          const dow = (firstDow + i) % 7
                          const isToday = ds === today
                          return (
                            <div key={d} title={items.map(a => `${a.status}：${a.place}`).join('\n')}
                              style={{ minHeight: '60px', borderRadius: '8px', border: isToday ? '2px solid #F5A623' : `1px solid ${main ? main.statusColor : '#E2E8F0'}`, background: main ? main.statusBg : '#fff', padding: '5px', overflow: 'hidden' }}>
                              <div style={{ fontSize: '12px', fontWeight: isToday ? '800' : '600', color: dow === 0 ? '#DC2626' : dow === 6 ? '#1D4ED8' : '#333', marginBottom: '3px' }}>{d}</div>
                              {items.slice(0, 2).map(a => (
                                <div key={a.id} style={{ fontSize: '9px', fontWeight: '700', color: a.statusColor, lineHeight: 1.3, marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {a.status}<br />{a.place}
                                </div>
                              ))}
                              {items.length > 2 && <div style={{ fontSize: '9px', color: '#64748B' }}>ほか{items.length - 2}件</div>}
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )
                })()}
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
                        <div style={{ color: msgError ? '#DC2626' : '#94A3B8', fontSize: '13px', textAlign: 'center', marginTop: '20px' }}>{msgError || 'まだメッセージがありません'}</div>
                      ) : dbMessages.map(m => (
                        m.sender_id === myId ? (
                          <div key={m.id} style={{ alignSelf: 'flex-end', maxWidth: '70%' }}>
                            <div style={{ background: '#F5A623', color: '#fff', borderRadius: '12px', padding: '10px 14px', fontSize: '13px', lineHeight: 1.6, width: 'fit-content', marginLeft: 'auto', whiteSpace: 'pre-wrap' }}>
                              {m.body && <div>{m.body}</div>}
                              {m.file_url && renderAttachment(m.file_url, true)}
                            </div>
                            <div style={{ textAlign: 'right', marginTop: '3px' }}>
                              <button onClick={() => retractMessage(m.id)} style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '11px', cursor: 'pointer', padding: '2px 4px', textDecoration: 'underline' }}>送信を取り消す</button>
                            </div>
                          </div>
                        ) : (
                          <div key={m.id} style={{ alignSelf: 'flex-start', maxWidth: '70%' }}>
                            <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '10px 14px', fontSize: '13px', lineHeight: 1.6, color: '#1a1a1a', width: 'fit-content', whiteSpace: 'pre-wrap' }}>
                              {m.body && <div>{m.body}</div>}
                              {m.file_url && renderAttachment(m.file_url, false)}
                            </div>
                          </div>
                        )
                      ))}
                    </div>
                    {msgFile ? (
                      <div style={{ padding: '8px 16px', borderTop: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '8px', background: '#FFF7ED' }}>
                        <span style={{ fontSize: '12px', color: '#9A3412', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📎 {msgFile.name}</span>
                        <button onClick={() => setMsgFile(null)} style={{ background: 'none', border: 'none', color: '#9A3412', cursor: 'pointer', fontSize: '14px', fontWeight: '700' }}>✕</button>
                      </div>
                    ) : null}
                    <div style={{ padding: '12px 16px', borderTop: msgFile ? 'none' : '1px solid #E2E8F0', display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <label htmlFor="msg-file-input" style={{ cursor: msgUploading ? 'not-allowed' : 'pointer', fontSize: '20px', opacity: msgUploading ? 0.4 : 1, userSelect: 'none' }}>📎</label>
                      <input id="msg-file-input" type="file" accept="image/*,application/pdf" style={{ display: 'none' }} disabled={msgUploading} onChange={e => { const file = e.target.files?.[0]; if (file) setMsgFile(file); e.currentTarget.value = '' }} />
                      <textarea value={msg} onChange={e => setMsg(e.target.value)} rows={2} onKeyDown={e => {
                        if (e.key !== 'Enter' || e.shiftKey) return
                        // 日本語変換の確定Enterでは送信しない（変換中は無視する）
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const ne = e.nativeEvent as any
                        if (ne?.isComposing || ne?.keyCode === 229) return
                        // 1回目のEnterは改行。すでに末尾が改行なら2回目とみなして送信する
                        if (msg.endsWith('\n')) { e.preventDefault(); sendMessage() }
                      }} placeholder="メッセージを入力...（Enterで改行／2回続けて押すと送信）" disabled={msgUploading} style={{ flex: 1, border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', outline: 'none', color: '#1a1a1a', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }} />
                      <button onClick={sendMessage} disabled={msgUploading} style={{ background: msgUploading ? '#ccc' : '#F5A623', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 16px', fontSize: '13px', fontWeight: '700', cursor: msgUploading ? 'not-allowed' : 'pointer' }}>{msgUploading ? '...' : '送信'}</button>
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
                <span>各書類のファイルを選んでアップロードしてください。提出後は「審査中」になります。</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {docTypes.map(doc => {
                  const rec = myDocs.find(d => d.doc_type === doc.key)
                  const status = docStatusLabel(rec?.status)
                  const border = status === '承認済' ? '#86EFAC' : status === '審査中' ? '#FCD34D' : status === '否認' ? '#FCA5A5' : '#E2E8F0'
                  const badgeBg = status === '承認済' ? '#ECFDF5' : status === '審査中' ? '#FEF3C7' : status === '否認' ? '#FEE2E2' : '#F1F5F9'
                  const badgeColor = status === '承認済' ? '#16A34A' : status === '審査中' ? '#92400E' : status === '否認' ? '#DC2626' : '#64748B'
                  const isUploading = uploadingType === doc.key
                  // 期限欄を出すか: ファイル提出済み かつ 免許裏面ではない（裏面は表面と共有のため非表示）
                  const showExpiry = !!rec && doc.key !== 'license_back'
                  const expiryLabel = doc.key === 'license_front' ? '運転免許証の有効期限' : '有効期限'
                  return (
                    <div key={doc.key} style={{ background: '#fff', borderRadius: '12px', border: '1px solid ' + border, padding: '16px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '13px', fontWeight: '700', marginBottom: '3px' }}>{doc.name} {doc.required && <span style={{ fontSize: '10px', color: '#DC2626', background: '#FEE2E2', padding: '1px 6px', borderRadius: '3px', marginLeft: '4px' }}>必須</span>}</div>
                        </div>
                        <span style={{ fontSize: '11px', fontWeight: '700', padding: '3px 10px', borderRadius: '20px', background: badgeBg, color: badgeColor, flexShrink: 0 }}>{status}</span>
                        <label style={{ background: isUploading ? '#ccc' : '#F5A623', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '12px', fontWeight: '700', cursor: isUploading ? 'not-allowed' : 'pointer', flexShrink: 0 }}>
                          {isUploading ? '送信中...' : (status === '未提出' ? 'アップロード' : '再提出')}
                          <input type='file' accept='image/*,application/pdf' style={{ display: 'none' }} disabled={isUploading}
                            onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadDoc(doc.key, file); e.currentTarget.value = '' }} />
                        </label>
                      </div>
                      {showExpiry && (
                        <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px dashed #E2E8F0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '12px', fontWeight: '600', color: '#475569' }}>{expiryLabel}</span>
                          <input type='date' defaultValue={rec?.expiry_date || ''}
                            onChange={(e) => saveExpiry(doc.key, e.target.value)}
                            style={{ fontSize: '13px', padding: '6px 10px', border: '1px solid #CBD5E1', borderRadius: '8px', color: '#1E2A3B' }} />
                          {rec?.expiry_date && <span style={{ fontSize: '11px', color: '#16A34A', fontWeight: '600' }}>保存済み</span>}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {/* プロフィール */}
          {tab === 'profile' && (
            <>
            {(() => {
              const map: Record<string, { label: string, sub: string, color: string, bg: string, border: string }> = {
                unsubmitted: { label: '未公開', sub: '「公開を申請する」を押すと、運営の承認後にあなたのページが公開されます。', color: '#64748B', bg: '#F8FAFC', border: '#E2E8F0' },
                pending: { label: '審査中', sub: '公開を申請しました。運営の承認をお待ちください。', color: '#92400E', bg: '#FEF3C7', border: '#FCD34D' },
                approved: { label: '公開中', sub: 'あなたのページは一般公開されています。', color: '#16A34A', bg: '#ECFDF5', border: '#86EFAC' },
                rejected: { label: '非承認', sub: '今回は公開が見送られました。内容を見直して再申請できます。', color: '#DC2626', bg: '#FEE2E2', border: '#FCA5A5' },
              }
              const st = map[approvalStatus] || map.unsubmitted
              return (
                <div style={{ gridColumn: '1 / -1', background: st.bg, border: '1.5px solid ' + st.border, borderRadius: '12px', padding: '16px 18px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '200px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 900, color: st.color, background: '#fff', padding: '3px 10px', borderRadius: '999px', border: '1px solid ' + st.border }}>{st.label}</span>
                      <span style={{ fontSize: '14px', fontWeight: 700, color: '#1a1a1a' }}>掲載ステータス</span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748B', marginTop: '6px' }}>{st.sub}</div>
                  </div>
                  {(approvalStatus === 'unsubmitted' || approvalStatus === 'rejected') && (
                    <button onClick={requestPublish} disabled={publishSaving} style={{ background: publishSaving ? '#ccc' : '#F5A623', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 20px', fontSize: '13px', fontWeight: 700, cursor: publishSaving ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>{publishSaving ? '送信中...' : (approvalStatus === 'rejected' ? '再申請する' : '公開を申請する')}</button>
                  )}
                </div>
              )
            })()}
            <div className='admin-two-col' style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '20px' }}>
                <div style={{ fontWeight: '700', fontSize: '14px', marginBottom: '16px' }}>基本情報</div>
                {!profileEdit ? (
                  <>
                    {[
                      { label: '氏名', value: profile.name || '未設定' },
                      { label: '店舗名', value: profile.shop_name || '未設定' },
                      { label: 'メール', value: profile.email || '未設定' },
                      { label: '電話番号', value: profile.phone || '未設定' },
                      { label: 'ジャンル', value: parseGenres(profile.genre).join('・') || '未設定' },
                      { label: '活動エリア', value: profile.areas.length > 0 ? profile.areas.join('・') : '未設定' },
                    ].map(fld => (
                      <div key={fld.label} style={{ display: 'flex', padding: '10px 0', borderBottom: '1px solid #F1F5F9' }}>
                        <div style={{ width: '100px', fontSize: '12px', color: '#64748B', flexShrink: 0 }}>{fld.label}</div>
                        <div style={{ fontSize: '13px', fontWeight: '500', color: fld.value === '未設定' ? '#94A3B8' : '#1a1a1a' }}>{fld.value}</div>
                      </div>
                    ))}
                    {photos.length > 0 && (
                      <div style={{ padding: '10px 0', borderBottom: '1px solid #F1F5F9' }}>
                        <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '8px' }}>店舗・商品写真</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
                          {photos.map((url, i) => (
                            <div key={i} style={{ position: 'relative', paddingTop: '100%', borderRadius: '6px', overflow: 'hidden', border: '1px solid #E2E8F0' }}>
                              <img src={url} alt={'p' + i} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {profile.bio && (
                      <div style={{ padding: '10px 0', borderBottom: '1px solid #F1F5F9' }}>
                        <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '4px' }}>紹介文・特徴</div>
                        <div style={{ fontSize: '13px', color: '#1a1a1a', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{profile.bio}</div>
                      </div>
                    )}
                    {[
                      { label: '販売形態', value: profile.sales_type },
                      { label: '車種', value: profile.vehicle_type },
                      { label: 'サイズ', value: [profile.size_length, profile.size_width, profile.size_height].filter(Boolean).join(' × ') },
                      { label: '設備', value: profile.equipment },
                    ].filter(f => f.value).map(fld => (
                      <div key={fld.label} style={{ display: 'flex', padding: '10px 0', borderBottom: '1px solid #F1F5F9' }}>
                        <div style={{ width: '100px', fontSize: '12px', color: '#64748B', flexShrink: 0 }}>{fld.label}</div>
                        <div style={{ fontSize: '13px', fontWeight: '500', color: '#1a1a1a' }}>{fld.value}</div>
                      </div>
                    ))}
                    {profile.menu && (
                      <div style={{ padding: '10px 0', borderBottom: '1px solid #F1F5F9' }}>
                        <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '4px' }}>メニュー</div>
                        <div style={{ fontSize: '13px', color: '#1a1a1a', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{profile.menu}</div>
                      </div>
                    )}
                    <button onClick={startProfileEdit} style={{ marginTop: '16px', width: '100%', background: '#F5A623', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>編集する</button>
                  </>
                ) : (
                  <>
                    {[
                      { label: '氏名', key: 'name', ph: '例：山田 花子' },
                      { label: '店舗名', key: 'shop_name', ph: "例：Hana's Sweets" },
                      { label: 'メール', key: 'email', ph: '例：hanako@example.com' },
                      { label: '電話番号', key: 'phone', ph: '例：090-1234-5678' },
                    ].map(fld => (
                      <div key={fld.key} style={{ marginBottom: '12px' }}>
                        <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '4px' }}>{fld.label}</div>
                        <input value={(profileForm as any)[fld.key]} onChange={e => setProfileForm({ ...profileForm, [fld.key]: e.target.value })} placeholder={fld.ph} style={{ width: '100%', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '8px 10px', fontSize: '13px', color: '#1a1a1a', boxSizing: 'border-box' }} />
                      </div>
                    ))}
                    {/* 店舗・商品写真（最大8枚） */}
                    <div style={{ marginBottom: '16px' }}>
                      <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '6px' }}>店舗・商品写真（最大8枚）</div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                        {photos.map((url, i) => (
                          <div key={i} style={{ position: 'relative', paddingTop: '100%', borderRadius: '8px', overflow: 'hidden', border: '1px solid #E2E8F0' }}>
                            <img src={url} alt={'photo' + i} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                            <button onClick={() => removePhoto(url)} style={{ position: 'absolute', top: '4px', right: '4px', width: '22px', height: '22px', borderRadius: '11px', border: 'none', background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: '14px', lineHeight: '1', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                          </div>
                        ))}
                        {photos.length < 8 && (
                          <label style={{ paddingTop: '100%', position: 'relative', borderRadius: '8px', border: '1.5px dashed #CBD5E1', cursor: photoUploading ? 'wait' : 'pointer', background: '#F8FAFC' }}>
                            <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: '11px' }}>
                              <span style={{ fontSize: '20px' }}>{photoUploading ? '…' : '＋'}</span>
                              <span>{photoUploading ? '追加中' : '写真追加'}</span>
                            </div>
                            <input type='file' accept='image/*' style={{ display: 'none' }} disabled={photoUploading} onChange={e => { const file = e.target.files?.[0]; if (file) uploadPhoto(file); e.target.value = '' }} />
                          </label>
                        )}
                      </div>
                      <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '6px' }}>1枚目が一覧やトップに表示されます。写真は追加・削除した時点で自動保存されます。</div>
                    </div>

                    {/* 提供メニュー */}
                    <div style={{ marginBottom: '16px', paddingTop: '16px', borderTop: '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: '#1a1a1a', marginBottom: '8px' }}>提供メニュー</div>

                      {/* 登録済みメニュー一覧 */}
                      {menus.length > 0 && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', marginBottom: '12px' }}>
                          {menus.map((m) => (
                            <div key={m.id} style={{ border: '1px solid #E2E8F0', borderRadius: '10px', overflow: 'hidden', position: 'relative', background: '#fff' }}>
                              {m.photo_url ? (
                                <div style={{ width: '100%', paddingTop: '66%', position: 'relative' }}>
                                  <img src={m.photo_url} alt={m.name} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                                </div>
                              ) : (
                                <div style={{ width: '100%', paddingTop: '66%', position: 'relative', background: '#F1F5F9' }}>
                                  <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: '#94A3B8' }}>写真なし</div>
                                </div>
                              )}
                              <button onClick={() => deleteMenu(m)} style={{ position: 'absolute', top: '6px', right: '6px', width: '22px', height: '22px', borderRadius: '11px', border: 'none', background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: '14px', lineHeight: '1', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                              <div style={{ padding: '8px 10px' }}>
                                <div style={{ fontSize: '13px', fontWeight: 700, color: '#1a1a1a' }}>{m.name}</div>
                                <div style={{ fontSize: '13px', color: '#F5A623', fontWeight: 700, marginTop: '2px' }}>{m.price != null ? m.price.toLocaleString() + '円' : '価格応相談'}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* メニュー追加フォーム */}
                      <div style={{ border: '1px dashed #CBD5E1', borderRadius: '10px', padding: '12px', background: '#F8FAFC' }}>
                        <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                          {/* 写真 */}
                          {menuPhotoUrl ? (
                            <div style={{ width: '64px', height: '64px', borderRadius: '8px', overflow: 'hidden', position: 'relative', flexShrink: 0, border: '1px solid #E2E8F0' }}>
                              <img src={menuPhotoUrl} alt='menu' style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              <button onClick={() => setMenuPhotoUrl('')} style={{ position: 'absolute', top: '2px', right: '2px', width: '18px', height: '18px', borderRadius: '9px', border: 'none', background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: '12px', lineHeight: '1', cursor: 'pointer' }}>×</button>
                            </div>
                          ) : (
                            <label style={{ width: '64px', height: '64px', borderRadius: '8px', border: '1.5px dashed #CBD5E1', cursor: menuPhotoUploading ? 'wait' : 'pointer', background: '#fff', flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: '10px' }}>
                              <span style={{ fontSize: '18px' }}>{menuPhotoUploading ? '…' : '＋'}</span>
                              <span>{menuPhotoUploading ? '' : '写真'}</span>
                              <input type='file' accept='image/*' style={{ display: 'none' }} disabled={menuPhotoUploading} onChange={e => { const file = e.target.files?.[0]; if (file) uploadMenuPhoto(file); e.target.value = '' }} />
                            </label>
                          )}
                          {/* 名前・価格 */}
                          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <input value={menuName} onChange={e => setMenuName(e.target.value)} placeholder='メニュー名（例：ダックステーキ）' style={{ width: '100%', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '8px 10px', fontSize: '13px', color: '#1a1a1a', boxSizing: 'border-box' }} />
                            <input value={menuPrice} onChange={e => setMenuPrice(e.target.value)} placeholder='価格（例：1000）※数字のみ' inputMode='numeric' style={{ width: '100%', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '8px 10px', fontSize: '13px', color: '#1a1a1a', boxSizing: 'border-box' }} />
                          </div>
                        </div>
                        <button onClick={addMenu} disabled={menuSaving} style={{ width: '100%', background: menuSaving ? '#ccc' : '#F5A623', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px', fontSize: '13px', fontWeight: 700, cursor: menuSaving ? 'not-allowed' : 'pointer' }}>{menuSaving ? '追加中...' : '＋ メニューを追加'}</button>
                      </div>
                      <div style={{ fontSize: '10px', color: '#94A3B8', marginTop: '6px' }}>追加したメニューは出店者紹介ページに表示されます。</div>
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '4px' }}>紹介文・特徴</div>
                      <textarea value={profileForm.bio} onChange={e => setProfileForm({ ...profileForm, bio: e.target.value })} placeholder='お店や商品の魅力、こだわりなどを自由にご記入ください' rows={3} style={{ width: '100%', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '8px 10px', fontSize: '13px', color: '#1a1a1a', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '4px' }}>販売形態</div>
                        <select value={profileForm.sales_type} onChange={e => setProfileForm({ ...profileForm, sales_type: e.target.value })} style={{ width: '100%', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '8px 10px', fontSize: '13px', color: '#1a1a1a', boxSizing: 'border-box', background: '#fff' }}>
                          <option value=''>選択してください</option>
                          {/* 選択肢に無い既存の値は消えないように先頭に残す */}
                          {profileForm.sales_type && !SELLER_SALES_TYPES.includes(profileForm.sales_type) && <option value={profileForm.sales_type}>{profileForm.sales_type}</option>}
                          {SELLER_SALES_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '4px' }}>車種</div>
                        <input value={profileForm.vehicle_type} onChange={e => setProfileForm({ ...profileForm, vehicle_type: e.target.value })} placeholder='例：軽トラック' style={{ width: '100%', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '8px 10px', fontSize: '13px', color: '#1a1a1a', boxSizing: 'border-box' }} />
                      </div>
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '4px' }}>サイズ（全長・全幅・高さ）</div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <input value={profileForm.size_length} onChange={e => setProfileForm({ ...profileForm, size_length: e.target.value })} placeholder='全長' style={{ flex: 1, border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '8px 10px', fontSize: '13px', color: '#1a1a1a', boxSizing: 'border-box' }} />
                        <input value={profileForm.size_width} onChange={e => setProfileForm({ ...profileForm, size_width: e.target.value })} placeholder='全幅' style={{ flex: 1, border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '8px 10px', fontSize: '13px', color: '#1a1a1a', boxSizing: 'border-box' }} />
                        <input value={profileForm.size_height} onChange={e => setProfileForm({ ...profileForm, size_height: e.target.value })} placeholder='高さ' style={{ flex: 1, border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '8px 10px', fontSize: '13px', color: '#1a1a1a', boxSizing: 'border-box' }} />
                      </div>
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '4px' }}>設備</div>
                      <input value={profileForm.equipment} onChange={e => setProfileForm({ ...profileForm, equipment: e.target.value })} placeholder='例：給排水タンク、発電機、冷蔵庫' style={{ width: '100%', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '8px 10px', fontSize: '13px', color: '#1a1a1a', boxSizing: 'border-box' }} />
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '4px' }}>メニュー</div>
                      <textarea value={profileForm.menu} onChange={e => setProfileForm({ ...profileForm, menu: e.target.value })} placeholder='例：まぜそば 850円 / 台湾まぜそば 950円' rows={2} style={{ width: '100%', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '8px 10px', fontSize: '13px', color: '#1a1a1a', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '6px' }}>ジャンル（複数選択できます）</div>
                      {(() => {
                        const selected = parseGenres(profileForm.genre)
                        const toggle = (v: string) => {
                          const next = selected.includes(v) ? selected.filter(x => x !== v) : [...selected, v]
                          // 既存データと同じ形式（JSON文字列）で保存する
                          setProfileForm({ ...profileForm, genre: next.length ? JSON.stringify(next) : '' })
                        }
                        return (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {SELLER_GENRES.map(g => {
                              const on = selected.includes(g.value)
                              return (
                                <label key={g.value} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', border: on ? '1.5px solid #F5A623' : '1.5px solid #E2E8F0', background: on ? '#FFF8EC' : '#fff', borderRadius: '999px', padding: '6px 12px', fontSize: '12px', color: '#1a1a1a', cursor: 'pointer' }}>
                                  <input type='checkbox' checked={on} onChange={() => toggle(g.value)} style={{ accentColor: '#F5A623', cursor: 'pointer' }} />
                                  {g.label}
                                </label>
                              )
                            })}
                          </div>
                        )
                      })()}
                    </div>
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
                <div style={{ fontWeight: '700', fontSize: '14px', marginBottom: '16px' }}>SNS・メディア</div>
                {!profileEdit ? (
                  ([
                    { label: 'Instagram', value: snsLinks.instagram },
                    { label: 'X（Twitter）', value: snsLinks.twitter },
                    { label: 'YouTube', value: snsLinks.youtube },
                    { label: 'TikTok', value: snsLinks.tiktok },
                  ]).map(s => (
                    <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: '1px solid #F1F5F9' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '11px', color: '#64748B' }}>{s.label}</div>
                        <div style={{ fontSize: '13px', fontWeight: '500', color: !s.value ? '#94A3B8' : '#1D4ED8' }}>{s.value || '未設定'}</div>
                      </div>
                    </div>
                  ))
                ) : (
                  ([
                    { label: 'Instagram', key: 'instagram', ph: '例：@hana_sweets' },
                    { label: 'X（Twitter）', key: 'twitter', ph: '例：@hana_sweets_jp' },
                    { label: 'YouTube', key: 'youtube', ph: 'チャンネル名やURL' },
                    { label: 'TikTok', key: 'tiktok', ph: '例：@hana_sweets' },
                  ]).map(s => (
                    <div key={s.key} style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '4px' }}>{s.label}</div>
                      <input value={(snsForm as any)[s.key]} onChange={e => setSnsForm({ ...snsForm, [s.key]: e.target.value })} placeholder={s.ph} style={{ width: '100%', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '8px 10px', fontSize: '13px', color: '#1a1a1a', boxSizing: 'border-box' }} />
                    </div>
                  ))
                )}
              </div>
            </div>
            </>
          )}

          {/* 売上報告 */}
          {tab === 'sales' && (
            <>
              <div style={{ background: '#FFF8E1', border: '1px solid #FFE082', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: '#B45309', display: 'flex', gap: '8px' }}>
                <span>承認された案件ごとに売上を入力すると、出店料（出店コネクトナビへのお支払い額）とあなたの利益（手取り）が自動計算されます。<br /><strong>出店料の請求は税別となります。</strong>ご請求時に消費税10%を加算した金額をご請求します。</span>
              </div>

              <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '20px', marginBottom: '16px' }}>
                <div style={{ fontWeight: '700', fontSize: '14px', marginBottom: '16px' }}>売上を入力</div>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div className='sale-field' style={{ flex: '1 1 200px' }}>
                    <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '6px' }}>案件</div>
                    <select value={saleAppId} onChange={e => setSaleAppId(e.target.value)} style={{ width: '100%', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', color: '#1a1a1a', background: '#fff' }}>
                      <option value=''>選択してください</option>
                      {myApprovedApps.map(a => { const notYet = !!a.apply_date && todayStr() < a.apply_date; return (<option key={a.application_id} value={a.application_id} disabled={notYet}>{a.placeTitle}{a.apply_date ? '（出店日 ' + a.apply_date.slice(5).replace('-', '/') + '）' : ''}{notYet ? ' ※出店後に入力できます' : ''}</option>) })}
                    </select>
                  </div>
                  <div className='sale-field' style={{ flex: '0 1 160px' }}>
                    <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '6px' }}>売上日</div>
                    <input type='date' value={saleDate} onChange={e => setSaleDate(e.target.value)} min={myApprovedApps.find(x => x.application_id === saleAppId)?.apply_date || undefined} max={todayStr()} style={{ width: '100%', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', color: '#1a1a1a' }} />
                  </div>
                  {saleSplit ? (
                    <>
                      <div className='sale-field' style={{ flex: '0 1 170px' }}>
                        <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '6px' }}>売上（8%対象・円）</div>
                        <input type='number' value={saleRev8} onChange={e => setSaleRev8(e.target.value)} placeholder='40000' style={{ width: '100%', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', color: '#1a1a1a' }} />
                      </div>
                      <div className='sale-field' style={{ flex: '0 1 170px' }}>
                        <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '6px' }}>売上（10%対象・円）</div>
                        <input type='number' value={saleRev10} onChange={e => setSaleRev10(e.target.value)} placeholder='10000' style={{ width: '100%', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', color: '#1a1a1a' }} />
                      </div>
                    </>
                  ) : (
                    <div className='sale-field' style={{ flex: '0 1 140px' }}>
                      <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '6px' }}>売上金額（円）</div>
                      <input type='number' value={saleRevenue} onChange={e => setSaleRevenue(e.target.value)} placeholder='50000' style={{ width: '100%', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', color: '#1a1a1a' }} />
                    </div>
                  )}
                  <div className='sale-field' style={{ flex: '1 1 230px', display: saleSplit ? 'none' : undefined }}>
                    <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '6px' }}>消費税の扱い（通常は変更不要）</div>
                    <select value={saleTaxOv} onChange={e => setSaleTaxOv(e.target.value)} style={{ width: '100%', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', color: '#1a1a1a', background: '#fff' }}>
                      <option value=''>案件の設定どおりに計算する（推奨）</option>
                      <option value='as_entered'>入力した金額をそのまま使う</option>
                    </select>
                  </div>
                  <button onClick={saveMySale} disabled={saleSaving} style={{ background: saleSaving ? '#ccc' : '#F5A623', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 20px', fontSize: '13px', fontWeight: '700', cursor: saleSaving ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>{saleSaving ? '保存中...' : '記録する'}</button>
                </div>
                <label style={{ marginTop: '12px', display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#1a1a1a', cursor: 'pointer' }}>
                  <input type='checkbox' checked={saleSplit} onChange={e => setSaleSplit(e.target.checked)} style={{ accentColor: '#F5A623', cursor: 'pointer' }} />
                  税率ごとに分けて入力する（任意）
                </label>
                <div style={{ marginTop: '8px', fontSize: '11px', color: '#94A3B8', lineHeight: 1.7 }}>
                  {saleSplit
                    ? 'ご自身の商品の税率で分けて入力してください。軽減税率8%の商品（フードやドリンクの持ち帰りなど）と、10%の商品（お酒・物販・その場でのご飲食など）の内訳を記録できます。出店料は合計額から計算するため、分けても金額は変わりません。'
                    : '売上金額は、レジの合計（お客様からお預かりした金額）をそのまま入力してください。通常はこのままで問題ありません。ご自身の商品の税率で分けて計算したい場合のみ、上のチェックをご利用ください。'}
                </div>
                {saleAppId && (() => {
                  const a = myApprovedApps.find(x => x.application_id === saleAppId); if (!a) return null
                  const r8 = parseInt(saleRev8 || '0', 10) || 0
                  const r10 = parseInt(saleRev10 || '0', 10) || 0
                  const rev = saleSplit ? r8 + r10 : (parseInt(saleRevenue || '0', 10) || 0)
                  const fee = calcFee(rev, a, saleTaxOv).total
                  // 出店料が何を元に計算されたかを明示する（計算自体は calcFee に任せる）
                  const { basis, rate } = taxOf(a, saleTaxOv)
                  const exTax = basis === 'tax_excluded'
                  const base = exTax ? Math.floor(rev / (1 + rate / 100)) : rev
                  return (
                    <div style={{ marginTop: '12px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '12px 14px', fontSize: '12px', color: '#475569', lineHeight: 1.9 }}>
                      {saleSplit ? (
                        <>
                          <div>8%対象：<strong>{r8.toLocaleString()}円</strong></div>
                          <div>10%対象：<strong>{r10.toLocaleString()}円</strong></div>
                          <div>売上の合計：<strong>{rev.toLocaleString()}円</strong></div>
                          <div>出店料の計算元：<strong>{base.toLocaleString()}円</strong>{exTax ? '（消費税' + rate + '%分を差し引いた税抜金額）' : '（売上の合計をそのまま使用）'}</div>
                        </>
                      ) : (
                        <>
                          <div>入力した売上：<strong>{rev.toLocaleString()}円</strong></div>
                          {exTax && <div>出店料の計算元：<strong>{base.toLocaleString()}円</strong>（税込{rev.toLocaleString()}円から消費税{rate}%分を差し引いた税抜金額）</div>}
                          {!exTax && <div>出店料の計算元：<strong>{base.toLocaleString()}円</strong>（入力した金額をそのまま使用）</div>}
                        </>
                      )}
                      <div>出店料（税別）：<strong>{fee.toLocaleString()}円</strong></div>
                      <div>消費税（10%）：<strong>{Math.floor(fee * 0.1).toLocaleString()}円</strong></div>
                      <div>ご請求額（税込）：<strong>{(fee + Math.floor(fee * 0.1)).toLocaleString()}円</strong></div>
                      <div style={{ borderTop: '1px solid #E2E8F0', marginTop: '6px', paddingTop: '6px' }}>あなたの利益（手取り）：<strong style={{ color: '#16A34A', fontSize: '14px' }}>{(rev - fee).toLocaleString()}円</strong></div>
                    </div>
                  )
                })()}
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
                    <div key={card.label} style={{ background: '#fff', borderRadius: '12px', padding: '16px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '8px', minHeight: '32px' }}>{card.label}</div>
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

        <DashboardFooter />
      </div>
    </div>
  )
}
