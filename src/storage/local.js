const PREFIX = "novelbite.v1";

export const storageKeys = Object.freeze({
  mode: `${PREFIX}.mode`,
  ledger: `${PREFIX}.ledger`,
  schedule: `${PREFIX}.schedule`,
  preferences: `${PREFIX}.preferences`
});

export function readJson(storage, key, fallback) {
  try {
    const value = storage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function writeJson(storage, key, value) {
  storage.setItem(key, JSON.stringify(value));
  return value;
}

export function clearNovelBiteData(storage) {
  Object.values(storageKeys).forEach((key) => storage.removeItem(key));
}

export function createMemoryStorage(seed = {}) {
  const entries = new Map(Object.entries(seed));
  return {
    getItem(key) {
      return entries.has(key) ? entries.get(key) : null;
    },
    setItem(key, value) {
      entries.set(key, String(value));
    },
    removeItem(key) {
      entries.delete(key);
    },
    clear() {
      entries.clear();
    }
  };
}
