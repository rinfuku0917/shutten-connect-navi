'use client'
import { useEffect, useState } from 'react'

// 案件の写真を選ぶ欄。最大4枚。
// 区画やスペースの割り当てを写真で説明したい案件があるため、複数枚に対応している。
//
// 登録フォームでは existing は空で、これから選ぶファイルだけを扱う。
// 編集フォームでは、すでに登録済みの写真（URL）と新しく足すファイルの両方を扱うので、
// 2つに分けて受け取り、並びは「登録済み → 新しく追加」の順に見せている。

export const MAX_PLACE_IMAGES = 4

export default function PlaceImagePicker({
  existing = [],
  onChangeExisting,
  files,
  onChangeFiles,
}: {
  existing?: string[]
  onChangeExisting?: (urls: string[]) => void
  files: File[]
  onChangeFiles: (files: File[]) => void
}) {
  // 選んだファイルのプレビュー用URL。作ったら必ず開放する（メモリに残るため）
  const [previews, setPreviews] = useState<string[]>([])
  useEffect(() => {
    const urls = files.map(f => URL.createObjectURL(f))
    setPreviews(urls)
    return () => { urls.forEach(u => URL.revokeObjectURL(u)) }
  }, [files])

  const total = existing.length + files.length
  const rest = MAX_PLACE_IMAGES - total

  const pick = (list: FileList | null) => {
    if (!list) return
    onChangeFiles([...files, ...Array.from(list)].slice(0, MAX_PLACE_IMAGES - existing.length))
  }

  const thumb: React.CSSProperties = {
    width: '96px', height: '96px', borderRadius: '8px', objectFit: 'cover',
    border: '1px solid #E5E7EB', display: 'block',
  }
  const del: React.CSSProperties = {
    position: 'absolute', top: '-6px', right: '-6px', width: '22px', height: '22px',
    borderRadius: '50%', border: 'none', background: '#DC2626', color: '#fff',
    fontSize: '13px', lineHeight: '22px', padding: 0, cursor: 'pointer', fontWeight: 700,
  }

  return (
    <div style={{ marginTop: '8px' }}>
      {total > 0 && (
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
          {existing.map((url, i) => (
            <div key={url + i} style={{ position: 'relative' }}>
              {/* 案件の写真はSupabaseに保存した任意のURLのため、next/image は使わない */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={'写真' + (i + 1)} style={thumb} />
              {i === 0 && <span style={{ position: 'absolute', bottom: '4px', left: '4px', background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: '10px', fontWeight: 700, borderRadius: '4px', padding: '1px 6px' }}>一覧に表示</span>}
              {onChangeExisting && (
                <button type='button' title='この写真を外す' style={del}
                  onClick={() => onChangeExisting(existing.filter((_, k) => k !== i))}>×</button>
              )}
            </div>
          ))}
          {files.map((f, i) => (
            <div key={f.name + i} style={{ position: 'relative' }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previews[i]} alt={f.name} style={thumb} />
              {existing.length === 0 && i === 0 && <span style={{ position: 'absolute', bottom: '4px', left: '4px', background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: '10px', fontWeight: 700, borderRadius: '4px', padding: '1px 6px' }}>一覧に表示</span>}
              <button type='button' title='この写真を外す' style={del}
                onClick={() => onChangeFiles(files.filter((_, k) => k !== i))}>×</button>
            </div>
          ))}
        </div>
      )}

      {rest > 0 ? (
        <label style={{ display: 'inline-block', background: '#F5A623', color: '#fff', padding: '8px 20px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 700 }}>
          写真を追加（あと{rest}枚）
          <input type='file' accept='image/*' multiple
            onChange={e => { pick(e.target.files); e.target.value = '' }}
            style={{ display: 'none' }} />
        </label>
      ) : (
        <div style={{ fontSize: '12px', color: '#B45309' }}>写真は{MAX_PLACE_IMAGES}枚まで登録できます。入れ替えるには × で外してください。</div>
      )}
      <p style={{ fontSize: '12px', color: '#94A3B8', marginTop: '8px', lineHeight: 1.7 }}>
        1枚目が案件一覧のサムネイルになります。区画図やスペースの写真もあわせて登録できます。
      </p>
    </div>
  )
}
