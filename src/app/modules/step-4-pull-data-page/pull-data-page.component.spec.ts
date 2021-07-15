import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PullDataPageComponent } from './pull-data-page.component';
import { PullDataPageModule } from './pull-data-page.module';
import { SharedModule } from '../../shared/shared.module';
import observationsForPat106 from './test-fixtures/obs-pat-106.json';
import observationsForPat232 from './test-fixtures/obs-pat-232.json';
import observationsForPat269 from './test-fixtures/obs-pat-269.json';
import encountersForSmart880378 from './test-fixtures/encounter-smart-880378.json';
import researchStudies from './test-fixtures/research-studies.json';
import { chunk } from 'lodash-es';
import {
  ConnectionStatus,
  FhirBackendService
} from '../../shared/fhir-backend/fhir-backend.service';
import { tap } from 'rxjs/operators';
import { from } from 'rxjs';
import {
  HttpClientTestingModule,
  HttpTestingController
} from '@angular/common/http/testing';
import { MatIconTestingModule } from '@angular/material/icon/testing';
import { SettingsService } from '../../shared/settings-service/settings.service';

describe('PullDataForCohortComponent', () => {
  let component: PullDataPageComponent;
  let fixture: ComponentFixture<PullDataPageComponent>;
  let fhirBackend: FhirBackendService;
  let mockHttp: HttpTestingController;
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PullDataPageComponent],
      imports: [
        PullDataPageModule,
        SharedModule,
        HttpClientTestingModule,
        MatIconTestingModule
      ]
    }).compileComponents();
    spyOn(FhirBackendService.prototype, 'initializeFhirBatchQuery');
    fhirBackend = TestBed.inject(FhirBackendService);
    spyOnProperty(fhirBackend, 'currentVersion').and.returnValue('R4');
    spyOnProperty(fhirBackend, 'features').and.returnValue({
      lastnLookup: true,
      sortObservationsByDate: true,
      sortObservationsByAgeAtEvent: false
    });
    fhirBackend.settings = TestBed.inject(SettingsService);
    fhirBackend.initialized.next(ConnectionStatus.Ready);
    mockHttp = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(PullDataPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    // Verify that no unmatched requests are outstanding
    mockHttp.verify();
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
    const testData = [
      { patient: { id: 'pat-106' }, observations: observationsForPat106 },
      { patient: { id: 'pat-232' }, observations: observationsForPat232 },
      { patient: { id: 'pat-269' }, observations: observationsForPat269 }
    ];
    const arrayOfPatients = testData.map((item) => item.patient);
    component.patientStream = from(arrayOfPatients);
    // Should collect Patients from input stream
    expect(component.patients).toEqual(arrayOfPatients);

    component.loadResources('Observation', []);
    testData.forEach((item) => {
      const patientId = item.patient.id;
      mockHttp
        .expectOne(
          `$fhir/Observation?subject=Patient/${patientId}&_sort=patient,code,-date&_count=1000`
        )
        .flush(item.observations);
    });
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
  });

  it('should load Encounters with correct numbers per patient', async () => {
    const testData = [
      { patient: { id: 'smart-880378' }, encounters: encountersForSmart880378 }
    ];
    const arrayOfPatients = testData.map((item) => item.patient);
    const encountersPerPatient = 2;
    component.patientStream = from(arrayOfPatients);
    // Should collect Patients from input stream
    expect(component.patients).toEqual(arrayOfPatients);

    component.addTab('Encounter');
    fixture.detectChanges();
    component.perPatientFormControls['Encounter'].setValue(
      encountersPerPatient
    );
    component.loadResources('Encounter', []);
    testData.forEach((item) => {
      const patientId = item.patient.id;
      mockHttp
        .expectOne(
          `$fhir/Encounter?subject=Patient/${patientId}&_count=${encountersPerPatient}`
        )
        .flush(item.encounters);
    });
    // Should load 2 resources from test fixtures (2 encounters per Patient)
    let loadedResourceCount = 0;
    await component.resourceStream['Encounter']
      .pipe(
        tap({
          next: () => {
            loadedResourceCount++;
          },
          complete: () => {
            expect(loadedResourceCount).toBe(2);
          }
        })
      )
      .toPromise();
  });

  it('should load all (non-unique) ResearchStudies', async () => {
    const arrayOfPatients = Array.from({ length: 30 }, (_, index) => ({
      id: 'smart-' + index
    }));
    component.patientStream = from(arrayOfPatients);
    // Should collect Patients from input stream
    expect(component.patients).toEqual(arrayOfPatients);

    component.addTab('ResearchStudy');
    fixture.detectChanges();
    component.loadResources('ResearchStudy', []);
    chunk(arrayOfPatients, 1).forEach((patients) => {
      mockHttp
        .expectOne(
          `$fhir/ResearchStudy?_has:ResearchSubject:study:individual=${patients
            .map((patient) => patient.id)
            .join(',')}&_count=1000`
        )
        .flush(researchStudies);
    });
    // Should load all (non-unique) resources from test fixtures
    let loadedResourceCount = 0;
    await component.resourceStream['ResearchStudy']
      .pipe(
        tap({
          next: () => {
            loadedResourceCount++;
          },
          complete: () => {
            expect(loadedResourceCount).toBe(60);
          }
        })
      )
      .toPromise();
  });

  it('should add/remove Patient tab', async () => {
    fixture.detectChanges();
    component.addTab('Patient');
    fixture.detectChanges();
    expect(component.getCurrentResourceType()).toEqual('Patient');

    component.removeTab('Patient');
    fixture.detectChanges();
    expect(component.getCurrentResourceType()).toEqual('Observation');
  });
});
