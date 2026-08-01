// ============================================================
// INNOVIO — Offline Store (IndexedDB + Sync Queue)
// Provides local caching and offline-first data access
// ============================================================

const DB_NAME = 'innovio-offline';
const DB_VERSION = 1;
const STORES = {
  documents: 'documents',
  clients: 'clients',
  catalog: 'catalog',
  syncQueue: 'syncQueue'
};

let db = null;

// ─── Open Database ────────────────────────────────────────
function openDB() {
  return new Promise((resolve, reject) => {
    if (db) return resolve(db);
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onupgradeneeded = (e) => {
      const database = e.target.result;
      // Documents store (keyed by id)
      if (!database.objectStoreNames.contains(STORES.documents)) {
        const docStore = database.createObjectStore(STORES.documents, { keyPath: 'id' });
        docStore.createIndex('updated_at', 'updated_at', { unique: false });
        docStore.createIndex('type', 'tipo', { unique: false });
      }
      // Clients store
      if (!database.objectStoreNames.contains(STORES.clients)) {
        const clientStore = database.createObjectStore(STORES.clients, { keyPath: 'id' });
        clientStore.createIndex('name', 'nombre', { unique: false });
      }
      // Catalog store (services, products, tasks)
      if (!database.objectStoreNames.contains(STORES.catalog)) {
        database.createObjectStore(STORES.catalog, { keyPath: 'key' });
      }
      // Sync queue for pending offline operations
      if (!database.objectStoreNames.contains(STORES.syncQueue)) {
        const syncStore = database.createObjectStore(STORES.syncQueue, { keyPath: 'id', autoIncrement: true });
        syncStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };

    request.onsuccess = (e) => {
      db = e.target.result;
      resolve(db);
    };
    request.onerror = () => reject(new Error('Failed to open IndexedDB'));
  });
}

// ─── Generic CRUD helpers ─────────────────────────────────
async function putItem(storeName, item) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getItem(storeName, key) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(storeName, 'readonly');
    const request = tx.objectStore(storeName).get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

async function getAllItems(storeName) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(storeName, 'readonly');
    const request = tx.objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

async function deleteItem(storeName, key) {
  const database = await openDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ─── Document Cache ───────────────────────────────────────
export async function cacheDocuments(docs) {
  for (const doc of docs) {
    await putItem(STORES.documents, { ...doc, _cachedAt: Date.now() });
  }
}

export async function getCachedDocuments() {
  return getAllItems(STORES.documents);
}

export async function getCachedDocument(id) {
  return getItem(STORES.documents, id);
}

// ─── Client Cache ─────────────────────────────────────────
export async function cacheClients(clients) {
  for (const client of clients) {
    await putItem(STORES.clients, { ...client, _cachedAt: Date.now() });
  }
}

export async function getCachedClients() {
  return getAllItems(STORES.clients);
}

// ─── Catalog Cache ────────────────────────────────────────
export async function cacheCatalog(key, data) {
  await putItem(STORES.catalog, { key, data, _cachedAt: Date.now() });
}

export async function getCachedCatalog(key) {
  const item = await getItem(STORES.catalog, key);
  return item ? item.data : null;
}

// ─── Sync Queue ───────────────────────────────────────────
export async function addToSyncQueue(operation) {
  await putItem(STORES.syncQueue, {
    ...operation,
    timestamp: Date.now(),
    status: 'pending'
  });
}

export async function getPendingSyncs() {
  const items = await getAllItems(STORES.syncQueue);
  return items.filter(i => i.status === 'pending');
}

export async function removeSyncItem(id) {
  await deleteItem(STORES.syncQueue, id);
}

export async function getSyncQueueCount() {
  const pending = await getPendingSyncs();
  return pending.length;
}

// ─── Online/Offline Detection ─────────────────────────────
let _onlineCallbacks = [];
let _offlineCallbacks = [];

export function onOnline(fn) { _onlineCallbacks.push(fn); }
export function onOffline(fn) { _offlineCallbacks.push(fn); }

export function isOnline() {
  return navigator.onLine;
}

// Setup listeners
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    _onlineCallbacks.forEach(fn => { try { fn(); } catch {} });
  });
  window.addEventListener('offline', () => {
    _offlineCallbacks.forEach(fn => { try { fn(); } catch {} });
  });
}

// ─── Sync Engine ──────────────────────────────────────────
export async function syncPendingOperations(supabase) {
  if (!isOnline()) return { synced: 0, failed: 0 };
  
  const pending = await getPendingSyncs();
  let synced = 0, failed = 0;

  for (const op of pending) {
    try {
      if (op.type === 'insert') {
        const { error } = await supabase.from(op.table).insert(op.data);
        if (!error) { await removeSyncItem(op.id); synced++; }
        else failed++;
      } else if (op.type === 'update') {
        const { error } = await supabase.from(op.table).update(op.data).eq('id', op.data.id);
        if (!error) { await removeSyncItem(op.id); synced++; }
        else failed++;
      }
    } catch {
      failed++;
    }
  }

  return { synced, failed };
}
