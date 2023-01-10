import { Inject, Injectable, SkipSelf } from '@angular/core';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { MatStep, MatStepper } from '@angular/material/stepper';

/**
 * A replacement for the LiveAnnouncer service which only announces messages
 * to screenreaders for the active MatStep.
 */
@Injectable()
export class AnnounceIfActiveService {
  constructor(
    @SkipSelf() private liveAnnouncer: LiveAnnouncer,
    @Inject(MatStepper) private parentStepper: MatStepper,
    @Inject(MatStep) private parentStep: MatStep
  ) {}

  /**
   * Announces a message to screenreaders.
   * @param message Message to be announced to the screenreader.
   * @param args See https://material.angular.io/cdk/a11y/api#LiveAnnouncer
   * @returns Promise that will be resolved when the message is added to the DOM.
   */
  announce(message: string, ...args: any[]): Promise<void> {
    if (this.parentStepper.selected === this.parentStep) {
      return this.liveAnnouncer.announce(message, ...args);
    }
  }

  /**
   * Clears the current text from the announcer element. Can be used to prevent
   * screen readers from reading the text out again while the user is going
   * through the page landmarks.
   */
  clear(): void {
    if (this.parentStepper.selected === this.parentStep) {
      this.liveAnnouncer.clear();
    }
  }
}
