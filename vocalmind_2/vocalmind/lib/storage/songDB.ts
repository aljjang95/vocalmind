import type { SongAnalysis, SessionScore } from '@/types';

const DB_NAME = 'vocalmind-songs';
const DB_VERSION = 2;
const STORE_AUDIO = 'audioBlobs';
const STORE_ANALYSIS = 'analysisData';
const STORE_SESSIONS = 'sessions';
const STORE_PROFILE = 'userProfile';

export function openDB(): Promise<IDBDatabase> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('IndexedDB is not available on the server'));
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = request.result;
      const oldVersion = event.oldVersion;

      // v0 -> v1: audioBlobs store
      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains(STORE_AUDIO)) {
          db.createObjectStore(STORE_AUDIO);
        }
      }

      // v1 -> v2: analysisData, sessions, userProfile stores
      if (oldVersion < 2) {
        if (!db.objectStoreNames.contains(STORE_ANALYSIS)) {
          db.createObjectStore(STORE_ANALYSIS);
        }
        if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
          const sessionsStore = db.createObjectStore(STORE_SESSIONS, { keyPath: 'id' });
          sessionsStore.createIndex('songId', 'songId', { unique: false });
        }
        if (!db.objectStoreNames.contains(STORE_PROFILE)) {
          db.createObjectStore(STORE_PROFILE);
        }
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ── audioBlobs (기존) ──

export async function saveBlob(key: string, blob: Blob): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_AUDIO, 'readwrite');
    const store = tx.objectStore(STORE_AUDIO);
    const request = store.put(blob, key);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

export async function getBlob(key: string): Promise<Blob | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_AUDIO, 'readonly');
    const store = tx.objectStore(STORE_AUDIO);
    const request = store.get(key);

    request.onsuccess = () => resolve(request.result ?? undefined);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

export async function deleteBlob(key: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_AUDIO, 'readwrite');
    const store = tx.objectStore(STORE_AUDIO);
    const request = store.delete(key);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

export async function clearAll(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_AUDIO, 'readwrite');
    const store = tx.objectStore(STORE_AUDIO);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

// ── analysisData (v2) ──

export async function saveAnalysis(songId: string, analysis: SongAnalysis): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ANALYSIS, 'readwrite');
    const store = tx.objectStore(STORE_ANALYSIS);
    const request = store.put(analysis, songId);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

export async function getAnalysis(songId: string): Promise<SongAnalysis | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_ANALYSIS, 'readonly');
    const store = tx.objectStore(STORE_ANALYSIS);
    const request = store.get(songId);

    request.onsuccess = () => resolve(request.result ?? undefined);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

// ── sessions (v2) ──

export async function saveSession(session: SessionScore): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SESSIONS, 'readwrite');
    const store = tx.objectStore(STORE_SESSIONS);
    const request = store.put(session);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

export async function getSessions(songId: string): Promise<SessionScore[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_SESSIONS, 'readonly');
    const store = tx.objectStore(STORE_SESSIONS);
    const index = store.index('songId');
    const request = index.getAll(songId);

    request.onsuccess = () => resolve(request.result ?? []);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

// ── userProfile (v2) ──

export async function saveUserProfile(key: string, data: unknown): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PROFILE, 'readwrite');
    const store = tx.objectStore(STORE_PROFILE);
    const request = store.put(data, key);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

export async function getUserProfile(key: string): Promise<unknown | undefined> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_PROFILE, 'readonly');
    const store = tx.objectStore(STORE_PROFILE);
    const request = store.get(key);

    request.onsuccess = () => resolve(request.result ?? undefined);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}
