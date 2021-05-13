/**
 * This file exports utility functions meant for common use
 * Please add future utility methods here (as top-level exports)
 */

import Bundle = fhir.Bundle;

/**
 * Capitalize the first char and return the string
 */
export function capitalize(str: string): string {
  return str && str.charAt(0).toUpperCase() + str.substring(1);
}

/**
 * Extracts next page URL from a bundle (see: https://www.hl7.org/fhir/http.html#paging)
 */
export function getNextPageUrl(response: Bundle): string | undefined {
  let result;
  return (
    response.link.some(
      (link) => link.relation === 'next' && (result = link.url)
    ) && result
  );
}

/**
 * Escapes a FHIR search parameter string
 * (see https://www.hl7.org/fhir/search.html#escaping)
 */
export function escapeFhirSearchParameter(str: string): string {
  return str.replace(/[$,|]/g, '\\$&');
}

/**
 * Escapes a FHIR search parameter string then encode it with encodeURIComponent
 * (see https://www.hl7.org/fhir/search.html#escaping)
 */
export function encodeFhirSearchParameter(str): string {
  return encodeURIComponent(escapeFhirSearchParameter(str));
}
