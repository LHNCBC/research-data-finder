let commonRequestCache = {}; // Map from url to result JSON

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
  constructor({serviceBaseUrl = '', maxRequestsPerBatch = 10, maxActiveRequests = 6, batchTimeout = 20}) {
    this._serviceBaseUrl = serviceBaseUrl;
    this._pending = [];
    this._batchTimeoutId = null;
    this._batchTimeout = batchTimeout;
    this._maxPerBatch = maxRequestsPerBatch;
    this._maxActiveReq = maxActiveRequests;
    this._activeReq = 0;
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
      this._pending.push({url, resolve, reject});
      if (this._pending.length < this._maxPerBatch) {
        clearTimeout(this._batchTimeoutId);
        this._batchTimeoutId = setTimeout(() => this._postPending(), this._batchTimeout)
      } else {
        this._postPending();
      }
    });
  }

  /**
   * Sends XMLHttpRequest
   * @private
   * @return {Promise}
   */
  _request({method = 'GET', url, body, contentType = 'application/fhir+json', logPrefix = ''}) {
    return new Promise((resolve, reject) => {
      const oReq = new XMLHttpRequest(),
        startAjaxTime = new Date();

      oReq.onreadystatechange = () => {
        if (oReq.readyState === 4) {
          --this._activeReq;
          console.log(`${logPrefix ? logPrefix + ' ' : ''}AJAX call returned in ${(new Date() - startAjaxTime)}`);
          const status = oReq.status;

          if (this.isOK(status)) {
            resolve({status, data: JSON.parse(oReq.responseText)})
          } else {
            let error;
            try {
              error = oReq.responseText ? JSON.parse(oReq.responseText) : {}
            } catch (e) {
              error = {};
            }
            reject({status, error: this._getErrorDiagnostic(error)});
          }
          this._postPending();
        }
      }

      oReq.open(method, url);
      oReq.setRequestHeader('Content-Type', contentType);
      oReq.send(body);
      ++this._activeReq;
    });
  }

  /**
   * Sends pending requests as batch or single
   * @private
   */
  _postPending() {
    if(this._activeReq >= this._maxActiveReq) {
      return;
    }

    if (this._pending.length > 1 && this._maxPerBatch > 1) {
      const current = this._pending.splice(0, this._maxPerBatch),
        body = JSON.stringify({
          resourceType: 'Bundle',
          type: 'batch',
          entry: current.map(({url}) => ({
            request: {
              method: "GET",
              url: this.getRelativeUrl(url)
            }
          }))
        });

      this._request({
        method: 'POST',
        url: this._serviceBaseUrl,
        body,
        logPrefix: 'Batch'
      }).then(({status, data}) => {
        current.forEach(({resolve, reject}, index) => {
          const entry = data.entry[index];
          const status = /^(\d+)\s/.test(entry.response.status) && parseInt(RegExp.$1);
          if (this.isOK(status)) {
            resolve({status, data: entry.resource || {}});
          } else {
            reject({status, error: this._getErrorDiagnostic(entry.response.outcome)});
          }
        });
      }, ({status, error}) => {
        current.forEach(({reject}) => {
          reject({status, error: error});
        });
      });
    } else if (this._pending.length > 0) {
      const {url, resolve, reject} = this._pending.pop()
      this._request({url}).then(resolve, reject);
    }
  }

  /**
   * Returns text with FHIR response issue diagnostics
   * @param {Object} data
   * @return {string}
   */
  _getErrorDiagnostic(data) {
    if (data && data.issue && data.issue.length) {
      return data.issue.map(item => item.diagnostics).join('\n') || '';
    }

    return 'Unknown Error';
  }

  clearPendingRequests() {
    this._pending.length = 0;
  }

  getFullUrl(url) {
    return /^http[s]{0,1}:\/\//.test(url) ? url : `${this._serviceBaseUrl}/${url}`;
  }

  getRelativeUrl(url) {
    return url.indexOf(this._serviceBaseUrl) === 0 ? url.substr(this._serviceBaseUrl.length+1) : url;
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
        console.log("Using cached data");
        resolve(cachedReq);
      }
      else {
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
      const
        [_url, params] = this.getFullUrl(url).split('?'),
        newUrl = `${_url}/_search`,
        cacheKey = `${newUrl}?${params}`,
        cachedReq = commonRequestCache[cacheKey];
      if (cachedReq) {
        console.log("Using cached data");
        resolve(cachedReq);
      }
      else {
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

  getNextPageUrl(respond, newCount) {
    let result;
    return respond.link
      .some(
        link => link.relation === 'next'
        && (result = newCount ? link.url.replace(/([&?])_count=\d*/, '$1_count='+newCount) : link.url)
      )
      && result;
  }

  /**
   * The map/filter function for resources.
   * @callback ResourceMapFilterCallback
   * @param {Object} resource
   * @return {Promise<boolean>}
   */

  /**
   * Returns the promise of resources(or mapped values) that meet the condition specified in a filter(map) function.
   * @param {Object} firstRequest - request for first page of resources
   * @param {number} count - the target number of resources
   * @param {ResourceMapFilterCallback} filterMapFunction - the resourcesFilter method calls the filterFunction
   *                                 one time for each resource to determine whether the element should
   *                                 be included in the resulting array (returns true), skipped (returns false)
   *                                 or replaced with new value(returns new value)
   * @return {Promise<Array>}
   */
  resourcesMapFilter(firstRequest, count, filterMapFunction) {
    return new Promise((resolve, reject) => {
      firstRequest.then(({data}) => {
        const resources = data.entry.map(entry => entry.resource);

        Promise.all(resources.map(resource => filterMapFunction(resource)))
          .then(match => {
            const result = resources
              .map((res, index) => match[index] === true ? res : match[index])
              .filter(res => res !== false);
            const newCount = count - result.length;
            const nextPageUrl = this.getNextPageUrl(data, Math.floor((this._maxPerBatch*this._maxActiveReq*2)*newCount/count));

            if (result.length < count && nextPageUrl) {
              this.resourcesMapFilter(this.getWithCache(nextPageUrl), newCount, filterMapFunction).then(nextPage => {
                resolve(result.concat(nextPage))
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