// See https://www.hl7.org/fhir/observation.html#search and https://www.hl7.org/fhir/observation-operation-lastn.html
// for description of Observation search parameters

import {
  escapeFhirSearchParameter,
  encodeFhirSearchParameter,
  getAutocompleterById,
  escapeStringForRegExp,
  getDateTimeFromInput,
  getAutocompleterRawDataById,
  addAutocompleterRawDataById
} from '../common/utils';
import { getFhirClient } from '../common/fhir-service';

export const OBSERVATION = 'Observation';

const noControlsMessage = 'Select a test to display options';
const testSpecByRowId = {};

// Mapping for supported value[x] properties of Observation
const typeDescriptions = {
  Quantity: {
    searchValPrefixes: [
      ['=', 'eq'],
      ['not equal', 'ne'],
      ['>', 'gt'],
      ['<', 'lt'],
      ['>=', 'ge'],
      ['<=', 'le']
    ],
    unit: true,
    inputFieldAttrs: 'type="number" step="any" placeholder="enter number value"'
  },
  CodeableConcept: {
    modifiers: [['starts with', ':text']],
    unit: false,
    inputFieldAttrs: 'type="text" placeholder="enter string value"'
  },
  string: {
    modifiers: [
      ['starts with', ''],
      ['contains', ':contains'],
      ['exact', ':exact']
    ],
    unit: false,
    inputFieldAttrs: 'type="text" placeholder="enter string value"'
  }
};

export const ObservationLastnSearchParameters = () => ({
  // The resource type (for which these search parameters) is used for retrieving entered data from the SearchParameters component
  resourceType: OBSERVATION,
  id: OBSERVATION + '-lastN',
  displayName: 'Observation',

  /**
   * Returns HTML for test names input field and area for test value fields
   * @param {string} searchItemId - unique generic identifier for a search parameter row
   * @return {string}
   */
  getControlsHtml: (searchItemId) => `
<input type="text" id="${searchItemId}-test-name" placeholder="Test names from FHIR server – type and select one or more">
<div id="${searchItemId}-test-value-area" class="search-parameter__test-value">${noControlsMessage}</div>
`,

  /**
   * Initializes controls after adding HTML created in method getControlsHtml to the DOM.
   * @param {string} searchItemId - unique generic identifier for a search parameter row
   */
  attachControls: (searchItemId) => {
    const testInputId = `${searchItemId}-test-name`;
    const code2Type = {};
    const currentData = (testSpecByRowId[searchItemId] = {
      datatype: ''
    });

    const testAC = new Def.Autocompleter.Search(testInputId, null, {
      suggestionMode: Def.Autocompleter.NO_COMPLETION_SUGGESTIONS,
      fhir: {
        search: function (fieldVal, count) {
          const isMatchToFieldVal = new RegExp(
            escapeStringForRegExp(fieldVal),
            'i'
          );
          return {
            then: function (resolve, reject) {
              getFhirClient()
                .resourcesMapFilter(
                  `Observation/$lastn?max=1&_elements=code,value,component&code:text=${encodeURIComponent(
                    fieldVal
                  )}`,
                  count,
                  (observation) => {
                    // TODO: Add support for different systems
                    const datatype = getValueDataType(observation);
                    if (
                      !currentData.datatype ||
                      datatype === currentData.datatype
                    ) {
                      return observation.code.coding
                        .filter((coding) =>
                          isMatchToFieldVal.test(coding.display) &&
                          testAC.getSelectedCodes().indexOf(coding.code) === -1
                        )
                        .map((coding) => {
                          code2Type[coding.code] = datatype;
                          return {
                            code: coding.code,
                            display: coding.display
                          };
                        });
                    } else {
                      return false;
                    }
                  },
                  500
                )
                .then(
                  ({ entry, total }) => {
                    resolve({
                      resourceType: 'ValueSet',
                      expansion: {
                        total: Number.isInteger(total) ? total : Infinity,
                        contains: entry
                      }
                    });
                  },
                  ({ error }) => reject(error)
                );
            }
          };
        }
      },
      useResultCache: false,
      maxSelect: '*',
      matchListValue: true
    });

    currentData.changeListener = (eventData) => {
      const selectedCodes = testAC.getSelectedCodes();
      if (selectedCodes.length > 0) {
        currentData.datatype = code2Type[selectedCodes[0]];
        testAC.matchListValue_ = true;
        testAC.domCache.set('elemVal', eventData.val_typed_in);
        testAC.useSearchFn(
          eventData.val_typed_in,
          Def.Autocompleter.Base.MAX_ITEMS_BELOW_FIELD
        );
        createTestValueControls(searchItemId, currentData.datatype);
      } else if (selectedCodes.length === 0) {
        currentData.datatype = '';
        removeTestValueControls(searchItemId);
      }
    };
    Def.Autocompleter.Event.observeListSelections(
      testInputId,
      currentData.changeListener
    );
  },

  /**
   * Performs actions before deleting a search parameter row
   * @param {string} searchItemId - unique generic identifier for a search parameter row
   */
  detachControls: (searchItemId) => {
    const testInputId = `${searchItemId}-test-name`;
    const currentData = testSpecByRowId[searchItemId];
    removeTestValueControls(searchItemId);
    getAutocompleterById(testInputId).destroy();
    Def.Autocompleter.Event.removeCallback(
      testInputId,
      'LIST_SEL',
      currentData.changeListener
    );
    delete testSpecByRowId[searchItemId];
  },

  getRawCondition,
  setRawCondition,

  /**
   * Returns URL parameters string with search condition according to value in controls
   * @param {string} searchItemId - unique generic identifier for a search parameter row
   * @return {string}
   */
  getCondition: (searchItemId) => {
    if (!getCodeParam(searchItemId)) {
      // No tests selected
      return '';
    }

    return (
      getCodeParam(searchItemId) +
      getValueParam(searchItemId) +
      getPeriodParams(searchItemId)
    );
  }
});

