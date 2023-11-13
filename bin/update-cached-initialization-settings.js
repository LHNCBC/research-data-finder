/**
 * This file contains a script used to update the "customization.*.serverDescription"
 * sections in settings.json5. The script performs initialization requests for
 * each server in settings.json5 and saves the results (list of capabilities) to
 * the configuration file. Requests are executed before logging into the server,
 * so additional manual verification may be required (for a description of the
 * capabilities, see the file src/app/types/fhir-server-features.ts)
 */

// Emulate the browser's XMLHttpRequest object.
global.XMLHttpRequest = require('xmlhttprequest').XMLHttpRequest;

const {FhirBatchQuery} = require('../src/app/shared/fhir-backend/fhir-batch-query.js');
const JSON5 = require('json5');
const json5Writer = require('json5-writer');
const fs = require('fs');

const settingsPath = './src/assets/settings.json5';
const settingsJsonString = fs.readFileSync(settingsPath).toString();
const settings = JSON5.parse(settingsJsonString);
const promises = [];

// json5-writer will remove any property that does not exist in updateSettingsObj.
// To keep the previous property values, we need to pass undefined as the value
// for those properties.
const updateSettingsObj = Object.keys(settings).reduce((res, key) => {
  if (key === 'customization') {
    res[key] = {};
  } else {
    res[key] = undefined;
  }
  return res;
}, {});

Object.keys(settings.customization).forEach((url) => {
  // Use the same class as in the web application to get the actual initialization
  // parameters.
  const fhirClient = new FhirBatchQuery({
    serviceBaseUrl: url === 'dbgap' ? 'https://dbgap-api.ncbi.nlm.nih.gov/fhir/x1' : url
  });

  updateSettingsObj.customization[url] = {};

  promises.push(
    // Run initialization queries in the same way as we do in the web application,
    // and use the results to update settings.
    fhirClient.initialize().then(() => {
      Object.keys(settings.customization[url]).forEach((key) => {
        updateSettingsObj.customization[url][key] = undefined;
      });

      updateSettingsObj.customization[url]['serverDescription'] = {
        version: fhirClient.getVersionName(),
        features: fhirClient.getFeatures()
      };
    }, (err) => {
      console.error(err);
    })
  );

});

Promise.allSettled(promises).then(() => {
  const settingsWriter = json5Writer.load(settingsJsonString);
  settingsWriter.write(updateSettingsObj);
  fs.writeFileSync(settingsPath, settingsWriter.toSource());
});
