import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BrowseRecordsPageComponent } from './browse-records-page.component';
import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import {
  configureTestingModule,
  verifyOutstandingRequests
} from 'src/test/helpers';
import { BrowseRecordsPageModule } from './browse-records-page.module';
import { HttpTestingController } from '@angular/common/http/testing';
import researchStudies from 'src/test/test-fixtures/research-studies.json';
import threeVariables from 'src/test/test-fixtures/variables-3.json';
import fourVariables from 'src/test/test-fixtures/variables-4.json';
import { MatTabGroupHarness } from '@angular/material/tabs/testing';
import { HttpParams, HttpRequest } from '@angular/common/http';
import { By } from '@angular/platform-browser';
import { MatTableHarness } from '@angular/material/table/testing';
import { ResourceTableComponent } from '../resource-table/resource-table.component';

describe('BrowseRecordsPageComponent', () => {
  let component: BrowseRecordsPageComponent;
  let fixture: ComponentFixture<BrowseRecordsPageComponent>;
  let mockHttp: HttpTestingController;
  let loader: HarnessLoader;

  beforeEach(async () => {
    await configureTestingModule(
      {
        declarations: [BrowseRecordsPageComponent],
        imports: [BrowseRecordsPageModule]
      },
      {
        features: {
          hasAvailableStudy: true
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
    // The first call to getHarness in the expectNumberOfRecords function will
    // never end if the interval is active. This looks like a bug.
    // As a workaround, just do not create the "interval()":
    spyOn(
      ResourceTableComponent.prototype,
      'runPreloadEvents'
    ).and.callFake(() => {});
  });

  afterEach(() => {
    // Verify that no unmatched requests are outstanding
    verifyOutstandingRequests(mockHttp);
  });

  /**
   * Load studies at the beginning
   */
  async function loadStudies(): Promise<void> {
    await fixture.whenStable();
    fixture.detectChanges();
    mockHttp
      .expectOne('$fhir/ResearchStudy?_count=3000')
      .flush(researchStudies);
    await expectNumberOfRecords(2);
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
   * Creates an expectation for the number of records on the current tab.
   * @param n - number of expected records
   */
  async function expectNumberOfRecords(n: number): Promise<void> {
    const tabGroup = await loader.getHarness(MatTabGroupHarness);
    const currentTab = await tabGroup.getSelectedTab();
    const table = await currentTab.getHarness(MatTableHarness);
    const rows = await table.getRows();
    expect(rows.length).toBe(n);
  }

  /**
   * Go to variables tab and load variables.
   */
  async function loadVariables(): Promise<void> {
    (ResourceTableComponent.prototype
      .runPreloadEvents as jasmine.Spy).calls.reset();
    await selectTab('Variables');
    fixture.detectChanges();
    expect(component.variableTable.runPreloadEvents).not.toHaveBeenCalled();
    mockHttp
      .expectOne((req: HttpRequest<any>) => {
        return (
          req.url ===
            'https://clinicaltables.nlm.nih.gov/api/dbg_vars/v3/search' &&
          new HttpParams({ fromString: req.body }).get('q') === ''
        );
      })
      .flush(fourVariables);
    fixture.detectChanges();
    expect(component.variableTable.runPreloadEvents).toHaveBeenCalledOnceWith();
    await expectNumberOfRecords(4);
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
      .queryAll(By.css('mat-tab-body:first-child mat-checkbox label'))[1]
      .nativeElement.click();
    await selectTab('Variables');
    mockHttp
      .expectOne((req: HttpRequest<any>) => {
        return (
          req.url ===
          'https://clinicaltables.nlm.nih.gov/api/dbg_vars/v3/search' &&
          new HttpParams({fromString: req.body}).get('q') ===
          'study_id:(phs002409*)'
        );
      })
      .flush(threeVariables);
    await expectNumberOfRecords(3);
  });

  it('should reload CTSS variables when the sort order changes', async () => {
    await loadStudies();
    await loadVariables();
    // Sort by first column
    fixture.debugElement
      .queryAll(By.css('mat-tab-body:nth-child(2) .mat-sort-header'))[0]
      .nativeElement.click();
    fixture.detectChanges();
    mockHttp
      .expectOne((req: HttpRequest<any>) => {
        return (
          req.url ===
          'https://clinicaltables.nlm.nih.gov/api/dbg_vars/v3/search' &&
          new HttpParams({fromString: req.body}).get('of') ===
          'display_name:desc'
        );
      })
      .flush(threeVariables);
    await expectNumberOfRecords(3);
  });
});
