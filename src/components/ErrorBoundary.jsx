import { Component } from 'react'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Caught error:', error)
    console.error('[ErrorBoundary] Error info:', errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          padding: '2rem',
          backgroundColor: '#f5f5f5',
          fontFamily: 'sans-serif',
        }}>
          <h1 style={{ color: '#d32f2f', marginBottom: '1rem' }}>Application Error</h1>
          <p style={{ color: '#666', marginBottom: '1rem', textAlign: 'center' }}>
            Something went wrong. Please check the console for details.
          </p>
          <div style={{
            padding: '1rem',
            backgroundColor: '#fff',
            border: '1px solid #ddd',
            borderRadius: '4px',
            maxWidth: '500px',
            wordBreak: 'break-word',
            fontSize: '0.9rem',
            color: '#d32f2f',
          }}>
            {this.state.error?.toString()}
          </div>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: '2rem',
              padding: '0.5rem 1rem',
              backgroundColor: '#1976d2',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Reload Page
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
