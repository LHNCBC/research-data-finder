import { getAutocompleterById } from '../common/utils';
import { setFhirServerForSearchParameters } from './common-descriptions';

export class SearchParameters {
  /**
   * Inserts the component after table row selected by anchorSelector
   * @param {string} anchorSelector
   * @param {string} serviceBaseUrl - FHIR REST API Service Base URL (https://www.hl7.org/fhir/http.html#root)
   * @param {Object[]} searchParamGroups Array of objects describing the search parameters
   *                   (see patient-search-parameters.js for an example object)
   */
  constructor(anchorSelector, serviceBaseUrl, searchParamGroups) {
    this.initialize = setFhirServerForSearchParameters(serviceBaseUrl).then(() => {
      this.internalId = 'searchParam';
      this.availableParams = {};
      this.searchParams = searchParamGroups.reduce((_searchParams, searchParamGroupFactory) => {
        const searchParamGroup = searchParamGroupFactory();
        _searchParams[searchParamGroup.resourceType] = searchParamGroup;
        this.availableParams[searchParamGroup.resourceType] = Object.keys(searchParamGroup.description).sort();
        return _searchParams;
      }, {});
      this.buttonId = this.internalId + '_add_button';
      this.item_prefix = this.internalId + '_param_';
      this.item_generator = 0;
      this.selectedParams = {};
      this.selectedResources = {};

      this.addButton(anchorSelector);

      Def.Autocompleter.Event.observeListSelections(null, (eventData) => {
        const inputId = eventData.field_id;
        const searchItemIdFromResourceSelectorId = this.getSearchItemIdFromResourceSelectorId(inputId)
        const isResourceChanged = !!searchItemIdFromResourceSelectorId;
        const searchItemId = searchItemIdFromResourceSelectorId || this.selectedParams[inputId] && inputId;

        if (searchItemId) {
          const autocomplete = getAutocompleterById(inputId);
          const newValue = eventData.final_val;
          const prevValue = isResourceChanged ? this.selectedResources[searchItemId] : this.selectedParams[searchItemId];
          if (eventData.on_list) {
            if (newValue !== prevValue) {
              const newResourceType = isResourceChanged ? newValue : this.selectedResources[searchItemId];
              const newSelectedParam = isResourceChanged ? this.availableParams[newValue][0] : newValue;
              const prevResourceType = this.selectedResources[searchItemId];
              const prevSelectedParam = this.selectedParams[searchItemId];

              this.removeControlsForSearchParam(searchItemId);
              this.selectedParams[searchItemId] = newSelectedParam;
              this.selectedResources[searchItemId] = newResourceType;
              this.createControlsForSearchParam(searchItemId);
              this.swapAvailableItem(newResourceType, newSelectedParam, prevResourceType, prevSelectedParam);
              if (isResourceChanged) {
                getAutocompleterById(searchItemId).setFieldToListValue(newSelectedParam);
              }
              this.updateAllSearchParamSelectors(searchItemId, isResourceChanged);
            }
          } else {
            // Restore the previous value if the user hasn't finally selected the correct value
            if (!newValue) {
              autocomplete.setFieldToListValue(prevValue);
            }
          }
        }
      });
    }, e => {
      alert(e.error);
      return Promise.reject(e);
    });
  }

  /**
   * Removes all controls and related data
   */
  dispose() {
    const addBtn = document.getElementById(this.buttonId);
    if (addBtn) {
      addBtn.parentElement.removeChild(addBtn);
      Object.keys(this.selectedParams, searchItemId => this.removeParam(searchItemId))
    }
  }

  /**
   * Generates an identifier for a table row
   * from a generic identifier for a search parameter
   * @param {string} searchItemId
   * @return {string}
   */
  getParamRowId(searchItemId) {
    return searchItemId + '_row';
  }

  /**
   * Gets an identifier for a search parameter
   * from an identifier for a table row
   * @param {string} id
   * @return {string}
   */
  getSearchItemFromRowId(id) {
    return /^(.*)_row$/.test(id) && this.selectedResources[RegExp.$1] && RegExp.$1;
  }

  /**
   * Generates an identifier for an autocomleter is used for select resource type
   * from a generic identifier for a search parameter
   * @param {string} searchItemId
   * @return {string}
   */
  getParamResourceSelectorId(searchItemId) {
    return searchItemId + '_resource';
  }

  /**
   * Gets an identifier for a search parameter
   * from an identifier for an autocompleter is used for select resource type
   * @param {string} id
   * @return {string}
   */
  getSearchItemIdFromResourceSelectorId(id) {
    return /^(.*)_resource$/.test(id) && this.selectedResources[RegExp.$1] && RegExp.$1;
  }

  /**
   * Generates an identifier for a table cell that is used for search parameter controls
   * from a generic identifier for a search parameter
   * @param {string} searchItemId
   * @return {string}
   */
  getParamContentId(searchItemId) {
    return searchItemId + '_content';
  }

