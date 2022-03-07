/**
 * This program updates non-required-binding-lists.json for stored values of non-required
 * binding lists.
 * Those lists would have very bad performance if we query server at run-time.
 * Instead of querying server, the application will use values from above file.
 */
const fs = require('fs');
const https = require('https');
const fhirpath = require('fhirpath');
const fhirPathModelR4 = require('fhirpath/fhir-context/r4');

// Currently only Observation.category. Add other search parameters in future when seen fit.
const updateList = [
  ['https://lforms-fhir.nlm.nih.gov/baseR4', 'Observation', 'category']
];
const data = {
  // Interpretation data is kept here due to a HAPI FHIR interpretation query bug.
  'https://lforms-fhir.nlm.nih.gov/testR4': {
    Observation: {
      interpretation: [
        {
          code: 'HH',
          display: 'Critically High'
        },
        {
          code: 'H',
          display: 'High'
        },
        {
          code: 'N',
          display: 'Normal'
        },
        {
          code: 'L',
          display: 'Low'
        },
        {
          code: 'LL',
          display: 'Critically low'
        }
      ]
    }
  }
};
const httpPromises = [];

/**
 * Checks whether a query response contains a next link (meaning more results from server).
 */
function hasNextUrlLink(response) {
  return response.link.some((l) => l.relation === 'next');
}

/**
 * Makes a https request to server. Recursively make a new request excluding codes that are
 * already stored, if there is a next link in the response.
 * @param resolve method to resolve the promise
 * @param url initial url, e.g. 'https://lforms-fhir.nlm.nih.gov/baseR4/Observation?_elements=category'
 * @param searchParam search parameter
 * @param getCodings function for extracting codings from a resource
 * @param processedCodes hash of already processed codes
 * @param codings array of codings recorded from server
 */
function callServer(
  resolve,
  url,
  searchParam,
  getCodings,
  processedCodes,
  codings
) {
  const newUrl = `${url}&${searchParam}:not=${Object.keys(processedCodes).join(
    ','
  )}`;
  console.log(newUrl);
  https.get(newUrl, (res) => {
    res.setEncoding('utf8');
    let rawData = '';
    res.on('data', (chunk) => {
      rawData += chunk;
    });
    res.on('end', () => {
      const parsedData = JSON.parse(rawData);
      // Store new codings.
      (parsedData.entry || []).forEach((entry) => {
        getCodings(entry.resource).forEach((c) => {
          if (!processedCodes[c.code]) {
            processedCodes[c.code] = true;
            codings.push({
              code: c.code,
              display: c.display
            });
          }
        });
      });
      const nextPageUrl = hasNextUrlLink(parsedData);
      if (nextPageUrl) {
        callServer(
          resolve,
          url,
          searchParam,
          getCodings,
          processedCodes,
          codings
        );
      } else {
        resolve();
      }
    });
  });
}

/**
 * Creates a promise that will resolve after querying server for a list of codings.
 * Updates sheet object for show/hide column.
 * @param server e.g. 'https://lforms-fhir.nlm.nih.gov/baseR4'
 * @param resourceType resource type, e.g. 'Observation'
 * @param searchParam search parameter, e.g. 'category'
 * @param rootPropertyName root property name, e.g. 'content' if resource type is 'DocumentReference' and 'searchParam' is 'contenttype'
 * @param fhirPathExpression FHIRPath expression used to extract values from a resource
 */
function createHttpsPromise(
  server,
  resourceType,
  searchParam,
  rootPropertyName,
  fhirPathExpression
) {
  // Hash of processed codes, used to exclude repeated codes
  const processedCodes = {};
  const codings = [];
  const url = `${server}/${resourceType}?_elements=${rootPropertyName}`;
  const valuesGetter = fhirpath.compile(fhirPathExpression, fhirPathModelR4);

  /**
   * Extracts Codes, Codings or CodeableConcepts from a resource as array of Codings
   * @param resource
   * @return {[{code: string, display: string}]}
   */
  function getCodings(resource) {
    return [].concat(
      ...valuesGetter(resource).map((value) => {
        if (Array.isArray(value)) {
          return [].concat(...value.map((v) => (v.code ? [v] : v.coding)));
        } else if (typeof value === 'string') {
          // if we only have code, add a display value with the same value
          return [{ code: value, display: value }];
        }
        return value.code ? [value] : value.coding;
      })
    );
  }

  const promise = new Promise((resolve, _) => {
    callServer(resolve, url, searchParam, getCodings, processedCodes, codings);
  }).then(() => {
    // Store in data object.
    if (!data[server]) {
      data[server] = {};
    }
    if (!data[server][resourceType]) {
      data[server][resourceType] = {};
    }
    data[server][resourceType][searchParam] = codings;
  });
  httpPromises.push(promise);
}

updateList.forEach(
  ([
    server,
    resourceType,
    searchParam,
    rootPropertyName,
    fhirPathExpression
  ]) => {
    createHttpsPromise(
      server,
      resourceType,
      searchParam,
      rootPropertyName || searchParam,
      fhirPathExpression || searchParam
    );
  }
);
try {
  Promise.all(httpPromises).then(() => {
    console.log(
      // data['https://lforms-fhir.nlm.nih.gov/baseR4']['Observation']['category']
      data
    );
    fs.writeFileSync(
      'non-required-binding-lists.json',
      JSON.stringify(data, null, 2)
    );
    console.log('done.');
  });
} catch (err) {
  console.error(err);
}
