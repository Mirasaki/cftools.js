import crypto from 'crypto';
import { Keyv } from 'keyv';
import { LRUCache } from 'lru-cache';
import { createCache } from 'cache-manager';

const keyv = new Keyv({ store: new LRUCache({ max: 500 }) });
const cache = createCache({ stores: [keyv] });

export class CacheManager {
  private static instance: CacheManager;
  private static cache: ReturnType<typeof createCache> = cache;
  private static keyv: Keyv = keyv;
  
  private keysSet: Set<string> = new Set();

  // eslint-disable-next-line @typescript-eslint/no-empty-function
  private constructor() {}

  public static hashKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex');
  }

  public static hashKeyFromObject(obj: unknown): string {
    if (typeof obj === 'string') {
      return CacheManager.hashKey(obj);
    }

    return CacheManager.hashKey(JSON.stringify(obj));
  }

  public static getInstance(): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager();
    }
    return CacheManager.instance;
  }

  private static deserializationHelper(_key: string, value: unknown) {
    if ( typeof value === 'string' ) {
      const regexp = /^\d\d\d\d-\d\d-\d\dT\d\d:\d\d:\d\d.\d\d\dZ$/.exec(value);
      if ( regexp ) {
        return new Date(value);
      }
    }
    return value;
  }
  
  public async get<T>(key: string): Promise<T | null> {
    const value = await CacheManager.cache.get<string>(key);

    if (value === null) {
      return null;
    }

    return JSON.parse(value, CacheManager.deserializationHelper) as T;
  }

  public async set<T>(key: string, value: T, ttl: number): Promise<void> {
    await CacheManager.cache.set(key, JSON.stringify(value), ttl);
    this.keysSet.add(key);
  }

  public async del(key: string): Promise<boolean> {
    const result = await CacheManager.cache.del(key);
    this.keysSet.delete(key);
    return result;
  }

  public async clear(): Promise<boolean> {
    const result = await CacheManager.cache.clear();
    this.keysSet.clear();
    return result;
  }

  public async keys(): Promise<string[]> {
    return Array.from(this.keysSet);
  }

  public async has(key: string): Promise<boolean> {
    return this.keysSet.has(key);
  }

  public async size(): Promise<number> {
    return this.keysSet.size;
  }

  /**
   * Sets/categories should be tracked by using prefixes (e.g. `'categoryName:categoryKey'`)
   * This method returns all keys that match the given prefix.
   */
  public async keysForPrefix(prefix: string): Promise<string[]> {
    return Array.from(this.keysSet).filter((key) => key.startsWith(prefix));
  }

  /**
   * Enforces a maximum size for a set/category of keys by deleting the oldest keys if the size exceeds the maximum.
   * The keys should be tracked by using prefixes (e.g. `'categoryName:categoryKey'`)
   * @param prefix The prefix to use for filtering keys
   * @param maxSize The maximum size to enforce
   * @returns Promise<void>
   */
  public async enforceMaxSizeForPrefix(prefix: string, maxSize: number): Promise<void> {
    const keys = await this.keysForPrefix(prefix);
    if (keys.length > maxSize) {
      const keysToDelete = keys.slice(0, keys.length - maxSize);
      await Promise.all(keysToDelete.map((key) => this.del(key)));
    }
  }

  /**
   * Clears all entries that match the given prefix
   * @param prefix The prefix to use for filtering keys
   */
  public async clearPrefixEntries(prefix: string): Promise<void> {
    const keys = await this.keysForPrefix(prefix);
    await Promise.all(keys.map((key) => this.del(key)));
  }
}
