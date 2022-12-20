import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PullDataPageComponent } from './pull-data-page.component';
import { PullDataPageModule } from './pull-data-page.module';
import { SharedModule } from '../../shared/shared.module';
import observationsForPat106 from './test-fixtures/obs-pat-106.json';
import observationsForPat232 from './test-fixtures/obs-pat-232.json';
import observationsForPat269 from './test-fixtures/obs-pat-269.json';
import encountersForSmart880378 from './test-fixtures/encounter-smart-880378.json';
import researchStudies from 'src/test/test-fixtures/research-studies.json';
import { chunk } from 'lodash-es';
import {
  ConnectionStatus,
  FhirBackendService
} from '../../shared/fhir-backend/fhir-backend.service';
import { FhirBatchQuery } from '../../shared/fhir-backend/fhir-batch-query';
import { filter, last, take } from 'rxjs/operators';
import {
  HttpClientTestingModule,
  HttpTestingController
} from '@angular/common/http/testing';
import { MatIconTestingModule } from '@angular/material/icon/testing';
import { SettingsService } from '../../shared/settings-service/settings.service';
import { SearchParameterGroupComponent } from '../search-parameter-group/search-parameter-group.component';
import { CohortService } from '../../shared/cohort/cohort.service';
import { PullDataService } from '../../shared/pull-data/pull-data.service';
import { RouterTestingModule } from '@angular/router/testing';

