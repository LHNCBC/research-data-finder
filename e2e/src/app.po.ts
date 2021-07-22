import { browser, by, element } from 'protractor';
import { ElementFinder } from 'protractor/built/element';

export class AppPage {
  async navigateTo(url = ''): Promise<unknown> {
    return browser.get(browser.baseUrl + url);
  }

  getAppDescription(): ElementFinder {
    return element(by.css('app-stepper > p:first-child'));
  }
}
