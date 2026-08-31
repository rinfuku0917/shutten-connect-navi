'use client'
import { useEffect, useState } from 'react'
import { addBand } from '../lib/bandImage'

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
  bandLabel = '',
}: {
  existing?: string[]
  onChangeExisting?: (urls: string[]) => void
  files: File[]
  onChangeFiles: (files: File[]) => void
  /** 写真に入れる帯の文字。ふつうは案件名 */
  bandLabel?: string
}) {
  // 帯に入れる文字。案件名を初期値にして、必要なら書き換えられるようにする
  const [label, setLabel] = useState(bandLabel)
  const [useBand, setUseBand] = useState(true)
  const [working, setWorking] = useState(false)
  // 案件名を後から入力した場合にも追従させる（一度でも手で直したら追従しない）
  const [touched, setTouched] = useState(false)
  useEffect(() => { if (!touched) setLabel(bandLabel) }, [bandLabel, touched])
  // 選んだファイルのプレビュー用URL。作ったら必ず開放する（メモリに残るため）
  const [previews, setPreviews] = useState<string[]>([])
  useEffect(() => {
    const urls = files.map(f => URL.createObjectURL(f))
    setPreviews(urls)
    return () => { urls.forEach(u => URL.revokeObjectURL(u)) }
  }, [files])

  const total = existing.length + files.length
  const rest = MAX_PLACE_IMAGES - total

  // 選んだ写真は、その場で600×450に切り出して帯を入れる
  const pick = async (list: FileList | null) => {
    if (!list) return
    const room = MAX_PLACE_IMAGES - existing.length - files.length
    const picked = Array.from(list).slice(0, Math.max(0, room))
    if (picked.length === 0) return
    setWorking(true)
    try {
      const made: File[] = []
      for (let i = 0; i < picked.length; i++) {
        // 帯は1枚目（一覧のサムネイルになる写真）だけに入れる。
        // 2枚目以降は区画図などが多く、帯があると邪魔になるため。
        const isFirst = existing.length + files.length + i === 0
        try { made.push(await addBand(picked[i], isFirst && useBand ? label : '')) }
        catch { made.push(picked[i]) }  // 加工に失敗しても、元の写真は登録できるようにする
      }
      onChangeFiles([...files, ...made])
    } finally {
      setWorking(false)
    }
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

      {/* 帯の設定。1枚目をこれから選ぶときだけ出す */}
      {total === 0 && rest > 0 && (
      <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '12px 14px', marginBottom: '12px' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 700, color: '#334155', cursor: 'pointer' }}>
          <input type='checkbox' checked={useBand} onChange={e => setUseBand(e.target.checked)} />
          1枚目の写真に案件名の帯を入れる
        </label>
        {useBand && (
          <>
            <input
              value={label}
              onChange={e => { setTouched(true); setLabel(e.target.value) }}
              placeholder='帯に入れる文字（例：Olympic 千葉桜木店）'
              style={{ width: '100%', marginTop: '8px', border: '1.5px solid #E2E8F0', borderRadius: '6px', padding: '8px 10px', fontSize: '13px', color: '#1a1a1a', boxSizing: 'border-box' }}
            />
            <p style={{ fontSize: '11.5px', color: '#94A3B8', marginTop: '6px', lineHeight: 1.7 }}>
              一覧のサムネイルになる1枚目だけに入ります。2枚目以降（区画図など）には入りません。
              すでに追加した写真は変わりません。空欄のまま選ぶと、帯なしで切り出しだけ行います。
            </p>
          </>
        )}
      </div>
      )}

      {rest > 0 ? (
        <label style={{ display: 'inline-block', background: working ? '#CBD5E1' : '#F5A623', color: '#fff', padding: '8px 20px', borderRadius: '8px', cursor: working ? 'wait' : 'pointer', fontSize: '13px', fontWeight: 700 }}>
          {working ? '写真を加工中…' : `写真を追加（あと${rest}枚）`}
          <input type='file' accept='image/*' multiple disabled={working}
            onChange={e => { pick(e.target.files); e.target.value = '' }}
            style={{ display: 'none' }} />
        </label>
      ) : (
        <div style={{ fontSize: '12px', color: '#B45309' }}>写真は{MAX_PLACE_IMAGES}枚まで登録できます。入れ替えるには × で外してください。</div>
      )}
      <p style={{ fontSize: '12px', color: '#94A3B8', marginTop: '8px', lineHeight: 1.7 }}>
        1枚目が案件一覧のサムネイルになります。区画図やスペースの写真もあわせて登録できます。
        写真は一覧に合わせて600×450に切り出されます。
      </p>
    </div>
  )
}
