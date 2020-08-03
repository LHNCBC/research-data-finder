import { toggleCssClass, addCssClass, removeCssClass } from './utils';

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
