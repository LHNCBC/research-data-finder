import { SelectedObservationCodes } from './selected-observation-codes';

export interface SearchParameter {
  element?: string;
  displayName?: string;
  // TODO: value type TBD
  value?: any;
  selectedObservationCodes?: SelectedObservationCodes[];
}
