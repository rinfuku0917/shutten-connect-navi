'use client'
import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabase'

// ダミーデータ
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
  const [tab, setTab] = useState<'dashboard' | 'places' | 'sellers' | 'csv' | 'place-edit' | 'docs'>('dashboard')
  const [editPlace, setEditPlace] = useState<typeof dummyPlaces[0] | null>(null)
  const [sellers, setSellers] = useState(dummySellers)
  const [csvPreview, setCsvPreview] = useState<string[][]>([])
  const [csvImported, setCsvImported] = useState(false)
  const [showNewPlace, setShowNewPlace] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // ===== 書類審査（管理者） =====
  type DocReview = { id: string, seller_id: string, doc_type: string, file_url: string, status: string, uploaded_at: string, sellerName: string }
  const [docReviews, setDocReviews] = useState<DocReview[]>([])
  const [docsLoading, setDocsLoading] = useState(false)
  const [authChecked, setAuthChecked] = useState(false)
  const docTypeLabels: Record<string, string> = { license_front: '運転免許証（表面）', license_back: '運転免許証（裏面）', food_hygiene: '食品衛生責任者証', liability_insurance: '損害賠償保険証書', other_permit: 'その他許可証' }

  // 管理者ガード：admin以外は追い出す
  useEffect(() => {
    const checkAdmin = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
      if (profile?.role !== 'admin') { router.push('/login'); return }
      try {
        const saved = localStorage.getItem('adminTab')
        if (saved && ['dashboard','places','sellers','csv','docs'].includes(saved)) {
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
      .select('id, seller_id, doc_type, file_url, status, uploaded_at, profiles(name)')
      .order('uploaded_at', { ascending: false })
    const mapped: DocReview[] = (data || []).map((d: any) => ({
      id: d.id, seller_id: d.seller_id, doc_type: d.doc_type, file_url: d.file_url,
      status: d.status, uploaded_at: d.uploaded_at, sellerName: d.profiles?.name || '(出店者)'
    }))
    setDocReviews(mapped)
    setDocsLoading(false)
  }

  // docsタブを開いたら読み込む
  useEffect(() => { if (tab === 'docs' && authChecked) loadDocReviews() }, [tab, authChecked])

  // 書類のプレビュー（署名付きURLを新規タブで開く）
  const previewDoc = async (fileUrl: string) => {
    const { data, error } = await supabase.storage.from('seller-documents').createSignedUrl(fileUrl, 60)
    if (error || !data) { alert('プレビューURLの生成に失敗しました: ' + (error?.message || '')); return }
    window.open(data.signedUrl, '_blank')
  }

  // 承認/否認
  const reviewDoc = async (id: string, status: 'approved' | 'rejected') => {
    const { error } = await supabase.from('seller_documents').update({ status }).eq('id', id)
    if (error) { alert('更新失敗: ' + error.message); return }
    loadDocReviews()
  }

  const stats = [
    { label: '総出店者数', value: '3,410', icon: '👤', color: '#F5A623' },
    { label: '総募集者数', value: '892', icon: '🏪', color: '#3A9BD5' },
    { label: '掲載案件数', value: '1,248', icon: '📋', color: '#16A34A' },
    { label: '今月の申込', value: '312', icon: '📬', color: '#7C3AED' },
  ]

  const handleCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const rows = text.split('\n').filter(r => r.trim()).map(r => r.split(',').map(c => c.trim().replace(/^"|"$/g, '')))
      setCsvPreview(rows)
      setCsvImported(false)
    }
    reader.readAsText(file, 'UTF-8')
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
            { key: 'dashboard', icon: '📊', label: 'ダッシュボード' },
            { key: 'places', icon: '📋', label: '案件管理' },
            { key: 'sellers', icon: '👥', label: '出店者管理' },
            { key: 'docs', icon: '📂', label: '書類審査' },
            { key: 'csv', icon: '📥', label: 'CSVインポート' },
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
              <span>{item.icon}</span>{item.label}
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <div style={{ fontSize: '12px', color: '#64748B' }}>{s.label}</div>
                      <div style={{ fontSize: '20px' }}>{s.icon}</div>
                    </div>
                    <div style={{ fontSize: '28px', fontWeight: '900', color: s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>

              <div className='admin-two-col' style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden' }}>
                  <div style={{ padding: '14px 18px', borderBottom: '1px solid #E2E8F0', fontWeight: '700', fontSize: '14px' }}>📬 最新の申込</div>
                  <div style={{ padding: '0' }}>
                    {[
                      { name: '山田 花子', place: '渋谷ヒカリエ前マルシェ', date: '6/7', status: '審査中' },
                      { name: '田中 健太', place: '大阪城公園フリマ', date: '6/14', status: '承認済' },
                      { name: '鈴木 次郎', place: '代々木公園マルシェ', date: '6/21', status: '審査中' },
                    ].map((a, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 18px', borderBottom: '1px solid #F1F5F9' }}>
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
                  <div style={{ padding: '14px 18px', borderBottom: '1px solid #E2E8F0', fontWeight: '700', fontSize: '14px' }}>👤 最新の登録者</div>
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
                  <input type="text" placeholder="🔍 案件名・エリアで検索" style={{ border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', outline: 'none', flex: 1, minWidth: 0 }} />
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
                  <div style={{ fontWeight: '700', fontSize: '14px', marginBottom: '14px', color: '#B45309' }}>📋 新規案件作成</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                    {[
                      { label: '案件タイトル', placeholder: '例：渋谷ヒカリエ前 週末マルシェ', full: true },
                      { label: '募集者名（オーナー）', placeholder: '例：渋谷マルシェ実行委員会' },
                      { label: 'エリア', placeholder: '例：東京都渋谷区' },
                      { label: '出店形態', placeholder: '例：キッチンカー' },
                      { label: '日程', placeholder: '例：毎週土日' },
                      { label: '時間', placeholder: '例：10:00〜17:00' },
                      { label: '出店料', placeholder: '例：5,000円/日' },
                      { label: '最大枠数', placeholder: '例：5' },
                    ].map((f, i) => (
                      <div key={i} style={f.full ? { gridColumn: '1 / -1' } : {}}>
                        <label style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', display: 'block', marginBottom: '4px' }}>{f.label}</label>
                        <input type="text" placeholder={f.placeholder} style={{ width: '100%', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                      </div>
                    ))}
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', display: 'block', marginBottom: '4px' }}>募集内容・詳細</label>
                      <textarea style={{ width: '100%', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', outline: 'none', resize: 'vertical', minHeight: '80px', boxSizing: 'border-box' }} placeholder="募集内容を詳しく入力してください" />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                    <button onClick={() => setShowNewPlace(false)} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '9px 18px', fontSize: '13px', cursor: 'pointer' }}>キャンセル</button>
                    <button style={{ background: '#F5A623', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }} onClick={() => { setShowNewPlace(false); alert('案件を作成しました（Supabase接続後に保存されます）') }}>下書き保存</button>
                    <button style={{ background: '#16A34A', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }} onClick={() => { setShowNewPlace(false); alert('案件を公開しました') }}>公開する</button>
                  </div>
                </div>
              )}

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
                    {dummyPlaces.map((place, i) => (
                      <tr key={place.id} style={{ borderBottom: i < dummyPlaces.length - 1 ? '1px solid #F1F5F9' : 'none' }}>
                        <td style={{ padding: '12px 14px', fontWeight: '600' }}>{place.title}</td>
                        <td style={{ padding: '12px 14px', color: '#64748B', fontSize: '12px' }}>{place.host}</td>
                        <td style={{ padding: '12px 14px', color: '#64748B', fontSize: '12px' }}>{place.area}</td>
                        <td style={{ padding: '12px 14px', color: '#64748B', fontSize: '12px' }}>{place.type}</td>
                        <td style={{ padding: '12px 14px' }}><span style={{ background: '#EBF6FD', color: '#1D4ED8', fontWeight: '700', padding: '2px 8px', borderRadius: '20px', fontSize: '11px' }}>{place.applies}件</span></td>
                        <td style={{ padding: '12px 14px' }}><span style={{ background: place.status === '公開中' ? '#ECFDF5' : '#F1F5F9', color: place.status === '公開中' ? '#16A34A' : '#64748B', fontWeight: '700', padding: '2px 8px', borderRadius: '20px', fontSize: '11px' }}>{place.status}</span></td>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button onClick={() => setEditPlace(place)} style={{ fontSize: '11px', padding: '4px 10px', border: '1px solid #E2E8F0', borderRadius: '6px', background: '#fff', cursor: 'pointer', color: '#64748B' }}>✏️ 編集</button>
                            <button style={{ fontSize: '11px', padding: '4px 10px', border: '1px solid #FCA5A5', borderRadius: '6px', background: '#FEE2E2', cursor: 'pointer', color: '#DC2626' }}>🗑️</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {editPlace && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ background: '#fff', borderRadius: '14px', padding: '24px', width: '560px', maxHeight: '80vh', overflowY: 'auto' }}>
                    <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '16px', color: '#B45309' }}>✏️ 案件を編集：{editPlace.title}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                      {[
                        { label: '案件タイトル', value: editPlace.title, full: true },
                        { label: 'オーナー', value: editPlace.host },
                        { label: 'エリア', value: editPlace.area },
                        { label: '出店形態', value: editPlace.type },
                      ].map((f, i) => (
                        <div key={i} style={f.full ? { gridColumn: '1 / -1' } : {}}>
                          <label style={{ fontSize: '11px', fontWeight: '700', color: '#64748B', display: 'block', marginBottom: '4px' }}>{f.label}</label>
                          <input type="text" defaultValue={f.value} style={{ width: '100%', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                      <button onClick={() => setEditPlace(null)} style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '9px 18px', fontSize: '13px', cursor: 'pointer' }}>キャンセル</button>
                      <button onClick={() => { setEditPlace(null); alert('保存しました') }} style={{ background: '#F5A623', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>保存する</button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ===== 出店者管理 ===== */}
          {tab === 'sellers' && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '8px', flex: 1, minWidth: 0 }}>
                  <input type="text" placeholder="🔍 出店者名・メールで検索" style={{ border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', outline: 'none', flex: 1, minWidth: 0 }} />
                  <select style={{ border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', outline: 'none' }}>
                    <option>すべて</option><option>承認済</option><option>審査中</option>
                  </select>
                </div>
                <button onClick={() => setTab('csv')} style={{ background: '#3A9BD5', color: '#fff', border: 'none', borderRadius: '8px', padding: '10px 18px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                  📥 CSVで一括インポート
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
                    {sellers.map((s, i) => (
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
                            <button style={{ fontSize: '10px', padding: '3px 8px', border: '1px solid #E2E8F0', borderRadius: '5px', background: '#fff', cursor: 'pointer' }}>✏️</button>
                            <button style={{ fontSize: '10px', padding: '3px 8px', border: '1px solid #FCA5A5', borderRadius: '5px', background: '#FEE2E2', cursor: 'pointer', color: '#DC2626' }}>🗑️</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* ===== CSVインポート ===== */}
          {tab === 'docs' && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <p style={{ fontSize: '13px', color: '#64748B' }}>出店者が提出した書類を確認し、承認または否認します。</p>
                <button onClick={loadDocReviews} style={{ background: '#fff', color: '#64748B', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>🔄 更新</button>
              </div>
              <div className='admin-table-wrap' style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}>
                      {['出店者', '書類種別', '提出日時', 'ステータス', '操作'].map(h => (
                        <th key={h} style={{ padding: '12px 14px', textAlign: 'left', fontSize: '12px', fontWeight: '700', color: '#64748B' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {docsLoading ? (
                      <tr><td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: '#999' }}>読み込み中...</td></tr>
                    ) : docReviews.length === 0 ? (
                      <tr><td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: '#999' }}>提出された書類はまだありません。</td></tr>
                    ) : docReviews.map(d => {
                      const meta = ({ approved: { label: '承認済', color: '#16A34A', bg: '#ECFDF5' }, pending: { label: '審査中', color: '#92400E', bg: '#FEF3C7' }, rejected: { label: '否認', color: '#DC2626', bg: '#FEE2E2' } } as Record<string, { label: string, color: string, bg: string }>)[d.status] || { label: d.status, color: '#555', bg: '#F1F5F9' }
                      return (
                        <tr key={d.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                          <td style={{ padding: '12px 14px', fontWeight: '600' }}>{d.sellerName}</td>
                          <td style={{ padding: '12px 14px' }}>{docTypeLabels[d.doc_type] || d.doc_type}</td>
                          <td style={{ padding: '12px 14px', color: '#64748B', fontSize: '12px' }}>{new Date(d.uploaded_at).toLocaleString('ja-JP')}</td>
                          <td style={{ padding: '12px 14px' }}>
                            <span style={{ fontSize: '11px', fontWeight: '700', padding: '3px 10px', borderRadius: '20px', background: meta.bg, color: meta.color }}>{meta.label}</span>
                          </td>
                          <td style={{ padding: '12px 14px' }}>
                            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                              <button onClick={() => previewDoc(d.file_url)} style={{ background: '#EBF6FD', color: '#1D4ED8', border: '1px solid #BFDBFE', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>👁️ 確認</button>
                              <button onClick={() => reviewDoc(d.id, 'approved')} style={{ background: '#E8F5E9', color: '#2E7D32', border: '1px solid #A5D6A7', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>承認</button>
                              <button onClick={() => { if (window.confirm('この書類を否認しますか？')) reviewDoc(d.id, 'rejected') }} style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}>否認</button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {tab === 'csv' && (
            <>
              <div style={{ background: '#EBF6FD', border: '1px solid #93C5FD', borderRadius: '10px', padding: '14px 18px', marginBottom: '20px', fontSize: '13px', color: '#1D4ED8', lineHeight: 1.8 }}>
                <div style={{ fontWeight: '700', marginBottom: '6px' }}>📥 CSVフォーマットについて</div>
                1行目はヘッダー行として扱われます。以下の順番でカラムを並べてください：<br />
                <code style={{ background: 'rgba(255,255,255,0.6)', padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>
                  出店者名, 店舗名, メール, 電話番号, ジャンル, エリア, SNS
                </code>
              </div>

              <div style={{ background: '#fff', borderRadius: '12px', border: '2px dashed #E2E8F0', padding: '40px', textAlign: 'center', marginBottom: '20px', cursor: 'pointer' }}
                onClick={() => fileRef.current?.click()}>
                <div style={{ fontSize: '40px', marginBottom: '12px' }}>📂</div>
                <div style={{ fontWeight: '700', fontSize: '15px', marginBottom: '6px' }}>CSVファイルをクリックして選択</div>
                <div style={{ fontSize: '12px', color: '#64748B' }}>UTF-8形式のCSVファイル（.csv）に対応</div>
                <input ref={fileRef} type="file" accept=".csv" onChange={handleCSV} style={{ display: 'none' }} />
              </div>

              {/* サンプルCSVダウンロード */}
              <div style={{ marginBottom: '20px', textAlign: 'center' }}>
                <button
                  onClick={() => {
                    const csv = '出店者名,店舗名,メール,電話番号,ジャンル,エリア,SNS\n山田 花子,Hana\'s Sweets,hanako@example.com,090-1234-5678,焼き菓子,東京都,@hana_sweets\n田中 健太,クラフト工房,kenta@example.com,080-2345-6789,ハンドメイド,大阪府,@craft_kenta'
                    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
                    const url = URL.createObjectURL(blob)
                    const a = document.createElement('a')
                    a.href = url; a.download = 'sample.csv'; a.click()
                  }}
                  style={{ background: '#fff', border: '1.5px solid #3A9BD5', color: '#1D4ED8', borderRadius: '8px', padding: '9px 20px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}
                >
                  📄 サンプルCSVをダウンロード
                </button>
              </div>

              {csvPreview.length > 0 && (
                <>
                  <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', overflow: 'hidden', marginBottom: '16px' }}>
                    <div style={{ padding: '12px 18px', borderBottom: '1px solid #E2E8F0', fontWeight: '700', fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>📋 プレビュー（{csvPreview.length - 1}件）</span>
                      {csvImported && <span style={{ color: '#16A34A', fontWeight: '700', fontSize: '12px' }}>✅ インポート完了！</span>}
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
                        📥 {csvPreview.length - 1}件をインポートする
                      </button>
                    </div>
                  )}
                  {csvImported && (
                    <div style={{ textAlign: 'center' }}>
                      <button onClick={() => setTab('sellers')} style={{ background: '#16A34A', color: '#fff', border: 'none', borderRadius: '8px', padding: '12px 32px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' }}>
                        👥 出店者一覧を確認する
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
