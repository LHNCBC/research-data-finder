// Bootstrap imports
// TODO: optimize imports https://getbootstrap.com/docs/4.0/getting-started/webpack/#importing-styles ?
import 'bootstrap/dist/css/bootstrap.min.css';

// Imports for webpack to find assets
import '../css/app.css';

// "Real" imports
import './common/polyfills';
import { saveAs } from 'file-saver';
import { FhirBatchQuery, HTTP_ABORT } from './common/fhir-batch-query';
import {
  SearchParameters,
  PatientSearchParameters,
  PATIENT,
  EncounterSearchParameters,
  ObservationSearchParameters,
  ConditionSearchParameters,
  MedicationDispenseSearchParameters
} from './search-parameters';
import {
  toggleCssClass,
  addCssClass,
  removeCssClass,
  capitalize
} from './common/utils';
import { Reporter } from './reporter';
import { PatientTable } from './patient-table';
import { ResourceTabPane } from './resource-tab-pane';
import { getFhirClient } from './common/fhir-service';

const loadPatientsButton = document.getElementById('loadPatients');
const reportPatientsSpan = document.getElementById('reportPatients');

// An instance of report popup component for collecting statistical information about Patient selection
const patientsReporter = new Reporter();
let fhirClient = getFhirClient();

/**
 * Update settings section from fhirClient
 */
function updatesSettingsSection() {
  document.getElementById('fhirServer').value = fhirClient.getServiceBaseUrl();
  ['maxRequestsPerBatch', 'maxActiveRequests'].forEach((inputId) => {
    document.getElementById(inputId).value = fhirClient[
      'get' + capitalize(inputId)
    ]();
  });
}

fhirClient.addChangeEventListener(updatesSettingsSection);

updatesSettingsSection();

let patientSearchParams;

/**
 * Initialize the application on startup, or reinitialize the application
 * when the FHIR REST API Service Base URL changes.
 * @param {string} [serviceBaseUrl] - new FHIR REST API Service Base URL
 *                 (https://www.hl7.org/fhir/http.html#root)
 */
function initApp(serviceBaseUrl) {
  patientSearchParams && patientSearchParams.detachControls();
  fhirClient.initialize(serviceBaseUrl);
  patientSearchParams = createPatientSearchParameters();
  resourceTabPane.clearResourceList(serviceBaseUrl);

  onStartLoading();
  patientSearchParams.ready.then(onEndLoading);
  // Clear visible Patient list data
  showMessageIfNoPatientList('');
  reportPatientsSpan.innerHTML = '';
}

// Add event listeners for settings section
document.getElementById('fhirServer').addEventListener('change', function () {
  initApp(this.value);
});

['maxRequestsPerBatch', 'maxActiveRequests'].forEach((inputId) => {
  document.getElementById(inputId).addEventListener('change', function () {
    const value = +document.getElementById(inputId).value;
    if (value > 0) {
      fhirClient['set' + capitalize(inputId)](value);
    } else {
      document.getElementById(inputId).value = fhirClient[
        'get' + capitalize(inputId)
      ]();
    }
  });
});

document.getElementById('apiKey').addEventListener('change', function () {
  fhirClient.setApiKey(document.getElementById('apiKey').value);
});

/**
 * Handles start of resource list loading
 */
function onStartLoading() {
  // Lock Patients reloading
  loadPatientsButton.disabled = true;
  document.querySelector('#cohortFile').disabled = true;
  document.querySelector('#cohortFilename').tabIndex = -1;

  // Lock Cohort switcher
  [].slice
    .call(document.getElementsByName('cohortOption'))
    .forEach((option) => (option.disabled = true));
}

/**
 * Handles end of resource list loading
 */
function onEndLoading() {
  // Unlock Patients reloading
  loadPatientsButton.disabled = false;
  document.querySelector('#cohortFile').disabled = false;
  document.querySelector('#cohortFilename').tabIndex = 0;

  // Unlock Cohort switcher
  [].slice
    .call(document.getElementsByName('cohortOption'))
    .forEach((option) => (option.disabled = false));
}

