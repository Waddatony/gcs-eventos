// Persistencia local: guarda el archivo SQLite completo en IndexedDB del navegador.
// Así los datos sobreviven a recargas y cierres del navegador.

const DB_NAME = 'gcs-eventos';
const STORE = 'archivos';
const KEY = 'gcs.sqlite';

function abrir() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function operar(modo, fn) {
  const idb = await abrir();
  return new Promise((resolve, reject) => {
    const tx = idb.transaction(STORE, modo);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => { idb.close(); resolve(req?.result); };
    tx.onerror = () => { idb.close(); reject(tx.error); };
  });
}

export const cargarBytes = () => operar('readonly', s => s.get(KEY)).then(v => v ?? null);
export const guardarBytes = bytes => operar('readwrite', s => s.put(bytes, KEY));
export const borrarBytes = () => operar('readwrite', s => s.delete(KEY));
