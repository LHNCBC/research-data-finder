import { updateUrlWithParam } from './utils';

let commonRequestCache = {}; // Map from url to result JSON

// The value of property status in the rejection object when request is aborted due to clearPendingRequests execution
export const HTTP_ABORT = 0;

// Javascript client for FHIR with the ability to automatically combine requests in a batch
export class FhirBatchQuery {
  /**
   * Requests are executed or combined depending on the parameters passed to this method.
   * @constructor
   * @param {string} serviceBaseUrl - FHIR REST API Service Base URL (https://www.hl7.org/fhir/http.html#root)
   * @param {number} maxRequestsPerBatch - the maximum number of requests that can be combined (1 - turn off combined requests)
   * @param {number} maxActiveRequests - the maximum number of requests that can be executed simultaneously
   * @param {number} batchTimeout - the time in milliseconds between requests that can be combined
   */
  constructor({
    serviceBaseUrl = '',
    maxRequestsPerBatch = 10,
    maxActiveRequests = 6,
    batchTimeout = 20
  }) {
    this._serviceBaseUrl = serviceBaseUrl;
    this._pending = [];
    this._batchTimeoutId = null;
    this._batchTimeout = batchTimeout;
    this._maxPerBatch = maxRequestsPerBatch;
    this._maxActiveReq = maxActiveRequests;
    this._activeReq = [];
    // Timeout between requests in milliseconds
    // (=0, if there is no timeout between requests):
    this._msBetweenRequests = 0;
  }

  getServiceBaseUrl() {
    return this._serviceBaseUrl;
  }

  static clearCache() {
    commonRequestCache = {};
  }

  /**
   * Gets the response content from a URL.
   * @param {string} url - the URL whose data is to be retrieved.
   * @return {Promise} resolves/rejects with Object {status, data}, where
   *                   status is HTTP status number,
   *                   data is Object constructed from a JSON response
   */
  get(url) {
    return new Promise((resolve, reject) => {
      this._pending.push({ url, resolve, reject });
      if (this._pending.length < this._maxPerBatch) {
        clearTimeout(this._batchTimeoutId);
        this._batchTimeoutId = setTimeout(
          () => this._postPending(),
          this._batchTimeout
        );
      } else {
        this._postPending();
      }
    });
  }

  /**
   * Returns timeout from the Retry-After response HTTP header.
   * See https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Retry-After for details
   * @param {XMLHttpRequest} xhr
   * @return {number} - timeout in milliseconds
   */
  static getRetryAfterTimeout(xhr) {
    const retryAfterHeader = xhr.getResponseHeader('Retry-After');
    let timeout;
    if (retryAfterHeader) {
      if (/^\d+$/.test(retryAfterHeader)) {
        timeout = parseInt(retryAfterHeader) * 1000;
      } else {
        timeout = new Date(retryAfterHeader) - Date.now();
        if (isNaN(timeout) || timeout < 0) {
          // Use default timeout if date is not valid
          timeout = 1000;
        }
      }
    }

    return timeout;
  }

  /**
   * Guesses timeout between rate-limited API requests. Currently works only for
   * dbGap and API with 1 second rate-limiting interval (hardcoded) because we
   * can't correctly guess the rate-limiting interval.
   * An API which does not return "x-ratelimit-limit" header or has a different
   * rate-limiting interval will be served by handling the HTTP-429 response.
   * @param {XMLHttpRequest} xhr
   * @return {number} - timeout in milliseconds,
   *         0 - if there is no timeout between requests.
   */
  guessMsBetweenRequests(xhr) {
    const xRateLimitHeader = xhr.getResponseHeader('x-ratelimit-limit');
    const dbGapRateLimitInterval = 1000;
    if (/^\d+$/.test(xRateLimitHeader)) {
      const limit = parseInt(xRateLimitHeader);
      // TODO: Adjust the maximum number of requests that can be combined in a batch
      // after adding the ability to view this new value by the user in the "tunable"
      // section? In this case, the percentage of data loading progress will practically
      // not be displayed:
      // this._maxPerBatch = Math.max(Math.ceil(this._pending.length / limit), 10)
      this._msBetweenRequests = dbGapRateLimitInterval / limit;
    } else {
      this._msBetweenRequests = 0;
    }
  }

