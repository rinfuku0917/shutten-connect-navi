// 日本語の文を、読点・句点のかたまりごとに折り返す。
//
// そのまま流すと「出店を依頼し / たい、」のように語の途中で改行されるが、
// かたまりごとに区切ると、行の終わりが必ず「、」か「。」になる。
// 幅が足りないときだけ、そのかたまりの中で折り返す。
//
// 使い方: <JpText>キッチンカーを呼びたい、出店を依頼したい。</JpText>

export default function JpText({ children }: { children: string }) {
  const parts = children.split(/(?<=[、。！？])/).filter(Boolean)
  return (
    <>
      {parts.map((s, i) => (
        <span key={i} style={{ display: 'inline-block' }}>
          {s}
        </span>
      ))}
    </>
  )
}
