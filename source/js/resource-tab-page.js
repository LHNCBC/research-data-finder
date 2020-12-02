import { HTTP_ABORT } from './common/fhir-batch-query';
import { Reporter } from './reporter';
import { saveAs } from 'file-saver';
import { ResourceTable } from './resource-table';
import { addCssClass, capitalize, removeCssClass } from './common/utils';
import { BaseComponent } from './common/base-component';
import {
  EncounterSearchParameters,
  SearchParameters
} from './search-parameters';
import { ColumnsDialog } from './common/columns-dialog';
import { getCurrentDefinitions } from './search-parameters/common-descriptions';

export class ResourceTabPage extends BaseComponent {
  /**
   * Constructor of component
   * @param {string} resourceType
   * @param {Object<Function>} callbacks - callback functions:
   *        getFhirClient - to retrieve FHIR client,
   *        addComponentToPage - used to add HTML of the component to the page,
   *        onStartLoading - to be called when resources load starts,
   *        onEndLoading - to be called when resources load ends
   */
  constructor({ resourceType, callbacks }) {
    super({ callbacks });
    this.resourceType = resourceType;
    this.columnsStorageKey = resourceType + '-columns';

    this.loadButtonId = this.generateId('loadBtn');
    this.reportLinkId = this.generateId('reportLink');
    this.noResourcesAreaId = this.generateId('noResourcesArea');
    this.resourcesAreaId = this.generateId('resourcesArea');
    this.resourcesCountId = this.generateId('resourcesCount');
    this.downloadButtonId = this.generateId('downloadBtn');
    this.columnsButtonId = this.generateId('columnsBtn');
    this.searchParametersAnchorId = this.generateId('searchParamatersAchor');
  }

  /**
   * Initializes the resource selection criteria section
   */
  initializeSearchParameters(serviceBaseUrl) {
    this.searchParams && this.searchParams.detachControls();

    const searchParamGroups = [
      {
        Encounter: EncounterSearchParameters
      }[this.resourceType] || this.resourceType
    ];

    this.searchParams = new SearchParameters({
      callbacks: {
        addComponentToPage: (html) => {
          document
            .getElementById(this.searchParametersAnchorId)
            .insertAdjacentHTML('afterend', html);
        }
      },
      serviceBaseUrl,
      searchParamGroups
    });
    this.updateCriteria();

    this.columnsDialog = new ColumnsDialog({
      columns: this.getColumns(),
      callbacks: {
        updateColumns: () => {
          // Save visible column names in localStorage
          window.localStorage.setItem(
            this.columnsStorageKey,
            this.getVisibleColumns()
              .map((column) => column.name)
              .join(',')
          );
        }
      }
    });
  }

  /**
   * Returns an array of available column descriptions for this.resourceType.
   * @return {Array<ColumnDescription>} - see JSDoc typedef in columns-dialog.js
   */
  getColumns() {
    if (!this._columns) {
      const currentDefinitions = getCurrentDefinitions();
      const searchParameters = currentDefinitions.resources[this.resourceType];
      const visibleColumnsRawString = window.localStorage.getItem(
        this.columnsStorageKey
      );
      const visibleColumnNames = visibleColumnsRawString
        ? visibleColumnsRawString.split(',')
        : [];

      this._columns = searchParameters.map((param) => {
        const name = capitalize(param.name).replace(/-/g, ' ');
        const [, ...path] = param.path.split('.');
        return {
          name,
          path,
          visible: visibleColumnNames.indexOf(name) !== -1
        };
      });
    }

    return this._columns;
  }

  /**
   * Returns an array of visible column descriptions.
   * See getColumns method documentation for details.
   * @return {Array<ColumnDescription>} - see JSDoc typedef in columns-dialog.js
   */
  getVisibleColumns() {
    return this.getColumns().filter((column) => column.visible);
  }

  /**
   * Returns array of elements for request resources.
   * See https://www.hl7.org/fhir/search.html#elements
   * @return {Array<string>}
   */
  getElements() {
    return this.getVisibleColumns().map((column) => column.path[0]);
  }

