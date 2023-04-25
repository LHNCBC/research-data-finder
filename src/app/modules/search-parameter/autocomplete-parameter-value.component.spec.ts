import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AutocompleteParameterValueComponent } from './autocomplete-parameter-value.component';
import { Component, ViewChild } from '@angular/core';
import { UntypedFormControl, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { SharedModule } from '../../shared/shared.module';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';
import { configureTestingModule } from 'src/test/helpers';
import { HttpTestingController } from '@angular/common/http/testing';

const imports = [
  CommonModule,
  ReactiveFormsModule,
  MatFormFieldModule,
  SharedModule,
  MatProgressSpinnerModule,
  NoopAnimationsModule,
  RouterTestingModule
];

@Component({
  template: ` <mat-form-field class="flex">
    <mat-label>Search parameter value</mat-label>
    <app-autocomplete-parameter-value
      [formControl]="selectedCodes"
      placeholder="Type and select one or more"
      resourceType="Observation"
      searchParameter="category"
      usePrefetch="true"
      [options]="options"
    >
    </app-autocomplete-parameter-value>
  </mat-form-field>`
})
class TestHostComponent {
  @ViewChild(AutocompleteParameterValueComponent)
  component: AutocompleteParameterValueComponent;
  selectedCodes = new UntypedFormControl({
    codes: [{ code: 'PHY' }, { code: 'PHR' }],
    items: ['Physician', 'Pharmacy']
  });
  options = [
    { code: 'PHY', display: 'Physician' },
    { code: 'PHR', display: 'Pharmacy' }
  ];
}

describe('AutoCompleteTestValueComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let hostComponent: TestHostComponent;
  let component: AutocompleteParameterValueComponent;

  beforeEach(async () => {
    await configureTestingModule({
      declarations: [TestHostComponent, AutocompleteParameterValueComponent],
      imports
    });
  });

  beforeEach(async () => {
    fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    hostComponent = fixture.componentInstance;
    component = hostComponent.component;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize autocomplete search with correct number of selected items', () => {
    expect(component.acInstance).toBeTruthy();
    expect(component.acInstance.getSelectedCodes()).toEqual(
      hostComponent.selectedCodes.value.codes
    );
    expect(component.acInstance.getSelectedItems()).toEqual(
      hostComponent.selectedCodes.value.items
    );
  });

  it('should not allow non-list values', () => {
    const el = component.input.nativeElement;
    el.value = 'someValue';
    el.dispatchEvent(new Event('input'));
    el.dispatchEvent(new Event('blur'));
    expect(el.className.indexOf('invalid') >= 0).toBeTrue();
  });
});

const bundleOfObservationsWithCategories = {
  link: [{ relation: 'next', url: 'nextPageUrl' }],
  entry: [
    {
      resource: {
        category: [
          {
            coding: [
              {
                code: 'someCode1',
                display: 'someValue1'
              }
            ]
          }
        ]
      }
    },
    {
      resource: {
        category: [
          {
            coding: [
              {
                code: 'someCode2',
                display: 'someValue2'
              }
            ]
          }
        ]
      }
    }
  ]
};

const emptyBundle = {};

describe('AutoCompleteTestValueComponent (when FHIR server has the :not modifier issue)', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let hostComponent: TestHostComponent;
  let component: AutocompleteParameterValueComponent;
  let mockHttp: HttpTestingController;

  beforeEach(async () => {
    await configureTestingModule(
      {
        declarations: [TestHostComponent, AutocompleteParameterValueComponent],
        imports
      },
      {
        features: {
          hasNotModifierIssue: true
        }
      }
    );
  });

  beforeEach(async () => {
    fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    hostComponent = fixture.componentInstance;
    component = hostComponent.component;
    mockHttp = TestBed.inject(HttpTestingController);
  });

  it('should use single code:not', function () {
    const resolve = jasmine.createSpy();
    const reject = jasmine.createSpy();
    component.searchItemsOnFhirServer('someValue', 20, resolve, reject);
    mockHttp
      .expectOne('$fhir/Observation?_elements=category&category:text=someValue')
      .flush(bundleOfObservationsWithCategories);
    mockHttp
      .expectOne(
        '$fhir/Observation?_elements=category&category:text=someValue&category:not=someCode1,someCode2'
      )
      .flush(emptyBundle);
    mockHttp.verify();
    expect(resolve).toHaveBeenCalled();
    expect(reject).not.toHaveBeenCalled();
  });
});

describe("AutoCompleteTestValueComponent (when FHIR server doesn't have the :not modifier issue)", () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let hostComponent: TestHostComponent;
  let component: AutocompleteParameterValueComponent;
  let mockHttp: HttpTestingController;

  beforeEach(async () => {
    await configureTestingModule(
      {
        declarations: [TestHostComponent, AutocompleteParameterValueComponent],
        imports
      },
      {
        features: {
          hasNotModifierIssue: false
        }
      }
    );
  });

  beforeEach(async () => {
    fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    hostComponent = fixture.componentInstance;
    component = hostComponent.component;
    mockHttp = TestBed.inject(HttpTestingController);
  });

  it('should use multiple code:not', function () {
    const resolve = jasmine.createSpy();
    const reject = jasmine.createSpy();

    component.searchItemsOnFhirServer('someValue', 20, resolve, reject);
    mockHttp
      .expectOne('$fhir/Observation?_elements=category&category:text=someValue')
      .flush(bundleOfObservationsWithCategories);
    mockHttp
      .expectOne(
        '$fhir/Observation?_elements=category&category:text=someValue&category:not=someCode1&category:not=someCode2'
      )
      .flush(emptyBundle);
    mockHttp.verify();
    expect(resolve).toHaveBeenCalled();
    expect(reject).not.toHaveBeenCalled();
  });
});
