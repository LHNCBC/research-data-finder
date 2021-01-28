import { browser, by, element } from 'protractor';

export class AppPage {
  async navigateTo(): Promise<unknown> {
    return browser.get(browser.baseUrl);
  }

  async getAppDescriptionText(): Promise<string> {
    return element(by.css('app-stepper > p:first-child')).getText();
  }
}
