import { getAutocompleterById } from '../common/utils';
import { setFhirServerForSearchParameters } from './common-descriptions';

export class SearchParameters {
  /**
   * Inserts the component after table row selected by anchorSelector
   * @param {string} anchorSelector
   * @param {Object[]} searchParamGroups Array of objects describing the search parameters
   *                   (see patient-search-parameters.js for an example object)
   */
  constructor(anchorSelector, searchParamGroups) {
    this.internalId = 'searchParam';
    this.availableParams = {};
    this.searchParams = searchParamGroups.reduce((_searchParams, searchParamGroup) => {
      _searchParams[searchParamGroup.resourceName] = searchParamGroup;
      this.availableParams[searchParamGroup.resourceName] = Object.keys(searchParamGroup.description).sort();
      return _searchParams;
    }, {});
    this.buttonId = this.internalId+'_add_button';
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
            const newResourceName = isResourceChanged ? newValue : this.selectedResources[searchItemId];
            const newSelectedParam = isResourceChanged ? this.availableParams[newValue][0] : newValue;
            const prevResourceName = this.selectedResources[searchItemId];
            const prevSelectedParam = this.selectedParams[searchItemId];

            this.removeControlsForSearchParam(searchItemId);
            this.selectedParams[searchItemId] = newSelectedParam;
            this.selectedResources[searchItemId] = newResourceName;
            this.createControlsForSearchParam(searchItemId);
            this.swapAvailableItem(newResourceName, newSelectedParam, prevResourceName, prevSelectedParam);
            if (isResourceChanged) {
              getAutocompleterById(searchItemId).setFieldToListValue(newSelectedParam);
            }
            this.updateAllSearchParamSelectors(searchItemId, isResourceChanged);
          }
        } else {
          // Restore the previous value if the user hasn't finally selected the correct value
          if(!newValue) {
            autocomplete.setFieldToListValue(prevValue);
          }
        }
      }
    });
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
   * Generates an identifier for an autocomleter is used for select resource name
   * from a generic identifier for a search parameter
   * @param {string} searchItemId
   * @return {string}
   */
  getParamResourceSelectorId(searchItemId) {
    return searchItemId + '_resource';
  }

  /**
   * Gets an identifier for a search parameter
   * from an identifier for an autocompleter is used for select resource name
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
   * @param {string} unavailableResourceName resource name for no longer available param
   * @param {string} unavailableParamName no longer available param
   * @param {string} availableResourceName resource name for new available item
   * @param {string} availableParamName new available item
   */
  swapAvailableItem(unavailableResourceName, unavailableParamName, availableResourceName, availableParamName) {
    const index = this.availableParams[unavailableResourceName].indexOf(unavailableParamName);
    this.availableParams[unavailableResourceName].splice(index, 1);
    this.availableParams[availableResourceName].push(availableParamName);
    this.availableParams[availableResourceName].sort();
  }

  /**
   * Push new available item to array of available search parameters
   * @param {string} resourceName
   * @param {string} paramName
   */
  freeAvailableItem(resourceName, paramName) {
    this.availableParams[resourceName].push(paramName);
    this.availableParams[resourceName].sort();
  }

  /**
   * Updates each autocompteter used to select a search parameter for all added search parameter rows
   * @param {string} [skipSearchItemId] generic identifier of the search parameter to skip update
   * @param {boolean} [isResourceChanged]
   */
  updateAllSearchParamSelectors(skipSearchItemId, isResourceChanged) {
    Object.keys(this.selectedParams).forEach((key) => {
      if (isResourceChanged || key !== skipSearchItemId) {
        const paramResourceName = this.selectedResources[key];
        const paramName = this.selectedParams[key];

        getAutocompleterById(key).setList([paramName].concat(this.availableParams[paramResourceName]));
        if (key !== skipSearchItemId) {
          getAutocompleterById(this.getParamResourceSelectorId(key)).setList(this.getAvailableResourceNames(paramResourceName));
        }
      }
    });
  }

  /**
   * Returns current available resource names to select a search parameter
   * @param {String} [firstResourceName] - this string will be first in result array if specified
   * @return {String[]}
   */
  getAvailableResourceNames(firstResourceName) {
    const resourceNames = Object.keys(this.availableParams)
      .filter(resourceName => this.availableParams[resourceName].length && resourceName !== firstResourceName);
    return (firstResourceName ? [firstResourceName] : []).concat(resourceNames.sort());
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
    const paramResourceNameSelectorId = this.getParamResourceSelectorId(searchItemId);
    const rowId = this.getParamRowId(searchItemId);
    const searchItemContentId = this.getParamContentId(searchItemId);
    const removeButtonId = this.getRemoveButtonId(searchItemId);
    const paramResourceName = this.getAvailableResourceNames()[0];
    const paramName = this.availableParams[paramResourceName].shift();

    this.selectedParams[searchItemId] = paramName;
    this.selectedResources[searchItemId] = paramResourceName;

    document.getElementById(this.internalId).insertAdjacentHTML('beforebegin', `\
<div id="${rowId}" class="search-parameter">
  <input type="text" id="${paramResourceNameSelectorId}" value="${paramResourceName}">
  <input type="text" id="${searchItemId}" value="${paramName}">
  <div id="${searchItemContentId}"></div>
  <button id="${removeButtonId}">remove</button>
</div>`);
    new Def.Autocompleter.Prefetch(paramResourceNameSelectorId, [], {
      matchListValue: true
    });
    new Def.Autocompleter.Prefetch(searchItemId, [], {
      matchListValue: true
    });
    this.addRemoveBtnListener(searchItemId);
    this.updateAllSearchParamSelectors();
    this.createControlsForSearchParam(searchItemId);
    if (!this.getAvailableResourceNames().length) {
      document.getElementById(this.buttonId).disabled = true;
    }
  }

  /**
   * Adds a listener for the remove search parameter button
   * @param {string} searchItemId a generic identifier for a search parameter
   */
  addRemoveBtnListener(searchItemId) {
    const removeButtonId = this.getRemoveButtonId(searchItemId);

    document.getElementById(removeButtonId).onclick = (() => {
      const row = document.getElementById(this.getParamRowId(searchItemId));
      const availableResourceName = this.selectedResources[searchItemId];
      const availableParam = this.selectedParams[searchItemId];
      this.removeControlsForSearchParam(searchItemId)
      row.parentElement.removeChild(row);
      delete this.selectedParams[searchItemId];
      document.getElementById(this.buttonId).disabled = false;
      this.freeAvailableItem(availableResourceName, availableParam);
      this.updateAllSearchParamSelectors();
    });
  }

  /**
   * Returns a string of URL parameters with all search conditions from all controls
   * @param {string} resourceName - the name of the resource for which you want to get search parameters
   * @return {string}
   */
  getConditions(resourceName) {
    let conditions = [];

    Object.keys(this.selectedParams).forEach((key) => {
      if (resourceName === this.selectedResources[key]) {
        const paramName = this.selectedParams[key];
        const paramDescription = this.searchParams[resourceName].description[paramName];
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
   * @param {string} [resourceName] - resource name whose search parameters correspond to the columns
   * @param {Array} [persistentColumns] - additional columns for result array
   * @return {Array}
   */
  getColumns(resourceName, persistentColumns) {
    let columns = {};

    (persistentColumns || []).forEach(column => columns[column] = true);

    Object.keys(this.selectedParams).forEach((key) => {
      const paramResourceName = this.selectedResources[key];
      if (!resourceName || paramResourceName === resourceName) {
        const paramName = this.selectedParams[key];
        const paramDescription = this.searchParams[paramResourceName].description[paramName];
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
   * @param {string} resourceName - the name of the resource for which you want to get search parameters
   * @param {Array} persistentColumns - additional columns to create the resulting array
   * @return {Array}
   */
  getResourceElements(resourceName, persistentColumns) {
    return this.getColumns(resourceName, persistentColumns)
      .map(column => this.searchParams[resourceName].columnToResourceElementName[column] || column);
  }

  setFhirServer(serviceBaseUrl) {
    setFhirServerForSearchParameters(serviceBaseUrl);
  }
}