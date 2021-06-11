import {
  escapeStringForRegExp,
  escapeFhirSearchParameter,
  encodeFhirSearchParameter
} from './utils';

describe('utils.escapeFhirSearchParameter returns expected value for certain input', function () {
  [
    ['xxx$xxx$xxx', 'xxx\\$xxx\\$xxx'],
    ['a,b,c', 'a\\,b\\,c'],
    ['a|b|c', 'a\\|b\\|c']
  ].forEach(([input, output]) => {
    it(`${input}  -->  ${output}`, function () {
      expect(escapeFhirSearchParameter(input)).toBe(output);
    });
  });
});

describe('utils.encodeFhirSearchParameter returns expected value for certain input', function () {
  [
    ['xxx$xxx $xxx', 'xxx%5C%24xxx%20%5C%24xxx'],
    ['a,b, c', 'a%5C%2Cb%5C%2C%20c'],
    ['a|b| c', 'a%5C%7Cb%5C%7C%20c']
  ].forEach(([input, output]) => {
    it(`${input}  -->  ${output}`, function () {
      expect(encodeFhirSearchParameter(input)).toBe(output);
    });
  });
});

describe('utils.escapeStringForRegExp returns expected value for certain input', function () {
  [
    ['ug/mL', 'ug\\/mL'],
    ['a{b}([c]d)$e|#?f+*^', 'a\\{b\\}\\(\\[c\\]d\\)\\$e\\|\\#\\?f\\+\\*\\^']
  ].forEach(([input, output]) => {
    it(`${input}  -->  ${output}`, function () {
      expect(escapeStringForRegExp(input)).toBe(output);
    });
  });
});
