import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'
import { OrientationProvider } from './contexts/OrientationContext'
import './styles/global.css'

// 旋轉 / resize 時暫時關閉所有 CSS transition / animation，
// 避免 MQ 切換造成 panel「滑出」閃現等 resize-driven transition bug。
// 參考：https://css-tricks.com/stop-animations-during-window-resizing/
let resizeAnimationTimer: number | undefined
window.addEventListener('resize', () => {
  document.body.classList.add('resize-animation-stopper')
  clearTimeout(resizeAnimationTimer)
  resizeAnimationTimer = window.setTimeout(() => {
    document.body.classList.remove('resize-animation-stopper')
  }, 400)
})

// 開發模式：暴露 db 到 window 供 Console 測試
if (import.meta.env.DEV) {
  import('./services/db').then(({ db }) => {
    (window as any).__ppage_db = db
    console.log('Dev mode: window.__ppage_db available')
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <OrientationProvider>
        <App />
      </OrientationProvider>
    </ErrorBoundary>
  </StrictMode>,
)
