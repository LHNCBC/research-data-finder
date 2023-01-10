import { Injectable } from '@angular/core';
import Def from 'autocomplete-lhc';

/**
 * A replacement for the LiveAnnouncer service for our application.
 */
@Injectable()
export class OwnLiveAnnouncerService {
  screenReaderLog = new Def.ScreenReaderLog();

  /**
   * Announces a message to screen readers.
   * @param message Message to be announced to the screenreader.
   * @param args See https://material.angular.io/cdk/a11y/api#LiveAnnouncer
   *   additional args are not supported by Def.ScreenReaderLog.
   * @returns Promise that will be resolved when the message is added to the DOM.
   */
  announce(message: string, ...args: any[]): Promise<void> {
    return new Promise((resolve) => {
      // This 100ms timeout is needed to announce the first "Please wait -
      // initializing data for the selected server" message after a page reload
      // and possibly in other cases.
      // See https://github.com/angular/components/blob/14.2.x/src/cdk/a11y/live-announcer/live-announcer.ts#L114
      setTimeout(() => {
        this.screenReaderLog.add(message);
        resolve();
      }, 100);
    });
  }

  /**
   * Clears the current text from the announcer element. Can be used to prevent
   * screen readers from reading the text out again while the user is going
   * through the page landmarks.
   */
  clear(): void {
    // Impossible with Def.ScreenReaderLog
  }
}
