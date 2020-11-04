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
import { toggleCssClass, addCssClass, removeCssClass } from './common/utils';
import { Reporter } from './reporter';
import { PatientTable } from './patient-table';
import { ResourceTabPane } from './resource-tab-pane';

const loadPatientsButton = document.getElementById('loadPatients');
const reportPatientsSpan = document.getElementById('reportPatients');

if (/[?&]tunable(&|$)/.test(window.location.search)) {
  removeCssClass('.performance-tuning', 'hide');
}

// An instance of report popup component for collecting statistical information about Patient selection
const patientsReporter = new Reporter();
let fhirClient = getFhirClient();
let patientSearchParams = createPatientSearchParameters(
  document.getElementById('fhirServer').value
);
document.getElementById('fhirServer').addEventListener('change', function () {
  patientSearchParams && patientSearchParams.detachControls();
  patientSearchParams = createPatientSearchParameters(this.value);
  resourceTabPane.clearResourceList(this.value);

  onStartLoading();
  patientSearchParams.ready.then(onEndLoading);
  // Clear visible Patient list data
  showMessageIfNoPatientList('');
  reportPatientsSpan.innerHTML = '';
  fhirClient.clearPendingRequests();
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
    // Gets FHIR client to make requests
    getFhirClient: () => {
      return fhirClient;
    },
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
 * Gets an instance of FhirBatchQuery used to query data for Patient/Observation list
 * @return {FhirBatchQuery}
 */
function getFhirClient() {
  const serviceBaseUrl = document.getElementById('fhirServer').value;
  const maxRequestsPerBatch =
    document.getElementById('maxRequestsPerBatch').value || undefined;
  const maxActiveRequests =
    document.getElementById('maxActiveRequests').value || undefined;
  return new FhirBatchQuery({
    serviceBaseUrl,
    maxRequestsPerBatch,
    maxActiveRequests
  });
}

/**
 * Creates the section with search parameters for patients selection
 *
 * @return {SearchParameters}
 */
function createPatientSearchParameters(serviceBaseUrl) {
  return new SearchParameters({
    callbacks: {
      addComponentToPage: (html) => {
        document
          .getElementById('patientSearchParamsAfterThisRow')
          .insertAdjacentHTML('afterend', html);
      }
    },
    serviceBaseUrl,
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
      'ServiceRequest'
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
  const blob = new Blob([JSON.stringify(patientTable.getBlobData(), null, 2)], {
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
  const { data, additionalColumns } = blobData;
  document.getElementById('cohortFilename').innerText = `[${filename}]`;

  // Pass Patients data to component to display resources
  resourceTabPane.setPatientResources(data);
  resourceTabPane.setPatientAdditionalColumns(additionalColumns);
  showListOfPatients(data.length);

  patientTable.setBlobData(blobData);
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
  fhirClient = getFhirClient();
  clearPatients();
  onStartLoading();
  patientsReporter.initialize();
  const startDate = new Date();

  patientTable.setAdditionalColumns(patientSearchParams.getColumns());

  const onFinally = () => {
    patientsReporter.finalize();
    onEndLoading();
  };

  getPatients().then(
    (data) => {
      const patientResources = data;

      // Pass Patients data to component to display resources
      resourceTabPane.setPatientResources(data);
      resourceTabPane.setPatientAdditionalColumns(
        patientSearchParams ? patientSearchParams.getColumns() : []
      );

      reportPatientsSpan.innerHTML = `
(<a href="#" onclick="app.showPatientsReport();return false;" onkeydown="keydownToClick(event);">loaded data in ${(
        (new Date() - startDate) /
        1000
      ).toFixed(1)} s</a>)`;
      removeCssClass('#reportPatients', 'hide');

      if (patientResources.length) {
        patientTable.fill({
          data: patientResources,
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
    const patientResourcesLoaded = patientsReporter.addMetric({
      name: 'Patient resources loaded'
    });

    if (resourceSummaries[0].total === 0) {
      return [];
    } else {
      let checked = 0;
      let processedPatients = {};
      // Processing resources, the number of which is less than the number of Patients.
      // (Retrieve patient identifiers corresponding to resources whose number is less than the number of Patients)
      const firstItem = resourceSummaries.shift();
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
          return resourceSummaries
            .reduce(
              (promise, item) =>
                promise.then((result) => {
                  if (!result) return result;
                  const params =
                    item.resourceType === PATIENT
                      ? `_elements=${elements}${item.criteria}&_id=${patientId}`
                      : `_total=accurate&_summary=count${item.criteria}&subject:Patient=${patientId}`;

                  return fhirClient
                    .getWithCache(`${item.resourceType}?${params}`)
                    .then(({ data }) => {
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
                patientResourcesLoaded.updateCount(++checked);
                showPatientProgress(
                  'Searching patients',
                  Math.floor(
                    (Math.min(maxPatientCount, checked) * 100) / maxPatientCount
                  )
                );
              }
              return result;
            });
        },
        resourceSummaries.length > 1 ? null : maxPatientCount
      );
    }
  });
}

export function clearCache() {
  FhirBatchQuery.clearCache();
}
