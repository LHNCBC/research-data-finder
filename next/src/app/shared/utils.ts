/**
 * This file exports utility functions meant for common use
 * Please add future utility methods here (as top-level exports)
 */

/**
 * Capitalize the first char and return the string
 */
export function capitalize(str: string): string {
  return str && str.charAt(0).toUpperCase() + str.substring(1);
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
