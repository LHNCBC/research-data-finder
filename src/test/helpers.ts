/**
 * This file contains helper functions for unit tests.
 */
import { TestModuleMetadata, TestBed } from '@angular/core/testing';
import { SharedModule } from '../app/shared/shared.module';
import {
  ConnectionStatus,
  FhirBackendService
} from '../app/shared/fhir-backend/fhir-backend.service';
import { FhirBatchQuery } from '@legacy/js/common/fhir-batch-query';
import { SettingsService } from '../app/shared/settings-service/settings.service';
import { filter, take } from 'rxjs/operators';

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
  } = {}
): Promise<void> {
  moduleDef.imports = (moduleDef.imports || []).concat(SharedModule);
  await TestBed.configureTestingModule(moduleDef).compileComponents();
  spyOn(FhirBatchQuery.prototype, 'initialize').and.resolveTo(null);
  const fhirBackend = TestBed.inject(FhirBackendService);
  spyOnProperty(fhirBackend, 'currentVersion').and.returnValue('R4');
  spyOnProperty(fhirBackend, 'features').and.returnValue({
    lastnLookup: true,
    sortObservationsByDate: true,
    sortObservationsByAgeAtEvent: false
  });

  // Mock service base URL to apply default settings
  spyOnProperty(fhirBackend, 'serviceBaseUrl').and.returnValue(
    'someDefaultURL'
  );

  const settingsService = TestBed.inject(SettingsService);
  await settingsService.loadJsonConfig().toPromise();
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
