import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import {
  LayoutDashboard, FileText, ShieldAlert,
  BarChart2, Database, LogOut, IndianRupee, Menu, X,
} from 'lucide-react'
 
const NAV = [
  { to: '/',          end: true,  Icon: LayoutDashboard, label: 'Dashboard'        },
  { to: '/invoices',  end: false, Icon: FileText,         label: 'Invoices'         },
  { to: '/watchlist', end: false, Icon: ShieldAlert,      label: 'Risk & Watchlist' },
  { to: '/reports',   end: false, Icon: BarChart2,        label: 'Reports'          },
  { to: '/master',    end: false, Icon: Database,         label: 'Master Data', adminOnly: true },
]
 
export default function Layout() {
  const { profile, isAdmin, signOut } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
 
  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }
 
  const initial = profile?.full_name?.charAt(0)?.toUpperCase() ?? '?'
 
  return (
    <div className="flex flex-col h-full min-h-screen">
 
      {/* ── Top Navbar ── */}
      <header
        className="shrink-0 z-20"
        style={{ background: 'linear-gradient(90deg, #0c1120 0%, #111827 100%)' }}
      >
        <div className="flex items-center h-11 px-4 gap-3">
 
          {/* Logo */}
          <div className="flex items-center gap-2 shrink-0 mr-3">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                boxShadow: '0 2px 8px rgba(99,102,241,0.4)',
              }}
            >
              <IndianRupee size={13} className="text-white" />
            </div>
            <div className="hidden sm:block">
              <p className="text-white text-xs font-bold leading-none tracking-tight">PayTrack</p>
              <p className="text-slate-500 text-[9px] font-medium tracking-wide mt-0.5">Distribution Manager</p>
            </div>
          </div>
 
          {/* Divider */}
          <div className="hidden md:block w-px h-5 bg-white/10 mr-1" />
 
          {/* Nav links — desktop */}
          <nav className="hidden md:flex items-center gap-0.5 flex-1">
            {NAV
              .filter(n => !n.adminOnly || isAdmin)
              .map(({ to, end, Icon, label }) => (
                <NavLink
                  key={to} to={to} end={end}
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all ${
                      isActive
                        ? 'text-white'
                        : 'text-slate-500 hover:text-slate-200 hover:bg-white/5'
                    }`
                  }
                  style={({ isActive }) => isActive ? {
                    background: 'rgba(99,102,241,0.25)',
                    boxShadow: 'inset 0 0 0 1px rgba(99,102,241,0.4)',
                  } : {}}
                >
                  <Icon size={12} />
                  {label}
                </NavLink>
              ))}
          </nav>
 
          {/* Right side — user + signout */}
          <div className="ml-auto flex items-center gap-2">
            {/* User pill */}
            <div className="hidden md:flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/5">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-indigo-300 shrink-0"
                style={{ background: 'rgba(99,102,241,0.25)', border: '1px solid rgba(99,102,241,0.3)' }}
              >
                {initial}
              </div>
              <div className="leading-none">
                <p className="text-white text-[10px] font-semibold">{profile?.full_name ?? '—'}</p>
                <p className="text-slate-500 text-[9px] mt-0.5">
                  {isAdmin ? 'Admin' : 'Mgr'} · {profile?.locations?.name ?? '—'}
                </p>
              </div>
            </div>
 
            {/* Sign out */}
            <button
              onClick={handleSignOut}
              className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg
                         text-slate-500 hover:text-white hover:bg-white/5
                         text-[11px] font-medium transition-colors"
            >
              <LogOut size={12} /> Sign out
            </button>
 
            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(o => !o)}
              className="md:hidden text-slate-400 hover:text-white transition-colors p-1"
            >
              {mobileOpen ? <X size={17} /> : <Menu size={17} />}
            </button>
          </div>
        </div>
 
        {/* Mobile dropdown */}
        {mobileOpen && (
          <div
            className="md:hidden border-t border-white/5 px-3 py-2 space-y-0.5"
            style={{ background: '#0c1120' }}
          >
            {NAV
              .filter(n => !n.adminOnly || isAdmin)
              .map(({ to, end, Icon, label }) => (
                <NavLink
                  key={to} to={to} end={end}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-semibold transition-colors ${
                      isActive
                        ? 'bg-indigo-600/80 text-white'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`
                  }
                >
                  <Icon size={13} /> {label}
                </NavLink>
              ))}
            <div className="pt-2 border-t border-white/5 mt-2">
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 px-3 py-2 text-slate-500 hover:text-white text-xs font-medium transition-colors"
              >
                <LogOut size={12} /> Sign out · {profile?.full_name}
              </button>
            </div>
          </div>
        )}
      </header>
 
      {/* ── Full-width main content ── */}
      <main className="flex-1 overflow-auto bg-slate-50">
        <div className="animate-fadein">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
 
