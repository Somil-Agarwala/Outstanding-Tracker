import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import Layout           from './components/layout/Layout'
import LoginPage        from './components/layout/LoginPage'
import Dashboard        from './components/Dashboard'
import CollectionsPage  from './components/collections/CollectionsPage'
import InvoicesPage     from './components/invoices/InvoicesPage'
import AgeingPage       from './components/ageing/AgeingPage'
import DealersPage      from './components/dealers/DealersPage'
import DealerDetailPage from './components/dealers/DealerDetailPage'
import DataHealthPage   from './components/health/DataHealthPage'
import MasterPage       from './components/master/MasterPage'
import ReportsPage      from './components/reports/ReportsPage'

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-paper" role="status" aria-label="Loading">
      <div className="w-8 h-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
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
        <Route path="collections"  element={<CollectionsPage />} />
        <Route path="invoices"     element={<InvoicesPage />} />
        <Route path="ageing"       element={<AgeingPage />} />
        <Route path="dealers"      element={<DealersPage />} />
        <Route path="dealers/:id"  element={<DealerDetailPage />} />
        <Route path="data-health"  element={<DataHealthPage />} />
        <Route path="reports"      element={<ReportsPage />} />
        <Route path="master"       element={<MasterPage />} />
        <Route path="watchlist"    element={<Navigate to="/dealers?show=watch" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
