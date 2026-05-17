/**
 * Sync utility for SIMAK Study OS.
 * Provides functions to sync data between frontend and backend API.
 * All functions are wrapped in try/catch and return null on failure (offline-first).
 */

import { getToken, handleAuthExpired } from './authClient'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001'

function getAuthHeaders() {
  const token = getToken()
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  }
}

function isOnline() {
  return navigator.onLine
}

async function request(method, path, body = null) {
  if (!isOnline()) return null
  const opts = { method, headers: getAuthHeaders() }
  if (body) opts.body = JSON.stringify(body)
  const res = await fetch(`${BACKEND_URL}${path}`, opts)
  if (res.status === 401) { handleAuthExpired(); return null }
  if (!res.ok) return null
  return await res.json()
}

// ─── State ────────────────────────────────────────────────────────────────────

export async function fetchState() {
  try {
    return await request('GET', '/api/state')
  } catch { return null }
}

export async function pushState(stateSubset) {
  try {
    return await request('PUT', '/api/state', stateSubset)
  } catch { return null }
}

// ─── Seeds ────────────────────────────────────────────────────────────────────

export async function fetchSeeds(filters = {}) {
  try {
    const params = new URLSearchParams()
    params.set('limit', '1000')
    if (filters.page) params.set('page', filters.page)
    if (filters.subject) params.set('subject', filters.subject)
    if (filters.topic) params.set('topic', filters.topic)
    const result = await request('GET', `/api/seeds?${params.toString()}`)
    return result ? result.data : null
  } catch { return null }
}

export async function createSeed(seed) {
  try {
    return await request('POST', '/api/seeds', seed)
  } catch { return null }
}

export async function updateSeed(id, data) {
  try {
    return await request('PUT', `/api/seeds/${id}`, data)
  } catch { return null }
}

export async function deleteSeed(id) {
  try {
    return await request('DELETE', `/api/seeds/${id}`)
  } catch { return null }
}

// ─── Variations ───────────────────────────────────────────────────────────────

export async function fetchVariations(parentSeedId) {
  try {
    const params = new URLSearchParams()
    if (parentSeedId) params.set('parent_seed_id', parentSeedId)
    const path = params.toString() ? `/api/variations?${params.toString()}` : '/api/variations'
    const result = await request('GET', path)
    return result ? result.data : null
  } catch { return null }
}

export async function createVariation(variation) {
  try {
    return await request('POST', '/api/variations', variation)
  } catch { return null }
}

export async function deleteVariation(id) {
  try {
    return await request('DELETE', `/api/variations/${id}`)
  } catch { return null }
}

// ─── Mistakes ─────────────────────────────────────────────────────────────────

export async function fetchMistakes(filters = {}) {
  try {
    const params = new URLSearchParams()
    params.set('limit', '1000')
    if (filters.page) params.set('page', filters.page)
    if (filters.subject) params.set('subject', filters.subject)
    if (filters.mastered !== undefined) params.set('mastered', filters.mastered)
    const result = await request('GET', `/api/mistakes?${params.toString()}`)
    return result ? result.data : null
  } catch { return null }
}

export async function createMistake(mistake) {
  try {
    return await request('POST', '/api/mistakes', mistake)
  } catch { return null }
}

export async function updateMistake(id, data) {
  try {
    return await request('PUT', `/api/mistakes/${id}`, data)
  } catch { return null }
}

export async function deleteMistake(id) {
  try {
    return await request('DELETE', `/api/mistakes/${id}`)
  } catch { return null }
}

// ─── Drills ───────────────────────────────────────────────────────────────────

export async function fetchDrills(page = 1) {
  try {
    const result = await request('GET', `/api/drills?page=${page}`)
    return result ? result.data : null
  } catch { return null }
}

export async function logDrill(session) {
  try {
    return await request('POST', '/api/drills', session)
  } catch { return null }
}

// ─── Mocks ────────────────────────────────────────────────────────────────────

export async function fetchMocks(page = 1) {
  try {
    const result = await request('GET', `/api/mocks?page=${page}`)
    return result ? result.data : null
  } catch { return null }
}

export async function logMock(session) {
  try {
    return await request('POST', '/api/mocks', session)
  } catch { return null }
}

// ─── Spaced Repetition ────────────────────────────────────────────────────────

export async function fetchSRItems() {
  try {
    const result = await request('GET', '/api/sr')
    return result ? result.data : null
  } catch { return null }
}

export async function createSRItem(item) {
  try {
    return await request('POST', '/api/sr', item)
  } catch { return null }
}

export async function updateSRItem(id, data) {
  try {
    return await request('PUT', `/api/sr/${id}`, data)
  } catch { return null }
}

export async function deleteSRItem(id) {
  try {
    return await request('DELETE', `/api/sr/${id}`)
  } catch { return null }
}

// ─── Export / Import ──────────────────────────────────────────────────────────

export async function exportAll() {
  try {
    return await request('GET', '/api/export')
  } catch { return null }
}

export async function importAll(data) {
  try {
    return await request('POST', '/api/import', data)
  } catch { return null }
}
