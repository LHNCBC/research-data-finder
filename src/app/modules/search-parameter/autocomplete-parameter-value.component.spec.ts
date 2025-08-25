import { ComponentFixture, TestBed } from '@angular/core/testing';
import {
  AutocompleteParameterValueComponent
} from './autocomplete-parameter-value.component';
import { Component, ViewChild } from '@angular/core';
import { ReactiveFormsModule, UntypedFormControl } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { SharedModule } from '../../shared/shared.module';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { configureTestingModule } from 'src/test/helpers';
import { HttpTestingController } from '@angular/common/http/testing';

const imports = [
  CommonModule,
  ReactiveFormsModule,
  MatFormFieldModule,
  SharedModule,
  MatProgressSpinnerModule,
  NoopAnimationsModule
];

@Component({
  template: ` <mat-form-field class="flex">
    <mat-label>Search parameter value</mat-label>
    <app-autocomplete-parameter-value
      [formControl]="selectedCodes"
      placeholder="Type and select one or more"
      resourceType="Observation"
      searchParameter="category"
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
        resourceType: 'Observation',
        category: [
          {
            coding: [
              {
                code: 'someCode1',
                system: 'someSystem1',
                display: 'someValue1'
              }
            ]
          }
        ]
      }
    },
    {
      resource: {
        resourceType: 'Observation',
        category: [
          {
            coding: [
              {
                code: 'someCode2',
                system: 'someSystem2',
                display: 'someValue2'
              }
            ]
          }
        ]
      }
    }
  ]
};

const bundleOfObservationsWithoutDisplayForCategories = {
  link: [{ relation: 'next', url: 'nextPageUrl' }],
  entry: [
    {
      resource: {
        resourceType: 'Observation',
        category: [
          {
            coding: [
              {
                code: 'someCode1',
                system: 'someSystem1'
              }
            ]
          }
        ]
      }
    },
    {
      resource: {
        resourceType: 'Observation',
        category: [
          {
            coding: [
              {
                code: 'someCode2'
              }
            ]
          }
        ]
      }
    }
  ]
};

const emptyBundle = {};

describe('AutoCompleteTestValueComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let hostComponent: TestHostComponent;
  let component: AutocompleteParameterValueComponent;
  let mockHttp: HttpTestingController;
  let features = {
    get hasNotModifierIssue() {
      return undefined;
    },
    get missingModifier() {
      return undefined;
    }
  };

  beforeEach(async () => {
    await configureTestingModule(
      {
        declarations: [TestHostComponent, AutocompleteParameterValueComponent],
        imports
      },
      {
        features
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

  it('should use single :not when FHIR server has the :not modifier issue', function () {
    spyOnProperty(features, 'hasNotModifierIssue').and.returnValue(true);
    const resolve = jasmine.createSpy();
    const reject = jasmine.createSpy();
    component.searchItemsOnFhirServer('someValue', 20, resolve, reject).subscribe();
    mockHttp
      .expectOne('$fhir/Observation?_elements=category&category:not=zzz')
      .flush(bundleOfObservationsWithCategories);
    mockHttp
      .expectOne('$fhir/Observation?_elements=category&category:text=someValue')
      .flush(bundleOfObservationsWithCategories);
    mockHttp
      .expectOne(
        '$fhir/Observation?_elements=category&category:text=someValue&category:not=someSystem1%7CsomeCode1,someSystem2%7CsomeCode2'
      )
      .flush(emptyBundle);
    mockHttp.verify();
    expect(resolve).toHaveBeenCalled();
    expect(reject).not.toHaveBeenCalled();
  });

  it("should use multiple :not when FHIR server doesn't have the :not modifier issue", function () {
    spyOnProperty(features, 'hasNotModifierIssue').and.returnValue(false);
    const resolve = jasmine.createSpy();
    const reject = jasmine.createSpy();

    component.searchItemsOnFhirServer('someValue', 20, resolve, reject).subscribe();
    mockHttp
      .expectOne('$fhir/Observation?_elements=category&category:not=zzz')
      .flush(bundleOfObservationsWithCategories);
    mockHttp
      .expectOne('$fhir/Observation?_elements=category&category:text=someValue')
      .flush(bundleOfObservationsWithCategories);
    mockHttp
      .expectOne(
        '$fhir/Observation?_elements=category&category:text=someValue&category:not=someSystem1%7CsomeCode1&category:not=someSystem2%7CsomeCode2'
      )
      .flush(emptyBundle);
    mockHttp.verify();
    expect(resolve).toHaveBeenCalled();
    expect(reject).not.toHaveBeenCalled();
  });

  it('should use :not=zzz when FHIR server does not support :missing modifier', function () {
    spyOnProperty(features, 'hasNotModifierIssue').and.returnValue(true);
    spyOnProperty(features, 'missingModifier').and.returnValue(false);
    const resolve = jasmine.createSpy();
    const reject = jasmine.createSpy();
    component.searchItemsOnFhirServer('', 20, resolve, reject).subscribe();
    mockHttp
      .expectOne('$fhir/Observation?_elements=category&category:not=zzz')
      .flush(bundleOfObservationsWithCategories);
    mockHttp
      .expectOne('$fhir/Observation?_elements=category&category:not=zzz')
      .flush(bundleOfObservationsWithCategories);
    mockHttp
      .expectOne(
        '$fhir/Observation?_elements=category&category:not=someSystem1%7CsomeCode1,someSystem2%7CsomeCode2'
      )
      .flush(emptyBundle);
    mockHttp.verify();
    expect(resolve).toHaveBeenCalled();
    expect(reject).not.toHaveBeenCalled();
  });

  it('should use :missing=false when FHIR server supports :missing modifier', function () {
    spyOnProperty(features, 'hasNotModifierIssue').and.returnValue(true);
    spyOnProperty(features, 'missingModifier').and.returnValue(true);
    const resolve = jasmine.createSpy();
    const reject = jasmine.createSpy();
    component.searchItemsOnFhirServer('', 20, resolve, reject).subscribe();
    mockHttp
      .expectOne('$fhir/Observation?_elements=category&category:missing=false')
      .flush(bundleOfObservationsWithCategories);
    mockHttp
      .expectOne('$fhir/Observation?_elements=category&category:missing=false')
      .flush(bundleOfObservationsWithCategories);
    mockHttp
      .expectOne(
        '$fhir/Observation?_elements=category&category:missing=false&category:not=someSystem1%7CsomeCode1,someSystem2%7CsomeCode2'
      )
      .flush(emptyBundle);
    mockHttp.verify();
    expect(resolve).toHaveBeenCalled();
    expect(reject).not.toHaveBeenCalled();
  });

  it('should use client search after getting possible values from the server if the list of possible values is small', () => {
    spyOnProperty(features, 'hasNotModifierIssue').and.returnValue(true);
    spyOnProperty(features, 'missingModifier').and.returnValue(true);
    const resolve = jasmine.createSpy();
    const reject = jasmine.createSpy();
    component.searchParamDesc = {required: true, valueSet: 'http://hl7.org/fhir/ValueSet/observation-category'};
    component.searchItemsOnFhirServer('someValue', 20, resolve, reject).subscribe();
    mockHttp
      .expectOne('$fhir/Observation?_elements=category&category:missing=false')
      .flush(bundleOfObservationsWithCategories);
    mockHttp
      .expectOne('$fhir/Observation?_elements=category&category:missing=false&category:not=someSystem1%7CsomeCode1,someSystem2%7CsomeCode2')
      .flush(emptyBundle);
    mockHttp.verify();
    expect(resolve).toHaveBeenCalled();
    expect(reject).not.toHaveBeenCalled();
  });

  it('should use client search after getting possible values from the server if the list of possible values has values without display', () => {
    spyOnProperty(features, 'hasNotModifierIssue').and.returnValue(true);
    spyOnProperty(features, 'missingModifier').and.returnValue(true);
    const resolve = jasmine.createSpy();
    const reject = jasmine.createSpy();
    component.searchItemsOnFhirServer('someValue', 20, resolve, reject).subscribe();
    mockHttp
      .expectOne('$fhir/Observation?_elements=category&category:missing=false')
      .flush(bundleOfObservationsWithoutDisplayForCategories);
    mockHttp
      .expectOne('$fhir/Observation?_elements=category&category:missing=false')
      .flush(bundleOfObservationsWithoutDisplayForCategories);
    mockHttp
      .expectOne('$fhir/Observation?_elements=category&category:missing=false&category:not=someSystem1%7CsomeCode1,%7CsomeCode2')
      .flush(emptyBundle);
    mockHttp.verify();
    expect(resolve).toHaveBeenCalled();
    expect(reject).not.toHaveBeenCalled();
  });

  const bundleWithTheSameDisplayTexts = {
    link: [{ relation: 'next', url: 'nextPageUrl' }],
    entry: [
      {
        resource: {
          category: [
            {
              coding: [
                {
                  code: 'someCode1',
                  system: 'someSystem1',
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
                  system: 'someSystem2',
                  display: 'someValue1'
                }
              ]
            }
          ]
        }
      }
    ]
  };

  it('should append code and system to duplicate display texts', () => {
    spyOnProperty(features, 'hasNotModifierIssue').and.returnValue(true);
    spyOnProperty(features, 'missingModifier').and.returnValue(true);
    const resolve = jasmine.createSpy();
    const reject = jasmine.createSpy();
    component.searchParamDesc = {required: true, valueSet: 'http://hl7.org/fhir/ValueSet/observation-category'};
    component.searchItemsOnFhirServer('someValue', 20, resolve, reject).subscribe();
    mockHttp
      .expectOne('$fhir/Observation?_elements=category&category:missing=false')
      .flush(bundleWithTheSameDisplayTexts);
    mockHttp
      .expectOne('$fhir/Observation?_elements=category&category:missing=false&category:not=someSystem1%7CsomeCode1,someSystem2%7CsomeCode2')
      .flush(emptyBundle);
    mockHttp.verify();
    expect(resolve).toHaveBeenCalledWith(
      {
        "resourceType": "ValueSet",
        "expansion": {
          "total": 2,
          "contains": [
            jasmine.objectContaining({
              "display": "someValue1 | someCode1 | someSystem1"
            }),
            jasmine.objectContaining({
              "display": "someValue1 | someCode2 | someSystem2"
            })
          ]
        }
      }
    );
    expect(reject).not.toHaveBeenCalled();
  });
});


@Component({
  template: ` <mat-form-field class="flex">
    <mat-label>Search parameter value</mat-label>
    <app-autocomplete-parameter-value
      [options]="options"
      [formControl]="parameterValue"
      placeholder="Select one or more"
      [resourceType]="resourceType"
      [searchParameter]="searchParameter"
      [columnName]="rootPropertyName"
      [expression]="expression">
    </app-autocomplete-parameter-value>
  </mat-form-field>`
})
class TestHostComponent2 {
  @ViewChild(AutocompleteParameterValueComponent)
  component: AutocompleteParameterValueComponent;
  options = undefined;
  parameterValue = new UntypedFormControl('');
  resourceType = 'MedicationDispense';
  searchParameter = [
    "code",
    "medication"
  ];
  rootPropertyName = [
      "medication",
      "medication"
  ];
  expression = [
      "(MedicationDispense.medication as CodeableConcept)",
      "(MedicationDispense.medication as Reference)"
  ];
}

describe('AutocompleteParameterValueComponent - searchItemsOnFhirServer with combined search parameters', () => {
  let fixture: ComponentFixture<TestHostComponent2>;
  let hostComponent: TestHostComponent2;
  let component: AutocompleteParameterValueComponent;
  let mockHttp: HttpTestingController;
  let features = {
    get hasNotModifierIssue() {
      return undefined;
    },
    get missingModifier() {
      return undefined;
    }
  };


  beforeEach(async () => {
    await configureTestingModule({
      declarations: [TestHostComponent2, AutocompleteParameterValueComponent],
      imports
    }, {
      features
    });
  });

  beforeEach(async () => {
    fixture = TestBed.createComponent(TestHostComponent2);
    fixture.detectChanges();
    hostComponent = fixture.componentInstance;
    component = hostComponent.component;
    mockHttp = TestBed.inject(HttpTestingController);
  });

  it('should aggregate autocomplete items for all combined search parameters', (done) => {
    spyOnProperty(features, 'hasNotModifierIssue').and.returnValue(true);
    spyOnProperty(features, 'missingModifier').and.returnValue(true);

    const resolve = jasmine.createSpy('resolve');
    const reject = jasmine.createSpy('reject');

    const bundle1 = {
      link: [{ relation: 'next', url: 'nextPageUrl' }],
      entry: [{
        resource: {
          "resourceType": "MedicationDispense",
          "medicationCodeableConcept": {
            "coding": [
              {
                "system": "system-Alpha",
                "code": "code-Alpha",
                "display": "someValue - Alpha"
              }
            ]
          }
        }
      }]
    };
    const bundle2 = {
      link: [{ relation: 'next', url: 'nextPageUrl' }],
      entry: [{
        resource: {
          "resourceType": "MedicationDispense",
          "contained": [
            {
              "resourceType": "Medication",
              "id": "containedMedicationResource",
              "code": {
                "coding": [
                  {
                    "system": "system-Beta",
                    "code": "code-Beta",
                    "display": "someValue - Beta"
                  }
                ]
              }
            }
          ],
          "status": "completed",
          "medicationReference": {
            "reference": "#containedMedicationResource"
          }
        }
      }]
    };

    component.searchItemsOnFhirServer('someValue', 10, resolve, reject).subscribe();

    // checkIfValuesHaveNoDisplay for the first param, which is of type CodeableConcept.
    mockHttp.expectOne(req =>
      req.url.endsWith('/MedicationDispense') &&
      req.params.get('_elements') === 'medication' &&
      req.params.get('code:missing') === 'false'
    ).flush(bundle1);

    // checkIfValuesHaveNoDisplay for the second param, which is of type Reference.
    mockHttp.expectOne(req =>
      req.url.endsWith('/MedicationDispense') &&
      req.params.get('_elements') === 'contained,code,medication' &&
      req.params.get('medication.code:missing') === 'false'
    ).flush(bundle2);

    // setTimeout is necessary because References are processed asynchronously
    // in the resolve() function defined in fhirpath, which is called from
    // getCodingsGetter.
    setTimeout(() => {
      // searchItemsOnFhirServer for the first param, which is of type CodeableConcept
      mockHttp.expectOne(req =>
        req.url.endsWith('/MedicationDispense') &&
        req.params.get('_elements') === 'medication' &&
        req.params.get('code:text') === 'someValue'
      ).flush(bundle1);

      // searchItemsOnFhirServer for the second param, which is of type Reference
      mockHttp.expectOne(req =>
        req.url.endsWith('/MedicationDispense') &&
        req.params.get('_elements') === 'contained,code,medication' &&
        req.params.get('medication.code:text') === 'someValue'
      ).flush(bundle2);

      // setTimeout is necessary because References are processed asynchronously
      // in the resolve() function defined in fhirpath, which is called from
      // getCodingsGetter.
      setTimeout(()=> {
        // loading the next page for the first param, which is of type CodeableConcept
        mockHttp.expectOne(req =>
          req.url.endsWith('/MedicationDispense') &&
          req.params.get('_elements') === 'medication' &&
          req.params.get('code:text') === 'someValue' &&
          req.params.get('code:not') === 'system-Alpha|code-Alpha,system-Beta|code-Beta'
        ).flush(emptyBundle);

        // loading the next page for the second param, which is of type Reference
        mockHttp.expectOne(req =>
          req.url.endsWith('/MedicationDispense') &&
          req.params.get('_elements') === 'contained,code,medication' &&
          req.params.get('medication.code:text') === 'someValue' &&
          req.params.get('medication.code:not') === 'system-Alpha|code-Alpha,system-Beta|code-Beta'
        ).flush(emptyBundle);

        setTimeout(() => {
          expect(resolve).toHaveBeenCalledWith(jasmine.objectContaining({
            resourceType: 'ValueSet',
            expansion: jasmine.objectContaining({
              contains: [
                jasmine.objectContaining({
                  code:    'system-Alpha|code-Alpha',
                  display: 'someValue - Alpha'
                }),
                jasmine.objectContaining({
                  code:    'system-Beta|code-Beta',
                  display: 'someValue - Beta'
                })
              ]
            })
          }));
          expect(reject).not.toHaveBeenCalled();
          done();
        }, 0);
      }, 0)
    }, 0);

  });
});
