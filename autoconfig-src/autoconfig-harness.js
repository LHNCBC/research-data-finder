/**
 * Offline harness for autoconfig CSV filtering logic.
 *
 * This script runs fixture-based scenarios (base, combined, and choice) and
 * writes sample output CSV files under `autoconfig-src/fixtures/`.
 */
const fs = require('fs');
const path = require('path');
const {
  parseCsvString,
  stringifyCsvRows,
  buildCapabilityIndex,
  collectResourceTypes,
  collectSearchParamInfoByResource,
  isSpecialSearchParamName,
  filterDefinitionRows
} = require('./definitions-generator');

const r4Model = require('fhirpath/fhir-context/r4');

const baseCsvPath = path.join(
  __dirname,
  '..',
  'src',
  'conf',
  'csv',
  'desc-https-lforms-fhir-nlm-nih-gov-baseR4.csv'
);
const capabilityPath = path.join(__dirname, 'fixtures', 'capability.sample.json');
const samplesDir = path.join(__dirname, 'fixtures', 'samples');
const outputPath = path.join(__dirname, 'fixtures', 'definitions.sample.csv');
const combinedCsvPath = path.join(__dirname, 'fixtures', 'definitions.combined.csv');
const combinedCapabilityPath = path.join(__dirname, 'fixtures', 'capability.combined.json');
const combinedOutputPath = path.join(__dirname, 'fixtures', 'definitions.combined.sample.csv');
const choiceCsvPath = path.join(__dirname, 'fixtures', 'definitions.choice.csv');
const choiceCapabilityPath = path.join(__dirname, 'fixtures', 'capability.choice.json');
const choiceSamplesDir = path.join(__dirname, 'fixtures', 'samples');
const choiceOutputPath = path.join(__dirname, 'fixtures', 'definitions.choice.sample.csv');
const excludedSearchParamTypes = new Set(['reference', 'Patient', 'Identifier']);

/**
 * Verifies the output rows do not contain excluded search parameter types.
 *
 * @param {string[][]} rows - Parsed CSV rows to validate.
 * @param {string} label - Scenario label used in assertion error messages.
 * @returns {void}
 * @throws {Error} If any excluded search parameter type is present.
 */
function assertNoExcludedSearchParamTypes(rows, label) {
  const invalidRows = rows.filter((row) => {
    if (row?.[2] !== 'search parameter') {
      return false;
    }
    const type = (row?.[5] || '').trim();
    return excludedSearchParamTypes.has(type);
  });
  if (invalidRows.length > 0) {
    const elements = invalidRows.map((row) => row[1]).join(', ');
    throw new Error(
      `${label}: expected no reference/patient search parameters in output, found: ${elements}`
    );
  }
}

// Scenario 1: baseline fixture with capability + sample data checks enabled.
const csvString = fs.readFileSync(baseCsvPath, 'utf-8');
const rows = parseCsvString(csvString);
if (!rows) {
  throw new Error(`Failed to parse CSV definitions from ${baseCsvPath}`);
}

const capability = JSON.parse(fs.readFileSync(capabilityPath, 'utf-8'));
const capabilityIndex = buildCapabilityIndex(capability);
const resourceTypes = collectResourceTypes(rows);
const searchParamInfoByResource = collectSearchParamInfoByResource(rows);

const resourceInfoByType = new Map();
resourceTypes.forEach((resourceType) => {
  const supported = capabilityIndex.resourceTypes.has(resourceType);
  const samplePath = path.join(samplesDir, `${resourceType}.json`);
  const sampleResource = fs.existsSync(samplePath)
    ? JSON.parse(fs.readFileSync(samplePath, 'utf-8'))
    : null;
  const sampleResources = sampleResource ? [sampleResource] : [];
  const searchParamSupport = new Map();
  const capabilityParams = capabilityIndex.searchParamsByType.get(resourceType) || new Set();
  const paramInfo = searchParamInfoByResource.get(resourceType) || new Map();
  paramInfo.forEach((_, paramName) => {
    const supportedParam = isSpecialSearchParamName(paramName) || capabilityParams.has(paramName);
    searchParamSupport.set(paramName, supportedParam);
  });
  resourceInfoByType.set(resourceType, {
    supported,
    sampleResources,
    searchParamSupport
  });
});

// Run with full column checks to validate data-driven include/exclude behavior.
const filteredRows = filterDefinitionRows(rows, resourceInfoByType, {
  skipColumnChecks: false,
  model: r4Model
});
assertNoExcludedSearchParamTypes(filteredRows, 'base');
fs.writeFileSync(outputPath, stringifyCsvRows(filteredRows));
console.log(`Wrote ${filteredRows.length} rows to ${outputPath}`);