describe('PullDataForCohortComponent', () => {
  let component: PullDataPageComponent;
  let fixture: ComponentFixture<PullDataPageComponent>;
  let fhirBackend: FhirBackendService;
  let mockHttp: HttpTestingController;
  let cohort: CohortService;
  let pullData: PullDataService;

  const emptyParameterGroup = {
    hasErrors: () => false,
    getConditions: () => ({
      criteria: ''
    })
  } as SearchParameterGroupComponent;

  const filledParameterGroup = {
    hasErrors: () => false,
    getConditions: () => ({
      criteria: '&combo-code=system1%2F%7Ccode1,system2%2F%7Ccode2'
    })
  } as SearchParameterGroupComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [PullDataPageComponent],
      imports: [
        PullDataPageModule,
        SharedModule,
        HttpClientTestingModule,
        MatIconTestingModule,
        RouterTestingModule
      ]
    }).compileComponents();
    spyOn(FhirBatchQuery.prototype, 'initialize').and.resolveTo(null);
    fhirBackend = TestBed.inject(FhirBackendService);
    cohort = TestBed.inject(CohortService);
    pullData = TestBed.inject(PullDataService);
    spyOnProperty(fhirBackend, 'currentVersion').and.returnValue('R4');
    spyOnProperty(fhirBackend, 'features').and.returnValue({
      lastnLookup: true,
      sortObservationsByDate: true,
      sortObservationsByAgeAtEvent: false
    });

    // Mock service base URL to apply default settings
    spyOnProperty(fhirBackend, 'serviceBaseUrl').and.returnValue(
      'https://lforms-fhir.nlm.nih.gov/baseR4'
    );

    const settingsService = TestBed.inject(SettingsService);
    mockHttp = TestBed.inject(HttpTestingController);
    settingsService.loadJsonConfig().subscribe();

    // Pass-through for settings file
    mockHttp
      .expectOne(`assets/settings.json5`)
      .flush(await fetch('assets/settings.json5').then((r) => r.text()));

    fixture = TestBed.createComponent(PullDataPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  beforeEach(async () => {
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

    // Wait for initialization
    await fhirBackend.initialized
      .pipe(
        filter((status) => status === ConnectionStatus.Ready),
        take(1)
      )
      .toPromise();
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
    cohort.currentState.patients = testData.map((item) => item.patient);

    component.loadResources('Observation', emptyParameterGroup);
    testData.forEach((item) => {
      const patientId = item.patient.id;
      mockHttp
        .expectOne(
          `$fhir/Observation?subject=Patient/${patientId}&_sort=code,-date&_count=1000`
        )
        .flush(item.observations);
    });
    // Should load 4 of 5 Observations from test fixtures (one Observation per Patient per test)
    await pullData.resourceStream['Observation']
      .pipe(last())
      .toPromise()
      .then((resources) => {
        expect(resources.length).toBe(4);
      });
  });

  it('should skip duplicate when loading Observations for a cohort of Patients', async () => {
    const testData = [
      {
        patient: {id: 'pat-106'},
        observations: {
          ...observationsForPat106,
          entry: observationsForPat106.entry.slice(0, 1)
        }
      },
      {
        patient: {id: 'pat-232'},
        observations: {
          ...observationsForPat232,
          entry: observationsForPat232.entry.slice(0, 1)
        }
      },
      {
        patient: {id: 'pat-269'},
        observations: {
          ...observationsForPat269,
          entry: observationsForPat269.entry.slice(0, 1)
        }
      }
    ];
    cohort.currentState.patients = testData.map((item) => item.patient);

    component.loadResources('Observation', filledParameterGroup);
    testData.forEach((item) => {
      const patientId = item.patient.id;
      mockHttp
        .expectOne(
          `$fhir/Observation?subject=Patient/${patientId}&_sort=-date&_count=1&combo-code=system1%2F%7Ccode1`
        )
        .flush(item.observations);
      mockHttp
        .expectOne(
          `$fhir/Observation?subject=Patient/${patientId}&_sort=-date&_count=1&combo-code=system2%2F%7Ccode2`
        )
        .flush(item.observations);
    });

    await pullData.resourceStream['Observation']
      .pipe(last())
      .toPromise()
      .then((resources) => {
        expect(resources.length).toBe(3);
      });
  });

  it('should load Encounters with correct numbers per patient', async () => {
    const testData = [
      { patient: { id: 'smart-880378' }, encounters: encountersForSmart880378 }
    ];
    const arrayOfPatients = testData.map((item) => item.patient);
    const encountersPerPatient = 2;
    cohort.currentState.patients = arrayOfPatients;

    component.addTab('Encounter');
    fixture.detectChanges();
    component.perPatientFormControls['Encounter'].setValue(
      encountersPerPatient
    );
    component.loadResources('Encounter', emptyParameterGroup);
    testData.forEach((item) => {
      const patientId = item.patient.id;
      mockHttp
        .expectOne(
          `$fhir/Encounter?subject=Patient/${patientId}&_count=${encountersPerPatient}`
        )
        .flush(item.encounters);
    });
    // Should load 2 resources from test fixtures (2 encounters per Patient)
    await pullData.resourceStream['Encounter']
      .pipe(last())
      .toPromise()
      .then((resources) => {
        expect(resources.length).toBe(2);
      });
  });

  it('should load all (non-unique) ResearchStudies', async () => {
    const arrayOfPatients = Array.from({ length: 30 }, (_, index) => ({
      id: 'smart-' + index
    }));
    cohort.currentState.patients = arrayOfPatients;

    component.addTab('ResearchStudy');
    fixture.detectChanges();
    component.loadResources('ResearchStudy', emptyParameterGroup);
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
    await pullData.resourceStream['ResearchStudy']
      .pipe(last())
      .toPromise()
      .then((resources) => {
        expect(resources.length).toBe(60);
      });
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

  it('should load Evidence Variables for cohort of Patients', async () => {
    const testData = [
      { patient: { id: 'pat-106' }, observations: observationsForPat106 },
      { patient: { id: 'pat-232' }, observations: observationsForPat232 },
      { patient: { id: 'pat-269' }, observations: observationsForPat269 }
    ];
    cohort.currentState.patients = testData.map((item) => item.patient);

    component.addTab('EvidenceVariable');
    fixture.detectChanges();
    component.perPatientFormControls['EvidenceVariable'].setValue(1000);
    component.loadResources('EvidenceVariable', emptyParameterGroup);
    testData.forEach((item) => {
      const patientId = item.patient.id;
      mockHttp
        .expectOne(
          `$fhir/Observation?subject=Patient/${patientId}&_sort=code,-date&_count=1000`
        )
        .flush(item.observations);
    });

    setTimeout(() => {
      mockHttp
        .expectOne(
          'https://lforms-fhir.nlm.nih.gov/baseR4/EvidenceVariable/phv00492039'
        )
        .flush({
          resourceType: 'EvidenceVariable',
          id: 'phv00492039',
          name: 'ENV_SMOKE_pretrial',
          description: 'Home exposure to smoke prior to trial enrollment'
        });
    });
    await pullData.resourceStream['EvidenceVariable']
      .pipe(last())
      .toPromise()
      .then((resources) => {
        expect(resources.length).toBe(1);
      });
  });
});
