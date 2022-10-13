import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BrowseRecordsPageComponent } from './browse-records-page.component';
import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import {
  configureTestingModule,
  verifyOutstandingRequests
} from '../../../test/helpers';
import { BrowseRecordsPageModule } from './browse-records-page.module';
import { HttpTestingController } from '@angular/common/http/testing';
import researchStudies from 'src/test/test-fixtures/research-studies.json';
import variables from 'src/test/test-fixtures/variables-4.json';
import { MatTabGroupHarness } from '@angular/material/tabs/testing';
import { HttpRequest } from '@angular/common/http';
import { By } from '@angular/platform-browser';
import { RouterTestingModule } from '@angular/router/testing';

describe('BrowseRecordsPageComponent', () => {
  let component: BrowseRecordsPageComponent;
  let fixture: ComponentFixture<BrowseRecordsPageComponent>;
  let mockHttp: HttpTestingController;
  let loader: HarnessLoader;

  beforeEach(async () => {
    await configureTestingModule(
      {
        declarations: [BrowseRecordsPageComponent],
        imports: [BrowseRecordsPageModule, RouterTestingModule]
      },
      {
        features: {
          hasResearchStudy: true
        },
        serverUrl: 'https://dbgap-api.ncbi.nlm.nih.gov/fhir/x1'
      }
    );
    mockHttp = TestBed.inject(HttpTestingController);
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(BrowseRecordsPageComponent);
    loader = TestbedHarnessEnvironment.loader(fixture);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    // Verify that no unmatched requests are outstanding
    verifyOutstandingRequests(mockHttp);
  });

  /**
   * Load studies at the beginning
   */
  async function loadStudies(): Promise<void> {
    component.ngAfterViewInit();
    await fixture.whenStable();
    fixture.detectChanges();
    mockHttp
      .expectOne('$fhir/ResearchStudy?_count=50&_sort=title')
      .flush(researchStudies);
  }

  /**
   * Selects a tab by label
   * @param label - tab's label
   */
  async function selectTab(label: string): Promise<void> {
    const tabGroup = await loader.getHarness(MatTabGroupHarness);
    // TODO: "MatTabGroupHarness.selectTab" works but returns a Promise which never resolves.
    tabGroup.selectTab({ label });
    // TODO: The workaround is to add a pause
    await new Promise((resolve) => {
      setTimeout(resolve, 200);
    });
  }

  /**
   * Go to variables tab and load variables.
   */
  async function loadVariables(): Promise<void> {
    await selectTab('Variables');

    mockHttp
      .expectOne((req: HttpRequest<any>) => {
        return (
          req.url ===
            'https://clinicaltables.nlm.nih.gov/api/dbg_vars/v3/search' &&
          req.params.get('q') === ''
        );
      })
      .flush(variables);
  }

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load studies at the beginning', async () => {
    await loadStudies();
  });

  it('should load variables when the selected tab changes', async () => {
    await loadStudies();
    await loadVariables();
  });

  it('should reload variables when the selected studies changes', async () => {
    await loadStudies();
    await loadVariables();
    await selectTab('Studies');
    // Select first study
    fixture.debugElement
      .query(By.css('mat-tab-body:first-child mat-checkbox label'))
      .nativeElement.click();
    await selectTab('Variables');
    mockHttp
      .expectOne((req: HttpRequest<any>) => {
        return (
          req.url ===
            'https://clinicaltables.nlm.nih.gov/api/dbg_vars/v3/search' &&
          req.params.get('q') === 'study_id:(phs001603.v1.p1*)'
        );
      })
      .flush(variables);
  });
});
