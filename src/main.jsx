import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import { isSupabaseConfigured } from './lib/supabase'
import App from './App'
import './index.css'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Unhandled error in app:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
          <div className="max-w-md text-center">
            <h1 className="text-lg font-semibold text-gray-900">Something went wrong</h1>
            <p className="mt-2 text-sm text-gray-600">{this.state.error.message}</p>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function ConfigError() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="max-w-md text-center">
        <h1 className="text-lg font-semibold text-gray-900">Configuration needed</h1>
        <p className="mt-2 text-sm text-gray-600">
          Supabase environment variables are missing. Set{' '}
          <code className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded">VITE_SUPABASE_URL</code>{' '}
          and{' '}
          <code className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded">VITE_SUPABASE_ANON_KEY</code>{' '}
          (locally in a <code className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded">.env</code> file
          copied from <code className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded">.env.example</code>,
          or in your hosting provider's project settings), then reload.
        </p>
      </div>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      {isSupabaseConfigured ? (
        <BrowserRouter>
          <AuthProvider>
            <App />
          </AuthProvider>
        </BrowserRouter>
      ) : (
        <ConfigError />
      )}
    </ErrorBoundary>
  </React.StrictMode>
)
