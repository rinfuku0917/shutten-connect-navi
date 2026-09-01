'use client'
import Link from 'next/link'
import { C, maru } from './siteTheme'

// トップページと同じ淡いパステルグリーンのフッター。全公開ページで共有する。
// トップページのフッターと同じ構成（実績紹介・よくある質問はトップ内アンカー）
const cols: { head: string; items: { href: string; label: string }[] }[] = [
  { head: 'キッチンカーを呼びたい方', items: [
    { href: '/vendor', label: 'キッチンカーの手配・派遣' },
    { href: '/vendor/event', label: 'イベント・マルシェ・お祭り' },
    { href: '/vendor/cost', label: 'キッチンカーを呼ぶ費用' },
    { href: '/sellers', label: '登録キッチンカーを見る' },
  ] },
  { head: 'キッチンカーで出店したい方', items: [
    { href: '/space', label: '出店したい方へ' },
    { href: '/places', label: '出店場所を探す' },
    { href: '/sell', label: '車両を売りたい' },
    { href: '/#works', label: '実績紹介' },
    { href: '/blog', label: 'ブログ' },
  ] },
  { head: 'サポート', items: [
    { href: '/#faq', label: 'よくある質問' },
    { href: '/contact', label: 'お問い合わせ' },
    { href: '/login', label: 'ログイン' },
  ] },
  { head: '会社情報', items: [
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
            <Link href='/' className={maru.className} style={{ color: C.footerLogo, fontWeight: 900, fontSize: '19px', marginBottom: '10px', display: 'block', textDecoration: 'none' }}>出店コネクトナビ</Link>
            <p style={{ fontSize: '13px', color: C.footerMuted }}>キッチンカーと、場所をつなぐ。</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap', marginTop: '14px' }}>
              <a href='https://www.instagram.com/connect.navi/' target='_blank' rel='noopener noreferrer' aria-label='Instagram' className='top3-sns' style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: C.footerInk, textDecoration: 'none', fontSize: '13px', fontWeight: 700 }}>
                <svg viewBox='0 0 24 24' width='22' height='22' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>
                  <rect x='2' y='2' width='20' height='20' rx='5' />
                  <circle cx='12' cy='12' r='4.5' />
                  <circle cx='17.5' cy='6.5' r='1.3' fill='currentColor' stroke='none' />
                </svg>
                Instagram
              </a>
              <a href='https://lin.ee/Z0ddEjT' target='_blank' rel='noopener noreferrer' aria-label='公式LINEでお問い合わせ' className='top3-sns' style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: C.footerInk, textDecoration: 'none', fontSize: '13px', fontWeight: 700 }}>
                <svg viewBox='0 0 24 24' width='22' height='22' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>
                  <path d='M12 3.8c-5.1 0-9.2 3.2-9.2 7.2 0 3.6 3.3 6.6 7.7 7.1.3.1.6.2.7.4.1.2.1.5 0 .8l-.3 1.6c-.1.4.2.7.6.5 2.6-1.1 5-2.7 7-4.8 1.7-1.7 2.7-3.5 2.7-5.6 0-4-4.1-7.2-9.2-7.2z' />
                </svg>
                公式LINE
              </a>
            </div>
          </div>
          <div className='top3-footcols'>
            {cols.map(col => (
              <div key={col.head} className='top3-footcol'>
                <h4 style={{ fontSize: '12px', color: C.footerMuted, fontWeight: 700, marginBottom: '12px' }}>{col.head}</h4>
                {col.items.map(it => <Link key={it.href} href={it.href} style={linkStyle}>{it.label}</Link>)}
              </div>
            ))}
          </div>
        </div>
        <div style={{ borderTop: '1px solid rgba(47,95,67,.2)', paddingTop: '18px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
          <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label='ページ最上部に戻る' className='top3-totop' style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#fff', border: '1.5px solid ' + C.footerInk, color: C.footerInk, borderRadius: '999px', padding: '10px 22px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
            <svg viewBox='0 0 24 24' width='16' height='16' fill='none' stroke='currentColor' strokeWidth='2.5' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>
              <path d='M12 19V5' /><path d='M5 12l7-7 7 7' />
            </svg>
            トップに戻る
          </button>
          <div style={{ fontSize: '12px', color: C.footerMuted, textAlign: 'center' }}>© 2026 出店コネクトナビ</div>
        </div>
      </div>
    </footer>
  )
}
