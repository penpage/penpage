/**
 * Feedback 頁面
 * 讓使用者提交意見回饋，並顯示歷史記錄
 * 支援自動語言偵測（中文/英文）
 */

import { useState, useEffect, useMemo } from 'react'
import { VERSION_INFO } from '../config/version'

interface FeedbackItem {
  id: string
  type: 'like' | 'suggestion' | 'bug'
  message: string
  email?: string
  userAgent: string
  timestamp: string
  version: string
}

// 多語言文字
const i18n = {
  en: {
    back: '⬅ ❮❮❮❮ Back',
    title: 'Feedback',
    subtitle: 'We value your feedback! Please share your thoughts with us.',
    typeLabel: 'Type',
    like: 'Like',
    suggestion: 'Suggestion',
    bug: 'Bug Report',
    messageLabelLike: 'What do you like?',
    messageLabelSuggestion: 'What suggestions do you have?',
    messageLabelBug: 'Please describe the issue',
    placeholderLike: 'Tell us your favorite features...',
    placeholderSuggestion: 'What new features would you like to see?',
    placeholderBug: 'Please describe the problem in detail...',
    emailLabel: 'Email (optional, for follow-up)',
    submitting: 'Submitting...',
    submit: 'Submit Feedback',
    successMessage: '✅ Thank you for your feedback! We read every message.',
    historyButton: '📋 Feedback History',
    loading: 'Loading...',
    noFeedback: 'No feedback yet',
  },
  zh: {
    back: '⬅ ❮❮❮❮ 返回',
    title: 'Feedback',
    subtitle: '我們很重視您的意見！請告訴我們您的想法。',
    typeLabel: '類型',
    like: '喜歡',
    suggestion: '建議',
    bug: 'Bug 回報',
    messageLabelLike: '您喜歡什麼？',
    messageLabelSuggestion: '您有什麼建議？',
    messageLabelBug: '請描述問題',
    placeholderLike: '告訴我們您最喜歡的功能...',
    placeholderSuggestion: '您希望看到什麼新功能？',
    placeholderBug: '請詳細描述您遇到的問題...',
    emailLabel: 'Email（選填，方便我們回覆）',
    submitting: '提交中...',
    submit: '提交 Feedback',
    successMessage: '✅ 感謝您的回饋！我們會認真閱讀每一則意見。',
    historyButton: '📋 歷史 Feedback',
    loading: '載入中...',
    noFeedback: '尚無 Feedback 記錄',
  }
}


