import {
  escapeStringForRegExp,
  escapeFhirSearchParameter,
  encodeFhirSearchParameter,
  csvStringToArray,
  modifyStringForSynonyms,
  generateSynonymLookup
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

describe('utils.csvStringToArray returns expected value for certain input', () => {
  [
    ['1,2,3', [['1', '2', '3']]],
    ['"1\n2",3', [['1\n2', '3']]],
    ['1,"2,3"', [['1', '2,3']]],
    [
      '1,"2,\n3"\n4,5,"""6"""',
      [
        ['1', '2,\n3'],
        ['4', '5', '"6"']
      ]
    ]
  ].forEach(([input, output]) => {
    it(`${(input as string).replace(/\n/g, '\\n')}  -->  ${JSON.stringify(
      output
    )}`, () => {
      expect(csvStringToArray(input as string)).toEqual(output as string[][]);
    });
  });
});

describe('modifyStringForSynonyms', () => {
  const WORDSYNONYMS = [
    ['AAA', 'BBB'],
    ['AB', 'ANTIBODY', 'ANTIBODIES']
  ];
  const wordSynonymsLookup = generateSynonymLookup(WORDSYNONYMS);
  [
    ['AB', 'AB,ANTIBODY,ANTIBODIES'],
    ['AB TITR', 'AB TITR,ANTIBODY TITR,ANTIBODIES TITR'],
    ['TITR AB', 'TITR AB,TITR ANTIBODY,TITR ANTIBODIES'],
    [
      'AB AAA',
      'AB AAA,AB BBB,ANTIBODY AAA,ANTIBODY BBB,ANTIBODIES AAA,ANTIBODIES BBB'
    ]
  ].forEach(([input, output]) => {
    it(`${input}  -->  ${output}`, () => {
      expect(modifyStringForSynonyms(wordSynonymsLookup, input)).toBe(output);
    });
  });
});
