import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { IndianRupee, Loader2 } from 'lucide-react'

export default function LoginPage() {
  const { signIn } = useAuth()
  const navigate   = useNavigate()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [err,      setErr]      = useState('')
  const [busy,     setBusy]     = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setErr('')
    setBusy(true)
    const error = await signIn(email.trim(), password)
    if (error) {
      setErr('Invalid email or password. Please try again.')
      setBusy(false)
    } else {
      navigate('/')
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* brand */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center">
            <IndianRupee size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-white text-xl font-semibold">PayTrack</h1>
            <p className="text-white/40 text-sm">Outstanding Payments Manager</p>
          </div>
        </div>

        {/* card */}
        <div className="bg-gray-900 border border-white/10 rounded-2xl p-6">
          <h2 className="text-white text-base font-medium mb-5">Sign in to your account</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">Email address</label>
              <input
                type="email" required autoComplete="email"
                value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full bg-white/5 border border-white/10 text-white text-sm rounded-lg px-3 py-2.5 placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 mb-1.5">Password</label>
              <input
                type="password" required autoComplete="current-password"
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-white/5 border border-white/10 text-white text-sm rounded-lg px-3 py-2.5 placeholder-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {err && (
              <p className="text-sm text-red-400 bg-red-900/30 border border-red-800/60 rounded-lg px-3 py-2">
                {err}
              </p>
            )}

            <button
              type="submit" disabled={busy}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium py-2.5 rounded-lg transition-colors disabled:opacity-60"
            >
              {busy && <Loader2 size={14} className="animate-spin" />}
              Sign in
            </button>
          </form>
        </div>

        <p className="text-center text-white/25 text-xs mt-5">
          Contact your admin to get access credentials
        </p>
      </div>
    </div>
  )
}
