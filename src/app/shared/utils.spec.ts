import {
  escapeStringForRegExp,
  escapeFhirSearchParameter,
  encodeFhirSearchParameter,
  modifyStringForSynonyms
} from './utils';

describe('utils.escapeFhirSearchParameter returns expected value for certain input', () => {
  [
    ['xxx$xxx$xxx', 'xxx\\$xxx\\$xxx'],
    ['a,b,c', 'a\\,b\\,c'],
    ['a|b|c', 'a\\|b\\|c']
  ].forEach(([input, output]) => {
    it(`${input}  -->  ${output}`, () => {
      expect(escapeFhirSearchParameter(input)).toBe(output);
    });
  });
});

describe('utils.encodeFhirSearchParameter returns expected value for certain input', () => {
  [
    ['xxx$xxx $xxx', 'xxx%5C%24xxx%20%5C%24xxx'],
    ['a,b, c', 'a%5C%2Cb%5C%2C%20c'],
    ['a|b| c', 'a%5C%7Cb%5C%7C%20c']
  ].forEach(([input, output]) => {
    it(`${input}  -->  ${output}`, () => {
      expect(encodeFhirSearchParameter(input)).toBe(output);
    });
  });
});

describe('utils.escapeStringForRegExp returns expected value for certain input', () => {
  [
    ['ug/mL', 'ug\\/mL'],
    ['a{b}([c]d)$e|#?f+*^', 'a\\{b\\}\\(\\[c\\]d\\)\\$e\\|\\#\\?f\\+\\*\\^']
  ].forEach(([input, output]) => {
    it(`${input}  -->  ${output}`, () => {
      expect(escapeStringForRegExp(input)).toBe(output);
    });
  });
});

describe('modifyStringForSynonyms', () => {
  const WORDSYNONYMS = [
    ['AAA', 'BBB'],
    ['AB', 'ANTIBODY', 'ANTIBODIES']
  ];
  [
    ['AB', 'AB,ANTIBODY,ANTIBODIES'],
    ['AB TITR', 'AB TITR,ANTIBODY TITR,ANTIBODIES TITR']
  ].forEach(([input, output]) => {
    it(`${input}  -->  ${output}`, () => {
      expect(modifyStringForSynonyms(WORDSYNONYMS, input)).toBe(output);
    });
  });
});
