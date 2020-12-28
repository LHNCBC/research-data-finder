import {
  getAutocompleterById,
  getFocusableChildren,
  toggleCssClass
} from '../common/utils';
import {
  getSearchParamGroupFactoryByResourceType,
  setFhirServerForSearchParameters
} from './common-descriptions';
import { BaseComponent } from '../common/base-component';

/**
 * Component class for managing criteria
 */
export class SearchParameters extends BaseComponent {
  /**
   * Constructor of component
   * @param {Object<Function>} callbacks - callback functions that the component uses for input/output
   * @param {string} serviceBaseUrl - FHIR REST API Service Base URL (https://www.hl7.org/fhir/http.html#root).
   *        On instantiating the class, the metadata for the specified server will be loaded and used to
   *        determine the FHIR version. The FHIR version is needed to get the specification of the criteria.
   *        Use "ready" property (a Promise) to check that the component is ready for use.
   * @param {Object[]} searchParamGroups - array of objects describing the search parameters
   *                   (see patient-search-parameters.js for an example object)
   *                   or strings with resource types.
   * @param {boolean} autoSelect - automatically select an available resource type when adding a new search parameter
   */
  constructor({
    callbacks,
    serviceBaseUrl,
    searchParamGroups,
    autoSelect = false
  }) {
    super({
      callbacks
    });

    this.autoSelect = autoSelect;
    /**
     * This promise will be resolved when component is ready to use
     * @type {Promise<void>}
     */
    this.ready = setFhirServerForSearchParameters(serviceBaseUrl).then(
      () => {
        this.availableParams = {};
        this.searchParams = searchParamGroups.reduce((_searchParams, item) => {
          const searchParamGroupFactory =
            typeof item === 'string'
              ? getSearchParamGroupFactoryByResourceType(item)
              : item;
          const searchParamGroup = searchParamGroupFactory();
          const resourceType = searchParamGroup.resourceType;
          _searchParams[resourceType] = searchParamGroup;
          this.availableParams[resourceType] = this.isController(
            searchParamGroup
          )
            ? []
            : Object.keys(searchParamGroup.description).sort();
          return _searchParams;
        }, {});
        this.buttonId = this._id + '_add_button';
        this.item_prefix = this._id + '_param_';
        this.item_generator = 0;
        this.selectedParams = {};
        this.selectedResources = {};

        this.initialize();

        Def.Autocompleter.Event.observeListSelections(null, (eventData) => {
          const inputId = eventData.field_id;
          const searchItemIdFromResourceSelectorId = this.getSearchItemIdFromResourceSelectorId(
            inputId
          );
          const isResourceChanged = !!searchItemIdFromResourceSelectorId;
          const searchItemId =
            searchItemIdFromResourceSelectorId ||
            (this.selectedParams[inputId] && inputId);

          if (searchItemId) {
            const autocomplete = getAutocompleterById(inputId);
            const newValue = eventData.final_val;
            const prevValue = isResourceChanged
              ? this.selectedResources[searchItemId]
              : this.selectedParams[searchItemId];
            if (eventData.on_list) {
              if (newValue !== prevValue) {
                const newResourceType = isResourceChanged
                  ? newValue
                  : this.selectedResources[searchItemId];
                const newSelectedParam = isResourceChanged
                  ? this.availableParams[newValue][0]
                  : newValue;
                const prevResourceType = this.selectedResources[searchItemId];
                const prevSelectedParam = this.selectedParams[searchItemId];

                this.removeControlsForSearchParam(searchItemId);
                this.selectedParams[searchItemId] = newSelectedParam;
                this.selectedResources[searchItemId] = newResourceType;
                document.getElementById(
                  this.getParamRowId(searchItemId)
                ).className = this.getSearchParameterClass(searchItemId);
                this.createControlsForSearchParam(searchItemId);
                this.swapAvailableItem(
                  newResourceType,
                  newSelectedParam,
                  prevResourceType,
                  prevSelectedParam
                );
                if (isResourceChanged) {
                  getAutocompleterById(searchItemId).setFieldToListValue(
                    newSelectedParam
                  );
                }
                this.updateAllSearchParamSelectors(
                  searchItemId,
                  isResourceChanged
                );
              }
            } else {
              // Restore the previous value if the user hasn't finally selected the correct value
              if (!newValue) {
                autocomplete.setFieldToListValue(prevValue);
              }
            }
          }
        });
      },
      (e) => {
        alert(e.error);
        return Promise.reject(e);
      }
    );
  }

