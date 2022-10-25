/**
 * A class that encapsulates interaction with the query response cache.
 */
class QueryResponseCache {
  // Temporary cache that will disappear when the page is reloaded.
  temporaryCache = {};

  /**
   * Stores the response data for a URL in the persistent or temporary cache.
   * @param {string} url - URL
   * @param {{data: any, status: number}} responseData - response data
   * @param {Object} [options] - additional options:
   * @param {string} [options.cacheName] - cache name for persistent data storage
   *   between sessions, if not specified, saves response data in the temporary
   *   cache that will disappear when the page is reloaded.
   * @param {number} [options.expirationTime] - the number of seconds the new
   *   entry can be in the cache before expiring.
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
      this.temporaryCache[url] = responseData;
      return Promise.resolve();
    }
  }

  /**
   * Returns the cached response data for the URL.
   * @param {string} url - URL
   * @param {Object} [options] - additional options:
   * @param {string} [options.cacheName] - cache name for persistent data storage
   *   between sessions, if not specified, gets response data from the temporary
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
              return QueryResponseCache.isExpired(responseData)
                ? cache.delete(url).then(() => undefined)
                : responseData;
            });
        })
      : Promise.resolve(this.temporaryCache[url]).then((responseData) => {
          return QueryResponseCache.isExpired(responseData)
            ? undefined
            : responseData;
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
    this.temporaryCache = {};
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

export default new QueryResponseCache();
