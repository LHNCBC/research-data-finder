/**
 * This program updates non-required-binding-lists.json for stored values of non-required
 * binding lists.
 * Those lists would have very bad performance if we query server at run-time.
 * Instead of querying server, the application will use values from above file.
 */
const fs = require('fs');
const https = require('https');

// Currently only Observation.category. Add other search parameters in future when seen fit.
const updateList = [
  ['https://lforms-fhir.nlm.nih.gov/baseR4', 'Observation', 'category']
];
const data = {};
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
 * @param processedCodes hash of already processed codes
 * @param codings array of codings recorded from server
 */
function callServer(resolve, url, searchParam, processedCodes, codings) {
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
        const coding =
          entry.resource[searchParam].coding ||
          entry.resource[searchParam][0].coding;
        coding.forEach((c) => {
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
        callServer(resolve, url, searchParam, processedCodes, codings);
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
 */
function createHttpsPromise(server, resourceType, searchParam) {
  // Hash of processed codes, used to exclude repeated codes
  const processedCodes = {};
  const codings = [];
  const url = `${server}/${resourceType}?_elements=${searchParam}`;
  const promise = new Promise((resolve, _) => {
    callServer(resolve, url, searchParam, processedCodes, codings);
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

updateList.forEach((value) => {
  createHttpsPromise(value[0], value[1], value[2]);
});
try {
  Promise.all(httpPromises).then(() => {
    console.log(
      data['https://lforms-fhir.nlm.nih.gov/baseR4']['Observation']['category']
    );
    fs.writeFileSync('non-required-binding-lists.json', JSON.stringify(data));
    console.log('done.');
  });
} catch (err) {
  console.error(err);
}
