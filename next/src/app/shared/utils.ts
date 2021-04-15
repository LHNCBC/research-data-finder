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
