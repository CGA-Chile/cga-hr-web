/**
 * The pending-writes queue, persisted in IndexedDB so that an edit made without signal survives
 * a reload. This is the only thing the app keeps on the device: there is no local replica of
 * the database.
 */

export type PendingOperation = {
  opId: string;
  date: string;
  employeeId: string;
  positionId: string | null;
  note: string | null;
  queuedAt: number;
};

const DATABASE = "cga-pending-writes";
const STORE = "operations";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "opId" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function transact<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await open();
  return new Promise((resolve, reject) => {
    const request = work(database.transaction(STORE, mode).objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export function saveOperation(operation: PendingOperation): Promise<IDBValidKey> {
  return transact("readwrite", (store) => store.put(operation));
}

export function removeOperation(opId: string): Promise<undefined> {
  return transact("readwrite", (store) => store.delete(opId));
}

/** Oldest first, so replaying them keeps the order the edits were made in. */
export async function listOperations(): Promise<PendingOperation[]> {
  const operations = await transact<PendingOperation[]>("readonly", (store) => store.getAll());
  return operations.sort((a, b) => a.queuedAt - b.queuedAt);
}
