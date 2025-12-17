/**
 * This file is intended to adapt the AriaDescriber service from Angular Material
 * to the needs of the application. The problem with the current service is that
 * it adds matTooltip reading even if the element has its own "aria-label". The
 * only case this doesn't happen is if the "aria-label" text is equal to matTooltip.
 * The service source code and its description can be found here:
 * https://github.com/angular/components/blob/main/src/cdk/a11y/aria-describer/aria-describer.ts
 */
import { Inject, Injectable, DOCUMENT } from '@angular/core';
import { AriaDescriber } from '@angular/cdk/a11y';
import { Platform } from '@angular/cdk/platform';


@Injectable()
export class AriaDescriberService extends AriaDescriber {
  constructor(
    @Inject(DOCUMENT) _document: any,
    _platform?: Platform
  ) {
    super(_document, _platform);
  }

  /**
   * This method used  by MatTooltip component.
   * See the component source code here:
   * https://github.com/angular/components/blob/main/src/material/tooltip/tooltip.ts
   */
  describe(hostElement: Element, message: string | HTMLElement, role?: string): void {
    // Do not add an "aria-described-by" attribute with tooltip text to the source
    // element if it has an "aria-label" attribute:
    if (role === 'tooltip' && hostElement.ariaLabel !== null) {
      return;
    }
    super.describe.apply(this, arguments);
  }

}
