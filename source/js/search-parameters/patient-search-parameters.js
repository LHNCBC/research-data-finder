// See https://www.hl7.org/fhir/patient.html#search for description of Patient search parameters

import * as moment from 'moment/min/moment.min';

import { humanNameToString } from '../common/utils';
import {
  dateParameters,
  referenceParameters,
  stringParameters,
  valueSetsParameters
} from './common-descriptions';

/**
 * Mapping from search parameter names to observation table column names.
 * If the name of the search parameter is not mentioned in this mapping,
 * this means that the column has the same name.
 */
const searchNameToColumn = {
  given: 'name',
  phonetic: 'name',
  'address-city': 'address',
  'address-country': 'address',
  'address-postalcode': 'address',
  'address-state': 'address',
  'address-use': 'address',
  telecom: ['phone', 'email']
};

/**
 * Mapping from observation table column names to resource element names.
 * If the column name of the observation table is not mentioned in this mapping,
 * this means that the name of the resource element has the same name.
 */
const columnToResourceElementName = {
  age: 'birthDate',
  birthdate: 'birthDate',
  'death-date': 'deceasedDateTime',
  phone: 'telecom',
  email: 'telecom',
  family: 'name',
  'general-practitioner': 'generalPractitioner',
  organization: 'managingOrganization',
  language: 'communication'
};

export const PATIENT = 'Patient';

export const PatientSearchParameters = () => ({
  // The resource type (for which these search parameters) is used for retrieving entered data from the SearchParameters component
  resourceType: PATIENT,
  // Description of Patient search parameters:
  // column - this value specifies the column name (of the HTML table of the observation data) to show, sometimes could be array of column names
  // getControlsHtml - creates controls for input parameter value(s)
  // attachControls - initializes controls
  // detachControls - removes links to controls
  // getCondition - returns URL parameters string with search condition according to value in controls
  // all functions have parameter searchItemId - generic id for DOM
  description: {
    Age: {
      column: 'age',
      getControlsHtml: (searchItemId) => {
        return `\
from <input type="number" id="${searchItemId}-ageFrom" placeholder="no limit">
to <input type="number" id="${searchItemId}-ageTo" placeholder="no limit"></td>`;
      },
      getCondition: (searchItemId) => {
        const ageFrom = document.getElementById(`${searchItemId}-ageFrom`)
          .value;
        const ageTo = document.getElementById(`${searchItemId}-ageTo`).value;
        return (
          (ageTo ? `&birthdate=ge${ageToBirthDateMin(+ageTo)}` : '') +
          (ageFrom ? `&birthdate=le${ageToBirthDateMax(+ageFrom)}` : '')
        );
      }
    },

    Active: {
      column: 'active',
      getControlsHtml: (searchItemId) =>
        `<label class="boolean-param"><input id="${searchItemId}-active" type="checkbox">whether the patient record is active</label>`,
      getCondition: (searchItemId) =>
        '&active=' + document.getElementById(`${searchItemId}-active`).checked
    },

    // String search parameters:
    // [<display name>, <placeholder>, <search parameter name>]
    ...stringParameters(
      [
        [
          'Address',
          'a server defined search that may match any of the string fields in the Address',
          'address'
        ],
        ['Address: city', 'a city specified in an address', 'address-city'],
        [
          'Address: country',
          'a country specified in an address',
          'address-country'
        ],
        [
          'Address: postal code',
          'a postalCode specified in an address',
          'address-postalcode'
        ],
        ['Address: state', 'a state specified in an address', 'address-state'],
        ['Email', 'a value in an email contact', 'email'],
        ['Phone', 'a value in a phone contact', 'phone'],
        ['Family', 'a portion of the family name of the patient', 'family'],
        ['Given name', 'a portion of the given name of the patient', 'given'],
        [
          'Name',
          'a server defined search that may match any of the string fields in the HumanName',
          'name'
        ],
        [
          'Phonetic name',
          'a portion of either family or given name using some kind of phonetic matching algorithm',
          'phonetic'
        ],
        // TODO: Search by "identifier" doesn't work now, should be replaced with "_id" ??
        ['Identifier', 'a patient identifier', 'identifier'],
        [
          'Telecom details',
          'the value in any kind of telecom details of the patient',
          'telecom'
        ]
      ],
      searchNameToColumn
    ),

    // Search parameters with predefined value set:
    // [<display name>, <placeholder>, <search parameter name>, <set of values|value path to get list from FHIR specification>]
    ...valueSetsParameters(
      [
        [
          'Communication language',
          'language code (irrespective of use value)',
          'language',
          'Patient.communication.language'
        ],
        [
          'Address: use',
          'A use code specified in an address',
          'address-use',
          'Patient.address.use'
        ],
        ['Gender', 'Gender of the patient', 'gender', 'Patient.gender']
      ],
      searchNameToColumn
    ),

    // Date search parameters:
    // [<display name>, <search parameter name>, <resource element path>]
    ...dateParameters(
      [
        [
          'Date of birth',
          'birthdate',
          columnToResourceElementName['birthdate']
        ],
        [
          'Date of death',
          'death-date',
          columnToResourceElementName['death-date']
        ]
      ],
      searchNameToColumn,
      PATIENT
    ),

    // Reference search parameters:
    // [<display name>, <placeholder>, <resource type>, <resource param filter name>, <map function>, <search parameter name>]
    ...referenceParameters(
      [
        [
          'General practitioner',
          "Patient's nominated general practitioner",
          'Practitioner',
          'name',
          (item) => humanNameToString(item.resource.name),
          'general-practitioner'
        ],
        [
          'Linked patients',
          'All patients linked to the given patient',
          'Patient',
          'name',
          (item) => humanNameToString(item.resource.name),
          'link'
        ],
        [
          'Managing organization',
          'The organization that is the custodian of the patient record',
          'Organization',
          'name',
          (item) => item.resource.name,
          'organization'
        ]
      ],
      searchNameToColumn
    )
  },

  columnToResourceElementName
});

/**
 * Minimum date of birth in ISO-8601 format to be <age> years old
 * @param {number} age
 * @return {string}
 */
function ageToBirthDateMin(age) {
  return moment()
    .subtract(age + 1, 'years')
    .add(1, 'day')
    .format('YYYY-MM-DD');
}

/**
 * Maximum date of birth in ISO-8601 format to be <age> years old
 * @param {number} age
 * @return {string}
 */
function ageToBirthDateMax(age) {
  return moment().subtract(age, 'years').format('YYYY-MM-DD');
}
