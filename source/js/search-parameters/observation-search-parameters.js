// See https://www.hl7.org/fhir/observation.html#search for description of Observation search parameters

import {
  escapeFhirSearchParameter,
  encodeFhirSearchParameter,
  getAutocompleterById,
  escapeStringForRegExp
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
<input type="text" id="${searchItemId}-test-name" placeholder="LOINC tests">
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
      matchListValue: true,
      onComplete: function () {
        testAC.onComplete.apply(testAC, arguments);
        if (testAC.url.indexOf('&ef=datatype') !== -1) {
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
          testAC.urlSearch('', Def.Autocompleter.Base.MAX_ITEMS_BELOW_FIELD);
          createTestValueControls(searchItemId, datatype, units, AnswerLists);
        }
      }
    });

    Def.Autocompleter.Event.observeListSelections(testInputId, (eventData) => {
      const selectedCodes = testAC.getSelectedCodes();
      if (selectedCodes.length === 1 && testAC.url.indexOf('&q=') === -1) {
        testAC.setURL(
          `${testSearchUrl}&ef=datatype,units,AnswerLists&q=LOINC_NUM:${eventData.item_code}`
        );
        testAC.urlSearch('', Def.Autocompleter.Base.MAX_ITEMS_BELOW_FIELD);
      } else if (
        selectedCodes.length === 0 &&
        testAC.url.indexOf('&q=') !== -1
      ) {
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

  /**
   * Returns URL parameters string with search condition according to value in controls
   * @param {string} searchItemId - unique generic identifier for a search parameter row
   * @return {string}
   */
  getCondition: (searchItemId) => {
    const { datatype, AnswerLists } = testSpecByRowId[searchItemId] || {};
    if (!datatype) {
      // No tests selected
      return '';
    }

    const codes = getAutocompleterById(`${searchItemId}-test-name`)
      .getSelectedCodes()
      .map((code) => encodeFhirSearchParameter(code))
      .join(',');

    if (AnswerLists && AnswerLists.length) {
      const value = getAutocompleterById(`${searchItemId}-test-answers`)
        .getSelectedCodes()
        .map((code) => encodeFhirSearchParameter(code))
        .join(',');

      return value
        ? `&code=${codes}&value-concept=${value}${getPeriodParams(
            searchItemId
          )}`
        : '';
    } else if (datatype === 'REAL') {
      const prefix = getAutocompleterById(
        `${searchItemId}-test-value-prefix`
      ).getSelectedCodes()[0];
      const value = document.getElementById(`${searchItemId}-test-real-value`)
        .value;
      const unit =
        document.getElementById(`${searchItemId}-test-value-unit`).value || '';
      return value.trim()
        ? `&code=${codes}&value-quantity=${encodeURIComponent(
            prefix +
              value +
              (unit ? '||' + escapeFhirSearchParameter(unit) : '')
          )}${getPeriodParams(searchItemId)}`
        : '';
    }

    const modifier = getAutocompleterById(
      `${searchItemId}-test-value-modifier`
    ).getSelectedCodes()[0];
    const value = escapeFhirSearchParameter(
      document.getElementById(`${searchItemId}-test-string-value`).value
    );
    return value.trim()
      ? `&code=${codes}&value-string${
          modifier ? ':' + modifier : ''
        }=${encodeURIComponent(value)}${getPeriodParams(searchItemId)}`
      : '';
  }
});

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
  if (AnswerLists && AnswerLists.length) {
    document.getElementById(`${searchItemId}-test-value`).innerHTML = `
<div class="test-value">
  <input type="text" id="${searchItemId}-test-answers" placeholder="select answers">
</div>
<div class="test-period">
  <span>from</span><input type="date" id="${searchItemId}-from" placeholder="no limit">
  <span>to</span><input type="date" id="${searchItemId}-to" placeholder="no limit">
</div>`;

    const answers = getAnswers(AnswerLists);

    new Def.Autocompleter.Prefetch(
      `${searchItemId}-test-answers`,
      answers.map((i) => i.__fullDisplayText || i.DisplayText),
      {
        maxSelect: '*',
        codes: answers.map((i) => i.AnswerStringID)
      }
    );
  } else if (datatype === 'REAL') {
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
  <input type="text" id="${searchItemId}-test-value-prefix" class="test-value__prefix" value="${
      prefixes[0][0]
    }">
  <input type="number" id="${searchItemId}-test-real-value" placeholder="enter number value">
  <input type="text" id="${searchItemId}-test-value-unit" class="test-value__unit" placeholder="unit code"
    style="${valueUnits.length === 0 && 'display:none'}">
</div>
<div class="test-period">
  <span>from</span><input type="date" id="${searchItemId}-from" placeholder="no limit">
  <span>to</span><input type="date" id="${searchItemId}-to" placeholder="no limit">
</div>`;

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
<div class="test-period">
  <span>from</span><input type="date" id="${searchItemId}-from" placeholder="no limit">
  <span>to</span><input type="date" id="${searchItemId}-to" placeholder="no limit">
</div>`;
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
 * Returns the date from a date input field appended with a time string
 * @param {string} selector - css selector for getting date input field element
 * @param {string} timeString - time string to add
 * @return {string}
 */
function getDateTimeFromInput(selector, timeString) {
  const value = document.querySelector(selector).value;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value + 'T' + timeString;
  }

  return value;
}

/**
 * Returns URL parameters string with a period of the test effective date
 * @param {string} searchItemId - unique generic identifier for a search parameter row
 * @return {string}
 */
function getPeriodParams(searchItemId) {
  const from = getDateTimeFromInput(`#${searchItemId}-from`, '00:00:00.000Z');
  const to = getDateTimeFromInput(`#${searchItemId}-to`, '23:59:59.999Z');

  return (
    (from ? `&date=ge${encodeURIComponent(from)}` : '') +
    (to ? `&date=le${encodeURIComponent(to)}` : '')
  );
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
