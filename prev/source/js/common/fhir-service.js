import { FhirBatchQuery } from '../../../../src/app/shared/fhir-backend/fhir-batch-query';

// Create a common FhirBatchQuery instance for making requests to the FHIR REST API Service
let fhirClient = new FhirBatchQuery({
  serviceBaseUrl: 'https://lforms-fhir.nlm.nih.gov/baseR4'
});

/**
 * Gets a common FhirBatchQuery instance for making requests to the FHIR REST API Service
 * @return {FhirBatchQuery}
 */
export function getFhirClient() {
  return fhirClient;
}
