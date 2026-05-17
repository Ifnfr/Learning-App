import { useState, useEffect } from 'react'
import { isAuthenticated, verify, login, logout, AUTH_EXPIRED_EVENT } from '../lib/authClient'

export default function LoginGate({ children }) {
  const [authenticated, setAuthenticated] = useState(false)
  const [checking, setChecking] = useState(true)
  const [passphrase, setPassphrase] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    checkAuth()
  }, [])

  // Listen for auth-expired events (fired on 401 mid-session)
  useEffect(() => {
    function handleExpired() {
      setAuthenticated(false)
      setPassphrase('')
    }
    window.addEventListener(AUTH_EXPIRED_EVENT, handleExpired)
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, handleExpired)
  }, [])

  async function checkAuth() {
    setChecking(true)
    if (isAuthenticated()) {
      const valid = await verify()
      if (valid) {
        setAuthenticated(true)
        setChecking(false)
        return
      }
    }
    setAuthenticated(false)
    setChecking(false)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!passphrase.trim()) return
    setLoading(true)
    setError('')
    try {
      await login(passphrase)
      setAuthenticated(true)
    } catch (err) {
      setError(err.message || 'Login gagal')
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div
        className="fixed inset-0 flex items-center justify-center"
        style={{ background: 'var(--bg)' }}
      >
        <div
          className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--gold)', borderTopColor: 'transparent' }}
        />
      </div>
    )
  }

  if (authenticated) {
    return children
  }

  return (
    <div
      className="fixed inset-0 flex items-center justify-center px-6"
      style={{ background: 'var(--bg)' }}
    >
      <div
        className="w-full max-w-sm rounded-xl p-8"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
        }}
      >
        <h1
          className="text-2xl font-bold text-center mb-2"
          style={{ color: 'var(--gold)', fontFamily: 'var(--font-display)' }}
        >
          SIMAK Study OS
        </h1>
        <p
          className="text-sm text-center mb-6"
          style={{ color: 'var(--text-muted)' }}
        >
          Masukkan passphrase untuk mengakses SIMAK Study OS
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="password"
            value={passphrase}
            onChange={(e) => {
              setPassphrase(e.target.value)
              if (error) setError('')
            }}
            placeholder="Passphrase"
            autoFocus
            className="w-full px-4 py-3 rounded-lg text-sm outline-none"
            style={{
              background: 'var(--bg-elevated)',
              border: `1px solid ${error ? 'var(--rust)' : 'var(--border)'}`,
              color: 'var(--text)',
            }}
          />

          {error && (
            <p className="text-xs" style={{ color: 'var(--rust)', margin: 0 }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !passphrase.trim()}
            className="w-full py-3 rounded-lg font-semibold text-sm cursor-pointer transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: 'var(--gold)',
              color: 'var(--bg)',
              border: 'none',
            }}
          >
            {loading ? 'Memverifikasi...' : 'Masuk'}
          </button>
        </form>
      </div>
    </div>
  )
}