export function FeedbackPage() {
  const [feedbackType, setFeedbackType] = useState<'like' | 'suggestion' | 'bug'>('suggestion')
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [feedbackList, setFeedbackList] = useState<FeedbackItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showHistory, setShowHistory] = useState(false)

  // 自動偵測語言
  const lang = useMemo(() => {
    const browserLang = navigator.language.toLowerCase()
    return browserLang.startsWith('zh') ? 'zh' : 'en'
  }, [])

  const t = i18n[lang]

  // 載入歷史 Feedback
  useEffect(() => {
    loadFeedbackHistory()
  }, [])

  const loadFeedbackHistory = () => {
    // 從 localStorage 讀取個人歷史
    const localFeedbacks = JSON.parse(localStorage.getItem('penpage_feedbacks') || '[]')
    setFeedbackList(localFeedbacks)
    setIsLoading(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim()) return

    setIsSubmitting(true)
    setSubmitStatus('idle')
    setErrorMessage('')

    const feedback: FeedbackItem = {
      id: `fb-${Date.now()}`,
      type: feedbackType,
      message: message.trim(),
      email: email.trim() || undefined,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
      version: VERSION_INFO.app,
    }

    try {
      // 儲存到 localStorage（本地備份）
      const localFeedbacks = JSON.parse(localStorage.getItem('penpage_feedbacks') || '[]')
      localFeedbacks.push(feedback)
      localStorage.setItem('penpage_feedbacks', JSON.stringify(localFeedbacks))

      // 嘗試發送到伺服器
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(feedback),
      })

      if (response.ok) {
        setSubmitStatus('success')
        setMessage('')
        setEmail('')
        loadFeedbackHistory()
      } else {
        // 解析伺服器錯誤回應（如 rate limit）
        try {
          const errorData = await response.json()
          if (errorData.error) {
            setSubmitStatus('error')
            setErrorMessage(errorData.error)
            return
          }
        } catch {
          // 無法解析錯誤，fallback 到 localStorage 備份
        }
        // 伺服器不可用，但已存到 localStorage
        setSubmitStatus('success')
        setMessage('')
        setEmail('')
      }
    } catch (error) {
      // 離線模式，資料已存到 localStorage
      setSubmitStatus('success')
      setMessage('')
      setEmail('')
    } finally {
      setIsSubmitting(false)
    }
  }

  const getTypeEmoji = (type: string) => {
    switch (type) {
      case 'like': return '❤️'
      case 'suggestion': return '💡'
      case 'bug': return '🐛'
      default: return '📝'
    }
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'like': return t.like
      case 'suggestion': return t.suggestion
      case 'bug': return t.bug
      default: return type
    }
  }

  const getMessageLabel = () => {
    switch (feedbackType) {
      case 'like': return t.messageLabelLike
      case 'suggestion': return t.messageLabelSuggestion
      case 'bug': return t.messageLabelBug
    }
  }

  const getPlaceholder = () => {
    switch (feedbackType) {
      case 'like': return t.placeholderLike
      case 'suggestion': return t.placeholderSuggestion
      case 'bug': return t.placeholderBug
    }
  }

  const formatDate = (timestamp: string) => {
    const locale = lang === 'zh' ? 'zh-TW' : 'en-US'
    return new Date(timestamp).toLocaleDateString(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div style={{
      color: 'var(--text-primary)',
    }}>
      {/* Subtitle */}
      <div style={{
        color: 'var(--text-secondary)',
        fontSize: '14px',
        marginBottom: '16px',
        textAlign: 'center',
      }}>
        {t.subtitle}
      </div>

      {/* Feedback Form */}
      <div style={{
        backgroundColor: 'var(--bg-toolbar)',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '24px',
      }}>
        <form onSubmit={handleSubmit}>
          {/* Type Selection */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
              {t.typeLabel}
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {(['like', 'suggestion', 'bug'] as const).map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setFeedbackType(type)}
                  style={{
                    flex: 1,
                    padding: '12px',
                    border: `2px solid ${feedbackType === type ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: '8px',
                    backgroundColor: feedbackType === type ? 'var(--bg-selected)' : 'var(--bg-input)',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    fontSize: '14px',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ fontSize: '24px', marginBottom: '4px' }}>{getTypeEmoji(type)}</div>
                  {getTypeLabel(type)}
                </button>
              ))}
            </div>
          </div>

          {/* Message */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
              {getMessageLabel()}
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={getPlaceholder()}
              style={{
                width: '100%',
                minHeight: '120px',
                padding: '12px',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-input)',
                color: 'var(--text-primary)',
                fontSize: '16px',
                resize: 'vertical',
              }}
            />
          </div>

          {/* Email (Optional) */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
              {t.emailLabel}
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                backgroundColor: 'var(--bg-input)',
                color: 'var(--text-primary)',
                fontSize: '16px',
              }}
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={!message.trim() || isSubmitting}
            style={{
              width: '100%',
              padding: '16px',
              backgroundColor: message.trim() ? '#10b981' : 'var(--bg-hover)',
              color: message.trim() ? '#fff' : 'var(--text-muted)',
              border: message.trim() ? '2px solid #059669' : '2px solid transparent',
              borderRadius: '10px',
              fontSize: '16px',
              fontWeight: '700',
              cursor: message.trim() ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s',
              boxShadow: message.trim() ? '0 4px 12px rgba(16, 185, 129, 0.4)' : 'none',
              letterSpacing: '0.5px',
            }}
          >
            {isSubmitting ? t.submitting : t.submit}
          </button>

          {/* Status Message */}
          {submitStatus === 'success' && (
            <div style={{
              marginTop: '16px',
              padding: '12px',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '8px',
              color: '#10b981',
              textAlign: 'center',
            }}>
              {t.successMessage}
            </div>
          )}
          {submitStatus === 'error' && errorMessage && (
            <div style={{
              marginTop: '16px',
              padding: '12px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
              color: '#ef4444',
              textAlign: 'center',
            }}>
              ⚠️ {errorMessage}
            </div>
          )}
        </form>
      </div>

      {/* Feedback History */}
      <div>
        <button
          onClick={() => setShowHistory(!showHistory)}
          style={{
            width: '100%',
            padding: '12px',
            backgroundColor: 'var(--bg-toolbar)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{t.historyButton} ({feedbackList.length})</span>
          <span>{showHistory ? '▲' : '▼'}</span>
        </button>

        {showHistory && (
          <div style={{ marginTop: '12px' }}>
            {isLoading ? (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                {t.loading}
              </div>
            ) : feedbackList.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>
                {t.noFeedback}
              </div>
            ) : (
              feedbackList.slice().reverse().map(item => (
                <div
                  key={item.id}
                  style={{
                    padding: '16px',
                    backgroundColor: 'var(--bg-toolbar)',
                    borderRadius: '8px',
                    marginBottom: '8px',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontWeight: '500' }}>
                      {getTypeEmoji(item.type)} {getTypeLabel(item.type)}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {formatDate(item.timestamp)}
                    </span>
                  </div>
                  <p style={{ margin: 0, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
                    {item.message}
                  </p>
                  {item.email && (
                    <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                      📧 {item.email}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Version Info */}
      <div style={{
        marginTop: '40px',
        textAlign: 'center',
        fontSize: '12px',
        color: 'var(--text-muted)',
      }}>
        PenPage v{VERSION_INFO.app}
      </div>
    </div>
  )
}

export default FeedbackPage
