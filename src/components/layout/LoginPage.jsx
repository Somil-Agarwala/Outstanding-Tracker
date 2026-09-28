import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { Loader2 } from 'lucide-react'

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
    <div className="min-h-screen bg-paper flex items-center justify-center p-4">
      <div className="w-full max-w-[380px]">
        <div className="mb-7">
          <div className="flex items-baseline gap-2">
            <h1 className="m-0 text-[26px] font-bold text-ink tracking-[-0.02em]">PayTrack</h1>
            <span className="text-xs text-faint">Agarwal Distribution</span>
          </div>
          <p className="mt-1 text-sm text-muted">Outstanding Payments Manager</p>
        </div>

        <div className="bg-white border border-line rounded-xl p-6">
          <h2 className="m-0 mb-5 text-base font-semibold text-ink">Sign in to your account</h2>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="email" className="label">Email address</label>
              <input id="email" type="email" required autoComplete="email"
                value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@company.com" className="input min-h-[44px]" />
            </div>
            <div>
              <label htmlFor="password" className="label">Password</label>
              <input id="password" type="password" required autoComplete="current-password"
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••" className="input min-h-[44px]" />
            </div>

            {err && (
              <p role="alert" className="m-0 text-[13px] text-bad bg-bad-bg border border-bad-line rounded-lg px-3 py-2">
                {err}
              </p>
            )}

            <button type="submit" disabled={busy} className="btn-primary w-full min-h-[46px] text-sm">
              {busy && <Loader2 size={15} className="animate-spin" />}
              Sign in
            </button>
          </form>
        </div>

        <p className="text-center text-faint text-xs mt-5">
          Contact your admin to get access credentials
        </p>
      </div>
    </div>
  )
}
