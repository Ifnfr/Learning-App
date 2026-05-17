/**
 * Storage utilities - localStorage + IndexedDB v2 wrapper
 * Provides persistent storage for study data, progress, and cached content.
 */

const DB_NAME = 'simak_studyos';
const DB_VERSION = 2;

// --- localStorage helpers ---

export function saveToLocalStorage(key, value) {
  try {
    const serialized = JSON.stringify(value);
    localStorage.setItem(key, serialized);
    return true;
  } catch (err) {
    console.error('[storage] Failed to save to localStorage:', err);
    return false;
  }
}

export function loadFromLocalStorage(key, fallback = null) {
  try {
    const item = localStorage.getItem(key);
    if (item === null) return fallback;
    return JSON.parse(item);
  } catch (err) {
    console.error('[storage] Failed to load from localStorage:', err);
    return fallback;
  }
}

// --- IndexedDB helpers ---

export function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      const oldVersion = event.oldVersion;

      // Create v2.0 stores if upgrading from nothing or v1
      if (oldVersion < 2) {
        // mistakes store
        if (!db.objectStoreNames.contains('mistakes')) {
          const mistakesStore = db.createObjectStore('mistakes', { keyPath: 'id' });
          mistakesStore.createIndex('subject', 'subject');
          mistakesStore.createIndex('topic', 'topic');
          mistakesStore.createIndex('mastered', 'mastered');
          mistakesStore.createIndex('timestamp', 'timestamp');
        }

        // drillHistory store
        if (!db.objectStoreNames.contains('drillHistory')) {
          const drillStore = db.createObjectStore('drillHistory', { keyPath: 'id' });
          drillStore.createIndex('subject', 'subject');
          drillStore.createIndex('timestamp', 'timestamp');
        }

        // mockExamHistory store
        if (!db.objectStoreNames.contains('mockExamHistory')) {
          const mockStore = db.createObjectStore('mockExamHistory', { keyPath: 'id' });
          mockStore.createIndex('timestamp', 'timestamp');
        }

        // calibrationLog store
        if (!db.objectStoreNames.contains('calibrationLog')) {
          const calStore = db.createObjectStore('calibrationLog', { keyPath: 'id' });
          calStore.createIndex('timestamp', 'timestamp');
          calStore.createIndex('subject', 'subject');
        }

        // seedBank store (v2.1)
        if (!db.objectStoreNames.contains('seedBank')) {
          const seedStore = db.createObjectStore('seedBank', { keyPath: 'id' });
          seedStore.createIndex('subject', 'subject');
          seedStore.createIndex('topic', 'topic');
          seedStore.createIndex('difficulty', 'difficulty');
          seedStore.createIndex('date_posted', 'date_posted');
          seedStore.createIndex('verified', 'verified');
          seedStore.createIndex('flagCount', 'flagCount');
          seedStore.createIndex('subject_topic', ['subject', 'topic']);
        }

        // variations store (v2.1)
        if (!db.objectStoreNames.contains('variations')) {
          const varStore = db.createObjectStore('variations', { keyPath: 'id' });
          varStore.createIndex('parentSeedId', 'parentSeedId');
          varStore.createIndex('subject', 'subject');
          varStore.createIndex('topic', 'topic');
          varStore.createIndex('difficulty', 'difficulty');
          varStore.createIndex('variationStrategy', 'variationStrategy');
          varStore.createIndex('validatedBy', 'validatedBy');
          varStore.createIndex('flagCount', 'flagCount');
        }

        // seedFlags store (v2.1)
        if (!db.objectStoreNames.contains('seedFlags')) {
          const flagStore = db.createObjectStore('seedFlags', { keyPath: 'id' });
          flagStore.createIndex('questionId', 'questionId');
          flagStore.createIndex('reason', 'reason');
          flagStore.createIndex('timestamp', 'timestamp');
          flagStore.createIndex('resolved', 'resolved');
        }
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveToIDB(storeName, data) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.put(data);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadFromIDB(storeName, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function deleteFromIDB(storeName, id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    store.delete(id);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}

export async function queryByIndex(storeName, indexName, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const index = store.index(indexName);
    const request = index.getAll(value);
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}
