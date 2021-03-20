import { TestBed } from '@angular/core/testing';

import { FhirBackendService } from './fhir-backend.service';
import { FhirBackendModule } from './fhir-backend.module';

describe('FhirBackendService', () => {
  let service: FhirBackendService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [FhirBackendModule]
    });
    service = TestBed.inject(FhirBackendService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
