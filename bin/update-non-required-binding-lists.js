const fs = require('fs');
const https = require('https');

const updateList = [
  ['https://lforms-fhir.nlm.nih.gov/baseR4', 'Observation', 'category']
];
const data = {};
const httpPromises = [];

function hasNextUrlLink(response) {
  return response.link.some((l) => l.relation === 'next');
}

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
