// Selected observation codes
export interface SelectedObservationCodes {
  // An array of codes defined by terminology systems
  coding: ObservationCoding[];
  // An array of plain text representations of the selected Observation codes
  items: string[];
  // Datatype of the selected Observation codes
  datatype: string;
  // Default unit
  defaultUnit?: string;
  defaultUnitSystem?: string;
}

// Code defined by a terminology system
export interface ObservationCoding {
  code: string;
  system: string;
}
