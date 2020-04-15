let commonRequestCache = {}; // Map from url to result JSON

// Javascript client for FHIR with the ability to automatically combine requests in a batch
export class FhirClient {

  /**
   * Requests are executed or combined depending on the parameters passed to this method.
   * @constructor
   * @param {string} serviceBaseUrl - FHIR REST API Service Base URL (https://www.hl7.org/fhir/http.html#root)
   * @param {number} maxRequestsPerBatch - the maximum number of requests that can be combined (1 - turn off combined requests)
   * @param {number} maxActiveRequests - the maximum number of requests that can be executed simultaneously
   * @param {number} batchTimeout - the time in milliseconds between requests that can be combined
   */
  constructor({serviceBaseUrl = '', maxRequestsPerBatch = 5, maxActiveRequests = 3, batchTimeout = 20}) {
    this._serviceBaseUrl = serviceBaseUrl;
    this._pending = [];
    this._batchTimeoutId = null;
    this._batchTimeout = batchTimeout;
    this._maxPerBatch = maxRequestsPerBatch;
    this._maxActiveReq = maxActiveRequests;
    this._activeReq = 0;
  }

  /**
   *  Gets the response content from a URL.  The callback will be called with the
   *  status and response text.
   * @param url the URL whose data is to be retrieved.
   * @param callback the function to receive the reponse.  The callback will be
   *  passed the request status, the response text, and the XMLHttpRequest object.
   * @return the XMLHttpRequest object
   */
  get(url, callback) {
    this._pending.push({url, callback});
    if (this._pending.length < this._maxPerBatch) {
      clearTimeout(this._batchTimeoutId);
      this._batchTimeoutId = setTimeout(() => this._postPending(), this._batchTimeout)
    } else {
      this._postPending();
    }
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
              url
            }
          }))
        }),
        oReq = new XMLHttpRequest();

      oReq.onreadystatechange = () => {
        if (oReq.readyState === 4) {
          --this._activeReq;
          console.log("Bach AJAX call returned in "+(new Date() - startAjaxTime));
          const status = oReq.status,
            data = JSON.parse(oReq.responseText)
          current.forEach(({callback}, index) => {
            callback(status, status === 200 ? data.entry[index].resource : {})
          });
          this._postPending();
        }
      }
      let startAjaxTime = new Date();
      oReq.open("POST", `${this._serviceBaseUrl}?&_format=application/json`);
      oReq.setRequestHeader('Content-Type', 'application/json');
      oReq.send(body);
      ++this._activeReq;
    } else if (this._pending.length > 0) {
      const {url, callback} = this._pending.pop(),
        oReq = new XMLHttpRequest(),
        startAjaxTime = new Date();
      oReq.onreadystatechange = () => {
        if (oReq.readyState === 4) {
          --this._activeReq;
          console.log("AJAX call returned in "+(new Date() - startAjaxTime));
          callback(oReq.status, JSON.parse(oReq.responseText));
          this._postPending();
        }
      }

      oReq.open("GET", `${this._serviceBaseUrl}/${url}`);
      oReq.send();
      ++this._activeReq;
    }
  }

  clearPendingRequests() {
    this._pending.length = 0;
  }


  /**
   *  Like "get", but uses a cache if the URL has been requested before.
   * @param url the URL whose data is to be retrieved.
   * @param callback the function to receive the response.  The callback will be
   *  passed the request status, the response text, and the XMLHttpRequest object.
   */
  getWithCache(url, callback) {
    const cacheKey = `${this._serviceBaseUrl}/${url}`,
      cachedReq = commonRequestCache[cacheKey];
    if (cachedReq) {
      console.log("Using cached data");
      callback(cachedReq.status, cachedReq.data);
    }
    else {
      this.get(url, function(status, data) {
        if (status === 200) {
          commonRequestCache[cacheKey] = {status, data};
        }
        callback(status, data);
      });
    }
  }

}