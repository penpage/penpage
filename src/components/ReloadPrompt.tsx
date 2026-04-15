import { useEffect } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useToast } from '../hooks/useToast'
import ToastContainer from './ToastContainer'

function ReloadPrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered: ' + r)
    },
    onRegisterError(error) {
      console.log('SW registration error', error)
    },
  })

  const { toasts, showToast, removeToast } = useToast()

  const close = () => {
    setOfflineReady(false)
    setNeedRefresh(false)
  }

  useEffect(() => {
    if (offlineReady) {
      showToast('App ready to work offline', 'success')
    }
  }, [offlineReady, showToast])

  useEffect(() => {
    if (needRefresh) {
      // 自定義一個帶有操作按鈕的 Toast 內容並不容易直接透過 string message 傳遞
      // 這裡我們使用一個特殊的 toast 顯示方式，或者直接渲染一個固定的提示組件
      // 為了保持簡單且非阻塞，我們這裡渲染一個特殊的 UI，不使用標準 Toast，
      // 或者我們擴展 ToastContainer 來支持 action。
      // 鑑於現有架構，我們直接在這個組件 return 處渲染一個固定的 Update Prompt
    }
  }, [needRefresh])

  return (
    <>
      {/* 處理標準 Toasts (如 offline ready) */}
      <div className="reload-prompt-toasts">
        <ToastContainer toasts={toasts} onRemove={removeToast} />
      </div>

      {/* 專門處理更新提示 (Need Refresh) */}
      {(needRefresh) && (
        <div className="pwa-reload-prompt" style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          backgroundColor: '#333',
          color: 'white',
          padding: '12px 20px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          fontSize: '14px'
        }}>
          <span>New content available, click on reload button to update.</span>
          <button 
            onClick={() => updateServiceWorker(true)}
            style={{
              backgroundColor: '#4F46E5',
              color: 'white',
              border: 'none',
              padding: '6px 12px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Reload
          </button>
          <button 
            onClick={() => close()}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#999',
              fontSize: '18px',
              cursor: 'pointer',
              marginLeft: '4px'
            }}
          >
            ×
          </button>
        </div>
      )}
    </>
  )
}

export default ReloadPrompt
