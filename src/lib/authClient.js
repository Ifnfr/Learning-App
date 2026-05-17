// Auth client for SIMAK Study OS
// Manages JWT tokens and login state

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'
const TOKEN_KEY = 'simak_jwt'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function isAuthenticated() {
  return !!getToken()
}

export async function login(passphrase) {
  const res = await fetch(`${BACKEND_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ passphrase }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || 'Login gagal')
  }
  const { token } = await res.json()
  localStorage.setItem(TOKEN_KEY, token)
  return token
}

export async function verify() {
  const token = getToken()
  if (!token) return false
  try {
    const res = await fetch(`${BACKEND_URL}/api/auth/verify`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    return data.valid === true
  } catch {
    return false
  }
}

export function logout() {
  localStorage.removeItem(TOKEN_KEY)
}