  /**
   * Sends XMLHttpRequest
   * @private
   * @return {Promise}
   */
  _request({
    method = 'GET',
    url,
    body,
    contentType = 'application/fhir+json',
    logPrefix = ''
  }) {
    // Update last request time on request
    this._lastRequestTime = Date.now();
    return new Promise((resolve, reject) => {
      const oReq = new XMLHttpRequest(),
        startAjaxTime = new Date();

      oReq.onreadystatechange = () => {
        if (oReq.readyState === 4) {
          // Update last request time on respond
          this._lastRequestTime = Date.now();
          this.guessMsBetweenRequests(oReq);
          const currentRequestIndex = this._activeReq.indexOf(oReq);
          if (currentRequestIndex !== -1) {
            this._activeReq.splice(currentRequestIndex, 1);
          } else {
            // if aborted due to clearPendingRequests
            reject({ status: HTTP_ABORT, error: 'Abort' });
          }
          console.log(
            `${logPrefix ? logPrefix + ' ' : ''}AJAX call returned in ${
              new Date() - startAjaxTime
            }`
          );
          const status = oReq.status;

          if (this.isOK(status)) {
            resolve({ status, data: JSON.parse(oReq.responseText) });
          } else if (status === 429) {
            this._pending.unshift({
              method,
              url,
              body,
              contentType,
              logPrefix,
              resolve,
              reject
            });
            setTimeout(
              () => this._postPending(),
              FhirBatchQuery.getRetryAfterTimeout(oReq)
            );
            return;
          } else {
            let error;
            try {
              error = oReq.responseText ? JSON.parse(oReq.responseText) : {};
            } catch (e) {
              error = {};
            }
            reject({ status, error: this._getErrorDiagnostic(error) });
          }
          this._postPending();
        }
      };

      oReq.open(method, url);
      oReq.setRequestHeader('Content-Type', contentType);
      oReq.send(body);
      this._activeReq.push(oReq);
    });
  }

  /**
   * Returns an array of objects describing requests that can be performed with
   * a single API request.
   * @return {Array}
   */
  getNextRequestsToPerform() {
    let requests = [];

    if (this._pending.length) {
      if (this._pending[0].method === 'POST') {
        requests.push(this._pending.shift());
      } else {
        while (
          this._pending.length &&
          this._maxPerBatch > requests.length &&
          this._pending[0].method !== 'POST'
        ) {
          requests.push(this._pending.shift());
        }
      }
    }
    return requests;
  }
  /**
   * Sends pending requests as batch or single
   * @private
   */
  _postPending() {
    if (this._activeReq.length >= this._maxActiveReq) {
      return;
    }

    // Apply timeout between requests
    const pause = this._lastRequestTime
      ? this._msBetweenRequests - Date.now() + this._lastRequestTime
      : 0;
    if (pause > 0) {
      setTimeout(() => {
        this._postPending();
      }, pause);
      return;
    }

    const requests = this.getNextRequestsToPerform();

    if (requests.length > 1) {
      const body = JSON.stringify({
        resourceType: 'Bundle',
        type: 'batch',
        entry: requests.map(({ url }) => ({
          request: {
            method: 'GET',
            url: this.getRelativeUrl(url)
          }
        }))
      });

      this._request({
        method: 'POST',
        url: this._serviceBaseUrl,
        body,
        logPrefix: 'Batch'
      }).then(
        ({ data }) => {
          requests.forEach(({ resolve, reject }, index) => {
            // See Batch/Transaction response description here:
            // https://www.hl7.org/fhir/http.html#transaction-response
            const entry = data.entry[index];
            const status = parseInt(entry.response.status);
            if (this.isOK(status)) {
              resolve({ status, data: entry.resource || {} });
            } else {
              reject({
                status,
                error: this._getErrorDiagnostic(entry.response.outcome)
              });
            }
          });
        },
        ({ status, error }) => {
          requests.forEach(({ reject }) => {
            reject({ status, error: error });
          });
        }
      );
    } else if (requests.length) {
      const { resolve, reject, ...options } = requests[0];
      this._request(options).then(resolve, reject);
    }
  }

  /**
   * Returns text with FHIR response issue diagnostics
   * @param {Object} data
   * @return {string}
   */
  _getErrorDiagnostic(data) {
    if (data && data.issue && data.issue.length) {
      return data.issue.map((item) => item.diagnostics).join('\n') || '';
    }

    return 'Unknown Error';
  }

  clearPendingRequests() {
    this._pending.length = 0;
    this._activeReq.forEach((request) => {
      request.abort();
    });
    this._activeReq = [];
  }

  getFullUrl(url) {
    return /^http[s]{0,1}:\/\//.test(url)
      ? url
      : `${this._serviceBaseUrl}/${url}`;
  }

  getRelativeUrl(url) {
    return url.indexOf(this._serviceBaseUrl) === 0
      ? url.substr(this._serviceBaseUrl.length + 1)
      : url;
  }

  /**
   * Checks the HTTP response status is OK
   * @param status
   * @return {boolean}
   */
  isOK(status) {
    return status >= 200 && status < 300;
  }

