import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SelectAnAreaOfInterestComponent } from './select-an-area-of-interest.component';
import { MockComponent } from 'ng-mocks';
import { ResourceTableComponent } from '../resource-table/resource-table.component';
import { MatRadioButton, MatRadioGroup } from '@angular/material/radio';
import {
  ConnectionStatus,
  FhirBackendService
} from '../../shared/fhir-backend/fhir-backend.service';
import { BehaviorSubject, of } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { ReactiveFormsModule } from '@angular/forms';
import { ColumnDescriptionsService } from '../../shared/column-descriptions/column-descriptions.service';

describe('SelectAnAreaOfInterestComponent', () => {
  let component: SelectAnAreaOfInterestComponent;
  let fixture: ComponentFixture<SelectAnAreaOfInterestComponent>;
  const fakeHttpClient = jasmine.createSpyObj('HttpClient', ['get']);
  fakeHttpClient.get.and.returnValue(of({ entry: [], link: [] }));

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [
        SelectAnAreaOfInterestComponent,
        MockComponent(MatRadioGroup),
        MockComponent(MatRadioButton),
        MockComponent(ResourceTableComponent)
      ],
      imports: [ReactiveFormsModule],
      providers: [
        {
          provide: FhirBackendService,
          useValue: {
            initialized: new BehaviorSubject(ConnectionStatus.Ready)
          }
        },
        {
          provide: HttpClient,
          useValue: fakeHttpClient
        },
        {
          provide: ColumnDescriptionsService,
          useValue: {
            getVisibleColumns: () => of([]),
            destroy: () => {}
          }
        }
      ]
    }).compileComponents();
  });

  beforeEach(async () => {
    fixture = TestBed.createComponent(SelectAnAreaOfInterestComponent);
    component = fixture.componentInstance;
    await fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show table of ResearchStudies', async () => {
    expect(component.showTable).toBeFalse();
    expect(fakeHttpClient.get).not.toHaveBeenCalled();
    component.option.setValue(component.SelectOptions.ResearchStudy);
    await fixture.detectChanges();
    expect(component.showTable).toBeTruthy();
    expect(fakeHttpClient.get).toHaveBeenCalledWith(
      jasmine.stringMatching(/ResearchStudy/)
    );
  });
});
