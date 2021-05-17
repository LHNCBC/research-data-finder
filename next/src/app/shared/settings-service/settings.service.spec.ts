import { TestBed } from '@angular/core/testing';

import { SettingsService } from './settings.service';
import { FhirBackendService } from '../fhir-backend/fhir-backend.service';
import settingsJson from '../../../assets/settings.json';
import {
  HttpClientTestingModule,
  HttpTestingController
} from '@angular/common/http/testing';

describe('SettingsService', () => {
  let service: SettingsService;
  let fhirBackendService: FhirBackendService;
  let httpTestingController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [HttpClientTestingModule] });
    httpTestingController = TestBed.inject(HttpTestingController);
    fhirBackendService = TestBed.inject(FhirBackendService);
    service = TestBed.inject(SettingsService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('read custom settings for dbGap', () => {
    spyOnProperty(fhirBackendService, 'serviceBaseUrl').and.returnValue(
      'https://dbgap-api.ncbi.nlm.nih.gov/fhir/x1'
    );
    service.loadJsonConfig().toPromise();
    httpTestingController.expectOne('assets/settings.json').flush(settingsJson);
    expect(service.get('preferredSystem')).toEqual(
      'urn:oid:2.16.840.1.113883.6.177'
    );
  });
});
