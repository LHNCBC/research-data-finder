/**
 * This file contains helper functions for unit tests.
 */
import { TestModuleMetadata, TestBed } from '@angular/core/testing';
import { SharedModule } from '../app/shared/shared.module';
import {
  ConnectionStatus,
  FhirBackendService
} from '../app/shared/fhir-backend/fhir-backend.service';
import { FhirBatchQuery } from '../app/shared/fhir-backend/fhir-batch-query';
import { SettingsService } from '../app/shared/settings-service/settings.service';
import { filter, take } from 'rxjs/operators';
import {
  HttpClientTestingModule,
  HttpTestingController
} from '@angular/common/http/testing';
import { HttpRequest } from '@angular/common/http';

/**
 * Wrapper for standard TestBed.configureTestingModule which does additional
 * preparation specific to the project environment:
 *  - mocks FhirBatchQuery prototype functions to remove unnecessary request to
 *  backend.
 *  - loads JSON configuration.
 *  - allows to redefine definitions of columns, search params, and value sets.
 * @param moduleDef - parameter for TestBed.configureTestingModule
 * @param options - object with additional options:
 * @param options.definitions - object which will be returned by
 *   FhirBackendService.getCurrentDefinitions.
 */
export async function configureTestingModule(
  moduleDef: TestModuleMetadata,
  options: {
    definitions?: any;
    features?: any;
  } = {}
): Promise<void> {
  moduleDef.imports = (moduleDef.imports || []).concat(
    SharedModule,
    HttpClientTestingModule
  );
  await TestBed.configureTestingModule(moduleDef).compileComponents();
  spyOn(FhirBatchQuery.prototype, 'initialize').and.resolveTo(null);
  const fhirBackend = TestBed.inject(FhirBackendService);
  spyOnProperty(fhirBackend, 'currentVersion').and.returnValue('R4');
  spyOnProperty(fhirBackend, 'features').and.returnValue({
    lastnLookup: true,
    sortObservationsByDate: true,
    sortObservationsByAgeAtEvent: false,
    ...(options.features ? options.features : {})
  });

  // Mock service base URL to apply default settings
  spyOnProperty(fhirBackend, 'serviceBaseUrl').and.returnValue(
    'someDefaultURL'
  );

  const settingsService = TestBed.inject(SettingsService);
  const mockHttp = TestBed.inject(HttpTestingController);
  settingsService.loadJsonConfig().subscribe();

  // Pass-through for settings file
  mockHttp
    .expectOne(`assets/settings.json5`)
    .flush(await fetch('assets/settings.json5').then((r) => r.text()));

  // We can't expect a request before it is issued, so we give a chance to issue
  // a request
  setTimeout(() => {
    // Pass-through for CSV files
    const request = mockHttp.expectOne((req) => {
      if (req.url.startsWith('conf/csv')) {
        fetch(req.url)
          .then((r) => r.text())
          .then((responseText) => {
            request.flush(responseText);
          });
        return true;
      }
      return false;
    });
  });

  await fhirBackend.initialized
    .pipe(
      filter((status) => status === ConnectionStatus.Ready),
      take(1)
    )
    .toPromise();

  if (options.definitions) {
    spyOn(fhirBackend, 'getCurrentDefinitions').and.returnValue(
      options.definitions
    );
  }
}

/**
 * Verify that no unmatched requests except for SVG icons are outstanding
 */
export function verifyOutstandingRequests(
  mockHttp: HttpTestingController
): void {
  mockHttp
    .match((request: HttpRequest<any>) => /assets\/.*\.svg/.test(request.url))
    .forEach((testReq) => !testReq.cancelled && testReq.flush('<svg></svg>'));
  mockHttp.verify();
}