  /**
   * Like "get", but uses a cache if the URL has been requested before.
   * @param {string} url - the URL whose data is to be retrieved.
   * @return {Promise} resolves/rejects with Object {status, data}, where
   *                   status is HTTP status number,
   *                   data is Object constructed from a JSON response
   */
  getWithCache(url) {
    return new Promise((resolve, reject) => {
      const fullUrl = this.getFullUrl(url),
        cachedReq = commonRequestCache[fullUrl];
      if (cachedReq) {
        console.log('Using cached data');
        resolve(cachedReq);
      } else {
        this.get(fullUrl).then((result) => {
          commonRequestCache[fullUrl] = result;
          resolve(result);
        }, reject);
      }
    });
  }

  /**
   * Makes search request for specified URL.
   * @param {string} url
   * @return {Promise} resolves/rejects with Object {status, data}, where
   *                   status is HTTP status number,
   *                   data is Object constructed from a JSON response
   */
  searchWithCache(url) {
    return new Promise((resolve, reject) => {
      const [_url, params] = this.getFullUrl(url).split('?'),
        newUrl = `${_url}/_search`,
        cacheKey = `${newUrl}?${params}`,
        cachedReq = commonRequestCache[cacheKey];
      if (cachedReq) {
        console.log('Using cached data');
        resolve(cachedReq);
      } else {
        // Can't batch POST-requests with a "Content-Type: application/x-www-form-urlencoded"
        this._request({
          method: 'POST',
          url: newUrl,
          body: params,
          contentType: 'application/x-www-form-urlencoded'
        }).then((result) => {
          commonRequestCache[cacheKey] = result;
          resolve(result);
        }, reject);
      }
    });
  }

  /**
   * Extracts next page URL from a response (see: https://www.hl7.org/fhir/http.html#paging)
   * @param {Object} response
   * @return {string|false}
   */
  getNextPageUrl(response) {
    let result;
    return (
      response.link.some(
        (link) => link.relation === 'next' && (result = link.url)
      ) && result
    );
  }

  /**
   * The map/filter function for resources.
   * @callback ResourceMapFilterCallback
   * @param {Object} resource
   * @return {Promise<boolean|Object>}
   */

  /**
   * Returns the promise of resources(or mapped values) that meet the condition specified in a filter(map) function.
   * @param {string|Promise} url - URL to get resources
   * @param {number} count - the target number of resources
   * @param {ResourceMapFilterCallback} filterMapFunction - the resourcesFilter method calls the filterFunction
   *                                 one time for each resource to determine whether the element should
   *                                 be included in the resulting array (returns Promise<true>), skipped (returns Promise<false>)
   *                                 or replaced with new value(returns Promise<Object>)
   * @param {number} [pageSize] - page size for resources loading
   * @return {Promise<Array>}
   */
  resourcesMapFilter(url, count, filterMapFunction, pageSize) {
    // The value (this._maxPerBatch*this._maxActiveReq*2) is the optimal page size to get resources for filtering/mapping:
    // this value should be so minimal as not to load a lot of unnecessary data, but sufficient to allow parallel
    // loading of data to speed up the process.
    // For example, if we want to load Patients whose Encounters meet certain criteria,
    // we will load Encounters in portions of the specified optimal page size, and for each Encounter,
    // load the Patient and add it to the result (if it is not already in it) until we get the target number of Patients.
    return this._resourcesMapFilter(
      this.getWithCache(
        updateUrlWithParam(
          url,
          '_count',
          pageSize || this._maxPerBatch * this._maxActiveReq * 2
        )
      ),
      count,
      filterMapFunction
    );
  }

  /**
   * A private method that is called from a public method resourcesMapFilter.
   * @param {Promise} firstRequest - promise to return the first page of resources
   * @param {number} count - see public method resourcesMapFilter
   * @param {ResourceMapFilterCallback} filterMapFunction - see public method resourcesMapFilter
   * @return {Promise<Array>}
   * @private
   */
  _resourcesMapFilter(firstRequest, count, filterMapFunction) {
    return new Promise((resolve, reject) => {
      firstRequest.then(({ data }) => {
        const resources = (data.entry || []).map((entry) => entry.resource);

        Promise.all(
          resources.map((resource) => filterMapFunction(resource))
        ).then((match) => {
          const result = resources
            .map((res, index) => (match[index] === true ? res : match[index]))
            .filter((res) => res !== false);
          const newCount = count - result.length;
          const nextPageUrl = this.getNextPageUrl(data);

          if (result.length < count && nextPageUrl) {
            this._resourcesMapFilter(
              this.getWithCache(nextPageUrl),
              newCount,
              filterMapFunction
            ).then((nextPage) => {
              resolve(result.concat(nextPage));
            }, reject);
          } else {
            if (result.length > count) {
              // Remove extra entries
              result.length = count;
            }
            resolve(result);
          }
        }, reject);
      }, reject);
    });
  }
}
