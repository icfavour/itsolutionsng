/**
 * Datastore abstraction.
 *
 * - On Netlify (deployed or `netlify dev`): uses **Netlify Blobs** (key/value
 *   storage built into Netlify — no external database required).
 * - Anywhere else (e.g. `node server.mjs` local demo): falls back to a simple
 *   file-based JSON store in ./.data — so the whole app runs with zero setup.
 *
 * Keys look like:  users:<id> · users:email:<email> · course:<id> · class:<id>
 *                  material:<id> · assessment:<id> · submission:<aId>:<sId>
 *                  file:<key> · message:<id> · meta:<name>
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const BLOBS_STORE_NAME = 'tsa-db';
const DATA_DIR = path.join(process.cwd(), '.data', 'db');

const fileFor = (key) => path.join(DATA_DIR, key.replace(/:/g, '__') + '.json');
const keyFromFile = (filename) => filename.slice(0, -5).replace(/__/g, ':');

class FileStore {
  async get(key) {
    try {
      return await fs.readFile(fileFor(key), 'utf8');
    } catch {
      return null;
    }
  }

  async set(key, value) {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(fileFor(key), value, 'utf8');
  }

  async delete(key) {
    try {
      await fs.unlink(fileFor(key));
    } catch { /* ignore */ }
  }

  async listKeys(prefix) {
    let entries;
    try {
      entries = await fs.readdir(DATA_DIR);
    } catch {
      return [];
    }
    return entries
      .filter((f) => f.endsWith('.json'))
      .map(keyFromFile)
      .filter((k) => k.startsWith(prefix))
      .sort();
  }
}

class BlobsStore {
  constructor(store) {
    this.store = store;
  }

  async get(key) {
    const value = await this.store.get(key);
    return value ?? null;
  }

  async set(key, value) {
    await this.store.set(key, value);
  }

  async delete(key) {
    await this.store.delete(key);
  }

  async listKeys(prefix) {
    const res = await this.store.list({ prefix });
    if (!res) return [];
    if (Array.isArray(res)) return res.filter((k) => typeof k === 'string');
    if (Array.isArray(res.blobs)) {
      return res.blobs.map((b) => (typeof b === 'string' ? b : b.key)).filter(Boolean);
    }
    return [];
  }
}

let implPromise = null;

function getImpl() {
  if (!implPromise) {
    implPromise = (async () => {
      try {
        const { getStore } = await import('@netlify/blobs');
        if (typeof getStore !== 'function') throw new Error('getStore unavailable');
        const store = await getStore(BLOBS_STORE_NAME);
        await store.get('meta:ping'); // probe — throws outside a Netlify context
        console.log('[db] using Netlify Blobs');
        return new BlobsStore(store);
      } catch {
        console.log('[db] using local file store (./.data)');
        return new FileStore();
      }
    })().catch(() => new FileStore());
  }
  return implPromise;
}

export const db = {
  async getJSON(key, fallback = null) {
    const impl = await getImpl();
    const raw = await impl.get(key);
    if (raw == null) return fallback;
    try {
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  },

  async setJSON(key, value) {
    const impl = await getImpl();
    await impl.set(key, JSON.stringify(value));
  },

  async delete(key) {
    const impl = await getImpl();
    await impl.delete(key);
  },

  async listKeys(prefix) {
    const impl = await getImpl();
    return impl.listKeys(prefix);
  },

  /** List all records whose key starts with `prefix`, parsed as JSON. */
  async listJSON(prefix) {
    const keys = await this.listKeys(prefix);
    const impl = await getImpl();
    const out = [];
    for (const key of keys) {
      const raw = await impl.get(key);
      if (raw == null) continue;
      try {
        out.push(JSON.parse(raw));
      } catch { /* skip corrupt */ }
    }
    return out;
  },
};
