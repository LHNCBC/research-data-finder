import * as moment from 'moment';

// Binding the function Array.prototype.slice.call for convert Array-like objects/collections to a new Array
export const slice = Function.prototype.call.bind(Array.prototype.slice);

/**
 * Builds the human name string from an array of the HumanName elements
 * (see https://www.hl7.org/fhir/datatypes.html#humanname).
 * Returns the name string, or null if one could not be constructed.
 * @param {Object[]} nameElements - an array of the HumanName elements (now we use only the first one)
 * @return {string|null}
 */
export function humanNameToString(nameElements) {
  let rtn;
  const name = nameElements && nameElements[0];

  if (name) {
    const given = name.given || [],
      firstName = given[0] || '',
      lastName = name.family || '';
    let middleName = given[1] || '';

    if (middleName.length === 1) {
      middleName += '.';
    }
    rtn = [firstName, middleName, lastName].filter((item) => item).join(' ');
  }

  return rtn || null;
}

/**
 * Get autocompleter associated with an input element by its id
 * @param {string} inputId
 * @return {Object}
 */
export function getAutocompleterById(inputId) {
  const element = document.getElementById(inputId);

  return element && element.autocomp;
}

/**
 * Returns the array of address string from FHIR Address type
 * (see https://www.hl7.org/fhir/datatypes.html#address)
 * @param {Object} valueSetMapByPath - map from path to value set map
 * @param {Object[]} addressElements - an array of the Address elements
 * @example usage of addressToStringArray
 * // calling a function as shown below will return this array:
 * // [
 * //   'Home: 49 Meadow St, Mounds, OK, 74047, USA',
 * //   'Work: 27 South Ave, Tulsa, OK, 74126, USA',
 * //   'Billing: 1 Hill St, Tulsa, OK, 74108, USA'
 * // ]
 * addressToStringArray(
 *   {
 *     "Patient.address.use": {
 *       home: "Home",
 *       work: "Work",
 *       billing: "Billing",
 *     },
 *   },
 *   [
 *     {
 *       use: "home",
 *       line: "49 Meadow St",
 *       city: "Mounds",
 *       state: "OK",
 *       postalCode: "74047",
 *       country: "USA",
 *     },
 *     {
 *       use: "work",
 *       line: "27 South Ave",
 *       city: "Tulsa",
 *       state: "OK",
 *       postalCode: "74126",
 *       country: "USA",
 *     },
 *     {
 *       use: "billing",
 *       line: "1 Hill St",
 *       city: "Tulsa",
 *       state: "OK",
 *       postalCode: "74108",
 *       country: "USA",
 *     }
 *   ]
 * );
 * @return {String[]}
 */
export function addressToStringArray(valueSetMapByPath, addressElements) {
  return (addressElements || [])
    .map((address) => {
      if (!address) {
        return '';
      }
      const addressString = [
        address.line,
        address.city,
        address.state,
        address.postalCode,
        address.country
      ]
        .filter((item) => item)
        .join(', ');
      return address.use
        ? `${
            valueSetMapByPath['Patient.address.use'][address.use]
          }: ${addressString}`
        : addressString;
    })
    .filter((item) => item);
}

/**
 * Returns the age of the Patient from the Patient Resource
 * @param {Object} res the Patient resource
 * @return {number|undefined}
 */
export function getPatientAge(res) {
  const birthDateStr = res.birthDate;
  if (birthDateStr) {
    return Math.floor(
      moment.duration(moment().diff(new Date(birthDateStr))).asYears()
    );
  }
}

/**
 * Returns a list of emails/phones for the Email/Phone table column from the Patient Resource
 * @param {Object} valueSetMapByPath - map from path to value set map
 * @param {Object} res the Patient resource
 * @param {String} system 'email'/'phone'
 * @return {String[]}
 */
export function getPatientContactsByType(valueSetMapByPath, res, system) {
  return (res.telecom || [])
    .filter((item) => item.system === system)
    .map((item) => {
      const use = valueSetMapByPath['Patient.telecom.use'][item.use];
      return `${use ? use + ': ' : ''} ${item.value}`;
    });
}

/**
 * Adds/replaces URL parameter. Returns updated URL.
 * @param {string} url
 * @param {string} name - parameter name
 * @param {string|number} value - parameter value
 * @return {string}
 */
