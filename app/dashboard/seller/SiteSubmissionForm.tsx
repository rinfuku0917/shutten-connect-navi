'use client'

import { useCallback, useEffect, useState } from 'react'

// 「この現場に出す出店者情報」を入力する画面。
//
// これまでは提出用Excelの中身がプロフィールに1組しか無く、案件ごとに
// 違う内容を出したいときは運営が公式LINEで聞き取って手で書き換えていた。
// ここで入力すると application_submissions に案件ごとに残り、
// 提出用Excelはプロフィールより先にこちらを読む（app/lib/submissionXlsx.ts）。
//
// 初回は現在のプロフィールの内容を写した状態で開く。
// 多くの項目は前と同じで、変わるのは一部だけ、という使い方が多いため。

const PAY_OPTIONS = ['現金', 'クレジットカード', 'PayPay', 'QRコード決済', '電子マネー']
const GENRES = ['食事', 'スイーツ', 'ドリンク', '物販', 'サービス']

export type MenuRow = { name: string; detail: string; price: string }

type Props = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
  placeId: string
  placeTitle: string
  sellerId: string
  onClose: () => void
  /** 保存できたときに呼ぶ。呼び出し側で「入力済み」の印を更新するため */
  onSaved?: () => void
}

// profiles.genre は ["食事","スイーツ"] のJSON文字列。表示用に配列へ直す
function parseGenres(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter(x => typeof x === 'string')
  if (typeof v !== 'string' || !v) return []
  try {
    const a = JSON.parse(v)
    if (Array.isArray(a)) return a.filter(x => typeof x === 'string')
  } catch { /* 「食事」のような素の文字列 */ }
  return [v]
}