// Create component for displaying resources for selected Patients
const resourceTabPane = new ResourceTabPane({
  callbacks: {
    /**
     * Add HTML of the component to the page
     * @param {string} html
     */
    addComponentToPage(html) {
      document
        .querySelector('#patientsArea .section:last-child .section__body')
        .insertAdjacentHTML('beforeend', html);
    },
    onStartLoading,
    onEndLoading
  }
}).initialize();

initApp();

/**
 *  Shows a message when there are no Patient list was displayed
 */
function showMessageIfNoPatientList(msg) {
  const nonResultsMsgElement = document.getElementById('noPatients');
  nonResultsMsgElement.innerText = msg;
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
  resourceTabPane.clearResourceList();
  addCssClass('#patientsArea > .section', 'section_collapsed');
  document.getElementById('patientsCount').innerText = count;
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
 * Shows the report about loading the Patient list
 */
export function showPatientsReport() {
  patientsReporter.show();
}

const patientTable = new PatientTable({
  callbacks: {
    addComponentToPage: (html) => {
      document
        .querySelector('#patientsArea .section__body')
        .insertAdjacentHTML('beforeend', html);
    }
  }
}).initialize();

/**
 * Creates the section with search parameters for patients selection
 *
 * @return {SearchParameters}
 */
function createPatientSearchParameters() {
  return new SearchParameters({
    callbacks: {
      addComponentToPage: (html) => {
        document
          .getElementById('patientSearchParamsAfterThisRow')
          .insertAdjacentHTML('afterend', html);
      }
    },
    searchParamGroups: [
      PatientSearchParameters,
      EncounterSearchParameters,
      ConditionSearchParameters,
      MedicationDispenseSearchParameters,
      ObservationSearchParameters,
      'Account',
      'AdverseEvent',
      'CarePlan',
      'CareTeam',
      'ChargeItem',
      'ClinicalImpression',
      'Communication',
      'CommunicationRequest',
      'DeviceRequest',
      'DeviceUseStatement',
      'DiagnosticReport',
      'DocumentManifest',
      'DocumentReference',
      'Flag',
      'Goal',
      'GuidanceResponse',
      'Invoice',
      'List',
      'MeasureReport',
      'MedicationAdministration',
      'MedicationRequest',
      'MedicationStatement',
      'Procedure',
      'RequestGroup',
      'RiskAssessment',
      'ServiceRequest',
      'ResearchStudy'
    ]
  });
}

// Prevents implicit submission by press Enter in input field
document
  .getElementById('patientCriteriaForm')
  .addEventListener('keydown', function (event) {
    if (
      !(event.target instanceof HTMLTextAreaElement) &&
      !(event.target instanceof HTMLButtonElement) &&
      event.key === 'Enter'
    ) {
      event.preventDefault();
    }
  });

/**
 * Logs error message for screen reader
 */
export function checkPatientCriteria() {
  const form = document.getElementById('patientCriteriaForm');

  if (!form.checkValidity()) {
    const errorMsg =
      'Please correct the invalid fields before loading Patients';
    Def.Autocompleter.screenReaderLog(errorMsg);
  }
}

/**
 * Downloads Patient list data (Cohort).
 */
export function downloadCohort() {
  const blob = new Blob([JSON.stringify(patientTable.getRawData(), null, 2)], {
    type: 'text/json;charset=utf-8',
    endings: 'native'
  });
  saveAs(blob, patientTable.getDefaultFileName());
}

/**
 * Uploads Patient list data (Cohort) on change input[type=file] value.
 * @param {Event} event
 */
export function loadCohort(event) {
  if (event.target.files.length === 1) {
    const reader = new FileReader();
    const filename = event.target.files[0].name;
    reader.onload = (loadEvent) => {
      try {
        const data = JSON.parse(loadEvent.target.result);
        onLoadFile(filename, data);
      } catch (e) {
        showMessageIfNoPatientList('Error: ' + e.message);
      }
    };
    reader.readAsText(event.target.files[0]);
  }
  event.target.value = '';
}

/**
 * Processes uploaded Patient list data (Cohort).
 * @param {string} filename
 * @param {Object} blobData
 */
function onLoadFile(filename, blobData) {
  const error = patientTable.checkBlobData(blobData, {
    serviceBaseUrl: fhirClient.getServiceBaseUrl()
  });
  if (error) {
    throw error;
  }
  const { data, rawCriteria, maxPatientCount, additionalColumns } = blobData;
  document.getElementById('cohortFilename').innerText = `[${filename}]`;

  // Pass Patients data to component to display resources
  resourceTabPane.setContext({
    patientResources: data,
    additionalColumns,
    rawPatientCriteria: rawCriteria
  });
  showListOfPatients(data.length);

  patientSearchParams.setRawCriteria(rawCriteria);
  document.getElementById('maxPatientCount').value = maxPatientCount;
  patientTable.setRawData(blobData);
  showListOfPatients(blobData.data.length);
}

/**
 * Handles switching between "Build Cohort" and "Load Cohort"
 */
export function onChangePatientForm() {
  clearPatients();
  toggleCssClass(
    '#saveCohort',
    'hide',
    !document.getElementById('buildCohortOption').checked
  );
  toggleCssClass(
    '#patientCriteriaForm',
    'hide',
    !document.getElementById('buildCohortOption').checked
  );
  toggleCssClass(
    '#patientLoadForm',
    'hide',
    !document.getElementById('loadCohortOption').checked
  );
}

// On a page reload, the browser sometimes remembers the last setting of a radio
// button group.  Make sure the view matches the selected option.
setTimeout(() => {
  onChangePatientForm();
});

/**
 * Clear Patient list.
 */
function clearPatients() {
  document.getElementById('cohortFilename').innerText = 'choose file...';
  reportPatientsSpan.innerHTML = '';
  showMessageIfNoPatientList('');
}

/**
 * Handles the request to load the Patient list
 */
export function loadPatients() {
  clearPatients();
  onStartLoading();
  patientsReporter.initialize();
  const startDate = new Date();

  patientTable.setAdditionalColumns(patientSearchParams.getColumns());

  const onFinally = () => {
    patientsReporter.finalize();
    onEndLoading();
  };

  const rawCriteria = patientSearchParams.getRawCriteria();
  const maxPatientCount = document.getElementById('maxPatientCount').value;

  getPatients().then(
    (data) => {
      const patientResources = data;

      // Pass Patients data to component to display resources
      resourceTabPane.setContext({
        patientResources,
        additionalColumns: patientSearchParams
          ? patientSearchParams.getColumns()
          : [],
        rawPatientCriteria: rawCriteria
      });

      reportPatientsSpan.innerHTML = `
(<a href="#" onclick="app.showPatientsReport();return false;" onkeydown="keydownToClick(event);">loaded data in ${(
        (new Date() - startDate) /
        1000
      ).toFixed(1)} s</a>)`;
      removeCssClass('#reportPatients', 'hide');

      if (patientResources.length) {
        patientTable.fill({
          data: patientResources,
          rawCriteria,
          maxPatientCount,
          serviceBaseUrl: fhirClient.getServiceBaseUrl()
        });
        showListOfPatients(patientResources.length);
      } else {
        showMessageIfNoPatientList('No matching Patients found.');
      }
      onFinally();
    },
    ({ status, error }) => {
      if (status !== HTTP_ABORT) {
        // Show message if request is not aborted
        showMessageIfNoPatientList(`Could not load Patient list`);
        console.log(`Load Patients failed: ${error}`);
      }
      onFinally();
    }
  );
}

/**
 * Loads list of patients resources using search parameters.
 * @return {Promise<Array>}
 */
function getPatients() {
  const maxPatientCount = document.getElementById('maxPatientCount').value;
  const elements = patientSearchParams
    .getResourceElements(PATIENT, ['name'])
    .join(',');
  const resourceSummaries = patientSearchParams
    .getAllCriteria()
    .filter((item) => item.criteria.length || item.resourceType === PATIENT);

  showPatientProgress('Calculating resources count');

  const numberOfResources =
    resourceSummaries.length > 1
      ? patientsReporter.addMetric({
          name: 'Searches to find the following counts'
        })
      : null;
  return Promise.all(
    resourceSummaries.length > 1
      ? resourceSummaries.map((item) =>
          fhirClient.getWithCache(
            `${item.resourceType}?_total=accurate&_summary=count${item.criteria}`
          )
        )
      : []
  ).then((summaries) => {
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
      });
      numberOfResources.updateCount(summaries.length);
    }

    showPatientProgress('Searching patients', 0);

    if (resourceSummaries[0].total === 0) {
      return [];
    } else {
      let processedPatients = {};
      const firstItem = resourceSummaries.shift();

      if (firstItem.resourceType === 'ResearchStudy') {
        return fhirClient.resourcesMapFilter(
          `${firstItem.resourceType}?_elements=id${firstItem.criteria}`,
          maxPatientCount,
          (researchStudy) => {
            return fhirClient.resourcesMapFilter(
              `ResearchSubject?_elements=individual&study=${researchStudy.id}`,
              maxPatientCount,
              (researchSubject) => {
                const patientId =
                  /^Patient\/(.*)/.test(researchSubject.individual.reference) &&
                  RegExp.$1;
                if (processedPatients[patientId]) {
                  return false;
                }
                processedPatients[patientId] = true;
                return checkPatient(
                  resourceSummaries,
                  elements,
                  maxPatientCount,
                  patientId
                );
              },
              maxPatientCount
            );
          },
          1
        );
      }

      const firstItemElements =
        firstItem.resourceType === PATIENT ? elements : 'subject';

      return fhirClient.resourcesMapFilter(
        `${firstItem.resourceType}?_elements=${firstItemElements}${firstItem.criteria}`,
        maxPatientCount,
        (resource) => {
          let patientResource, patientId;
          if (resource.resourceType === PATIENT) {
            patientResource = resource;
            patientId = patientResource.id;
          } else {
            patientId =
              /^Patient\/(.*)/.test(resource.subject.reference) && RegExp.$1;
          }
          if (processedPatients[patientId]) {
            return false;
          }
          processedPatients[patientId] = true;
          return checkPatient(
            resourceSummaries,
            elements,
            maxPatientCount,
            patientId,
            patientResource
          );
        },
        resourceSummaries.length > 1 ? null : maxPatientCount
      );
    }
  });
}