const reValueKey = /^value(.*)/;

/**
 * Returns the [x] part of the property name value[x]
 * @param {Object} observation - Observation resource data
 * @return {string}
 */
function getValueDataType(observation) {
  let valueType = '';
  [observation, ...(observation.component || [])].some((obj) => {
    return Object.keys(obj).some((key) => {
      const valueFound = reValueKey.test(key);
      if (valueFound) {
        valueType = RegExp.$1;
      }
      return valueFound;
    });
  });

  return valueType;
}

/**
 * Creates controls for input test value.
 * @param {string} searchItemId - unique generic identifier for a search parameter row
 * @param {string} datatype - a computed data type for a test value,
 *        currently supported values: Quantity, CodeableConcept, string
 */
function createTestValueControls(searchItemId, datatype) {
  const testPeriodHtml = `
<div class="test-period">
  <span>from</span>
  <input type="date" id="${searchItemId}-from" placeholder="yyyy-mm-dd"
         pattern="^(\\d{4}-([0][1-9]|1[0-2])-([0][1-9]|[1-2]\\d|3[01])|)$">
  <span>to</span>
  <input type="date" id="${searchItemId}-to" placeholder="yyyy-mm-dd"
         pattern="^(\\d{4}-([0][1-9]|1[0-2])-([0][1-9]|[1-2]\\d|3[01])|)$">
</div>`;

  const typeDescription = typeDescriptions[datatype];
  const inputFieldAttrs = {
    Quantity: 'type="number" step="any" placeholder="enter number value"',
    CodeableConcept: 'type="text" placeholder="enter string value"',
    string: 'type="text" placeholder="enter string value"'
  }[datatype];

  if (!typeDescription) {
    document.getElementById(
      `${searchItemId}-test-value-area`
    ).innerHTML = `unsupported value type "${datatype}"`;
    return;
  }

  const unitInputFieldHtml = typeDescription.unit
    ? `<input type="text" id="${searchItemId}-test-value-unit" class="test-value__unit" placeholder="unit code" style="width:100%">`
    : '';

  const prefixInputId = `${searchItemId}-test-value-prefix`;
  let prefixHtml = '',
    selectedSearchValPrefix;
  if (typeDescription.searchValPrefixes) {
    selectedSearchValPrefix = typeDescription.searchValPrefixes[0][0];
    prefixHtml = `<input type="text" id="${prefixInputId}" class="test-value__prefix" value="${selectedSearchValPrefix}" ${
      typeDescription.searchValPrefixes.length === 1 ? 'readonly' : ''
    }>`;
  }

  const modifierInputId = `${searchItemId}-test-value-modifier`;
  let modifierHtml = '',
    currentModifier;
  if (typeDescription.modifiers) {
    currentModifier = typeDescription.modifiers[0][0];
    modifierHtml = `<input type="text" id="${modifierInputId}" class="test-value__modifier" value="${currentModifier}" ${
      typeDescription.modifiers.length === 1 ? 'readonly' : ''
    }>`;
  }

  document.getElementById(`${searchItemId}-test-value-area`).innerHTML = `
<div class="test-value">
  ${prefixHtml}${modifierHtml}
  <input id="${searchItemId}-test-value" ${inputFieldAttrs}>
  ${unitInputFieldHtml}
</div>
${testPeriodHtml}`;

  if (prefixHtml) {
    const prefixAC = new Def.Autocompleter.Prefetch(
      prefixInputId,
      typeDescription.searchValPrefixes.map((i) => i[0]),
      {
        matchListValue: true,
        codes: typeDescription.searchValPrefixes.map((i) => i[1])
      }
    );
    prefixAC.storeSelectedItem();

    Def.Autocompleter.Event.observeListSelections(
      prefixInputId,
      (eventData) => {
        const newPrefix = eventData.final_val;
        if (eventData.on_list) {
          selectedSearchValPrefix = newPrefix;
        } else if (!newPrefix) {
          // Restore the previous value if the user hasn't finally selected
          // a value from the list of available values
          prefixAC.setFieldToListValue(selectedSearchValPrefix);
        }
      }
    );
  }

  if (modifierHtml) {
    const modifierAC = new Def.Autocompleter.Prefetch(
      modifierInputId,
      typeDescription.modifiers.map((i) => i[0]),
      {
        matchListValue: true,
        codes: typeDescription.modifiers.map((i) => i[1])
      }
    );
    modifierAC.storeSelectedItem();

    Def.Autocompleter.Event.observeListSelections(
      modifierInputId,
      (eventData) => {
        const newModifier = eventData.final_val;
        if (eventData.on_list) {
          currentModifier = newModifier;
        } else if (!newModifier) {
          // Restore the previous value if the user hasn't finally selected
          // a value from the list of available values
          modifierAC.setFieldToListValue(currentModifier);
        }
      }
    );
  }
}

