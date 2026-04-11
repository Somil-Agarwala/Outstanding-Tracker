import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Layout      from './components/layout/Layout'
import LoginPage   from './components/layout/LoginPage'
import Dashboard   from './components/Dashboard'
import InvoicesPage  from './components/invoices/InvoicesPage'
import WatchlistPage from './components/risk/WatchlistPage'
import MasterPage    from './components/master/MasterPage'
import ReportsPage   from './components/reports/ReportsPage'

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function Guard({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<Guard><Layout /></Guard>}>
        <Route index element={<Dashboard />} />
        <Route path="invoices"  element={<InvoicesPage />} />
        <Route path="watchlist" element={<WatchlistPage />} />
        <Route path="reports"   element={<ReportsPage />} />
        <Route path="master"    element={<MasterPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
