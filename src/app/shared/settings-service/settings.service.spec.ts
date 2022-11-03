import { TestBed } from '@angular/core/testing';
import { SettingsService } from './settings.service';
import { FhirBackendService } from '../fhir-backend/fhir-backend.service';
import { FhirBackendModule } from '../fhir-backend/fhir-backend.module';
import { RouterTestingModule } from '@angular/router/testing';

describe('SettingsService', () => {
  let service: SettingsService;
  let fhirBackendService: FhirBackendService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [FhirBackendModule, RouterTestingModule]
    });
    fhirBackendService = TestBed.inject(FhirBackendService);
    service = TestBed.inject(SettingsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should read custom settings for dbGap', async () => {
    spyOnProperty(fhirBackendService, 'serviceBaseUrl').and.returnValue(
      'https://dbgap-api.ncbi.nlm.nih.gov/fhir/x1'
    );
    await service.loadJsonConfig().toPromise();
    expect(typeof service.get('definitionsFile')).toBe('string');
  });
});
