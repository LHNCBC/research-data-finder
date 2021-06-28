import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PullDataPageComponent } from './pull-data-page.component';
import { PullDataPageModule } from './pull-data-page.module';
import { SharedModule } from '../../shared/shared.module';
import { FhirBatchQuery } from '@legacy/js/common/fhir-batch-query';
import observations from '../observation-code-lookup/test-fixtures/observations.json';
import metadata from '../observation-code-lookup/test-fixtures/metadata.json';
import observationsForPat106 from './test-fixtures/obs-pat-106.json';
import observationsForPat232 from './test-fixtures/obs-pat-232.json';
import observationsForPat269 from './test-fixtures/obs-pat-269.json';
import {
  ConnectionStatus,
  FhirBackendService
} from '../../shared/fhir-backend/fhir-backend.service';
import { filter, take, tap } from 'rxjs/operators';
import { from } from 'rxjs';

fdescribe('PullDataForCohortComponent', () => {
  let component: PullDataPageComponent;
  let fixture: ComponentFixture<PullDataPageComponent>;
  let fhirBackend: FhirBackendService;

  beforeEach(async () => {
    spyOn(FhirBatchQuery.prototype, 'getWithCache').and.callFake((url) => {
      const HTTP_OK = 200;
      if (/subject=Patient\/([^&]*)&/.test(url)) {
        return Promise.resolve({
          status: HTTP_OK,
          data: {
            'pat-106': observationsForPat106,
            'pat-232': observationsForPat232,
            'pat-269': observationsForPat269
          }[RegExp.$1]
        });
      } else if (/\$lastn\?/.test(url) || /Observation/.test(url)) {
        return Promise.resolve({ status: HTTP_OK, data: observations });
      } else if (/metadata$/.test(url)) {
        return Promise.resolve({ status: HTTP_OK, data: metadata });
      }
    });
    await TestBed.configureTestingModule({
      declarations: [PullDataPageComponent],
      imports: [PullDataPageModule, SharedModule]
    }).compileComponents();
    fixture = TestBed.createComponent(PullDataPageComponent);
    fhirBackend = TestBed.inject(FhirBackendService);
    component = fixture.componentInstance;
    await fhirBackend.initialized
      .pipe(
        filter((status) => {
          return status === ConnectionStatus.Ready;
        }),
        take(1)
      )
      .toPromise();
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show Observations by default', () => {
    expect(component.getCurrentResourceType()).toEqual('Observation');
  });

  it('should initialize on connect', async () => {
    expect(component.unselectedResourceTypes.length).toBeGreaterThan(0);
  });

  it('should convert resourceType to plural form correctly', () => {
    [
      ['Observation', 'Observations'],
      ['ResearchStudy', 'ResearchStudies']
    ].forEach(([resourceType, pluralForm]) =>
      expect(component.getPluralFormOfResourceType(resourceType)).toBe(
        pluralForm
      )
    );
  });

  it('should add/remove tab', async () => {
    fixture.detectChanges();
    component.addTab('Encounter');
    fixture.detectChanges();
    expect(component.getCurrentResourceType()).toEqual('Encounter');

    component.removeTab('Encounter');
    fixture.detectChanges();
    expect(component.getCurrentResourceType()).toEqual('Observation');
  });

  it('should load Observations for cohort of Patients', async () => {
    const arrayOfPatients = [
      { id: 'pat-106' },
      { id: 'pat-232' },
      { id: 'pat-269' }
    ];
    component.patientStream = from(arrayOfPatients);
    // Should collect Patients from input stream
    expect(component.patients).toEqual(arrayOfPatients);

    component.loadResources('Observation', []);
    // Should load 4 of 5 Observations from test fixtures (one Observation per Patient per test)
    let loadedResourceCount = 0;
    await component.resourceStream['Observation']
      .pipe(
        tap({
          next: () => {
            loadedResourceCount++;
          },
          complete: () => {
            expect(loadedResourceCount).toBe(4);
          }
        })
      )
      .toPromise();

    // Verify that matching requests have been sent
    const requests = FhirBatchQuery.prototype.getWithCache.calls.all();
    requests.slice(-3).forEach((request, i) => {
      expect(request.args[0]).toMatch(
        new RegExp(`subject=Patient\\/${arrayOfPatients[i].id}`)
      );
    });
  });
});
