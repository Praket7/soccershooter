import { createFreshProfile, migrateProfile, type PlayerProfile } from './profile';

export interface ProfileStore {
  load(): Promise<PlayerProfile | null>;
  save(profile: Readonly<PlayerProfile>): Promise<void>;
}

export class LocalStorageProfileStore implements ProfileStore {
  constructor(private readonly storage: Storage, private readonly key = 'soccershooter.profile.v2') {}
  async load(): Promise<PlayerProfile | null> {
    const value = this.storage.getItem(this.key);
    return value === null ? null : migrateProfile(JSON.parse(value) as unknown);
  }
  async save(profile: Readonly<PlayerProfile>): Promise<void> {
    this.storage.setItem(this.key, JSON.stringify(migrateProfile(profile)));
  }
}

export class IndexedDbProfileStore implements ProfileStore {
  constructor(private readonly databaseName = 'soccershooter-local', private readonly storeName = 'profiles') {}
  async load(): Promise<PlayerProfile | null> {
    const db = await this.#open();
    return new Promise((resolve, reject) => {
      const request = db.transaction(this.storeName, 'readonly').objectStore(this.storeName).get('current');
      request.onsuccess = () => resolve(request.result ? migrateProfile(request.result) : null);
      request.onerror = () => reject(request.error ?? new Error('profile load failed'));
    });
  }
  async save(profile: Readonly<PlayerProfile>): Promise<void> {
    const db = await this.#open();
    await new Promise<void>((resolve, reject) => {
      const request = db.transaction(this.storeName, 'readwrite').objectStore(this.storeName).put(migrateProfile(profile), 'current');
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error('profile save failed'));
    });
  }
  async #open(): Promise<IDBDatabase> {
    if (typeof indexedDB === 'undefined') throw new Error('IndexedDB is unavailable');
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.databaseName, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(this.storeName);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error ?? new Error('profile database open failed'));
    });
  }
}

export async function loadOrCreateProfile(store: ProfileStore): Promise<PlayerProfile> {
  return await store.load() ?? createFreshProfile();
}
