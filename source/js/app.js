// Imports for webpack to find assets
import '../css/app.css';

// "Real" imports
import './common/polyfills';
import * as catData from './common/category-list';
import { saveAs } from 'file-saver';
import { ObservationTable } from './observation-table'
import { FhirBatchQuery, HTTP_ABORT } from "./common/fhir-batch-query";
import {
  SearchParameters,
  PatientSearchParameters, PATIENT,
  EncounterSearchParameters,
  ObservationSearchParameters,
  ConditionSearchParameters,
  MedicationDispenseSearchParameters
} from './search-parameters';
import { toggleCssClass, addCssClass, removeCssClass } from './common/utils';
import { Reporter } from './reporter';
import { PatientTable } from './patient-table';
import './common/collapsable-sections';

const catLimitRow = document.getElementById('catSel');
const testLimitRow = document.getElementById('testSel');
const loadPatientsButton = document.getElementById('loadPatients');
const loadObservationsButton = document.getElementById('loadObservations');
const reportPatientsSpan = document.getElementById('reportPatients');
const reportObservationsSpan = document.getElementById('reportObservations');

let categoryLimits = true;

if (/[?&]tunable(&|$)/.test(window.location.search)) {
  removeCssClass('.performance-tuning', 'hide');
}

// An instance of report popup component for collecting statistical information about Patient selection
const patientsReporter = new Reporter();
// An instance of report popup component for collecting statistical information about Observation selection
const observationsReporter = new Reporter();
let fhirClient = getFhirClient();
let patientSearchParams = createPatientSearchParameters(document.getElementById('fhirServer').value);
document.getElementById('fhirServer').addEventListener('change', function() {
  patientSearchParams && patientSearchParams.dispose();
  patientSearchParams = createPatientSearchParameters(this.value);

  loadPatientsButton.disabled = true;
  patientSearchParams.initialize.then(() => loadPatientsButton.disabled = false);
  // Clear visible Patient list data
  showMessageIfNoPatientList('');
  reportPatientsSpan.innerHTML = '';
  fhirClient.clearPendingRequests();

  fhirClient = getFhirClient();
});

var loincAC = new Def.Autocompleter.Search('loincTests',
  'https://clinicaltables.nlm.nih.gov/api/loinc_items/v3/search?type=question',
  {maxSelect: '*', matchListValue: true});

// Set up propulated values
var selectedTests = [['Weight', '29463-7'], ['Body height Measured', '3137-7'],
  ['Feeling down, depressed, or hopeless?', '44255-8'], ['Current smoker', '64234-8']];
for (var i=0, len=selectedTests.length; i<len; ++i) {
  var testData = selectedTests[i];
  // TBD -- These APIs are not documented.  We should probably add something to
  // the autocompleter for setting the state of a search list.
  loincAC.storeSelectedItem(testData[0], testData[1]);
  loincAC.addToSelectedArea(testData[0]);
}

// Category list
var categoryAC = new Def.Autocompleter.Prefetch('categories', catData.display,
  {codes: catData.codes});
categoryAC.setFieldToListValue('Vital Signs');

/**
 *  Shows a message when there are no Patient list was displayed
 */
function showMessageIfNoPatientList(msg) {
  const nonResultsMsgElement = document.getElementById('noPatients');
  nonResultsMsgElement.innerText=msg;
  toggleCssClass('#noPatients', 'hide', !msg);
  addCssClass('#patientsArea', 'hide');
}

/**
 * Shows the Patient list area and updates the number of Patients in the area header
 * @param {number} count - number of Patients
 */
function showListOfPatients(count) {
  addCssClass('#noPatients', 'hide');
  removeCssClass('#patientsArea', 'hide');
  addCssClass('#observationsArea', 'hide');
  addCssClass(document.querySelector('#patientTable').closest('.section'), 'section_collapsed');
  document.getElementById('patientsCount').innerText = count;
  reportObservationsSpan.innerHTML = '';
}

/**
 * Shows the current progress of loading the Patient list
 * @param {string} message
 * @param {number|undefined} percent
 */
