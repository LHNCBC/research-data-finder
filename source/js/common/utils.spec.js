import {
  toggleCssClass,
  addCssClass,
  removeCssClass,
  escapeStringForRegExp,
  escapeFhirSearchParameter,
  encodeFhirSearchParameter
} from './utils';

describe('utils.toggleCssClass', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="a" class="a"></div>
      <div id="b" class="b hide"></div>
      <div id="c" class="chide"></div>`;
  });

  [
    ['for selector', (selector) => selector],
    ['for HTMLElement', (selector) => document.querySelector(selector)],
    ['for Array', (selector) => [document.querySelector(selector)]],
    ['for NodeList', (selector) => document.querySelectorAll(selector)]
  ].forEach(([name, paramFn]) => {
    describe(name, () => {
      it('should add class', () => {
        toggleCssClass(paramFn('#a'), 'hide', true);

        expect(document.getElementById('a').className).toBe('a hide');
      });

      it('should remove class', () => {
        toggleCssClass(paramFn('.b'), 'hide', false);

        expect(document.getElementById('b').className).toBe('b');
      });

      it('should do nothing', () => {
        toggleCssClass(paramFn('#c'), 'hide', false);

        expect(document.getElementById('c').className).toBe('chide');
      });
    });
  });
});

describe('utils.addCssClass', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="a" class="a"></div>
      <div id="b" class="b hide"></div>
      <div id="c" class="chide"></div>`;
  });

  [
    ['for selector', (selector) => selector],
    ['for HTMLElement', (selector) => document.querySelector(selector)],
    ['for Array', (selector) => [document.querySelector(selector)]],
    ['for NodeList', (selector) => document.querySelectorAll(selector)]
  ].forEach(([name, paramFn]) => {
    describe(name, () => {
      it('should add class', () => {
        addCssClass(paramFn('#a'), 'hide');

        expect(document.getElementById('a').className).toBe('a hide');
      });

      it('should do nothing', () => {
        addCssClass(paramFn('#b'), 'hide');

        expect(document.getElementById('b').className).toBe('b hide');
      });
    });
  });
});

describe('utils.removeCssClass', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="a" class="a"></div>
      <div id="b" class="b hide"></div>
      <div id="c" class="chide"></div>`;
  });

  [
    ['for selector', (selector) => selector],
    ['for HTMLElement', (selector) => document.querySelector(selector)],
    ['for Array', (selector) => [document.querySelector(selector)]],
    ['for NodeList', (selector) => document.querySelectorAll(selector)]
  ].forEach(([name, paramFn]) => {
    describe(name, () => {
      it('should remove class', () => {
        removeCssClass(paramFn('.b'), 'hide', false);

        expect(document.getElementById('b').className).toBe('b');
      });

      it('should do nothing', () => {
        removeCssClass(paramFn('#c'), 'hide');

        expect(document.getElementById('c').className).toBe('chide');
      });
    });
  });
});

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
