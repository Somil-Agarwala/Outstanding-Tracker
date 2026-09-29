import { useState, useEffect } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { LogOut, Home, Phone, FileText, Users, MoreHorizontal, X } from 'lucide-react'

const NAV = [
  { to: '/',            end: true,  label: 'Dashboard' },
  { to: '/collections', label: 'Collections' },
  { to: '/invoices',    label: 'Invoices' },
  { to: '/ageing',      label: 'Ageing' },
  { to: '/dealers',     label: 'Dealers' },
  { to: '/data-health', label: 'Data Health' },
  { to: '/reports',     label: 'Reports' },
  { to: '/master',      label: 'Master Data', adminOnly: true },
]

const TABS = [
  { to: '/',            end: true, label: 'Dashboard',   Icon: Home },
  { to: '/collections', label: 'Collections', Icon: Phone },
  { to: '/invoices',    label: 'Invoices',    Icon: FileText },
  { to: '/dealers',     label: 'Dealers',     Icon: Users },
]

export function initials(name) {
  const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '?'
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

export default function Layout() {
  const { profile, isAdmin, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [moreOpen, setMoreOpen] = useState(false)

  useEffect(() => { setMoreOpen(false) }, [location.pathname])

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  const nav = NAV.filter(n => !n.adminOnly || isAdmin)
  const firstName = profile?.full_name?.split(/\s+/)[0] ?? ''
  const scope = isAdmin ? 'sees all locations' : profile?.locations?.name ?? ''
  const tabPaths = TABS.map(t => t.to)
  const wide = location.pathname.startsWith('/invoices')
  const moreActive = !TABS.some(t => (t.end ? location.pathname === t.to : location.pathname.startsWith(t.to)))

  return (
    <div className="flex flex-col h-full min-h-screen bg-paper">
      <header className="shrink-0 z-20 bg-white border-b border-line">
        <div className="flex items-center gap-4 md:gap-7 h-14 md:h-[62px] px-4 md:px-8">
          <NavLink to="/" className="flex items-baseline gap-2 shrink-0 no-underline">
            <span className="text-[19px] font-bold text-ink tracking-[-0.02em]">PayTrack</span>
            <span className="hidden lg:inline text-[11px] text-faint">S.S. Commercial</span>
          </NavLink>

          <nav aria-label="Main" className="hidden md:flex gap-[3px] flex-1 min-w-0 overflow-x-auto">
            {nav.map(({ to, end, label }) => (
              <NavLink key={to} to={to} end={end}
                className={({ isActive }) =>
                  `px-[15px] py-[9px] text-[13px] rounded-lg whitespace-nowrap transition-colors ${
                    isActive ? 'font-semibold text-white bg-brand hover:text-white'
                             : 'font-medium text-muted hover:text-ink hover:bg-line-soft'}`}>
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-2.5 shrink-0">
            <span className="hidden 2xl:inline text-xs text-muted">{firstName}{scope && ` · ${scope}`}</span>
            <div className="hidden md:flex w-[31px] h-[31px] rounded-full bg-brand text-white text-xs font-semibold items-center justify-center"
              title={profile?.full_name ?? ''} aria-hidden="true">
              {initials(profile?.full_name)}
            </div>
            <button type="button" onClick={handleSignOut}
              className="hidden md:inline-flex items-center justify-center w-9 h-9 rounded-lg text-faint hover:text-ink hover:bg-line-soft"
              aria-label="Sign out" title="Sign out">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-auto pb-[76px] md:pb-0">
        <div className={`animate-fadein ${wide ? 'md:h-full' : 'max-w-[1600px] mx-auto'}`}>
          <Outlet />
        </div>
      </main>

      <nav aria-label="Main" className="md:hidden fixed bottom-0 inset-x-0 z-30 flex bg-white border-t border-line"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {TABS.map(({ to, end, label, Icon }) => (
          <NavLink key={to} to={to} end={end}
            className={({ isActive }) =>
              `flex-1 min-h-[58px] flex flex-col items-center justify-center gap-1 ${isActive ? 'text-brand' : 'text-faint'}`}>
            <Icon size={20} strokeWidth={2} aria-hidden="true" />
            <span className="text-[11px] font-semibold">{label}</span>
          </NavLink>
        ))}
        <button type="button" onClick={() => setMoreOpen(true)}
          className={`flex-1 min-h-[58px] flex flex-col items-center justify-center gap-1 ${moreActive ? 'text-brand' : 'text-faint'}`}>
          <MoreHorizontal size={20} aria-hidden="true" />
          <span className="text-[11px] font-semibold">More</span>
        </button>
      </nav>

      {moreOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label="More pages">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setMoreOpen(false)} />
          <div className="relative bg-white rounded-t-2xl p-4 pb-6">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-[15px] font-bold text-ink">{profile?.full_name}</div>
                <div className="text-xs text-faint">{isAdmin ? 'Admin · all locations' : scope}</div>
              </div>
              <button type="button" onClick={() => setMoreOpen(false)} aria-label="Close"
                className="w-11 h-11 flex items-center justify-center text-faint"><X size={20} /></button>
            </div>
            <div className="flex flex-col">
              {nav.filter(n => !tabPaths.includes(n.to)).map(({ to, label }) => (
                <NavLink key={to} to={to}
                  className={({ isActive }) => `min-h-[48px] flex items-center px-2 text-[15px] border-b border-line-soft ${isActive ? 'font-semibold text-brand' : 'text-ink'}`}>
                  {label}
                </NavLink>
              ))}
              <button type="button" onClick={handleSignOut}
                className="min-h-[48px] flex items-center gap-2 px-2 text-[15px] text-muted">
                <LogOut size={16} /> Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