export function updateUrlWithParam(url, name, value) {
  if (!/^([^?]*)(\?([^?]*)|)$/.test(url)) {
    // This is not correct if the URL has two "?" - do nothing:
    return url;
  }
  const urlWithoutParams = RegExp.$1;
  const params = (RegExp.$3 || '')
    .split('&')
    .filter((item) => item && item.split('=')[0] !== name)
    .concat(`${name}=${encodeURIComponent(value)}`)
    .join('&');

  return params ? urlWithoutParams + '?' + params : urlWithoutParams;
}

/**
 * Adds/removes the CSS class for element(s) corresponding to the "selector"
 * depending on the "state" parameter boolean value.
 * If the "state" parameter value is not specified (or not boolean value),
 * this means that the presence of the CSS class should be inverted.
 * Returns new "state" of the last element corresponding to the "selector".
 * @param {string|NodeList|Array<HTMLElement>|HTMLElement} selector - CSS selector, HTMLElement or HTMLElement collection
 * @param {string} cssClass - CSS class
 * @param {boolean} [state] - true - add CSS class, false - remove CSS class, other value is to invert the CSS class presence
 * @return {boolean|undefined}
 */
export function toggleCssClass(selector, cssClass, state) {
  let resultState = undefined;
  const elements =
    selector instanceof HTMLElement
      ? [selector]
      : slice(
          selector instanceof NodeList || selector instanceof Array
            ? selector
            : document.querySelectorAll(selector)
        );
  const hasClassRegExp = new RegExp(`(\\s+|^)${cssClass}\\b`);

  elements.forEach((element) => {
    const className = element.className;
    const currentState = hasClassRegExp.test(className);
    if (currentState === state) {
      resultState = currentState;
      // nothing to change
      return;
    }

    element.className = currentState
      ? className.replace(hasClassRegExp, '')
      : className + ' ' + cssClass;
    resultState = !currentState;
  });

  return resultState;
}

/**
 * Adds the CSS class for element(s) corresponding to the "selector".
 * @param {string|NodeList|Array<HTMLElement>|HTMLElement} selector - CSS selector, HTMLElement or HTMLElement collection
 * @param {string} cssClass - CSS class
 */
export function addCssClass(selector, cssClass) {
  toggleCssClass(selector, cssClass, true);
}

/**
 * Removes the CSS class for element(s) corresponding to the "selector".
 * @param {string|NodeList|Array<HTMLElement>|HTMLElement} selector - CSS selector, HTMLElement or HTMLElement collection
 * @param {string} cssClass - CSS class
 */
export function removeCssClass(selector, cssClass) {
  toggleCssClass(selector, cssClass, false);
}

/**
 * Returns the input string value with the first letter converted to uppercase
 * @param {string} str - input string
 * @return {string}
 */
export function capitalize(str) {
  return str && str.charAt(0).toUpperCase() + str.substring(1);
}

/**
 * Escapes a FHIR search parameter string
 * (see https://www.hl7.org/fhir/search.html#escaping)
 * @param {string} str
 * @return {string}
 */
export function escapeFhirSearchParameter(str) {
  return str.replace(/[$,|]/g, '\\$&');
}

/**
 * Escapes a FHIR search parameter string then encode it with encodeURIComponent
 * (see https://www.hl7.org/fhir/search.html#escaping)
 * @param {string} str
 * @return {string}
 */
export function encodeFhirSearchParameter(str) {
  return encodeURIComponent(escapeFhirSearchParameter(str));
}

/**
 * Prepares a string for insertion into a regular expression
 * @param {string} str
 * @return {string}
 */
export function escapeStringForRegExp(str) {
  return str.replace(/[-[\]{}()*+?.,\\/^$|#\s]/g, '\\$&');
}

/**
 * Returns the date from a date input field appended with a time string if passed
 * @param {string} selector - css selector for getting date input field element
 * @param {string} [timeString] - time string to add
 * @return {string}
 */
export function getDateTimeFromInput(selector, timeString = null) {
  const input = document.querySelector(selector);

  if (input && input.validity.valid && input.value) {
    return input.value + (timeString ? 'T' + timeString : '');
  }

  return '';
}
