import { SelectedObservationCodes } from './selected-observation-codes';

export interface SearchParameter {
  // Search parameter name for HTTP request
  element?: string;
  // Search parameter display name
  displayName?: string;
  // TODO: value type TBD
  value?: any;
  // Data type of "observation value" parameter
  observationDataType?: string;
  selectedObservationCodes?: SelectedObservationCodes;
}
