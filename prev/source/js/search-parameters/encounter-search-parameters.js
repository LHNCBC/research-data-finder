// See https://www.hl7.org/fhir/encounter.html#search for description of Encounter search parameters

import { humanNameToString } from '../common/utils';
import { defaultParameters, referenceParameters } from './common-descriptions';

/**
 * Mapping from search parameter names to observation table column names.
 * If the name of the search parameter is not mentioned in this mapping,
 * this means that the column has the same name.
 */
const searchNameToColumn = {};

/**
 * Mapping from observation table column names to resource element names.
 * If the column name of the observation table is not mentioned in this mapping,
 * this means that the name of the resource element has the same name.
 */
const columnToResourceElementName = {};

export const ENCOUNTER = 'Encounter';

export const EncounterSearchParameters = () => ({
  // The resource type (for which these search parameters) is used for retrieving entered data from the SearchParameters component
  resourceType: ENCOUNTER,
  // Description of Encounter search parameters:
  // column - this value specifies the column name (of the HTML table of the observation data) to show, sometimes could be array of column names
  // getControlsHtml - creates controls for input parameter value(s)
  // attachControls - initializes controls
  // detachControls - removes links to controls
  // getCondition - returns URL parameters string with search condition according to value in controls
  // all functions have parameter searchItemId - generic id for DOM
  description: {
    ...defaultParameters(ENCOUNTER, {
      skip: ['practitioner']
    }),
    // Reference search parameters:
    // [<display name>, <placeholder>, <resource type>, <resource param filter name>, <map function>, <search parameter name>]
    // TODO: It is unclear which criteria should be used for parameters of reference type
    // TODO: We need a separate search form or a set of search parameters for each parameter of the reference type?
    ...referenceParameters(
      [
        [
          'Practitioner',
          'Persons involved in the encounter other than the patient',
          'Practitioner',
          'name',
          (item) => humanNameToString(item.resource.name),
          'practitioner'
        ]
      ],
      searchNameToColumn
    )
  },

  columnToResourceElementName
});