  /**
   * Generates an identifier for a remove button for search parameter
   * from a generic identifier for a search parameter
   * @param {string} searchItemId
   * @return {string}
   */
  getRemoveButtonId(searchItemId) {
    return searchItemId + '_remove_btn';
  }

  /**
   * Creates controls for search parameter
   * @param {string} searchItemId a generic identifier for a search parameter
   */
  createControlsForSearchParam(searchItemId) {
    const element = document.getElementById(this.getParamContentId(searchItemId));
    const searchParamCtrl = this.searchParams[this.selectedResources[searchItemId]].description[this.selectedParams[searchItemId]];

    element.innerHTML = searchParamCtrl.getControlsHtml(searchItemId);
    searchParamCtrl.attachControls && searchParamCtrl.attachControls(searchItemId);
  }

  /**
   * Removes controls for search parameter
   * @param {string} searchItemId a generic identifier for a search parameter
   */
  removeControlsForSearchParam(searchItemId) {
    const element = document.getElementById(this.getParamContentId(searchItemId));
    const searchParamCtrl = this.searchParams[this.selectedResources[searchItemId]].description[this.selectedParams[searchItemId]];

    searchParamCtrl.detachControls && searchParamCtrl.detachControls(searchItemId);
    element.innerHTML = '';
  }

  /**
   * Replace unavailableItem with availableItem in array of available search parameters
   * @param {string} unavailableResourceType resource type for no longer available param
   * @param {string} unavailableParamName no longer available param
   * @param {string} availableResourceType resource type for new available item
   * @param {string} availableParamName new available item
   */
  swapAvailableItem(unavailableResourceType, unavailableParamName, availableResourceType, availableParamName) {
    const index = this.availableParams[unavailableResourceType].indexOf(unavailableParamName);
    this.availableParams[unavailableResourceType].splice(index, 1);
    this.availableParams[availableResourceType].push(availableParamName);
    this.availableParams[availableResourceType].sort();
  }

  /**
   * Push new available item to array of available search parameters
   * @param {string} resourceType
   * @param {string} paramName
   */
  freeAvailableItem(resourceType, paramName) {
    this.availableParams[resourceType].push(paramName);
    this.availableParams[resourceType].sort();
  }

  /**
   * Updates each autocompteter used to select a search parameter for all added search parameter rows
   * @param {string} [skipSearchItemId] generic identifier of the search parameter to skip update
   * @param {boolean} [isResourceChanged]
   */
  updateAllSearchParamSelectors(skipSearchItemId, isResourceChanged) {
    Object.keys(this.selectedParams).forEach((key) => {
      if (isResourceChanged || key !== skipSearchItemId) {
        const paramResourceType = this.selectedResources[key];
        const paramName = this.selectedParams[key];

        getAutocompleterById(key).setList([paramName].concat(this.availableParams[paramResourceType]));
        if (key !== skipSearchItemId) {
          getAutocompleterById(this.getParamResourceSelectorId(key)).setList(this.getAvailableResourceTypes(paramResourceType));
        }
      }
    });
  }

  /**
   * Returns current available resource types to select a search parameter
   * @param {String} [firstResourceType] - this string will be first in result array if specified
   * @return {String[]}
   */
  getAvailableResourceTypes(firstResourceType) {
    const resourceTypes = Object.keys(this.availableParams)
      .filter(resourceType => this.availableParams[resourceType].length && resourceType !== firstResourceType);
    return (firstResourceType ? [firstResourceType] : []).concat(resourceTypes.sort());
  }

  /**
   * Adds a button to add search parameters
   * @param {string} anchorSelector table row selector after which a row with a button will be added
   */
  addButton(anchorSelector) {
    const anchorElement = document.querySelector(anchorSelector);

    anchorElement.insertAdjacentHTML('afterend', `\
<div id="${this.internalId}">
  <button id="${this.buttonId}" class="add-search-param-button">Add a search criterion</button>
</div>`);
    document.getElementById(this.buttonId).onclick = (() => this.addParam());
  }

