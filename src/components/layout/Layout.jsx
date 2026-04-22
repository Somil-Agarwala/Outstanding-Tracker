import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import {
  LayoutDashboard, FileText, ShieldAlert,
  BarChart2, Database, LogOut, IndianRupee, ChevronRight,
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

  const initial = profile?.full_name?.charAt(0)?.toUpperCase() ?? '?'

  return (
    <div className="flex h-full min-h-screen">

      {/* ── Sidebar ── */}
      <aside
        className="w-52 shrink-0 flex flex-col"
        style={{ background: 'linear-gradient(180deg, #0c1120 0%, #111827 60%, #0f172a 100%)' }}
      >
        {/* Logo */}
        <div className="px-4 pt-5 pb-4">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)', boxShadow: '0 4px 12px rgba(99,102,241,0.4)' }}
            >
              <IndianRupee size={15} className="text-white" />
            </div>
            <div>
              <p className="text-white text-sm font-bold leading-none tracking-tight">PayTrack</p>
              <p className="text-slate-500 text-[10px] mt-0.5 font-medium tracking-wide">
                Distribution Manager
              </p>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="mx-4 h-px bg-white/5 mb-3" />

        {/* Nav links */}
        <nav className="flex-1 px-2 space-y-0.5 overflow-y-auto">
          {NAV
            .filter(n => !n.adminOnly || isAdmin)
            .map(({ to, end, Icon, label }) => (
              <NavLink
                key={to} to={to} end={end}
                className={({ isActive }) =>
                  `group flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'text-white'
                      : 'text-slate-500 hover:text-slate-200 hover:bg-white/5'
                  }`
                }
                style={({ isActive }) => isActive ? {
                  background: 'linear-gradient(135deg, rgba(99,102,241,0.9), rgba(79,70,229,0.8))',
                  boxShadow: '0 2px 8px rgba(79,70,229,0.35)',
                } : {}}
              >
                {({ isActive }) => (
                  <>
                    <span className="flex items-center gap-2.5">
                      <Icon
                        size={14}
                        className={isActive ? 'text-white' : 'text-slate-600 group-hover:text-slate-400'}
                      />
                      {label}
                    </span>
                    {isActive && <ChevronRight size={11} className="text-white/40" />}
                  </>
                )}
              </NavLink>
            ))}
        </nav>

        {/* Divider */}
        <div className="mx-4 h-px bg-white/5 mt-3" />

        {/* User block */}
        <div className="px-2 py-3">
          <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-white/5 mb-1.5">
            {/* Avatar */}
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold text-indigo-300"
              style={{ background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.3)' }}
            >
              {initial}
            </div>
            <div className="min-w-0">
              <p className="text-white text-xs font-semibold truncate leading-none">
                {profile?.full_name ?? '—'}
              </p>
              <p className="text-slate-500 text-[10px] mt-0.5 truncate">
                {isAdmin ? 'Admin' : 'Mgr'} · {profile?.locations?.name ?? '—'}
              </p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg
                       text-slate-500 hover:text-slate-200 hover:bg-white/5
                       text-xs font-medium transition-colors"
          >
            <LogOut size={12} />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-auto bg-slate-50">
        <div className="animate-fadein">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
