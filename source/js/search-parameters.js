import { getAutocompleterById } from "./utils";

export class SearchParameters {
  /**
   * Inserts the component after table row selected by anchorSelector
   * @param {string} anchorSelector
   * @param {Object} searchParams object describing the search parameters (see patient-search-parameters.js)
   */
  constructor(anchorSelector, searchParams) {
    this.internalId = 'searchParam';
    this.searchParams = searchParams;
    this.buttonId = this.internalId+'_add_button';
    this.item_prefix = this.internalId + '_param_';
    this.item_generator = 0;
    this.availableParams = Object.keys(searchParams.description).sort();
    this.selectedParams = {};

    this.addButton(anchorSelector);

    Def.Autocompleter.Event.observeListSelections(null, (eventData) => {
      const inputId = eventData.field_id;
      if (this.selectedParams[inputId]) {
        const autocomplete = getAutocompleterById(inputId);
        const newValue = eventData.final_val;
        const prevValue = this.selectedParams[inputId];
        if (eventData.on_list) {
          if (newValue !== prevValue) {
            this.removeControlsForSearchParam(inputId);
            this.selectedParams[inputId] = newValue;
            this.createControlsForSearchParam(inputId);
            this.swapAvailableItem(newValue, prevValue);
            this.updateAllSearchParamSelectors(inputId);
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


  //  The three methods below are used to generate identifiers for various parts of the markup for search parameter

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
    const searchParamCtrl = this.searchParams.description[this.selectedParams[searchItemId]];

    element.innerHTML = searchParamCtrl.getControlsHtml(searchItemId);
    searchParamCtrl.attachControls && searchParamCtrl.attachControls(searchItemId);
  }

  /**
   * Removes controls for search parameter
   * @param {string} searchItemId a generic identifier for a search parameter
   */
  removeControlsForSearchParam(searchItemId) {
    const element = document.getElementById(this.getParamContentId(searchItemId));
    const searchParamCtrl = this.searchParams.description[this.selectedParams[searchItemId]];

    searchParamCtrl.detachControls && searchParamCtrl.detachControls(searchItemId);
    element.innerHTML = '';
  }

  /**
   * Replace unavailableItem with availableItem in array of available search parameters
   * @param {string} unavailableParamName no longer available param
   * @param {string} availableParamName new available item
   */
  swapAvailableItem(unavailableParamName, availableParamName) {
    const index = this.availableParams.indexOf(unavailableParamName);
    this.availableParams.splice(index, 1, availableParamName);
    this.availableParams.sort();
  }

  /**
   * Push new available item to array of available search parameters
   * @param {string} paramName
   */
  freeAvailableItem(paramName) {
    this.availableParams.push(paramName);
    this.availableParams.sort();
  }

  /**
   * Updates each autocompteter used to select a search parameter for all added search parameter rows
   * @param {string} [skipSearchItemId] generic identifier of the search parameter to skip update
   */
  updateAllSearchParamSelectors(skipSearchItemId) {
    Object.keys(this.selectedParams).forEach((key) => {
      if (key !== skipSearchItemId) {
        const paramName = this.selectedParams[key];

        getAutocompleterById(key).setList([paramName].concat(this.availableParams).sort());
      }
    });
  }

  /**
   * Adds a button to add search parameters
   * @param {string} anchorSelector table row selector after which a row with a button will be added
   */
  addButton(anchorSelector) {
    const anchorElement = document.querySelector(anchorSelector);

    anchorElement.insertAdjacentHTML('afterend', `\
<tr id="${this.internalId}"><td>
  <button id="${this.buttonId}" class="add-search-param-button">Add search condition</button>
</td></tr>`);
    $(`#${this.buttonId}`).click(() => this.addParam());
  }

  /**
   * Adds a new row with search parameter to the table of search parameters
   */
  addParam() {
    const searchItemId = this.item_prefix+(++this.item_generator);
    const rowId = this.getParamRowId(searchItemId);
    const searchItemContentId = this.getParamContentId(searchItemId);
    const removeButtonId = this.getRemoveButtonId(searchItemId);
    const paramName = this.availableParams.shift();

    this.selectedParams[searchItemId] = paramName;

    document.getElementById(this.internalId).insertAdjacentHTML('beforebegin', `\
<tr id="${rowId}">
  <td><input type="text" id="${searchItemId}" value="${paramName}"></td>
  <td id="${searchItemContentId}"></td>
  <td><button id="${removeButtonId}">remove</button></td>
</tr>`);
    new Def.Autocompleter.Prefetch(searchItemId, [paramName].concat(this.availableParams), {
      matchListValue: true
    });
    this.addRemoveBtnListener(searchItemId);
    this.updateAllSearchParamSelectors();
    this.createControlsForSearchParam(searchItemId);
    if (!this.availableParams.length) {
      $(`#${this.buttonId}`).prop('disabled', true);
    }
  }

  /**
   * Adds a listener for the remove search parameter button
   * @param {string} searchItemId a generic identifier for a search parameter
   */
  addRemoveBtnListener(searchItemId) {
    const removeButtonId = this.getRemoveButtonId(searchItemId);

    $('#' + removeButtonId).click(() => {
      const row = document.getElementById(this.getParamRowId(searchItemId));
      const availableParam = this.selectedParams[searchItemId];
      this.removeControlsForSearchParam(searchItemId)
      row.parentElement.removeChild(row);
      delete this.selectedParams[searchItemId];
      $(`#${this.buttonId}`).prop('disabled', false);
      this.freeAvailableItem(availableParam);
      this.updateAllSearchParamSelectors();
    });
  }

  /**
   * Returns a string of URL parameters with all search conditions from all controls
   * @return {string}
   */
  getConditions() {
    let conditions = [];

    Object.keys(this.selectedParams).forEach((key) => {
      const paramName = this.selectedParams[key];
      const condition = this.searchParams.description[paramName].getCondition(key);
      if (condition) {
        conditions.push(condition);
      }
    });

    return conditions.length ? `${conditions.join('')}` : '';
  }

  /**
   * Returns an array of columns matching the selected conditions for request
   * @param {Array} [persistentColumns] additional columns for result array
   * @return {Array}
   */
  getColumns(persistentColumns) {
    let columns = {};

    (persistentColumns || []).forEach(column => columns[column] = true);

    Object.keys(this.selectedParams).forEach((key) => {
      const paramName = this.selectedParams[key];
      const columnOrColumns = this.searchParams.description[paramName].column;
      [].concat(columnOrColumns).forEach(column => {
        columns[column] = true;
      });
    });

    return Object.keys(columns);
  }

  /**
   * Returns an array of unique resource element names (see https://www.hl7.org/fhir/search.html#elements)
   * @param {Array} persistentColumns additional columns to create the resulting array
   * @return {Array}
   */
  getResourceElements(persistentColumns) {
    return this.getColumns(persistentColumns).map(this.searchParams.mapColumnToResourceElementName);
  }
}