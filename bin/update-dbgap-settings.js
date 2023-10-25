/**
 * This file contains a script used to update the "customization.dbgap.serverDescription" section in settings.json5.
 */

// Emulate the browser's XMLHttpRequest object.
global.XMLHttpRequest = require('xmlhttprequest').XMLHttpRequest;

const {FhirBatchQuery} = require('../src/app/shared/fhir-backend/fhir-batch-query.js');
const JSON5 = require('json5');
const json5Writer = require('json5-writer');
const fs = require('fs');

// Use the same class as in the web application to get the actual initialization
// parameters.
const fhirClient = new FhirBatchQuery({
  serviceBaseUrl: 'https://dbgap-api.ncbi.nlm.nih.gov/fhir/x1'
});

// Run initialization queries in the same way as we do in the web application,
// and use the results to update settings.
fhirClient.initialize().then(() => {
  const settingsPath = './src/assets/settings.json5';
  const settingsJsonString = fs.readFileSync(settingsPath).toString();
  const settings = JSON5.parse(settingsJsonString);

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
    if (url === 'dbgap') {
      updateSettingsObj.customization[url] = {};
      Object.keys(settings.customization[url]).forEach((key) => {
        if (key === 'serverDescription') {
          updateSettingsObj.customization[url][key] = {
            version: fhirClient.getVersionName(),
            features: fhirClient.getFeatures()
          };
        } else {
          updateSettingsObj.customization[url][key] = undefined;
        }
      });
    } else {
      updateSettingsObj.customization[url] = undefined;
    }
  });

  const settingsWriter = json5Writer.load(settingsJsonString);
  settingsWriter.write(updateSettingsObj);
  fs.writeFileSync(settingsPath, settingsWriter.toSource());
}, (err) => {
  console.error(err);
});
