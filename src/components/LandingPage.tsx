import { useState } from 'react'
import '../styles/landing.css'

interface LandingPageProps {
  onGetStarted: () => void
}

const LandingPage = ({ onGetStarted }: LandingPageProps) => {
  const [showDetails, setShowDetails] = useState(false)

  return (
    <div className="landing-page">
      {/* Hero Section */}
      <div className="hero-section">
        <div className="hero-content">
          <img src="/ppage2.png" alt="PenPage Logo" className="hero-logo" />
          <h1 className="hero-title">
            AI meets Markdown. <span className="highlight">You need PenPage.</span>
          </h1>
          <p className="hero-subtitle">
            Fast. Clean. Safe. Anywhere.
          </p>
          <p className="hero-description">
            Privacy-first note-taking with instant local storage, beautiful markdown editing,
            and the freedom to sync or export wherever you choose.
          </p>
          <div className="hero-cta">
            <button className="btn-primary" onClick={onGetStarted}>
              Start Writing Now – No Sign-Up Required
            </button>
            <button className="btn-secondary" onClick={() => setShowDetails(!showDetails)}>
              {showDetails ? 'Hide Details' : 'Learn More'}
            </button>
          </div>

          {/* Core Values - Always Visible */}
          <div className="core-values">
            <div className="value-item">
              <div className="value-icon">⚡</div>
              <h3>FAST</h3>
              <p>Instant load, zero lag</p>
            </div>
            <div className="value-item">
              <div className="value-icon">✨</div>
              <h3>CLEAN</h3>
              <p>Beautiful & distraction-free</p>
            </div>
            <div className="value-item">
              <div className="value-icon">🔒</div>
              <h3>SAFE</h3>
              <p>Your data, your control</p>
            </div>
            <div className="value-item">
              <div className="value-icon">🌍</div>
              <h3>ANYWHERE</h3>
              <p>Local, cloud, or export</p>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      {showDetails && (
        <div className="features-section">
          <h2 className="section-title">Why PenPage?</h2>

          <div className="features-grid">
            {/* FAST */}
            <div className="feature-card highlight-card">
              <div className="feature-icon">⚡</div>
              <h3 className="feature-title">Lightning Fast</h3>
              <p className="feature-description">
                <strong>Instant load.</strong> Zero lag. Start typing the moment you arrive.
                In the AI era, ideas move fast—capture them before they vanish.
                No loading screens, no friction, just pure thought to text.
              </p>
            </div>

            {/* CLEAN */}
            <div className="feature-card highlight-card">
              <div className="feature-icon">✨</div>
              <h3 className="feature-title">Beautiful & Clean</h3>
              <p className="feature-description">
                <strong>WYSIWYG simplicity meets Markdown power.</strong>
                Distraction-free writing with gorgeous formatting.
                Switch between visual and markdown modes instantly—never lose your flow.
              </p>
            </div>

            {/* SAFE */}
            <div className="feature-card highlight-card">
              <div className="feature-icon">🔒</div>
              <h3 className="feature-title">Privacy by Design</h3>
              <p className="feature-description">
                <strong>Your notes live in YOUR browser first.</strong>
                100% local storage. No server uploads. No cloud dependency.
                Complete control, zero surveillance.
              </p>
            </div>

            {/* ANYWHERE */}
            <div className="feature-card highlight-card">
              <div className="feature-icon">🌍</div>
              <h3 className="feature-title">Access Anywhere</h3>
              <p className="feature-description">
                <strong>Your data, your rules.</strong>
                Local-first (works offline), export anytime (plain text + Markdown).
                Never locked in. Always portable.
              </p>
            </div>

            {/* Additional Features */}
            <div className="feature-card">
              <div className="feature-icon">🤖</div>
              <h3 className="feature-title">AI-Era Ready</h3>
              <p className="feature-description">
                Capture fleeting thoughts at AI speed. Export clean Markdown
                for ChatGPT/Claude prompts. Perfect for rapid iteration and idea capture.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">🌐</div>
              <h3 className="feature-title">Future-Proof Format</h3>
              <p className="feature-description">
                Plain text + Markdown = Open standards that will outlive any app.
                No proprietary formats. No vendor lock-in. Your notes are truly yours.
              </p>
            </div>
          </div>

          {/* Use Cases */}
          <div className="use-cases-section">
            <h2 className="section-title">Perfect For</h2>
            <div className="use-cases-grid">
              <div className="use-case">
                <h4>🧠 For Thinkers</h4>
                <p>"I have 30 seconds before this idea vanishes."</p>
                <p className="use-case-solution">
                  → Open PenPage. Type. Done. Saved instantly to your device.
                </p>
              </div>

              <div className="use-case">
                <h4>💼 For Professionals</h4>
                <p>"I need notes in meetings, but can't trust cloud services."</p>
                <p className="use-case-solution">
                  → Local-first storage. Export anytime. You decide where your data lives.
                </p>
              </div>

              <div className="use-case">
                <h4>✍️ For Writers</h4>
                <p>"I want Markdown power with WYSIWYG simplicity."</p>
                <p className="use-case-solution">
                  → Toggle between modes instantly. Beautiful rendering. Powerful syntax.
                </p>
              </div>

              <div className="use-case">
                <h4>🤖 For AI Users</h4>
                <p>"I need clean Markdown for ChatGPT/Claude prompts."</p>
                <p className="use-case-solution">
                  → Export perfect Markdown with one click. Copy, paste, iterate.
                </p>
              </div>
            </div>
          </div>

          {/* Final CTA */}
          <div className="final-cta">
            <h2>Ready to capture your next big idea?</h2>
            <button className="btn-primary-large" onClick={onGetStarted}>
              Start Writing Now
            </button>
            <p className="cta-note">100% free. No sign-up required. Works offline.</p>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-content">
          <p className="footer-tagline">
            Built with care for privacy-conscious thinkers
          </p>
          <div className="footer-links">
            <a href="/privacy.html" className="footer-link">Privacy Policy</a>
            <span className="footer-separator">•</span>
            <a href="/terms.html" className="footer-link">Terms of Service</a>
            <span className="footer-separator">•</span>
            <a href="https://github.com/penpage/penpage" target="_blank" rel="noopener noreferrer" className="footer-link">
              GitHub
            </a>
          </div>
          <p className="footer-copyright">
            © 2025 PenPage. Fast, Clean, Safe, Anywhere.
          </p>
        </div>
      </footer>
    </div>
  )
}

export default LandingPage
