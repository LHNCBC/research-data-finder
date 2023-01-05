import { TestBed } from '@angular/core/testing';

import { InitializeSpinnerService } from './initialize-spinner.service';
import { InitializeSpinnerModule } from './initialize-spinner.module';

describe('InitializeSpinnerService', () => {
  let service: InitializeSpinnerService;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [InitializeSpinnerModule] });
    service = TestBed.inject(InitializeSpinnerService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
