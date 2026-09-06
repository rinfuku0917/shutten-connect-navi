'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// メッセージに添付されたファイルの表示。
//
// もともと公開URL（getPublicUrl）で出していた。
// 公開の保管場所だと、URLを知っていればログインなしで誰でも見られる。
// 出店者が営業許可証や保険証券の写真をメッセージで送ることがあり、
// それが誰でも見られる状態になっていた。
//
// 提出書類（seller-documents）は非公開の保管場所に置き、
// 開くときだけ期限付きのURLを発行している。添付も同じ形にそろえる。
//
// 期限は10分。書類の60秒より長いのは、
// メッセージは画像を並べて読む画面で、
// やり取りを遡って読んでいる間に切れると読めなくなるため。

const BUCKET = 'message-attachments'
const EXPIRES_SEC = 600

export default function MessageAttachment({
  filePath,
  isMine,
}: {
  filePath: string
  /** 自分が送ったものか。文字色を背景に合わせるために使う */
  isMine: boolean
}) {
  const [url, setUrl] = useState('')
  const [err, setErr] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(filePath, EXPIRES_SEC)
      if (!alive) return
      if (error || !data) { setErr(true); return }
      setUrl(data.signedUrl)
    })()
    return () => { alive = false }
  }, [filePath])

  const isImage = /\.(jpe?g|png|gif|webp)$/i.test(filePath)
  const name = filePath.split('/').pop() || 'ファイル'

  if (err) {
    return (
      <div style={{ marginTop: '6px', fontSize: '11px', color: isMine ? 'rgba(255,255,255,0.8)' : '#94A3B8' }}>
        添付を開けませんでした
      </div>
    )
  }

  // 発行を待っている間。画像の高さぶんの場所を空けておくと、
  // 出たときに文字が飛ばない
  if (!url) {
    return (
      <div style={{ marginTop: '6px', fontSize: '11px', color: isMine ? 'rgba(255,255,255,0.8)' : '#94A3B8' }}>
        読み込み中…
      </div>
    )
  }

  if (isImage) {
    return (
      <a href={url} target='_blank' rel='noopener noreferrer' style={{ display: 'block', marginTop: '6px' }}>
        <img src={url} alt='添付画像' style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px', display: 'block' }} />
      </a>
    )
  }

  return (
    <a href={url} target='_blank' rel='noopener noreferrer'
      style={{ display: 'inline-block', marginTop: '6px', fontSize: '12px', color: isMine ? '#fff' : '#1D4ED8', textDecoration: 'underline' }}>
      📎 {name}
    </a>
  )
}