  /**
   * Updates resource selection criteria from the Patient selection criteria
   */
  updateCriteria() {
    if (this.searchParams) {
      // Disable load resources until criteria not ready
      this.loadResouresButton.disabled = true;
      this.searchParams.ready.then(() => {
        this.searchParams.setRawCriteria(this.callbacks.getRawCriteria());
        this.loadResouresButton.disabled = false;
      });
    }
  }

  /**
   * Common initialization part for ResourceTabPage and descendants
   */
  attachCommonControls() {
    this.loadResouresButton = document.getElementById(this.loadButtonId);
    this.attachEvent(this.loadResouresButton, 'click', () =>
      this.loadResources()
    );

    // An instance of report popup component for collecting statistical information about Observation selection
    this.loadReporter = new Reporter();
    this.reportLinkSpan = document.getElementById(this.reportLinkId);
    this.attachEvent(this.reportLinkSpan, 'click', (event) => {
      if (event.target instanceof HTMLAnchorElement) {
        // Shows the report of loading the Observation list
        this.loadReporter.show();
      }
    });

    this.downloadButton = document.getElementById(this.downloadButtonId);

    this.attachEvent(this.downloadButton, 'click', () => {
      // Handles the request to download the observations.
      saveAs(
        this.resourceTable.getBlob(),
        this.resourceType.toLowerCase() + 's.csv'
      );
    });
  }

  /**
   * Initializes controls created in getHtml
   */
  attachControls() {
    this.attachCommonControls();

    this.attachEvent(
      document.getElementById(this.columnsButtonId),
      'click',
      () => {
        this.columnsDialog.open();
      }
    );

    this.initializeSearchParameters(
      this.callbacks.getFhirClient().getServiceBaseUrl()
    );
    this.resourceTable = new ResourceTable({
      callbacks: {
        /**
         * Add HTML of the component to the page
         * @param {string} html
         */
        addComponentToPage: (html) => {
          document
            .querySelector(
              `#${this.resourcesAreaId} > .section > .section__body`
            )
            .insertAdjacentHTML('beforeend', html);
        },
        /**
         * Returns an array of column descriptions to be displayed
         * if data exists for those columns
         * @return {Array<ColumnDescription>} - see JSDoc typedef in columns-dialog.js
         */
        getColumnsToDisplay: () => {
          const visibleColumns = this.getVisibleColumns();
          // If no columns are selected, the default columns will be loaded
          // and we will try to display every possible column
          return visibleColumns.length ? visibleColumns : this.getColumns();
        }
      },
      resourceType: this.resourceType
    }).initialize();
  }

  /**
   * Removes links to controls created in attachControls and attachEvent
   */
  detachControls() {
    super.detachControls();
  }

  /**
   * Returns HTML for component
   * @return {string}
   */
  getHtml() {
    const title = capitalize(this.resourceType) + 's';

    return `
<div class="section">
  <label class="section__title">${title} selection criteria</label>
  <div class="section__body">
    <div id="${this.searchParametersAnchorId}" class="hide"></div>
  </div>
</div>
<button id=${this.columnsButtonId} type="button">
  Select columns to load
</button>
<button id=${this.loadButtonId}>Load ${title}</button>
<span id=${this.reportLinkId}></span>

<p id=${this.noResourcesAreaId} class="hide"></p>
<div id=${this.resourcesAreaId} class="hide">
  <div class="section">
    <label class="section__title">Selected ${title} [<span id=${this.resourcesCountId}>0</span>]</label>
    <div class="section__toolbar">
      <button id=${this.downloadButtonId}>Download (in CSV format)</button>
    </div>

    <div class="section__body" style="overflow-y: auto">
    </div>
  </div>
</div>`;
  }

  /**
   * Shows the current progress of loading the resources list
   * @param {number} completedRequestCount
   * @param {number} [totalRequestCount] is not mandatory if completedRequestCount is 0
   */
  showLoadingProgress(completedRequestCount, totalRequestCount) {
    const percent = completedRequestCount
      ? Math.floor((completedRequestCount * 100) / totalRequestCount)
      : 0;
    const message = `Loading ${this.resourceType}s`;
    this.showMessageIfNoResourceList(`${message}... ${percent}%`);
    this.loadReporter.setProgress(message + '...', percent);
  }

