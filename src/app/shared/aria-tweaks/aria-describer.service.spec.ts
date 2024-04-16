import { TestBed } from '@angular/core/testing';

import { AriaDescriberService } from './aria-describer.service';

describe('OwnAriaDescriberService', () => {
  let service: AriaDescriberService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        AriaDescriberService
      ]
    });
    service = TestBed.inject(AriaDescriberService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
