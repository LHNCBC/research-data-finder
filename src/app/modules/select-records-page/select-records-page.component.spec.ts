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
import threeVariables from 'src/test/test-fixtures/variables-3.json';
import fourVariables from 'src/test/test-fixtures/variables-4.json';
import observationsByCodePhv00492021 from 'src/test/test-fixtures/observations-by-code-phv00492021.v1.p1.json';
import observationsByCodePhv00492022 from 'src/test/test-fixtures/observations-by-code-phv00492022.v1.p1.json';
import observationsByCodePhv00492024 from 'src/test/test-fixtures/observations-by-code-phv00492024.v1.p1.json';
import observationsByCodePhv00492025 from 'src/test/test-fixtures/observations-by-code-phv00492025.v1.p1.json';
import { MatTabGroupHarness } from '@angular/material/tabs/testing';
import { HttpRequest } from '@angular/common/http';
import { By } from '@angular/platform-browser';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MatTableHarness } from '@angular/material/table/testing';
import { CartComponent } from '../cart/cart.component';
import { MatCheckboxHarness } from '@angular/material/checkbox/testing';
import { CohortService } from '../../shared/cohort/cohort.service';
import { MatRadioButtonHarness } from '@angular/material/radio/testing';
import tenPatientBundle from '../step-2-define-cohort-page/test-fixtures/patients-10.json';
import { MatMenuHarness } from '@angular/material/menu/testing';
import { SearchParameterGroupComponent } from '../search-parameter-group/search-parameter-group.component';
import { RouterTestingModule } from '@angular/router/testing';

