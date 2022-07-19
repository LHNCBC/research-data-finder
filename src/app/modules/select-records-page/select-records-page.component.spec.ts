import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SelectRecordsPageComponent } from './select-records-page.component';
import { HarnessLoader } from '@angular/cdk/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import {
  configureTestingModule,
  verifyOutstandingRequests
} from '../../../test/helpers';
import { SelectRecordsPageModule } from './select-records-page.module';
import { HttpTestingController } from '@angular/common/http/testing';
import researchStudies from 'src/test/test-fixtures/research-studies.json';
import variables from 'src/test/test-fixtures/variables.json';
import { MatTabGroupHarness } from '@angular/material/tabs/testing';
import { HttpRequest } from '@angular/common/http';
import { By } from '@angular/platform-browser';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MatTableHarness } from '@angular/material/table/testing';
import { CartComponent } from '../cart/cart.component';

describe('SelectRecordsPageComponent', () => {
  let component: SelectRecordsPageComponent;
  let fixture: ComponentFixture<SelectRecordsPageComponent>;
  let mockHttp: HttpTestingController;
  let loader: HarnessLoader;

  beforeEach(async () => {
    await configureTestingModule(
      {
        declarations: [SelectRecordsPageComponent],
        imports: [SelectRecordsPageModule]
      },
      {
        features: {
          hasResearchStudy: true
        }
      }
    );
    mockHttp = TestBed.inject(HttpTestingController);
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SelectRecordsPageComponent);
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
      .query(By.css('mat-tab-body:first-child mat-checkbox label'))
      .nativeElement.click();
    // Add study to cart
    const addButton = await loader.getHarness(
      MatButtonHarness.with({ text: 'Add selected records to Studies cart' })
    );
    await addButton.click();

    // Check for studies in the cart:
    const studyCartEl = fixture.debugElement
      .query(By.css('.mat-tab-body-active'))
      .query(By.directive(CartComponent));
    const studyCart = studyCartEl.componentInstance;
    expect(studyCart.records.length).toEqual(1);
    expect(studyCart.records[0].id).toEqual('phs001603.v1.p1');

    await selectTab('Variables');
    mockHttp
      .expectOne((req: HttpRequest<any>) => {
        return (
          req.url ===
            'https://clinicaltables.nlm.nih.gov/api/dbg_vars/v3/search' &&
          req.params.get('q') === 'study_id:(phs001603.v1.p1)'
        );
      })
      .flush(variables);
  });
});
