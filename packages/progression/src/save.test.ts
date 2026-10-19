import { describe, expect, it } from 'vitest';
import { createFreshProfile } from './profile';
import { LocalStorageProfileStore, loadOrCreateProfile } from './save';

class MemoryStorage {
  #values = new Map<string, string>();
  getItem(key: string): string | null { return this.#values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.#values.set(key, value); }
  removeItem(key: string): void { this.#values.delete(key); }
  clear(): void { this.#values.clear(); }
}

describe('versioned local progression persistence', () => {
  it('creates, saves, reloads, and migrates the local profile through the storage adapter', async () => {
    const storage = new MemoryStorage() as unknown as Storage;
    const store = new LocalStorageProfileStore(storage, 'profile-test');
    const fresh = await loadOrCreateProfile(store);
    expect(fresh.presentationOvr).toBe(67);
    await store.save(fresh);
    expect(await store.load()).toEqual(fresh);
  });
});
