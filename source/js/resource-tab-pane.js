import { BaseComponent } from './common/base-component';
import { ResourceTabPage } from './resource-tab-page';
import { initCollapsibleSections } from './common/collapsable-sections';
import { toggleCssClass } from './common/utils';
import 'bootstrap/js/src/dropdown';
import Tab from 'bootstrap/js/src/tab';
import { ObservationTabPage } from './observation-tab-page';

/**
 * Component for displaying resource tabs
 */
export class ResourceTabPane extends BaseComponent {
  /**
   * Constructor
   * @param {Object} callbacks - callback functions
   * @param {Function} callbacks.getFhirClient - to retrieve FHIR client
   * @param {Function} callbacks.addComponentToPage - used to add HTML of the
   *                   component to the page
   * @param {Function} callbacks.onStartLoading - to be called when resources
   *                   load starts
   * @param {Function} callbacks.onEndLoading - to be called when resources
   *                   load ends
   */
  constructor({ callbacks }) {
    super({ callbacks });
    this._addBtnId = this.generateId('add-btn');
    this._resourceComponents = [];
  }

  /**
   * Initializes the component
   * @return {BaseComponent}
   */
  initialize() {
    super.initialize();
    this.addTab('Observation');

    return this;
  }

  /**
   * Initializes controls created in getHtml
   */
  attachControls() {
    this.attachEvent(
      document.querySelector(`#${this._addBtnId} .dropdown-menu`),
      'click',
      (event) => {
        const resourceType = event.target.getAttribute('data-value');
        if (resourceType) {
          this.addTab(resourceType);
          event.preventDefault();
        }
      }
    );
  }

  /**
   * Returns HTML for component
   * @return {string}
   */
  getHtml() {
    // This array of resource types is currently created manually for flexibility reasons
    // but it could be generated from getCurrentDefinitions().resources
    const resourceTypes = [
      'Account',
      'AdverseEvent',
      'CarePlan',
      'CareTeam',
      'ChargeItem',
      'ClinicalImpression',
      'Communication',
      'CommunicationRequest',
      'Condition',
      'DeviceRequest',
      'DeviceUseStatement',
      'DiagnosticReport',
      'DocumentManifest',
      'DocumentReference',
      'Encounter',
      'Flag',
      'Goal',
      'GuidanceResponse',
      'Invoice',
      'List',
      'MeasureReport',
      'MedicationAdministration',
      'MedicationDispense',
      'MedicationRequest',
      'MedicationStatement',
      'Observation',
      'Procedure',
      'RequestGroup',
      'RiskAssessment',
      'ServiceRequest'
    ];
    const menuItems = resourceTypes
      .map(
        (resourceType) =>
          `<a class="dropdown-item" data-value="${resourceType}" href="#">${resourceType}</a>`
      )
      .join('');

    return `
<div id="${this._id}" class="tabs-component">
  
  <ul class="nav nav-tabs" role="tablist">
    <li id="${this._addBtnId}" class="nav-item dropdown">
      <a class="nav-link nav-link_only-image" data-toggle="dropdown" href="#" role="button" aria-haspopup="true" aria-expanded="false">
        <i class="add-icon"></i>
      </a>
      <div class="dropdown-menu">
        ${menuItems} 
      </div>
    </li>
  </ul>
  <div class="tab-content"></div>
  <div class="no-tab-content">
    Click on plus button to add resource
  </div>  
</div>`;
  }

  /**
   * Stores patient resources.
   * This data passes to ResourceTabPage via callback getPatientResources.
   * @param {Array} resources
   */
  setPatientResources(resources) {
    this.patientResources = resources;
  }

  /**
   * Stores additional columns for Patient.
   * This data passes to ResourceTabPage via callback getPatientAdditionalColumns.
   * @param {Array<string>} additionalColumns
   */
  setPatientAdditionalColumns(additionalColumns) {
    this._patientAdditionalColumns = additionalColumns;
  }

  /**
   * Clear resource list
   * @param {string} serviceBaseUrl - the Service Base URL of the FHIR server
   *        from which data is being pulled
   */
  clearResourceList(serviceBaseUrl) {
    this._resourceComponents.forEach((comp) =>
      comp.clearResourceList(serviceBaseUrl)
    );
  }

