import React, { Component, ErrorInfo, ReactNode } from 'react'
import logger from '../utils/logger'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
  errorInfo?: ErrorInfo
}

/**
 * Error Boundary 組件
 * 捕獲子組件樹中的 JavaScript 錯誤，記錄錯誤並顯示備用 UI
 */
class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  }

  public static getDerivedStateFromError(error: Error): State {
    // 更新 state 以在下一次渲染時顯示備用 UI
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // 記錄錯誤到控制台
    logger.error('ErrorBoundary caught an error:', error, errorInfo)

    // 保存錯誤信息到 state
    this.setState({
      error,
      errorInfo
    })

  }

  private handleReload = () => {
    window.location.reload()
  }

  private handleGoHome = () => {
    window.location.href = '/'
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={styles.container}>
          <div style={styles.content}>
            <div style={styles.iconContainer}>
              <span style={styles.icon}>⚠️</span>
            </div>

            <h1 style={styles.title}>Oops! Something went wrong</h1>

            <p style={styles.description}>
              We're sorry for the inconvenience. An unexpected error occurred.
            </p>

            <div style={styles.buttonGroup}>
              <button
                onClick={this.handleReload}
                style={{ ...styles.button, ...styles.primaryButton }}
              >
                Refresh Page
              </button>
              <button
                onClick={this.handleGoHome}
                style={{ ...styles.button, ...styles.secondaryButton }}
              >
                Go Home
              </button>
            </div>

            {/* 開發環境顯示錯誤詳情 */}
            {import.meta.env.DEV && this.state.error && (
              <details style={styles.details}>
                <summary style={styles.summary}>Error Details (Dev Only)</summary>
                <pre style={styles.errorText}>
                  <strong>Error:</strong> {this.state.error.toString()}
                  {'\n\n'}
                  <strong>Stack:</strong>
                  {'\n'}
                  {this.state.error.stack}
                  {this.state.errorInfo && (
                    <>
                      {'\n\n'}
                      <strong>Component Stack:</strong>
                      {'\n'}
                      {this.state.errorInfo.componentStack}
                    </>
                  )}
                </pre>
              </details>
            )}

            <p style={styles.helpText}>
              If this problem persists, please contact support at{' '}
              <a href="mailto:support@penpage.com" style={styles.link}>
                support@penpage.com
              </a>
            </p>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// Inline styles for error boundary (避免依賴外部 CSS)
const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: '2rem',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  content: {
    background: 'white',
    borderRadius: '16px',
    padding: '3rem 2rem',
    maxWidth: '600px',
    width: '100%',
    textAlign: 'center',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
  },
  iconContainer: {
    marginBottom: '1.5rem'
  },
  icon: {
    fontSize: '4rem',
    display: 'inline-block',
    animation: 'pulse 2s ease-in-out infinite'
  },
  title: {
    fontSize: '2rem',
    fontWeight: 700,
    color: '#1a202c',
    marginBottom: '1rem'
  },
  description: {
    fontSize: '1.1rem',
    color: '#4a5568',
    marginBottom: '2rem',
    lineHeight: 1.6
  },
  buttonGroup: {
    display: 'flex',
    gap: '1rem',
    justifyContent: 'center',
    flexWrap: 'wrap' as 'wrap',
    marginBottom: '2rem'
  },
  button: {
    padding: '0.75rem 2rem',
    fontSize: '1rem',
    fontWeight: 600,
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    minWidth: '140px'
  },
  primaryButton: {
    background: '#4F46E5',
    color: 'white'
  },
  secondaryButton: {
    background: '#f7fafc',
    color: '#4a5568',
    border: '2px solid #e2e8f0'
  },
  details: {
    marginTop: '2rem',
    textAlign: 'left' as 'left',
    background: '#f7fafc',
    padding: '1rem',
    borderRadius: '8px',
    border: '1px solid #e2e8f0'
  },
  summary: {
    cursor: 'pointer',
    fontWeight: 600,
    color: '#4a5568',
    marginBottom: '0.5rem'
  },
  errorText: {
    fontSize: '0.85rem',
    color: '#e53e3e',
    background: '#fff5f5',
    padding: '1rem',
    borderRadius: '4px',
    overflow: 'auto',
    maxHeight: '300px',
    lineHeight: 1.5
  },
  helpText: {
    fontSize: '0.9rem',
    color: '#718096',
    marginTop: '2rem'
  },
  link: {
    color: '#4F46E5',
    textDecoration: 'none',
    fontWeight: 600
  }
}

export default ErrorBoundary