  /**
   *  Shows a message when there are no resource list was displayed
   */
  showMessageIfNoResourceList(msg) {
    const nonResultsMsgElement = document.getElementById(
      this.noResourcesAreaId
    );
    nonResultsMsgElement.innerText = msg;
    removeCssClass('#' + this.noResourcesAreaId, 'hide');
    addCssClass('#' + this.resourcesAreaId, 'hide');
  }

  /**
   * Shows the resource list area and updates the number of resources in the area header
   * @param {number} count - number of Observations
   */
  showListOfResources(count) {
    addCssClass('#' + this.noResourcesAreaId, 'hide');
    removeCssClass('#' + this.resourcesAreaId, 'hide');
    removeCssClass(
      document.querySelector(`#${this.resourcesAreaId} > .section`),
      'section_collapsed'
    );
    document.getElementById(this.resourcesCountId).innerText = count;
  }

  /**
   *  Handles the request to load the Resource list
   */
  loadResources() {
    const fhirClient = this.callbacks.getFhirClient();
    const patientResources = this.callbacks.getPatientResources();
    this.reportLinkSpan.innerHTML = '';
    this.callbacks.onStartLoading();
    this.loadResouresButton.disabled = true;

    const startDate = new Date();
    const patientCount = patientResources.length;
    let completedRequestCount = 0;
    let bundles = [];
    let hasError = false;
    const totalRequestCount = patientCount;

    this.loadReporter.initialize();
    this.showLoadingProgress(0);
    let resourcesLoaded = this.loadReporter.addMetric({
      name: this.resourceType + ' resources loaded'
    });

    const criteria = this.searchParams
      .getCriteriaFor(this.resourceType)
      .join('');
    const elements = this.getElements();
    const elementsParam =
      elements.length > 0 ? '&_elements=' + elements.join(',') : '';

    for (let index = 0; index < patientCount; ++index) {
      const patient = patientResources[index];

      fhirClient
        .getWithCache(
          `${this.resourceType}?subject=Patient/${patient.id}` +
            elementsParam +
            `&_sort=subject${criteria}`
        )
        .then(
          ({ data }) => {
            if (!hasError) {
              this.showLoadingProgress(
                ++completedRequestCount,
                totalRequestCount
              );
              bundles[index] = data;
              resourcesLoaded.incrementCount(
                (bundles[index].entry || []).length
              );
              if (completedRequestCount === totalRequestCount) {
                this.loadReporter.finalize();
                this.reportLinkSpan.innerHTML = `
(<a href="#" onclick="return false;" onkeydown="keydownToClick(event);">loaded data in ${(
                  (new Date() - startDate) /
                  1000
                ).toFixed(1)} s</a>)`;

                const resourcesCount = resourcesLoaded.getCount();
                if (resourcesCount) {
                  this.resourceTable.fill({
                    data: {
                      patients: patientResources,
                      bundles
                    },
                    serviceBaseUrl: fhirClient.getServiceBaseUrl()
                  });
                  this.showListOfResources(resourcesCount);
                } else {
                  this.showMessageIfNoResourceList(
                    `No matching ${this.resourceType}s found.`
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
              console.log(`Load ${this.resourceType}s failed: ${error}`);
              // Show message if request is not aborted
              this.showMessageIfNoResourceList(
                `Could not load ${this.resourceType} list`
              );
            }
            this.callbacks.onEndLoading();
            this.loadResouresButton.disabled = false;
          }
        );
    }
  }

  /**
   * Clear resource list & initialize resource selection criteria
   */
  clearResourceList(serviceBaseUrl) {
    addCssClass('#' + this.noResourcesAreaId, 'hide');
    addCssClass('#' + this.resourcesAreaId, 'hide');
    this.reportLinkSpan.innerHTML = '';
    if (serviceBaseUrl) {
      this.initializeSearchParameters(serviceBaseUrl);
    } else {
      this.updateCriteria();
    }
  }
}
