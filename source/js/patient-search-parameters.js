import { valueSets } from "./token-value-sets";
import * as moment from "moment";
import { getAutocompleterById } from "./search-parameters";

const searchName2column = {
  'given': 'name',
  'phonetic': 'name',
  'address-city': 'address',
  'address-country': 'address',
  'address-postalcode': 'address',
  'address-state': 'address',
  'address-use': 'address',
  'phone': 'telecom',
  'email': 'telecom',
};

const column2resourceElementName = {
  'age': 'birthDate',
  'birthdate': 'birthDate',
  'death-date' : 'deceased',
  'email': 'telecom',
  'family': 'name',
  'general-practitioner': 'generalPractitioner',
  'organization': 'managingOrganization'
};

export const PatientSearchParams = {
  // Description of Patient search parameters:
  // column - this value specifies column name
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

    'Patient is active': {
      column: 'active',
      getControlsHtml: (searchItemId) =>
        `<input id="${searchItemId}-active" type="checkbox">`,
      getCondition: (searchItemId) =>
        '&active=' + document.getElementById(`${searchItemId}-active`).checked
    },

    // TODO: https://www.hl7.org/fhir/patient.html#search

    // String search parameters
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
      // TODO: not released yet:
      ['Patient\'s identifier', 'identifier'],
      ['Patient\'s communication language', 'language'],
      ['Patients linked to the given patient', 'link'],
      ['Patient\'s telecom details', 'telecom']
    ].reduce((_patientParams, [displayName, name]) => {
      _patientParams[displayName] = {
        column: mapSearchName2column(name),
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
    ...[
      ['Patient address: use', 'address-use', valueSets.addressUse],
      ['Patient gender', 'gender', valueSets.administrativeGenderList]
    ].reduce((_patientParams, [displayName, name, entities]) => {
      _patientParams[displayName] = {
        column: mapSearchName2column(name),
        getControlsHtml: (searchItemId) =>
          `<input type="text" id="${searchItemId}-${name}" placeholder="${name.replace(/-/g, ' ')}">`,
        attachControls: (searchItemId) => {
          new Def.Autocompleter.Prefetch(`${searchItemId}-${name}`, entities.map(item => item.display), {
            codes: entities.map(item => item.code),
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
    ...[
      ['Patient\'s date of birth', 'birthdate'],
      ['Patient\'s date of death', 'death-date'] //TODO as DateTime
    ].reduce((_patientParams, [displayName, name]) => {
      _patientParams[displayName] = {
        column: mapSearchName2column(name),
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
    ...[
      ['Patient\'s nominated general practitioner', 'general-practitioner'],
      ['Patient\'s managing organization', 'organization']
    ].reduce((_patientParams, [displayName, name]) => {
      _patientParams[displayName] = {
        column: mapSearchName2column(name),
        getControlsHtml: (searchItemId) =>
          `<input type="text" id="${searchItemId}-${name}" placeholder="${name.replace(/-/g, ' ')}">`,
        attachControls: (searchItemId) => {
          // TODO: How to get list of possible references ??
          // new Def.Autocompleter.Search(`${searchItemId}-${name}`,
          //   "Some URL??", {
          //   maxSelect: '*',
          //   matchListValue: true
          // });
        },
        detachControls: (searchItemId) => {
          // getAutocompleterById(`${searchItemId}-${name}`).destroy();
        },
        getCondition: (searchItemId) => {
          const codes = getAutocompleterById(`${searchItemId}-${name}`).getSelectedCodes().join(',');
          return codes ? `&${name}=${codes}` : '';
        }
      };
      return _patientParams;
    }, {})

  },

  mapColumn2resourceElementName
};

/**
 * Maps column name from PatientSearchParam.description
 * to resource element name for a request to the FHIR server
 * @param {string} column
 * @return {string}
 */
function mapColumn2resourceElementName(column) {
  return column2resourceElementName[column] || column;
}

/**
 * Maps search param name to column name
 * @param {string} column
 * @return {string}
 */
function mapSearchName2column (column) {
  return searchName2column[column] || column;
}

/**
 * Minimum date of birth in ISO-8601 format to be <age> years old
 * @param {number} age
 * @return {string}
 */
function ageToBirthDateMin(age) {
  return moment().subtract(age+1, 'years').add(1, 'day').format('YYYY-MM-DD')
}

/**
 * Maximum date of birth in ISO-8601 format to be <age> years old
 * @param {number} age
 * @return {string}
 */
function ageToBirthDateMax(age) {
  return moment().subtract(age, 'years').format('YYYY-MM-DD')
}

