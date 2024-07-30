/**
 * Autocomplete option can have display name, value and description.
 * In simple cases, when the name is equal to the value and there is no
 * description, it can be a string or only have a name property.
 */
export type AutocompleteOption =
  | {
  name: string;
  value?: string;
  desc?: string;
}
  | string;
