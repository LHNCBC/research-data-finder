import { HTTP_ABORT } from './common/fhir-batch-query';
import { ObservationTable } from './observation-table';
import { ResourceTabPage } from './resource-tab-page';
import { getFhirClient } from './common/fhir-service';

export class ObservationTabPage extends ResourceTabPage {
  /**
   * Constructor of component
   * @param {Object<Function>} callbacks - callback functions:
   *        addComponentToPage - used to add HTML of the component to the page,
   *        onStartLoading - to be called when resources load starts,
   *        onEndLoading - to be called when resources load ends
   */
  constructor({ callbacks }) {
    super({ resourceType: 'Observation', callbacks });
    this.loincTestsId = this.generateId('loincTests');
    this.testSelId = this.generateId('testSel');
    this.perPatientPerTestId = this.generateId('perPatientPerTestId');
  }

  /**
   * Initializes the section with search parameters for resources selection
   */
  initializeSearchParameters() {
    //TODO is not supported for this component yet
  }

  /**
   * Initializes controls created in getHtml
   */
  attachControls() {
    this.attachCommonControls();

    this.loincAC = new Def.Autocompleter.Search(
      this.loincTestsId,
      'https://clinicaltables.nlm.nih.gov/api/loinc_items/v3/search?type=question',
      { maxSelect: '*', matchListValue: true }
    );

    // Set up propulated values
    var selectedTests = [
      ['Weight', '29463-7'],
      ['Body height Measured', '3137-7'],
      ['Feeling down, depressed, or hopeless?', '44255-8'],
      ['Current smoker', '64234-8']
    ];
    for (var i = 0, len = selectedTests.length; i < len; ++i) {
      var testData = selectedTests[i];
      // TBD -- These APIs are not documented.  We should probably add something to
      // the autocompleter for setting the state of a search list.
      this.loincAC.storeSelectedItem(testData[0], testData[1]);
      this.loincAC.addToSelectedArea(testData[0]);
    }

    this.initializeSearchParameters();
    this.resourceTable = new ObservationTable({
      callbacks: {
        addComponentToPage: (html) => {
          document
            .querySelector(
              `#${this.resourcesAreaId} > .section > .section__body`
            )
            .insertAdjacentHTML('beforeend', html);
        }
      }
    }).initialize();
  }

  /**
   * Removes links to controls created in attachControls and attachEvent
   */
  detachControls() {
    this.loincAC.destroy();
    super.detachControls();
  }

  /**
   * Returns HTML for component
   */
  getHtml() {
    return `
<div class="section">
  <label class="section__title">Observations selection criteria</label>
  <div class="section__body obs-parameters">
    <div id=${this.testSelId}>
      <label for="${this.loincTestsId}">Selected tests:</label>
      <input type=text id=${this.loincTestsId} placeholder="LOINC variables – type and select one or more">
      <span>Note:  A given FHIR server will only have matches for some subset of these values.</span>
    </div>
    
    <div>
      <label for=${this.perPatientPerTestId}>Limit per patient per test:</label>
      <input type=number id=${this.perPatientPerTestId} value=1>
    </div>
  </div>
</div>
<button id=${this.loadButtonId}>Load Observations</button>
<span id=${this.reportLinkId}></span>

<p id=${this.noResourcesAreaId} class="hide"></p>
<div id=${this.resourcesAreaId} class="resources-area hide">
  <div class="section section_sticky">
    <label class="section__title">Selected Observations [<span id=${this.resourcesCountId}>0</span>]</label>
    <div class="section__toolbar">
      <button id=${this.downloadButtonId}>Download (in CSV format)</button>
    </div>

    <div class="section__body" style="overflow-y: auto"></div>
  </div>
</div>`;
  }

  /**
   *  Handles the request to load the Observation list
   */
  loadResources() {
    const fhirClient = getFhirClient();
    const features = fhirClient.getFeatures();
    const patientResources = this.callbacks.getPatientResources();
    const patientAdditionalColumns = this.callbacks.getPatientAdditionalColumns();
    this.reportLinkSpan.innerHTML = '';
    this.callbacks.onStartLoading();
    this.loadResouresButton.disabled = true;

    const perPatientPerTest =
      document.getElementById(this.perPatientPerTestId).value ||
      Number.POSITIVE_INFINITY;

    // test codes instead of categories
    const codes = this.loincAC.getSelectedCodes();

    this.resourceTable.setAdditionalColumns(patientAdditionalColumns);

    const startDate = new Date();
    const patientCount = patientResources.length;
    let completedRequestCount = 0;
    let allObservations = [];
    let hasError = false;
    const urlSuffixes =
      codes && codes.length > 0
        ? codes.map(
            (code) =>
              `&_count=${perPatientPerTest}&code=${encodeURIComponent(code)}`
          )
        : [`&_count=1000`];
    const suffixCount = urlSuffixes.length;
    const totalRequestCount = patientCount * suffixCount;

    let sortFields = 'patient,code';
    if (features.sortObservationsByDate) {
      sortFields += ',-date';
    } else if (features.sortObservationsByAgeAtEvent) {
      sortFields += ',-age-at-event';
    }

    this.loadReporter.initialize();
    this.showLoadingProgress(0);
    let observationsLoaded = this.loadReporter.addMetric({
      name: 'Observation resources loaded'
    });

    for (let i = 0; i < patientCount; ++i) {
      const patient = patientResources[i];

      for (let j = 0; j < suffixCount; ++j) {
        const urlSuffix = urlSuffixes[j],
          index = i * suffixCount + j;

        fhirClient
          .getWithCache(
            `Observation?subject=Patient/${patient.id}` +
              `&_sort=${sortFields}&_elements=subject,effectiveDateTime,code,value,component,interpretation` +
              urlSuffix
          )
          .then(
            ({ data }) => {
              if (!hasError) {
                this.showLoadingProgress(
                  ++completedRequestCount,
                  totalRequestCount
                );
                allObservations[index] = (data.entry || []).map(
                  (item) => item.resource
                );
                observationsLoaded.incrementCount(
                  allObservations[index].length
                );
                if (completedRequestCount === totalRequestCount) {
                  this.loadReporter.finalize();
                  this.reportLinkSpan.innerHTML = `
(<a href="#" onclick="return false;" onkeydown="keydownToClick(event);">loaded data in ${(
                    (new Date() - startDate) /
                    1000
                  ).toFixed(1)} s</a>)`;

                  const observations = [].concat(...allObservations);
                  if (observations.length) {
                    this.resourceTable.fill({
                      data: {
                        patients: patientResources,
                        observations
                      },
                      perPatientPerTest,
                      serviceBaseUrl: fhirClient.getServiceBaseUrl()
                    });
                    this.showListOfResources(observations.length);
                  } else {
                    this.showMessageIfNoResourceList(
                      'No matching Observations found.'
                    );
                  }
                  this.callbacks.onEndLoading();
                  this.loadResouresButton.disabled = false;
                }
              }
            },
            ({ status, error }) => {
              hasError = true;
              if (status !== HTTP_ABORT) {
                fhirClient.clearPendingRequests();
                console.log(`Load Observations failed: ${error}`);
                // Show message if request is not aborted
                this.showMessageIfNoResourceList(
                  'Could not load observation list'
                );
              }
              this.callbacks.onEndLoading();
              this.loadResouresButton.disabled = false;
            }
          );
      }
    }
  }
}
