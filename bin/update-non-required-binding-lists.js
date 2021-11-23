const fs = require('fs');
const https = require('https');

const updateList = [
  ['https://lforms-fhir.nlm.nih.gov/baseR4', 'Observation', 'category']
];
const data = {};

function getListValue(server, resourceType, searchParam) {
  const codes = [{ code: 'PHY', display: 'Pharmacy' }];

  // Store in data object.
  if (!data[server]) {
    data[server] = {};
  }
  if (!data[server][resourceType]) {
    data[server][resourceType] = {};
  }
  data[server][resourceType][searchParam] = codes;
}

updateList.forEach((value) => {
  getListValue(value[0], value[1], value[2]);
});
console.log(data);
try {
  fs.writeFileSync('../non-required-binding-lists.json', JSON.stringify(data));
} catch (err) {
  console.error(err);
}
