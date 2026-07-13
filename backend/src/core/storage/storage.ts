/**
 * Object storage behind ONE interface (docs/14 §4) — the KentConnector
 * discipline applied to files: code talks to StorageAdapter; the provider is
 * an environment concern. Local disk in dev; the SeaweedFS S3 adapter swaps
 * in with zero call-site changes once the server exists (external, P0-class).
 * The database stores object KEYS (core.documents.path); bytes live here.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

export interface StorageAdapter {
  put(key: string, content: Buffer | string): Promise<void>;
  get(key: string): Promise<Buffer>;
}

/** Dev/staging stand-in: keys map to files under a root directory. */
class LocalDiskStorage implements StorageAdapter {
  constructor(private readonly root: string) {}

  private resolve(key: string): string {
    const full = path.resolve(this.root, key);
    // A key like '../../etc/x' must never escape the storage root.
    if (!full.startsWith(path.resolve(this.root) + path.sep)) {
      throw new Error(`Storage key escapes the root: ${key}`);
    }
    return full;
  }

  async put(key: string, content: Buffer | string): Promise<void> {
    const full = this.resolve(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, content);
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.resolve(key));
  }
}

let instance: StorageAdapter | null = null;

/** The ONE place a real S3/SeaweedFS adapter replaces local disk. */
export function getStorage(): StorageAdapter {
  instance ??= new LocalDiskStorage(process.env['STORAGE_DIR'] ?? path.join(process.cwd(), 'var', 'storage'));
  return instance;
}
