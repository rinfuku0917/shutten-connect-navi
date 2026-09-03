'use client'
import { useState, useEffect } from 'react'
import ConfirmDialog from '../../components/ConfirmDialog'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'
import { useRouter } from 'next/navigation'
import DashboardFooter from '../../components/DashboardFooter'
import { formatVehicleSize, toMm } from '../../lib/vehicleSize'
import { perDayFee, dayTypeFee } from '../../lib/placeFee'
import OnsiteSteps from './OnsiteSteps'
import SiteSubmissionForm from './SiteSubmissionForm'

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
  type TabKey = 'home'|'applies'|'calendar'|'messages'|'docs'|'profile'|'sales'|'payments'
  const validTabs: TabKey[] = ['home','applies','calendar','messages','docs','profile','sales','payments']
  const [tab, setTab] = useState<TabKey>(() => { if (typeof window === 'undefined') return 'home'; const t = new URLSearchParams(window.location.search).get('tab'); return (t && validTabs.includes(t as TabKey)) ? (t as TabKey) : 'home' })
  const [chatOpen, setChatOpen] = useState<string|null>(null)
  const [msg, setMsg] = useState('')
  const [dbMessages, setDbMessages] = useState<DbMessage[]>([])
  const [myId, setMyId] = useState<string|null>(null)
  const [appId, setAppId] = useState<string|null>(null)
  type MsgThread = { application_id: string, placeTitle: string, lastBody: string, unread: number }
  const [threads, setThreads] = useState<MsgThread[]>([])
  const [unread, setUnread] = useState(0)
  type MyApply = { id: string, placeId: string, place: string, date: string, rawDate: string | null, reminderDays: number, type: string, status: string, statusColor: string, statusBg: string }
  const [myApplies, setMyApplies] = useState<MyApply[]>([])
  const [appliesError, setAppliesError] = useState('')
  // 現場ごとの出店者情報。入力を済ませた案件のIDと、開いているフォーム
  const [subDone, setSubDone] = useState<Set<string>>(new Set())
  const [subForm, setSubForm] = useState<{ placeId: string, placeTitle: string } | null>(null)
  const [myUid, setMyUid] = useState('')
  // この画面を見ているアカウントの種別（seller / host / admin / none）
  const [viewerRole, setViewerRole] = useState<string>('')
  const [viewerName, setViewerName] = useState('')
  const [msgError, setMsgError] = useState('')
  // カレンダーの表示月。今月を初期値にし、‹ › で前後の月に移動できる
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() } })
  // カレンダーで選んだ日。その日の申込内容を下に表示する
  const [calPicked, setCalPicked] = useState<string | null>(null)
  type DocRow = { id: string, doc_type: string, file_url: string, status: string, expiry_date: string | null }
  const [myDocs, setMyDocs] = useState<DocRow[]>([])
  const [uploadingType, setUploadingType] = useState<string | null>(null)

  // ===== プロフィール（出店者） =====
  // 保存用。読み取れた数字だけ mm にそろえ、空欄はそのまま空で残す。
  const mmOrEmpty = (raw: string) => { const n = toMm(raw); return n == null ? '' : String(n) }

  type ProfileData = { name: string, shop_name: string, email: string, phone: string, genre: string, address: string, areas: string[], bio: string, sales_type: string, vehicle_type: string, size_length: string, size_width: string, size_height: string, equipment: string, menu: string, takeout_bag: string, payment_methods: string[] }
  type SnsLinks = { instagram: string, twitter: string, youtube: string, tiktok: string }
  const emptyProfile: ProfileData = { name: '', shop_name: '', email: '', phone: '', genre: '', address: '', areas: [], bio: '', sales_type: '', vehicle_type: '', size_length: '', size_width: '', size_height: '', equipment: '', menu: '', takeout_bag: '', payment_methods: [] }
  // 施設へ提出する「利用可能決済」の選択肢
  const PAY_OPTIONS = ['現金', 'クレジットカード', 'PayPay', 'QRコード決済', '電子マネー']
  // 選択肢に無い決済の自由記述。入力中に区切り文字が消えてしまわないよう、
  // 文字列のまま持っておき、保存するときに配列へ直す。
  const [payOther, setPayOther] = useState('')
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
  type MenuItem = { id: string, name: string, price: number | null, detail: string | null, photo_url: string | null, sort_order: number }
  const [menus, setMenus] = useState<MenuItem[]>([])
  const [menuName, setMenuName] = useState("")
  const [menuDetail, setMenuDetail] = useState("")
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
      .select('name, shop_name, email, phone, genre, address, areas, bio, sales_type, vehicle_type, size_length, size_width, size_height, equipment, menu, takeout_bag, payment_methods, photos, approval_status, role')
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
        takeout_bag: p.takeout_bag || '',
        payment_methods: Array.isArray(p.payment_methods) ? p.payment_methods : [],
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
      .select('id, name, price, detail, photo_url, sort_order')
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
    setPayOther(profile.payment_methods.filter(x => !PAY_OPTIONS.includes(x)).join('・'))
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
      detail: menuDetail.trim() || null,
      price: priceNum,
      photo_url: menuPhotoUrl || null,
      sort_order: nextOrder,
    })
    if (error) { alert('メニューの追加に失敗: ' + error.message); setMenuSaving(false); return }
    setMenuName(''); setMenuDetail(''); setMenuPrice(''); setMenuPhotoUrl('')
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
      // 車両サイズは mm の数字にそろえて保存する（表示・書き出しで同じ形になるように）
      size_length: mmOrEmpty(profileForm.size_length),
      size_width: mmOrEmpty(profileForm.size_width),
      size_height: mmOrEmpty(profileForm.size_height),
      equipment: profileForm.equipment, menu: profileForm.menu, photos,
      // 「有料」を選んで金額が空のままなら「有料」とだけ保存する
      takeout_bag: profileForm.takeout_bag === '有料：円' ? '有料' : profileForm.takeout_bag,
      // チェックした決済 ＋ 自由記述（「・」「、」区切り）。重複は取り除く
      payment_methods: Array.from(new Set([
        ...profileForm.payment_methods.filter(x => PAY_OPTIONS.includes(x)),
        ...payOther.split(/[・、,]/).map(x => x.trim()).filter(Boolean),
      ])),
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
  type SellerApp = { application_id: string, place_id: string, placeTitle: string, price_fixed: number, price_share_pct: number, place_fixed_unit: string, company_fixed_amount: number, company_fixed_unit: string, company_share_pct: number, share_tax_basis: string, share_tax_rate: number, apply_date: string, schedule: unknown, day_type_fees: unknown }
  type SaleItem = { name: string, qty: string, price: string }
  type SellerSale = { id: string, application_id: string | null, sale_date: string, placeTitle: string, revenue: number, fee: number, items: { name: string, qty: number, price: number | null }[], weather: string, customers: number | null, note: string }

  // ===== 出店報告フォーム =====
  // 出店が終わったら、企業へ提出できる形で報告してもらう専用の入力画面。
  // 売上だけの入力と違い、品目ごとの食数・天候・所感まで順に埋められる。
  type ReportTarget = { application_id: string, placeTitle: string, apply_date: string }
  const WEATHERS = ['晴れ', 'くもり', '雨', '雪']
  const [reportFor, setReportFor] = useState<ReportTarget | null>(null)
  const [rpRevenue, setRpRevenue] = useState('')
  const [rpItems, setRpItems] = useState<SaleItem[]>([])
  const [rpWeather, setRpWeather] = useState('')
  const [rpCustomers, setRpCustomers] = useState('')
  const [rpNote, setRpNote] = useState('')
  const [rpSaving, setRpSaving] = useState(false)

  // 報告フォームを開く。品目は登録済みメニューを並べて、食数を入れるだけにする。
  const openReport = (t: ReportTarget) => {
    setReportFor(t)
    setRpRevenue(''); setRpWeather(''); setRpCustomers(''); setRpNote('')
    setRpItems(menus.map(m => ({ name: m.name, qty: '', price: m.price != null ? String(m.price) : '' })))
  }

  // 報告を保存する（売上の記録として保存される）
  const saveReport = async () => {
    if (!reportFor || rpSaving) return
    // 送信中は最初から押せないようにする。案件の読み直しにも時間がかかるため、
    // ここで先に閉じておかないと連打で二重に登録されてしまう。
    setRpSaving(true)
    const revenue = parseInt(rpRevenue.replace(/[^0-9]/g, ''), 10)
    if (isNaN(revenue) || revenue < 0) { setRpSaving(false); alert('売上金額を入力してください'); return }
    // ホームなど売上タブ以外から開いた場合は案件一覧をまだ読んでいないので、
    // 見つからなければここで読み直してから探す
    let app = myApprovedApps.find(x => x.application_id === reportFor.application_id)
    if (!app) {
      const fresh = await loadMyApprovedApps()
      app = fresh.find(x => x.application_id === reportFor.application_id)
    }
    if (!app) { setRpSaving(false); alert('案件が見つかりません。画面を再読み込みしてお試しください。'); return }
    const items = rpItems
      .map(it => ({ name: it.name.trim(), qty: parseInt(it.qty, 10) || 0, price: it.price.trim() === '' ? null : (parseInt(it.price.replace(/[^0-9]/g, ''), 10) || 0) }))
      .filter(it => it.name && it.qty > 0)
    const { data: userData } = await supabase.auth.getUser()
    const uid = userData.user?.id
    // 同じ出店を二重に報告すると請求が二重になるため、保存の直前に確かめる。
    // 確認そのものに失敗したときは、登録せずに中断する。
    const { data: dup, error: dupErr } = await supabase
      .from('sales').select('id').eq('application_id', app.application_id).limit(1)
    if (dupErr) {
      setRpSaving(false)
      alert('通信に失敗しました。時間をおいてもう一度お試しください。')
      return
    }
    if (dup && dup.length > 0) {
      setRpSaving(false)
      alert('この出店はすでに報告済みです。内容を直す場合は、売上報告の一覧から一度削除したうえで、あらためてご報告ください。')
      setReportFor(null)
      await loadMySales(); await loadUnreported(); await loadCalSales()
      return
    }
    const { placeFee, companyFee, total } = calcFee(revenue, app, '', null, reportFor.apply_date)
    const applied = taxOf(app, '')
    const row: Record<string, unknown> = {
      application_id: app.application_id, place_id: app.place_id, seller_id: uid,
      sale_date: reportFor.apply_date, revenue,
      fee: companyFee, place_fee: placeFee, company_fee: companyFee, total_pay: total,
      tax_basis: applied.basis, tax_rate: applied.rate,
    }
    if (items.length > 0) row.items = items
    if (rpWeather) row.weather = rpWeather
    const cust = parseInt(rpCustomers, 10)
    if (!isNaN(cust) && cust > 0) row.customers = cust
    if (rpNote.trim()) row.note = rpNote.trim()
    const { error } = await supabase.from('sales').insert(row)
    setRpSaving(false)
    if (error) { alert('報告の保存に失敗しました: ' + error.message); return }
    setReportFor(null)
    await loadMySales()
    await loadUnreported()
    await loadCalSales()
    alert('出店報告を送信しました。ありがとうございました。')
  }
  // 品目別の内訳（任意）。施設から「何が何食売れたか」を求められることがある
  const [saleItems, setSaleItems] = useState<SaleItem[]>([])
  // 売上報告がまだの承認済み申込（リマインド表示用）
  const [unreported, setUnreported] = useState<{ application_id: string, placeTitle: string, apply_date: string }[]>([])

  // 出店日を過ぎたのに売上報告が無い申込を探す（直近30日）
  const loadUnreported = async () => {
    const { data: userData } = await supabase.auth.getUser()
    const uid = userData.user?.id
    if (!uid) return
    const today = todayStr()
    const from = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
    const { data: apps } = await supabase
      .from('applications')
      .select('id, apply_date, places(title)')
      .eq('seller_id', uid).eq('status', 'approved')
      .not('apply_date', 'is', null).gte('apply_date', from).lt('apply_date', today)
    if (!apps || apps.length === 0) { setUnreported([]); return }
    const { data: reported } = await supabase
      .from('sales').select('application_id').eq('seller_id', uid).in('application_id', apps.map(a => a.id))
    const done = new Set((reported || []).map(r => r.application_id))
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setUnreported((apps as any[])
      .filter(a => !done.has(a.id))
      .map(a => ({ application_id: a.id, placeTitle: a.places?.title || '(案件)', apply_date: a.apply_date }))
      .sort((a, b) => (a.apply_date < b.apply_date ? -1 : 1)))
  }
  const [myApprovedApps, setMyApprovedApps] = useState<SellerApp[]>([])
  const [mySales, setMySales] = useState<SellerSale[]>([])
  // カレンダーから参照する売上。売上タブの月しぼりとは別に持つ。
  const [calSales, setCalSales] = useState<SellerSale[]>([])

  // ===== 出店料のお支払い =====
  // 請求書は管理者しか触れないため、専用のAPIを通して自分の分だけ受け取る。
  type MyInvoice = {
    id: string, invoice_no: string, period: string, issued_on: string, due_on: string | null,
    total: number, paid_status: string, paid_on: string | null, paid_name: string | null,
    paid_reported_at: string | null, paid_confirmed_at: string | null,
  }
  const [myInvoices, setMyInvoices] = useState<MyInvoice[]>([])
  const [invLoading, setInvLoading] = useState(false)
  const [invError, setInvError] = useState('')
  const [payFor, setPayFor] = useState<MyInvoice | null>(null)
  const [payOn, setPayOn] = useState('')
  const [payName, setPayName] = useState('')
  const [paySaving, setPaySaving] = useState(false)
  // 未払い（入金確認がまだ）の件数。サイドバーの印に使う。
  const unpaidCount = myInvoices.filter(x => x.paid_status !== 'paid').length

  const callPayApi = async (payload: Record<string, unknown>) => {
    const { data: sess } = await supabase.auth.getSession()
    const res = await fetch('/api/invoice-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (sess.session?.access_token || '') },
      body: JSON.stringify(payload),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(j.error || '通信に失敗しました')
    return j
  }

  const loadMyInvoices = async () => {
    setInvLoading(true)
    try {
      const j = await callPayApi({ action: 'mine' })
      setMyInvoices(j.items || [])
      setInvError('')
    } catch (e) {
      // 取得できなかったことを「請求書なし」と見せると、
      // 支払いが済んでいると誤解されるため、はっきり伝える
      setInvError(e instanceof Error ? e.message : '読み込めませんでした')
    }
    setInvLoading(false)
  }

  // 「振り込みました」の報告を送る
  const sendPaymentReport = async () => {
    if (!payFor || paySaving) return
    setPaySaving(true)
    try {
      await callPayApi({ action: 'report', invoiceId: payFor.id, paidOn: payOn || null, paidName: payName })
      setPayFor(null); setPayOn(''); setPayName('')
      await loadMyInvoices()
      alert('お振込の報告を受け付けました。運営で確認のうえ、あらためてご連絡いたします。')
    } catch (e) {
      alert(e instanceof Error ? e.message : '送信に失敗しました')
    }
    setPaySaving(false)
  }

  // カレンダーに出す売上（直近1年分）を読み込む
  const loadCalSales = async () => {
    const { data: userData } = await supabase.auth.getUser()
    const uid = userData.user?.id
    if (!uid) return
    const from = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10)
    const { data } = await supabase
      .from('sales')
      .select('id, application_id, sale_date, revenue, fee, total_pay, items, weather, customers, note, places(title)')
      .eq('seller_id', uid).gte('sale_date', from)
      .order('sale_date', { ascending: false })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setCalSales((data || []).map((x: any) => ({
      id: x.id, application_id: x.application_id ?? null, sale_date: x.sale_date, revenue: x.revenue, fee: x.total_pay ?? x.fee,
      placeTitle: x.places?.title || '(案件名なし)',
      items: Array.isArray(x.items) ? x.items : [],
      weather: x.weather || '', customers: x.customers ?? null, note: x.note || '',
    })))
  }
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

  // date を渡すと、その日に金額が設定されていればそちらを使う
  const calcFee = (revenue: number, a: SellerApp, ov: string = '', baseOverride: number | null = null, date: string | null = null) => {
    const { basis, rate } = taxOf(a, ov)
    const base = baseOverride != null ? baseOverride : (basis === 'tax_excluded' ? Math.floor(revenue / (1 + rate / 100)) : revenue)
    // 金額の優先順位: 日程に入れたその日の額 → 平日/土日祝の額 → 案件全体の固定額
    const on = date || a.apply_date
    const day = perDayFee(a.schedule, on)
    const dt = dayTypeFee(a.day_type_fees, on)
    const placeFixed = day.placeFee != null ? day.placeFee
      : dt.placeFee != null ? dt.placeFee
      : (a.place_fixed_unit === 'per_event' ? 0 : (a.price_fixed || 0))
    const companyFixed = day.companyFee != null ? day.companyFee
      : dt.companyFee != null ? dt.companyFee
      : (a.company_fixed_unit === 'per_event' ? 0 : (a.company_fixed_amount || 0))
    const placeFee = Math.floor(placeFixed + base * (a.price_share_pct || 0) / 100)
    const companyFee = Math.floor(companyFixed + base * (a.company_share_pct || 0) / 100)
    return { placeFee, companyFee, total: placeFee + companyFee }
  }
  const todayStr = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') }

  // 自分の承認済み案件を読み込む
  const loadMyApprovedApps = async (): Promise<SellerApp[]> => {
    const { data: userData } = await supabase.auth.getUser()
    const uid = userData.user?.id
    if (!uid) return []
    const { data } = await supabase
      .from('applications')
      .select('id, place_id, apply_date, places(title, price_fixed, price_share_pct, place_fixed_unit, company_fixed_amount, company_fixed_unit, company_share_pct, share_tax_basis, share_tax_rate, schedule, day_type_fees)')
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
      schedule: a.places?.schedule ?? null,
      day_type_fees: a.places?.day_type_fees ?? null,
    }))
    setMyApprovedApps(mapped)
    return mapped
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
      .select('id, application_id, sale_date, revenue, fee, total_pay, items, weather, customers, note, places(title)')
      .eq('seller_id', uid).gte('sale_date', start).lt('sale_date', end)
      .order('sale_date', { ascending: false })
    const mapped: SellerSale[] = (data || []).map((s: any) => ({
      id: s.id, application_id: s.application_id ?? null, sale_date: s.sale_date, revenue: s.revenue, fee: s.total_pay ?? s.fee,
      placeTitle: s.places?.title || '(案件名なし)',
      items: Array.isArray(s.items) ? s.items : [],
      weather: s.weather || '', customers: s.customers ?? null, note: s.note || '',
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
    // すでに報告済みの出店をもう一度登録すると請求も2件分になるため、
    // 気付かず重ねてしまわないように確認する（意図的な追加登録は通す）
    const { data: dup, error: dupErr } = await supabase
      .from('sales').select('id, sale_date').eq('application_id', app.application_id)
    if (dupErr) { alert('通信に失敗しました。時間をおいてもう一度お試しください。'); return }
    if (dup && dup.length > 0) {
      const dates = dup.map(d => d.sale_date).join('、')
      if (!window.confirm('この出店はすでに報告済みです（' + dates + '）。\nもう1件追加で登録すると、出店料も2件分の請求になります。\n続けますか？')) return
    }
    setSaleSaving(true)
    const { placeFee, companyFee, total } = calcFee(revenue, app, saleTaxOv, null, saleDate)
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
    // 品目別の内訳（品目名と食数が入っている行だけ保存する）
    const items = saleItems
      .map(it => ({ name: it.name.trim(), qty: parseInt(it.qty, 10) || 0, price: it.price.trim() === '' ? null : (parseInt(it.price.replace(/[^0-9]/g, ''), 10) || 0) }))
      .filter(it => it.name && it.qty > 0)
    if (items.length > 0) row.items = items
    const { error } = await supabase.from('sales').insert(row)
    if (error) { alert('保存失敗: ' + error.message); setSaleSaving(false); return }
    setSaleAppId(''); setSaleDate(''); setSaleRevenue(''); setSaleRev8(''); setSaleRev10(''); setSaleItems([]); setSaleSaving(false)
    loadMySales()
    loadUnreported()
    loadCalSales()
  }

  const deleteMySale = async (id: string) => {
    const { error } = await supabase.from('sales').delete().eq('id', id)
    if (error) { alert('削除失敗: ' + error.message); return }
    loadMySales()
    // 消した分は「未報告」に戻るため、バナーも数え直す
    loadUnreported()
    loadCalSales()
  }

  // ログイン中ユーザーの申込一覧を読み込む
  const loadApplies = async () => {
    const { data: userData } = await supabase.auth.getUser()
    const uid = userData.user?.id
    if (!uid) return
    const { data, error } = await supabase
      .from('applications')
      .select('id, place_id, apply_date, format, status, places(title, reminder_days)')
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
        placeId: a.place_id || '',
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

  // 現場ごとの出店者情報を、どの案件で入力済みか読み込む
  const loadSubmissions = async () => {
    const { data: userData } = await supabase.auth.getUser()
    const uid = userData.user?.id
    if (!uid) return
    setMyUid(uid)
    const { data } = await supabase
      .from('application_submissions').select('place_id').eq('seller_id', uid)
    setSubDone(new Set((data ?? []).map((r: { place_id: string }) => r.place_id)))
  }

  // 申込の辞退。承認済み（出店決定後）はボタンを出さず、サーバー側でも拒否している。
  const [cancelingId, setCancelingId] = useState<string | null>(null)
  // 確認と失敗の知らせに window.confirm / alert を使っていたが、
  // スマホのアプリ内ブラウザではどちらも無視される。押しても何も
  // 起きず、辞退できたと思い込んでしまうため、画面内のダイアログにした。
  const [cancelAsk, setCancelAsk] = useState<{ id: string; label: string } | null>(null)
  const [cancelErr, setCancelErr] = useState<string | null>(null)

  const runCancelApplication = async () => {
    if (!cancelAsk) return
    const appId = cancelAsk.id
    setCancelingId(appId)
    setCancelErr(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) { setCancelErr('ログインの有効期限が切れています。一度ログインし直してください。'); return }
      const res = await fetch('/api/applications/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ applicationId: appId }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { setCancelErr(json.error || '辞退できませんでした（エラー ' + res.status + '）'); return }
      setCancelAsk(null)
      await loadApplies()
      loadMyApprovedApps()
      loadMySales()
    } catch {
      setCancelErr('通信に失敗しました。電波の良いところでもう一度お試しください。')
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
    if (tab === 'payments') loadMyInvoices()
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

  useEffect(() => { loadMessages(); loadApplies(); loadDocs(); loadProfile(); loadUnreported(); loadMyApprovedApps(); loadMyInvoices(); loadSubmissions() }, [])

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
    if (tab === 'applies') loadSubmissions()
    if (tab === 'calendar') { loadCalSales(); loadMyApprovedApps() }
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
    { key: 'payments', label: 'お支払い', badge: unpaidCount > 0 ? unpaidCount : undefined },
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
            {tab === 'payments' && '出店料のお支払い'}
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

          {/* 売上報告がまだの出店があれば、どのタブでも気付けるように出す */}
          {unreported.length > 0 && tab !== 'sales' && (
            <div style={{ background: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#DC2626', marginBottom: '6px' }}>売上報告がまだの出店があります</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {unreported.slice(0, 5).map(u => (
                  <div key={u.application_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '12px', color: '#7F1D1D' }}>{u.apply_date.slice(5).replace('-', '/')}　{u.placeTitle}</span>
                    <button onClick={() => openReport(u)}
                      style={{ background: '#DC2626', color: '#fff', border: 'none', borderRadius: '6px', padding: '5px 14px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>報告する</button>
                  </div>
                ))}
                {unreported.length > 5 && <div style={{ fontSize: '11px', color: '#991B1B' }}>ほか{unreported.length - 5}件</div>}
              </div>
            </div>
          )}

          {/* 未読メッセージのお知らせ。
              通知メールから来た方が、この画面（ホーム）に着いてしまっても
              「どこを見ればいいのか」で迷わないように、案件名と開くボタンを出す。
              左メニューの赤い数字だけでは気づかれず、
              「内容をお確かめの上ご連絡くださいとあるが、どこで確認するのか」
              というお問い合わせが実際に届いた。 */}
          {unread > 0 && tab !== 'messages' && (
            <div style={{ background: '#EFF6FF', border: '1.5px solid #BFDBFE', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#1D4ED8', marginBottom: '6px' }}>
                読んでいないメッセージが{unread}件あります
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {threads.filter(t => t.unread > 0).slice(0, 5).map(t => (
                  <div key={t.application_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '12px', color: '#1E3A8A' }}>{t.placeTitle}</span>
                    <button onClick={() => { setTab('messages'); openThread(t.application_id) }}
                      style={{ background: '#1D4ED8', color: '#fff', border: 'none', borderRadius: '6px', padding: '5px 14px', fontSize: '11px', fontWeight: 700, cursor: 'pointer', minHeight: '28px' }}>開く</button>
                  </div>
                ))}
                {threads.filter(t => t.unread > 0).length > 5 && (
                  <div style={{ fontSize: '11px', color: '#1E40AF' }}>ほか{threads.filter(t => t.unread > 0).length - 5}件</div>
                )}
              </div>
            </div>
          )}

          {/* ホーム */}
          {tab === 'home' && (
            <>
              {/* 今日と明日の出店だけを、進める順に並べて出す */}
              <OnsiteSteps supabase={supabase} onGoSales={() => setTab('sales')} />
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
              {/* 現場ごとの出店者情報。
                  提出用の資料は現場ごとに中身が変わるため、案件ごとに1回入力してもらう。
                  申込は日付ごとに1件あるので、ここは案件でまとめて並べる。 */}
              {(() => {
                const places = Array.from(
                  new Map(myApplies.filter(a => a.placeId).map(a => [a.placeId, a.place])).entries(),
                )
                if (places.length === 0) return null
                return (
                  <section aria-label='現場ごとの出店者情報' style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '16px 18px', marginBottom: '16px' }}>
                    <h2 style={{ fontSize: '14px', fontWeight: 800, margin: '0 0 4px' }}>現場ごとの出店者情報</h2>
                    <p style={{ fontSize: '12px', color: '#64748B', margin: '0 0 12px', lineHeight: 1.7 }}>
                      施設へ提出する資料に載る内容です。現場ごとに店舗名・ジャンル・メニュー・価格などを変えられます。未入力のときはプロフィールの内容が使われます。
                    </p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {places.map(([pid, title]) => {
                        const done = subDone.has(pid)
                        return (
                          <div key={pid} style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', padding: '10px 12px', borderRadius: '9px', background: '#F8FAFC', border: '1px solid #E2E8F0' }}>
                            <span style={{ fontSize: '13px', fontWeight: 700, flex: 1, minWidth: '160px' }}>{title}</span>
                            <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '20px', background: done ? '#ECFDF5' : '#FEF3C7', color: done ? '#15803D' : '#92400E' }}>
                              {done ? '入力済み' : '未入力'}
                            </span>
                            <button type='button' onClick={() => setSubForm({ placeId: pid, placeTitle: title })}
                              style={{ fontSize: '12px', fontWeight: 700, padding: '7px 14px', borderRadius: '8px', border: '1.5px solid #F5A623', background: '#FFF8E1', color: '#B45309', cursor: 'pointer', minHeight: '34px' }}>
                              {done ? '内容を見る・直す' : '入力する'}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </section>
                )
              })()}

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
                        {a.status === '審査中' && <button type='button' onClick={() => { setCancelErr(null); setCancelAsk({ id: a.id, label: `${a.place}／${a.date || '日程調整中'}` }) }} disabled={cancelingId === a.id} style={{ fontSize: '11px', padding: '4px 10px', border: '1px solid #FCA5A5', borderRadius: '6px', background: '#FEF2F2', color: '#DC2626', cursor: cancelingId === a.id ? 'not-allowed' : 'pointer', minHeight: '30px' }}>{cancelingId === a.id ? '取消中...' : '辞退'}</button>}
                        {/* 出店が決まったあとは、この画面からは取り消せない。募集者が準備を進めているため */}
                        {a.status === '承認済' && <span style={{ fontSize: '11px', color: '#64748B' }}>出店決定（辞退は運営へご連絡ください）</span>}
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#16A34A', fontWeight: 700 }}>¥ 売上を報告済み（日付をタップで内訳）</div>
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
                        {monthCount > 0 ? `この月の申込 ${monthCount}件（日付をクリックすると内容を確認できます）` : 'この月の申込はありません'}
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
                          // その日に報告済みの売上があれば、マスにも金額を出す
                          const dayRev = calSales.filter(x => x.sale_date === ds).reduce((t, x) => t + x.revenue, 0)
                          const hasSale = calSales.some(x => x.sale_date === ds)
                          const tappable = items.length > 0 || hasSale
                          return (
                            <div key={d} title={items.length ? items.map(a => `${a.status}：${a.place}`).join('\n') : undefined}
                              onClick={() => { if (tappable) setCalPicked(calPicked === ds ? null : ds) }}
                              style={{ minHeight: '60px', borderRadius: '8px', border: calPicked === ds ? '2px solid #1D4ED8' : (isToday ? '2px solid #F5A623' : `1px solid ${main ? main.statusColor : '#E2E8F0'}`), background: main ? main.statusBg : '#fff', padding: '5px', overflow: 'hidden', cursor: tappable ? 'pointer' : 'default' }}>
                              <div style={{ fontSize: '12px', fontWeight: isToday ? '800' : '600', color: dow === 0 ? '#DC2626' : dow === 6 ? '#1D4ED8' : '#333', marginBottom: '3px' }}>{d}</div>
                              {items.slice(0, 2).map(a => (
                                <div key={a.id} style={{ fontSize: '9px', fontWeight: '700', color: a.statusColor, lineHeight: 1.3, marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {a.status}<br />{a.place}
                                </div>
                              ))}
                              {items.length > 2 && <div style={{ fontSize: '9px', color: '#64748B' }}>ほか{items.length - 2}件</div>}
                              {hasSale && (
                                <div style={{ fontSize: '9px', fontWeight: 800, color: '#16A34A', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>¥{dayRev.toLocaleString()}</div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )
                })()}
              </div>
              {/* 選んだ日の申込内容 */}
              {calPicked && (() => {
                const items = myApplies.filter(a => a.rawDate === calPicked)
                const daySales = calSales.filter(x => x.sale_date === calPicked)
                if (items.length === 0 && daySales.length === 0) return null
                const [yy, mm, dd] = calPicked.split('-')
                return (
                  <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #BFDBFE', padding: '16px 18px', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                      <div style={{ fontWeight: '700', fontSize: '14px', color: '#1D4ED8' }}>
                        {parseInt(yy, 10)}年{parseInt(mm, 10)}月{parseInt(dd, 10)}日の申込（{items.length}件）
                      </div>
                      <button onClick={() => setCalPicked(null)} style={{ background: 'none', border: 'none', color: '#94A3B8', fontSize: '13px', cursor: 'pointer' }}>閉じる ✕</button>
                    </div>
                    {/* この日の売上（報告済みならここで内容を確認できる） */}
                    {daySales.length > 0 && (
                      <div style={{ marginBottom: '12px' }}>
                        {daySales.map(sale => (
                          <div key={sale.id} style={{ border: '1px solid #BBF7D0', background: '#F0FDF4', borderRadius: '8px', padding: '12px 14px', marginBottom: '8px' }}>
                            <div style={{ fontSize: '12px', fontWeight: 700, color: '#15803D', marginBottom: '8px' }}>この日の売上（報告済み）</div>
                            <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap', marginBottom: sale.items.length || sale.weather || sale.customers || sale.note ? '10px' : 0 }}>
                              {([
                                ['売上', '¥' + sale.revenue.toLocaleString(), '#1a1a1a'],
                                ['出店料（税別）', '¥' + sale.fee.toLocaleString(), '#3A9BD5'],
                                ['手取り', '¥' + (sale.revenue - sale.fee).toLocaleString(), '#16A34A'],
                              ] as [string, string, string][]).map(([l, v, c]) => (
                                <div key={l}>
                                  <div style={{ fontSize: '10px', color: '#64748B' }}>{l}</div>
                                  <div style={{ fontSize: '15px', fontWeight: 900, color: c }}>{v}</div>
                                </div>
                              ))}
                            </div>
                            {sale.items.length > 0 && (
                              <div style={{ borderTop: '1px solid #DCFCE7', paddingTop: '8px', marginBottom: '6px' }}>
                                <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '4px' }}>
                                  販売食数（合計{sale.items.reduce((t, it) => t + (it.qty || 0), 0)}食）
                                </div>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                  {sale.items.map((it, k) => (
                                    <span key={k} style={{ background: '#fff', border: '1px solid #BBF7D0', borderRadius: '999px', padding: '3px 10px', fontSize: '11px', color: '#166534' }}>
                                      {it.name} <strong>{it.qty}</strong>食
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {(sale.weather || sale.customers) && (
                              <div style={{ fontSize: '11px', color: '#475569' }}>
                                {sale.weather && <>天候：{sale.weather}　</>}
                                {sale.customers != null && <>来客：{sale.customers}</>}
                              </div>
                            )}
                            {sale.note && (
                              <div style={{ fontSize: '11px', color: '#475569', marginTop: '4px', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{sale.note}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={{ display: 'grid', gap: '10px' }}>
                      {items.map(a => (
                        <div key={a.id} style={{ border: '1px solid #E2E8F0', borderRadius: '8px', padding: '12px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                            <span style={{ background: a.statusBg, color: a.statusColor, borderRadius: '4px', padding: '2px 8px', fontSize: '11px', fontWeight: '700' }}>{a.status}</span>
                            <span style={{ fontSize: '14px', fontWeight: '700', color: '#1a1a1a' }}>{a.place}</span>
                          </div>
                          <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '10px' }}>出店形態：{a.type || '未設定'}</div>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {a.placeId && (
                              <a href={'/places/' + a.placeId} target='_blank' rel='noopener noreferrer' style={{ background: '#F5A623', color: '#fff', borderRadius: '6px', padding: '7px 14px', fontSize: '12px', fontWeight: '700', textDecoration: 'none' }}>案件の詳細を見る</a>
                            )}
                            {a.status === '承認済' && (
                              <button onClick={() => { setTab('messages'); openThread(a.id) }} style={{ background: '#fff', color: '#1D4ED8', border: '1px solid #BFDBFE', borderRadius: '6px', padding: '7px 14px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>メッセージを見る</button>
                            )}
                            {/* 出店日を過ぎていて、まだ報告が無い場合はここからも報告できる */}
                            {/* 報告済みかどうかは日付ではなく申込ごとに見る。
                                同じ日に2件出店した場合や、売上日を別の日で登録した場合に
                                取りこぼしたり二重に登録したりしないようにするため。 */}
                            {a.status === '承認済' && a.rawDate && a.rawDate < todayStr() && !calSales.some(x => x.application_id === a.id) && (
                              <button onClick={() => openReport({ application_id: a.id, placeTitle: a.place, apply_date: a.rawDate || '' })}
                                style={{ background: '#DC2626', color: '#fff', border: 'none', borderRadius: '6px', padding: '7px 14px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>売上を報告する</button>
                            )}
                            <button onClick={() => setTab('applies')} style={{ background: '#fff', color: '#64748B', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '7px 14px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>申込一覧で見る</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })()}

              <div style={{ textAlign: 'center' }}>
                <button onClick={() => window.location.href='/places'} style={{ background: '#F5A623', color: '#fff', border: 'none', borderRadius: '8px', padding: '12px 28px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>＋ 新しい出店日を申込む</button>
              </div>
            </>
          )}


          {/* お支払い（出店料） */}
          {tab === 'payments' && (
            <>
              <div style={{ background: '#FFF8E1', border: '1px solid #FFE082', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: '#B45309', lineHeight: 1.8 }}>
                発行済みの請求書と、お支払いの状況をご確認いただけます。お振込が済みましたら「振り込みました」からお知らせください。運営で確認のうえ、確認済みのご連絡をいたします。
              </div>

              <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '16px 18px', marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#1a1a1a', marginBottom: '8px' }}>お振込先</div>
                <div style={{ fontSize: '13px', color: '#475569', lineHeight: 1.9 }}>
                  東京シティ信用金庫 日本橋支店<br />
                  普通 1095906<br />
                  口座名義：カ)ナヴ
                </div>
                <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '6px' }}>お振込手数料は貴社にてご負担をお願いいたします。</div>
              </div>

              {invLoading ? (
                <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '32px', textAlign: 'center', color: '#999', fontSize: '13px' }}>読み込み中...</div>
              ) : invError ? (
                <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #FECACA', padding: '28px', textAlign: 'center', fontSize: '13px', lineHeight: 1.8 }}>
                  <div style={{ color: '#DC2626', fontWeight: 700, marginBottom: '4px' }}>お支払い状況を読み込めませんでした</div>
                  <div style={{ color: '#64748B', fontSize: '12px', marginBottom: '12px' }}>{invError}</div>
                  <button onClick={loadMyInvoices} style={{ background: '#F5A623', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 20px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>もう一度読み込む</button>
                </div>
              ) : myInvoices.length === 0 ? (
                <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '32px', textAlign: 'center', color: '#999', fontSize: '13px', lineHeight: 1.8 }}>
                  発行済みの請求書はまだありません。<br />売上をご報告いただくと、運営で請求書を作成いたします。
                </div>
              ) : (
                <div style={{ display: 'grid', gap: '12px' }}>
                  {myInvoices.map(iv => {
                    const st = iv.paid_status === 'paid'
                      ? { label: '入金確認済み', color: '#16A34A', bg: '#ECFDF5', border: '#BBF7D0' }
                      : iv.paid_status === 'reported'
                        ? { label: '確認中', color: '#B45309', bg: '#FFFBEB', border: '#FDE68A' }
                        : { label: 'お支払い前', color: '#DC2626', bg: '#FEF2F2', border: '#FECACA' }
                    // 期限を過ぎている未払いは目立たせる
                    const overdue = iv.paid_status !== 'paid' && iv.due_on && iv.due_on < todayStr()
                    return (
                      <div key={iv.id} style={{ background: '#fff', borderRadius: '12px', border: `1px solid ${overdue ? '#FECACA' : '#E2E8F0'}`, padding: '16px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                          <span style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}`, borderRadius: '999px', padding: '3px 12px', fontSize: '11px', fontWeight: 700 }}>{st.label}</span>
                          <span style={{ fontSize: '14px', fontWeight: 700, color: '#1a1a1a' }}>{iv.period} 分</span>
                          <span style={{ fontSize: '11px', color: '#94A3B8' }}>請求書番号 {iv.invoice_no}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '10px' }}>
                          <div>
                            <div style={{ fontSize: '10px', color: '#64748B' }}>ご請求額（税込）</div>
                            <div style={{ fontSize: '20px', fontWeight: 900, color: '#1a1a1a' }}>¥{iv.total.toLocaleString()}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: '10px', color: '#64748B' }}>お支払期限</div>
                            <div style={{ fontSize: '14px', fontWeight: 700, color: overdue ? '#DC2626' : '#475569', paddingTop: '4px' }}>
                              {iv.due_on ? iv.due_on.replace(/-/g, '/') : '—'}{overdue && '（期限を過ぎています）'}
                            </div>
                          </div>
                        </div>
                        {iv.paid_status === 'reported' && (
                          <div style={{ fontSize: '11px', color: '#B45309', marginBottom: '8px' }}>
                            {iv.paid_on ? iv.paid_on.replace(/-/g, '/') + ' のお振込としてご報告いただいています。' : 'お振込のご報告をいただいています。'}運営で確認しております。
                          </div>
                        )}
                        {iv.paid_status === 'paid' && (
                          <div style={{ fontSize: '11px', color: '#16A34A', marginBottom: '8px' }}>ご入金を確認いたしました。ありがとうございました。</div>
                        )}
                        {iv.paid_status !== 'paid' && (
                          <button onClick={() => {
                            setPayFor(iv)
                            // 出し直しのときは前回の内容を出す（今日の日付で上書きしない）
                            setPayOn(iv.paid_on || todayStr())
                            setPayName(iv.paid_name || profile.shop_name || profile.name || '')
                          }}
                            style={{ background: iv.paid_status === 'reported' ? '#fff' : '#F5A623', color: iv.paid_status === 'reported' ? '#B45309' : '#fff', border: iv.paid_status === 'reported' ? '1px solid #FDE68A' : 'none', borderRadius: '8px', padding: '9px 20px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                            {iv.paid_status === 'reported' ? '報告内容を出し直す' : '振り込みました'}
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
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
                      { label: '車両サイズ', value: formatVehicleSize(profile.size_length, profile.size_width, profile.size_height) },
                      { label: '設備', value: profile.equipment },
                      { label: 'テイクアウトの袋', value: profile.takeout_bag },
                      { label: '利用できる決済', value: profile.payment_methods.join('・') },
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
                                {m.detail && <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>{m.detail}</div>}
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
                            <input value={menuDetail} onChange={e => setMenuDetail(e.target.value)} placeholder='詳細（例：2本／ミルク・ソーダ選べます）※任意' style={{ width: '100%', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '8px 10px', fontSize: '13px', color: '#1a1a1a', boxSizing: 'border-box' }} />
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
                      {/* サイズは書き方がばらばらだと募集者が見比べられないため、
                          mm の数字だけを受け取り、下に確定する表記を出す */}
                      <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '4px' }}>車両サイズ（単位：mm）</div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {([
                          ['size_length', '全長', '3440'],
                          ['size_width', '全幅', '1520'],
                          ['size_height', '高さ', '2460'],
                        ] as const).map(([key, label, ph]) => (
                          <div key={key} style={{ flex: 1 }}>
                            <div style={{ fontSize: '10px', color: '#94A3B8', marginBottom: '2px' }}>{label}</div>
                            <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '0 8px 0 10px', background: '#fff' }}>
                              <input value={profileForm[key]} inputMode='numeric'
                                onChange={e => setProfileForm({ ...profileForm, [key]: e.target.value.replace(/[^0-9.]/g, '') })}
                                placeholder={ph}
                                style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', padding: '8px 0', fontSize: '13px', color: '#1a1a1a', background: 'transparent' }} />
                              <span style={{ fontSize: '11px', color: '#94A3B8', flexShrink: 0 }}>mm</span>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div style={{ fontSize: '11px', color: '#64748B', marginTop: '6px', lineHeight: 1.7 }}>
                        {formatVehicleSize(profileForm.size_length, profileForm.size_width, profileForm.size_height)
                          ? <>この表記で掲載されます：<span style={{ color: '#1a1a1a', fontWeight: 700 }}>車両サイズが、{formatVehicleSize(profileForm.size_length, profileForm.size_width, profileForm.size_height)}</span></>
                          : '例：全長 3440 / 全幅 1520 / 高さ 2460（車検証の「長さ・幅・高さ」をmmでご入力ください）'}
                      </div>
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '4px' }}>設備</div>
                      <input value={profileForm.equipment} onChange={e => setProfileForm({ ...profileForm, equipment: e.target.value })} placeholder='例：給排水タンク、発電機、冷蔵庫' style={{ width: '100%', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '8px 10px', fontSize: '13px', color: '#1a1a1a', boxSizing: 'border-box' }} />
                    </div>

                    {/* ===== 施設への提出用情報 =====
                        出店が決まると、施設・企業へ「出店者情報」（店舗名・Instagram・
                        ジャンル・テイクアウト袋・決済方法・メニュー）を提出する。
                        ここで入力した内容がそのまま提出書類に載る。 */}
                    <div style={{ marginBottom: '12px', border: '1.5px solid #BFDBFE', background: '#F8FBFF', borderRadius: '10px', padding: '12px' }}>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#1D4ED8', marginBottom: '4px' }}>施設への提出用情報</div>
                      <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '10px', lineHeight: 1.7 }}>
                        出店が決まった際、施設・企業へ提出する「出店者情報」に載る項目です。メニューは上の「メニュー」欄の内容がそのまま使われます。
                      </div>

                      <div style={{ marginBottom: '10px' }}>
                        <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '4px' }}>テイクアウトの袋</div>
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                          {(['無料', '有料'] as const).map(v => {
                            const isPaid = profileForm.takeout_bag.startsWith('有料')
                            const on = v === '無料' ? profileForm.takeout_bag === '無料' : isPaid
                            return (
                              <label key={v} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '13px', color: '#1a1a1a', cursor: 'pointer' }}>
                                <input type='radio' name='takeoutBag' checked={on}
                                  onChange={() => setProfileForm({ ...profileForm, takeout_bag: v === '無料' ? '無料' : '有料：円' })}
                                  style={{ accentColor: '#1D4ED8' }} />
                                {v}
                              </label>
                            )
                          })}
                          {profileForm.takeout_bag.startsWith('有料') && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: '#1a1a1a' }}>
                              <input value={(profileForm.takeout_bag.match(/[0-9]+/) || [''])[0]} inputMode='numeric'
                                onChange={e => setProfileForm({ ...profileForm, takeout_bag: '有料：' + e.target.value.replace(/[^0-9]/g, '') + '円' })}
                                placeholder='5' style={{ width: '64px', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '6px 8px', fontSize: '13px', color: '#1a1a1a', textAlign: 'right' }} />
                              円
                            </span>
                          )}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '4px' }}>利用できる決済（複数選択できます）</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '6px' }}>
                          {PAY_OPTIONS.map(v => {
                            const on = profileForm.payment_methods.includes(v)
                            return (
                              <label key={v} style={{
                                display: 'inline-flex', alignItems: 'center', gap: '5px', cursor: 'pointer',
                                border: on ? '1.5px solid #1D4ED8' : '1.5px solid #E2E8F0', background: on ? '#EFF6FF' : '#fff',
                                borderRadius: '999px', padding: '6px 12px', fontSize: '12px', color: '#1a1a1a',
                              }}>
                                <input type='checkbox' checked={on}
                                  onChange={() => setProfileForm({ ...profileForm, payment_methods: on ? profileForm.payment_methods.filter(x => x !== v) : [...profileForm.payment_methods, v] })}
                                  style={{ accentColor: '#1D4ED8' }} />
                                {v}
                              </label>
                            )
                          })}
                        </div>
                        {/* 選択肢に無い決済（交通系ICなど）は自由記述で足す。
                            「・」区切りで複数書ける。保存時に配列へ直す。 */}
                        <input
                          value={payOther}
                          onChange={e => setPayOther(e.target.value)}
                          placeholder='その他（例：交通系IC・au PAY）※任意'
                          style={{ width: '100%', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '8px 10px', fontSize: '13px', color: '#1a1a1a', boxSizing: 'border-box' }} />
                      </div>
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
              {unreported.length > 0 && (
                <div style={{ background: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#DC2626', marginBottom: '6px' }}>売上報告がまだの出店</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {unreported.map(u => (
                      <button key={u.application_id} onClick={() => openReport(u)}
                        style={{ background: '#fff', color: '#DC2626', border: '1px solid #FECACA', borderRadius: '999px', padding: '6px 14px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                        {u.apply_date.slice(5).replace('-', '/')} {u.placeTitle}
                      </button>
                    ))}
                  </div>
                  <div style={{ fontSize: '11px', color: '#991B1B', marginTop: '6px' }}>押すと報告フォームが開きます。売上と食数をまとめて報告できます。</div>
                </div>
              )}
              <div style={{ background: '#FFF8E1', border: '1px solid #FFE082', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: '#B45309', display: 'flex', gap: '8px' }}>
                <span>承認された案件ごとに売上を入力すると、出店料（出店コネクトナビへのお支払い額）とあなたの利益（手取り）が自動計算されます。<br /><strong>出店料の請求は税別となります。</strong>ご請求時に消費税10%を加算した金額をご請求します。</span>
              </div>

              <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '20px', marginBottom: '16px' }}>
                <div style={{ fontWeight: '700', fontSize: '14px', marginBottom: '16px' }}>売上を入力</div>
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div className='sale-field' style={{ flex: '1 1 200px' }}>
                    <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '6px' }}>案件</div>
                    <select value={saleAppId} onChange={e => setSaleAppId(e.target.value)} style={{ width: '100%', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', color: '#1a1a1a', background: '#fff' }}>
                      <option value=''>{myApprovedApps.length === 0 ? '承認された案件がありません' : '選択してください'}</option>
                      {myApprovedApps.map(a => { const notYet = !!a.apply_date && todayStr() < a.apply_date; return (<option key={a.application_id} value={a.application_id} disabled={notYet}>{a.placeTitle}{a.apply_date ? '（出店日 ' + a.apply_date.slice(5).replace('-', '/') + '）' : ''}{notYet ? ' ※出店後に入力できます' : ''}</option>) })}
                    </select>
                    {myApprovedApps.length === 0 && (
                      // 承認された申込が1件も無いと、案件を選べず売上を記録できない。
                      // 「選択してください」だけだと理由が分からないため、ここで説明する。
                      <div style={{ fontSize: '11px', color: '#B45309', marginTop: '6px', lineHeight: 1.7 }}>
                        売上を記録できるのは、出店が承認された案件だけです。承認されるとここに出ます。
                      </div>
                    )}
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
                  <button onClick={saveMySale} disabled={saleSaving || !saleAppId} title={!saleAppId ? '先に案件を選んでください' : ''} style={{ background: (saleSaving || !saleAppId) ? '#ccc' : '#F5A623', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 20px', fontSize: '13px', fontWeight: '700', cursor: (saleSaving || !saleAppId) ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>{saleSaving ? '保存中...' : '記録する'}</button>
                </div>
                <label style={{ marginTop: '12px', display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#1a1a1a', cursor: 'pointer' }}>
                  <input type='checkbox' checked={saleSplit} onChange={e => setSaleSplit(e.target.checked)} style={{ accentColor: '#F5A623', cursor: 'pointer' }} />
                  税率ごとに分けて入力する（任意）
                </label>

                {/* 品目別の内訳（任意）。施設・企業から「何が何食売れたか」を
                    求められることがあるため、品目と食数を記録できるようにする */}
                <div style={{ marginTop: '14px', border: '1px dashed #CBD5E1', borderRadius: '10px', padding: '12px', background: '#F8FAFC' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px', marginBottom: saleItems.length > 0 ? '10px' : 0 }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#1a1a1a' }}>品目別の内訳（任意）</div>
                    <button type='button' onClick={() => setSaleItems([...saleItems, { name: '', qty: '', price: '' }])}
                      style={{ background: '#fff', color: '#B45309', border: '1.5px dashed #F5A623', borderRadius: '8px', padding: '6px 14px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>＋ 品目を追加</button>
                  </div>
                  {saleItems.length === 0 && (
                    <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '6px', lineHeight: 1.7 }}>
                      「何が何食売れたか」を施設・企業へ報告する場合にご利用ください。登録済みのメニュー名が候補に出ます。
                    </div>
                  )}
                  {saleItems.map((it, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <input value={it.name} list='sale-item-menus'
                        onChange={e => setSaleItems(saleItems.map((x, k) => k === idx ? { ...x, name: e.target.value } : x))}
                        placeholder='品目名（例：唐揚げ弁当）'
                        style={{ flex: '2 1 180px', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '8px 10px', fontSize: '13px', color: '#1a1a1a', background: '#fff' }} />
                      <input value={it.qty} inputMode='numeric'
                        onChange={e => setSaleItems(saleItems.map((x, k) => k === idx ? { ...x, qty: e.target.value.replace(/[^0-9]/g, '') } : x))}
                        placeholder='食数'
                        style={{ flex: '0 1 80px', width: '80px', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '8px 10px', fontSize: '13px', color: '#1a1a1a', textAlign: 'right', background: '#fff' }} />
                      <input value={it.price} inputMode='numeric'
                        onChange={e => setSaleItems(saleItems.map((x, k) => k === idx ? { ...x, price: e.target.value.replace(/[^0-9]/g, '') } : x))}
                        placeholder='単価（任意）'
                        style={{ flex: '0 1 100px', width: '100px', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '8px 10px', fontSize: '13px', color: '#1a1a1a', textAlign: 'right', background: '#fff' }} />
                      <button type='button' onClick={() => setSaleItems(saleItems.filter((_, k) => k !== idx))} title='この行を削除'
                        style={{ border: 'none', background: 'none', color: '#DC2626', cursor: 'pointer', fontSize: '14px', padding: '0 4px' }}>✕</button>
                    </div>
                  ))}
                  {/* 品目名の候補は登録済みメニューから */}
                  <datalist id='sale-item-menus'>
                    {menus.map(m => <option key={m.id} value={m.name} />)}
                  </datalist>
                  {(() => {
                    // 保存されるのは品目名と食数が入っている行だけなので、
                    // 合計もその行だけで数える（画面と保存内容を一致させる）
                    const valid = saleItems.filter(it => it.name.trim() && (parseInt(it.qty, 10) || 0) > 0)
                    const sum = valid.reduce((t, it) => {
                      const q = parseInt(it.qty, 10) || 0
                      const pr = parseInt(it.price, 10) || 0
                      return t + q * pr
                    }, 0)
                    const cnt = valid.reduce((t, it) => t + (parseInt(it.qty, 10) || 0), 0)
                    const skipped = saleItems.filter(it => !it.name.trim() && (parseInt(it.qty, 10) || 0) > 0).length
                    if (cnt === 0 && skipped === 0) return null
                    return (
                      <div style={{ fontSize: '12px', color: '#475569', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <span>合計 <strong>{cnt}食</strong>{sum > 0 && <>／単価から計算した売上 <strong>{sum.toLocaleString()}円</strong></>}</span>
                        {skipped > 0 && <span style={{ color: '#DC2626' }}>品目名が空の行が{skipped}件あります（このままでは保存されません）</span>}
                        {sum > 0 && !saleSplit && (
                          <button type='button' onClick={() => setSaleRevenue(String(sum))}
                            style={{ background: '#fff', color: '#1D4ED8', border: '1px solid #BFDBFE', borderRadius: '6px', padding: '4px 10px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>この金額を売上欄に入れる</button>
                        )}
                      </div>
                    )
                  })()}
                </div>
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
                  const fee = calcFee(rev, a, saleTaxOv, null, saleDate).total
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
                        <td style={{ padding: '10px 14px' }}>
                          {s.placeTitle}
                          {s.items.length > 0 && (
                            <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                              {s.items.map(it => it.name + '×' + it.qty).join('、')}
                            </div>
                          )}
                        </td>
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


      {/* お振込の報告 */}
      {payFor && (
        <div onClick={() => { if (!paySaving) setPayFor(null) }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '14px', width: '100%', maxWidth: '420px', overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,0.25)' }}>
            <div style={{ background: '#F5A623', color: '#fff', padding: '16px 20px' }}>
              <div style={{ fontSize: '16px', fontWeight: 900 }}>お振込のご報告</div>
              <div style={{ fontSize: '12px', opacity: 0.95, marginTop: '2px' }}>{payFor.period} 分／¥{payFor.total.toLocaleString()}（税込）</div>
            </div>
            <div style={{ padding: '18px 20px' }}>
              <div style={{ marginBottom: '14px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#1a1a1a', marginBottom: '6px' }}>お振込日</div>
                <input type='date' value={payOn} max={todayStr()} onChange={e => setPayOn(e.target.value)}
                  style={{ width: '100%', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', color: '#1a1a1a', boxSizing: 'border-box' }} />
              </div>
              <div style={{ marginBottom: '6px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#1a1a1a', marginBottom: '6px' }}>お振込名義</div>
                <input value={payName} onChange={e => setPayName(e.target.value)} placeholder='例：カ)ナヴ'
                  style={{ width: '100%', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', color: '#1a1a1a', boxSizing: 'border-box' }} />
                <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px', lineHeight: 1.7 }}>
                  通帳のお名前と照らし合わせます。店舗名と違う名義でお振込の場合は、その名義をご記入ください。
                </div>
              </div>
            </div>
            <div style={{ borderTop: '1px solid #E2E8F0', padding: '14px 20px', display: 'flex', gap: '10px' }}>
              <button onClick={() => setPayFor(null)} disabled={paySaving}
                style={{ background: '#fff', color: '#64748B', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '12px 20px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>やめる</button>
              <button onClick={sendPaymentReport} disabled={paySaving}
                style={{ flex: 1, background: paySaving ? '#ccc' : '#F5A623', color: '#fff', border: 'none', borderRadius: '8px', padding: '12px', fontSize: '15px', fontWeight: 900, cursor: paySaving ? 'not-allowed' : 'pointer' }}>
                {paySaving ? '送信中…' : '報告する'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== 出店報告フォーム =====
          出店が終わったら、企業へ提出できる形で報告してもらう。
          品目は登録済みメニューが並ぶので、売れた数を入れるだけで済む。 */}
      {subForm && myUid && (
        <SiteSubmissionForm
          supabase={supabase}
          placeId={subForm.placeId}
          placeTitle={subForm.placeTitle}
          sellerId={myUid}
          onClose={() => setSubForm(null)}
          onSaved={loadSubmissions}
        />
      )}

      {reportFor && (() => {
        const app = myApprovedApps.find(x => x.application_id === reportFor.application_id)
        const rev = parseInt(rpRevenue.replace(/[^0-9]/g, ''), 10) || 0
        const filled = rpItems.filter(it => it.name.trim() && (parseInt(it.qty, 10) || 0) > 0)
        const totalQty = filled.reduce((t, it) => t + (parseInt(it.qty, 10) || 0), 0)
        const itemSum = filled.reduce((t, it) => t + (parseInt(it.qty, 10) || 0) * (parseInt(it.price, 10) || 0), 0)
        // 単価が入っていない品目があると合計は当てにならないので、
        // 全部そろっているときだけ金額の食い違いを知らせる
        const allPriced = filled.length > 0 && filled.every(it => (parseInt(it.price, 10) || 0) > 0)
        const fee = app ? calcFee(rev, app, '', null, reportFor.apply_date).total : 0
        const [ry, rm, rd] = reportFor.apply_date.split('-')
        const label: React.CSSProperties = { fontSize: '12px', fontWeight: 700, color: '#1a1a1a', marginBottom: '6px' }
        const box: React.CSSProperties = { border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', color: '#1a1a1a', boxSizing: 'border-box', background: '#fff' }
        return (
          <div onClick={() => { if (!rpSaving) setReportFor(null) }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 1000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '16px', overflowY: 'auto' }}>
            <div onClick={e => e.stopPropagation()}
              style={{ background: '#fff', borderRadius: '14px', width: '100%', maxWidth: '560px', margin: 'auto', overflow: 'hidden', boxShadow: '0 12px 40px rgba(0,0,0,0.25)' }}>

              <div style={{ background: '#F5A623', color: '#fff', padding: '16px 20px' }}>
                <div style={{ fontSize: '16px', fontWeight: 900, marginBottom: '2px' }}>出店お疲れさまでした</div>
                <div style={{ fontSize: '12px', opacity: 0.95 }}>
                  {parseInt(ry, 10)}年{parseInt(rm, 10)}月{parseInt(rd, 10)}日　{reportFor.placeTitle}
                </div>
              </div>

              <div style={{ padding: '18px 20px', maxHeight: '65vh', overflowY: 'auto' }}>
                <div style={{ fontSize: '12px', color: '#64748B', lineHeight: 1.8, marginBottom: '16px' }}>
                  当日の結果をご報告ください。ここでご入力いただいた内容が、施設・企業へのご報告に使われます。
                </div>

                {/* 売上 */}
                <div style={{ marginBottom: '18px' }}>
                  <div style={label}>売上金額（税込・必須）</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input value={rpRevenue} inputMode='numeric' autoFocus
                      onChange={e => setRpRevenue(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder='50000' style={{ ...box, flex: 1, textAlign: 'right', fontSize: '18px', fontWeight: 700 }} />
                    <span style={{ fontSize: '14px', color: '#64748B' }}>円</span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>レジの合計（お客様からお預かりした金額）をご入力ください。</div>
                </div>

                {/* 品目ごとの食数 */}
                <div style={{ marginBottom: '18px' }}>
                  <div style={label}>品目ごとの販売食数</div>
                  <div style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '8px', lineHeight: 1.7 }}>
                    売れた品目の数だけご入力ください（0や空欄の品目は報告されません）。企業から食数のご報告を求められることがあります。単価は登録済みメニューから入りますが、当日変更した場合は直せます。
                  </div>
                  {rpItems.length === 0 && (
                    <div style={{ fontSize: '12px', color: '#B45309', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '8px', padding: '10px 12px', marginBottom: '8px' }}>
                      メニューが未登録です。プロフィールにメニューを登録すると、ここに自動で並びます。下の「品目を追加」から手入力もできます。
                    </div>
                  )}
                  {rpItems.map((it, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap' }}>
                      <input value={it.name}
                        onChange={e => setRpItems(rpItems.map((x, k) => k === idx ? { ...x, name: e.target.value } : x))}
                        placeholder='品目名' style={{ ...box, flex: '1 1 140px', minWidth: '120px', fontSize: '13px' }} />
                      <input value={it.price} inputMode='numeric'
                        onChange={e => setRpItems(rpItems.map((x, k) => k === idx ? { ...x, price: e.target.value.replace(/[^0-9]/g, '') } : x))}
                        placeholder='単価' style={{ ...box, width: '76px', flexShrink: 0, textAlign: 'right', fontSize: '13px' }} />
                      <input value={it.qty} inputMode='numeric'
                        onChange={e => setRpItems(rpItems.map((x, k) => k === idx ? { ...x, qty: e.target.value.replace(/[^0-9]/g, '') } : x))}
                        placeholder='0' style={{ ...box, width: '68px', flexShrink: 0, textAlign: 'right', fontSize: '13px' }} />
                      <span style={{ fontSize: '12px', color: '#64748B', flexShrink: 0 }}>食</span>
                      <button type='button' onClick={() => setRpItems(rpItems.filter((_, k) => k !== idx))} title='この行を消す'
                        style={{ border: 'none', background: 'none', color: '#CBD5E1', cursor: 'pointer', fontSize: '15px', flexShrink: 0, padding: '0 2px' }}>✕</button>
                    </div>
                  ))}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                    <button type='button' onClick={() => setRpItems([...rpItems, { name: '', qty: '', price: '' }])}
                      style={{ background: '#fff', color: '#B45309', border: '1.5px dashed #F5A623', borderRadius: '8px', padding: '7px 14px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>＋ 品目を追加</button>
                    {totalQty > 0 && (
                      <span style={{ fontSize: '12px', color: '#475569' }}>
                        合計 <strong>{totalQty}食</strong>
                        {allPriced && <>／単価から <strong>{itemSum.toLocaleString()}円</strong></>}
                        {!allPriced && itemSum > 0 && <span style={{ color: '#94A3B8' }}>（単価が空の品目があるため金額は出していません）</span>}
                      </span>
                    )}
                  </div>
                  {allPriced && rev > 0 && Math.abs(itemSum - rev) > Math.max(500, rev * 0.1) && (
                    <div style={{ fontSize: '11px', color: '#DC2626', marginTop: '6px', lineHeight: 1.7 }}>
                      売上金額（{rev.toLocaleString()}円）と食数から計算した金額（{itemSum.toLocaleString()}円）が離れています。入力をご確認ください。
                    </div>
                  )}
                  {allPriced && rev === 0 && (
                    <button type='button' onClick={() => setRpRevenue(String(itemSum))}
                      style={{ marginTop: '6px', background: '#fff', color: '#1D4ED8', border: '1px solid #BFDBFE', borderRadius: '6px', padding: '5px 12px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}>
                      {itemSum.toLocaleString()}円を売上に入れる
                    </button>
                  )}
                </div>

                {/* 当日の状況 */}
                <div style={{ marginBottom: '18px' }}>
                  <div style={label}>当日の状況（任意）</div>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
                    {WEATHERS.map(w => (
                      <button key={w} type='button' onClick={() => setRpWeather(rpWeather === w ? '' : w)}
                        style={{ border: rpWeather === w ? '1.5px solid #1D4ED8' : '1.5px solid #E2E8F0', background: rpWeather === w ? '#EFF6FF' : '#fff', color: '#1a1a1a', borderRadius: '999px', padding: '7px 16px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>{w}</button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input value={rpCustomers} inputMode='numeric'
                      onChange={e => setRpCustomers(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder='来客数' style={{ ...box, width: '120px', textAlign: 'right', fontSize: '13px' }} />
                    <span style={{ fontSize: '12px', color: '#64748B' }}>組・人（任意）</span>
                  </div>
                </div>

                <div style={{ marginBottom: '4px' }}>
                  <div style={label}>所感・特記事項（任意）</div>
                  <textarea value={rpNote} onChange={e => setRpNote(e.target.value)} rows={3}
                    placeholder='例：昼の時間帯に行列ができました。次回は仕込みを増やします。'
                    style={{ ...box, width: '100%', fontSize: '13px', resize: 'vertical', fontFamily: 'inherit' }} />
                </div>

                {/* 計算結果 */}
                {rev > 0 && app && (
                  <div style={{ marginTop: '14px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '12px 14px', fontSize: '12px', color: '#475569', lineHeight: 1.9 }}>
                    <div>売上：<strong>{rev.toLocaleString()}円</strong></div>
                    <div>出店料（税別）：<strong>{fee.toLocaleString()}円</strong></div>
                    <div style={{ borderTop: '1px solid #E2E8F0', marginTop: '6px', paddingTop: '6px' }}>
                      あなたの利益（手取り）：<strong style={{ color: '#16A34A', fontSize: '14px' }}>{(rev - fee).toLocaleString()}円</strong>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ borderTop: '1px solid #E2E8F0', padding: '14px 20px', display: 'flex', gap: '10px' }}>
                <button onClick={() => setReportFor(null)} disabled={rpSaving}
                  style={{ flex: '0 0 auto', background: '#fff', color: '#64748B', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '12px 20px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>あとで</button>
                <button onClick={saveReport} disabled={rpSaving || !rpRevenue}
                  style={{ flex: 1, background: (rpSaving || !rpRevenue) ? '#ccc' : '#F5A623', color: '#fff', border: 'none', borderRadius: '8px', padding: '12px', fontSize: '15px', fontWeight: 900, cursor: (rpSaving || !rpRevenue) ? 'not-allowed' : 'pointer' }}>
                  {rpSaving ? '送信中…' : 'この内容で報告する'}
                </button>
              </div>
            </div>
          </div>
        )
      })()}


      <ConfirmDialog
        open={!!cancelAsk}
        busy={cancelingId !== null}
        error={cancelErr}
        danger
        title='この申込を辞退しますか？'
        body={cancelAsk ? `${cancelAsk.label}\n\n運営と募集者にお知らせが届きます。取り消したあとに元へ戻すことはできません。` : ''}
        okLabel='辞退する'
        onOk={runCancelApplication}
        onCancel={() => { if (cancelingId === null) { setCancelAsk(null); setCancelErr(null) } }}
      />

    </div>
  )
}
