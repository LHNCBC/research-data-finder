import { valueSetsMap } from './value-sets';
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
    rtn = [firstName, middleName, lastName].filter(item => item).join(' ');
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
 * @param {Object[]} addressElements - an array of the Address elements
 * @return {String[]}
 */
export function addressToStringArray(addressElements) {
  return (addressElements || []).map(address => {
    if (!address) {
      return '';
    }
    const addressString = [address.line, address.city, address.state, address.postalCode, address.country]
      .filter(item => item).join(', ');
    return address.use ? `${valueSetsMap.addressUse[address.use]}: ${addressString}` : addressString;
  }).filter(item => item);
}

/**
 * Returns the age of the Patient from the Patient Resource
 * @param {Object} res the Patient resource
 * @return {number|undefined}
 */
export function getPatientAge(res) {
  const birthDateStr = res.birthDate;
  if (birthDateStr) {
    return Math.floor(moment.duration(moment().diff(new Date(birthDateStr))).asYears());
  }
}

/**
 * Returns a list of emails/phones for the Email/Phone table column from the Patient Resource
 * @param {Object} res the Patient resource
 * @param {String} system 'email'/'phone'
 * @return {String[]}
 */
export function getPatientContactsByType(res, system) {
  return (res.telecom || [])
    .filter(item => item.system === system)
    .map(item => {
      const use = valueSetsMap.contactPointUse[item.use];
      return `${use ? use + ': ' : ''} ${item.value}`
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
  const params = (RegExp.$3 || '').split('&')
    .filter(item => item && item.split('=')[0] !== name)
    .concat(`${name}=${encodeURIComponent(value)}`).join('&');

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
  let resultState;
  const elements = selector instanceof HTMLElement
    ? [selector]
    : slice(
      selector instanceof NodeList || selector instanceof Array
      ? selector
      : document.querySelectorAll(selector));
  const hiddenRegExp = new RegExp(`(\\s+|^)${cssClass}\\b`);

  elements.forEach(element => {
    const className = element.className;
    const currentState = hiddenRegExp.test(className)
    if (currentState === state) {
      resultState = currentState;
      // nothing to change
      return;
    }

    element.className = currentState
      ? className.replace(hiddenRegExp, '')
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