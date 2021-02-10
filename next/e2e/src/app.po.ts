import { browser, by, element } from 'protractor';
import { ElementFinder } from 'protractor/built/element';

export class AppPage {
  async navigateTo(): Promise<unknown> {
    return browser.get(browser.baseUrl);
  }

  getAppDescription(): ElementFinder {
    return element(by.css('app-stepper > p:first-child'));
  }
}
