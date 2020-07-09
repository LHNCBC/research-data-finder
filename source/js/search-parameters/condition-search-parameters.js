// See https://www.hl7.org/fhir/condition.html#search for description of Condition search parameters

import {
  defaultParameters
} from "./common-descriptions";

export const CONDITION = 'Condition';

export const ConditionSearchParameters = {
  // The resource type (for which these search parameters) is used for retrieving entered data from the SearchParameters component
  resourceType: CONDITION,
  // Description of Condition search parameters:
  // column - this value specifies the column name (of the HTML table of the observation data) to show, sometimes could be array of column names
  // getControlsHtml - creates controls for input parameter value(s)
  // attachControls - initializes controls
  // detachControls - removes links to controls
  // getCondition - returns URL parameters string with search condition according to value in controls
  // all functions have parameter searchItemId - generic id for DOM
  description: {
    // Default search parameters:
    ...defaultParameters(CONDITION)
  }
};
