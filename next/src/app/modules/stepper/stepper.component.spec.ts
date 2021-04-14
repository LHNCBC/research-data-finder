import { ComponentFixture, TestBed } from '@angular/core/testing';
import { StepperComponent } from './stepper.component';
import { MatDialog } from '@angular/material/dialog';
import { FhirBackendService } from '../../shared/fhir-backend/fhir-backend.service';
import { BehaviorSubject } from 'rxjs';
import { MockComponent } from 'ng-mocks';
import { SelectColumnsComponent } from '../select-columns/select-columns.component';
import { ViewCohortPageComponent } from '../step-3-view-cohort-page/view-cohort-page.component';
import { SettingsPageComponent } from '../step-1-settings-page/settings-page.component';
import { PullDataPageComponent } from '../step-4-pull-data-page/pull-data-page.component';
import { MatStepperModule } from '@angular/material/stepper';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';

@Component({
  selector: 'app-define-cohort-page',
  template: ''
})
// tslint:disable-next-line:component-class-suffix
class DefineCohortPageComponentStub {
  defineCohortForm = new FormBuilder().group({
    maxPatientsNumber: ['100', Validators.required]
  });
}

describe('StepperComponent', () => {
  let component: StepperComponent;
  let fixture: ComponentFixture<StepperComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [
        StepperComponent,
        MockComponent(SelectColumnsComponent),
        MockComponent(SettingsPageComponent),
        DefineCohortPageComponentStub,
        MockComponent(ViewCohortPageComponent),
        MockComponent(PullDataPageComponent)
      ],
      imports: [
        CommonModule,
        MatStepperModule,
        MatButtonModule,
        MatIconModule,
        NoopAnimationsModule
      ],
      providers: [
        { provide: MatDialog, useValue: {} },
        {
          provide: FhirBackendService,
          useValue: {
            initialized$: new BehaviorSubject(true),
            getColumns: () => [
              {
                displayName: 'ID',
                element: 'id',
                types: ['string'],
                isArray: false,
                visible: false
              },
              {
                displayName: 'Name',
                element: 'name',
                types: ['string'],
                isArray: false,
                visible: true
              }
            ]
          }
        }
      ]
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(StepperComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should get columns', () => {
    expect(component.columns.length).toEqual(2);
    expect(component.visibleColumns.length).toEqual(1);
  });
});
