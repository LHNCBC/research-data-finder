// See https://www.hl7.org/fhir/observation.html#search for description of Observation search parameters

import { defaultParameters } from './common-descriptions';

export const OBSERVATION = 'Observation';

export const ObservationSearchParameters = () => ({
  // The resource type (for which these search parameters) is used for retrieving entered data from the SearchParameters component
  resourceType: OBSERVATION,
  // Description of Observation search parameters:
  // column - this value specifies the column name (of the HTML table of the observation data) to show, sometimes could be array of column names
  // getControlsHtml - creates controls for input parameter value(s)
  // attachControls - initializes controls
  // detachControls - removes links to controls
  // getCondition - returns URL parameters string with search condition according to value in controls
  // all functions have parameter searchItemId - generic id for DOM
  description: {
    // Default search parameters:
    ...defaultParameters(OBSERVATION)
  }
});
