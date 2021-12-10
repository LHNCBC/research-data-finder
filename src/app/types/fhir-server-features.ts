// An object describing the server features
import BundleEntry = fhir.BundleEntry;

export interface FhirServerFeatures {
  // Whether "lastn" operation is available
  // (https://www.hl7.org/fhir/operation-observation-lastn.html)
  lastnLookup: boolean;
  // Whether sorting Observations by date is available
  sortObservationsByDate: boolean;
  // Whether sorting Observations by age-at-event is available
  sortObservationsByAgeAtEvent: boolean;
  // Whether server has Research Study data
  hasResearchStudy: boolean;
  // Whether batching request is supported
  batch: boolean;
  // Item group that must be included as _security param in dbGap queries
  consentGroup: string;
  // Stored list of EvidenceVariable resources lookup
  evidenceVariables: BundleEntry[];
}