  /**
   * Returns HTML for component
   * @return {string}
   */
  getHtml() {
    return `\
<div id="${this._id}" class="search-parameter-list${
      this.getAvailableResourceTypes().length === 1
        ? ' search-parameter-list_one-resource'
        : ''
    } search-parameter-list_empty">
    <div class="search-parameter-list__combiner"><label>AND</label> - criteria are combined with logical AND</div>
    <div class="section__body"></div>
</div>
<div>
  <button id="${
    this.buttonId
  }" type="button" class="add-search-param-button">Add a search criterion</button>
</div>`;
  }

  /**
   * Initializes controls created in getHtml
   */
  attachControls() {
    this.attachEvent(document.getElementById(this.buttonId), 'click', () =>
      this.addParam()
    );
  }

  /**
   * Removes all controls and related data
   */
  detachControls() {
    super.detachControls();
    const addBtn = document.getElementById(this.buttonId);
    if (addBtn) {
      this.removeAllParams();
      addBtn.parentElement.removeChild(addBtn);
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
    return (
      /^(.*)_row$/.test(id) && this.selectedResources[RegExp.$1] && RegExp.$1
    );
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
   * Gets an identifier for a search parameter from an identifier for an autocompleter
   * is used for select resource type. If the passed identifier does not match
   * the autocompleter for selecting the resource type, then null is returned.
   * @param {string} id - autocompleter identifier
   * @return {string|null}
   */
  getSearchItemIdFromResourceSelectorId(id) {
    return (
      (/^(.*)_resource$/.test(id) &&
        this.selectedResources[RegExp.$1] !== undefined &&
        RegExp.$1) ||
      null
    );
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
   * Returns true if passed Object supports search parameter controller interface
   * (the interface to construct component for input criterion)
   * @param {Object} searchParamGroup - object describes search parameters group
   * @return {boolean}
   */
  isController(searchParamGroup) {
    return (
      searchParamGroup && typeof searchParamGroup.getControlsHtml === 'function'
    );
  }

  /**
   * Returns search parameter "controller" by generic search parameter identifier
   * or null if resource type or parameter name is not defined.
   * @param {string} searchItemId a generic identifier for a search parameter
   * @returns {{
   *   getControlsHtml: function,
   *   attachControls: function,
   *   detachControls: function,
   *   getCondition: function,
   *   getRawCondition: function,
   *   setRawCondition: function
   * } | null}
   */
  getSearchParamController(searchItemId) {
    const resourceType = this.selectedResources[searchItemId];
    if (!resourceType) {
      return null;
    }

    const paramName = this.selectedParams[searchItemId];
    const searchParamGroup = this.searchParams[resourceType];
    const searchParamGroupCustomCtrl = this.isController(searchParamGroup)
      ? searchParamGroup
      : paramName && searchParamGroup.description[paramName];

    if (!searchParamGroupCustomCtrl) {
      return null;
    }

    return Object.keys(searchParamGroupCustomCtrl).reduce((result, key) => {
      if (searchParamGroupCustomCtrl[key] instanceof Function) {
        result[key] = searchParamGroupCustomCtrl[key].bind(
          result,
          searchItemId
        );
      } else {
        result[key] = searchParamGroupCustomCtrl[key];
      }
      return result;
    }, {});
  }

  /**
   * Creates controls for a search parameter
   * @param {string} searchItemId - generic identifier for the search parameter
   * @return {Promise} promise which resolves when the controls are created and initialized
   */
  createControlsForSearchParam(searchItemId) {
    const element = document.getElementById(
      this.getParamContentId(searchItemId)
    );
    const searchParamCtrl = this.getSearchParamController(searchItemId);

    if (searchParamCtrl) {
      element.innerHTML = searchParamCtrl.getControlsHtml();
      return Promise.resolve(
        searchParamCtrl.attachControls && searchParamCtrl.attachControls()
      );
    } else {
      return Promise.resolve(false);
    }
  }

  /**
   * Removes controls for search parameter
   * @param {string} searchItemId a generic identifier for a search parameter
   */
  removeControlsForSearchParam(searchItemId) {
    const element = document.getElementById(
      this.getParamContentId(searchItemId)
    );
    const searchParamCtrl = this.getSearchParamController(searchItemId);

    searchParamCtrl &&
      searchParamCtrl.detachControls &&
      searchParamCtrl.detachControls();
    element.innerHTML = '';
  }

  /**
   * Replace unavailableItem with availableItem in array of available search parameters
   * @param {string} unavailableResourceType resource type for no longer available param
   * @param {string} unavailableParamName no longer available param
   * @param {string} availableResourceType resource type for new available item
   * @param {string} availableParamName new available item
   */
  swapAvailableItem(
    unavailableResourceType,
    unavailableParamName,
    availableResourceType,
    availableParamName
  ) {
    const index = this.availableParams[unavailableResourceType].indexOf(
      unavailableParamName
    );
    this.availableParams[unavailableResourceType].splice(index, 1);
    this.freeAvailableItem(availableResourceType, availableParamName);
  }

  /**
   * Push new available item to array of available search parameters
   * @param {string} resourceType
   * @param {string} paramName
   */
  freeAvailableItem(resourceType, paramName) {
    if (resourceType && paramName) {
      this.availableParams[resourceType].push(paramName);
      this.availableParams[resourceType].sort();
    }
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

        if (!this.isController(this.searchParams[paramResourceType])) {
          getAutocompleterById(key).setList(
            (paramName ? [paramName] : [])
              .concat(this.availableParams[paramResourceType] || [])
              .sort()
          );
        }
        if (key !== skipSearchItemId) {
          getAutocompleterById(this.getParamResourceSelectorId(key)).setList(
            this.getAvailableResourceTypes(paramResourceType)
          );
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
    const resourceTypes = Object.keys(this.availableParams).filter(
      (resourceType) =>
        (this.isController(this.searchParams[resourceType]) ||
          this.availableParams[resourceType].length) &&
        resourceType !== firstResourceType
    );
    return (firstResourceType ? [firstResourceType] : [])
      .concat(resourceTypes)
      .sort();
  }

  /**
   * Handles click or keypress event on the "Add a search criterion" button
   */
  addParam() {
    const prevRowElement = document
      .getElementById(this._id)
      .querySelector('.section__body >:last-child');
    const prevResourceTypeSelector = prevRowElement
      ? document.getElementById(
          this.getParamResourceSelectorId(
            this.getSearchItemFromRowId(prevRowElement.id)
          )
        )
      : null;
    const availableResourceTypes = this.getAvailableResourceTypes();
    let paramResourceType = '';
    if (
      prevResourceTypeSelector &&
      availableResourceTypes.indexOf(prevResourceTypeSelector.value) !== -1
    ) {
      // If the user added a search parameter and selected a resource type, then
      // automatically select the same resource type value when adding the next parameter
      paramResourceType = prevResourceTypeSelector.value;
    } else if (this.autoSelect) {
      // Automatically select an available resource type when adding a new search parameter
      paramResourceType = this.getAvailableResourceTypes()[0];
    }
    const paramName = paramResourceType
      ? this.availableParams[paramResourceType].shift()
      : '';

    this._addParam(paramResourceType, paramName).then((searchItemId) => {
      const addMessage =
        'Added new row with criterion. The focus is on the first field of this row.';
      Def.Autocompleter.screenReaderLog(addMessage);
      // Focus moves to the first field of the new criterion
      const focusableElements = getFocusableChildren(
        document.getElementById(this.getParamRowId(searchItemId))
      );
      if (focusableElements.length > 0) {
        focusableElements[0].focus();
      }

      if (!this.getAvailableResourceTypes().length) {
        document.getElementById(this.buttonId).disabled = true;
      }
    });
  }

  /**
   * Adds a new row with search parameter to the table of search parameters
   * @param {string} paramResourceType - parameter resource type
   * @param {string} paramName - parameter name
   * @return {Promise} promise which resolves with unique generic identifier for a search parameter row
   * @private
   */
  _addParam(paramResourceType, paramName) {
    // searchItemId is the unique virtual identifier of the controls group for each search parameter.
    // Used as part of HTML element identifiers and for storing data associated with a search parameter.
    const searchItemId = this.item_prefix + ++this.item_generator;
    const paramResourceTypeSelectorId = this.getParamResourceSelectorId(
      searchItemId
    );
    const rowId = this.getParamRowId(searchItemId);
    const searchItemContentId = this.getParamContentId(searchItemId);
    const removeButtonId = this.getRemoveButtonId(searchItemId);

    this.selectedParams[searchItemId] = paramName;
    this.selectedResources[searchItemId] = paramResourceType;

    document
      .getElementById(this._id)
      .querySelector('.section__body')
      .insertAdjacentHTML(
        'beforeend',
        `\
<div id="${rowId}" class="${this.getSearchParameterClass(searchItemId)}">
  <input type="text" id="${paramResourceTypeSelectorId}" value="${paramResourceType}" placeholder="Resource type" aria-label="Resource type">
  <div class="search-parameter__name">
    <input type="text" id="${searchItemId}" value="${paramName}" placeholder="Search parameter name" aria-label="Search parameter name">
  </div>
  <div id="${searchItemContentId}" class="search-parameter__content"></div>
  <button id="${removeButtonId}" type="button" aria-label="Remove the search criterion before this button">remove</button>
</div>`
      );
    new Def.Autocompleter.Prefetch(paramResourceTypeSelectorId, [], {
      matchListValue: true
    });
    new Def.Autocompleter.Prefetch(searchItemId, [], {
      matchListValue: true
    });
    this.addRemoveBtnListener(searchItemId);
    this.onParamsCountChanged();

    return this.createControlsForSearchParam(searchItemId).then(
      () => searchItemId
    );
  }

  /**
   * Adds a listener for the remove search parameter button
   * @param {string} searchItemId a generic identifier for a search parameter
   */
  addRemoveBtnListener(searchItemId) {
    const removeButtonId = this.getRemoveButtonId(searchItemId);

    document.getElementById(removeButtonId).onclick = () => {
      const removeMessage = 'The row with the criterion was removed.';
      this.removeParam(searchItemId);
      Def.Autocompleter.screenReaderLog(removeMessage);
    };
  }

  /**
   * Returns CSS class for search parameter HTML element
   * @param {string} searchItemId a generic identifier for a search parameter
   * @return {string}
   */
  getSearchParameterClass(searchItemId) {
    return (
      'search-parameter' +
      (this.selectedParams[searchItemId] === undefined
        ? ' search-parameter_custom'
        : '') +
      (this.selectedResources[searchItemId] === ''
        ? ' search-parameter_no-resource'
        : '')
    );
  }

  /**
   * Removes a row with search parameter from the table of search parameters
   * @param {string} searchItemId a generic identifier for a search parameter
   */
  removeParam(searchItemId) {
    const row = document.getElementById(this.getParamRowId(searchItemId));
    const availableResourceType = this.selectedResources[searchItemId];
    const availableParam = this.selectedParams[searchItemId];

    this.removeControlsForSearchParam(searchItemId);
    row.parentElement.removeChild(row);
    delete this.selectedParams[searchItemId];
    document.getElementById(this.buttonId).disabled = false;
    this.freeAvailableItem(availableResourceType, availableParam);
    this.onParamsCountChanged();
  }

  /**
   * Removes all search parameter rows.
   */
  removeAllParams() {
    Object.keys(this.selectedParams).forEach((searchItemId) =>
      this.removeParam(searchItemId)
    );
  }

  onParamsCountChanged() {
    this.updateAllSearchParamSelectors();
    const paramsCount = Object.keys(this.selectedParams).length;
    const paramListElement = document.getElementById(this._id);
    toggleCssClass(
      paramListElement,
      'search-parameter-list_empty',
      paramsCount === 0
    );
    toggleCssClass(
      paramListElement,
      'search-parameter-list_combined',
      paramsCount > 1
    );
  }

  /**
   * Returns an array of objects, each of which contains a resource type
   * and a string of URL parameters with search criteria for this resource
   * @return {Array}
   */
  getAllCriteria() {
    return Object.keys(this.availableParams).reduce(
      (allCriteria, resourceType) => {
        const criteria = this.getCriteriaFor(resourceType);
        const searchParamGroup = this.searchParams[resourceType];

        if (this.isController(searchParamGroup)) {
          allCriteria.push(
            ...(criteria.length ? criteria : ['']).map((item) => ({
              resourceType: resourceType,
              criteria: item
            }))
          );
        } else {
          allCriteria.push({
            resourceType: resourceType,
            criteria: criteria.length ? criteria.join('') : ''
          });
        }
        return allCriteria;
      },
      []
    );
  }

  /**
   * Returns a string of URL parameters with all search criteria from all controls
   * @param {string} resourceType - the type of the resource for which you want to get search parameters
   * @return {string}
   */
  getCriteriaFor(resourceType) {
    let conditions = [];

    Object.keys(this.selectedParams).forEach((searchItemId) => {
      if (resourceType === this.selectedResources[searchItemId]) {
        const condition = this.getSearchParamController(
          searchItemId
        ).getCondition();
        if (condition) {
          conditions.push(condition);
        }
      }
    });

    return conditions;
  }

  /**
   * Returns an object with values from criteria controls,
   * useful for restoring the state of controls (see setRawCriteria).
   * @return {Array}
   */
  getRawCriteria() {
    let rawConditions = [];

    Object.keys(this.selectedParams).forEach((searchItemId) => {
      const resourceType = this.selectedResources[searchItemId];
      const paramName = this.selectedParams[searchItemId];
      const searchParamCtrl = this.getSearchParamController(searchItemId);
      if (searchParamCtrl) {
        const rawCondition = searchParamCtrl.getRawCondition();
        if (rawCondition !== undefined) {
          rawConditions.push({
            resourceType,
            paramName,
            rawCondition
          });
        }
      }
    });

    return rawConditions;
  }

  /**
   * Restores the state of criteria controls with the object retrieved by
   * calling getRawCriteria
   * @param {Array} rawConditions
   */
  setRawCriteria(rawConditions) {
    this.removeAllParams();
    rawConditions.forEach(({ resourceType, paramName, rawCondition }) => {
      this._addParam(resourceType, paramName).then((searchItemId) => {
        const searchParamCtrl = this.getSearchParamController(searchItemId);
        searchParamCtrl.setRawCondition(rawCondition);
      });
    });
  }

  /**
   * Returns an array of columns matching the selected conditions for request
   * @param {string} [resourceType] - resource type whose search parameters correspond to the columns
   * @param {Array} [persistentColumns] - additional columns for result array
   * @return {Array}
   */
  getColumns(resourceType, persistentColumns) {
    let columns = {};

    (persistentColumns || []).forEach((column) => (columns[column] = true));

    Object.keys(this.selectedParams).forEach((key) => {
      const paramResourceType = this.selectedResources[key];
      if (
        !paramResourceType ||
        this.isController(this.searchParams[paramResourceType])
      ) {
        return;
      }
      if (!resourceType || paramResourceType === resourceType) {
        const paramName = this.selectedParams[key];
        const paramDescription = this.searchParams[paramResourceType]
          .description[paramName];
        const columnOrColumns = paramDescription.column;
        [].concat(columnOrColumns).forEach((column) => {
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
    const columnToResourceElementName =
      this.searchParams[resourceType].columnToResourceElementName || {};

    return this.getColumns(resourceType, persistentColumns).map(
      (column) => columnToResourceElementName[column] || column
    );
  }
}