/**
 * Returns URL parameters string with a codes of the test
 * @param {string} searchItemId - unique generic identifier for a search parameter row
 * @return {string}
 */
function getCodeParam(searchItemId) {
  const autocompleter = getAutocompleterById(`${searchItemId}-test-name`);
  let selectedCodes = autocompleter.getSelectedCodes();

  if (selectedCodes.filter((i) => i !== undefined).length === 0) {
    selectedCodes = autocompleter.getSelectedItems();
  }

  return selectedCodes.length
    ? '&combo-code=' +
        selectedCodes.map((code) => encodeFhirSearchParameter(code)).join(',')
    : '';
}

/**
 * Returns URL parameters string with a values of the test
 * @param {string} searchItemId - unique generic identifier for a search parameter row
 * @return {string}
 */
function getValueParam(searchItemId) {
  const { datatype } = testSpecByRowId[searchItemId];
  const typeDescription = typeDescriptions[datatype];
  const valueParamName = {
    CodeableConcept: 'combo-value-concept',
    Quantity: 'combo-value-quantity',
    string: 'value-string'
  }[datatype];

  const modifier =
    (typeDescription.modifiers &&
      getAutocompleterById(
        `${searchItemId}-test-value-modifier`
      ).getSelectedCodes()[0]) ||
    '';
  const prefix =
    (typeDescription.searchValPrefixes &&
      getAutocompleterById(
        `${searchItemId}-test-value-prefix`
      ).getSelectedCodes()[0]) ||
    '';
  const value = escapeFhirSearchParameter(
    document.getElementById(`${searchItemId}-test-value`).value
  );
  const unit =
    (typeDescription.unit &&
      document.getElementById(`${searchItemId}-test-value-unit`).value) ||
    '';

  return value.trim()
    ? `&${valueParamName}${modifier}=${prefix}${encodeURIComponent(
        value + (unit ? '||' + escapeFhirSearchParameter(unit) : '')
      )}`
    : '';
}

