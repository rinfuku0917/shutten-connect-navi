'use client'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'
import { PLACE_CATEGORIES } from '../lib/categories'
import { geocodeAddress } from '../lib/geocode'
import { formatVehicleSize } from '../lib/vehicleSize'
import { exportPlaceSubmission } from '../lib/submissionXlsx'
import { exportPlaceSalesReport } from '../lib/salesReportXlsx'
import { compareByTitle } from '../lib/placeSort'
import { perDayFee } from '../lib/placeFee'

// ダミーデータ
// profiles.genre は ["食事","スイーツ"] のようなJSON文字列で入っているため
// そのまま出すと記号ごと画面に出てしまう。表示用に「食事・スイーツ」へ整形する。
function genreText(v: string[] | string | null): string {
  if (!v) return ''
  if (Array.isArray(v)) return v.map(x => String(x).trim()).filter(Boolean).join('・')
  const t = String(v).trim()
  if (t.startsWith('[')) {
    try { const j = JSON.parse(t); if (Array.isArray(j)) return j.map(x => String(x).trim()).filter(Boolean).join('・') } catch { /* 旧い自由入力 */ }
  }
  return t
}

const dummySellers = [
  { id: '1', name: '山田 花子', shop: 'Hana\'s Sweets', email: 'hanako@example.com', phone: '090-1234-5678', genre: '焼き菓子・スイーツ', area: '東京都', sns: '@hana_sweets', status: '承認済', docs: '提出済' },
  { id: '2', name: '田中 健太', shop: 'クラフト工房', email: 'kenta@example.com', phone: '080-2345-6789', genre: 'ハンドメイド雑貨', area: '大阪府', sns: '@craft_kenta', status: '承認済', docs: '提出済' },
  { id: '3', name: '鈴木 次郎', shop: '鈴木農園', email: 'jiro@example.com', phone: '070-3456-7890', genre: '農産物・加工品', area: '神奈川県', sns: '', status: '審査中', docs: '未提出' },
  { id: '4', name: '佐藤 美咲', shop: 'Misaki Accessories', email: 'misaki@example.com', phone: '090-4567-8901', genre: 'アクセサリー', area: '福岡県', sns: '@misaki_acc', status: '承認済', docs: '再提出依頼' },
]

const dummyPlaces = [
  { id: '1', title: '日本体育大学医療専門学校（春の6月7月8月）', host: '渋谷マルシェ実行委員会', area: '東京', type: 'キッチンカー', status: '公開中', applies: 8 },
  { id: '2', title: '大阪公立大学りんくうキャンパス', host: '大阪公立大学', area: '大阪', type: 'キッチンカー', status: '公開中', applies: 3 },
  { id: '3', title: 'イオンモール富谷（宮城）', host: 'イオンモール', area: '宮城', type: 'キッチンカー・物販', status: '公開中', applies: 12 },
  { id: '4', title: '町田美容専門学校', host: '町田美容専門学校', area: '東京', type: 'キッチンカー', status: '下書き', applies: 0 },
]

