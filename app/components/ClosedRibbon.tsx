// 募集が終わった案件に付ける、左上の斜めの帯。
// 一覧をぱっと見たときに、募集中のものと見分けられるようにするためのもの。
// 帯を出す側は position: relative と overflow: hidden にしておくこと。

export default function ClosedRibbon({ label = '終了' }: { label?: string }) {
  return (
    <div
      aria-hidden='true'
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '104px',
        height: '104px',
        pointerEvents: 'none',
        zIndex: 2,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: '20px',
          left: '-32px',
          width: '150px',
          transform: 'rotate(-45deg)',
          background: '#E02020',
          color: '#fff',
          textAlign: 'center',
          fontSize: '13px',
          fontWeight: 900,
          letterSpacing: '2px',
          padding: '5px 0',
          boxShadow: '0 1px 5px rgba(0,0,0,0.3)',
        }}
      >
        {label}
      </div>
    </div>
  )
}
