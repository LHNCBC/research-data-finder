/**
 * Builds the human name string from an array of the HumanName elements
 * (see https://www.hl7.org/fhir/datatypes.html#humanname).
 * Returns the name string, or null if one could not be constructed.
 * @param {Array} nameObj an array of the HumanName elements
 * @return {string|null}
 */
import { valueSetsMap } from "./value-sets";

export function humanNameToString(nameObj) {
  let rtn;
  const name = nameObj && nameObj[0];

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
 * @param {Object[]} addrObj
 * @return {String[]}
 */
export function addressToStringArray(addrObj) {
  return (addrObj || []).map(address => {
    if (!address) {
      return '';
    }
    const addressString = [address.line, address.city, address.state, address.postalCode, address.country]
      .filter(item => item).join(', ');
    return address.use ? `${valueSetsMap.addressUse[address.use]}: ${addressString}` : addressString;
  });
}

export const slice = Function.prototype.call.bind(Array.prototype.slice);