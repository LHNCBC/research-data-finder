import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SelectAnAreaOfInterestComponent } from './select-an-area-of-interest.component';
import { MockComponent } from 'ng-mocks';
import { ResourceTableComponent } from '../resource-table/resource-table.component';
import { MatRadioButton, MatRadioGroup } from '@angular/material/radio';
import { of } from 'rxjs';
import { ReactiveFormsModule } from '@angular/forms';
import { ColumnDescriptionsService } from '../../shared/column-descriptions/column-descriptions.service';
import { MatCheckbox } from '@angular/material/checkbox';
import { configureTestingModule } from '../../../test/helpers';
import { HttpTestingController } from '@angular/common/http/testing';

describe('SelectAnAreaOfInterestComponent', () => {
  let component: SelectAnAreaOfInterestComponent;
  let fixture: ComponentFixture<SelectAnAreaOfInterestComponent>;
  let mockHttp: HttpTestingController;

  beforeEach(async () => {
    await configureTestingModule(
      {
        declarations: [
          SelectAnAreaOfInterestComponent,
          MockComponent(MatRadioGroup),
          MockComponent(MatRadioButton),
          MockComponent(MatCheckbox),
          MockComponent(ResourceTableComponent)
        ],
        imports: [ReactiveFormsModule],
        providers: [
          {
            provide: ColumnDescriptionsService,
            useValue: {
              getVisibleColumns: () => of([]),
              destroy: () => {}
            }
          }
        ]
      },
      {
        definitions: {
          valueSetMapByPath: {
            'ResearchSubject.status': []
          }
        }
      }
    );
    mockHttp = TestBed.inject(HttpTestingController);
  });

  beforeEach(async () => {
    fixture = TestBed.createComponent(SelectAnAreaOfInterestComponent);
    component = fixture.componentInstance;
    await fixture.detectChanges();
  });

  afterEach(() => {
    // Verify that no unmatched requests are outstanding
    mockHttp.verify();
  });

  it('should show table of ResearchStudies', async () => {
    expect(component.showTable).toBeTruthy();
    mockHttp
      .expectOne(
        '$fhir/ResearchStudy?_count=100&_has:ResearchSubject:study:status=&_total=accurate'
      )
      .flush({ entry: [], link: [] });
  });
});