  /**
   * Updates the dropdown menu to select resource types
   * when adding or removing a tab for a resource type
   * @param {string} resourceType
   */
  updateDropdownMenu(resourceType) {
    toggleCssClass(
      `#${this._addBtnId} .dropdown-item[data-value='${resourceType}']`,
      'hide'
    );
    toggleCssClass(
      '#' + this._addBtnId,
      'hide',
      !document.querySelectorAll(`#${this._addBtnId} .dropdown-item:not(.hide)`)
        .length > 0
    );
  }

  /**
   * Adds new tab page for the specified resource type
   * @param {string} resourceType
   */
  addTab(resourceType) {
    const uniqTabId = this.generateUniqueId('tab');
    const tabButtonId = uniqTabId + '-button';
    const tabContentId = uniqTabId + '-content';

    this.updateDropdownMenu(resourceType);

    document.getElementById(this._addBtnId).insertAdjacentHTML(
      'beforebegin',
      `
<li class="nav-item">
  <a class="nav-link tab-link" id="${tabButtonId}" data-toggle="tab" href="#${tabContentId}" role="tab" aria-controls="${tabContentId}" aria-selected="true">
    <i class="remove-icon"></i>${resourceType}</a>
</li>`
    );

    document
      .querySelector(`#${this._id} .tab-content`)
      .insertAdjacentHTML(
        'beforeend',
        `<div class="tab-pane" id="${tabContentId}" role="tabpanel" aria-labelledby="${tabButtonId}"></div>`
      );

    const newResourceTabPage = new (resourceType === 'Observation'
      ? ObservationTabPage
      : ResourceTabPage)({
      resourceType,
      callbacks: {
        ...this.callbacks,
        addComponentToPage: (html) => {
          document
            .querySelector(`#${tabContentId}`)
            .insertAdjacentHTML('beforeend', html);
        },
        getPatientResources: () => {
          return this.patientResources;
        },
        getPatientAdditionalColumns: () => {
          return this._patientAdditionalColumns;
        }
      }
    });

    this._resourceComponents.push(newResourceTabPage.initialize());

    const removeTab = this.createDetachFn(() => {
      this.removeTab(tabButtonId, tabContentId, newResourceTabPage);
    });
    const removeDomListenerFn = this.attachEvent(
      document.querySelector(`#${tabButtonId} i`),
      'click',
      () => {
        removeDomListenerFn();
        removeTab();
      }
    );

    new Tab(document.getElementById(tabButtonId)).show();

    this.updateCssClasses();

    // Adds the ability to collapse for each section
    initCollapsibleSections();
  }

  /**
   * Removes tab page
   * @param {string} tabButtonId - HTMLElement identifier for tab button
   * @param {string} tabContentId - HTMLElement identifier for tab content
   * @param {ResourceTabPage} resourceComponent
   */
  removeTab(tabButtonId, tabContentId, resourceComponent) {
    const tabButton = document.getElementById(tabButtonId);
    const tabContent = document.getElementById(tabContentId);

    this.updateDropdownMenu(resourceComponent.resourceType);

    resourceComponent.detachControls();

    const resourceIndex = this._resourceComponents.indexOf(resourceComponent);
    if (resourceIndex !== -1) {
      this._resourceComponents.splice(resourceIndex, 1);
    }

    if (/\bactive\b/.test(tabButton.className)) {
      const allTabButtons = [].slice.call(
        document.querySelectorAll(`#${this._id} .tab-link`)
      );
      let currentIndex = allTabButtons.indexOf(tabButton);
      if (currentIndex < allTabButtons.length - 1) {
        Tab.getInstance(allTabButtons[currentIndex + 1]).show();
      } else if (currentIndex > 0) {
        Tab.getInstance(allTabButtons[currentIndex - 1]).show();
      }
    }

    Tab.getInstance(document.getElementById(tabButtonId)).dispose();

    [tabButton, tabContent].forEach((el) => {
      el.parentNode.removeChild(el);
    });

    this.updateCssClasses();
  }

  /**
   * Updates CSS classes for the root element of the component
   */
  updateCssClasses() {
    toggleCssClass(
      '#' + this._id,
      'last-tab',
      document.querySelectorAll(`#${this._id} .tab-link`).length === 1
    );
  }
}
