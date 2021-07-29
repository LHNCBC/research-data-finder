import { SelectedObservationCodes } from './selected-observation-codes';

export interface SearchParameter {
  name?: string;
  // TODO: value type TBD
  value?: any;
  selectedObservationCodes?: SelectedObservationCodes[];
}
