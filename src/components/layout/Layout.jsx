import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import {
  LayoutDashboard, FileText, ShieldAlert,
  BarChart2, Database, LogOut, IndianRupee,
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

  async function handleSignOut() {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="flex h-full min-h-screen">
      {/* ── Sidebar ─────────────────────────────────── */}
      <aside className="w-56 shrink-0 bg-gray-950 flex flex-col">
        {/* logo */}
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-white/10">
          <div className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center shrink-0">
            <IndianRupee size={14} className="text-white" />
          </div>
          <div>
            <p className="text-white text-sm font-semibold leading-none">PayTrack</p>
            <p className="text-white/40 text-xs mt-0.5">Outstanding Manager</p>
          </div>
        </div>

        {/* nav */}
        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {NAV
            .filter(n => !n.adminOnly || isAdmin)
            .map(({ to, end, Icon, label }) => (
              <NavLink
                key={to} to={to} end={end}
                className={({ isActive }) =>
                  `flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    isActive
                      ? 'bg-indigo-600 text-white'
                      : 'text-white/50 hover:text-white hover:bg-white/5'
                  }`
                }
              >
                <Icon size={15} />
                {label}
              </NavLink>
            ))}
        </nav>

        {/* user */}
        <div className="p-3 border-t border-white/10">
          <div className="px-3 py-2 mb-1">
            <p className="text-white text-xs font-medium truncate">{profile?.full_name}</p>
            <p className="text-white/40 text-xs mt-0.5">
              {isAdmin ? 'Admin' : 'Location Manager'} · {profile?.locations?.name ?? '—'}
            </p>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-white/50 hover:text-white hover:bg-white/5 text-sm transition-colors"
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </aside>

      {/* ── Main area ──────────────────────────────── */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
