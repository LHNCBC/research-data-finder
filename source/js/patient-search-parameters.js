// See https://www.hl7.org/fhir/patient.html#search for description of Patient search parameters

import { valueSets } from "./value-sets";
import * as moment from "moment";
import { FhirBatchQuery } from "./fhir-batch-query";
import { getAutocompleterById, humanNameToString } from "./utils";

/**
 * Mapping from search parameter names to observation table column names.
 * If the name of the search parameter is not mentioned in this mapping,
 * this means that the column has the same name.
 */
const searchNameToColumn = {
  'given': 'name',
  'phonetic': 'name',
  'address-city': 'address',
  'address-country': 'address',
  'address-postalcode': 'address',
  'address-state': 'address',
  'address-use': 'address'
};

/**
 * Mapping from observation table column names to resource element names.
 * If the column name of the observation table is not mentioned in this mapping,
 * this means that the name of the resource element has the same name.
 */
const columnToResourceElementName = {
  'age': 'birthDate',
  'birthdate': 'birthDate',
  'death-date': 'deceased',
  'phone': 'telecom',
  'email': 'telecom',
  'family': 'name',
  'general-practitioner': 'generalPractitioner',
  'organization': 'managingOrganization'
};

export const PatientSearchParams = (function () {
  let client;
  return {
    setFhirServer: serviceBaseUrl => {
      client = new FhirBatchQuery({serviceBaseUrl, maxRequestsPerBatch: 1});
    },
    // Description of Patient search parameters:
    // column - this value specifies column name of the observation table
    // getControlsHtml - creates controls for input parameter value(s)
    // attachControls - initializes controls
    // detachControls - removes links to controls
    // getCondition - returns URL parameters string with search condition according to value in controls
    // all functions have parameter searchItemId - generic id for DOM
    description: {
      'Patient age': {
        column: 'age',
        getControlsHtml: (searchItemId) => {
          return `\
from <input type="number" id="${searchItemId}-ageFrom" placeholder="no limit">
to <input type="number" id="${searchItemId}-ageTo" placeholder="no limit"></td>`;
        },
        getCondition: (searchItemId) => {
          const ageFrom = document.getElementById(`${searchItemId}-ageFrom`).value;
          const ageTo = document.getElementById(`${searchItemId}-ageTo`).value;
          return (ageTo ? `&birthdate=ge${ageToBirthDateMin(+ageTo)}` : '')
            + (ageFrom ? `&birthdate=le${ageToBirthDateMax(+ageFrom)}` : '');
        }
      },

      'Patient\'s record is active': {
        column: 'active',
        getControlsHtml: (searchItemId) =>
          `<input id="${searchItemId}-active" type="checkbox">`,
        getCondition: (searchItemId) =>
          '&active=' + document.getElementById(`${searchItemId}-active`).checked
      },

      // String search parameters
      // spread operator "..." is used to merge result of the "reduce" method into the parent object
      ...[
        ['Patient address', 'address'],
        ['Patient address: city', 'address-city'],
        ['Patient address: country', 'address-country'],
        ['Patient address: postal code', 'address-postalcode'],
        ['Patient address: state', 'address-state'],
        ['Patient\'s email', 'email'],
        ['Patient\'s phone', 'phone'],
        ['Patient\'s family', 'family'],
        ['Patient\'s given name', 'given'],
        ['Patient name', 'name'],
        ['Patient phonetic name', 'phonetic'],
        ['Patient\'s identifier', 'identifier'],
        ['Patient\'s communication language', 'language'],
        ['Patient\'s telecom details', 'telecom']
      ].reduce((_patientParams, [displayName, name]) => {
        _patientParams[displayName] = {
          column: mapSearchNameToColumn(name),
          getControlsHtml: (searchItemId) =>
            `<input type="text" style="width:100%" id="${searchItemId}-${name}" placeholder="${name.replace(/-/g, ' ')}">`,
          getCondition: (searchItemId) => {
            const value = document.getElementById(`${searchItemId}-${name}`).value;
            return value.trim() ? `&${name}=${value}` : '';
          }
        };
        return _patientParams;
      }, {}),

      // Search parameters with predefined value set
      // spread operator "..." is used to merge result of the "reduce" method into the parent object
      ...[
        ['Patient address: use', 'address-use', valueSets.addressUse],
        ['Patient gender', 'gender', valueSets.administrativeGenderList]
      ].reduce((_patientParams, [displayName, name, list]) => {
        _patientParams[displayName] = {
          column: mapSearchNameToColumn(name),
          getControlsHtml: (searchItemId) =>
            `<input type="text" id="${searchItemId}-${name}" placeholder="${name.replace(/-/g, ' ')}">`,
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
            return codes ? `&${name}=${codes}` : '';
          }
        };
        return _patientParams;
      }, {}),

      // Date search parameters
      // spread operator "..." is used to merge result of the "reduce" method into the parent object
      ...[
        ['Patient\'s date of birth', 'birthdate'],
        ['Patient\'s date of death', 'death-date']
      ].reduce((_patientParams, [displayName, name]) => {
        _patientParams[displayName] = {
          column: mapSearchNameToColumn(name),
          getControlsHtml: (searchItemId) => {
            return `\
from <input type="date" id="${searchItemId}-${name}-from" placeholder="no limit">
to <input type="date" id="${searchItemId}-${name}-to" placeholder="no limit"></td>`;
          },
          getCondition: (searchItemId) => {
            const from = document.getElementById(`${searchItemId}-${name}-from`).value;
            const to = document.getElementById(`${searchItemId}-${name}-to`).value;

            return (from ? `&${name}=ge${from}` : '')
              + (to ? `&${name}=le${to}` : '');
          }
        };
        return _patientParams;
      }, {}),


      // Reference search parameters
      // spread operator "..." is used to merge result of the "reduce" method into the parent object
      ...[
        ['Patient\'s general practitioner', 'Practitioner', 'name', item => humanNameToString(item.resource.name), 'general-practitioner'],
        ['Patients linked to the given patient', 'Patient', 'name', item => humanNameToString(item.resource.name), 'link'],
        ['Patient\'s managing organization', 'Organization', 'name', item => item.resource.name, 'organization'],
      ].reduce((_patientParams, [displayName, resourceName, filterName, itemToString, name]) => {
        _patientParams[displayName] = {
          column: mapSearchNameToColumn(name),
          getControlsHtml: (searchItemId) =>
            `<input type="text" id="${searchItemId}-${name}" placeholder="${name.replace(/-/g, ' ')}">`,
          attachControls: (searchItemId) => {
            new Def.Autocompleter.Search(`${searchItemId}-${name}`, null, {
              fhir: {
                search: function (fieldVal, count) {
                  return {
                    then: function (success, error) {
                      client.getWithCache(`${resourceName}?${filterName}=${fieldVal}&_count=${count}`, (status, data) => {
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
            return codes ? `&${name}=${codes}` : '';
          }
        };
        return _patientParams;
      }, {})

    },

    mapColumnToResourceElementName: mapColumnToResourceElementName
  }
})();

/**
 * Maps the observation table column name to the resource element name for a request to the FHIR server
 * @param {string} column
 * @return {string}
 */
function mapColumnToResourceElementName(column) {
  return columnToResourceElementName[column] || column;
}

/**
 * Maps search param name to observation column name
 * @param {string} column
 * @return {string}
 */
function mapSearchNameToColumn(column) {
  return searchNameToColumn[column] || column;
}

/**
 * Minimum date of birth in ISO-8601 format to be <age> years old
 * @param {number} age
 * @return {string}
 */
function ageToBirthDateMin(age) {
  return moment().subtract(age + 1, 'years').add(1, 'day').format('YYYY-MM-DD')
}

/**
 * Maximum date of birth in ISO-8601 format to be <age> years old
 * @param {number} age
 * @return {string}
 */
function ageToBirthDateMax(age) {
  return moment().subtract(age, 'years').format('YYYY-MM-DD')
}