const label: React.CSSProperties = { fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px', display: 'block' }
const input: React.CSSProperties = { width: '100%', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', color: '#1a1a1a', background: '#fff' }
const chip = (on: boolean): React.CSSProperties => ({
  fontSize: '12px', padding: '6px 14px', borderRadius: '999px', cursor: 'pointer',
  border: '1.5px solid ' + (on ? '#F5A623' : '#E2E8F0'),
  background: on ? '#FFF8E1' : '#fff', color: on ? '#B45309' : '#64748B', fontWeight: on ? 700 : 400,
})

export default function SiteSubmissionForm({ supabase, placeId, placeTitle, sellerId, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  // 既に入力済みか（見出しの文言を変えるだけに使う）
  const [existing, setExisting] = useState(false)

  const [shopName, setShopName] = useState('')
  const [instagram, setInstagram] = useState('')
  const [genres, setGenres] = useState<string[]>([])
  const [bagPaid, setBagPaid] = useState<'' | '無料' | '有料'>('')
  const [bagYen, setBagYen] = useState('')
  const [pays, setPays] = useState<string[]>([])
  const [payOther, setPayOther] = useState('')
  const [menus, setMenus] = useState<MenuRow[]>([])
  const [note, setNote] = useState('')

  const applyBag = (raw: string) => {
    if (raw === '無料') { setBagPaid('無料'); setBagYen(''); return }
    if (raw.startsWith('有料')) { setBagPaid('有料'); setBagYen((raw.match(/[0-9]+/) || [''])[0]); return }
    setBagPaid(''); setBagYen('')
  }
  const bagValue = () => (bagPaid === '有料' ? '有料：' + (bagYen || '') + '円' : bagPaid)

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    // すでにこの案件で入力していればそれを、無ければプロフィールを写す
    const [{ data: sub, error: sErr }, { data: prof }, { data: sns }, { data: ms }] = await Promise.all([
      supabase.from('application_submissions')
        .select('shop_name, instagram, genre, takeout_bag, payment_methods, menus, note')
        .eq('place_id', placeId).eq('seller_id', sellerId).maybeSingle(),
      supabase.from('profiles')
        .select('shop_name, name, genre, takeout_bag, payment_methods')
        .eq('id', sellerId).maybeSingle(),
      supabase.from('sns_links').select('url').eq('seller_id', sellerId).eq('platform', 'instagram').maybeSingle(),
      supabase.from('menus').select('name, detail, price, sort_order, created_at')
        .eq('seller_id', sellerId)
        .order('sort_order', { ascending: true }).order('created_at', { ascending: true }),
    ])
    if (sErr) { setErr('読み込めませんでした：' + sErr.message); setLoading(false); return }

    if (sub) {
      setExisting(true)
      setShopName(sub.shop_name || '')
      setInstagram(sub.instagram || '')
      setGenres(parseGenres(sub.genre))
      applyBag(sub.takeout_bag || '')
      const p: string[] = Array.isArray(sub.payment_methods) ? sub.payment_methods : []
      setPays(p.filter(x => PAY_OPTIONS.includes(x)))
      setPayOther(p.filter(x => !PAY_OPTIONS.includes(x)).join('・'))
      setMenus(Array.isArray(sub.menus)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ? (sub.menus as any[]).map(m => ({ name: m?.name || '', detail: m?.detail || '', price: m?.price == null ? '' : String(m.price) }))
        : [])
      setNote(sub.note || '')
    } else {
      setExisting(false)
      setShopName(prof?.shop_name || prof?.name || '')
      setInstagram(sns?.url || '')
      setGenres(parseGenres(prof?.genre))
      applyBag(prof?.takeout_bag || '')
      const p: string[] = Array.isArray(prof?.payment_methods) ? prof.payment_methods : []
      setPays(p.filter(x => PAY_OPTIONS.includes(x)))
      setPayOther(p.filter(x => !PAY_OPTIONS.includes(x)).join('・'))
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setMenus(((ms ?? []) as any[]).map(m => ({ name: m.name || '', detail: m.detail || '', price: m.price == null ? '' : String(m.price) })))
      setNote('')
    }
    setLoading(false)
  }, [supabase, placeId, sellerId])

  useEffect(() => { load() }, [load])

  const save = async () => {
    if (!shopName.trim()) { setErr('店舗名を入力してください。'); return }
    setSaving(true)
    setErr(null)
    // 何も書いていない行は保存しない。価格は数値だけ取り出す
    const rows = menus
      .map(m => ({
        name: m.name.trim(),
        detail: m.detail.trim(),
        price: m.price.trim() === '' ? null : (parseInt(m.price.replace(/[^0-9]/g, ''), 10) || null),
      }))
      .filter(m => m.name || m.detail || m.price != null)
    const payAll = Array.from(new Set([
      ...pays,
      ...payOther.split(/[・,、\s]+/).map(s => s.trim()).filter(Boolean),
    ]))
    const { error } = await supabase.from('application_submissions').upsert({
      place_id: placeId,
      seller_id: sellerId,
      shop_name: shopName.trim(),
      instagram: instagram.trim(),
      // 提出用Excelの genreLabel がプロフィールと同じ形を前提にしているため、
      // ここでも ["食事","スイーツ"] のJSON文字列で保存する
      genre: JSON.stringify(genres),
      takeout_bag: bagValue(),
      payment_methods: payAll,
      menus: rows,
      note: note.trim(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'place_id,seller_id' })
    setSaving(false)
    if (error) { setErr('保存できませんでした：' + error.message); return }
    setDone(true)
    onSaved?.()
    setTimeout(onClose, 900)
  }

  const setMenu = (i: number, patch: Partial<MenuRow>) =>
    setMenus(menus.map((m, j) => (j === i ? { ...m, ...patch } : m)))

  return (
    <div
      role='dialog' aria-modal='true' aria-label='この現場に出す出店者情報'
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 12px', overflowY: 'auto' }}
    >
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: '14px', width: '100%', maxWidth: '620px', padding: '22px 24px 26px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '4px' }}>
          <div>
            <h2 style={{ fontSize: '16px', fontWeight: 800, margin: 0 }}>この現場に出す出店者情報</h2>
            <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>{placeTitle}</div>
          </div>
          <button type='button' onClick={onClose} aria-label='閉じる' style={{ border: 'none', background: 'none', fontSize: '22px', lineHeight: 1, color: '#94A3B8', cursor: 'pointer' }}>×</button>
        </div>

        <p style={{ fontSize: '12px', color: '#475569', lineHeight: 1.7, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '10px 12px', margin: '12px 0 18px' }}>
          {existing
            ? 'この現場に出す内容として保存されています。書き換えると、次に施設へ提出する資料へ反映されます。'
            : 'いまのプロフィールの内容を写しています。この現場だけ変えたいところを直してください。プロフィール自体は書き換わりません。'}
        </p>

        {loading ? (
          <div style={{ fontSize: '13px', color: '#64748B', padding: '20px 0' }}>読み込み中…</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={label} htmlFor='sub-shop'>店舗名</label>
              <input id='sub-shop' value={shopName} onChange={e => setShopName(e.target.value)} style={input} />
            </div>

            <div>
              <label style={label} htmlFor='sub-insta'>Instagram</label>
              <input id='sub-insta' value={instagram} onChange={e => setInstagram(e.target.value)} placeholder='https://www.instagram.com/…' style={input} />
            </div>

            <div>
              <span style={label}>ジャンル</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {GENRES.map(g => {
                  const on = genres.includes(g)
                  return (
                    <button key={g} type='button' aria-pressed={on} style={chip(on)}
                      onClick={() => setGenres(on ? genres.filter(x => x !== g) : [...genres, g])}>{g}</button>
                  )
                })}
              </div>
            </div>

            <div>
              <span style={label}>テイクアウトの袋</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                {(['無料', '有料'] as const).map(v => (
                  <button key={v} type='button' aria-pressed={bagPaid === v} style={chip(bagPaid === v)}
                    onClick={() => { setBagPaid(bagPaid === v ? '' : v); if (v === '無料') setBagYen('') }}>{v}</button>
                ))}
                {bagPaid === '有料' && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <input value={bagYen} inputMode='numeric' aria-label='袋の金額'
                      onChange={e => setBagYen(e.target.value.replace(/[^0-9]/g, ''))}
                      style={{ ...input, width: '84px' }} />
                    <span style={{ fontSize: '13px', color: '#475569' }}>円</span>
                  </span>
                )}
              </div>
            </div>

            <div>
              <span style={label}>利用できる決済</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                {PAY_OPTIONS.map(v => {
                  const on = pays.includes(v)
                  return (
                    <button key={v} type='button' aria-pressed={on} style={chip(on)}
                      onClick={() => setPays(on ? pays.filter(x => x !== v) : [...pays, v])}>{v}</button>
                  )
                })}
              </div>
              <input value={payOther} onChange={e => setPayOther(e.target.value)} aria-label='その他の決済'
                placeholder='その他（・区切りで入力）' style={input} />
            </div>

            <div>
              <span style={label}>販売メニュー</span>
              <div style={{ fontSize: '11px', color: '#64748B', marginBottom: '8px', lineHeight: 1.6 }}>
                この現場で出すものだけを並べてください。【クレープ】のように【】で括った行は、施設へ出す資料で見出しとして扱われます。
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {menus.map((m, i) => (
                  <div key={i} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    <input value={m.name} onChange={e => setMenu(i, { name: e.target.value })}
                      aria-label={`メニュー${i + 1}の名前`} placeholder='メニュー名' style={{ ...input, flex: '1 1 34%' }} />
                    <input value={m.detail} onChange={e => setMenu(i, { detail: e.target.value })}
                      aria-label={`メニュー${i + 1}の詳細`} placeholder='詳細（任意）' style={{ ...input, flex: '1 1 40%' }} />
                    <input value={m.price} inputMode='numeric' onChange={e => setMenu(i, { price: e.target.value })}
                      aria-label={`メニュー${i + 1}の価格`} placeholder='価格' style={{ ...input, flex: '0 0 88px' }} />
                    <button type='button' onClick={() => setMenus(menus.filter((_, j) => j !== i))}
                      aria-label={`メニュー${i + 1}を削除`}
                      style={{ flex: '0 0 auto', border: '1px solid #E2E8F0', background: '#fff', color: '#94A3B8', borderRadius: '8px', width: '32px', height: '36px', cursor: 'pointer', fontSize: '16px' }}>×</button>
                  </div>
                ))}
              </div>
              <button type='button' onClick={() => setMenus([...menus, { name: '', detail: '', price: '' }])}
                style={{ marginTop: '8px', fontSize: '12px', fontWeight: 700, padding: '7px 14px', borderRadius: '8px', border: '1px solid #E2E8F0', background: '#F8FAFC', color: '#334155', cursor: 'pointer' }}>
                ＋ メニューを追加
              </button>
            </div>

            <div>
              <label style={label} htmlFor='sub-note'>現場への連絡事項（任意）</label>
              <textarea id='sub-note' value={note} onChange={e => setNote(e.target.value)} rows={3}
                placeholder='到着時間の希望、必要な電源など' style={{ ...input, resize: 'vertical' }} />
              <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '4px' }}>運営と募集者が確認します。施設へ提出する資料には載りません。</div>
            </div>

            {err && <div role='alert' style={{ fontSize: '12px', color: '#DC2626', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '8px', padding: '9px 12px' }}>{err}</div>}
            {done && <div role='status' style={{ fontSize: '12px', color: '#15803D', background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: '8px', padding: '9px 12px' }}>保存しました。</div>}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '2px' }}>
              <button type='button' onClick={onClose} style={{ fontSize: '13px', padding: '10px 18px', borderRadius: '9px', border: '1px solid #E2E8F0', background: '#fff', color: '#475569', cursor: 'pointer' }}>閉じる</button>
              <button type='button' onClick={save} disabled={saving} style={{ fontSize: '13px', fontWeight: 800, padding: '10px 22px', borderRadius: '9px', border: 'none', background: saving ? '#FCD9A0' : '#F5A623', color: '#fff', cursor: saving ? 'wait' : 'pointer' }}>
                {saving ? '保存中…' : '保存する'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
