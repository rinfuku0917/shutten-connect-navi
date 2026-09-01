'use client'

// 承認・不採用の確認ダイアログに出す「メールを送るかどうか」の選択。
//
// 承認も不採用も、押した時点で出店者にメールが届く作りだった。
// 電話で先に伝えている場合や、重複した申込を整理するだけの場合など、
// 送りたくない場面があるため、送るかどうかをその場で選べるようにした。
// 既定は「送る」。ふだんの運用が変わらないようにするため。

export default function NotifyChoice({
  checked,
  onChange,
  disabled = false,
  approved,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  disabled?: boolean
  /** 承認のときは true。文面の説明を変えるために使う */
  approved: boolean
}) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        background: checked ? '#FFF8EC' : '#F8FAFC',
        border: '1px solid ' + (checked ? '#F5D9A8' : '#E2E8F0'),
        borderRadius: '10px',
        padding: '12px 14px',
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      <input
        type='checkbox'
        checked={checked}
        disabled={disabled}
        onChange={e => onChange(e.target.checked)}
        style={{ width: '18px', height: '18px', marginTop: '1px', flexShrink: 0, accentColor: '#B45309', cursor: disabled ? 'default' : 'pointer' }}
      />
      <span style={{ fontSize: '13px', lineHeight: 1.8, color: '#333' }}>
        <strong style={{ color: checked ? '#B45309' : '#64748B' }}>出店者にメールでお知らせする</strong>
        <br />
        <span style={{ fontSize: '12px', color: '#64748B' }}>
          {checked
            ? approved
              ? '「出店が承認されました」というお知らせが、この操作と同時に届きます。'
              : '「今回は見送りとなりました」というお知らせが、この操作と同時に届きます。'
            : 'メールは送りません。画面上の状態だけを変えます。あとから知らせ直すことはできません。'}
        </span>
      </span>
    </label>
  )
}