function showPatientProgress(message, percent) {
  if (percent === undefined) {
    showMessageIfNoPatientList(`${message}...`);
  } else {
    showMessageIfNoPatientList(`${message}... ${percent}%`);
  }
  patientsReporter.setProgress(message + '...', percent);
}

/**
 *  Shows a message when there are no Observation list was displayed
 */
function showMessageIfNoObservationList(msg) {
  const nonResultsMsgElement = document.getElementById('noObservations');
  nonResultsMsgElement.innerText=msg;
  removeCssClass('#noObservations', 'hide');
  addCssClass('#observationsArea', 'hide');
}

/**
 * Shows the Observation list area and updates the number of Observations in the area header
 * @param {number} count - number of Observations
 */
function showListOfObservations(count) {
  addCssClass('#noObservations', 'hide');
  removeCssClass('#observationsArea', 'hide');
  removeCssClass(document.querySelector('#resultsTable').closest('.section'), 'section_collapsed');
  document.getElementById('observationsCount').innerText = count;
}

/**
 * Shows the report about loading the Patient list
 */
export function showPatientsReport() {
  patientsReporter.show();
}

/**
 * Shows the report of loading the Observation list
 */
export function showObservationsReport() {
  observationsReporter.show();
}

/**
 * Shows the current progress of loading the Observation list
 * @param {string} message
 * @param {number|undefined} percent
 */
function showObservationsProgress(message, percent) {
  if (percent === undefined) {
    showMessageIfNoObservationList(`${message}...`);
  } else {
    showMessageIfNoObservationList(`${message}... ${percent}%`);
  }
  observationsReporter.setProgress(message + '...', percent);
}

let patientResources;
const patientTable = new PatientTable('patientTable');
const observationsTable = new ObservationTable('resultsTable');

/**
 * Gets an instance of FhirBatchQuery used to query data for Patient/Observation list
 * @return {FhirBatchQuery}
 */
function getFhirClient() {
  const serviceBaseUrl = document.getElementById('fhirServer').value;
  const maxRequestsPerBatch = document.getElementById('maxRequestsPerBatch').value || undefined;
  const maxActiveRequests = document.getElementById('maxActiveRequests').value || undefined;
  return new FhirBatchQuery({serviceBaseUrl, maxRequestsPerBatch, maxActiveRequests});
}

/**
 * Creates the section with search parameters for patients selection
 *
 * @return {SearchParameters}
 */
function createPatientSearchParameters(serviceBaseUrl) {
  return new SearchParameters(
    '#patientSearchParamsAfterThisRow',
    serviceBaseUrl,
    [
      PatientSearchParameters,
      EncounterSearchParameters,
      ConditionSearchParameters,
      MedicationDispenseSearchParameters,
      ObservationSearchParameters,
      "Account",
      "AdverseEvent",
      "CarePlan",
      "CareTeam",
      "ChargeItem",
      "ClinicalImpression",
      "Communication",
      "CommunicationRequest",
      "DeviceRequest",
      "DeviceUseStatement",
      "DiagnosticReport",
      "DocumentManifest",
      "DocumentReference",
      "Flag",
      "Goal",
      "GuidanceResponse",
      "Invoice",
      "List",
      "MeasureReport",
      "MedicationAdministration",
      "MedicationRequest",
      "MedicationStatement",
      "Procedure",
      "RequestGroup",
      "RiskAssessment",
      "ServiceRequest"
    ]);
}

/**
 * Handles the request to load the Patient list
 */
export function loadPatients() {
  reportPatientsSpan.innerHTML = '';
  loadPatientsButton.disabled = true;
  loadObservationsButton.disabled = true;
  patientsReporter.initialize();
  const startDate = new Date();

  patientTable.setAdditionalColumns(patientSearchParams.getColumns());

  getPatients().then(
    data => {
      patientResources = data;
      reportPatientsSpan.innerHTML = `(<a href="#" onclick="app.showPatientsReport();return false;">loaded data in ${((new Date() - startDate) / 1000).toFixed(1)} s</a>)`;
      removeCssClass('#reportPatients', 'hide');

      if (patientResources.length) {
        patientTable.fill(patientResources, fhirClient.getServiceBaseUrl());
        showListOfPatients(patientResources.length);
      } else {
        showMessageIfNoPatientList('No matching Patients found.');
      }
    },
    ({status, error}) => {
      if (status !== HTTP_ABORT) {
        // Show message if request is not aborted
        showMessageIfNoPatientList(`Could not load Patient list`);
        console.log(`FHIR search failed: ${error}`);
      }
    })
    .finally(() => {
      patientsReporter.finalize();
      loadPatientsButton.disabled = false;
      loadObservationsButton.disabled = false;
    });
}

