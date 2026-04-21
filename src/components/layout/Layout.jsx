import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import {
  LayoutDashboard, FileText, ShieldAlert,
  BarChart2, Database, LogOut, IndianRupee, Menu,
} from 'lucide-react'
import { useState } from 'react'

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

  return (
    <div className="flex flex-col h-full min-h-screen">
      {/* ── Top Navbar ── */}
      <header className="shrink-0 bg-gray-950 border-b border-white/10 z-20">
        <div className="flex items-center h-12 px-4 gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2 shrink-0 mr-2">
            <div className="w-6 h-6 rounded-md bg-indigo-500 flex items-center justify-center">
              <IndianRupee size={12} className="text-white" />
            </div>
            <span className="text-white text-sm font-semibold">PayTrack</span>
          </div>

          {/* Nav links — desktop */}
          <nav className="hidden md:flex items-center gap-0.5 flex-1">
            {NAV
              .filter(n => !n.adminOnly || isAdmin)
              .map(({ to, end, Icon, label }) => (
                <NavLink
                  key={to} to={to} end={end}
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-indigo-600 text-white'
                        : 'text-white/50 hover:text-white hover:bg-white/5'
                    }`
                  }
                >
                  <Icon size={13} />
                  {label}
                </NavLink>
              ))}
          </nav>

          {/* Right side — user + signout */}
          <div className="ml-auto flex items-center gap-3">
            <div className="hidden md:block text-right">
              <p className="text-white text-xs font-medium leading-none">{profile?.full_name}</p>
              <p className="text-white/40 text-[10px] mt-0.5">
                {isAdmin ? 'Admin' : 'Location Manager'} · {profile?.locations?.name ?? '—'}
              </p>
            </div>
            <button
              onClick={handleSignOut}
              className="flex items-center gap-1.5 text-white/50 hover:text-white text-xs transition-colors"
            >
              <LogOut size={13} /> <span className="hidden md:inline">Sign out</span>
            </button>
            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileOpen(o => !o)}
              className="md:hidden text-white/50 hover:text-white"
            >
              <Menu size={18} />
            </button>
          </div>
        </div>

        {/* Mobile dropdown nav */}
        {mobileOpen && (
          <div className="md:hidden border-t border-white/10 px-3 py-2 space-y-0.5">
            {NAV
              .filter(n => !n.adminOnly || isAdmin)
              .map(({ to, end, Icon, label }) => (
                <NavLink
                  key={to} to={to} end={end}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                      isActive
                        ? 'bg-indigo-600 text-white'
                        : 'text-white/50 hover:text-white hover:bg-white/5'
                    }`
                  }
                >
                  <Icon size={14} /> {label}
                </NavLink>
              ))}
          </div>
        )}
      </header>

      {/* ── Main content — full width ── */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
