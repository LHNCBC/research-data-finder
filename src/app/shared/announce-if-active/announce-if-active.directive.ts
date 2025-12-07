import { Directive } from '@angular/core';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { AnnounceIfActiveService } from './announce-if-active.service';

/**
 * Directive to provide a replacement for the LiveAnnouncer service
 * which only announces messages to screenreaders for the active MatStep.
 */
@Directive({
  selector: 'mat-step',
  providers: [
    {
      provide: LiveAnnouncer,
      useClass: AnnounceIfActiveService
    }
  ],
  standalone: false
})
export class AnnounceIfActiveDirective {}
