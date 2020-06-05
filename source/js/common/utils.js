import { valueSetsMap } from "./value-sets";

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
 * Adds/replaces URL parameter. Returns updated URL.
 * @param {string} url
 * @param {string} name - parameter name
 * @param {string} value - parameter value
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

export const slice = Function.prototype.call.bind(Array.prototype.slice);