'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// 送信メールの文面を書き換える画面。
//
// 保存されているのは「上書き」だけで、何も保存していないメールは
// コード側の既定の文面が使われる。だから「既定に戻す」は
// 保存を消すだけで済み、元に戻せなくなることがない。
//
// 文面は出店者・募集者へ実際に届くものなので、
//   ・使える差し込みを画面に出す（打ち間違いを防ぐ）
//   ・保存する前に、差し込みを入れた見本を出せる
//   ・既定と違うものには「編集済み」を付ける
// の3つで、事故を減らしている。

type Tpl = {
  key: string
  label: string
  to: string
  when: string
  vars: { name: string, note: string }[]
  defaultSubject: string
  defaultBody: string
  subject: string
  body: string
  edited: boolean
  updatedAt: string | null
  updatedBy: string | null
}

const CARD: React.CSSProperties = {
  background: '#fff', borderRadius: '12px', border: '1px solid #E2E8F0', marginBottom: '12px',
}

export default function MailTemplates({ focusKey }: { focusKey?: string } = {}) {
  const [list, setList] = useState<Tpl[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [openKey, setOpenKey] = useState('')
  // 編集中の内容。開いている1件ぶんだけ持つ
  const [draft, setDraft] = useState<{ subject: string, body: string }>({ subject: '', body: '' })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [preview, setPreview] = useState<{ subject: string, body: string } | null>(null)
  // 「編集」と「届く形」を切り替えて見せる。
  // 以前は押すと下に出る作りで、スクロールしないと見えなかった
  const [view, setView] = useState<'edit' | 'preview'>('edit')

  const token = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token || ''
  }

  const load = useCallback(async () => {
    setLoading(true)
    setErr('')
    const t = await token()
    if (!t) { setErr('ログインの有効期限が切れています。読み込み直してください。'); setLoading(false); return }
    const res = await fetch('/api/admin/mail-templates', { headers: { Authorization: 'Bearer ' + t } })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) { setErr(j.error || '読み込みに失敗しました'); setLoading(false); return }
    setList(j.templates || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // 各フローの画面から「文面を編集」で来たとき、その文面を開いた状態にする
  useEffect(() => {
    if (!focusKey || list.length === 0) return
    const t = list.find(x => x.key === focusKey)
    if (t) open(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey, list.length])

  const open = (t: Tpl) => {
    setOpenKey(t.key)
    setDraft({ subject: t.subject, body: t.body })
    setPreview(null)
    setView('edit')
    setMsg('')
    setErr('')
  }

  const save = async (t: Tpl) => {
    if (busy) return
    setBusy(true); setErr(''); setMsg('')
    const tk = await token()
    const res = await fetch('/api/admin/mail-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tk },
      body: JSON.stringify({ key: t.key, subject: draft.subject, body: draft.body }),
    })
    const j = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setErr(j.error || '保存に失敗しました'); return }
    setMsg('保存しました。次に送るメールから、この文面が使われます。')
    await load()
  }

  const reset = async (t: Tpl) => {
    if (busy) return
    setBusy(true); setErr(''); setMsg('')
    const tk = await token()
    const res = await fetch('/api/admin/mail-templates?key=' + encodeURIComponent(t.key), {
      method: 'DELETE', headers: { Authorization: 'Bearer ' + tk },
    })
    const j = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setErr(j.error || '元に戻せませんでした'); return }
    setDraft({ subject: j.subject, body: j.body })
    setPreview(null)
    setMsg('もとの文面に戻しました。')
    await load()
  }

  const showPreview = async (t: Tpl) => {
    setErr(''); setMsg('')
    const tk = await token()
    const res = await fetch('/api/admin/mail-templates', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tk },
      body: JSON.stringify({ key: t.key, subject: draft.subject, body: draft.body }),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) { setErr(j.error || '見本を作れませんでした'); return }
    setPreview({ subject: j.subject, body: j.body })
    setView('preview')
  }

  // 差し込みを、いま編集している場所へ入れる。
  // 手で打つと間違えるので、押して入れられるようにする
  const insertVar = (name: string) => {
    const el = document.getElementById('mail-body') as HTMLTextAreaElement | null
    const tag = '{{' + name + '}}'
    if (!el) { setDraft(d => ({ ...d, body: d.body + tag })); return }
    const s = el.selectionStart ?? el.value.length
    const e = el.selectionEnd ?? s
    const next = el.value.slice(0, s) + tag + el.value.slice(e)
    setDraft(d => ({ ...d, body: next }))
    // 入れた直後にその後ろへカーソルを置く
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + tag.length, s + tag.length) })
  }

  const changed = (t: Tpl) => draft.subject !== t.subject || draft.body !== t.body
  const isDefault = (t: Tpl) => draft.subject === t.defaultSubject && draft.body === t.defaultBody

  return (
    <>
      <div style={{ ...CARD, borderColor: '#FDE68A', background: '#FFFDF8', padding: '16px 18px' }}>
        <div style={{ fontWeight: 700, fontSize: '14px', color: '#B45309', marginBottom: '6px' }}>
          ここで直した文面が、実際に届きます
        </div>
        <div style={{ fontSize: '12.5px', color: '#78350F', lineHeight: 1.9 }}>
          保存すると、次に送るメールからこの文面が使われます。すでに送ったメールは変わりません。<br />
          <strong>{'{{ }}'} で囲まれた部分は、送るときに実際の値に置き換わります。</strong>
          消してしまうと、その情報が抜けたメールが届きます。<br />
          いつでも「もとの文面に戻す」で元に戻せます。
        </div>
      </div>

      {err && (
        <div style={{ ...CARD, borderColor: '#FCA5A5', background: '#FEF2F2', color: '#B91C1C', fontSize: '13px', padding: '12px 16px', whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{err}</div>
      )}
      {msg && (
        <div style={{ ...CARD, borderColor: '#A7F3D0', background: '#ECFDF5', color: '#166534', fontSize: '13px', padding: '12px 16px', fontWeight: 700 }}>{msg}</div>
      )}

      {loading && <div style={{ ...CARD, padding: '18px', fontSize: '13px', color: '#94A3B8' }}>読み込み中…</div>}

      {list.map(t => {
        const isOpen = openKey === t.key
        return (
          <div key={t.key} style={{ ...CARD, borderColor: isOpen ? '#F5A623' : '#E2E8F0' }}>
            <button
              type='button'
              onClick={() => isOpen ? setOpenKey('') : open(t)}
              style={{ width: '100%', textAlign: 'left', background: isOpen ? '#FFFBEB' : '#fff', border: 'none', padding: '14px 16px', cursor: 'pointer', fontFamily: 'inherit', color: '#1a1a1a', borderRadius: '12px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, fontSize: '14px' }}>{t.label}</span>
                <span style={{ fontSize: '11px', color: '#64748B', background: '#F1F5F9', borderRadius: '999px', padding: '2px 10px' }}>{t.to}へ</span>
                {t.edited && (
                  <span style={{ fontSize: '11px', color: '#B45309', background: '#FEF3C7', borderRadius: '999px', padding: '2px 10px', fontWeight: 700 }}>編集済み</span>
                )}
              </div>
              <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px', lineHeight: 1.7 }}>{t.when}</div>
              {t.edited && t.updatedAt && (
                <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '3px' }}>
                  {t.updatedBy || '運営'}／{t.updatedAt.slice(0, 16).replace('T', ' ')} に変更
                </div>
              )}
            </button>

            {isOpen && (
              <div style={{ borderTop: '1px solid #F1F5F9', padding: '16px', background: '#FCFCFD' }}>
                {/* 編集と、届く形の切り替え。
                    以前は「届く形を見る」を押すと画面の下に出る作りで、
                    スクロールしないと見えなかった */}
                <div style={{ display: 'flex', gap: '0', marginBottom: '14px', borderBottom: '2px solid #E2E8F0' }}>
                  {([['edit', '文面を書く'], ['preview', '届く形を見る']] as const).map(([v, lbl]) => (
                    <button key={v} type='button'
                      onClick={() => { if (v === 'preview') showPreview(t); else setView('edit') }}
                      style={{
                        background: 'none', border: 'none', fontFamily: 'inherit', cursor: 'pointer',
                        padding: '9px 16px', fontSize: '13px', fontWeight: 700,
                        color: view === v ? '#B45309' : '#94A3B8',
                        borderBottom: '2px solid ' + (view === v ? '#F5A623' : 'transparent'),
                        marginBottom: '-2px',
                      }}>
                      {lbl}
                    </button>
                  ))}
                </div>

                {view === 'preview' ? (
                  <div>
                    <div style={{ fontSize: '12px', color: '#64748B', marginBottom: '8px', lineHeight: 1.8 }}>
                      出店者・募集者にはこの形で届きます。
                      <strong>［　］の部分に、送るときの実際の値が入ります。</strong>
                    </div>
                    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '16px' }}>
                      <div style={{ fontSize: '11px', color: '#94A3B8', marginBottom: '3px' }}>件名</div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#1a1a1a', paddingBottom: '10px', marginBottom: '10px', borderBottom: '1px solid #F1F5F9' }}>
                        {preview?.subject || '（読み込み中）'}
                      </div>
                      <pre style={{ margin: 0, fontSize: '13px', color: '#334155', lineHeight: 2, whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{preview?.body || ''}</pre>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* 使える差し込み */}
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                      使える差し込み
                      <span style={{ fontWeight: 400, color: '#94A3B8', marginLeft: '8px' }}>押すと本文に入ります</span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '4px' }}>
                      {t.vars.map(v => (
                        <button key={v.name} type='button' onClick={() => insertVar(v.name)} title={v.note}
                          style={{ background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', borderRadius: '999px', padding: '5px 12px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                          {'{{' + v.name + '}}'}
                        </button>
                      ))}
                    </div>
                    <ul style={{ margin: '0 0 16px', paddingLeft: '18px', fontSize: '11.5px', color: '#94A3B8', lineHeight: 1.9 }}>
                      {t.vars.map(v => <li key={v.name}>{'{{' + v.name + '}}'}　… {v.note}</li>)}
                    </ul>

                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>件名</div>
                    <input
                      value={draft.subject}
                      onChange={e => setDraft(d => ({ ...d, subject: e.target.value }))}
                      style={{ width: '100%', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '11px 13px', fontSize: '13.5px', color: '#1a1a1a', boxSizing: 'border-box', marginBottom: '14px', minHeight: '44px', fontFamily: 'inherit' }}
                    />

                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>本文</div>
                    <textarea
                      id='mail-body'
                      value={draft.body}
                      onChange={e => setDraft(d => ({ ...d, body: e.target.value }))}
                      rows={18}
                      style={{ width: '100%', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '12px 13px', fontSize: '13px', color: '#1a1a1a', boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.9, fontFamily: 'inherit' }}
                    />
                  </>
                )}

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
                  <button type='button' onClick={() => save(t)} disabled={busy || !changed(t)}
                    style={{ background: (busy || !changed(t)) ? '#ccc' : '#F5A623', color: '#fff', border: 'none', borderRadius: '8px', padding: '11px 22px', fontSize: '13px', fontWeight: 900, cursor: (busy || !changed(t)) ? 'not-allowed' : 'pointer', fontFamily: 'inherit', minHeight: '44px' }}>
                    {busy ? '保存中…' : '保存する'}
                  </button>
                  {!isDefault(t) && (
                    <button type='button' onClick={() => reset(t)} disabled={busy}
                      style={{ background: '#fff', color: '#64748B', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '11px 18px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', minHeight: '44px' }}>
                      もとの文面に戻す
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}
