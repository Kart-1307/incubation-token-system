// High-Speed Server In-Memory Cache with TTL & Tag Invalidation

interface CacheItem<T> {
  data: T;
  expiresAt: number;
}

class FastCache {
  private store = new Map<string, CacheItem<any>>();
  private tagMap = new Map<string, Set<string>>();

  /**
   * Fetch data from cache, or execute fetcher and cache result
   * @param key Unique cache key
   * @param ttlSeconds Time to live in seconds
   * @param fetcher Async function to retrieve data if cache miss
   * @param tags Array of tags for grouped invalidation
   */
  async get<T>(
    key: string,
    ttlSeconds: number,
    fetcher: () => Promise<T>,
    tags: string[] = []
  ): Promise<T> {
    const now = Date.now();
    const item = this.store.get(key);

    if (item && item.expiresAt > now) {
      return item.data;
    }

    // Cache miss or expired: fetch fresh data
    const data = await fetcher();
    this.store.set(key, {
      data,
      expiresAt: now + ttlSeconds * 1000,
    });

    // Register tags
    for (const tag of tags) {
      if (!this.tagMap.has(tag)) {
        this.tagMap.set(tag, new Set());
      }
      this.tagMap.get(tag)!.add(key);
    }

    return data;
  }

  /**
   * Invalidate specific cache keys or all keys associated with tags
   */
  invalidateTags(tags: string[]) {
    for (const tag of tags) {
      const keys = this.tagMap.get(tag);
      if (keys) {
        for (const key of keys) {
          this.store.delete(key);
        }
        this.tagMap.delete(tag);
      }
    }
  }

  /**
   * Directly delete a specific cache key or all keys matching a prefix
   */
  invalidateKey(keyOrPrefix: string) {
    for (const k of Array.from(this.store.keys())) {
      if (k === keyOrPrefix || k.startsWith(keyOrPrefix)) {
        this.store.delete(k);
      }
    }
  }

  /**
   * Clear entire cache
   */
  clear() {
    this.store.clear();
    this.tagMap.clear();
  }
}

// Global cache instance across Next.js reloads
const globalCache = globalThis as unknown as { _appCache?: FastCache };
if (!globalCache._appCache) {
  globalCache._appCache = new FastCache();
}

export const appCache = globalCache._appCache;