/**
 * This function called from function getPatients.
 * Checks the patient for the rest of the criteria and returns promise fulfilled
 * with Patient resource data or with false.
 * @param {Array} resourceSummaries - array of Object describes criteria
 *   for each resource
 * @param {string} elements - value of the _element parameter to use
 *   in the query to retrieve Patient data
 * @param {number} maxPatientCount - maximum number of Patients
 * @param {string} patientId - Patient id
 * @param {Object} [patientResource] - Patient resource data
 * @return {Promise<Object|boolean>}
 */
function checkPatient(
  resourceSummaries,
  elements,
  maxPatientCount,
  patientId,
  patientResource
) {
  const patientResourcesLoaded = patientsReporter.addMetric({
    name: 'Patient resources loaded'
  });

  return resourceSummaries
    .reduce(
      (promise, item) =>
        promise.then((result) => {
          if (!result) return result;
          let url;

          if (item.resourceType === PATIENT) {
            url = `${item.resourceType}?_elements=${elements}${item.criteria}&_id=${patientId}`;
          } else if (item.resourceType === 'ResearchStudy') {
            url = `${item.resourceType}?_total=accurate&_summary=count${item.criteria}&_has:ResearchSubject:study:individual=Patient/${patientId}`;
          } else {
            url = `${item.resourceType}?_total=accurate&_summary=count${item.criteria}&subject:Patient=${patientId}`;
          }

          return fhirClient.getWithCache(url).then(({ data }) => {
            const meetsTheConditions = data.total > 0;
            const resource =
              data.entry && data.entry[0] && data.entry[0].resource;
            if (resource && resource.resourceType === PATIENT) {
              patientResource = resource;
            }

            return meetsTheConditions && patientResource
              ? patientResource
              : meetsTheConditions;
          });
        }),
      Promise.resolve(patientResource ? patientResource : true)
    )
    .then((result) => {
      if (result) {
        patientResourcesLoaded.incrementCount();
        showPatientProgress(
          'Searching patients',
          Math.floor(
            (Math.min(maxPatientCount, patientResourcesLoaded.getCount()) *
              100) /
              maxPatientCount
          )
        );
      }
      return result;
    });
}

export function clearCache() {
  FhirBatchQuery.clearCache();
}
