'use client'
import { useId, type ReactNode } from 'react'

// チャットの入力欄と、1つの吹き出し。
//
// なぜ部品にしたか（2026-09-30 の運営からの依頼）:
//   やり取りの画面が4つあり（運営↔出店者／運営↔募集者／出店者の画面／
//   募集者の画面）、それぞれ別に書かれていた。そのため
//     ・入力欄が横1行に潰れて、長い文が横へ伸びて読めない
//     ・Enter の意味が画面ごとに違う（改行／2回押すと送信）
//     ・誰がいつ送ったのかが出る画面と出ない画面がある
//   という差が生まれていた。「募集者管理のやり取りと全く同じ仕様に」という
//   依頼なので、その画面の作りをここに移して4か所から使う。
//   同じ部品を読ませておけば、片方だけ直してずれることがない。
//
// Enter は改行。送信はボタン（⌘/Ctrl+Enter でも送れる）。
//   Enter で送る作りにすると、改行しようとして送ってしまう。
//   日本語入力では変換の確定でも Enter が来るので、なおさら危ない。

/** 吹き出しの色。mine=自分 / other=相手 / ops=運営 */
export type BubbleTone = 'mine' | 'other' | 'ops'

const TONES: Record<BubbleTone, { bg: string; color: string; border: string; name: string }> = {
  mine: { bg: '#F5A623', color: '#fff', border: 'none', name: '#94A3B8' },
  other: { bg: '#fff', color: '#1a1a1a', border: '1px solid #E2E8F0', name: '#94A3B8' },
  ops: { bg: '#FFF8E1', color: '#1a1a1a', border: '1px solid #FDE68A', name: '#B45309' },
}

/** 「2026-09-30T09:51:12+09:00」→「2026-09-30 09:51」。値が無いときは空 */
export function chatTime(v: unknown): string {
  const s = String(v ?? '')
  return s ? s.slice(0, 16).replace('T', ' ') : ''
}

export function ChatBubble({
  tone, who, at, children, footer,
}: {
  tone: BubbleTone
  /** 送り主の名前。自分の発言なら「運営」「あなた」など */
  who: string
  /** 送った時刻。chatTime() を通した文字列 */
  at?: string
  children: ReactNode
  /** 吹き出しの下に出すもの（「送信を取り消す」など） */
  footer?: ReactNode
}) {
  const t = TONES[tone]
  const mine = tone === 'mine'
  return (
    // .msg-bubble … 長いURLを折り返す。スマホでは幅を88%まで広げる（globals.css）
    <div className='msg-bubble' style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '86%' }}>
      <div style={{ fontSize: '10.5px', color: t.name, marginBottom: '2px', textAlign: mine ? 'right' : 'left', fontWeight: tone === 'ops' ? 700 : 400 }}>
        {who}{at ? '　' + at : ''}
      </div>
      <div style={{
        background: t.bg, color: t.color, border: t.border,
        borderRadius: '12px', padding: '10px 14px', fontSize: '13px', lineHeight: 1.8,
        // 改行をそのまま出す。これが無いと、送った文が1行に潰れる
        whiteSpace: 'pre-wrap',
      }}>
        {children}
      </div>
      {footer && <div style={{ textAlign: mine ? 'right' : 'left', marginTop: '2px' }}>{footer}</div>}
    </div>
  )
}

export default function ChatComposer({
  value, onChange, onSend, busy = false,
  placeholder = '本文を入力してください（改行できます）',
  maxLength = 2000,
  error,
  onReload,
  file, onPickFile, onClearFile, fileInputId,
  compact = false,
}: {
  value: string
  onChange: (v: string) => void
  onSend: () => void
  busy?: boolean
  placeholder?: string
  maxLength?: number
  /** 送信に失敗したときの文面 */
  error?: string | null
  /** 渡すと「読み直す」が出る */
  onReload?: () => void
  /** 添付。渡さない画面では 📎 を出さない */
  file?: File | null
  onPickFile?: (f: File) => void
  onClearFile?: () => void
  /** ページ内で重ならないID（同じページに2つ置くとき用） */
  fileInputId?: string
  /**
   * すでに枠のある小さな箱の中に置くとき。上の区切り線と外側の余白を外す。
   * 入力欄・ボタン・文字数の作りは変えない（画面ごとに操作が変わらないように）
   */
  compact?: boolean
}) {
  // ラベルと input を結ぶID。渡されなければ useId で作る
  // （打つたびに変わってラベルとの結び付きが切れないように）
  const autoId = useId()
  const inputId = fileInputId || 'chat-file-' + autoId
  const canAttach = !!onPickFile
  const empty = !value.trim() && !file
  const sendable = !busy && !empty

  return (
    <div style={{ borderTop: compact ? 'none' : '1px solid #E2E8F0' }}>
      {file && (
        <div style={{ padding: compact ? '8px 0' : '8px 16px', display: 'flex', alignItems: 'center', gap: '8px', background: '#FFF7ED' }}>
          <span style={{ fontSize: '12px', color: '#9A3412', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📎 {file.name}</span>
          <button type='button' onClick={onClearFile} aria-label='添付を外す'
            style={{ background: 'none', border: 'none', color: '#9A3412', cursor: 'pointer', fontSize: '14px', fontWeight: 700, fontFamily: 'inherit' }}>✕</button>
        </div>
      )}
      <div style={{ padding: compact ? '0' : '12px 16px' }}>
        {error && (
          <div style={{ fontSize: '12px', color: '#B91C1C', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '8px 10px', marginBottom: '8px', lineHeight: 1.8 }}>
            {error}
          </div>
        )}
        <textarea
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => {
            // ⌘/Ctrl+Enter で送る。素の Enter は改行のまま
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); if (sendable) onSend() }
          }}
          maxLength={maxLength}
          placeholder={placeholder}
          disabled={busy}
          style={{
            width: '100%', minHeight: '84px', border: '1.5px solid #E2E8F0', borderRadius: '8px',
            padding: '9px 12px', fontSize: '13px', lineHeight: 1.8, outline: 'none',
            color: '#1a1a1a', fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical',
          }}
        />
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '6px', flexWrap: 'wrap' }}>
          <button type='button' onClick={onSend} disabled={!sendable}
            style={{
              background: sendable ? '#F5A623' : '#CBD5E1', color: '#fff', border: 'none', borderRadius: '8px',
              padding: '9px 20px', fontSize: '13px', fontWeight: 700,
              cursor: sendable ? 'pointer' : 'not-allowed', fontFamily: 'inherit', minHeight: '38px',
            }}>
            {busy ? '送信中…' : '送信'}
          </button>
          {canAttach && (
            <>
              <label htmlFor={inputId} title='画像・PDFを添付する'
                style={{ cursor: busy ? 'not-allowed' : 'pointer', fontSize: '20px', opacity: busy ? 0.4 : 1, userSelect: 'none' }}>📎</label>
              <input id={inputId} type='file' accept='image/*,application/pdf' style={{ display: 'none' }} disabled={busy}
                onChange={e => { const f = e.target.files?.[0]; if (f) onPickFile(f); e.currentTarget.value = '' }} />
            </>
          )}
          {onReload && (
            <button type='button' onClick={onReload} disabled={busy}
              style={{ background: 'none', border: 'none', padding: 0, cursor: busy ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: '11.5px', color: '#64748B', textDecoration: 'underline', textUnderlineOffset: '2px' }}>
              読み直す
            </button>
          )}
          <span style={{ fontSize: '11px', color: '#94A3B8', marginLeft: 'auto' }}>
            {value.length} / {maxLength.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  )
}
