import { NgModule } from '@angular/core';
import { A11yModule, LiveAnnouncer } from '@angular/cdk/a11y';
import { OwnLiveAnnouncerService } from './own-live-announcer.service';

/**
 * This module replaces calls to LiveAnnouncer with calls to Def.ScreenReaderLog.
 */
@NgModule({
  declarations: [],
  imports: [A11yModule],
  providers: [
    {
      provide: LiveAnnouncer,
      useClass: OwnLiveAnnouncerService
    }
  ]
})
export class AnnouncerModule {}
