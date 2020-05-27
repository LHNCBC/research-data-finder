// Imports for webpack to find assets
import '../css/app.css';

// "Real" imports
import * as catData from './common/category-list';
import { saveAs } from 'file-saver';
import { ObservationTable } from './observation-table'
import { FhirBatchQuery } from "./common/fhir-batch-query";
import { SearchParameters, PatientSearchParameters, PATIENT, ENCOUNTER } from "./search-parameters";
import { slice } from "./common/utils";
import { EncounterSearchParameters } from "./search-parameters";

const noResultsMsg = document.getElementById('noResults'),
  resultSections = document.querySelectorAll('.results'),
  catLimitRow = document.getElementById('catSel'),
  testLimitRow = document.getElementById('testSel'),
  loadButton = document.getElementById('load'),
  reportSpan = document.getElementById('report'),
  performanceTuning = document.getElementById('performanceTuning');

let categoryLimits = true;

if (/[?&]tunable(&|$)/.test(window.location.search)) {
  performanceTuning.style.display = '';
}

new Def.Autocompleter.Prefetch('fhirServer', [
  'https://lforms-fhir.nlm.nih.gov/baseR4',
  'https://lforms-fhir.nlm.nih.gov/baseDstu3']);

const searchParams = new SearchParameters('#searchParamsAfterThisRow', [PatientSearchParameters, EncounterSearchParameters]);
searchParams.setFhirServer(document.getElementById('fhirServer').value);
Def.Autocompleter.Event.observeListSelections('fhirServer', function(eventData) {
  searchParams.setFhirServer(eventData.final_val);
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

const hiddenRegExp = /(\s*|^)hide\b/;
/**
 * Adds/removes css class "hide" for elements depending on the "show" parameter
 * @param {NodeListOf<Element>} elements
 * @param {boolean} show
 */
function setVisible(elements, show) {
  slice(elements).forEach(element => {
    const className = element.className;
    const isHidden = hiddenRegExp.test(className)
    if (isHidden !== show) {
      // nothing to change
      return;
    }

    element.className = (isHidden ? className.replace(hiddenRegExp, '') : className) + (show ? '' : ' hide');
  });
}

/**
 *  Used to show a message when there are no results to display.
 */
function showNonResultsMsg(msg) {
  noResultsMsg.innerText=msg;
  noResultsMsg.style.display = '';
  setVisible(resultSections, false);
}

/**
 *  Enables the display of the results portion of the page.
 */
function showResults() {
  noResultsMsg.style.display = 'none';
  setVisible(resultSections, true)
}

/**
 * Used to show loading progress
 * @param {string} message
 * @param {number} percent
 */
function showProgress(message, percent) {
  showNonResultsMsg(`${message}... ${percent}%`);
}

const observationsTable = new ObservationTable('resultsTable')

/**
 *  Handles the request to load the observations.
 */
export function loadObs() {
  loadButton.disabled = true;

  const serviceBaseUrl = document.getElementById('fhirServer').value;
  const maxRequestsPerBatch = document.getElementById('maxRequestsPerBatch').value || undefined;
  const maxActiveRequests = document.getElementById('maxActiveRequests').value || undefined;
  const client = new FhirBatchQuery({serviceBaseUrl, maxRequestsPerBatch, maxActiveRequests});
  const perPatientPerTest = document.getElementById('perPatientPerTest').value || Number.POSITIVE_INFINITY;

  let codes, field;
  if (categoryLimits) {
    codes = categoryAC.getSelectedCodes();
    field = 'category';
  } else { // test codes instead of categories
    codes = loincAC.getSelectedCodes();
    field = 'code';
  }

  observationsTable.setAdditionalColumns(searchParams.getColumns());

  const startDate = new Date();
  getPatients(client)
    .then((patientResources) => {
      const patientCount = patientResources.length;

      reportSpan.innerText = `(loaded data in ${((new Date() - startDate) / 1000).toFixed(1)} s)`;
      loadButton.disabled = false;
      if (patientCount) {
        let completedRequestCount = 0;
        let allObservations = [];
        let error = false;
        const urlSuffixes = codes && codes.length > 0
          ? codes.map(code => `&_count=${perPatientPerTest}&${field}=${encodeURIComponent(code)}`)
          : [`&_count=1000`];
        const suffixCount = urlSuffixes.length;
        const totalRequestCount = patientCount * suffixCount;

        showProgress('Loading observations', 0);

        for (let i = 0; i < patientCount; ++i) {
          const patient = patientResources[i];

          for (let j = 0; j < suffixCount; ++j) {
            const urlSuffix = urlSuffixes[j],
              index = i * suffixCount + j;

            client.getWithCache(
              `Observation?subject:reference=Patient/${patient.id}` +
              `&_sort=patient,code,-date&_elements=subject,effectiveDateTime,code,value,interpretation` + urlSuffix)
              .then(({status, data}) => {
                if (status !== 200) {
                  client.clearPendingRequests();
                  loadButton.disabled = false;
                  error = true;
                  showNonResultsMsg('Could not load observation list');
                } else if (!error) {
                  showProgress('Loading observations', Math.floor(++completedRequestCount * 100 / totalRequestCount));
                  allObservations[index] = (data.entry || []).map(item => item.resource);
                  if (completedRequestCount === totalRequestCount) {
                    reportSpan.innerText = `(loaded data in ${((new Date() - startDate)/1000).toFixed(1)} s)`;

                    const observations = [].concat(...allObservations);
                    if (observations.length) {
                      observationsTable.fill({
                        patients: patientResources,
                        observations
                      }, perPatientPerTest, serviceBaseUrl);
                      showResults();
                    } else {
                      showNonResultsMsg('No matching Observations found.');
                    }
                    loadButton.disabled = false;
                  }
                }
              });
          }
        }
      } else {
        showNonResultsMsg('No matching Patients found.');
      }
    }, ({error}) => {
      showNonResultsMsg(`Could not load Patient list`);
      console.log(`FHIR search failed: ${error}`);
    })
    .finally(() => {
      loadButton.disabled = false;
    });
}

/**
 * Loads list of patients resources using search parameters.
 * @param {FhirBatchQuery} client
 * @return {Promise<Array>}
 */
function getPatients(client) {
  const maxPatientCount = document.getElementById('maxPatientCount').value;
  const patientConditions = `${searchParams.getConditions(PATIENT)}`;
  const encounterConditions = `${searchParams.getConditions(ENCOUNTER)}`;
  const elements = searchParams.getResourceElements(PATIENT,['name']).join(',');

  return new Promise((resolve, reject) => {

    showNonResultsMsg('Calculating patients count...');

    Promise.all([
      encounterConditions ? client.getWithCache(`${PATIENT}?_summary=count&${patientConditions}`) : null,
      encounterConditions ? client.getWithCache(`${ENCOUNTER}?_summary=count&${encounterConditions}`) : null
    ]).then(([patients, encounters]) => {
      showProgress('Searching patients', 0);

      if (patients && patients.data.total === 0 || encounters && encounters.data.total === 0) {
        showNonResultsMsg('No matching Patients found.');
        resolve([]);
      } else if (encounterConditions && encounters.data.total < patients.data.total) {
        let loaded = 0, processedPatients = {};

        // load encounters then load patients from encounter subjects
        client.resourcesMapFilter(
          `${ENCOUNTER}?_elements=subject&${encounterConditions}`,
          maxPatientCount, encounter => {
          const patientId = /^Patient\/(.*)/.test(encounter.subject.reference) && RegExp.$1;
          if (processedPatients[patientId]) {
            return false;
          }
          processedPatients[patientId] = true;
          return new Promise((resolve, reject) => {
            client.getWithCache(
              `${PATIENT}?_elements=${elements}&${patientConditions}&_id=${patientId}`
            ).then(({data}) => {
              const patientResource = data.entry && data.entry[0] && data.entry[0].resource
              if (patientResource) {
                showProgress('Searching patients', Math.floor(Math.min(maxPatientCount, ++loaded) * 100 / maxPatientCount));
              }
              resolve(patientResource || false);
            }, reject);
          })
        }).then(resolve, reject);
      } else {
        // load patients with filter by encounters if necessary
        let loaded = 0;
        client.resourcesMapFilter(
          `${PATIENT}?_elements=${elements}&${patientConditions}`,
          maxPatientCount, patient => {
          if (!encounterConditions) {
            showNonResultsMsg(`Calculating patients count...${Math.floor(Math.min(maxPatientCount, ++loaded) * 100 / maxPatientCount)}%`);
            return true;
          }
          return new Promise((resolve, reject) => {
            client.getWithCache(`${ENCOUNTER}?_summary=count&${encounterConditions}&subject:Patient=${patient.id}`)
              .then(({data}) => {
                const meetsTheConditions = data.total > 0
                if (meetsTheConditions) {
                  showProgress('Searching patients', Math.floor(Math.min(maxPatientCount, ++loaded) * 100 / maxPatientCount));
                }
                resolve(meetsTheConditions);
              }, reject);
          });
        }).then(resolve, reject);
      }
    }, ({error}) => {
      showNonResultsMsg(`Could not calculate patients/encounters count`);
      console.log(`FHIR search failed: ${error}`);
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