  /**
   * Adds a new row with search parameter to the table of search parameters
   */
  addParam() {
    // searchItemId is the unique virtual identifier of the controls group for each search parameter.
    // Used as part of HTML element identifiers and for storing data associated with a search parameter.
    const searchItemId = this.item_prefix+(++this.item_generator);
    const paramResourceTypeSelectorId = this.getParamResourceSelectorId(searchItemId);
    const rowId = this.getParamRowId(searchItemId);
    const searchItemContentId = this.getParamContentId(searchItemId);
    const removeButtonId = this.getRemoveButtonId(searchItemId);
    const prevElement = document.getElementById(this.internalId).previousElementSibling;
    const prevResourceTypeSelector = prevElement
      ? document.getElementById(this.getParamResourceSelectorId(this.getSearchItemFromRowId(prevElement.id)))
      : null;
    const availableResourceType = this.getAvailableResourceTypes();
    const paramResourceType = prevResourceTypeSelector && availableResourceType.indexOf(prevResourceTypeSelector).value !== -1
      ? prevResourceTypeSelector.value
      : this.getAvailableResourceTypes()[0];
    const paramName = this.availableParams[paramResourceType].shift();

    this.selectedParams[searchItemId] = paramName;
    this.selectedResources[searchItemId] = paramResourceType;

    document.getElementById(this.internalId).insertAdjacentHTML('beforebegin', `\
<div id="${rowId}" class="search-parameter">
  <input type="text" id="${paramResourceTypeSelectorId}" value="${paramResourceType}">
  <input type="text" id="${searchItemId}" value="${paramName}">
  <div id="${searchItemContentId}"></div>
  <button id="${removeButtonId}">remove</button>
</div>`);
    new Def.Autocompleter.Prefetch(paramResourceTypeSelectorId, [], {
      matchListValue: true
    });
    new Def.Autocompleter.Prefetch(searchItemId, [], {
      matchListValue: true
    });
    this.addRemoveBtnListener(searchItemId);
    this.updateAllSearchParamSelectors();
    this.createControlsForSearchParam(searchItemId);
    if (!this.getAvailableResourceTypes().length) {
      document.getElementById(this.buttonId).disabled = true;
    }
  }

  /**
   * Adds a listener for the remove search parameter button
   * @param {string} searchItemId a generic identifier for a search parameter
   */
  addRemoveBtnListener(searchItemId) {
    const removeButtonId = this.getRemoveButtonId(searchItemId);

    document.getElementById(removeButtonId).onclick = (() => this.removeParam(searchItemId));
  }

  /**
   * Removes a row with search parameter from the table of search parameters
   * @param {string} searchItemId a generic identifier for a search parameter
   */
  removeParam(searchItemId) {
    const row = document.getElementById(this.getParamRowId(searchItemId));
    const availableResourceType = this.selectedResources[searchItemId];
    const availableParam = this.selectedParams[searchItemId];

    this.removeControlsForSearchParam(searchItemId)
    row.parentElement.removeChild(row);
    delete this.selectedParams[searchItemId];
    document.getElementById(this.buttonId).disabled = false;
    this.freeAvailableItem(availableResourceType, availableParam);
    this.updateAllSearchParamSelectors();
  }

  /**
   * Returns an array of objects, each of which contains a resource type
   * and a string of URL parameters with search criteria for this resource
   * @return {Array}
   */
  getAllCriteria() {
    return Object.keys(this.availableParams)
      .map(resourceType => ({
        resourceType: resourceType,
        criteria: this.getCriteriaFor(resourceType)
      }));
  }

  /**
   * Returns a string of URL parameters with all search criteria from all controls
   * @param {string} resourceType - the type of the resource for which you want to get search parameters
   * @return {string}
   */
  getCriteriaFor(resourceType) {
    let conditions = [];

    Object.keys(this.selectedParams).forEach((key) => {
      if (resourceType === this.selectedResources[key]) {
        const paramName = this.selectedParams[key];
        const paramDescription = this.searchParams[resourceType].description[paramName];
        const condition = paramDescription.getCondition(key);
        if (condition) {
          conditions.push(condition);
        }
      }
    });

    return conditions.length ? `${conditions.join('')}` : '';
  }

  /**
   * Returns an array of columns matching the selected conditions for request
   * @param {string} [resourceType] - resource type whose search parameters correspond to the columns
   * @param {Array} [persistentColumns] - additional columns for result array
   * @return {Array}
   */
  getColumns(resourceType, persistentColumns) {
    let columns = {};

    (persistentColumns || []).forEach(column => columns[column] = true);

    Object.keys(this.selectedParams).forEach((key) => {
      const paramResourceType = this.selectedResources[key];
      if (!resourceType || paramResourceType === resourceType) {
        const paramName = this.selectedParams[key];
        const paramDescription = this.searchParams[paramResourceType].description[paramName];
        const columnOrColumns = paramDescription.column;
        [].concat(columnOrColumns).forEach(column => {
          columns[column] = true;
        });
      }
    });

    return Object.keys(columns);
  }

  /**
   * Returns an array of unique resource element names (see https://www.hl7.org/fhir/search.html#elements)
   * @param {string} resourceType - the type of the resource for which you want to get search parameters
   * @param {Array} persistentColumns - additional columns to create the resulting array
   * @return {Array}
   */
  getResourceElements(resourceType, persistentColumns) {
    const columnToResourceElementName = this.searchParams[resourceType].columnToResourceElementName || {};

    return this.getColumns(resourceType, persistentColumns)
      .map(column => columnToResourceElementName[column] || column);
  }
}