describe('SelectRecordsPageComponent', () => {
  let component: SelectRecordsPageComponent;
  let fixture: ComponentFixture<SelectRecordsPageComponent>;
  let mockHttp: HttpTestingController;
  let loader: HarnessLoader;
  let cohortService: CohortService;
  const code2observations = {
    'phv00492021.v1.p1': observationsByCodePhv00492021,
    'phv00492022.v1.p1': observationsByCodePhv00492022,
    'phv00492024.v1.p1': observationsByCodePhv00492024,
    'phv00492025.v1.p1': observationsByCodePhv00492025
  };
  const statuses = [
    'candidate',
    'eligible',
    'follow-up',
    'ineligible',
    'not-registered',
    'off-study',
    'on-study',
    'on-study-intervention',
    'on-study-observation',
    'pending-on-study',
    'potential-candidate',
    'screening,withdrawn'
  ];

  beforeEach(async () => {
    await configureTestingModule(
      {
        declarations: [SelectRecordsPageComponent],
        imports: [SelectRecordsPageModule, RouterTestingModule]
      },
      {
        features: {
          hasResearchStudy: true
        },
        serverUrl: 'https://dbgap-api.ncbi.nlm.nih.gov/fhir/x1'
      }
    );
    mockHttp = TestBed.inject(HttpTestingController);
    cohortService = TestBed.inject(CohortService);
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
      .expectOne(
        `$fhir/ResearchStudy?_count=3000&_has:ResearchSubject:study:status=${statuses.join(
          ','
        )}`
      )
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
   * @param query - value of the q parameter for the request to the CTSS.
   */
  async function loadVariables(query = ''): Promise<void> {
    await selectTab('Variables');

    mockHttp
      .expectOne((req: HttpRequest<any>) => {
        return (
          req.url ===
            'https://clinicaltables.nlm.nih.gov/api/dbg_vars/v3/search' &&
          req.params.get('q') === query
        );
      })
      .flush(query ? threeVariables : fourVariables);
    await expectNumberOfRecords(query ? 3 : 4);
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
    const addButton = await loader.getHarness(
      MatButtonHarness.with({ text: 'Add selected records to Studies cart' })
    );
    const studyCartEl = fixture.debugElement
      .query(By.css('.mat-tab-body-active'))
      .query(By.directive(CartComponent));
    const studyCart = studyCartEl.componentInstance;
    // Select first study
    const checkBox = (
      await loader.getAllHarnesses(
        MatCheckboxHarness.with({
          selector: 'mat-tab-body:first-child mat-checkbox'
        })
      )
    )[1];
    await checkBox.check();
    // No studies in the cart
    expect(studyCart.listItems.length).toEqual(0);
    // Add the selected study to the cart
    await addButton.click();
    // One study in the cart
    expect(studyCart.listItems.length).toEqual(1);
    expect(studyCart.listItems[0].id).toEqual('phs002409');

    await loadVariables('study_id:(phs002409*)');

    await selectTab('Studies');
    const removeButton = await loader.getHarness(
      MatButtonHarness.with({
        selector: '.mat-tab-body-active app-cart .list-toolbar__icon button'
      })
    );
    // Remove the study from the cart
    await removeButton.click();
    // No studies in the cart
    expect(studyCart.listItems.length).toEqual(0);

    await loadVariables();
  });

  it('should search for patients by study in the cart', async () => {
    await loadStudies();
    const addButton = await loader.getHarness(
      MatButtonHarness.with({ text: 'Add selected records to Studies cart' })
    );
    const studyCartEl = fixture.debugElement
      .query(By.css('.mat-tab-body-active'))
      .query(By.directive(CartComponent));
    const studyCart = studyCartEl.componentInstance;
    // Select first study
    const checkBox = (
      await loader.getAllHarnesses(
        MatCheckboxHarness.with({
          selector: 'mat-tab-body:first-child mat-checkbox'
        })
      )
    )[1];
    await checkBox.check();
    // No studies in the cart
    expect(studyCart.listItems.length).toEqual(0);
    // Add the selected study to the cart
    await addButton.click();
    // One study in the cart
    expect(studyCart.listItems.length).toEqual(1);
    expect(studyCart.listItems[0].id).toEqual('phs002409');

    component.searchForPatients();
    cohortService.patientStream.subscribe();

    mockHttp
      .expectOne(
        '$fhir/Patient?_count=100&_has:ResearchSubject:individual:study=phs002409'
      )
      .flush(tenPatientBundle);
  });

  /**
   * Adds variables to the cart.
   */
  async function addVariablesToCart(): Promise<void> {
    component.maxPatientsNumber.setValue(20);
    await loadStudies();
    await loadVariables();
    const addButton = await loader.getHarness(
      MatButtonHarness.with({ text: 'Add selected records to Variables cart' })
    );
    const variableCartEl = fixture.debugElement
      .query(By.css('.mat-tab-body-active'))
      .query(By.directive(CartComponent));
    const variableCart = variableCartEl.componentInstance;
    const checkBoxes = await loader.getAllHarnesses(
      MatCheckboxHarness.with({
        selector: 'mat-tab-body:nth-child(2) table mat-checkbox'
      })
    );
    expect(checkBoxes.length).toBe(4);
    for (const item of checkBoxes) {
      await item.check();
    }

    await addButton.click();
    expect(variableCart.listItems.length).toEqual(4);

    Object.entries(code2observations).forEach(([code, data]) => {
      mockHttp
        .expectOne(`$fhir/Observation?_count=1&combo-code=${code}`)
        .flush(data);
    });
  }

  it('should search for patients by ANDed variables in the cart', async () => {
    await addVariablesToCart();

    component.searchForPatients();
    cohortService.patientStream.subscribe();

    Object.keys(code2observations).forEach((code, index) => {
      mockHttp
        .expectOne(
          `$fhir/Patient?_total=accurate&_summary=count&_has:Observation:subject:combo-code=${code}`
        )
        .flush({ total: (index + 1) * 10 });
    });

    mockHttp
      .expectOne(
        '$fhir/Patient?_count=20&_has:Observation:subject:combo-code=phv00492021.v1.p1'
      )
      .flush(tenPatientBundle);

    Object.keys(code2observations)
      .slice(1)
      .forEach((code) => {
        tenPatientBundle.entry.forEach((entry) => {
          mockHttp
            .expectOne(
              `$fhir/Patient?_id=${entry.resource.id}&_has:Observation:subject:combo-code=${code}`
            )
            .flush({
              ...tenPatientBundle,
              entry: [entry],
              total: 1
            });
        });
      });
  });

  it('should search for patients by ORed variables in the cart', async () => {
    await addVariablesToCart();

    const orRadioButton = await loader.getHarness(
      MatRadioButtonHarness.with({
        selector: 'mat-tab-body:nth-child(2) app-cart mat-radio-button',
        label: 'OR'
      })
    );
    await orRadioButton.check();

    component.searchForPatients();
    cohortService.patientStream.subscribe();

    mockHttp
      .expectOne(
        '$fhir/Patient?_count=20&_has:Observation:subject:combo-code=phv00492021.v1.p1,phv00492022.v1.p1,phv00492024.v1.p1,phv00492025.v1.p1'
      )
      .flush(tenPatientBundle);
  });

  it('should search for patients by grouped variables in the cart', async () => {
    await addVariablesToCart();
    const groupMenuButton = await loader.getHarness(
      MatButtonHarness.with({ selector: '.list-toolbar button' })
    );
    await groupMenuButton.click();
    const menu = await loader.getHarness(MatMenuHarness);
    await menu.clickItem({
      text: 'Group all records with the same data types'
    });

    component.searchForPatients();
    cohortService.patientStream.subscribe();

    mockHttp
      .expectOne(
        '$fhir/Patient?_total=accurate&_summary=count&_has:Observation:subject:combo-code=phv00492021.v1.p1,phv00492022.v1.p1'
      )
      .flush({ total: 10 });

    mockHttp
      .expectOne(
        '$fhir/Patient?_total=accurate&_summary=count&_has:Observation:subject:combo-code=phv00492024.v1.p1,phv00492025.v1.p1'
      )
      .flush({ total: 20 });

    mockHttp
      .expectOne(
        '$fhir/Patient?_count=20&_has:Observation:subject:combo-code=phv00492021.v1.p1,phv00492022.v1.p1'
      )
      .flush(tenPatientBundle);

    tenPatientBundle.entry.forEach((entry) => {
      mockHttp
        .expectOne(
          `$fhir/Patient?_id=${entry.resource.id}&_has:Observation:subject:combo-code=phv00492024.v1.p1,phv00492025.v1.p1`
        )
        .flush({
          ...tenPatientBundle,
          entry: [entry],
          total: 1
        });
    });
  });

  it('should search for patients by additional criteria', async () => {
    await addVariablesToCart();
    await selectTab('Additional criteria');

    spyOn(
      fixture.debugElement.query(By.directive(SearchParameterGroupComponent))
        .componentInstance,
      'getSearchParamValues'
    ).and.returnValue([
      {
        element: 'deceased',
        value: false
      }
    ]);

    component.searchForPatients();
    cohortService.patientStream.subscribe();

    Object.keys(code2observations).forEach((code, index) => {
      mockHttp
        .expectOne(
          `$fhir/Patient?_total=accurate&_summary=count&_has:Observation:subject:combo-code=${code}`
        )
        .flush({ total: (index + 1) * 10 });
    });
    mockHttp
      .expectOne('$fhir/Patient?_total=accurate&_summary=count&deceased=false')
      .flush({ total: 100 });

    mockHttp
      .expectOne(
        '$fhir/Patient?_count=20&_has:Observation:subject:combo-code=phv00492021.v1.p1'
      )
      .flush(tenPatientBundle);

    Object.keys(code2observations)
      .slice(1)
      .forEach((code) => {
        tenPatientBundle.entry.forEach((entry) => {
          mockHttp
            .expectOne(
              `$fhir/Patient?_id=${entry.resource.id}&_has:Observation:subject:combo-code=${code}`
            )
            .flush({
              ...tenPatientBundle,
              entry: [entry],
              total: 1
            });
        });
      });

    tenPatientBundle.entry.forEach((entry) => {
      mockHttp
        .expectOne(`$fhir/Patient?_id=${entry.resource.id}&deceased=false`)
        .flush({
          ...tenPatientBundle,
          entry: [entry],
          total: 1
        });
    });
  });
});
