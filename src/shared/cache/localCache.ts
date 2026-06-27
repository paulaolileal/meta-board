import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "metaboard";
const STORE = "kv";
let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb() {
  if (typeof indexedDB === "undefined") return null;
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      },
    });
  }
  return dbPromise;
}

export async function cacheGet<T>(key: string): Promise<T | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  return (await db.get(STORE, key)) as T | undefined;
}

export async function cacheSet<T>(key: string, value: T): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.put(STORE, value, key);
}

export async function cacheDel(key: string): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.delete(STORE, key);
}