/**
 *  Handles the request to load the Observation list
 */
export function loadObs() {
  reportObservationsSpan.innerHTML = '';
  loadPatientsButton.disabled = true;
  loadObservationsButton.disabled = true;

  const perPatientPerTest = document.getElementById('perPatientPerTest').value || Number.POSITIVE_INFINITY;

  let codes, field;
  if (categoryLimits) {
    codes = categoryAC.getSelectedCodes();
    field = 'category';
  } else { // test codes instead of categories
    codes = loincAC.getSelectedCodes();
    field = 'code';
  }

  observationsTable.setAdditionalColumns(patientSearchParams.getColumns());

  const startDate = new Date();
  const patientCount = patientResources.length;
  let completedRequestCount = 0;
  let allObservations = [];
  let hasError = false;
  const urlSuffixes = codes && codes.length > 0
    ? codes.map(code => `&_count=${perPatientPerTest}&${field}=${encodeURIComponent(code)}`)
    : [`&_count=1000`];
  const suffixCount = urlSuffixes.length;
  const totalRequestCount = patientCount * suffixCount;

  observationsReporter.initialize();
  showObservationsProgress('Loading observations', 0);
  let observationsLoaded = observationsReporter.addMetric({name: 'Observation resources loaded'});

  for (let i = 0; i < patientCount; ++i) {
    const patient = patientResources[i];

    for (let j = 0; j < suffixCount; ++j) {
      const urlSuffix = urlSuffixes[j],
        index = i * suffixCount + j;

      fhirClient.getWithCache(
        `Observation?subject=Patient/${patient.id}` +
        `&_sort=patient,code,-date&_elements=subject,effectiveDateTime,code,value,interpretation` + urlSuffix)
        .then(({status, data}) => {
          if (!hasError) {
            showObservationsProgress('Loading observations', Math.floor(++completedRequestCount * 100 / totalRequestCount));
            allObservations[index] = (data.entry || []).map(item => item.resource);
            observationsLoaded.incrementCount(allObservations[index].length);
            if (completedRequestCount === totalRequestCount) {

              observationsReporter.finalize();
              reportObservationsSpan.innerHTML = `(<a href="#" onclick="app.showObservationsReport();return false;">loaded data in ${((new Date() - startDate) / 1000).toFixed(1)} s</a>)`;

              const observations = [].concat(...allObservations);
              if (observations.length) {
                observationsTable.fill({
                  patients: patientResources,
                  observations
                }, perPatientPerTest, fhirClient.getServiceBaseUrl());
                showListOfObservations(observations.length);
              } else {
                showMessageIfNoObservationList('No matching Observations found.');
              }
              loadPatientsButton.disabled = false;
              loadObservationsButton.disabled = false;
            }
          }
        }, ({status}) => {
          hasError = true;
          if (status !== HTTP_ABORT) {
            fhirClient.clearPendingRequests();
            // Show message if request is not aborted
            showMessageIfNoObservationList('Could not load observation list');
          }
          loadPatientsButton.disabled = false;
          loadObservationsButton.disabled = false;
        })
    }
  }
}

/**
 * Loads list of patients resources using search parameters.
 * @return {Promise<Array>}
 */
