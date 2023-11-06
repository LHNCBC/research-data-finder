// An object describing the server features
export interface FhirServerFeatures {
  // Whether the ":not" search parameter modifier is interpreted incorrectly
  // (HAPI FHIR server issue)
  hasNotModifierIssue: boolean;
  // Whether "lastn" operation is available
  // (https://www.hl7.org/fhir/operation-observation-lastn.html)
  lastnLookup: boolean;
  // Whether sorting Observations by date is available
  sortObservationsByDate: boolean;
  // Whether sorting Observations by age-at-event is available
  sortObservationsByAgeAtEvent: boolean;
  // Whether server has Research Study data
  hasResearchStudy: boolean;
  // Whether server has at least one Research Study with Research Subjects
  hasAvailableStudy: boolean;
  // Whether server supports interpretation search parameter
  interpretation: boolean;
  // Whether :missing modifier is supported
  missingModifier: boolean;
  // How many ":has" are allowed per request
  maxHasAllowed: number;
  // Whether batching request is supported
  batch: boolean;
  // Item group that must be included as _security param in dbGap queries
  consentGroup: string;
}