export default function AdminPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'dashboard' | 'places' | 'sellers' | 'csv' | 'place-edit' | 'docs' | 'sales' | 'messages' | 'reviews' | 'imported' | 'publish' | 'blog' | 'applications' | 'meetings'>('dashboard')
  type AdminSeller = { id: string, name: string, shop: string, email: string, phone: string, genre: string, area: string, sns: string, status: string, docs: string }
  const [sellers, setSellers] = useState<AdminSeller[]>([])
  const [sellersLoading, setSellersLoading] = useState(false)
  const [sellerKw, setSellerKw] = useState('')
  const loadSellersList = async () => {
    setSellersLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('id, name, shop_name, email, phone, genre, areas')
      .eq('role', 'seller')
      .order('name', { ascending: true })
    const mapped: AdminSeller[] = (data || []).map((p: any) => ({
      id: p.id,
      name: p.name || '(未設定)',
      shop: p.shop_name || '',
      email: p.email || '',
      phone: p.phone || '',
      genre: genreText(p.genre) || '—',
      area: Array.isArray(p.areas) && p.areas.length > 0 ? p.areas.join('・') : '—',
      sns: '',
      status: '登録済',
      docs: '—',
    }))
    setSellers(mapped)
    setSellersLoading(false)
  }
  const [csvPreview, setCsvPreview] = useState<string[][]>([])
  const [csvImported, setCsvImported] = useState(false)
  const [showNewPlace, setShowNewPlace] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // ===== 書類審査（管理者） =====
  type DocReview = { id: string, seller_id: string, doc_type: string, file_url: string, status: string, uploaded_at: string, sellerName: string, sellerShop: string, expiry_date: string | null }
  const [docReviews, setDocReviews] = useState<DocReview[]>([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [docFilter, setDocFilter] = useState<'all' | 'pending' | 'expiring'>('all')
  const [authChecked, setAuthChecked] = useState(false)
  const [adminUid, setAdminUid] = useState<string | null>(null)

  // ===== ブログ記事管理 =====
  type BlogPost = { id: string; slug: string; title: string; content: string; excerpt: string | null; category: string | null; cover_emoji: string | null; meta_description: string | null; status: string; published_at: string | null; created_at: string }
  const [posts, setPosts] = useState<BlogPost[]>([])
  const [postsLoading, setPostsLoading] = useState(false)
  const [editingPost, setEditingPost] = useState<BlogPost | null>(null)
  const [pTitle, setPTitle] = useState('')
  const [pSlug, setPSlug] = useState('')
  const [pCategory, setPCategory] = useState('')
  const [pEmoji, setPEmoji] = useState('📝')
  const [pExcerpt, setPExcerpt] = useState('')
  const [pMeta, setPMeta] = useState('')
  const [pContent, setPContent] = useState('')
  const [pStatus, setPStatus] = useState('draft')
  const [pSaving, setPSaving] = useState(false)
  const [pMsg, setPMsg] = useState('')
  const [pMsgOk, setPMsgOk] = useState(false)
  const [imgUploading, setImgUploading] = useState(false)
  const blogImgInputRef = useRef<HTMLInputElement>(null)

  const uploadBlogImage = async (file: File) => {
    if (!adminUid) { setPMsg('認証情報がありません。再ログインしてください'); setPMsgOk(false); return }
    setImgUploading(true); setPMsg(''); setPMsgOk(false)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('requesterId', adminUid)
      const res = await fetch('/api/upload-image', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) { setPMsg('画像アップロード失敗: ' + (json.error || '')); setImgUploading(false); return }
      // 本文の末尾に画像記法を追加
      setPContent(prev => prev + (prev.endsWith('\n') || prev === '' ? '' : '\n\n') + '![画像](' + json.url + ')\n\n')
      setPMsg('画像を挿入しました（本文の末尾に追加されました）'); setPMsgOk(true)
    } catch {
      setPMsg('画像アップロードで通信エラーが発生しました')
    }
    setImgUploading(false)
  }

  const loadPosts = async () => {
    setPostsLoading(true)
    try {
      const res = await fetch('/api/posts?all=1')
      const json = await res.json()
      if (json.posts) setPosts(json.posts)
    } catch { /* noop */ }
    setPostsLoading(false)
  }

  const resetPostForm = () => {
    setEditingPost(null); setPTitle(''); setPSlug(''); setPCategory(''); setPEmoji('📝')
    setPExcerpt(''); setPMeta(''); setPContent(''); setPStatus('draft'); setPMsg('')
  }

  const startEditPost = (p: BlogPost) => {
    setEditingPost(p); setPTitle(p.title); setPSlug(p.slug); setPCategory(p.category || '')
    setPEmoji(p.cover_emoji || '📝'); setPExcerpt(p.excerpt || ''); setPMeta(p.meta_description || '')
    setPContent(p.content); setPStatus(p.status); setPMsg('')
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const savePost = async (asStatus: string) => {
    if (!pTitle.trim() || !pSlug.trim() || !pContent.trim()) { setPMsg('タイトル・URL・本文は必須です'); setPMsgOk(false); return }
    if (!adminUid) { setPMsg('認証情報がありません。再ログインしてください'); setPMsgOk(false); return }
    setPSaving(true); setPMsg(''); setPMsgOk(false)
    const payload = {
      requesterId: adminUid, id: editingPost?.id,
      slug: pSlug.trim(), title: pTitle.trim(), content: pContent,
      excerpt: pExcerpt.trim() || null, category: pCategory.trim() || null,
      cover_emoji: pEmoji || '📝', meta_description: pMeta.trim() || null, status: asStatus,
    }
    try {
      const res = await fetch('/api/posts', {
        method: editingPost ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) { setPMsg('エラー: ' + (json.error || '保存に失敗しました')); setPSaving(false); return }
      setPMsg(asStatus === 'published' ? '公開しました' : '下書き保存しました'); setPMsgOk(true)
      resetPostForm(); loadPosts()
    } catch {
      setPMsg('通信エラーが発生しました')
    }
    setPSaving(false)
  }

  const deletePost = async (p: BlogPost) => {
    if (!adminUid) return
    if (!confirm('「' + p.title + '」を削除しますか？この操作は取り消せません。')) return
    try {
      const res = await fetch('/api/posts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requesterId: adminUid, id: p.id }),
      })
      const json = await res.json()
      if (!res.ok) { alert('削除に失敗: ' + (json.error || '')); return }
      loadPosts()
    } catch { alert('通信エラー') }
  }
  const docTypeLabels: Record<string, string> = { license_front: '運転免許証（表面）', license_back: '運転免許証（裏面）', food_hygiene: '食品衛生責任者証', liability_insurance: '損害賠償保険証書', business_permit: '営業許可証', pl_insurance: 'PL保険証券', inspection_sample: '検体（検査結果）', other_permit: 'その他許可証' }

  // 管理者ガード：admin以外は追い出す
  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user) { router.push('/admin/login'); return }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (profile?.role !== 'admin') { router.push('/admin/login'); return }
      setAdminUid(user.id)
      try {
        const saved = localStorage.getItem('adminTab')
        if (saved && ['dashboard','places','sellers','csv','docs','sales','messages','reviews','imported','publish','blog'].includes(saved)) {
          setTab(saved as typeof tab)
        }
      } catch {}
      setAuthChecked(true)
    }
    checkAdmin()
  }, [router])

  // 全出店者の提出書類を読み込む
  const loadDocReviews = async () => {
    setDocsLoading(true)
    const { data } = await supabase
      .from('seller_documents')
      .select('id, seller_id, doc_type, file_url, status, uploaded_at, expiry_date, profiles(name, shop_name)')
      .order('uploaded_at', { ascending: false })
    const mapped: DocReview[] = (data || []).map((d: any) => ({
      id: d.id, seller_id: d.seller_id, doc_type: d.doc_type, file_url: d.file_url,
      status: d.status, uploaded_at: d.uploaded_at, expiry_date: d.expiry_date || null,
      sellerName: d.profiles?.name || '(出店者)', sellerShop: d.profiles?.shop_name || ''
    }))
    setDocReviews(mapped)
    setDocsLoading(false)
  }

  // docsタブを開いたら読み込む
  useEffect(() => { if (tab === 'docs' && authChecked) loadDocReviews() }, [tab, authChecked])

  // ===== 売上管理（管理者） =====
  type SaleRow = { id: string, place_id: string, seller_id: string, sale_date: string, revenue: number, fee: number, place_fee: number, company_fee: number, total_pay: number, placeTitle: string, sellerName: string, items: { name: string, qty: number, price: number | null }[], weather: string, customers: number | null, note: string }
  const [sales, setSales] = useState<SaleRow[]>([])
  const [salesLoading, setSalesLoading] = useState(false)
  // 売上入力フォーム
  type ApprovedApp = { application_id: string, place_id: string, seller_id: string, placeTitle: string, sellerName: string, price_fixed: number, price_share_pct: number, place_fixed_unit: string, company_fixed_amount: number, company_fixed_unit: string, company_share_pct: number, share_tax_basis: string, share_tax_rate: number, schedule: unknown }
  const [approvedApps, setApprovedApps] = useState<ApprovedApp[]>([])
  const [saleAppId, setSaleAppId] = useState('')
  const [saleDate, setSaleDate] = useState('')
  const [saleRevenue, setSaleRevenue] = useState('')
  const [saleSaving, setSaleSaving] = useState(false)
  const [saleMonth, setSaleMonth] = useState(() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') })

  // 料金を計算（取引先分・弊社利益・お支払い総額を返す。per_event固定は日次では0扱い＝次フェーズ）
  // date を渡すと、その日に金額が設定されていればそちらを使う
  const calcFees = (revenue: number, a: { price_fixed: number; price_share_pct: number; place_fixed_unit: string; company_fixed_amount: number; company_share_pct: number; company_fixed_unit: string; share_tax_basis?: string; share_tax_rate?: number; schedule?: unknown }, ov: string = '', date: string | null = null) => {
    const rate = ov === 'ex8' ? 8 : ov === 'ex10' ? 10 : (a.share_tax_rate || 8)
    const basis = ov === 'ex8' || ov === 'ex10' ? 'tax_excluded' : ov === 'as_entered' ? 'as_entered' : (a.share_tax_basis || 'as_entered')
    const base = basis === 'tax_excluded' ? Math.floor(revenue / (1 + rate / 100)) : revenue
    const day = perDayFee(a.schedule, date)
    const placeFixed = day.placeFee != null ? day.placeFee : (a.place_fixed_unit === "per_event" ? 0 : (a.price_fixed || 0))
    const companyFixed = day.companyFee != null ? day.companyFee : (a.company_fixed_unit === "per_event" ? 0 : (a.company_fixed_amount || 0))
    const placeFee = Math.floor(placeFixed + base * (a.price_share_pct || 0) / 100)
    const companyFee = Math.floor(companyFixed + base * (a.company_share_pct || 0) / 100)
    return { placeFee, companyFee, totalPay: placeFee + companyFee, basis, rate }
  }

  // 承認済み申込を読み込む（売上を記録できる対象）
  const loadApprovedApps = async () => {
    const { data } = await supabase
      .from('applications')
      .select('id, place_id, seller_id, places(title, price_fixed, price_share_pct, place_fixed_unit, company_fixed_amount, company_fixed_unit, company_share_pct, share_tax_basis, share_tax_rate, schedule), profiles!applications_seller_id_fkey(name)')
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
    const mapped: ApprovedApp[] = (data || []).map((a: any) => ({
      application_id: a.id, place_id: a.place_id, seller_id: a.seller_id,
      placeTitle: a.places?.title || '(案件名なし)', sellerName: a.profiles?.name || '(出店者)',
      price_fixed: a.places?.price_fixed || 0, price_share_pct: a.places?.price_share_pct || 0,
      place_fixed_unit: a.places?.place_fixed_unit || 'per_day', company_fixed_amount: a.places?.company_fixed_amount || 0,
      company_fixed_unit: a.places?.company_fixed_unit || 'per_day', company_share_pct: a.places?.company_share_pct || 0,
      share_tax_basis: a.places?.share_tax_basis || 'as_entered', share_tax_rate: a.places?.share_tax_rate || 8,
      schedule: a.places?.schedule ?? null
    }))
    setApprovedApps(mapped)
  }

  // 指定月の売上一覧を読み込む
  const loadSales = async () => {
    setSalesLoading(true)
    const start = saleMonth + '-01'
    const [y, m] = saleMonth.split('-').map(Number)
    const end = (m === 12 ? (y+1) + '-01' : y + '-' + String(m+1).padStart(2,'0')) + '-01'
    const { data } = await supabase
      .from('sales')
      .select('id, place_id, seller_id, sale_date, revenue, fee, place_fee, company_fee, total_pay, items, weather, customers, note, places(title), profiles!sales_seller_id_fkey(name)')
      .gte('sale_date', start).lt('sale_date', end)
      .order('sale_date', { ascending: false })
    const mapped: SaleRow[] = (data || []).map((s: any) => ({
      id: s.id, place_id: s.place_id, seller_id: s.seller_id, sale_date: s.sale_date,
      revenue: s.revenue, fee: s.fee, place_fee: s.place_fee ?? 0, company_fee: s.company_fee ?? s.fee, total_pay: s.total_pay ?? s.fee,
      placeTitle: s.places?.title || '(案件名なし)', sellerName: s.profiles?.name || '(出店者)',
      items: Array.isArray(s.items) ? s.items : [],
      weather: s.weather || '', customers: s.customers ?? null, note: s.note || '',
    }))
    setSales(mapped)
    setSalesLoading(false)

    // 案件ごとに売上報告の件数を数え、提出用Excelのボタンを出す
    const byPlace = new Map<string, { placeId: string, title: string, count: number }>()
    for (const r of mapped) {
      if (!r.place_id) continue
      const cur = byPlace.get(r.place_id) || { placeId: r.place_id, title: r.placeTitle, count: 0 }
      cur.count += 1
      byPlace.set(r.place_id, cur)
    }
    setReportPlaces([...byPlace.values()].sort((a, b) => a.title.localeCompare(b.title, 'ja')))
  }

  // 売上を保存
  const saveSale = async () => {
    if (!saleAppId || !saleDate || !saleRevenue) { alert('案件・日付・売上金額をすべて入力してください'); return }
    const app = approvedApps.find(a => a.application_id === saleAppId)
    if (!app) { alert('対象の申込が見つかりません'); return }
    const revenue = parseInt(saleRevenue, 10)
    if (isNaN(revenue) || revenue < 0) { alert('売上金額は0以上の数値で入力してください'); return }
    setSaleSaving(true)
    const { placeFee, companyFee, totalPay, basis, rate } = calcFees(revenue, app, saleTaxOv, saleDate)
    const { error } = await supabase.from('sales').insert({
      application_id: app.application_id, place_id: app.place_id, seller_id: app.seller_id,
      sale_date: saleDate, revenue, fee: companyFee, place_fee: placeFee, company_fee: companyFee, total_pay: totalPay,
      tax_basis: basis, tax_rate: rate
    })
    if (error) { alert('保存失敗: ' + error.message); setSaleSaving(false); return }
    setSaleAppId(''); setSaleDate(''); setSaleRevenue(''); setSaleSaving(false)
    loadSales()
  }

  const deleteSale = async (id: string) => {
    const { error } = await supabase.from('sales').delete().eq('id', id)
    if (error) { alert('削除失敗: ' + error.message); return }
    loadSales()
  }

  // ===== メッセージ（管理者）=====
  type MsgThread = { application_id: string, sellerName: string, placeTitle: string, lastBody: string, unread: number }
  type AdminMsg = { id: string, application_id: string, sender_id: string, body: string, sent_at: string, read_at?: string | null, file_url?: string | null }
  const [threads, setThreads] = useState<MsgThread[]>([])
  const [activeThread, setActiveThread] = useState<string | null>(null)
  const [threadMsgs, setThreadMsgs] = useState<AdminMsg[]>([])
  const [adminMsgInput, setAdminMsgInput] = useState('')
  const [adminMsgFile, setAdminMsgFile] = useState<File | null>(null)
  const [adminMsgUploading, setAdminMsgUploading] = useState(false)

  // 全スレッド（承認済み案件）を読み込む
  const loadThreads = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const uid = session?.user?.id || null
    setAdminUid(uid)
    const { data: apps } = await supabase
      .from('applications')
      .select('id, seller_id, places(title), profiles(name)')
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
    const { data: msgs } = await supabase
      .from('messages')
      .select('id, application_id, sender_id, body, sent_at, read_at, file_url')
      .order('sent_at', { ascending: true })
    const all = (msgs || []) as AdminMsg[]
    const list: MsgThread[] = (apps || []).map((a: any) => {
      const mine = all.filter(m => m.application_id === a.id)
      const last = mine.length > 0 ? mine[mine.length - 1].body : 'メッセージはまだありません'
      const unread = mine.filter(m => m.sender_id !== uid && !m.read_at).length
      return { application_id: a.id, sellerName: a.profiles?.name || '(出店者)', placeTitle: a.places?.title || '(案件名なし)', lastBody: last, unread }
    })
    setThreads(list)
  }

  // 選択スレッドのメッセージを読み込み、既読化する
  const openThread = async (appId: string) => {
    setActiveThread(appId)
    const { data: msgs } = await supabase
      .from('messages')
      .select('id, application_id, sender_id, body, sent_at, read_at, file_url')
      .eq('application_id', appId)
      .order('sent_at', { ascending: true })
    setThreadMsgs((msgs || []) as AdminMsg[])
    // 相手（出店者）からの未読を既読化
    if (adminUid) {
      await supabase.from('messages').update({ read_at: new Date().toISOString() })
        .eq('application_id', appId).neq('sender_id', adminUid).is('read_at', null)
    }
  }

  // 管理者として返信を送信
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

  const sendAdminMsg = async () => {
    if ((!adminMsgInput.trim() && !adminMsgFile) || !activeThread || !adminUid) return
    const body = adminMsgInput.trim()
    setAdminMsgUploading(true)
    let fileUrl: string | null = null
    if (adminMsgFile) {
      const rawExt = (adminMsgFile.name.split('.').pop() || '').toLowerCase()
      const ext = /^[a-z0-9]{1,5}$/.test(rawExt) ? rawExt : 'dat'
      const path = adminUid + '/msg-' + Date.now() + '.' + ext
      const up = await supabase.storage.from('message-attachments').upload(path, adminMsgFile, { upsert: true })
      if (up.error) { alert('添付に失敗しました: ' + up.error.message); setAdminMsgUploading(false); return }
      fileUrl = path
    }
    const { error } = await supabase.from('messages').insert({
      application_id: activeThread, sender_id: adminUid, body, file_url: fileUrl
    })
    if (error) { alert('送信失敗: ' + error.message); setAdminMsgUploading(false); return }
    setAdminMsgInput('')
    setAdminMsgFile(null)
    setAdminMsgUploading(false)
    // 相手へ新着メッセージ通知（失敗しても送信は成功扱い）
    try {
      await fetch('/api/notify/new-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId: activeThread, senderId: adminUid }),
      })
    } catch (e) {
      console.error('メッセージ通知に失敗しました', e)
    }
    openThread(activeThread)
    loadThreads()
  }

  // messagesタブを開いたら読み込む
  useEffect(() => { if (tab === 'messages' && authChecked) loadThreads() }, [tab, authChecked])

  // ===== レビュー審査（管理者）=====
  type AdminReview = { id: string, seller_id: string, reviewer_name: string | null, rating: number, comment: string | null, status: string, created_at: string, sellerName: string }
  // ===== 案件一覧（管理者・実データ） =====
  type AdminPlace = { id: string, title: string, host: string, area: string, type: string, applies: number, status: string, price_fixed: number, price_share_pct: number, place_fixed_unit: string, company_fixed_amount: number, company_fixed_unit: string, company_share_pct: number, share_tax_basis: string, share_tax_rate: number, fee: string, genres: string[] }
  const [placesList, setPlacesList] = useState<AdminPlace[]>([])
  const [placesLoading, setPlacesLoading] = useState(false)
  const [pKw, setPKw] = useState('')
  const [pPref, setPPref] = useState('')
  const [pGenre, setPGenre] = useState('')
  const [placeStatusFilter, setPlaceStatusFilter] = useState('')
  // 請求書の振込期限。既定は対象月の翌月末日で、請求書を開くときに引き渡す
  const [invoiceDue, setInvoiceDue] = useState('')
  const [placesPage, setPlacesPage] = useState(1)
  const loadPlacesList = async () => {
    setPlacesLoading(true)
    const { data } = await supabase
      .from('places')
      .select('id, title, prefecture, place_type, status, price_fixed, price_share_pct, place_fixed_unit, company_fixed_amount, company_fixed_unit, company_share_pct, share_tax_basis, share_tax_rate, fee, genres, profiles(name), applications(count)')
      .order('created_at', { ascending: false })
    const mapped: AdminPlace[] = (data || []).map((p: any) => ({
      id: p.id,
      title: p.title || '(無題)',
      host: p.profiles?.name || '(未設定)',
      area: p.prefecture || '-',
      type: p.place_type === 'event' ? 'イベント' : (p.place_type || '-'),
      applies: p.applications?.[0]?.count ?? 0,
      status: p.status === 'published' ? '公開中' : '下書き',
      price_fixed: p.price_fixed ?? 0, price_share_pct: p.price_share_pct ?? 0, place_fixed_unit: p.place_fixed_unit || 'per_day',
      share_tax_basis: p.share_tax_basis || 'as_entered', share_tax_rate: p.share_tax_rate ?? 8,
      company_fixed_amount: p.company_fixed_amount ?? 0, company_fixed_unit: p.company_fixed_unit || 'per_day', company_share_pct: p.company_share_pct ?? 0,
      fee: p.fee || '',
      genres: p.genres || [],
    }))
    setPlacesList(mapped)
    setPlacesLoading(false)
  }
  // 並び順。同じ系列（イオン、サンユーストアーなど）がまとまるよう
  // 名前順を既定にする。登録したばかりの案件を探したいときは新着順に切り替える。
  const [placesSort, setPlacesSort] = useState<'name' | 'new'>('name')

  const placesFiltered = placesList.filter(x => {
    if (pPref && x.area !== pPref) return false
    if (pGenre && !(x.genres || []).includes(pGenre)) return false
    if (placeStatusFilter && x.status !== placeStatusFilter) return false
    if (pKw) { const hay=((x.title||'')+(x.area||'')+(x.host||'')).toLowerCase(); if(!hay.includes(pKw.toLowerCase())) return false }
    return true
  }).slice().sort((a, b) => {
    // 新着順は読み込み時の順序（created_at の降順）をそのまま使う
    if (placesSort === 'new') return 0
    return compareByTitle(a.title, b.title)
  })
  const PLACES_PER_PAGE = 30
  const placesTotalPages = Math.max(1, Math.ceil(placesFiltered.length / PLACES_PER_PAGE))
  const placesPageSafe = Math.min(Math.max(1, placesPage), placesTotalPages)
  const placesPaged = placesFiltered.slice((placesPageSafe - 1) * PLACES_PER_PAGE, placesPageSafe * PLACES_PER_PAGE)
  useEffect(() => { setPlacesPage(1) }, [pKw, pPref, pGenre, placeStatusFilter])

  // ===== 料金設定モーダル =====
  const [feePlace, setFeePlace] = useState<AdminPlace | null>(null)
  const [feeForm, setFeeForm] = useState({ price_fixed: 0, price_share_pct: 0, place_fixed_unit: 'per_day', company_fixed_amount: 0, company_fixed_unit: 'per_day', company_share_pct: 0, share_tax_basis: 'as_entered', share_tax_rate: 8 })
  const [feeSaving, setFeeSaving] = useState(false)
  const [saleTaxOv, setSaleTaxOv] = useState('')
  const openFeeModal = (p: AdminPlace) => {
    setFeePlace(p)
    setFeeForm({ price_fixed: p.price_fixed || 0, price_share_pct: p.price_share_pct || 0, place_fixed_unit: p.place_fixed_unit || 'per_day', company_fixed_amount: p.company_fixed_amount || 0, company_fixed_unit: p.company_fixed_unit || 'per_day', company_share_pct: p.company_share_pct || 0, share_tax_basis: p.share_tax_basis || 'as_entered', share_tax_rate: p.share_tax_rate || 8 })
  }
  const saveFee = async () => {
    if (!feePlace) return
    setFeeSaving(true)
    // 権限で弾かれた場合、エラーは出ず0件更新になる。保存できたと誤解しないよう件数を確認する
    const { data: updated, error } = await supabase.from('places').update({
      price_fixed: feeForm.price_fixed, price_share_pct: feeForm.price_share_pct, place_fixed_unit: feeForm.place_fixed_unit,
      company_fixed_amount: feeForm.company_fixed_amount, company_fixed_unit: feeForm.company_fixed_unit, company_share_pct: feeForm.company_share_pct,
      share_tax_basis: feeForm.share_tax_basis, share_tax_rate: feeForm.share_tax_rate
    }).eq('id', feePlace.id).select('id')
    if (error) { alert('保存失敗: ' + error.message); setFeeSaving(false); return }
    if (!updated || updated.length === 0) {
      alert('保存できませんでした（更新権限をご確認ください）。金額は反映されていません。')
      setFeeSaving(false); return
    }
    setFeeSaving(false); setFeePlace(null); loadPlacesList()
  }
  const deletePlaceAdmin = async (id: string) => {
    const { data: removed, error } = await supabase.from('places').delete().eq('id', id).select('id')
    if (error) { alert('削除失敗: ' + error.message); return }
    if (!removed || removed.length === 0) { alert('削除できませんでした（権限をご確認ください）'); return }
    loadPlacesList()
  }
  // ブログの自動投稿を手動で1本試す（定期実行と同じ処理を呼ぶ）
  const [autoPosting, setAutoPosting] = useState(false)
  const runAutoPost = async () => {
    if (!window.confirm('AIが記事を1本作成し、そのまま公開します。よろしいですか？')) return
    setAutoPosting(true)
    try {
      // 定期実行と同じAPIを呼ぶ。管理者であることを確かめられるよう
      // ログイン中のアクセストークンを添えて呼ぶ。
      const { data: sess } = await supabase.auth.getSession()
      const res = await fetch('/api/cron/blog', {
        headers: { Authorization: 'Bearer ' + (sess.session?.access_token || '') },
      })
      const j = await res.json()
      if (!res.ok) { alert('作成できませんでした: ' + (j.error || '不明なエラー')) }
      else {
        alert('公開しました：' + (j.post?.title || '') + (j.hasImage ? '' : '\n※画像は生成できませんでした'))
        loadPosts()
      }
    } catch (e) {
      alert('作成できませんでした')
      console.error(e)
    }
    setAutoPosting(false)
  }

  // ===== 出店料の入金状況 =====
  type PayRow = {
    id: string, invoice_no: string, seller_id: string, sellerName: string, period: string,
    issued_on: string, due_on: string | null, total: number, paid_status: string,
    paid_on: string | null, paid_name: string | null,
    paid_reported_at: string | null, paid_confirmed_at: string | null, paid_memo: string | null,
  }
  const [payRows, setPayRows] = useState<PayRow[]>([])
  const [payLoading, setPayLoading] = useState(false)
  const [payBusy, setPayBusy] = useState('')

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

  const loadPayments = async () => {
    setPayLoading(true)
    try {
      const j = await callPayApi({ action: 'list' })
      setPayRows(j.items || [])
    } catch (e) {
      console.error('入金状況の取得に失敗', e)
    }
    setPayLoading(false)
  }

  // 入金を確認する／取り消す。確認したときだけ出店者へお礼のメールが届く。
  const confirmPayment = async (row: PayRow, undo: boolean) => {
    const msg = undo
      ? '「入金確認済み」を取り消します。よろしいですか？（出店者へのメールは送られません）'
      : row.sellerName + ' さんの ' + row.invoice_no + '（¥' + row.total.toLocaleString() + '）の入金を確認済みにします。\n出店者へ確認のお知らせメールが届きます。よろしいですか？'
    if (!window.confirm(msg)) return
    setPayBusy(row.id)
    try {
      await callPayApi({ action: 'confirm', invoiceId: row.id, undo })
      await loadPayments()
    } catch (e) {
      alert(e instanceof Error ? e.message : '更新に失敗しました')
    }
    setPayBusy('')
  }

  // 企業へ提出する売上報告のExcel。案件ごとに、報告された売上と
  // 品目ごとの販売食数をまとめて出す。
  const [repXlsxBusy, setRepXlsxBusy] = useState('')
  const [reportPlaces, setReportPlaces] = useState<{ placeId: string, title: string, count: number }[]>([])
  const downloadSalesReportXlsx = async (placeId: string, title: string) => {
    setRepXlsxBusy(placeId)
    try {
      const n = await exportPlaceSalesReport(supabase, placeId, title)
      if (n === 0) alert('この案件には、まだ売上の報告がありません')
    } catch (e) {
      alert(e instanceof Error ? e.message : '出力に失敗しました')
    }
    setRepXlsxBusy('')
  }

  // 請求書を削除する。テストで作ったものや、誤って発行したものの片付け用。
  // 売上（sales）は消さないので、必要ならあらためて発行し直せる。
  const deleteInvoice = async (row: PayRow) => {
    if (!window.confirm(
      row.invoice_no + '（' + row.sellerName + ' さん・¥' + row.total.toLocaleString() + '）の請求書を削除します。\n\n'
      + '・出店者の「お支払い」欄からも消えます\n'
      + '・売上の記録は残るので、必要なら発行し直せます\n'
      + '・すでに送信したメールは取り消せません\n\nよろしいですか？'
    )) return
    setPayBusy(row.id)
    try {
      await callPayApi({ action: 'delete', invoiceId: row.id })
      await loadPayments()
    } catch (e) {
      alert(e instanceof Error ? e.message : '削除に失敗しました')
    }
    setPayBusy('')
  }

  // 売上報告のリマインドを今すぐ送る（定期実行と同じ処理を呼ぶ）
  const [reminding, setReminding] = useState(false)
  const runSalesReminder = async () => {
    if (!window.confirm('出店日を過ぎても売上報告が無い出店者へ、催促メールを送ります。よろしいですか？\n※同じ出店については一度しか送られません。')) return
    setReminding(true)
    try {
      const { data: sess } = await supabase.auth.getSession()
      const res = await fetch('/api/cron/sales-reminder', {
        headers: { Authorization: 'Bearer ' + (sess.session?.access_token || '') },
      })
      const j = await res.json()
      if (!res.ok) alert('送信できませんでした: ' + (j.error || '不明なエラー'))
      else if (j.sent === 0) alert('送信対象はありませんでした（' + (j.note || '未報告なし') + '）')
      else alert(j.sent + '名の出店者へリマインドを送信しました')
    } catch (e) {
      alert('送信できませんでした')
      console.error(e)
    }
    setReminding(false)
  }

  // ===== 打ち合わせ希望（募集者からの相談） =====
  type MeetingReq = {
    id: string; name: string; company: string | null; email: string; phone: string | null
    method: string; preferred_dates: string | null; message: string | null
    status: string; admin_memo: string | null; created_at: string
  }
  const METHOD_LABEL: Record<string, string> = { zoom: 'Zoom希望', in_person: '直接お会いしたい', both: 'どちらでも可' }
  const MEET_STATUS: Record<string, { label: string, color: string, bg: string }> = {
    new: { label: '未対応', color: '#DC2626', bg: '#FEE2E2' },
    in_progress: { label: '対応中', color: '#92400E', bg: '#FEF3C7' },
    done: { label: '完了', color: '#16A34A', bg: '#ECFDF5' },
  }
  const [meetings, setMeetings] = useState<MeetingReq[]>([])
  const [meetingsLoading, setMeetingsLoading] = useState(false)
  const loadMeetings = async () => {
    setMeetingsLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setMeetingsLoading(false); return }
    const res = await fetch('/api/meeting-request', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'list', requesterId: user.id }),
    })
    const j = await res.json()
    setMeetings(res.ok ? (j.items || []) : [])
    setMeetingsLoading(false)
  }
  const setMeetingStatus = async (id: string, status: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const res = await fetch('/api/meeting-request', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'status', requesterId: user.id, id, status }),
    })
    const j = await res.json()
    if (!res.ok) { alert('更新できませんでした: ' + (j.error || '')); return }
    loadMeetings()
  }
  // 完了した相談を削除する（溜まってきたときの整理用）
  const deleteMeetings = async (ids: string[], label: string) => {
    if (ids.length === 0) return
    if (!window.confirm(label + '\nこの操作は取り消せません。よろしいですか？')) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const res = await fetch('/api/meeting-request', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete', requesterId: user.id, ids }),
    })
    const j = await res.json()
    if (!res.ok) { alert('削除できませんでした: ' + (j.error || '')); return }
    loadMeetings()
  }

  useEffect(() => { if (tab === 'meetings' && authChecked) loadMeetings() }, [tab, authChecked])

  // ===== 新規案件の登録 =====
  // places への INSERT はRLSで弾かれるおそれがあるため、承認処理と同じく
  // サービスロールのAPI経由で登録する。
  // 案件の公開／下書きを切り替える（RLS回避のためAPI経由）
  const setPlaceStatus = async (placeId: string, status: 'published' | 'draft') => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { alert('ログインが必要です'); return }
    const res = await fetch('/api/admin/set-place-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requesterId: user.id, placeId, status }),
    })
    const result = await res.json()
    if (!res.ok) { alert('変更に失敗しました: ' + (result.error || '不明なエラー')); return }
    loadPlacesList()
  }

  const npLabel: React.CSSProperties = { fontSize: '11px', fontWeight: 700, color: '#64748B', display: 'block', marginBottom: '4px' }
  const npInput: React.CSSProperties = { width: '100%', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', color: '#1a1a1a' }
  const emptyNewPlace = {
    title: '', host_id: '', prefecture: '', address: '', place_type: 'event',
    open_days: '', open_time: '', close_time: '', fee: '', max_slots: '',
    description: '', genres: [] as string[],
  }
  const [npForm, setNpForm] = useState(emptyNewPlace)
  const [npFile, setNpFile] = useState<File | null>(null)
  const [npSaving, setNpSaving] = useState(false)
  const [hostOptions, setHostOptions] = useState<{ id: string, label: string }[]>([])

  const loadHostOptions = async () => {
    const { data } = await supabase.from('profiles').select('id, name, shop_name').eq('role', 'host').order('shop_name')
    setHostOptions((data || []).map(h => ({ id: h.id, label: h.shop_name || h.name || '(名称未設定)' })))
  }
  useEffect(() => { loadHostOptions() }, [])

  const toggleNpGenre = (g: string) => {
    setNpForm(f => ({ ...f, genres: f.genres.includes(g) ? f.genres.filter(x => x !== g) : [...f.genres, g] }))
  }

  const saveNewPlace = async (status: 'published' | 'draft') => {
    if (!npForm.title.trim()) { alert('案件タイトルを入力してください'); return }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { alert('ログインが必要です'); return }
    setNpSaving(true)

    // 画像は先にストレージへ上げてURLを作る
    let imageUrl: string | null = null
    if (npFile) {
      const rawExt = (npFile.name.split('.').pop() || '').toLowerCase()
      const ext = /^[a-z0-9]{1,5}$/.test(rawExt) ? rawExt : 'jpg'
      const path = 'admin/' + Date.now() + '.' + ext
      const up = await supabase.storage.from('place-images').upload(path, npFile, { upsert: true })
      if (up.error) { alert('画像のアップロードに失敗しました: ' + up.error.message); setNpSaving(false); return }
      imageUrl = supabase.storage.from('place-images').getPublicUrl(path).data.publicUrl
    }

    // 地図に出すため住所から座標を取る（取れなくても登録は続行する）
    let latitude: number | null = null, longitude: number | null = null
    if (npForm.prefecture || npForm.address) {
      try {
        const geo = await geocodeAddress((npForm.prefecture || '') + (npForm.address || ''))
        if (geo) { latitude = geo.lat; longitude = geo.lon }
      } catch (e) { console.error('座標の取得に失敗しました', e) }
    }

    const res = await fetch('/api/admin/create-place', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requesterId: user.id,
        place: {
          ...npForm,
          host_id: npForm.host_id || null,
          max_slots: npForm.max_slots,
          open_days: npForm.open_days.trim() ? [npForm.open_days.trim()] : [],
          image_url: imageUrl, latitude, longitude, status,
        },
      }),
    })
    const result = await res.json()
    setNpSaving(false)
    if (!res.ok) { alert('登録に失敗しました: ' + (result.error || '不明なエラー')); return }
    alert(status === 'published' ? '案件を公開しました' : '下書きとして保存しました')
    setNpForm(emptyNewPlace); setNpFile(null); setShowNewPlace(false)
    loadPlacesList()
  }

  const deleteSellerAdmin = async (id: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { alert('ログインが必要です'); return }
    const res = await fetch('/api/admin/delete-seller', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, requesterId: user.id }),
    })
    const result = await res.json()
    if (!res.ok) { alert('削除失敗: ' + (result.error || '不明なエラー')); return }
    loadSellersList()
  }

  const [reviewList, setReviewList] = useState<AdminReview[]>([])
  const [reviewsLoading, setReviewsLoading] = useState(false)

  // ===== 公開申請の承認（管理者）=====
  type PubReq = { id: string, name: string | null, shop_name: string | null, genre: string | null, areas: string[] | null, approval_status: string, submitted_at: string | null }
  const [pubReqs, setPubReqs] = useState<PubReq[]>([])
  const [pubLoading, setPubLoading] = useState(false)
  const loadPubReqs = async () => {
    setPubLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('id, name, shop_name, genre, areas, approval_status, submitted_at')
      .eq('role', 'seller')
      .in('approval_status', ['pending', 'rejected'])
      .order('submitted_at', { ascending: true })
    setPubReqs((data || []) as PubReq[])
    setPubLoading(false)
  }
  // profiles には管理者用の UPDATE ポリシーが無く、クライアントから直接更新すると
  // RLS に無言で弾かれる（エラーも出ず0件更新になる）ため、サービスロールのAPI経由で更新する
  const setApproval = async (id: string, status: 'approved' | 'rejected') => {
    if (!adminUid) { alert('認証情報がありません。再ログインしてください'); return }
    try {
      const res = await fetch('/api/admin/set-approval', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requesterId: adminUid, targetId: id, status }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { alert('更新失敗: ' + (json.error || res.status)); return }
    } catch (e) {
      alert('通信エラーが発生しました'); return
    }
    loadPubReqs()
  }

  const loadReviewList = async () => {
    setReviewsLoading(true)
    const { data } = await supabase
      .from('reviews')
      .select('id, seller_id, reviewer_name, rating, comment, status, created_at, profiles!reviews_seller_id_fkey(name, shop_name)')
      .order('created_at', { ascending: false })
    const mapped: AdminReview[] = (data || []).map((r: any) => ({
      id: r.id, seller_id: r.seller_id, reviewer_name: r.reviewer_name, rating: r.rating,
      comment: r.comment, status: r.status, created_at: r.created_at,
      sellerName: r.profiles?.shop_name || r.profiles?.name || '(出店者)'
    }))
    setReviewList(mapped)
    setReviewsLoading(false)
  }

  const setReviewStatus = async (id: string, status: string) => {
    const { error } = await supabase.from('reviews').update({ status }).eq('id', id)
    if (error) { alert('更新失敗: ' + error.message); return }
    loadReviewList()
  }

  // 施設側に渡す情報も含めて出店者の内容を持つ
  type PendingApp = {
    id: string; apply_date: string | null; format: string | null
    sellerName: string; placeTitle: string; placeId: string; sellerId: string
    repName: string; email: string; phone: string; address: string
    genre: string; areas: string; salesType: string; vehicleType: string
    size: string; equipment: string; menu: string; bio: string
    docsOk: number; docsTotal: number
  }
  const [pendingApps, setPendingApps] = useState<PendingApp[]>([])
  const [pendingLoading, setPendingLoading] = useState(false)
  // 施設へ提出するExcel用。承認済みの申込がある案件の一覧。
  const [approvedPlaces, setApprovedPlaces] = useState<{ placeId: string, title: string, count: number }[]>([])
  const [submitXlsxBusy, setSubmitXlsxBusy] = useState('')
  const loadPendingApps = async () => {
    setPendingLoading(true)
    const { data } = await supabase
      .from('applications')
      .select('id, apply_date, format, status, seller_id, place_id, profiles!applications_seller_id_fkey(name, shop_name, email, phone, address, genre, areas, sales_type, vehicle_type, size_length, size_width, size_height, equipment, menu, bio), places(title)')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })

    // 書類の提出状況（承認済みが何件か）もあわせて出す
    const sellerIds = Array.from(new Set((data || []).map((a: any) => a.seller_id).filter(Boolean)))
    const docCount = new Map<string, { ok: number, total: number }>()
    if (sellerIds.length > 0) {
      const { data: docs } = await supabase
        .from('seller_documents').select('seller_id, status').in('seller_id', sellerIds)
      for (const d of docs || []) {
        const cur = docCount.get(d.seller_id) || { ok: 0, total: 0 }
        cur.total += 1
        if (d.status === 'approved') cur.ok += 1
        docCount.set(d.seller_id, cur)
      }
    }

    const mapped: PendingApp[] = (data || []).map((a: any) => {
      const p = a.profiles || {}
      const size = formatVehicleSize(p.size_length, p.size_width, p.size_height)
      const dc = docCount.get(a.seller_id) || { ok: 0, total: 0 }
      return {
        id: a.id, apply_date: a.apply_date, format: a.format,
        sellerName: p.shop_name || p.name || '(出店者)',
        placeTitle: a.places?.title || '(案件)',
        placeId: a.place_id || '',
        sellerId: a.seller_id || '',
        repName: p.name || '', email: p.email || '', phone: p.phone || '', address: p.address || '',
        genre: genreText(p.genre), areas: Array.isArray(p.areas) ? p.areas.join('・') : (p.areas || ''),
        salesType: p.sales_type || '', vehicleType: p.vehicle_type || '',
        size, equipment: p.equipment || '', menu: p.menu || '', bio: p.bio || '',
        docsOk: dc.ok, docsTotal: dc.total,
      }
    })
    setPendingApps(mapped)
    setPendingLoading(false)

    // 承認済みの申込を案件ごとに数え、提出用Excelのボタンを出す
    const { data: approved } = await supabase
      .from('applications')
      .select('place_id, places(title)')
      .eq('status', 'approved')
      .not('apply_date', 'is', null)
    const byPlace = new Map<string, { placeId: string, title: string, count: number }>()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const a of (approved || []) as any[]) {
      if (!a.place_id) continue
      const cur = byPlace.get(a.place_id) || { placeId: a.place_id, title: a.places?.title || '(案件)', count: 0 }
      cur.count += 1
      byPlace.set(a.place_id, cur)
    }
    setApprovedPlaces([...byPlace.values()].sort((x, y) => x.title.localeCompare(y.title, 'ja')))
  }

  // 施設・企業へ提出する「出店者情報」Excel（承認済みの出店者を日付ごとのシートに載せる）
  const downloadSubmitXlsx = async (placeId: string, title: string) => {
    setSubmitXlsxBusy(placeId)
    try {
      const n = await exportPlaceSubmission(supabase, placeId, title)
      if (n === 0) alert('この案件には、出店日が入った承認済みの申込がまだありません')
    } catch (e) {
      alert(e instanceof Error ? e.message : '出力に失敗しました')
    }
    setSubmitXlsxBusy('')
  }
  // 施設側に渡すための一覧をExcelで開ける形（CSV・Shift-JIS互換のBOM付きUTF-8）で書き出す
  const exportPendingCsv = (rows: PendingApp[], label: string) => {
    if (rows.length === 0) { alert('出力する応募がありません'); return }
    const cols: [string, (a: PendingApp) => string][] = [
      ['案件名', a => a.placeTitle],
      ['出店希望日', a => a.apply_date || ''],
      ['出店形態', a => a.format || ''],
      ['店舗名', a => a.sellerName],
      ['代表者名', a => a.repName],
      ['メールアドレス', a => a.email],
      ['電話番号', a => a.phone],
      ['住所', a => a.address],
      ['ジャンル', a => a.genre],
      ['活動エリア', a => a.areas],
      ['販売形態', a => a.salesType],
      ['車種', a => a.vehicleType],
      ['車両サイズ', a => a.size],
      ['設備', a => a.equipment],
      ['メニュー', a => a.menu],
      ['紹介文', a => a.bio],
      ['書類提出状況', a => a.docsTotal > 0 ? `${a.docsOk}/${a.docsTotal}件 承認済` : '未提出'],
    ]
    const esc = (v: string) => '"' + String(v ?? '').replace(/"/g, '""') + '"'
    const csv = [cols.map(c => esc(c[0])).join(',')]
      .concat(rows.map(r => cols.map(c => esc(c[1](r))).join(',')))
      .join('\r\n')
    // Excelで開いたときに日本語が化けないようBOMを付ける
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `社内確認用_出店申込一覧_${label}_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const setAppStatus = async (id: string, status: string) => {
    const { error } = await supabase.from('applications').update({ status }).eq('id', id)
    if (error) { alert('更新失敗: ' + error.message); return }
    try {
      await fetch('/api/notify/application-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ applicationId: id, status }),
      })
    } catch {}
    loadPendingApps()
  }

  // reviewsタブを開いたら読み込む
  useEffect(() => { if (tab === 'reviews' && authChecked) loadReviewList() }, [tab, authChecked])
  useEffect(() => { if (tab === 'applications' && authChecked) loadPendingApps() }, [tab, authChecked])
  useEffect(() => { if (tab === 'publish' && authChecked) loadPubReqs() }, [tab, authChecked])
  useEffect(() => { if (tab === 'blog' && authChecked) loadPosts() }, [tab, authChecked])
  useEffect(() => { if (tab === 'places' && authChecked) loadPlacesList() }, [tab, authChecked])
  useEffect(() => { if ((tab === 'sellers' || tab === 'dashboard') && authChecked) loadSellersList() }, [tab, authChecked])
  useEffect(() => { if (tab === 'dashboard' && authChecked) loadStats() }, [tab, authChecked])
  type ImportedSeller = { id: string, reg_no: number | null, registered_at: string | null, shop_name: string | null, rep_name: string | null, email: string | null, address: string | null, phone: string | null, area: string | null, genre: string | null }
  const [imported, setImported] = useState<ImportedSeller[]>([])
  const [importedLoading, setImportedLoading] = useState(false)
  const [importedTotal, setImportedTotal] = useState(0)
  const [importedKw, setImportedKw] = useState('')
  const [importedPage, setImportedPage] = useState(0)
  const IMPORTED_PER_PAGE = 20
  const loadImported = async () => {
    setImportedLoading(true)
    const from = importedPage * IMPORTED_PER_PAGE
    const to = from + IMPORTED_PER_PAGE - 1
    let q = supabase.from('imported_sellers').select('id, reg_no, registered_at, shop_name, rep_name, email, address, phone, area, genre', { count: 'exact' })
    const kw = importedKw.trim()
    if (kw) { q = q.or('shop_name.ilike.%' + kw + '%,rep_name.ilike.%' + kw + '%,email.ilike.%' + kw + '%') }
    const { data, count } = await q.order('reg_no', { ascending: false }).range(from, to)
    setImported((data || []) as ImportedSeller[])
    setImportedTotal(count || 0)
    setImportedLoading(false)
  }
  useEffect(() => { if (tab === 'imported' && authChecked) loadImported() }, [tab, authChecked, importedPage])



  // salesタブを開いたら読み込む
  useEffect(() => { if (tab === 'sales' && authChecked) { loadApprovedApps(); loadSales(); loadPayments() } }, [tab, authChecked])
  useEffect(() => { if (tab === 'sales' && authChecked) loadSales() }, [saleMonth])
  useEffect(() => {
    if (!/^\d{4}-\d{2}$/.test(saleMonth)) return
    const [y, m] = saleMonth.split('-').map(Number)
    const d = new Date(y, m + 1, 0)   // 翌月末日
    setInvoiceDue(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
  }, [saleMonth])

  // 書類プレビュー用モーダルの状態（横向き画像対応）
  const [previewImg, setPreviewImg] = useState<string | null>(null);
  const [previewRotation, setPreviewRotation] = useState(0);

  // 書類のプレビュー（署名付きURLを新規タブで開く）
const previewDoc = async (fileUrl: string) => {
    const { data, error } = await supabase.storage.from('seller-documents').createSignedUrl(fileUrl, 60)
    if (error || !data) { alert('プレビューURLの生成に失敗しました: ' + (error?.message || '')); return }
    const isPdf = /\.pdf(\?|$)/i.test(fileUrl)
    if (isPdf) {
      window.open(data.signedUrl, '_blank')
    } else {
      setPreviewRotation(0)
      setPreviewImg(data.signedUrl)
    }
  }
  // 承認/否認
  const reviewDoc = async (id: string, status: 'approved' | 'rejected', reason?: string) => {
    const patch: { status: string; reject_reason?: string | null } = { status }
    if (status === 'rejected') patch.reject_reason = reason || null
    if (status === 'approved') patch.reject_reason = null
    const { error } = await supabase.from('seller_documents').update(patch).eq('id', id)
    if (error) { alert('更新失敗: ' + error.message); return }
    loadDocReviews()
  }

  type RecentApp = { id: string, name: string, place: string, date: string, status: string }
  const [statCounts, setStatCounts] = useState({ sellers: 0, hosts: 0, places: 0, monthApps: 0, gmv: 0, fee: 0, totalApps: 0, approvedApps: 0 })
  const [recentApps, setRecentApps] = useState<RecentApp[]>([])
  const loadStats = async () => {
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0)
    const sellerRes = await supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'seller')
    const hostRes = await supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'host')
    const placeRes = await supabase.from('places').select('id', { count: 'exact', head: true })
    const monthRes = await supabase.from('applications').select('id', { count: 'exact', head: true }).gte('apply_date', monthStart.toISOString())
    const salesRes = await supabase.from('sales').select('revenue, fee')
    const gmv = (salesRes.data || []).reduce((sum: number, s: any) => sum + (s.revenue || 0), 0)
    const feeTotal = (salesRes.data || []).reduce((sum: number, s: any) => sum + (s.fee || 0), 0)
    const totalAppsRes = await supabase.from('applications').select('id', { count: 'exact', head: true })
    const approvedAppsRes = await supabase.from('applications').select('id', { count: 'exact', head: true }).eq('status', 'approved')
    setStatCounts({ sellers: sellerRes.count || 0, hosts: hostRes.count || 0, places: placeRes.count || 0, monthApps: monthRes.count || 0, gmv, fee: feeTotal, totalApps: totalAppsRes.count || 0, approvedApps: approvedAppsRes.count || 0 })
    const { data: apps } = await supabase.from('applications').select('id, status, apply_date, places(title), profiles(name)').order('apply_date', { ascending: false }).limit(3)
    const statusJa = (s: string) => s === 'approved' ? '承認済' : s === 'rejected' ? '否認' : '審査中'
    setRecentApps((apps || []).map((a: any) => ({ id: a.id, name: a.profiles?.name || '(出店者)', place: a.places?.title || '(案件名なし)', date: a.apply_date ? new Date(a.apply_date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' }) : '', status: statusJa(a.status) })))
  }
  const stats = [
    { label: '総出店者数', value: statCounts.sellers.toLocaleString(), color: '#F5A623' },
    { label: '総募集者数', value: statCounts.hosts.toLocaleString(), color: '#3A9BD5' },
    { label: '掲載案件数', value: statCounts.places.toLocaleString(), color: '#16A34A' },
    { label: '今月の申込', value: statCounts.monthApps.toLocaleString(), color: '#7C3AED' },
    { label: '累計GMV', value: '¥' + statCounts.gmv.toLocaleString(), color: '#DC2626' },
    { label: '手数料収入', value: '¥' + statCounts.fee.toLocaleString(), color: '#0891B2' },
    { label: '成約率', value: statCounts.totalApps > 0 ? Math.round(statCounts.approvedApps / statCounts.totalApps * 100) + '%' : '—', color: '#65A30D' },
  ]

  const handleCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const buf = ev.target?.result as ArrayBuffer
      let text = new TextDecoder('utf-8').decode(buf)
      if (text.includes('\uFFFD')) { try { text = new TextDecoder('shift-jis').decode(buf) } catch (err) {} }
      const rows = text.split(/\r?\n/).filter(r => r.trim()).map(r => r.split(',').map(c => c.trim().replace(/^"|"$/g, '')))
      setCsvPreview(rows)
      setCsvImported(false)
    }
    reader.readAsArrayBuffer(file)
  }

  const importCSV = () => {
    const newSellers = csvPreview.slice(1).map((row, i) => ({
      id: String(sellers.length + i + 1),
      name: row[0] || '',
      shop: row[1] || '',
      email: row[2] || '',
      phone: row[3] || '',
      genre: row[4] || '',
      area: row[5] || '',
      sns: row[6] || '',
      status: '審査中',
      docs: '未提出',
    }))
    setSellers(prev => [...prev, ...newSellers])
    setCsvImported(true)
  }

  if (!authChecked) {
    return (
      <div style={{ minHeight: '100vh', background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748B', fontSize: '14px' }}>読み込み中...</div>
    )
  }

  return (
    <div className='admin-shell' style={{ minHeight: '100vh', background: '#F1F5F9', display: 'flex' }}>
      {/* サイドバー */}
      <div className='admin-sidebar' style={{ width: '220px', background: '#1E2A3B', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        <div className='admin-sidebar-head' style={{ padding: '16px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          <div style={{ background: '#F5A623', color: '#fff', fontWeight: '900', fontSize: '12px', padding: '3px 7px', borderRadius: '4px', display: 'inline-block', marginBottom: '4px' }}>出店</div>
          <div style={{ fontSize: '14px', fontWeight: '700', color: '#fff' }}>コネクトナビ</div>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>管理者ダッシュボード</div>
        </div>
        <nav className='admin-sidebar-nav' style={{ padding: '8px 0', flex: 1 }}>
          {[
            { key: 'dashboard', label: 'ダッシュボード' },
            { key: 'places', label: '案件管理' },
            { key: 'sellers', label: '出店者管理' },
            { key: 'docs', label: '書類審査' },
            { key: 'sales', label: '売上管理' },
            { key: 'messages', label: 'メッセージ' },
            { key: 'reviews', label: 'レビュー審査' },
            { key: 'applications', label: '出店承認' },
            { key: 'meetings', label: '打ち合わせ希望' },
            { key: 'publish', label: '公開申請' },
            { key: 'blog', label: 'ブログ' },
            { key: 'csv', label: 'CSVインポート' },
            { key: 'imported', label: 'インポート名簿' },
          ].map((item) => (
            <div
              key={item.key}
              onClick={() => { const k = item.key as typeof tab; setTab(k); try { localStorage.setItem('adminTab', k) } catch {} }}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', cursor: 'pointer',
                color: tab === item.key ? '#fff' : 'rgba(255,255,255,0.6)',
                background: tab === item.key ? 'rgba(255,255,255,0.1)' : 'transparent',
                borderLeft: tab === item.key ? '3px solid #F5A623' : '3px solid transparent',
                fontSize: '13px', fontWeight: tab === item.key ? '700' : '400',
              }}
            >
              <span>{item.label}</span>
            </div>
          ))}
        </nav>
        <div className='admin-sidebar-back' style={{ padding: '12px 14px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
          <button onClick={async () => { await supabase.auth.signOut(); router.push('/login') }} style={{ width: '100%', background: 'transparent', color: '#F5A623', border: '1px solid #F5A623', borderRadius: '6px', padding: '8px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>ログアウト</button>
        </div>
      </div>

      {/* メイン */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* トップバー */}
        <div style={{ background: '#fff', borderBottom: '1px solid #E2E8F0', padding: '0 24px', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: '700', fontSize: '15px' }}>
            {tab === 'dashboard' && 'ダッシュボード'}
            {tab === 'places' && '案件管理'}
            {tab === 'sellers' && '出店者管理'}
            {tab === 'csv' && 'CSVインポート'}
            {tab === 'docs' && '書類審査'}
            {tab === 'sales' && '売上管理'}
            {tab === 'messages' && 'メッセージ'}
            {tab === 'reviews' && 'レビュー審査'}
            {tab === 'applications' && '出店承認'}
            {tab === 'meetings' && '打ち合わせ希望'}
            {tab === 'publish' && '公開申請'}
            {tab === 'blog' && 'ブログ記事管理'}
            {tab === 'imported' && 'インポート名簿'}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#FFF8E1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', color: '#B45309', fontSize: '12px' }}>管</div>
          </div>
        </div>

        <div style={{ padding: '24px', flex: 1, overflowY: 'auto' }}>

          {/* ===== ダッシュボード ===== */}
          {tab === 'dashboard' && (
            <>
              <div className='admin-stats' style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '14px', marginBottom: '20px' }}>
                {stats.map(s => (
                  <div key={s.label} style={{ background: '#fff', borderRadius: '12px', padding: '18px', border: '1px solid #E2E8F0' }}>
                    <div style={{ marginBottom: '10px' }}>
                      <div style={{ fontSize: '12px', color: '#64748B' }}>{s.label}</div>
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: '900', color: s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>

              <div className='admin-two-col' style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                  <div style={{ padding: '14px 18px', borderBottom: '1px solid #E2E8F0', fontWeight: '700', fontSize: '14px' }}>最新の申込</div>
                  <div style={{ padding: '0' }}>
                    {recentApps.length === 0 && (<div style={{ padding: '20px 18px', color: '#999', fontSize: '13px' }}>申込はまだありません。</div>)}
                    {recentApps.map((a, i) => (
                      <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 18px', borderBottom: '1px solid #F1F5F9' }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#FFF8E1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700', color: '#B45309', flexShrink: 0 }}>{a.name[0]}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '12px', fontWeight: '600' }}>{a.name}</div>
                          <div style={{ fontSize: '11px', color: '#64748B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.place} / {a.date}</div>
                        </div>
                        <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px', background: a.status === '承認済' ? '#ECFDF5' : '#FEF3C7', color: a.status === '承認済' ? '#16A34A' : '#92400E', flexShrink: 0 }}>{a.status}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                  <div style={{ padding: '14px 18px', borderBottom: '1px solid #E2E8F0', fontWeight: '700', fontSize: '14px' }}>最新の登録者</div>
                  <div>
                    {sellers.slice(0, 4).map((s, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 18px', borderBottom: '1px solid #F1F5F9' }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#EBF6FD', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700', color: '#1D4ED8', flexShrink: 0 }}>{s.name[0]}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '12px', fontWeight: '600' }}>{s.name}</div>
                          <div style={{ fontSize: '11px', color: '#64748B' }}>{s.genre} / {s.area}</div>
                        </div>
                        <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 8px', borderRadius: '20px', background: s.status === '承認済' ? '#ECFDF5' : '#FEF3C7', color: s.status === '承認済' ? '#16A34A' : '#92400E', flexShrink: 0 }}>{s.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ===== 案件管理 ===== */}
          {tab === 'places' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '8px', flex: 1, minWidth: 0 }}>
                  <input type="text" placeholder="案件名・エリアで検索" style={{ border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', outline: 'none', flex: 1, minWidth: 0 }} />
                  <select style={{ border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', outline: 'none' }}>
                    <option>すべてのステータス</option>
                    <option>公開中</option>
                    <option>下書き</option>
                  </select>
                </div>
                <button onClick={() => setShowNewPlace(true)} style={{ background: '#F5A623', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 18px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                  ＋ 新規案件を作成
                </button>
              </div>

              {showNewPlace && (
                <div style={{ background: '#fff', borderRadius: '12px', border: '2px solid #F5A623', padding: '20px', marginBottom: '16px' }}>
                  <div style={{ fontWeight: '700', fontSize: '14px', marginBottom: '14px', color: '#B45309' }}>新規案件作成</div>
                  <div className='admin-newplace-grid' style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={npLabel}>案件タイトル <span style={{ color: '#DC2626' }}>*</span></label>
                      <input value={npForm.title} onChange={e => setNpForm({ ...npForm, title: e.target.value })} placeholder='例：美食EXPO in 熊本' style={npInput} />
                    </div>
                    <div>
                      <label style={npLabel}>募集者（オーナー）</label>
                      <select value={npForm.host_id} onChange={e => setNpForm({ ...npForm, host_id: e.target.value })} style={{ ...npInput, background: '#fff' }}>
                        <option value=''>指定しない（運営が直接募集）</option>
                        {hostOptions.map(h => <option key={h.id} value={h.id}>{h.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={npLabel}>種別</label>
                      <select value={npForm.place_type} onChange={e => setNpForm({ ...npForm, place_type: e.target.value })} style={{ ...npInput, background: '#fff' }}>
                        <option value='event'>イベント</option>
                        <option value='regular'>常設</option>
                      </select>
                    </div>
                    <div>
                      <label style={npLabel}>都道府県</label>
                      <input value={npForm.prefecture} onChange={e => setNpForm({ ...npForm, prefecture: e.target.value })} placeholder='例：熊本県' style={npInput} />
                    </div>
                    <div>
                      <label style={npLabel}>住所（地図に使います）</label>
                      <input value={npForm.address} onChange={e => setNpForm({ ...npForm, address: e.target.value })} placeholder='例：熊本市中央区花畑町1-1' style={npInput} />
                    </div>
                    <div>
                      <label style={npLabel}>日程</label>
                      <input value={npForm.open_days} onChange={e => setNpForm({ ...npForm, open_days: e.target.value })} placeholder='例：9/12（金）〜9/14（日）' style={npInput} />
                    </div>
                    <div>
                      <label style={npLabel}>時間</label>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <input value={npForm.open_time} onChange={e => setNpForm({ ...npForm, open_time: e.target.value })} placeholder='10:00' style={npInput} />
                        <span style={{ color: '#64748B' }}>〜</span>
                        <input value={npForm.close_time} onChange={e => setNpForm({ ...npForm, close_time: e.target.value })} placeholder='17:00' style={npInput} />
                      </div>
                    </div>
                    <div>
                      <label style={npLabel}>出店料（表示用の文言）</label>
                      <input value={npForm.fee} onChange={e => setNpForm({ ...npForm, fee: e.target.value })} placeholder='例：3日間で6万円（税込66,000円）' style={npInput} />
                    </div>
                    <div>
                      <label style={npLabel}>最大枠数</label>
                      <input type='number' value={npForm.max_slots} onChange={e => setNpForm({ ...npForm, max_slots: e.target.value })} placeholder='例：5' style={npInput} />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={npLabel}>カテゴリー（複数選択できます）</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {PLACE_CATEGORIES.map(g => {
                          const on = npForm.genres.includes(g)
                          return (
                            <label key={g} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', border: on ? '1.5px solid #F5A623' : '1.5px solid #E2E8F0', background: on ? '#FFF8EC' : '#fff', borderRadius: '999px', padding: '5px 11px', fontSize: '12px', cursor: 'pointer', color: '#1a1a1a' }}>
                              <input type='checkbox' checked={on} onChange={() => toggleNpGenre(g)} style={{ accentColor: '#F5A623', cursor: 'pointer' }} />
                              {g}
                            </label>
                          )
                        })}
                      </div>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={npLabel}>募集内容・詳細</label>
                      <textarea value={npForm.description} onChange={e => setNpForm({ ...npForm, description: e.target.value })} style={{ ...npInput, resize: 'vertical', minHeight: '80px', fontFamily: 'inherit' }} placeholder='募集内容を詳しく入力してください' />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={npLabel}>案件画像</label>
                      <input type='file' accept='image/*' onChange={e => setNpFile(e.target.files?.[0] || null)} style={{ fontSize: '13px' }} />
                      {npFile && <span style={{ fontSize: '12px', color: '#B45309', marginLeft: '8px' }}>{npFile.name}</span>}
                    </div>
                  </div>
                  <div style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '10px', lineHeight: 1.7 }}>
                    手数料（日額固定・売上歩合）は登録後、一覧の「手数料設定」から設定してください。消費税は税抜換算8%が既定です。
                  </div>
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <button disabled={npSaving} onClick={() => { setNpForm(emptyNewPlace); setNpFile(null); setShowNewPlace(false) }} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '9px 18px', fontSize: '13px', cursor: 'pointer' }}>キャンセル</button>
                    <button disabled={npSaving} onClick={() => saveNewPlace('draft')} style={{ background: npSaving ? '#ccc' : '#F5A623', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '13px', fontWeight: '700', cursor: npSaving ? 'not-allowed' : 'pointer' }}>{npSaving ? '保存中...' : '下書き保存'}</button>
                    <button disabled={npSaving} onClick={() => saveNewPlace('published')} style={{ background: npSaving ? '#ccc' : '#16A34A', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '13px', fontWeight: '700', cursor: npSaving ? 'not-allowed' : 'pointer' }}>{npSaving ? '保存中...' : '公開する'}</button>
                  </div>
                </div>
              )}

              <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', alignItems:'center', marginBottom:'12px' }}>
                <input value={pKw} onChange={e=>setPKw(e.target.value)} placeholder='案件名・オーナー・エリアで検索' style={{ flex:'1 1 220px', padding:'9px 12px', borderRadius:'8px', border:'1.5px solid #E2E8F0', fontSize:'13px' }} />
                <select value={pPref} onChange={e=>setPPref(e.target.value)} style={{ padding:'9px 12px', borderRadius:'8px', border:'1.5px solid #E2E8F0', fontSize:'13px', minWidth:'130px' }}>
                  <option value=''>都道府県（すべて）</option>
                  {Array.from(new Set(placesList.map(x=>x.area).filter(a=>a&&a!=='-'))).map(a=><option key={a} value={a}>{a}</option>)}
                </select>
                <select value={pGenre} onChange={e=>setPGenre(e.target.value)} style={{ padding:'9px 12px', borderRadius:'8px', border:'1.5px solid #E2E8F0', fontSize:'13px', minWidth:'130px' }}>
                  <option value=''>カテゴリー（すべて）</option>
                  {PLACE_CATEGORIES.map(g=><option key={g} value={g}>{g}</option>)}
                </select>
                <select value={placeStatusFilter} onChange={e=>setPlaceStatusFilter(e.target.value)} style={{ padding:'9px 12px', borderRadius:'8px', border:'1.5px solid #E2E8F0', fontSize:'13px', minWidth:'120px' }}>
                  <option value=''>状態（すべて）</option>
                  <option value='公開中'>公開中</option>
                  <option value='下書き'>下書き</option>
                </select>
                <select value={placesSort} onChange={e=>setPlacesSort(e.target.value as 'name' | 'new')} style={{ padding:'9px 12px', borderRadius:'8px', border:'1.5px solid #E2E8F0', fontSize:'13px', minWidth:'130px' }}>
                  <option value='name'>名前順（系列でまとまる）</option>
                  <option value='new'>新着順</option>
                </select>
                {(pKw||pPref||pGenre||placeStatusFilter) && <button onClick={()=>{setPKw('');setPPref('');setPGenre('');setPlaceStatusFilter('')}} style={{ padding:'9px 14px', borderRadius:'8px', border:'1.5px solid #E2E8F0', background:'#fff', fontSize:'13px', cursor:'pointer', color:'#64748B' }}>クリア</button>}
                <span style={{ fontSize:'12px', color:'#64748B' }}>{placesFiltered.length}件</span>
              </div>
              <div className='admin-table-wrap' style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC' }}>
                      {['案件タイトル', 'オーナー', 'エリア', '出店形態', '申込数', 'ステータス', '操作'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', color: '#64748B', fontWeight: '600', borderBottom: '1px solid #E2E8F0' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {placesLoading && (<tr><td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: '#999' }}>読み込み中...</td></tr>)}
                    {!placesLoading && placesFiltered.length === 0 && (<tr><td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: '#999' }}>案件がありません。</td></tr>)}
                    {placesPaged.map((place, i) => (
                      <tr key={place.id} style={{ borderBottom: i < placesPaged.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                        <td style={{ padding: '12px 14px', fontWeight: '600' }}>{place.title}</td>
                        <td style={{ padding: '12px 14px', color: '#64748B', fontSize: '12px' }}>{place.host}</td>
                        <td style={{ padding: '12px 14px', color: '#64748B', fontSize: '12px' }}>{place.area}</td>
                        <td style={{ padding: '12px 14px', color: '#64748B', fontSize: '12px' }}>{place.type}</td>
                        <td style={{ padding: '12px 14px' }}><span style={{ background: '#EBF6FD', color: '#1D4ED8', fontWeight: '700', padding: '2px 8px', borderRadius: '20px', fontSize: '11px' }}>{place.applies}件</span></td>
                        <td style={{ padding: '12px 14px' }}><span style={{ background: place.status === '公開中' ? '#ECFDF5' : '#F1F5F9', color: place.status === '公開中' ? '#16A34A' : '#64748B', fontWeight: '700', padding: '2px 8px', borderRadius: '20px', fontSize: '11px' }}>{place.status}</span></td>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            {place.status === '公開中' ? (
                              <button onClick={() => { if (window.confirm('この案件を下書きに戻しますか？（サイトに表示されなくなります）')) setPlaceStatus(place.id, 'draft') }} style={{ fontSize: '11px', padding: '4px 10px', border: '1px solid #E2E8F0', borderRadius: '6px', background: '#fff', cursor: 'pointer', color: '#64748B', fontWeight: '700' }}>下書きに戻す</button>
                            ) : (
                              <button onClick={() => setPlaceStatus(place.id, 'published')} style={{ fontSize: '11px', padding: '4px 10px', border: 'none', borderRadius: '6px', background: '#16A34A', cursor: 'pointer', color: '#fff', fontWeight: '700' }}>公開する</button>
                            )}
                            <button onClick={() => openFeeModal(place)} style={{ fontSize: '11px', padding: '4px 10px', border: '1px solid #FDE68A', borderRadius: '6px', background: '#FFFBEB', cursor: 'pointer', color: '#B45309', fontWeight: '700' }}>料金</button>
                            <a href={'/places/' + place.id} target='_blank' rel='noopener noreferrer' style={{ fontSize: '11px', padding: '4px 10px', border: '1px solid #BFDBFE', borderRadius: '6px', background: '#EFF6FF', cursor: 'pointer', color: '#1D4ED8', textDecoration: 'none', fontWeight: '700' }}>詳細</a>
                            <Link href={'/dashboard/host/edit-place/' + place.id + '?from=admin'} style={{ fontSize: '11px', padding: '4px 10px', border: '1px solid #E2E8F0', borderRadius: '6px', background: '#fff', cursor: 'pointer', color: '#64748B', textDecoration: 'none' }}>編集</Link>
                            <button onClick={() => { if (window.confirm('この案件を削除しますか？')) deletePlaceAdmin(place.id) }} style={{ fontSize: '11px', padding: '4px 10px', border: '1px solid #FCA5A5', borderRadius: '6px', background: '#FEE2E2', cursor: 'pointer', color: '#DC2626' }}>削除</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {placesTotalPages > 1 && (
                <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:'6px', flexWrap:'wrap', marginTop:'16px' }}>
                  <button onClick={() => setPlacesPage(p => Math.max(1, p - 1))} disabled={placesPageSafe <= 1} style={{ padding:'8px 12px', borderRadius:'8px', border:'1px solid #E2E8F0', background:'#fff', color: placesPageSafe<=1?'#ccc':'#1a1a1a', cursor: placesPageSafe<=1?'default':'pointer', fontWeight:'700' }}>←</button>
                  {Array.from({length: placesTotalPages}, (_, i) => i + 1).filter(n => n === 1 || n === placesTotalPages || Math.abs(n - placesPageSafe) <= 1).map((n, idx, arr) => (
                    <span key={n} style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                      {idx > 0 && n - arr[idx-1] > 1 && <span style={{ color:'#999' }}>…</span>}
                      <button onClick={() => setPlacesPage(n)} style={{ minWidth:'38px', padding:'8px 0', borderRadius:'8px', border: n===placesPageSafe?'none':'1px solid #E2E8F0', background: n===placesPageSafe?'#F5A623':'#fff', color: n===placesPageSafe?'#fff':'#1a1a1a', fontWeight:'700', cursor:'pointer' }}>{n}</button>
                    </span>
                  ))}
                  <button onClick={() => setPlacesPage(p => Math.min(placesTotalPages, p + 1))} disabled={placesPageSafe >= placesTotalPages} style={{ padding:'8px 12px', borderRadius:'8px', border:'1px solid #E2E8F0', background:'#fff', color: placesPageSafe>=placesTotalPages?'#ccc':'#1a1a1a', cursor: placesPageSafe>=placesTotalPages?'default':'pointer', fontWeight:'700' }}>→</button>
                </div>
              )}

              {feePlace && (() => {
                const ff = feeForm
                const dispFixed = (ff.price_fixed||0) + (ff.company_fixed_amount||0)
                const dispPct = (ff.price_share_pct||0) + (ff.company_share_pct||0)
                const unitLabel = (u: string) => u === 'per_event' ? '期間' : '日'
                const ex = 50000
                const exBase = ff.share_tax_basis === 'tax_excluded' ? Math.floor(ex / (1 + (ff.share_tax_rate||8)/100)) : ex
                const pf = (ff.place_fixed_unit=== 'per_event' ?0:(ff.price_fixed||0)) + exBase*(ff.price_share_pct||0)/100
                const cf = (ff.company_fixed_unit=== 'per_event' ?0:(ff.company_fixed_amount||0)) + exBase*(ff.company_share_pct||0)/100
                return (
                <div onClick={()=>setFeePlace(null)} style={{ position: 'fixed', inset:0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex:1000, padding: '20px' }}>
                  <div onClick={e=>e.stopPropagation()} style={{ background: '#fff', borderRadius: '14px', padding: '24px', width: '560px', maxWidth: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
                    <div style={{ fontWeight:900, fontSize: '16px', marginBottom: '4px', color: '#1a1a1a' }}>料金設定</div>
                    <div style={{ fontSize: '13px', color: '#64748B', marginBottom: '18px' }}>{feePlace.title}</div>
                    <div style={{ fontWeight:700, fontSize: '13px', color: '#B45309', marginBottom: '8px' }}>取引先の取り分（出店者には内訳を見せません）</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '16px' }}>
                      <div><label style={{fontSize: '11px',color: '#64748B'}}>固定額（円）</label><input type= 'number' value={ff.price_fixed === 0 ? '' : ff.price_fixed} onChange={e=>setFeeForm({...ff, price_fixed: parseInt(e.target.value)||0})} style={{width: '100%',border: '1.5px solid #E2E8F0',borderRadius: '8px',padding: '8px',fontSize: '13px',boxSizing: 'border-box'}} /></div>
                      <div><label style={{fontSize: '11px',color: '#64748B'}}>単位</label><select value={ff.place_fixed_unit} onChange={e=>setFeeForm({...ff, place_fixed_unit: e.target.value})} style={{width: '100%',border: '1.5px solid #E2E8F0',borderRadius: '8px',padding: '8px',fontSize: '13px'}}><option value= 'per_day'>1日あたり</option><option value= 'per_event'>期間で1回</option></select></div>
                      <div><label style={{fontSize: '11px',color: '#64748B'}}>歩合（%）</label><input type= 'number' value={ff.price_share_pct === 0 ? '' : ff.price_share_pct} onChange={e=>setFeeForm({...ff, price_share_pct: parseInt(e.target.value)||0})} style={{width: '100%',border: '1.5px solid #E2E8F0',borderRadius: '8px',padding: '8px',fontSize: '13px',boxSizing: 'border-box'}} /></div>
                    </div>
                    <div style={{ fontWeight:700, fontSize: '13px', color: '#3A9BD5', marginBottom: '8px' }}>弊社の利益</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '18px' }}>
                      <div><label style={{fontSize: '11px',color: '#64748B'}}>固定額（円）</label><input type= 'number' value={ff.company_fixed_amount === 0 ? '' : ff.company_fixed_amount} onChange={e=>setFeeForm({...ff, company_fixed_amount: parseInt(e.target.value)||0})} style={{width: '100%',border: '1.5px solid #E2E8F0',borderRadius: '8px',padding: '8px',fontSize: '13px',boxSizing: 'border-box'}} /></div>
                      <div><label style={{fontSize: '11px',color: '#64748B'}}>単位</label><select value={ff.company_fixed_unit} onChange={e=>setFeeForm({...ff, company_fixed_unit: e.target.value})} style={{width: '100%',border: '1.5px solid #E2E8F0',borderRadius: '8px',padding: '8px',fontSize: '13px'}}><option value= 'per_day'>1日あたり</option><option value= 'per_event'>期間で1回</option></select></div>
                      <div><label style={{fontSize: '11px',color: '#64748B'}}>歩合（%）</label><input type= 'number' value={ff.company_share_pct === 0 ? '' : ff.company_share_pct} onChange={e=>setFeeForm({...ff, company_share_pct: parseInt(e.target.value)||0})} style={{width: '100%',border: '1.5px solid #E2E8F0',borderRadius: '8px',padding: '8px',fontSize: '13px',boxSizing: 'border-box'}} /></div>
                    </div>
                    <div style={{ fontWeight:700, fontSize: '13px', color: '#16A34A', marginBottom: '8px' }}>歩合の計算元（税の扱い）</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '18px' }}>
                      <div><label style={{fontSize: '11px',color: '#64748B'}}>計算元</label><select value={ff.share_tax_basis} onChange={e=>setFeeForm({...ff, share_tax_basis: e.target.value})} style={{width: '100%',border: '1.5px solid #E2E8F0',borderRadius: '8px',padding: '8px',fontSize: '13px'}}><option value='as_entered'>入力金額そのまま</option><option value='tax_excluded'>税抜に換算してから</option></select></div>
                      {ff.share_tax_basis === 'tax_excluded' && (<div><label style={{fontSize: '11px',color: '#64748B'}}>税率</label><select value={ff.share_tax_rate} onChange={e=>setFeeForm({...ff, share_tax_rate: parseInt(e.target.value)||10})} style={{width: '100%',border: '1.5px solid #E2E8F0',borderRadius: '8px',padding: '8px',fontSize: '13px'}}><option value={8}>8%（軽減税率）</option><option value={10}>10%</option></select></div>)}
                    </div>
                    <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '10px', padding: '12px 14px', marginBottom: '10px', fontSize: '13px' }}><div style={{fontWeight:700,color: '#16A34A',marginBottom: '4px'}}>出店者に見える表示</div>出店料：{dispFixed.toLocaleString()}円/{unitLabel(ff.place_fixed_unit)}{dispPct>0? ' ＋ 売上の'+dispPct+ '%' : ''}</div>
                    <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '12px 14px', marginBottom: '18px', fontSize: '12px', color: '#64748B', lineHeight:1.8 }}><div style={{fontWeight:700,color: '#1a1a1a',marginBottom: '4px'}}>管理側の内訳（売上{ex.toLocaleString()}円/日の例）</div>取引先分：{Math.round(pf).toLocaleString()}円 ／ 弊社の利益：<strong style={{color: '#3A9BD5'}}>{Math.round(cf).toLocaleString()}円</strong> ／ 総額：<strong style={{color: '#16A34A'}}>{Math.round(pf+cf).toLocaleString()}円</strong></div>
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                      <button onClick={()=>setFeePlace(null)} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '9px 18px', fontSize: '13px', cursor: 'pointer' }}>キャンセル</button>
                      <button onClick={saveFee} disabled={feeSaving} style={{ background: feeSaving? '#ccc' : '#16A34A', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 22px', fontSize: '13px', fontWeight:700, cursor:feeSaving? 'not-allowed' : 'pointer' }}>{feeSaving? '保存中...' : '保存する'}</button>
                    </div>
                  </div>
                </div>
                ) })()}
            </>
          )}

          {/* ===== 出店者管理 ===== */}
          {tab === 'sellers' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '8px', flex: 1, minWidth: 0 }}>
                  <input type="text" value={sellerKw} onChange={e => setSellerKw(e.target.value)} placeholder="出店者名・メールで検索" style={{ border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', outline: 'none', flex: 1, minWidth: 0 }} />
                  <select style={{ border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', outline: 'none' }}>
                    <option>すべて</option><option>承認済</option><option>審査中</option>
                  </select>
                </div>
                <button onClick={() => setTab('csv')} style={{ background: '#3A9BD5', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 18px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  CSVで一括インポート
                </button>
              </div>

              <div className='admin-table-wrap' style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC' }}>
                      {['出店者名', 'メール', '電話番号', 'ジャンル', 'エリア', 'SNS', '書類', 'ステータス', '操作'].map(h => (
                        <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', color: '#64748B', fontWeight: '600', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const kw = sellerKw.trim().toLowerCase()
                      const filteredSellers = kw ? sellers.filter(s => (s.name || '').toLowerCase().includes(kw) || (s.email || '').toLowerCase().includes(kw)) : sellers
                      return (<>
                    {sellersLoading && (<tr><td colSpan={9} style={{ padding: '24px', textAlign: 'center', color: '#999' }}>読み込み中...</td></tr>)}
                    {!sellersLoading && filteredSellers.length === 0 && (<tr><td colSpan={9} style={{ padding: '24px', textAlign: 'center', color: '#999' }}>{kw ? '該当する出店者がいません。' : '出店者がまだいません。'}</td></tr>)}
                    {filteredSellers.map((s, i) => (
                      <tr key={s.id} style={{ borderBottom: i < sellers.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                            <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#FFF8E1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700', color: '#B45309', flexShrink: 0 }}>{s.name[0]}</div>
                            <div>
                              <div style={{ fontWeight: '600' }}>{s.name}</div>
                              <div style={{ fontSize: '10px', color: '#64748B' }}>{s.shop}</div>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '10px 12px', color: '#64748B' }}>{s.email}</td>
                        <td style={{ padding: '10px 12px', color: '#64748B' }}>{s.phone}</td>
                        <td style={{ padding: '10px 12px', color: '#64748B' }}>{s.genre}</td>
                        <td style={{ padding: '10px 12px', color: '#64748B' }}>{s.area}</td>
                        <td style={{ padding: '10px 12px', color: '#3A9BD5' }}>{s.sns || '—'}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 7px', borderRadius: '20px', background: s.docs === '提出済' ? '#ECFDF5' : s.docs === '再提出依頼' ? '#FEE2E2' : '#FEF3C7', color: s.docs === '提出済' ? '#16A34A' : s.docs === '再提出依頼' ? '#DC2626' : '#92400E' }}>{s.docs}</span>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ fontSize: '10px', fontWeight: '700', padding: '2px 7px', borderRadius: '20px', background: s.status === '承認済' ? '#ECFDF5' : '#FEF3C7', color: s.status === '承認済' ? '#16A34A' : '#92400E' }}>{s.status}</span>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button onClick={() => window.open('/sellers/' + s.id + '?preview=1', '_blank')} title="公開プロフィールを見る" style={{ fontSize: '10px', padding: '3px 8px', border: '1px solid #E2E8F0', borderRadius: '5px', background: '#fff', cursor: 'pointer' }}>表示</button>
                            <button onClick={() => { if (window.confirm(s.name + ' を削除しますか？この操作は取り消せません。')) deleteSellerAdmin(s.id) }} style={{ fontSize: '10px', padding: '3px 8px', border: '1px solid #FCA5A5', borderRadius: '5px', background: '#FEE2E2', cursor: 'pointer', color: '#DC2626' }}>削除</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    </>)
                    })()}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ===== CSVインポート ===== */}
          {tab === 'docs' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', gap: '12px' }}>
                <p style={{ fontSize: '13px', color: '#64748B', flex: 1, minWidth: 0, margin: 0 }}>出店者が提出した書類を確認し、承認または否認します。</p>
                <button onClick={loadDocReviews} style={{ background: '#fff', color: '#64748B', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>更新</button>
              </div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                {([{ key: 'all', label: 'すべて' }, { key: 'pending', label: '要対応' }, { key: 'expiring', label: '期限1ヶ月以内' }] as { key: 'all' | 'pending' | 'expiring', label: string }[]).map(btn => (
                  <button key={btn.key} onClick={() => setDocFilter(btn.key)} style={{ background: docFilter === btn.key ? '#F5A623' : '#fff', color: docFilter === btn.key ? '#fff' : '#64748B', border: '1px solid ' + (docFilter === btn.key ? '#F5A623' : '#E2E8F0'), borderRadius: '8px', padding: '7px 16px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>{btn.label}</button>
                ))}
              </div>
              {docsLoading ? (
                <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '32px', textAlign: 'center', color: '#999' }}>読み込み中...</div>
              ) : docReviews.length === 0 ? (
                <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '32px', textAlign: 'center', color: '#999' }}>提出された書類はまだありません。</div>
              ) : (() => {
                // seller_id ごとに書類をグループ化
                const groups: Record<string, DocReview[]> = {}
                for (const d of docReviews) { (groups[d.seller_id] ||= []).push(d) }
                const docOrder = ['license_front', 'license_back', 'food_hygiene', 'liability_insurance', 'other_permit']
                const sellerIds = Object.keys(groups)
                // 有効期限の状態を判定（期限切れ / 間近 / 通常 / 未設定）
                const expiryInfo = (dateStr: string | null) => {
                  if (!dateStr) return { text: '未設定', color: '#94A3B8', bg: '#F1F5F9' }
                  const today = new Date(); today.setHours(0, 0, 0, 0)
                  const exp = new Date(dateStr); exp.setHours(0, 0, 0, 0)
                  const days = Math.round((exp.getTime() - today.getTime()) / 86400000)
                  const jp = exp.toLocaleDateString('ja-JP')
                  if (days < 0) return { text: jp + '（期限切れ）', color: '#DC2626', bg: '#FEE2E2' }
                  if (days <= 30) return { text: jp + '（あと' + days + '日）', color: '#B45309', bg: '#FEF3C7' }
                  return { text: jp, color: '#475569', bg: '#F1F5F9' }
                }
                // 有効期限が30日以内（期限切れ含む）かどうか
                const isExpiringSoon = (dateStr: string | null) => {
                  if (!dateStr) return false
                  const today = new Date(); today.setHours(0, 0, 0, 0)
                  const exp = new Date(dateStr); exp.setHours(0, 0, 0, 0)
                  const days = Math.round((exp.getTime() - today.getTime()) / 86400000)
                  return days <= 30
                }
                // フィルター適用：表示する出店者を絞り込む
                const shownIds = sellerIds.filter(sid => {
                  const ds = groups[sid]
                  if (docFilter === 'pending') return ds.some(d => d.status === 'pending')
                  if (docFilter === 'expiring') return ds.some(d => isExpiringSoon(d.expiry_date))
                  return true
                })
                if (shownIds.length === 0) {
                  const emptyMsg = docFilter === 'pending' ? '審査中の書類がある出店者はいません。' : docFilter === 'expiring' ? '有効期限が1ヶ月以内の出店者はいません。' : '提出された書類はまだありません。'
                  return <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '32px', textAlign: 'center', color: '#999' }}>{emptyMsg}</div>
                }
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {shownIds.map(sid => {
                      const docs = groups[sid].slice().sort((a, b) => docOrder.indexOf(a.doc_type) - docOrder.indexOf(b.doc_type))
                      const head = docs[0]
                      const counts = { approved: 0, pending: 0, rejected: 0 } as Record<string, number>
                      for (const d of docs) { if (counts[d.status] !== undefined) counts[d.status]++ }
                      return (
                        <div key={sid} style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                          {/* 出店者ヘッダー */}
                          <div style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0', padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                            <div style={{ fontWeight: '700', fontSize: '15px', color: '#1E2A3B' }}>
                              {head.sellerName}{head.sellerShop && <span style={{ fontWeight: '400', fontSize: '13px', color: '#64748B', marginLeft: '8px' }}>（{head.sellerShop}）</span>}
                            </div>
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              {counts.pending > 0 && <span style={{ fontSize: '11px', fontWeight: '700', padding: '3px 10px', borderRadius: '20px', background: '#FEF3C7', color: '#92400E' }}>審査中 {counts.pending}</span>}
                              {counts.approved > 0 && <span style={{ fontSize: '11px', fontWeight: '700', padding: '3px 10px', borderRadius: '20px', background: '#ECFDF5', color: '#16A34A' }}>承認済 {counts.approved}</span>}
                              {counts.rejected > 0 && <span style={{ fontSize: '11px', fontWeight: '700', padding: '3px 10px', borderRadius: '20px', background: '#FEE2E2', color: '#DC2626' }}>否認 {counts.rejected}</span>}
                            </div>
                          </div>
                          {/* 書類一覧 */}
                          <div>
                            {docs.map(d => {
                              const meta = ({ approved: { label: '承認済', color: '#16A34A', bg: '#ECFDF5' }, pending: { label: '審査中', color: '#92400E', bg: '#FEF3C7' }, rejected: { label: '否認', color: '#DC2626', bg: '#FEE2E2' } } as Record<string, { label: string, color: string, bg: string }>)[d.status] || { label: d.status, color: '#555', bg: '#F1F5F9' }
                              const exp = expiryInfo(d.expiry_date)
                              return (
                                <div key={d.id} style={{ borderBottom: '1px solid #F1F5F9', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                                  <div style={{ flex: '1 1 160px', minWidth: 0, fontWeight: '600', fontSize: '13px' }}>{docTypeLabels[d.doc_type] || d.doc_type}</div>
                                  <span style={{ fontSize: '11px', fontWeight: '700', padding: '3px 10px', borderRadius: '20px', background: meta.bg, color: meta.color, flexShrink: 0 }}>{meta.label}</span>
                                  <span style={{ fontSize: '11px', fontWeight: '600', padding: '3px 10px', borderRadius: '6px', background: exp.bg, color: exp.color, flexShrink: 0 }}>{exp.text}</span>
                                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', flexShrink: 0 }}>
                                    <button onClick={() => previewDoc(d.file_url)} style={{ background: '#EBF6FD', color: '#1D4ED8', border: '1px solid #BFDBFE', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>確認</button>
                                    <button onClick={() => reviewDoc(d.id, 'approved')} style={{ background: '#E8F5E9', color: '#2E7D32', border: '1px solid #A5D6A7', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>承認</button>
                                    <button onClick={async () => { const reason = window.prompt('否認理由を入力してください（出店者にメールで通知されます）'); if (reason === null) return; await reviewDoc(d.id, 'rejected', reason); try { await fetch('/api/notify/document-rejected', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ documentId: d.id, reason }) }) } catch (e) { console.error('否認通知に失敗', e) } }} style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>否認</button>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
            </div>
          )}

          {tab === 'sales' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
                <p style={{ fontSize: '13px', color: '#64748B', flex: 1, minWidth: 0, margin: 0 }}>出店者の売上を記録すると、出店料（＝弊社の利益／出店コネクトナビへのお支払い額）を自動集計します。出店料は売上×料率（税別）で計算します。</p>
                <button onClick={runSalesReminder} disabled={reminding} title='出店日を過ぎても売上報告が無い出店者へ催促メールを送ります（毎朝9時に自動送信もされます）'
                  style={{ background: '#fff', color: '#B45309', border: '1px solid #FDE68A', borderRadius: '8px', padding: '8px 14px', fontSize: '12px', fontWeight: 700, cursor: reminding ? 'wait' : 'pointer', flexShrink: 0 }}>
                  {reminding ? '送信中…' : '売上報告を催促する'}
                </button>
                <input type='month' value={saleMonth} onChange={e => setSaleMonth(e.target.value)} style={{ border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', outline: 'none', flexShrink: 0 }} />
              </div>


              {/* 企業へ提出する売上報告 */}
              {reportPlaces.length > 0 && (
                <div style={{ background: '#fff', border: '2px solid #BBF7D0', borderRadius: '10px', padding: '14px 16px', marginBottom: '16px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 900, color: '#15803D', marginBottom: '4px' }}>📊 施設・企業へ提出する売上報告Excel</div>
                  <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '8px', lineHeight: 1.7 }}>
                    出店者から届いた報告（売上・品目ごとの販売食数・天候・来客数・所感）を、開催日ごとのシートにまとめます。「何食売れたか」のご報告にそのまま使えます。
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {reportPlaces.map(pl => (
                      <button key={pl.placeId} onClick={() => downloadSalesReportXlsx(pl.placeId, pl.title)} disabled={repXlsxBusy === pl.placeId}
                        style={{ background: '#F0FDF4', color: '#15803D', border: '1px solid #BBF7D0', borderRadius: '999px', padding: '6px 14px', fontSize: '12px', fontWeight: 700, cursor: repXlsxBusy === pl.placeId ? 'wait' : 'pointer' }}>
                        {repXlsxBusy === pl.placeId ? '作成中…' : `${pl.title}（${pl.count}件）`}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 出店料の入金状況 */}
              <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '16px 18px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: '#1a1a1a' }}>出店料の入金状況</div>
                    <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>発行済みの請求書と、振込の報告・確認の状況です。出店者が振込を報告すると運営にメールが届きます。</div>
                  </div>
                  <button onClick={loadPayments} disabled={payLoading}
                    style={{ background: '#fff', color: '#64748B', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '7px 14px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                    {payLoading ? '読み込み中…' : '更新'}
                  </button>
                </div>
                {payRows.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#999', fontSize: '12px' }}>
                    {payLoading ? '読み込み中...' : '発行済みの請求書はまだありません。'}
                  </div>
                ) : (
                  /* 横に長い表はスマホで切れてしまうため、1件ずつのカードで出す */
                  <div style={{ display: 'grid', gap: '10px' }}>
                    {payRows.map(r => {
                      const st = r.paid_status === 'paid'
                        ? { label: '入金確認済', color: '#16A34A', bg: '#ECFDF5', border: '#BBF7D0' }
                        : r.paid_status === 'reported'
                          ? { label: '振込報告あり', color: '#B45309', bg: '#FEF3C7', border: '#FDE68A' }
                          : { label: '未入金', color: '#DC2626', bg: '#FEE2E2', border: '#FECACA' }
                      // 日付はローカル（日本時間）で見る。UTCで比べると朝9時まで1日ずれる
                      const nd = new Date()
                      const todayLocal = nd.getFullYear() + '-' + String(nd.getMonth() + 1).padStart(2, '0') + '-' + String(nd.getDate()).padStart(2, '0')
                      const overdue = r.paid_status !== 'paid' && r.due_on && r.due_on < todayLocal
                      return (
                        <div key={r.id} style={{ border: `1px solid ${overdue ? '#FECACA' : '#E2E8F0'}`, borderRadius: '10px', padding: '12px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                            <span style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}`, borderRadius: '999px', padding: '2px 10px', fontSize: '11px', fontWeight: 700, flexShrink: 0 }}>{st.label}</span>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: '#1a1a1a' }}>{r.sellerName}</span>
                            <span style={{ fontSize: '11px', color: '#94A3B8' }}>{r.invoice_no}</span>
                          </div>
                          <div style={{ display: 'flex', gap: '18px', flexWrap: 'wrap', marginBottom: '8px' }}>
                            <div>
                              <div style={{ fontSize: '10px', color: '#64748B' }}>請求額（税込）</div>
                              <div style={{ fontSize: '16px', fontWeight: 900, color: '#1a1a1a' }}>¥{r.total.toLocaleString()}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: '10px', color: '#64748B' }}>対象月</div>
                              <div style={{ fontSize: '13px', fontWeight: 700, color: '#475569', paddingTop: '2px' }}>{r.period}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: '10px', color: '#64748B' }}>支払期限</div>
                              <div style={{ fontSize: '13px', fontWeight: 700, color: overdue ? '#DC2626' : '#475569', paddingTop: '2px' }}>
                                {r.due_on ? r.due_on.replace(/-/g, '/') : '—'}{overdue && ' 超過'}
                              </div>
                            </div>
                          </div>
                          {r.paid_status !== 'unpaid' && (
                            <div style={{ fontSize: '11px', color: '#475569', marginBottom: '8px' }}>
                              振込の報告：{r.paid_on ? r.paid_on.replace(/-/g, '/') : '日付なし'}
                              {r.paid_name && <>／名義 {r.paid_name}</>}
                            </div>
                          )}
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            {r.paid_status === 'paid' ? (
                              <button onClick={() => confirmPayment(r, true)} disabled={payBusy === r.id}
                                style={{ background: '#fff', color: '#64748B', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '6px 14px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>確認を取り消す</button>
                            ) : (
                              <button onClick={() => confirmPayment(r, false)} disabled={payBusy === r.id}
                                style={{ background: '#16A34A', color: '#fff', border: 'none', borderRadius: '6px', padding: '7px 18px', fontSize: '12px', fontWeight: 700, cursor: payBusy === r.id ? 'wait' : 'pointer' }}>
                                {payBusy === r.id ? '…' : '入金を確認'}
                              </button>
                            )}
                            {/* テストで作った請求書などを消せるようにする */}
                            <button onClick={() => deleteInvoice(r)} disabled={payBusy === r.id}
                              style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', borderRadius: '6px', padding: '6px 14px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>この請求書を削除</button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* 出店者ごとにまとめて、その月の請求書を作れるようにする */}
              {(() => {
                const byS = new Map<string, { name: string, count: number, amount: number }>()
                for (const r of sales) {
                  const cur = byS.get(r.seller_id) || { name: r.sellerName, count: 0, amount: 0 }
                  cur.count += 1; cur.amount += r.total_pay
                  byS.set(r.seller_id, cur)
                }
                if (byS.size === 0) return null
                return (
                  <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '16px 18px', marginBottom: '20px' }}>
                    <div style={{ fontWeight: '700', fontSize: '14px', marginBottom: '4px', color: '#B45309' }}>請求書の作成</div>
                    <div style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '10px' }}>出店者ごとに{saleMonth.replace('-', '年')}月分をまとめて請求書にします。</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748B' }}>振込期限</span>
                      <input type='date' value={invoiceDue} onChange={e => setInvoiceDue(e.target.value)}
                        style={{ border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '7px 10px', fontSize: '13px' }} />
                      <span style={{ fontSize: '11px', color: '#94A3B8' }}>ここで設定した期限が請求書に印字されます（既定は翌月末日）。</span>
                    </div>
                    <div className='admin-table-wrap'>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead>
                          <tr style={{ background: '#F8FAFC' }}>
                            {['出店者', '件数', '出店料（税抜）', '税込', ''].map(h => (
                              <th key={h} style={{ padding: '9px 12px', textAlign: 'left', fontSize: '11px', color: '#64748B', fontWeight: 600, borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {[...byS.entries()].map(([sid, v]) => (
                            <tr key={sid}>
                              <td style={{ padding: '10px 12px', borderBottom: '1px solid #F1F5F9' }}>{v.name}</td>
                              <td style={{ padding: '10px 12px', borderBottom: '1px solid #F1F5F9', whiteSpace: 'nowrap' }}>{v.count}件</td>
                              <td style={{ padding: '10px 12px', borderBottom: '1px solid #F1F5F9', whiteSpace: 'nowrap' }}>¥{v.amount.toLocaleString()}</td>
                              <td style={{ padding: '10px 12px', borderBottom: '1px solid #F1F5F9', whiteSpace: 'nowrap', fontWeight: 700 }}>¥{(v.amount + Math.floor(v.amount * 0.1)).toLocaleString()}</td>
                              <td style={{ padding: '10px 12px', borderBottom: '1px solid #F1F5F9' }}>
                                <a href={'/admin/invoice?seller=' + sid + '&period=' + saleMonth + (invoiceDue ? '&due=' + invoiceDue : '')} target='_blank' rel='noopener noreferrer' style={{ background: '#1E2A3B', color: '#fff', borderRadius: '6px', padding: '6px 12px', fontSize: '11px', fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>請求書を作成</a>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )
              })()}

              <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '16px 18px', marginBottom: '20px' }}>
                <div style={{ fontWeight: '700', fontSize: '14px', marginBottom: '14px', color: '#B45309' }}>売上を記録</div>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                  <div style={{ flex: '2 1 200px', minWidth: 0 }}>
                    <label style={{ fontSize: '12px', color: '#64748B', display: 'block', marginBottom: '4px' }}>案件・出店者</label>
                    <select value={saleAppId} onChange={e => setSaleAppId(e.target.value)} style={{ width: '100%', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', outline: 'none', background: '#fff' }}>
                      <option value=''>選択してください</option>
                      {approvedApps.map(a => (
                        <option key={a.application_id} value={a.application_id}>{a.placeTitle}／{a.sellerName}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ flex: '1 1 130px', minWidth: 0 }}>
                    <label style={{ fontSize: '12px', color: '#64748B', display: 'block', marginBottom: '4px' }}>売上日</label>
                    <input type='date' value={saleDate} onChange={e => setSaleDate(e.target.value)} style={{ width: '100%', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ flex: '1 1 120px', minWidth: 0 }}>
                    <label style={{ fontSize: '12px', color: '#64748B', display: 'block', marginBottom: '4px' }}>売上金額（円）</label>
                    <input type='number' value={saleRevenue} onChange={e => setSaleRevenue(e.target.value)} placeholder='50000' style={{ width: '100%', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ flex: '1 1 170px', minWidth: 0 }}>
                    <label style={{ fontSize: '12px', color: '#64748B', display: 'block', marginBottom: '4px' }}>手数料の計算元</label>
                    <select value={saleTaxOv} onChange={e => setSaleTaxOv(e.target.value)} style={{ width: '100%', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', outline: 'none', background: '#fff' }}>
                      <option value=''>案件の設定に従う</option>
                      <option value='as_entered'>入力金額そのまま</option>
                      <option value='ex8'>税抜に換算（8%）</option>
                      <option value='ex10'>税抜に換算（10%）</option>
                    </select>
                  </div>
                  <button onClick={saveSale} disabled={saleSaving} style={{ background: saleSaving ? '#ccc' : '#F5A623', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 20px', fontSize: '13px', fontWeight: '700', cursor: saleSaving ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}>{saleSaving ? '保存中...' : '記録する'}</button>
                </div>
                {saleAppId && (() => { const a = approvedApps.find(x => x.application_id === saleAppId); if (!a) return null; const rev = parseInt(saleRevenue || '0', 10) || 0; const { placeFee, companyFee, totalPay } = calcFees(rev, a, saleTaxOv); return (
                  <div style={{ marginTop: '12px', fontSize: '12px', color: '#64748B', lineHeight: 1.9 }}>
                    <div>取引先分（税別）：<strong style={{ color: '#1a1a1a' }}>{placeFee.toLocaleString()}円</strong></div>
                    <div>弊社の利益（税別）：<strong style={{ color: '#3A9BD5' }}>{companyFee.toLocaleString()}円</strong></div>
                    <div>お支払い総額（税別）：<strong style={{ color: '#16A34A' }}>{totalPay.toLocaleString()}円</strong> ／ 税込 <strong style={{ color: '#16A34A' }}>{Math.round(totalPay * 1.1).toLocaleString()}円</strong></div>
                  </div>
                ) })()}
              </div>

              <div className='admin-stats' style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '14px', marginBottom: '20px' }}>
                {(() => {
                  const totalCompany = sales.reduce((s, r) => s + (r.company_fee ?? r.fee), 0)
                  const totalPay = sales.reduce((s, r) => s + (r.total_pay ?? r.fee), 0)
                  const cards = [
                    { label: '弊社の利益 税別（合計）', value: totalCompany, color: '#3A9BD5' },
                    { label: 'お支払い総額 税別（合計）', value: totalPay, color: '#16A34A' },
                    { label: 'お支払い総額 税込（合計）', value: Math.round(totalPay * 1.1), color: '#16A34A' },
                  ]
                  return cards.map(card => (
                    <div key={card.label} style={{ background: '#fff', borderRadius: '12px', padding: '16px', border: '1px solid #E2E8F0' }}>
                      <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '8px' }}>{card.label}</div>
                      <div style={{ fontSize: '20px', fontWeight: '900', color: card.color }}>¥{card.value.toLocaleString()}</div>
                    </div>
                  ))
                })()}
              </div>

              <div className='admin-table-wrap' style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr>
                      {['売上日', '案件', '出店者', '売上', '取引先分', '弊社利益', '総額(税別)', '総額(税込)', ''].map(h => (
                        <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', color: '#64748B', fontWeight: '600', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {salesLoading ? (
                      <tr><td colSpan={9} style={{ padding: '24px', textAlign: 'center', color: '#999' }}>読み込み中...</td></tr>
                    ) : sales.length === 0 ? (
                      <tr><td colSpan={9} style={{ padding: '24px', textAlign: 'center', color: '#999' }}>この月の売上記録はまだありません。</td></tr>
                    ) : sales.map((s, i) => (
                      <tr key={s.id} style={{ borderBottom: i < sales.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>{s.sale_date}</td>
                        <td style={{ padding: '10px 14px' }}>
                          {s.placeTitle}
                          {s.items.length > 0 && (
                            <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                              {s.items.map(it => it.name + '×' + it.qty + '食').join('、')}
                              （合計{s.items.reduce((t, it) => t + (it.qty || 0), 0)}食）
                            </div>
                          )}
                          {(s.weather || s.customers != null || s.note) && (
                            <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '2px' }}>
                              {s.weather && <>天候：{s.weather}　</>}
                              {s.customers != null && <>来客：{s.customers}　</>}
                              {s.note}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '10px 14px' }}>{s.sellerName}</td>
                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>¥{s.revenue.toLocaleString()}</td>
                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', color: '#64748B' }}>¥{(s.place_fee ?? 0).toLocaleString()}</td>
                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', color: '#3A9BD5' }}>¥{(s.company_fee ?? s.fee).toLocaleString()}</td>
                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', color: '#16A34A', fontWeight: '700' }}>¥{(s.total_pay ?? s.fee).toLocaleString()}</td>
                        <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', color: '#16A34A', fontWeight: '700' }}>¥{Math.round((s.total_pay ?? s.fee) * 1.1).toLocaleString()}</td>
                        <td style={{ padding: '10px 14px' }}>
                          <button onClick={() => { if (window.confirm('この売上記録を削除しますか？')) deleteSale(s.id) }} style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', borderRadius: '6px', padding: '5px 10px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}>削除</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'messages' && (
            <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '16px', height: 'calc(100vh - 180px)' }}>
              <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', overflowY: 'auto' }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #E2E8F0', fontWeight: '700', fontSize: '13px', color: '#1a1a1a' }}>出店者一覧（案件ごと）</div>
                {threads.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: '#999', fontSize: '13px' }}>承認済みの案件がありません。</div>
                ) : threads.map(t => (
                  <div key={t.application_id} onClick={() => openThread(t.application_id)}
                    style={{ padding: '12px 16px', borderBottom: '1px solid #F1F5F9', cursor: 'pointer', background: activeThread === t.application_id ? '#FFF8E1' : '#fff', borderLeft: activeThread === t.application_id ? '3px solid #F5A623' : '3px solid transparent' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '13px', fontWeight: '700', color: '#1a1a1a' }}>{t.sellerName}</span>
                      {t.unread > 0 && <span style={{ background: '#DC2626', color: '#fff', borderRadius: '10px', padding: '1px 7px', fontSize: '10px', fontWeight: '700' }}>{t.unread}</span>}
                    </div>
                    <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>{t.placeTitle}</div>
                    <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.lastBody}</div>
                  </div>
                ))}
              </div>
              <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', display: 'flex', flexDirection: 'column' }}>
                {activeThread ? (
                  <>
                    <div style={{ padding: '12px 18px', borderBottom: '1px solid #E2E8F0', fontWeight: '700', fontSize: '13px', color: '#1a1a1a' }}>{threads.find(t => t.application_id === activeThread)?.sellerName || '出店者'} とのやり取り</div>
                    <div style={{ flex: 1, padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px', background: '#F8FAFC', overflowY: 'auto' }}>
                      {threadMsgs.length === 0 ? (
                        <div style={{ color: '#94A3B8', fontSize: '13px', textAlign: 'center', marginTop: '20px' }}>まだメッセージがありません</div>
                      ) : threadMsgs.map(m => (
                        m.sender_id === adminUid ? (
                          <div key={m.id} style={{ alignSelf: 'flex-end', maxWidth: '70%' }}>
                            <div style={{ background: '#F5A623', color: '#fff', borderRadius: '12px', padding: '10px 14px', fontSize: '13px', lineHeight: 1.6 }}>
                              {m.body && <div>{m.body}</div>}
                              {m.file_url && renderAttachment(m.file_url, true)}
                            </div>
                          </div>
                        ) : (
                          <div key={m.id} style={{ alignSelf: 'flex-start', maxWidth: '70%' }}>
                            <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '12px', padding: '10px 14px', fontSize: '13px', lineHeight: 1.6, color: '#1a1a1a' }}>
                              {m.body && <div>{m.body}</div>}
                              {m.file_url && renderAttachment(m.file_url, false)}
                            </div>
                          </div>
                        )
                      ))}
                    </div>
                    {adminMsgFile ? (
                      <div style={{ padding: '8px 16px', borderTop: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '8px', background: '#FFF7ED' }}>
                        <span style={{ fontSize: '12px', color: '#9A3412', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📎 {adminMsgFile.name}</span>
                        <button onClick={() => setAdminMsgFile(null)} style={{ background: 'none', border: 'none', color: '#9A3412', cursor: 'pointer', fontSize: '14px', fontWeight: '700' }}>✕</button>
                      </div>
                    ) : null}
                    <div style={{ padding: '12px 16px', borderTop: adminMsgFile ? 'none' : '1px solid #E2E8F0', display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <label htmlFor="admin-msg-file-input" style={{ cursor: adminMsgUploading ? 'not-allowed' : 'pointer', fontSize: '20px', opacity: adminMsgUploading ? 0.4 : 1, userSelect: 'none' }}>📎</label>
                      <input id="admin-msg-file-input" type="file" accept="image/*,application/pdf" style={{ display: 'none' }} disabled={adminMsgUploading} onChange={e => { const file = e.target.files?.[0]; if (file) setAdminMsgFile(file); e.currentTarget.value = '' }} />
                      <input value={adminMsgInput} onChange={e => setAdminMsgInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') sendAdminMsg() }} placeholder="メッセージを入力..." disabled={adminMsgUploading} style={{ flex: 1, border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', outline: 'none', color: '#1a1a1a' }} />
                      <button onClick={sendAdminMsg} disabled={adminMsgUploading} style={{ background: adminMsgUploading ? '#ccc' : '#F5A623', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 16px', fontSize: '13px', fontWeight: '700', cursor: adminMsgUploading ? 'not-allowed' : 'pointer' }}>{adminMsgUploading ? '...' : '送信'}</button>
                    </div>
                  </>
                ) : (
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: '14px' }}>左の一覧から出店者を選んでください</div>
                )}
              </div>
            </div>
          )}

          {tab === 'applications' && (() => {
            return (
            <div>
              <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: '#1D4ED8', display: 'flex', gap: '8px' }}>
                <span>出店者からの応募を承認すると、マッチングが成立します。却下すると取り消されます。</span>
              </div>
              {/* 施設・企業へ提出する「出店者情報」。承認済みの出店者を、
                  普段提出しているExcelと同じ様式（日付ごとのシート）で出力する */}
              {approvedPlaces.length > 0 && (
                <div style={{ background: '#fff', border: '2px solid #BFDBFE', borderRadius: '10px', padding: '14px 16px', marginBottom: '14px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 900, color: '#1D4ED8', marginBottom: '4px' }}>📄 施設・企業へ提出するExcel</div>
                  <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '8px', lineHeight: 1.7 }}>
                    普段ご提出いただいている様式そのままで出力します（開催日ごとのシート／店舗名・Instagram・ジャンル・テイクアウト袋・決済方法・メニュー）。<strong style={{ color: '#1D4ED8' }}>提出用はこちらをお使いください。</strong>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {approvedPlaces.map(pl => (
                      <button key={pl.placeId} onClick={() => downloadSubmitXlsx(pl.placeId, pl.title)} disabled={submitXlsxBusy === pl.placeId}
                        style={{ background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', borderRadius: '999px', padding: '6px 14px', fontSize: '12px', fontWeight: 700, cursor: submitXlsxBusy === pl.placeId ? 'wait' : 'pointer' }}>
                        {submitXlsxBusy === pl.placeId ? '作成中…' : `${pl.title}（${pl.count}件）`}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', margin: '0 0 10px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '900', color: '#1a1a1a', margin: 0 }}>承認待ち（{pendingApps.length}件）</h3>
                {pendingApps.length > 0 && (
                  <button onClick={() => exportPendingCsv(pendingApps, '全案件')} style={{ background: '#1E2A3B', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                    社内確認用CSV（全{pendingApps.length}件）
                  </button>
                )}
              </div>
              {/* 案件ごとにまとめて出力できるようにする（施設側に渡す用） */}
              {(() => {
                const byPlace = new Map<string, PendingApp[]>()
                for (const a of pendingApps) {
                  const k = a.placeTitle
                  const cur = byPlace.get(k); if (cur) cur.push(a); else byPlace.set(k, [a])
                }
                if (byPlace.size === 0) return null
                return (
                  <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '10px', padding: '12px 14px', marginBottom: '14px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748B', marginBottom: '2px' }}>社内確認用CSV（案件ごと）</div>
                    <div style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '8px', lineHeight: 1.7 }}>
                      承認の判断に使う全項目（住所・活動エリア・紹介文・書類の提出状況など）が入ります。施設への提出には上の「施設・企業へ提出するExcel」をお使いください。
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {[...byPlace.entries()].map(([title, rows]) => (
                        <button key={title} onClick={() => exportPendingCsv(rows, title)} style={{ background: '#FFFBEB', color: '#B45309', border: '1px solid #FDE68A', borderRadius: '999px', padding: '6px 14px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                          {title}（{rows.length}件）
                        </button>
                      ))}
                    </div>
                  </div>
                )
              })()}
              <div style={{ display: 'grid', gap: '12px' }}>
                {pendingLoading && <div style={{ color: '#999', fontSize: '13px', padding: '16px', textAlign: 'center' }}>読み込み中...</div>}
                {!pendingLoading && pendingApps.length === 0 && <div style={{ color: '#999', fontSize: '13px', padding: '16px', background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', textAlign: 'center' }}>承認待ちの応募はありません。</div>}
                {pendingApps.map(a => (
                  <div key={a.id} style={{ background: '#fff', borderRadius: '12px', border: '1px solid #BFDBFE', padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                      <div style={{ fontSize: '13px', color: '#64748B' }}>出店者：<strong style={{ color: '#1a1a1a' }}>{a.sellerName}</strong> ／ 案件：<strong style={{ color: '#1a1a1a' }}>{a.placeTitle}</strong></div>
                      <span style={{ fontSize: '11px', color: '#94A3B8' }}>{a.format || '形態未設定'}</span>
                    </div>
                    <div style={{ fontSize: '13px', color: '#444', marginBottom: '10px' }}>出店希望日：{a.apply_date ? new Date(a.apply_date).toLocaleDateString('ja-JP') : '—'}</div>
                    {/* 承認の判断に必要な出店者の情報 */}
                    <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '10px 12px', marginBottom: '10px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                        <tbody>
                          {([
                            ['代表者', a.repName],
                            ['連絡先', [a.email, a.phone].filter(Boolean).join(' ／ ')],
                            ['住所', a.address],
                            ['活動エリア', a.areas],
                            ['ジャンル', a.genre],
                            ['販売形態・車種', [a.salesType, a.vehicleType].filter(Boolean).join(' ／ ')],
                            ['車両サイズ', a.size],
                            ['設備', a.equipment],
                            ['メニュー', a.menu],
                            ['書類', a.docsTotal > 0 ? `${a.docsOk}/${a.docsTotal}件 承認済` : '未提出'],
                          ] as [string, string][]).map(([label, val]) => (
                            <tr key={label}>
                              <td style={{ padding: '3px 8px 3px 0', color: '#64748B', whiteSpace: 'nowrap', verticalAlign: 'top', width: '112px' }}>{label}</td>
                              {/* 未入力も「未登録」と出して、情報が足りないことが分かるようにする */}
                              <td style={{ padding: '3px 0', color: val ? '#1a1a1a' : '#DC2626', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{val || '未登録'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {a.bio && <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #E2E8F0', fontSize: '12px', color: '#475569', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{a.bio}</div>}
                      {(() => {
                        // 承認の判断に必要な情報がどれだけ埋まっているかを出す
                        const missing = [
                          !a.genre && 'ジャンル', !a.salesType && '販売形態', !a.size && '車両サイズ',
                          !a.equipment && '設備', !a.menu && 'メニュー', a.docsTotal === 0 && '書類',
                        ].filter(Boolean) as string[]
                        if (missing.length === 0) return null
                        return (
                          <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #E2E8F0', fontSize: '11px', color: '#DC2626', lineHeight: 1.7 }}>
                            この出店者は次の項目が未登録です：{missing.join('・')}
                          </div>
                        )
                      })()}
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button onClick={() => setAppStatus(a.id, 'approved')} style={{ background: '#16A34A', color: '#fff', border: 'none', borderRadius: '6px', padding: '7px 16px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>承認</button>
                      <button onClick={() => { if (window.confirm('この応募を却下しますか？')) setAppStatus(a.id, 'rejected') }} style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', borderRadius: '6px', padding: '7px 16px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>却下</button>
                      {a.sellerId && (
                        <a href={'/sellers/' + a.sellerId + '?preview=1'} target='_blank' rel='noopener noreferrer' style={{ background: '#EBF6FD', color: '#1D4ED8', border: '1px solid #BFDBFE', borderRadius: '6px', padding: '7px 14px', fontSize: '12px', fontWeight: '700', textDecoration: 'none' }}>プロフィールを見る</a>
                      )}
                      <button onClick={() => setTab('docs')} style={{ background: '#fff', color: '#B45309', border: '1px solid #FDE68A', borderRadius: '6px', padding: '7px 14px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>書類を確認</button>
                      <button onClick={() => exportPendingCsv([a], a.sellerName)} style={{ background: '#fff', color: '#64748B', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '7px 14px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>社内確認用CSV</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            )
          })()}

          {tab === 'meetings' && (
            <div>
              <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: '#1D4ED8' }}>
                掲載を検討している施設・企業さまからの打ち合わせ希望です。ご希望の方法（Zoom／対面）に合わせてご連絡ください。<br />
                対応が済んだものは「完了にする」を押すと削除できるようになります。
              </div>
              {(() => {
                const counts = { new: 0, in_progress: 0, done: 0 } as Record<string, number>
                for (const m of meetings) counts[m.status] = (counts[m.status] || 0) + 1
                const doneIds = meetings.filter(m => m.status === 'done').map(m => m.id)
                return (
                  <div style={{ display: 'flex', gap: '10px', marginBottom: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
                    {Object.entries(MEET_STATUS).map(([k, v]) => (
                      <span key={k} style={{ background: v.bg, color: v.color, borderRadius: '999px', padding: '5px 14px', fontSize: '12px', fontWeight: 700 }}>
                        {v.label} {counts[k] || 0}件
                      </span>
                    ))}
                    <div style={{ flex: 1 }} />
                    {doneIds.length > 0 && (
                      <button onClick={() => deleteMeetings(doneIds, `完了した相談 ${doneIds.length}件をまとめて削除します。`)}
                        style={{ background: '#fff', color: '#DC2626', border: '1px solid #FECACA', borderRadius: '8px', padding: '7px 14px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                        完了分をまとめて削除（{doneIds.length}件）
                      </button>
                    )}
                  </div>
                )
              })()}
              {meetingsLoading && <div style={{ color: '#999', fontSize: '13px', padding: '16px', textAlign: 'center' }}>読み込み中...</div>}
              {!meetingsLoading && meetings.length === 0 && (
                <div style={{ color: '#999', fontSize: '13px', padding: '20px', background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', textAlign: 'center' }}>まだ打ち合わせのご希望はありません。</div>
              )}
              <div style={{ display: 'grid', gap: '12px' }}>
                {meetings.map(m => {
                  const st = MEET_STATUS[m.status] || MEET_STATUS.new
                  return (
                    <div key={m.id} style={{ background: '#fff', borderRadius: '12px', border: m.status === 'new' ? '1px solid #FECACA' : '1px solid #E2E8F0', padding: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ background: st.bg, color: st.color, borderRadius: '4px', padding: '2px 10px', fontSize: '11px', fontWeight: 700 }}>{st.label}</span>
                          <span style={{ background: '#EFF6FF', color: '#1D4ED8', borderRadius: '4px', padding: '2px 10px', fontSize: '11px', fontWeight: 700 }}>{METHOD_LABEL[m.method] || m.method}</span>
                          <strong style={{ fontSize: '14px', color: '#1a1a1a' }}>{m.company || m.name}</strong>
                        </div>
                        <span style={{ fontSize: '11px', color: '#94A3B8' }}>{new Date(m.created_at).toLocaleString('ja-JP')}</span>
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '10px' }}>
                        <tbody>
                          {([
                            ['ご担当者', m.name],
                            ['連絡先', [m.email, m.phone].filter(Boolean).join(' ／ ')],
                            ['ご希望の日時', m.preferred_dates || ''],
                            ['ご相談内容', m.message || ''],
                          ] as [string, string][]).filter(r => r[1]).map(([label, val]) => (
                            <tr key={label}>
                              <td style={{ padding: '3px 8px 3px 0', color: '#64748B', whiteSpace: 'nowrap', verticalAlign: 'top', width: '96px' }}>{label}</td>
                              <td style={{ padding: '3px 0', color: '#1a1a1a', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{val}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <a href={'mailto:' + m.email} style={{ background: '#F5A623', color: '#fff', borderRadius: '6px', padding: '7px 14px', fontSize: '12px', fontWeight: 700, textDecoration: 'none' }}>メールで連絡</a>
                        {m.status !== 'in_progress' && <button onClick={() => setMeetingStatus(m.id, 'in_progress')} style={{ background: '#FFFBEB', color: '#B45309', border: '1px solid #FDE68A', borderRadius: '6px', padding: '7px 14px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>対応中にする</button>}
                        {m.status !== 'done' && <button onClick={() => setMeetingStatus(m.id, 'done')} style={{ background: '#ECFDF5', color: '#16A34A', border: '1px solid #A7F3D0', borderRadius: '6px', padding: '7px 14px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>完了にする</button>}
                        {m.status !== 'new' && <button onClick={() => setMeetingStatus(m.id, 'new')} style={{ background: '#fff', color: '#64748B', border: '1px solid #E2E8F0', borderRadius: '6px', padding: '7px 14px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>未対応に戻す</button>}
                        {m.status === 'done' && (
                          <button onClick={() => deleteMeetings([m.id], `「${m.company || m.name}」の相談を削除します。`)}
                            style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', borderRadius: '6px', padding: '7px 14px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>削除</button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {tab === 'reviews' && (() => {
            const pending = reviewList.filter(r => r.status === 'pending')
            const done = reviewList.filter(r => r.status !== 'pending')
            const Stars = ({ n }: { n: number }) => (<span style={{ color: '#F5A623', letterSpacing: '1px' }}>{'\u2605'.repeat(n)}<span style={{ color: '#ddd' }}>{'\u2605'.repeat(5 - n)}</span></span>)
            return (
            <div>
              <div style={{ background: '#FFF8E1', border: '1px solid #FFE082', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: '#B45309', display: 'flex', gap: '8px' }}>
                <span>お客様から投稿されたレビューを承認すると、出店者紹介ページに公開されます。却下すると公開されません。</span>
              </div>

              <h3 style={{ fontSize: '14px', fontWeight: '900', color: '#1a1a1a', margin: '0 0 10px' }}>承認待ち（{pending.length}件）</h3>
              <div style={{ display: 'grid', gap: '12px', marginBottom: '28px' }}>
                {reviewsLoading && <div style={{ color: '#999', fontSize: '13px', padding: '16px', textAlign: 'center' }}>読み込み中...</div>}
                {!reviewsLoading && pending.length === 0 && <div style={{ color: '#999', fontSize: '13px', padding: '16px', background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', textAlign: 'center' }}>承認待ちのレビューはありません。</div>}
                {pending.map(r => (
                  <div key={r.id} style={{ background: '#fff', borderRadius: '12px', border: '1px solid #FFE082', padding: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '6px' }}>
                      <div style={{ fontSize: '13px', color: '#64748B' }}>出店者：<strong style={{ color: '#1a1a1a' }}>{r.sellerName}</strong> ／ 投稿者：{r.reviewer_name || '匿名'}</div>
                      <Stars n={r.rating} />
                    </div>
                    {r.comment && <div style={{ fontSize: '14px', color: '#444', lineHeight: 1.7, whiteSpace: 'pre-wrap', marginBottom: '10px' }}>{r.comment}</div>}
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button onClick={() => setReviewStatus(r.id, 'approved')} style={{ background: '#16A34A', color: '#fff', border: 'none', borderRadius: '6px', padding: '7px 16px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>承認して公開</button>
                      <button onClick={() => { if (window.confirm('このレビューを却下しますか？')) setReviewStatus(r.id, 'rejected') }} style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', borderRadius: '6px', padding: '7px 16px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>却下</button>
                      <span style={{ fontSize: '11px', color: '#94A3B8', marginLeft: 'auto' }}>{new Date(r.created_at).toLocaleDateString('ja-JP')}</span>
                    </div>
                  </div>
                ))}
              </div>

              <h3 style={{ fontSize: '14px', fontWeight: '900', color: '#1a1a1a', margin: '0 0 10px' }}>処理済み（{done.length}件）</h3>
              <div style={{ display: 'grid', gap: '10px' }}>
                {done.length === 0 && <div style={{ color: '#999', fontSize: '13px', padding: '16px', background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', textAlign: 'center' }}>処理済みのレビューはまだありません。</div>}
                {done.map(r => (
                  <div key={r.id} style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '14px', opacity: r.status === 'rejected' ? 0.6 : 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap', gap: '6px' }}>
                      <div style={{ fontSize: '12px', color: '#64748B' }}>出店者：<strong style={{ color: '#1a1a1a' }}>{r.sellerName}</strong> ／ 投稿者：{r.reviewer_name || '匿名'}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Stars n={r.rating} />
                        <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '999px', background: r.status === 'approved' ? '#ECFDF5' : '#FEE2E2', color: r.status === 'approved' ? '#16A34A' : '#DC2626' }}>{r.status === 'approved' ? '公開中' : '却下'}</span>
                      </div>
                    </div>
                    {r.comment && <div style={{ fontSize: '13px', color: '#555', lineHeight: 1.6, whiteSpace: 'pre-wrap', marginBottom: '8px' }}>{r.comment}</div>}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {r.status === 'approved'
                        ? <button onClick={() => { if (window.confirm('公開を取り消して却下にしますか？')) setReviewStatus(r.id, 'rejected') }} style={{ background: '#fff', color: '#DC2626', border: '1px solid #FECACA', borderRadius: '6px', padding: '5px 12px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>公開を取り消す</button>
                        : <button onClick={() => setReviewStatus(r.id, 'approved')} style={{ background: '#fff', color: '#16A34A', border: '1px solid #BBF7D0', borderRadius: '6px', padding: '5px 12px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>承認して公開する</button>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            )
          })()}

          {tab === 'publish' && (() => {
            const pending = pubReqs.filter(r => r.approval_status === 'pending')
            const rejected = pubReqs.filter(r => r.approval_status === 'rejected')
            const toArr = (v: string[] | string | null): string[] => {
              if (!v) return []
              if (Array.isArray(v)) return v.map(x => String(x).replace(/^[\[\]"'\s]+|[\[\]"'\s]+$/g, '')).filter(Boolean)
              const t = String(v).trim()
              try { const j = JSON.parse(t); if (Array.isArray(j)) return j.map(x => String(x)).filter(Boolean) } catch {}
              return t.split(/[,、，]/).map(x => x.replace(/^[\[\]"'\s]+|[\[\]"'\s]+$/g, '')).filter(Boolean)
            }
            const Card = ({ r }: { r: PubReq }) => (
              <div style={{ background: '#fff', borderRadius: '12px', border: r.approval_status === 'pending' ? '1px solid #FFE082' : '1px solid #E2E8F0', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: '#1a1a1a' }}>{r.shop_name || '（店名未登録）'}</div>
                    <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>{genreText(r.genre) || 'ジャンル未設定'}{toArr(r.areas).length > 0 ? ' ／ ' + toArr(r.areas).join('・') : ''}</div>
                    <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>申請日時：{r.submitted_at ? new Date(r.submitted_at).toLocaleString('ja-JP') : '—'}</div>
                  </div>
                  {r.approval_status === 'rejected' && <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 10px', borderRadius: '999px', background: '#FEE2E2', color: '#DC2626', flexShrink: 0 }}>非承認</span>}
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <a href={'/sellers/' + r.id + '?preview=1'} target='_blank' rel='noopener noreferrer' style={{ background: '#EBF6FD', color: '#1D4ED8', border: '1px solid #BFDBFE', borderRadius: '6px', padding: '7px 14px', fontSize: '12px', fontWeight: 700, textDecoration: 'none', display: 'inline-block' }}>プレビュー</a>
                  <button onClick={() => setApproval(r.id, 'approved')} style={{ background: '#16A34A', color: '#fff', border: 'none', borderRadius: '6px', padding: '7px 16px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>承認して公開</button>
                  {r.approval_status === 'pending' && <button onClick={() => { if (window.confirm('この申請を非承認にしますか？')) setApproval(r.id, 'rejected') }} style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', borderRadius: '6px', padding: '7px 16px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>非承認</button>}
                </div>
              </div>
            )
            return (
            <div>
              <div style={{ background: '#FFF8E1', border: '1px solid #FFE082', borderRadius: '10px', padding: '12px 16px', marginBottom: '16px', fontSize: '13px', color: '#B45309', display: 'flex', gap: '8px' }}>
                <span>出店者が「公開を申請」すると、ここに表示されます。承認すると出店者一覧（/sellers）に公開されます。</span>
              </div>
              <h3 style={{ fontSize: '14px', fontWeight: 900, color: '#1a1a1a', margin: '0 0 10px' }}>承認待ち（{pending.length}件）</h3>
              <div style={{ display: 'grid', gap: '12px', marginBottom: '28px' }}>
                {pubLoading && <div style={{ color: '#999', fontSize: '13px', padding: '16px', textAlign: 'center' }}>読み込み中...</div>}
                {!pubLoading && pending.length === 0 && <div style={{ color: '#999', fontSize: '13px', padding: '16px', background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', textAlign: 'center' }}>承認待ちの申請はありません。</div>}
                {pending.map(r => <Card key={r.id} r={r} />)}
              </div>
              <h3 style={{ fontSize: '14px', fontWeight: 900, color: '#1a1a1a', margin: '0 0 10px' }}>非承認（{rejected.length}件）</h3>
              <div style={{ display: 'grid', gap: '10px' }}>
                {!pubLoading && rejected.length === 0 && <div style={{ color: '#999', fontSize: '13px', padding: '16px', background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', textAlign: 'center' }}>非承認の申請はありません。</div>}
                {rejected.map(r => <Card key={r.id} r={r} />)}
              </div>
            </div>
            )
          })()}

          {tab === 'blog' && (
            <div>
              <div style={{ background: '#EBF6FD', border: '1px solid #93C5FD', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', fontSize: '13px', color: '#1D4ED8', display: 'flex', gap: '8px' }}>
                <span>ブログ記事を作成・公開できます。公開した記事は <b>/blog</b> に表示され、検索エンジンにも登録されます。本文はMarkdown（見出しは # ## 、箇条書きは - ）で書けます。</span>
              </div>

              {/* 投稿フォーム */}
              <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '20px', marginBottom: '28px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: 900, color: '#1a1a1a', margin: 0 }}>{editingPost ? '記事を編集' : '新規記事を作成'}</h3>
                  {editingPost && <button onClick={resetPostForm} style={{ background: '#F1F5F9', color: '#475569', border: 'none', borderRadius: '6px', padding: '6px 14px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>新規作成に戻る</button>}
                </div>
                <div style={{ display: 'grid', gap: '14px' }}>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>タイトル <span style={{ color: '#DC2626' }}>*</span></label>
                    <input type="text" value={pTitle} onChange={e => setPTitle(e.target.value)} placeholder="例：キッチンカー開業の費用はいくら？初期費用の内訳と抑えるコツ" style={{ width: '100%', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>URL（半角英数字） <span style={{ color: '#DC2626' }}>*</span></label>
                      <input type="text" value={pSlug} onChange={e => setPSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} placeholder="kitchen-car-startup-cost" style={{ width: '100%', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'monospace' }} />
                      <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '3px' }}>公開URL: /blog/{pSlug || '（ここに入る）'}</div>
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>カテゴリ</label>
                      <input type="text" value={pCategory} onChange={e => setPCategory(e.target.value)} placeholder="ガイド / インタビュー / トレンド など" style={{ width: '100%', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>絵文字</label>
                      <input type="text" value={pEmoji} onChange={e => setPEmoji(e.target.value)} placeholder="📝" style={{ width: '100%', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '10px 12px', fontSize: '20px', outline: 'none', boxSizing: 'border-box', textAlign: 'center' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>抜粋（一覧に表示される短い説明）</label>
                      <input type="text" value={pExcerpt} onChange={e => setPExcerpt(e.target.value)} placeholder="記事の要約を1〜2文で" style={{ width: '100%', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>メタディスクリプション（SEO用・検索結果に出る説明文 120字程度）</label>
                    <textarea value={pMeta} onChange={e => setPMeta(e.target.value)} rows={2} placeholder="検索結果に表示される説明。キーワードを含めて120字程度で。" style={{ width: '100%', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'inherit' }} />
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap', gap: '6px' }}>
                      <label style={{ fontSize: '12px', fontWeight: 700, color: '#475569' }}>本文（Markdown） <span style={{ color: '#DC2626' }}>*</span></label>
                      <div>
                        <input ref={blogImgInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadBlogImage(f); if (e.target) e.target.value = '' }} />
                        <button type="button" disabled={imgUploading} onClick={() => blogImgInputRef.current?.click()} style={{ background: imgUploading ? '#F1F5F9' : '#EBF6FD', color: '#1D4ED8', border: '1px solid #BFDBFE', borderRadius: '6px', padding: '6px 14px', fontSize: '12px', fontWeight: 700, cursor: imgUploading ? 'default' : 'pointer' }}>{imgUploading ? 'アップロード中...' : '画像を挿入'}</button>
                      </div>
                    </div>
                    <textarea value={pContent} onChange={e => setPContent(e.target.value)} rows={16} placeholder={'# 見出し1\n\n本文をここに書きます。\n\n## 見出し2\n\n- 箇条書き1\n- 箇条書き2'} style={{ width: '100%', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '12px', fontSize: '13px', outline: 'none', boxSizing: 'border-box', resize: 'vertical', fontFamily: 'monospace', lineHeight: 1.7 }} />
                  </div>
                  {pMsg && <div style={{ fontSize: '13px', fontWeight: 700, color: pMsgOk ? '#16A34A' : '#DC2626', padding: '8px 0' }}>{pMsg}</div>}
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    <button disabled={pSaving} onClick={() => savePost('published')} style={{ background: '#16A34A', color: '#fff', border: 'none', borderRadius: '8px', padding: '11px 24px', fontSize: '14px', fontWeight: 700, cursor: pSaving ? 'default' : 'pointer', opacity: pSaving ? 0.6 : 1 }}>{pSaving ? '保存中...' : (editingPost ? '更新して公開' : '公開する')}</button>
                    <button disabled={autoPosting} onClick={runAutoPost} style={{ background: autoPosting ? '#ccc' : '#1D4ED8', color: '#fff', border: 'none', borderRadius: '8px', padding: '11px 20px', fontSize: '14px', fontWeight: 700, cursor: autoPosting ? 'default' : 'pointer' }}>
                      {autoPosting ? 'AIが作成中...' : 'AIで1本作って公開'}
                    </button>
                    <button disabled={pSaving} onClick={() => savePost('draft')} style={{ background: '#fff', color: '#475569', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '11px 24px', fontSize: '14px', fontWeight: 700, cursor: pSaving ? 'default' : 'pointer', opacity: pSaving ? 0.6 : 1 }}>下書き保存</button>
                  </div>
                </div>
              </div>

              {/* 記事一覧 */}
              <h3 style={{ fontSize: '14px', fontWeight: 900, color: '#1a1a1a', margin: '0 0 12px' }}>投稿済みの記事（{posts.length}件）</h3>
              <div style={{ display: 'grid', gap: '10px' }}>
                {postsLoading && <div style={{ color: '#999', fontSize: '13px', padding: '16px', textAlign: 'center' }}>読み込み中...</div>}
                {!postsLoading && posts.length === 0 && <div style={{ color: '#999', fontSize: '13px', padding: '20px', background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', textAlign: 'center' }}>まだ記事がありません。上のフォームから作成してください。</div>}
                {posts.map(p => (
                  <div key={p.id} style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '16px', display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                    <div style={{ fontSize: '32px', flexShrink: 0 }}>{p.cover_emoji || '📝'}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 10px', borderRadius: '999px', background: p.status === 'published' ? '#DCFCE7' : '#FEF3C7', color: p.status === 'published' ? '#16A34A' : '#B45309' }}>{p.status === 'published' ? '公開中' : '下書き'}</span>
                        {p.category && <span style={{ fontSize: '11px', color: '#64748B' }}>{p.category}</span>}
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#1a1a1a', lineHeight: 1.5 }}>{p.title}</div>
                      <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px', fontFamily: 'monospace' }}>/blog/{p.slug}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
                      {p.status === 'published' && <button onClick={() => window.open('/blog/' + p.slug, '_blank')} style={{ background: '#EBF6FD', color: '#1D4ED8', border: '1px solid #BFDBFE', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>見る</button>}
                      <button onClick={() => startEditPost(p)} style={{ background: '#F5A623', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>編集</button>
                      <button onClick={() => deletePost(p)} style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>削除</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'imported' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ fontSize: '13px', color: '#64748B' }}>全 <b style={{ color: '#1a1a1a' }}>{importedTotal.toLocaleString()}</b> 件のインポート名簿</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input type="text" value={importedKw} onChange={e => setImportedKw(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { setImportedPage(0); loadImported() } }} placeholder="店舗名・代表者・メールで検索" style={{ border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', outline: 'none', width: '260px', maxWidth: '60vw' }} />
                  <button onClick={() => { setImportedPage(0); loadImported() }} style={{ background: '#F5A623', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}>検索</button>
                </div>
              </div>
              <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', minWidth: '900px' }}>
                  <thead>
                    <tr style={{ background: '#F8FAFC' }}>
                      {['No.', '店舗名・屋号', '代表者', 'メール', '電話番号', '住所', '販売エリア', '登録日'].map(h => (
                        <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: '11px', color: '#64748B', fontWeight: '600', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {importedLoading && (<tr><td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: '#999' }}>読み込み中...</td></tr>)}
                    {!importedLoading && imported.length === 0 && (<tr><td colSpan={8} style={{ padding: '24px', textAlign: 'center', color: '#999' }}>該当するデータがありません。</td></tr>)}
                    {imported.map((s, i) => (
                      <tr key={s.id} style={{ borderBottom: i < imported.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                        <td style={{ padding: '10px 12px', color: '#94A3B8' }}>{s.reg_no ?? '—'}</td>
                        <td style={{ padding: '10px 12px', fontWeight: '600' }}>{s.shop_name || '—'}</td>
                        <td style={{ padding: '10px 12px' }}>{s.rep_name || '—'}</td>
                        <td style={{ padding: '10px 12px', color: '#3A9BD5' }}>{s.email || '—'}</td>
                        <td style={{ padding: '10px 12px', color: '#64748B', whiteSpace: 'nowrap' }}>{s.phone || '—'}</td>
                        <td style={{ padding: '10px 12px', color: '#64748B', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.address || ''}>{s.address || '—'}</td>
                        <td style={{ padding: '10px 12px', color: '#64748B', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.area || ''}>{s.area || '—'}</td>
                        <td style={{ padding: '10px 12px', color: '#94A3B8', whiteSpace: 'nowrap' }}>{s.registered_at ? new Date(s.registered_at).toLocaleDateString('ja-JP') : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginTop: '16px' }}>
                <button disabled={importedPage === 0} onClick={() => setImportedPage(p => Math.max(0, p - 1))} style={{ background: importedPage === 0 ? '#F1F5F9' : '#fff', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', cursor: importedPage === 0 ? 'default' : 'pointer', color: importedPage === 0 ? '#CBD5E1' : '#1a1a1a' }}>← 前へ</button>
                <span style={{ fontSize: '13px', color: '#64748B' }}>{importedPage + 1} / {Math.max(1, Math.ceil(importedTotal / IMPORTED_PER_PAGE))} ページ</span>
                <button disabled={(importedPage + 1) * IMPORTED_PER_PAGE >= importedTotal} onClick={() => setImportedPage(p => p + 1)} style={{ background: (importedPage + 1) * IMPORTED_PER_PAGE >= importedTotal ? '#F1F5F9' : '#fff', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', cursor: (importedPage + 1) * IMPORTED_PER_PAGE >= importedTotal ? 'default' : 'pointer', color: (importedPage + 1) * IMPORTED_PER_PAGE >= importedTotal ? '#CBD5E1' : '#1a1a1a' }}>次へ →</button>
              </div>
            </>
          )}
          {tab === 'csv' && (
            <>
              <div style={{ background: '#EBF6FD', border: '1px solid #93C5FD', borderRadius: '10px', padding: '14px 18px', marginBottom: '20px', fontSize: '13px', color: '#1D4ED8', lineHeight: 1.8 }}>
                <div style={{ fontWeight: '700', marginBottom: '6px' }}>CSVフォーマットについて</div>
                1行目はヘッダー行として扱われます。以下の順番でカラムを並べてください：<br />
                <code style={{ background: 'rgba(255,255,255,0.6)', padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>
                  出店者名, 店舗名, メール, 電話番号, ジャンル, エリア, SNS
                </code>
              </div>

              <div style={{ background: '#fff', borderRadius: '12px', border: '2px dashed #E2E8F0', padding: '40px', textAlign: 'center', marginBottom: '20px', cursor: 'pointer' }}
                onClick={() => fileRef.current?.click()}>
                <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '6px' }}>CSVファイルをクリックして選択</div>
                <div style={{ fontSize: '12px', color: '#64748B' }}>UTF-8形式のCSVファイル（.csv）に対応</div>
                <input ref={fileRef} type="file" accept=".csv" onChange={handleCSV} style={{ display: 'none' }} />
              </div>

              {/* サンプルCSVダウンロード */}
              <div style={{ marginBottom: '20px', textAlign: 'center' }}>
                <button
                  onClick={() => {
                    const esc = (v: string) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'
                    const header = ['出店者名', '店舗名', 'メール', '電話番号', 'ジャンル', 'エリア'].join(',')
                    const rows = sellers.map(s => [s.name, s.shop, s.email, s.phone, s.genre, s.area].map(esc).join(','))
                    const csv = [header, ...rows].join('\n')
                    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url; a.download = 'sellers.csv'; a.click()
                  }}
                  style={{ background: '#fff', border: '1.5px solid #3A9BD5', color: '#1D4ED8', borderRadius: '8px', padding: '9px 20px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
                >
                  出店者一覧をCSVでダウンロード
                </button>
              </div>

              {csvPreview.length > 0 && (
                <>
                  <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden', marginBottom: '16px' }}>
                    <div style={{ padding: '12px 18px', borderBottom: '1px solid #E2E8F0', fontWeight: '700', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>プレビュー（{csvPreview.length - 1}件）</span>
                      {csvImported && <span style={{ color: '#16A34A', fontWeight: '700', fontSize: '12px' }}>インポート完了！</span>}
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                        <thead>
                          <tr style={{ background: '#F8FAFC' }}>
                            {csvPreview[0]?.map((h, i) => (
                              <th key={i} style={{ padding: '8px 12px', textAlign: 'left', fontSize: '11px', color: '#64748B', borderBottom: '1px solid #E2E8F0', whiteSpace: 'nowrap' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {csvPreview.slice(1).map((row, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                              {row.map((cell, j) => (
                                <td key={j} style={{ padding: '8px 12px', color: '#333' }}>{cell}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  {!csvImported && (
                    <div style={{ textAlign: 'center' }}>
                      <button onClick={importCSV} style={{ background: '#F5A623', color: '#fff', border: 'none', borderRadius: '8px', padding: '12px 32px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>
                        {csvPreview.length - 1}件をインポートする
                      </button>
                    </div>
                  )}
                  {csvImported && (
                    <div style={{ textAlign: 'center' }}>
                      <button onClick={() => setTab('sellers')} style={{ background: '#16A34A', color: '#fff', border: 'none', borderRadius: '8px', padding: '12px 32px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>
                        出店者一覧を確認する
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
      {/* 書類画像プレビュー用モーダル（横向き対応・回転ボタン付き） */}
      {previewImg && (
        <div
          onClick={() => setPreviewImg(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
        >
          <div style={{ display: 'flex', gap: '10px', marginBottom: '14px' }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setPreviewRotation(r => (r - 90 + 360) % 360)} style={{ background: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>↺ 左に回転</button>
            <button onClick={() => setPreviewRotation(r => (r + 90) % 360)} style={{ background: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>↻ 右に回転</button>
            <button onClick={() => setPreviewImg(null)} style={{ background: '#F5A623', color: '#fff', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>✕ 閉じる</button>
          </div>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', maxWidth: '100%', maxHeight: 'calc(100% - 60px)', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <img
              src={previewImg}
              alt="書類プレビュー"
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', transform: 'rotate(' + previewRotation + 'deg)', imageOrientation: 'from-image', transition: 'transform 0.2s' }}
            />
          </div>
        </div>
      )}
    </div>
  )
}