function getPatients() {
  const maxPatientCount = document.getElementById('maxPatientCount').value;
  const elements = patientSearchParams.getResourceElements(PATIENT,['name']).join(',');
  const resourceSummaries = patientSearchParams.getAllCriteria().filter(item => item.criteria.length || item.resourceType === PATIENT);

  return new Promise((resolve, reject) => {

    showPatientProgress('Calculating resources count');

    const numberOfResources = resourceSummaries.length > 1 ? patientsReporter.addMetric({
        name: 'Searches to find the following counts'
      }) : null;
    Promise
      .all(resourceSummaries.length > 1
        ? resourceSummaries.map(item => fhirClient.getWithCache(
          `${item.resourceType}?_total=accurate&_summary=count${item.criteria}`
        ))
        : [])
      .then(summaries => {
        // Sort by the number of resources matching the conditions
        if (summaries.length > 0) {
          resourceSummaries.forEach((resourceSummary, index) => {
            resourceSummary.total = summaries[index].data.total;

          });
          resourceSummaries.sort((x, y) => x.total - y.total);
          resourceSummaries.forEach((resourceSummary) => {
            patientsReporter.addMetric({
              name: `* Number of matching ${resourceSummary.resourceType} resources`,
              calculateDuration: false,
              count: resourceSummary.total
            });
          })
          numberOfResources.updateCount(summaries.length);
        }

        showPatientProgress('Searching patients', 0);
        const patientResourcesLoaded = patientsReporter.addMetric({
          name: 'Patient resources loaded'
        })

        if (resourceSummaries[0].total === 0) {
          resolve([]);
        } else {
          let checked = 0;
          let processedPatients = {};
          // Processing resources, the number of which is less than the number of Patients.
          // (Retrieve patient identifiers corresponding to resources whose number is less than the number of Patients)
          const firstItem = resourceSummaries.shift();
          const firstItemElements = firstItem.resourceType === PATIENT ? elements : 'subject';
          fhirClient.resourcesMapFilter(`${firstItem.resourceType}?_elements=${firstItemElements}${firstItem.criteria}`,
            maxPatientCount, resource => {
              let patientResource, patientId;
              if (resource.resourceType === PATIENT) {
                patientResource = resource;
                patientId = patientResource.id;
              } else {
                patientId = /^Patient\/(.*)/.test(resource.subject.reference) && RegExp.$1;
              }
              if (processedPatients[patientId]) {
                return false;
              }
              processedPatients[patientId] = true;
              return resourceSummaries.reduce((promise, item) => promise.then(() => {
                const params = item.resourceType === PATIENT
                  ? `_elements=${elements}${item.criteria}&_id=${patientId}`
                  : `_total=accurate&_summary=count${item.criteria}&subject:Patient=${patientId}`;

                return fhirClient.getWithCache(`${item.resourceType}?${params}`)
                  .then(({data}) => {
                    const meetsTheConditions = data.total > 0;
                    const resource = data.entry && data.entry[0] && data.entry[0].resource;
                    if (resource && resource.resourceType === PATIENT) {
                      patientResource = resource;
                    }

                    return meetsTheConditions && patientResource ? patientResource : meetsTheConditions;
                  });
              }), Promise.resolve(patientResource ? patientResource : null))
                .then(result => {
                  if (result) {
                    patientResourcesLoaded.updateCount(++checked);
                    showPatientProgress('Searching patients', Math.floor(Math.min(maxPatientCount, checked) * 100 / maxPatientCount));
                  }
                  return result;
                });
            }, resourceSummaries.length > 1 ? null : maxPatientCount)
            .then(resolve, reject);
        }
      }, ({error}) => {
      console.log(`FHIR search failed: ${error}`);
      reject();
    });
  });
}

/**
 *  Handles the request to download the observations.
 */
export function downloadObs() {
  saveAs(observationsTable.getBlob(), 'observations.csv');
}

export function clearCache() {
  FhirBatchQuery.clearCache();
}

/**
 *  Handles the request to change the limit type selection (category or test
 *  type).
 * @param ev the change event
 */
function handleLimitSelection(ev) {
  setLimitType(ev.target.id === 'limit1');
}

/**
 *  Sets the limit type (category or test) and adjusts the display.
 * @param isCategory true if categories are to be used.
 */
function setLimitType(isCategory) {
  categoryLimits = isCategory;
  testLimitRow.style.display = categoryLimits ? 'none' : '';
  catLimitRow.style.display = categoryLimits ? '' : 'none';
}
setLimitType(false);

var categoryRadio = document.getElementById('limit1');
categoryRadio.addEventListener('change', handleLimitSelection);
document.getElementById('limit2').addEventListener('change', handleLimitSelection);

