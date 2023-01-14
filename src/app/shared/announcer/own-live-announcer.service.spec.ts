import { TestBed } from '@angular/core/testing';

import { OwnLiveAnnouncerService } from './own-live-announcer.service';
import { AnnouncerModule } from './announcer.module';
import { LiveAnnouncer } from '@angular/cdk/a11y';

describe('OwnLiveAnnouncerService', () => {
  let service: LiveAnnouncer;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [AnnouncerModule] });
    service = TestBed.inject(LiveAnnouncer);
  });

  it('should be created', () => {
    expect(service instanceof OwnLiveAnnouncerService).toBeTruthy();
  });
});
