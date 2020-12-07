// See https://www.hl7.org/fhir/observation.html#search for description of Observation search parameters

import {
  escapeFhirSearchParameter,
  encodeFhirSearchParameter,
  getAutocompleterById,
  escapeStringForRegExp,
  getDateTimeFromInput,
  getAutocompleterRawDataById,
  addAutocompleterRawDataById
} from '../common/utils';

export const OBSERVATION = 'Observation';

const testSearchUrl =
  'https://clinicaltables.nlm.nih.gov/api/loinc_items/v3/search?df=LOINC_NUM,text&type=question';

const noControlsMessage = 'select a test to display controls';
const testSpecByRowId = {};

export const ObservationSearchParameters = () => ({
  // The resource type (for which these search parameters) is used for retrieving entered data from the SearchParameters component
  resourceType: OBSERVATION,

  /**
   * Returns HTML for test names input field and area for test value fields
   * @param {string} searchItemId - unique generic identifier for a search parameter row
   * @return {string}
   */
  getControlsHtml: (searchItemId) => `
<input type="text" id="${searchItemId}-test-name" placeholder="LOINC variables – type and select one or more">
<div id="${searchItemId}-test-value" class="search-parameter__test-value">${noControlsMessage}</div>
`,

  /**
   * Initializes controls after adding HTML created in method getControlsHtml to the DOM.
   * @param {string} searchItemId - unique generic identifier for a search parameter row
   */
  attachControls: (searchItemId) => {
    const testInputId = `${searchItemId}-test-name`;

    const testAC = new Def.Autocompleter.Search(testInputId, testSearchUrl, {
      maxSelect: '*',
      matchListValue: false,
      onComplete: function () {
        if (testAC.url.indexOf('&ef=datatype') !== -1) {
          // onComplete only processes response data if hasFocus is true,
          // we need to process this data when restoring criteria from file
          const origHasFocus = testAC.hasFocus;
          testAC.hasFocus = true;
          testAC.onComplete.apply(testAC, arguments);
          testAC.hasFocus = origHasFocus;

          const AnswerLists = testAC.listExtraData_.AnswerLists[0];
          const datatype = testAC.listExtraData_.datatype[0] || null;
          //"units":[[{"unit":"[in_us]"},{"unit":"cm"}]]
          const units = testAC.listExtraData_.units[0] || null;
          if (AnswerLists && AnswerLists.length) {
            testAC.setURL(
              `${testSearchUrl}&q=AnswerLists.AnswerListId:${AnswerLists.map(
                (i) => i.AnswerListId
              ).join(';')}`
            );
          } else if (datatype === 'REAL') {
            if (units) {
              testAC.setURL(
                `${testSearchUrl}&q=datatype:REAL%20AND%20units.unit:${encodeURIComponent(
                  '/' +
                    units.map((i) => escapeStringForRegExp(i.unit)).join('|') +
                    '/'
                )}`
              );
            } else {
              testAC.setURL(
                `${testSearchUrl}&q=datatype:REAL%20AND%20NOT%20_exists_:units.unit`
              );
            }
          } else {
            testAC.setURL(`${testSearchUrl}&q=datatype:${datatype}`);
          }
          createTestValueControls(searchItemId, datatype, units, AnswerLists);
        } else {
          testAC.onComplete.apply(testAC, arguments);
        }
        if (testAC.onCompleteOnce) {
          testAC.onCompleteOnce();
          delete testAC.onCompleteOnce;
        }
      }
    });

    Def.Autocompleter.Event.observeListSelections(testInputId, (eventData) => {
      const selectedCodes = testAC.getSelectedCodes();
      if (
        selectedCodes.length === 1 &&
        testAC.url.indexOf('&q=') === -1 &&
        testAC.url !== ''
      ) {
        initTestAC(searchItemId, eventData.item_code, () => {
          testAC.matchListValue_ = true;
          testAC.domCache.set('elemVal', eventData.val_typed_in);
          testAC.urlSearch(
            eventData.val_typed_in,
            Def.Autocompleter.Base.MAX_ITEMS_BELOW_FIELD
          );
        });
      } else if (
        selectedCodes.length === 0 &&
        (testAC.url.indexOf('&q=') !== -1 || testAC.url === '')
      ) {
        testAC.matchListValue_ = false;
        testAC.setURL(testSearchUrl);
        removeTestValueControls(searchItemId);
      }
    });
  },

  /**
   * Performs actions before deleting a search parameter row
   * @param {string} searchItemId - unique generic identifier for a search parameter row
   */
  detachControls: (searchItemId) => {
    removeTestValueControls(searchItemId);
    getAutocompleterById(`${searchItemId}-test-name`).destroy();
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

/**
 * Adds parameters to subsequent requests to restrict possible responses
 * by the type of value of the test with the corresponding LOINC code.
 * @param {string} searchItemId - unique generic identifier for a search parameter row
 * @param {string} itemCode - LOINC code
 * @param {Function} [onCompleteOnce] - a function that will be called once after initialization
 */
function initTestAC(searchItemId, itemCode, onCompleteOnce) {
  const testAC = getAutocompleterById(`${searchItemId}-test-name`);
  if (itemCode === null) {
    testAC.setURL('');
    createTestValueControls(searchItemId);
    onCompleteOnce();
  } else {
    testAC.setURL(
      `${testSearchUrl}&ef=datatype,units,AnswerLists&q=LOINC_NUM:${itemCode}`
    );
    if (onCompleteOnce) {
      testAC.onCompleteOnce = onCompleteOnce;
    }
    testAC.urlSearch('', Def.Autocompleter.Base.MAX_ITEMS_BELOW_FIELD);
  }
}

/**
 * Creates controls for input test value.
 * @param {string} searchItemId - unique generic identifier for a search parameter row
 * @param {string} datatype - a computed data type for a question,
 *        (see https://clinicaltables.nlm.nih.gov/apidoc/loinc/v3/doc.html)
 *        currently supported values: CNE, REAL, ST,
 *        other values (CWE, DT, TM) is not supported due to their absence.
 *        A request that shows their absence:
 *        https://clinicaltables.nlm.nih.gov/api/loinc_items/v3/search?type=question&q=datatype:(CWE%20OR%20DT%20OR%20TM%20OR%20Ratio)&terms=
 * @param {Array<{unit: string}>} units - a list for UCUM-style units for the "REAL" date type
 * @param {Array<{answers:Array<{AnswerStringID: string, DisplayText: string}>}>} AnswerLists - answer list (single or multiple)
 *        currently we show all answer lists
 */
function createTestValueControls(searchItemId, datatype, units, AnswerLists) {
  const testPeriodHtml = `
<div class="test-period">
  <span>from</span>
  <input type="date" id="${searchItemId}-from" placeholder="yyyy-mm-dd"
         pattern="^(\\d{4}-([0][1-9]|1[0-2])-([0][1-9]|[1-2]\\d|3[01])|)$">
  <span>to</span>
  <input type="date" id="${searchItemId}-to" placeholder="yyyy-mm-dd"
         pattern="^(\\d{4}-([0][1-9]|1[0-2])-([0][1-9]|[1-2]\\d|3[01])|)$">
</div>`;

  if (AnswerLists && AnswerLists.length) {
    document.getElementById(`${searchItemId}-test-value`).innerHTML = `
<div class="test-value">
  <input type="text" id="${searchItemId}-test-answers" placeholder="select answers">
</div>
${testPeriodHtml}`;

    const answers = getAnswers(AnswerLists);

    new Def.Autocompleter.Prefetch(
      `${searchItemId}-test-answers`,
      answers.map((i) => i.__fullDisplayText || i.DisplayText),
      {
        maxSelect: '*',
        codes: answers.map((i) => i.AnswerStringID)
      }
    );
  } else if (datatype === 'REAL' || datatype === undefined) {
    const prefixes = [
      ['=', 'eq'],
      ['not equal', 'ne'],
      ['>', 'gt'],
      ['<', 'lt'],
      ['>=', 'ge'],
      ['<=', 'le']
    ];
    const valueUnits =
      (units && units.length && units.map((i) => i.unit)) || [];

    document.getElementById(`${searchItemId}-test-value`).innerHTML = `
<div class="test-value">
  <input type="text" id="${searchItemId}-test-value-prefix" class="test-value__prefix" value="${prefixes[0][0]}">
  <input type="number" id="${searchItemId}-test-real-value" placeholder="enter number value">
  <input type="text" id="${searchItemId}-test-value-unit" class="test-value__unit" placeholder="unit code">
</div>
${testPeriodHtml}`;

    new Def.Autocompleter.Prefetch(
      `${searchItemId}-test-value-prefix`,
      prefixes.map((i) => i[0]),
      {
        matchListValue: true,
        codes: prefixes.map((i) => i[1])
      }
    ).storeSelectedItem();
    new Def.Autocompleter.Prefetch(
      `${searchItemId}-test-value-unit`,
      valueUnits,
      {
        // matchListValue: true
      }
    );
  } else {
    const modifiers = [
      ['starts with', ''],
      ['contains', 'contains'],
      ['exact', 'exact']
    ];
    document.getElementById(`${searchItemId}-test-value`).innerHTML = `
<div class="test-value">
  <input type="text" id="${searchItemId}-test-value-modifier" class="test-value__modifier" value="${modifiers[0][0]}">
  <input type="text" id="${searchItemId}-test-string-value" placeholder="enter string value">
</div>
${testPeriodHtml}`;
    new Def.Autocompleter.Prefetch(
      `${searchItemId}-test-value-modifier`,
      modifiers.map((i) => i[0]),
      {
        matchListValue: true,
        codes: modifiers.map((i) => i[1])
      }
    ).storeSelectedItem();
  }

  testSpecByRowId[searchItemId] = {
    datatype,
    units,
    AnswerLists
  };
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
    ? '&code=' +
        selectedCodes.map((code) => encodeFhirSearchParameter(code)).join(',')
    : '';
}

/**
 * Returns URL parameters string with a values of the test
 * @param {string} searchItemId - unique generic identifier for a search parameter row
 * @return {string}
 */
function getValueParam(searchItemId) {
  const { datatype, AnswerLists } = testSpecByRowId[searchItemId] || {};

  if (AnswerLists && AnswerLists.length) {
    const value = getAutocompleterById(`${searchItemId}-test-answers`)
      .getSelectedCodes()
      .map((code) => encodeFhirSearchParameter(code))
      .join(',');

    return value ? `&value-concept=${value}` : '';
  } else if (datatype === 'REAL' || datatype === undefined) {
    const prefix = getAutocompleterById(
      `${searchItemId}-test-value-prefix`
    ).getSelectedCodes()[0];
    const value = document.getElementById(`${searchItemId}-test-real-value`)
      .value;
    const unit =
      document.getElementById(`${searchItemId}-test-value-unit`).value || '';

    return value.trim()
      ? `&value-quantity=${encodeURIComponent(
          prefix + value + (unit ? '||' + escapeFhirSearchParameter(unit) : '')
        )}`
      : '';
  }

  const modifier = getAutocompleterById(
    `${searchItemId}-test-value-modifier`
  ).getSelectedCodes()[0];
  const value = escapeFhirSearchParameter(
    document.getElementById(`${searchItemId}-test-string-value`).value
  );

  return value.trim()
    ? `&value-string${modifier ? ':' + modifier : ''}=${encodeURIComponent(
        value
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
  const { datatype, AnswerLists } = testSpecByRowId[searchItemId] || {};
  if (!getCodeParam(searchItemId)) {
    return undefined;
  }
  const testNames = getAutocompleterRawDataById(`${searchItemId}-test-name`);
  let conditionValue;

  if (AnswerLists && AnswerLists.length) {
    conditionValue = getAutocompleterRawDataById(
      `${searchItemId}-test-answers`
    );
  } else if (datatype === 'REAL' || datatype === undefined) {
    const prefix = getAutocompleterById(
      `${searchItemId}-test-value-prefix`
    ).getSelectedCodes();
    const value = document.getElementById(`${searchItemId}-test-real-value`)
      .value;
    const unit =
      document.getElementById(`${searchItemId}-test-value-unit`).value || '';

    conditionValue = {
      prefix,
      value,
      unit
    };
  } else {
    const modifier = getAutocompleterById(
      `${searchItemId}-test-value-modifier`
    ).getSelectedCodes()[0];

    const value = document.getElementById(`${searchItemId}-test-string-value`)
      .value;

    conditionValue = {
      modifier,
      value
    };
  }

  const from = getDateTimeFromInput(`#${searchItemId}-from`);
  const to = getDateTimeFromInput(`#${searchItemId}-to`);

  return {
    testNames,
    conditionValue,
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
  const { testNames, conditionValue, from, to } = rawCondition;

  addAutocompleterRawDataById(`${searchItemId}-test-name`, testNames);
  initTestAC(searchItemId, testNames.codes[0], () => {
    const { datatype, AnswerLists } = testSpecByRowId[searchItemId] || {};

    if (AnswerLists && AnswerLists.length) {
      addAutocompleterRawDataById(
        `${searchItemId}-test-answers`,
        conditionValue
      );
    } else if (datatype === 'REAL' || datatype === undefined) {
      getAutocompleterById(`${searchItemId}-test-value-prefix`).selectByCode(
        conditionValue.prefix
      );
      document.getElementById(`${searchItemId}-test-real-value`).value =
        conditionValue.value;
      document.getElementById(`${searchItemId}-test-value-unit`).value =
        conditionValue.unit;
    } else {
      getAutocompleterById(`${searchItemId}-test-value-modifier`).selectByCode(
        conditionValue.modifier
      );

      document.getElementById(`${searchItemId}-test-string-value`).value =
        conditionValue.value;
    }

    document.querySelector(`#${searchItemId}-from`).value = from;
    document.querySelector(`#${searchItemId}-to`).value = to;
  });
}

/**
 * Removes controls for test value
 * @param {string} searchItemId - unique generic identifier for a search parameter row
 */
function removeTestValueControls(searchItemId) {
  const answersAC = getAutocompleterById(`${searchItemId}-test-answers`);
  answersAC && answersAC.destroy();
  document.getElementById(
    `${searchItemId}-test-value`
  ).innerHTML = noControlsMessage;
  delete testSpecByRowId[searchItemId];
}

/**
 * Adds additional property __fullDisplayText to item of AnswerList if passed
 * @param {Object|null} answer - item of AnswerList
 */
function addFullDisplayTextToAnswer(answer) {
  if (answer) {
    answer.__fullDisplayText = `${answer.AnswerStringID} - ${answer.DisplayText}`;
  }
}

/**
 * Returns answer list combined from an array of AnswerLists without duplicate answers
 * (whose text and ID might match another answer) and with additional property
 * __fullDisplayText for ambiguous answers (whose text or ID might match another answer)
 * @param {Array} AnswerLists
 * @return {Array}
 */
function getAnswers(AnswerLists) {
  const existSameAnswer = {};
  const existAnswerId = {};
  const existAnswerText = {};

  return []
    .concat(
      ...AnswerLists.map((i) =>
        i.answers.sort((x, y) => x.SequenceNo - y.SequenceNo)
      )
    )
    .filter((answer) => {
      const hash = answer.AnswerStringID + '~-~' + answer.DisplayText;
      if (existSameAnswer[hash]) {
        // Skip completely identical answers
        return false;
      }

      if (
        existAnswerId[answer.AnswerStringID] ||
        existAnswerText[answer.DisplayText]
      ) {
        // Add property to ambiguous answers
        addFullDisplayTextToAnswer(answer);
        addFullDisplayTextToAnswer(existAnswerId[answer.AnswerStringID]);
        addFullDisplayTextToAnswer(existAnswerText[answer.DisplayText]);
      }
      existSameAnswer[hash] = true;
      existAnswerId[answer.AnswerStringID] = answer;
      existAnswerText[answer.DisplayText] = answer;
      return true;
    });
}