// Scenario 2: combined search parameters where partial support forces show.
const combinedCsvString = fs.readFileSync(combinedCsvPath, 'utf-8');
const combinedRows = parseCsvString(combinedCsvString);
if (!combinedRows) {
  throw new Error(`Failed to parse CSV definitions from ${combinedCsvPath}`);
}
const combinedCapability = JSON.parse(fs.readFileSync(combinedCapabilityPath, 'utf-8'));
const combinedIndex = buildCapabilityIndex(combinedCapability);
const combinedResourceTypes = collectResourceTypes(combinedRows);
const combinedSearchParamInfoByResource = collectSearchParamInfoByResource(combinedRows);
const combinedResourceInfoByType = new Map();
const combinedForceShow = new Map();

combinedResourceTypes.forEach((resourceType) => {
  const supported = combinedIndex.resourceTypes.has(resourceType);
  const searchParamSupport = new Map();
  const capabilityParams = combinedIndex.searchParamsByType.get(resourceType) || new Set();
  const paramInfo = combinedSearchParamInfoByResource.get(resourceType) || new Map();
  paramInfo.forEach((_, paramName) => {
    let supportedParam = true;
    if (!isSpecialSearchParamName(paramName)) {
      if (paramName.includes(',')) {
        const parts = paramName.split(',').map((part) => part.trim()).filter(Boolean);
        supportedParam = parts.length > 0 && parts.every((part) => capabilityParams.has(part));
        if (!supportedParam) {
          const showSet = combinedForceShow.get(resourceType) || new Set();
          parts.forEach((part) => showSet.add(part));
          combinedForceShow.set(resourceType, showSet);
        }
      } else {
        supportedParam = capabilityParams.has(paramName);
      }
    }
    searchParamSupport.set(paramName, supportedParam);
  });
  combinedResourceInfoByType.set(resourceType, {
    supported,
    sampleResources: [],
    searchParamSupport
  });
});


// Skip column checks here to focus on combined-parameter filtering semantics.
const combinedFilteredRows = filterDefinitionRows(combinedRows, combinedResourceInfoByType, {
  skipColumnChecks: true,
  forceShowByResource: combinedForceShow,
  model: r4Model
});
assertNoExcludedSearchParamTypes(combinedFilteredRows, 'combined');
fs.writeFileSync(combinedOutputPath, stringifyCsvRows(combinedFilteredRows));
const combinedElements = combinedFilteredRows
  .filter((row) => row[2] === 'search parameter')
  .map((row) => row[1]);
if (combinedElements.includes('code,medication')) {
  throw new Error('Combined search parameter should be excluded when not supported.');
}
const combinedCodeRow = combinedFilteredRows.find(
  (row) => row[2] === 'search parameter' && row[1] === 'code'
);
if (!combinedCodeRow || combinedCodeRow[4] !== 'show') {
  throw new Error('Expected "code" search parameter to be forced to show.');
}
console.log(`Wrote ${combinedFilteredRows.length} rows to ${combinedOutputPath}`);

// Scenario 3: choice-type columns (e.g. [x]) with fixture-backed sample data.
const choiceCsvString = fs.readFileSync(choiceCsvPath, 'utf-8');
const choiceRows = parseCsvString(choiceCsvString);
if (!choiceRows) {
  throw new Error(`Failed to parse CSV definitions from ${choiceCsvPath}`);
}
const choiceCapability = JSON.parse(fs.readFileSync(choiceCapabilityPath, 'utf-8'));
const choiceIndex = buildCapabilityIndex(choiceCapability);
const choiceResourceTypes = collectResourceTypes(choiceRows);
const choiceSearchParamInfoByResource = collectSearchParamInfoByResource(choiceRows);
const choiceResourceInfoByType = new Map();

choiceResourceTypes.forEach((resourceType) => {
  const supported = choiceIndex.resourceTypes.has(resourceType);
  const samplePath = path.join(choiceSamplesDir, `${resourceType}.json`);
  const sampleResource = fs.existsSync(samplePath)
    ? JSON.parse(fs.readFileSync(samplePath, 'utf-8'))
    : null;
  const sampleResources = sampleResource ? [sampleResource] : [];
  const searchParamSupport = new Map();
  const capabilityParams = choiceIndex.searchParamsByType.get(resourceType) || new Set();
  const paramInfo = choiceSearchParamInfoByResource.get(resourceType) || new Map();
  paramInfo.forEach((_, paramName) => {
    const supportedParam = isSpecialSearchParamName(paramName) || capabilityParams.has(paramName);
    searchParamSupport.set(paramName, supportedParam);
  });
  choiceResourceInfoByType.set(resourceType, {
    supported,
    sampleResources,
    searchParamSupport
  });
});

const choiceFilteredRows = filterDefinitionRows(choiceRows, choiceResourceInfoByType, {
  skipColumnChecks: false,
  model: r4Model
});
assertNoExcludedSearchParamTypes(choiceFilteredRows, 'choice');
fs.writeFileSync(choiceOutputPath, stringifyCsvRows(choiceFilteredRows));
const choiceColumnRow = choiceFilteredRows.find(
  (row) => row[2] === 'column' && row[1] === 'abatement[x]'
);
if (!choiceColumnRow) {
  throw new Error('Expected abatement[x] column to be included when typed property exists.');
}
console.log(`Wrote ${choiceFilteredRows.length} rows to ${choiceOutputPath}`);
