/**
 * A class that encapsulates interaction with the request cache.
 */
export class Cache {
  // Temporary cache that will disappear when the page is reloaded
  static temporaryCache = {};

  /**
   * Stores the response data for a URL in the persistent or temporary cache.
   * @param {string} url - URL
   * @param {{data: any, status: number}} responseData - response data
   * @param {Object} [options] - additional options:
   * @param {string} [options.cacheName] - cache name for persistent data storage
   *   between sessions, if not specified, saves response data in the temporary
   *   cache that will disappear when the page is reloaded.
   * @param {number} [options.expirationTime] - expiration time for a cached
   *   response in seconds.
   * @returns Promise<void>
   */
  add(url, responseData, options) {
    responseData = {
      ...responseData,
      _cacheInfo_: {
        timestamp: +new Date(),
        expirationTime: options.expirationTime
      }
    };
    if (options.cacheName) {
      return caches
        .open(options.cacheName)
        .then((c) => c.put(url, new Response(JSON.stringify(responseData))));
    } else {
      Cache.temporaryCache[url] = responseData;
      return Promise.resolve();
    }
  }

  /**
   * Returns the cached response data for the URL.
   * @param {string} url - URL
   * @param {Object} [options] - additional options:
   * @param {string} [options.cacheName] - cache name for persistent data storage
   *   between sessions, if not specified, saves response data in the temporary
   *   cache that will disappear when the page is reloaded.
   * @returns {Promise<{data: any, status: number}|undefined>}
   */
  get(url, options) {
    return options.cacheName
      ? caches.open(options.cacheName).then((cache) => {
          return cache
            .match(url)
            .then((response) => response?.json())
            .then((responseData) => {
              return Cache.isExpired(responseData)
                ? cache.delete(url).then(() => undefined)
                : responseData;
            });
        })
      : Promise.resolve(Cache.temporaryCache[url]).then((responseData) => {
          return Cache.isExpired(responseData) ? undefined : responseData;
        });
  }

  /**
   * Returns true if cached data is expired
   * @param responseData - cached data response data
   * @returns {boolean}
   */
  static isExpired(responseData) {
    return (
      responseData?._cacheInfo_.expirationTime &&
      responseData?._cacheInfo_.expirationTime * 1000 <
        +new Date() - responseData?._cacheInfo_.timestamp
    );
  }

  /**
   * Clears persistent cache data by cache name.
   * @param {string} cacheName - cache name for persistent data storage between
   *   sessions.
   * @returns {Promise<boolean>}
   */
  clearByCacheName(cacheName) {
    return caches.delete(cacheName);
  }

  /**
   * Clears temporary cache data.
   */
  clearTemporaryCache() {
    Cache.temporaryCache = {};
  }

  /**
   * Clears all persistent cache data.
   * @returns {Promise<void>}
   */
  clearPersistentCache() {
    return caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames.map((cacheName) => this.clearByCacheName(cacheName))
        )
      );
  }

  /**
   * Clear all persistent and temporary cache data.
   * @returns {Promise<void>}
   */
  clearAll() {
    this.clearTemporaryCache();
    return this.clearPersistentCache();
  }
}