/**
 * Returns URL parameters string with a period of the test effective date
 * @param {string} searchItemId - unique generic identifier for a search parameter row
 * @return {string}
 */
function getPeriodParams(searchItemId) {
  const from = getDateTimeFromInput(`#${searchItemId}-from`);
  const to = getDateTimeFromInput(`#${searchItemId}-to`);

  return (
    (from ? `&date=ge${encodeURIComponent(from)}` : '') +
    (to ? `&date=le${encodeURIComponent(to)}` : '')
  );
}

/**
 * Returns an object with values from criterion controls,
 * useful for restoring the state of controls (see setRawCondition).
 * @param {string} searchItemId - unique generic identifier for a search parameter row
 * @return {Object|null}
 */
function getRawCondition(searchItemId) {
  const { datatype } = testSpecByRowId[searchItemId];
  if (!getCodeParam(searchItemId)) {
    return undefined;
  }
  const typeDescription = typeDescriptions[datatype];
  const testNames = getAutocompleterRawDataById(`${searchItemId}-test-name`);
  const modifier =
    (typeDescription.modifiers &&
      getAutocompleterById(
        `${searchItemId}-test-value-modifier`
      ).getSelectedCodes()[0]) ||
    '';
  const prefix =
    (typeDescription.searchValPrefixes &&
      getAutocompleterById(
        `${searchItemId}-test-value-prefix`
      ).getSelectedCodes()[0]) ||
    '';
  const value = escapeFhirSearchParameter(
    document.getElementById(`${searchItemId}-test-value`).value
  );
  const unit =
    (typeDescription.unit &&
      document.getElementById(`${searchItemId}-test-value-unit`).value) ||
    '';
  const from = getDateTimeFromInput(`#${searchItemId}-from`);
  const to = getDateTimeFromInput(`#${searchItemId}-to`);

  return {
    testNames,
    datatype,
    conditionValue: {
      ...(modifier ? { modifier } : {}),
      ...(prefix ? { prefix } : {}),
      value,
      ...(unit ? { unit } : {})
    },
    from,
    to
  };
}

/**
 * Restores the state of controls with the object retrieved by calling getRawCondition
 * @param {string} searchItemId - unique generic identifier for a search parameter row
 * @param {string} rawCondition - object with values from criterion controls
 */
function setRawCondition(searchItemId, rawCondition) {
  const { testNames, datatype, conditionValue, from, to } = rawCondition;

  testSpecByRowId[searchItemId].datatype = datatype;
  addAutocompleterRawDataById(`${searchItemId}-test-name`, testNames);

  createTestValueControls(searchItemId, datatype);

  [
    [
      getAutocompleterById(`${searchItemId}-test-value-modifier`),
      conditionValue.modifier
    ],
    [
      getAutocompleterById(`${searchItemId}-test-value-prefix`),
      conditionValue.prefix
    ]
  ].forEach(([ac, code]) => ac && ac.selectByCode(code));

  [
    [`${searchItemId}-test-value`, conditionValue.value],
    [`${searchItemId}-test-value-unit`, conditionValue.unit],
    [`${searchItemId}-from`, from],
    [`${searchItemId}-to`, to]
  ].forEach(([id, val]) => {
    const inputElement = document.getElementById(id);
    if (inputElement) {
      inputElement.value = val || '';
    }
  });
}

/**
 * Removes controls for test value
 * @param {string} searchItemId - unique generic identifier for a search parameter row
 */
function removeTestValueControls(searchItemId) {
  [`${searchItemId}-test-modifier`, `${searchItemId}-test-prefix`].forEach(
    (inputId) => {
      const ac = getAutocompleterById(inputId);
      ac && ac.destroy();
    }
  );
  document.getElementById(
    `${searchItemId}-test-value-area`
  ).innerHTML = noControlsMessage;
  testSpecByRowId[searchItemId].type = '';
}
