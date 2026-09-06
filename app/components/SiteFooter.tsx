'use client'
import Link from 'next/link'
import Image from 'next/image'
import { C, maru } from './siteTheme'

// トップページと同じ淡いパステルグリーンのフッター。全公開ページで共有する。
// トップページのフッターと同じ構成（実績紹介・よくある質問はトップ内アンカー）
//
// 見出しのアイコンは、白い丸の上に置いている。
// スマホでは見出しが濃い緑の帯になり、アイコンの緑が背景と同化して消えるため
const cols: { head: string; icon: string; items: { href: string; label: string }[] }[] = [
  { head: 'キッチンカーを呼びたい方', icon: '/ic-f-vendor.webp', items: [
    { href: '/vendor', label: 'キッチンカーの手配・派遣' },
    { href: '/vendor/event', label: 'イベント・マルシェ・お祭り' },
    { href: '/vendor/cost', label: 'キッチンカーを呼ぶ費用' },
    { href: '/sellers', label: '登録キッチンカーを見る' },
  ] },
  { head: 'キッチンカーで出店したい方', icon: '/ic-f-space.webp', items: [
    { href: '/space', label: '出店したい方へ' },
    { href: '/places', label: '出店場所を探す' },
    { href: '/sell', label: '車両を売りたい' },
    { href: '/#works', label: '実績紹介' },
    { href: '/blog', label: 'ブログ' },
  ] },
  { head: 'サポート', icon: '/ic-f-support.webp', items: [
    { href: '/#faq', label: 'よくある質問' },
    { href: '/contact', label: 'お問い合わせ' },
    { href: '/login', label: 'ログイン' },
  ] },
  { head: '会社情報', icon: '/ic-f-company.webp', items: [
    { href: '/company', label: '運営会社' },
    { href: '/terms', label: '利用規約' },
    { href: '/cancel-policy', label: 'キャンセルポリシー' },
    { href: '/privacy', label: 'プライバシーポリシー' },
  ] },
]

export default function SiteFooter() {
  const linkStyle: React.CSSProperties = { display: 'block', color: C.footerInk, textDecoration: 'none', fontSize: '13.5px', marginBottom: '8px' }
  return (
    <footer style={{ background: C.footerBg, color: C.footerInk, padding: '44px 0 30px' }}>
      <div style={{ maxWidth: '1080px', margin: '0 auto', padding: '0 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '30px', flexWrap: 'wrap', marginBottom: '26px' }}>
          <div>
            {/* ロゴは画像。読み上げと検索向けに、alt でサイト名を残す */}
            <Link href='/' className={maru.className} style={{ display: 'inline-block', marginBottom: '10px', textDecoration: 'none' }}>
              <Image src='/ic-f-logo.webp' alt='出店コネクトナビ' width={160} height={39} style={{ width: '164px', height: 'auto', display: 'block' }} />
            </Link>
            <p style={{ fontSize: '13px', color: C.footerMuted }}>キッチンカーと、場所をつなぐ。</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap', marginTop: '14px' }}>
              <a href='https://www.instagram.com/connect.navi/' target='_blank' rel='noopener noreferrer' aria-label='Instagram' className='top3-sns' style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: C.footerInk, textDecoration: 'none', fontSize: '13px', fontWeight: 700 }}>
                <Image src='/ic-f-instagram.webp' alt='' width={22} height={22} style={{ width: '22px', height: '22px', flexShrink: 0 }} />
                Instagram
              </a>
              <a href='https://lin.ee/Z0ddEjT' target='_blank' rel='noopener noreferrer' aria-label='公式LINEでお問い合わせ' className='top3-sns' style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: C.footerInk, textDecoration: 'none', fontSize: '13px', fontWeight: 700 }}>
                <Image src='/ic-f-line.webp' alt='' width={22} height={22} style={{ width: '22px', height: '22px', flexShrink: 0 }} />
                公式LINE
              </a>
            </div>
          </div>
          {/* スマホでは折りたたむ。パソコンはこれまでどおり4列に並べる。
              リンクは常にHTMLへ書き出し、閉じているときはCSSで隠すだけにしている。
              条件分岐で描き分けると、全公開ページから内部リンク16本が消えてしまう。

              開閉に JavaScript を使っていないのは、
                ・<details> だと「スマホは閉じる／パソコンは開いたまま」を作れない
                  （open は属性なので、画面幅では切り替えられない）
                ・チェックボックスと :checked なら、その出し分けをCSSだけで書ける
              ため。JSが動く前でも開くので、読み込み中に触っても反応する。 */}
          <div className='top3-footcols'>
            {cols.map((col, i) => {
              const id = 'footacc-' + i
              return (
                <div key={col.head} className='top3-footcol'>
                  <input type='checkbox' id={id} className='top3-footacc-state' />
                  <label htmlFor={id} className='top3-foothead'>
                    <span className='top3-foothead-icon'>
                      <Image src={col.icon} alt='' width={19} height={19} style={{ width: '19px', height: '19px' }} />
                    </span>
                    <h4>{col.head}</h4>
                    {/* ＋が45度回って×になる。よくある質問の開閉と同じ動き */}
                    <span className='top3-footacc-mark' aria-hidden='true'>＋</span>
                  </label>
                  <div className='top3-footbody'>
                    {col.items.map(it => <Link key={it.href} href={it.href} style={linkStyle}>{it.label}</Link>)}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        <div style={{ borderTop: '1px solid rgba(47,95,67,.2)', paddingTop: '18px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
          <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label='ページ最上部に戻る' className='top3-totop' style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#fff', border: '1.5px solid ' + C.footerInk, color: C.footerInk, borderRadius: '999px', padding: '10px 22px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
            <svg viewBox='0 0 24 24' width='16' height='16' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>
              <path d='M12 19V5' /><path d='M5 12l7-7 7 7' />
            </svg>
            トップに戻る
            <Image src='/ic-f-mikan.webp' alt='' width={20} height={20} style={{ width: '20px', height: '20px', flexShrink: 0 }} />
          </button>
          <div style={{ fontSize: '12px', color: C.footerMuted, textAlign: 'center' }}>© 2026 出店コネクトナビ</div>
        </div>
      </div>
    </footer>
  )
}
