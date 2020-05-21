import { FhirBatchQuery } from "../common/fhir-batch-query";
import { getAutocompleterById } from "../common/utils";

// Common FhirBatchQuery to execute queries from search parameter controls
let client;

export function setFhirServerForSearchParameters(serviceBaseUrl) {
  client = new FhirBatchQuery({serviceBaseUrl, maxRequestsPerBatch: 1});
}

export function getCurrentClient() {
  return client;
}

/**
 * Generates string parameter descriptions
 * @param {Array[]} descriptions - an array of descriptions, each of which is an array containing the following elements:
 *                  displayName - parameter display name,
 *                  placeholder - placeholder for input field,
 *                  name - name of search parameter to construct result query string
 * @param {Object} searchNameToColumn - mapping from search parameter names to observation table column names
 * @return {Object}
 */
export function stringParameters(descriptions, searchNameToColumn) {
  return descriptions.reduce((_patientParams, [displayName, placeholder, name]) => {
    _patientParams[displayName] = {
      column: searchNameToColumn[name] || name,
      getControlsHtml: (searchItemId) =>
        `<input type="text" style="width:100%" id="${searchItemId}-${name}" placeholder="${placeholder}">`,
      getCondition: (searchItemId) => {
        const value = document.getElementById(`${searchItemId}-${name}`).value;
        return value.trim() ? `&${name}=${encodeURIComponent(value)}` : '';
      }
    };
    return _patientParams;
  }, {});
}

/**
 * Generates descriptions for parameters with a predefined set of values
 * @param {Array[]} descriptions - an array of descriptions, each of which is an array containing the following elements:
 *                  displayName - parameter display name,
 *                  placeholder - placeholder for input field,
 *                  name - name of search parameter to construct result query string
 *                  list - array of predefined values (see value-sets.js)
 * @param {Object} searchNameToColumn - mapping from search parameter names to observation table column names
 * @return {Object}
 */
export function valueSetsParameters(descriptions, searchNameToColumn) {
  return descriptions.reduce((_patientParams, [displayName, placeholder, name, list]) => {
    _patientParams[displayName] = {
      column: searchNameToColumn[name] || name,
      getControlsHtml: (searchItemId) =>
        `<input type="text" id="${searchItemId}-${name}" placeholder="${placeholder}">`,
      attachControls: (searchItemId) => {
        new Def.Autocompleter.Prefetch(`${searchItemId}-${name}`, list.map(item => item.display), {
          codes: list.map(item => item.code),
          maxSelect: '*',
          matchListValue: true
        });
      },
      detachControls: (searchItemId) => {
        getAutocompleterById(`${searchItemId}-${name}`).destroy();
      },
      getCondition: (searchItemId) => {
        const codes = getAutocompleterById(`${searchItemId}-${name}`).getSelectedCodes().join(',');
        return codes ? `&${name}=${encodeURIComponent(codes)}` : '';
      }
    };
    return _patientParams;
  }, {});
}

/**
 * Generates date parameter descriptions
 * @param {Array[]} descriptions - an array of descriptions, each of which is an array containing the following elements:
 *                  displayName - parameter display name,
 *                  name - name of search parameter to construct result query string
 * @param {Object} searchNameToColumn - mapping from search parameter names to observation table column names
 * @return {Object}
 */
export function dateParameters(descriptions, searchNameToColumn) {
  return descriptions.reduce((_patientParams, [displayName, name]) => {
    _patientParams[displayName] = {
      column: searchNameToColumn[name] || name,
      getControlsHtml: (searchItemId) => {
        return `\
from <input type="date" id="${searchItemId}-${name}-from" placeholder="no limit">
to <input type="date" id="${searchItemId}-${name}-to" placeholder="no limit"></td>`;
      },
      getCondition: (searchItemId) => {
        const from = document.getElementById(`${searchItemId}-${name}-from`).value;
        const to = document.getElementById(`${searchItemId}-${name}-to`).value;

        return (from ? `&${name}=ge${encodeURIComponent(from)}` : '')
          + (to ? `&${name}=le${encodeURIComponent(to)}` : '');
      }
    };
    return _patientParams;
  }, {});
}

/**
 * Generates descriptions for parameters with a set of loadable values
 * @param {Array[]} descriptions - an array of descriptions, each of which is an array containing the following elements:
 *                  displayName - parameter display name,
 *                  placeholder - placeholder for input field,
 *                  resourceName - FHIR resource name,
 *                  filterName - query parameter name for filtering resources by string,
 *                  itemToString - function to convert an resource item to a string,
 *                  name - name of search parameter to construct result query string
 * @param {Object} searchNameToColumn - mapping from search parameter names to observation table column names
 * @return {Object}
 */
export function referenceParameters(descriptions, searchNameToColumn) {
  return descriptions.reduce((_patientParams, [displayName, placeholder, resourceName, filterName, itemToString, name]) => {
    _patientParams[displayName] = {
      column: searchNameToColumn[name] || name,
      getControlsHtml: (searchItemId) =>
        `<input type="text" id="${searchItemId}-${name}" placeholder="${placeholder}">`,
      attachControls: (searchItemId) => {
        new Def.Autocompleter.Search(`${searchItemId}-${name}`, null, {
          fhir: {
            search: function (fieldVal, count) {
              return {
                then: function (success, error) {
                  getCurrentClient().getWithCache(`${resourceName}?${filterName}=${fieldVal}&_count=${count}`, (status, data) => {
                    if (status === 200) {
                      success({
                        "resourceType": "ValueSet",
                        "expansion": {
                          "total": data.total,
                          "contains": (data.entry || []).map(item => ({
                            code: /*resourceName + '/' + */item.resource.id,
                            display: itemToString(item)
                          }))
                        }
                      })
                    } else {
                      error(data);
                    }
                  });
                }
              };
            }
          },
          maxSelect: '*',
          matchListValue: true
        });
      },
      detachControls: (searchItemId) => {
        getAutocompleterById(`${searchItemId}-${name}`).destroy();
      },
      getCondition: (searchItemId) => {
        const codes = getAutocompleterById(`${searchItemId}-${name}`).getSelectedCodes().join(',');
        return codes ? `&${name}=${encodeURIComponent(codes)}` : '';
      }
    };
    return _patientParams;
  }, {});
}
