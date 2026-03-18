interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class MemoryCache {
  private cache = new Map<string, CacheEntry<any>>();

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlMs: number): void {
    this.cache.set(key, { data, timestamp: Date.now(), ttl: ttlMs });
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  stats(): { size: number; keys: string[] } {
    // Clean expired entries first
    for (const [key, entry] of this.cache) {
      if (Date.now() - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
    return { size: this.cache.size, keys: Array.from(this.cache.keys()) };
  }
}

export const memoryCache = new MemoryCache();
