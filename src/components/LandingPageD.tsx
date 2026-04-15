import { useMemo } from 'react'
import '../styles/landing-d.css'

interface LandingPageDProps {
  onGetStarted: () => void
}

// 多語言文字
const i18n = {
  en: {
    // Hero
    tagline: 'AI meets Markdown. You need PenPage.',
    subtitle: 'Write beautifully. Stay private. Go anywhere.',
    startBtn: 'Get Started',
    installBtn: 'Install APP',
    // Section
    sectionLabel: 'THE PENPAGE WAY',
    // Card 1 - Local First
    card1Label: 'Local First',
    card1Title: 'Your data stays on your device.',
    card1Desc: 'Notes are stored in your browser\'s IndexedDB. Your data belongs only to you.',
    card1Sub: 'We have no servers storing your notes.',
    // Card 2 - Zero Friction
    card2Label: 'Zero Friction',
    card2Title: 'No registration required.',
    card2Desc: 'Open and use. No account, no waiting. Like it? Keep using it.',
    card2Sub: 'No behavior tracking, no data lock-in. Leave anytime, take everything.',
    // Card 3 - Lightweight
    card3Label: 'Lightweight',
    card3Title: 'Fast and portable anywhere.',
    card3Desc: 'Fast to start, works cross-platform. Standard Markdown format, export anytime.',
    card3Sub: 'No bloated features, no proprietary format lock-in.',
    // Card 4 - Privacy
    card4Label: 'Privacy',
    card4Title: 'Your secrets stay secret.',
    card4Desc: 'Important notes can be encrypted. Even if your device is lost or cloud is breached, without your password the content is just gibberish.',
    card4Sub: 'No one can read your encrypted content.',
    // Footer CTA
    footerTitle: 'Ready to start?',
    footerSubtitle: 'No sign-up required, just open your browser and start writing.',
    // Footer
    footerTagline: 'Built with ♥ for privacy-conscious thinkers',
    privacyPolicy: 'Privacy Policy',
    termsOfService: 'Terms of Service',
  },
  zh: {
    // Hero
    tagline: 'AI meets Markdown. You need PenPage.',
    subtitle: 'Write beautifully. Stay private. Go anywhere.',
    startBtn: '開始使用',
    installBtn: '安裝 APP',
    // Section
    sectionLabel: 'THE PENPAGE WAY',
    // Card 1 - Local First
    card1Label: '本地優先',
    card1Title: '資料留在你的裝置。',
    card1Desc: '筆記儲存在瀏覽器的 IndexedDB。你的資料只屬於你。',
    card1Sub: '我們沒有伺服器儲存你的筆記。',
    // Card 2 - Zero Friction
    card2Label: '零門檻',
    card2Title: '免註冊即可使用。',
    card2Desc: '開即用，無需帳號，無需等待。喜歡就繼續用。',
    card2Sub: '不追蹤你的行為，不鎖定你的資料。隨時離開，帶走一切。',
    // Card 3 - Lightweight
    card3Label: '輕量',
    card3Title: '快速且可攜。',
    card3Desc: '快速啟動，跨平台運作。標準 Markdown 格式，隨時匯出。',
    card3Sub: '沒有臃腫的功能，沒有專有格式綁定。',
    // Card 4 - Privacy
    card4Label: '隱私',
    card4Title: '你的秘密只屬於你。',
    card4Desc: '重要筆記可以加密。即使裝置遺失或雲端外洩，沒有密碼內容就是亂碼。',
    card4Sub: '沒有人能讀取你的加密內容。',
    // Footer CTA
    footerTitle: 'Ready to start?',
    footerSubtitle: 'No sign-up required, just open your browser and start writing.',
    // Footer
    footerTagline: '為注重隱私的思考者用心打造',
    privacyPolicy: '隱私權政策',
    termsOfService: '服務條款',
  }
}

/**
 * Landing Page D
 * Apple 風格 + 黑板主題
 * 支援中英文顯示
 */
const LandingPageD = ({ onGetStarted }: LandingPageDProps) => {
  // 自動偵測語言
  const lang = useMemo(() => {
    const browserLang = navigator.language.toLowerCase()
    return browserLang.startsWith('zh') ? 'zh' : 'en'
  }, [])

  const t = i18n[lang]

  // 前往安裝頁面
  const goToInstall = () => {
    window.location.hash = '#/install'
  }

  return (
    <div className="landing-d">
      {/* 木框頂部 */}
      <div className="wooden-frame wooden-frame-top" />

      {/* Hero */}
      <section className="hero">
        <h1 className="logo-text">PenPage</h1>
        <p className="tagline">{t.tagline}</p>
        <p className="subtitle">{t.subtitle}</p>
        <div className="cta-buttons">
          <button className="btn-primary" onClick={onGetStarted}>
            {t.startBtn}
          </button>
          <button className="btn-secondary" onClick={goToInstall}>
            {t.installBtn}
          </button>
        </div>
      </section>

      {/* Promise Section */}
      <section className="promise-section">
        <p className="section-label">{t.sectionLabel}</p>
        <div className="cards-grid">

          <div className="card">
            <p className="card-label">{t.card1Label}</p>
            <h3>{t.card1Title}</h3>
            <div className="card-description">
              <p className="we-do">{t.card1Desc}</p>
              <p className="we-dont">{t.card1Sub}</p>
            </div>
          </div>

          <div className="card">
            <p className="card-label">{t.card2Label}</p>
            <h3>{t.card2Title}</h3>
            <div className="card-description">
              <p className="we-do">{t.card2Desc}</p>
              <p className="we-dont">{t.card2Sub}</p>
            </div>
          </div>

          <div className="card">
            <p className="card-label">{t.card3Label}</p>
            <h3>{t.card3Title}</h3>
            <div className="card-description">
              <p className="we-do">{t.card3Desc}</p>
              <p className="we-dont">{t.card3Sub}</p>
            </div>
          </div>

          <div className="card">
            <p className="card-label">{t.card4Label}</p>
            <h3>{t.card4Title}</h3>
            <div className="card-description">
              <p className="we-do">{t.card4Desc}</p>
              <p className="we-dont">{t.card4Sub}</p>
            </div>
          </div>

        </div>
      </section>

      {/* Footer CTA */}
      <section className="footer-cta">
        <h2>{t.footerTitle}</h2>
        <p className="footer-subtitle">{t.footerSubtitle}</p>
        <div className="cta-buttons">
          <button className="btn-primary" onClick={onGetStarted}>
            {t.startBtn}
          </button>
          <button className="btn-secondary" onClick={goToInstall}>
            {t.installBtn}
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <p className="footer-tagline">{t.footerTagline}</p>
        <div className="footer-links">
          <a href="/privacy.html">{t.privacyPolicy}</a>
          <span>|</span>
          <a href="/terms.html">{t.termsOfService}</a>
        </div>
      </footer>

      {/* 木框底部 */}
      <div className="wooden-frame wooden-frame-bottom" />
    </div>
  )
}

export default LandingPageD
