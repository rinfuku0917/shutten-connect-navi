'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// 出店者が「この案件のために」入力した出店者情報を見せる。
//
// 出店者はマイページの「現場に出す出店者情報」から、案件ごとに
// 店舗名・Instagram・ジャンル・袋・決済・メニュー・連絡事項を入力できる。
// これまでその内容は提出用Excelに載るだけで、募集者の応募者一覧では
// 「現場ごとの入力あり」という印しか見えず、運営の出店承認では
// 印すら出ていなかった。ここで中身を見られるようにする。
//
// 読み取りは application_submissions の RLS に任せる。
//   募集者 … 自分の案件に届いた入力を読める
//   運営   … すべて読める

type Sub = {
  shop_name: string | null
  instagram: string | null
  genre: string | null
  takeout_bag: string | null
  payment_methods: unknown
  menus: unknown
  note: string | null
  updated_at: string | null
}

// profiles.genre と同じく ["食事","スイーツ"] のJSON文字列。表示用に直す
function genreText(v: string | null): string {
  if (!v) return ''
  try {
    const a = JSON.parse(v)
    if (Array.isArray(a)) return a.map(String).join('・')
  } catch { /* JSONでなければそのまま */ }
  return v
}

function menuRows(v: unknown): { name: string; detail: string; price: string }[] {
  if (!Array.isArray(v)) return []
  return v.map(m => {
    const o = (m ?? {}) as Record<string, unknown>
    const p = o.price
    return {
      name: String(o.name ?? ''),
      detail: String(o.detail ?? ''),
      price: p == null || p === '' ? '' : Number(p).toLocaleString() + '円',
    }
  }).filter(r => r.name || r.detail || r.price)
}

export default function SubmissionPanel({ placeId, sellerId }: { placeId: string; sellerId: string }) {
  const [sub, setSub] = useState<Sub | null | undefined>(undefined) // undefined=読込中 null=未入力
  const [err, setErr] = useState('')

  useEffect(() => {
    let alive = true
    ;(async () => {
      const { data, error } = await supabase
        .from('application_submissions')
        .select('shop_name, instagram, genre, takeout_bag, payment_methods, menus, note, updated_at')
        .eq('place_id', placeId).eq('seller_id', sellerId)
        .maybeSingle()
      if (!alive) return
      if (error) { setErr('読み込めませんでした: ' + error.message); setSub(null); return }
      setSub((data as Sub | null) ?? null)
    })()
    return () => { alive = false }
  }, [placeId, sellerId])

  const box: React.CSSProperties = {
    background: '#F0F7FF', border: '1px solid #BFDBFE', borderRadius: '10px',
    padding: '12px 14px', marginTop: '8px', marginBottom: '8px',
  }

  if (sub === undefined) {
    return <div style={{ ...box, color: '#64748B', fontSize: '12px' }}>読み込み中…</div>
  }
  if (err) {
    return <div style={{ ...box, background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626', fontSize: '12px' }}>{err}</div>
  }
  if (!sub) {
    return (
      <div style={{ ...box, background: '#F8FAFC', border: '1px solid #E2E8F0', color: '#64748B', fontSize: '12px', lineHeight: 1.7 }}>
        この案件のための入力はありません。<br />
        提出用Excelには、出店者のプロフィールの内容がそのまま載ります。
      </div>
    )
  }

  const pays = Array.isArray(sub.payment_methods) ? (sub.payment_methods as unknown[]).map(String).filter(Boolean) : []
  const menus = menuRows(sub.menus)

  const rows: [string, React.ReactNode][] = [
    ['店舗名', sub.shop_name || ''],
    ['Instagram', sub.instagram
      ? <a href={sub.instagram} target='_blank' rel='noopener noreferrer' style={{ color: '#1D4ED8', wordBreak: 'break-all' }}>{sub.instagram}</a>
      : ''],
    ['ジャンル', genreText(sub.genre)],
    ['テイクアウトの袋', sub.takeout_bag || ''],
    ['利用できる決済', pays.join('・')],
    ['販売メニュー', menus.length === 0 ? '' : (
      <div style={{ display: 'grid', gap: '3px' }}>
        {menus.map((m, i) => (
          <div key={i} style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'baseline' }}>
            <span style={{ fontWeight: 700 }}>{m.name || '（品名なし）'}</span>
            {m.detail && <span style={{ color: '#64748B' }}>{m.detail}</span>}
            {m.price && <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>{m.price}</span>}
          </div>
        ))}
      </div>
    )],
  ]

  return (
    <div style={box}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
        <strong style={{ fontSize: '12px', color: '#1D4ED8' }}>この案件のための出店者情報</strong>
        <span style={{ fontSize: '11px', color: '#64748B' }}>提出用Excelにはこの内容が載ります</span>
        {sub.updated_at && (
          <span style={{ fontSize: '11px', color: '#94A3B8', marginLeft: 'auto' }}>
            {new Date(sub.updated_at).toLocaleDateString('ja-JP')} 更新
          </span>
        )}
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
        <tbody>
          {rows.map(([label, val]) => (
            <tr key={label}>
              <td style={{ padding: '3px 8px 3px 0', color: '#64748B', whiteSpace: 'nowrap', verticalAlign: 'top', width: '104px' }}>{label}</td>
              <td style={{ padding: '3px 0', color: val ? '#1a1a1a' : '#94A3B8', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{val || '（未入力）'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {sub.note && (
        <div style={{ marginTop: '8px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '8px', padding: '8px 10px' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#B45309', marginBottom: '3px' }}>出店者からの連絡事項（Excelには載せません）</div>
          <div style={{ fontSize: '12px', color: '#475569', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{sub.note}</div>
        </div>
      )}
    </div>
  )
}
