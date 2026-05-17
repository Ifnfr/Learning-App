/**
 * Storage utilities - localStorage + IndexedDB wrapper
 * Provides persistent storage for study data, progress, and cached content.
 */

const DB_NAME = 'simak-study-os'
const DB_VERSION = 1

// --- localStorage helpers ---

export function saveToLocalStorage(key, value) {
  try {
    const serialized = JSON.stringify(value)
    localStorage.setItem(key, serialized)
    return true
  } catch (err) {
    console.error('[storage] Failed to save to localStorage:', err)
    return false
  }
}

export function loadFromLocalStorage(key, fallback = null) {
  try {
    const item = localStorage.getItem(key)
    if (item === null) return fallback
    return JSON.parse(item)
  } catch (err) {
    console.error('[storage] Failed to load from localStorage:', err)
    return fallback
  }
}

// --- IndexedDB helpers ---

export function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = event.target.result
      if (!db.objectStoreNames.contains('cards')) {
        db.createObjectStore('cards', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('sessions')) {
        db.createObjectStore('sessions', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('seeds')) {
        db.createObjectStore('seeds', { keyPath: 'id' })
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function saveToIDB(storeName, data) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)
    store.put(data)
    tx.oncomplete = () => resolve(true)
    tx.onerror = () => reject(tx.error)
  })
}

export async function loadFromIDB(storeName, id) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const request = store.get(id)
    request.onsuccess = () => resolve(request.result || null)
    request.onerror = () => reject(request.error)
  })
}

export async function deleteFromIDB(storeName, id) {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)
    store.delete(id)
    tx.oncomplete = () => resolve(true)
    tx.onerror = () => reject(tx.error)
  })
}
