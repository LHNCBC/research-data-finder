/**
 * A class that encapsulates interaction with the query response cache.
 */
class QueryResponseCache {
  // Temporary cache that will disappear when the page is reloaded.
  temporaryCache = {};

  // Temporary cache for requests that should be cached in persistent cache, in
  // case the persistent cache is not available.
  fakeWindowCaches = {};

  // Whether "window.caches" is supported.
  isCachesSupported = !!globalThis.caches;

  /**
   * Stores the response data for a URL in the persistent or temporary cache.
   * @param {string} key - some key, for a GET request it can be just a full URL
   * @param {{data: any, status: number}} responseData - response data
   * @param {Object} [options] - additional options:
   * @param {string} [options.cacheName] - cache name for persistent data storage
   *   between sessions, if not specified, saves response data in the temporary
   *   cache that will disappear when the page is reloaded.
   * @param {number} [options.expirationTime] - the number of seconds the new
   *   entry can be in the cache before expiring.
   * @returns Promise<void>
   */
  add(key, responseData, options) {
    responseData = {
      ...responseData,
      _cacheInfo_: {
        timestamp: +new Date(),
        expirationTime: options.expirationTime
      }
    };
    if (options.cacheName) {
      if (this.isCachesSupported) {
        return caches.open(options.cacheName).then((c) => c.put(key, new Response(JSON.stringify(responseData))));
      } else {
        const cache = (this.fakeWindowCaches[options.cacheName] = this.fakeWindowCaches[options.cacheName] || {});
        cache[key] = responseData;
        return Promise.resolve();
      }
    } else {
      this.temporaryCache[key] = responseData;
      return Promise.resolve();
    }
  }

  /**
   * Returns the cached response data for the URL.
   * @param {string} key - some key, for a GET request it can be just a full URL
   * @param {Object} [options] - additional options:
   * @param {string} [options.cacheName] - cache name for persistent data storage
   *   between sessions, if not specified, gets response data from the temporary
   *   cache that will disappear when the page is reloaded.
   * @returns {Promise<{data: any, status: number}|undefined>}
   */
  get(key, options) {
    let tempCachePromise;
    if (options.cacheName) {
      if (this.isCachesSupported) {
        return caches.open(options.cacheName).then((cache) => {
          return cache
            .match(key)
            .then((response) => response?.json())
            .then((responseData) => {
              return QueryResponseCache.isExpired(responseData)
                ? cache.delete(key).then(() => undefined)
                : responseData;
            });
        });
      }
      tempCachePromise = Promise.resolve(this.fakeWindowCaches[options.cacheName]?.[key]);
    } else {
      tempCachePromise = Promise.resolve(this.temporaryCache[key]);
    }
    return tempCachePromise.then((responseData) => {
      if (QueryResponseCache.isExpired(responseData)) {
        if (options.cacheName) {
          delete this.fakeWindowCaches[options.cacheName][key];
        } else {
          delete this.temporaryCache[key];
        }
        return undefined;
      }
      return responseData;
    });
  }

  /**
   * Whether cached response data exists for the URL and has not expired.
   * @param {string} key - some key, for a GET request it can be just a full URL
   * @param {string} [cacheName] - cache name for persistent data storage
   *   between sessions, if not specified, gets response data from the temporary
   *   cache that will disappear when the page is reloaded.
   * @returns {Promise<boolean>}
   */
  hasNotExpiredData(key, cacheName) {
    return (cacheName
      ? this.isCachesSupported
        ? caches.open(cacheName).then((cache) => cache.match(key).then((response) => response?.json()))
        : Promise.resolve(this.fakeWindowCaches[cacheName]?.[key])
      : Promise.resolve(this.temporaryCache[key])
    ).then((responseData) => {
      return !!responseData && !QueryResponseCache.isExpired(responseData);
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
      responseData?._cacheInfo_.expirationTime * 1000 < +new Date() - responseData?._cacheInfo_.timestamp
    );
  }

  /**
   * Clears persistent cache data by cache name.
   * @param {string} cacheName - cache name for persistent data storage between
   *   sessions.
   * @returns {Promise<boolean>} - a Promise that resolves to true if the Cache
   *   object is found and deleted, and false otherwise.
   */
  clearByCacheName(cacheName) {
    if (this.isCachesSupported) {
      return caches.delete(cacheName);
    }
    const isExist = !!this.fakeWindowCaches[cacheName];
    if (isExist) {
      delete this.fakeWindowCaches[cacheName];
    }
    return Promise.resolve(isExist);
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
    return (this.isCachesSupported
      ? caches.keys()
      : Promise.resolve(Object.keys(this.fakeWindowCaches))
    ).then((cacheNames) => Promise.all(cacheNames.map((cacheName) => this.clearByCacheName(cacheName))));
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

module.exports = new QueryResponseCache();
