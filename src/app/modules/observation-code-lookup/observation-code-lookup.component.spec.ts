import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ObservationCodeLookupComponent } from './observation-code-lookup.component';
import { ObservationCodeLookupModule } from './observation-code-lookup.module';
import { Component, ViewChild } from '@angular/core';
import { UntypedFormControl, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { SharedModule } from '../../shared/shared.module';
import { FhirBatchQuery } from '../../shared/fhir-backend/fhir-batch-query';
import observations from './test-fixtures/observations.json';
import observationsDuplicateDisplay
  from './test-fixtures/observations_duplicate_display.json';
import metadata from './test-fixtures/metadata.json';
import { HttpTestingController } from '@angular/common/http/testing';
import { CartService } from '../../shared/cart/cart.service';
import {
  configureTestingModule,
  verifyOutstandingRequests
} from 'src/test/helpers';
import { CohortService } from '../../shared/cohort/cohort.service';

@Component({
  template: `
    <mat-form-field class="flex">
      <mat-label>Observation codes from FHIR server</mat-label>
      <app-observation-code-lookup
          [formControl]="selectedObservationCodes"
          [isPullData]="isPullData"
          placeholder="Type and select one or more"
      >
      </app-observation-code-lookup>
    </mat-form-field>`
})
class TestHostComponent {
  @ViewChild(ObservationCodeLookupComponent)
  component: ObservationCodeLookupComponent;
  isPullData = false;
  selectedObservationCodes = new UntypedFormControl({
    coding: [{code: '3137-7', system: 'http://loinc.org'}],
    items: ['Height cm'],
    datatype: 'Quantity'
  });
}

describe('ObservationCodeLookupComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let hostComponent: TestHostComponent;
  let component: ObservationCodeLookupComponent;

  /**
   * Sends keydown event to specified input
   */
  function keyDownInAutocompleteInput(
    input: HTMLInputElement,
    keyCode: number
  ): Promise<void> {
    // @ts-ignore keyCode is deprecated, but autocomplete-lhc uses this property
    input.dispatchEvent(new KeyboardEvent('keydown', { keyCode }));
    // Let autocompleter and ObservationCodeLookupComponent to react on keydown event
    return new Promise((resolve) => {
      setTimeout(() => resolve(), 100);
    });
  }

  [
    {
      description: 'when "lastn" operation is supported',
      beforeEachFn: () => {
        spyOn(FhirBatchQuery.prototype, '_request')
          .withArgs(jasmine.objectContaining({ method: 'POST' }))
          .and.rejectWith({ status: 404 });
        spyOn(FhirBatchQuery.prototype, 'getWithCache').and.callFake((url) => {
          const HTTP_OK = 200;
          const HTTP_ERROR = 404;
          if (/Duplicate/i.test(url)) {
            return Promise.resolve({
              status: HTTP_OK,
              data: observationsDuplicateDisplay
            });
          } else if (/\$lastn\?/.test(url) || /Observation/.test(url)) {
            return Promise.resolve({ status: HTTP_OK, data: observations });
          } else if (/metadata/.test(url)) {
            return Promise.resolve({ status: HTTP_OK, data: metadata });
          } else if (
            /ResearchStudy/.test(url) ||
            /\/\.well-known\/smart-configuration/.test(url)
          ) {
            return Promise.reject({ status: HTTP_ERROR, error: 'error' });
          } else if (/ResearchSubject/.test(url)) {
            return Promise.reject({
              status: HTTP_ERROR,
              reason: {
                error:
                  'Access denied by rule: Deny access to all but these consent groups: phs002409-1, phs002409-2 -- codes from last denial: [{"code":"phs002410-1","system":"https://dbgap-api.ncbi.nlm.nih.gov/fhir/x1/CodeSystem/DbGaPConcept-SecurityStudyConsent"}]'
              }
            });
          }
        });
      }
    },
    {
      description: 'when "lastn" operation is not supported',
      beforeEachFn: () => {
        spyOn(FhirBatchQuery.prototype, '_request')
          .withArgs(jasmine.objectContaining({ method: 'POST' }))
          .and.rejectWith({ status: 404 });
        spyOn(FhirBatchQuery.prototype, 'getWithCache').and.callFake((url) => {
          const HTTP_OK = 200;
          const HTTP_ERROR = 404;
          if (/\$lastn\?/.test(url)) {
            return Promise.reject({ status: HTTP_ERROR, error: 'error' });
          } else if (/Duplicate/i.test(url)) {
            return Promise.resolve({
              status: HTTP_OK,
              data: observationsDuplicateDisplay
            });
          } else if (/Observation/.test(url)) {
            return /code:not/.test(url)
              ? Promise.resolve({ status: HTTP_OK, data: observations })
              : Promise.resolve({
                  status: HTTP_OK,
                  data: {
                    link: [
                      {
                        relation: 'next',
                        url: 'someUrl'
                      }
                    ],
                    entry: observations.entry
                  }
                });
          } else if (/metadata/.test(url)) {
            return Promise.resolve({ status: HTTP_OK, data: metadata });
          } else if (
            /ResearchStudy/.test(url) ||
            /\/\.well-known\/smart-configuration/.test(url)
          ) {
            return Promise.reject({ status: HTTP_ERROR, error: 'error' });
          } else if (/ResearchSubject/.test(url)) {
            return Promise.reject({
              status: HTTP_ERROR,
              reason: {
                error:
                  'Access denied by rule: Deny access to all but these consent groups: phs002409-1, phs002409-2 -- codes from last denial: [{"code":"phs002410-1","system":"https://dbgap-api.ncbi.nlm.nih.gov/fhir/x1/CodeSystem/DbGaPConcept-SecurityStudyConsent"}]'
              }
            });
          }
        });
      }
    }
  ].forEach(({ description, beforeEachFn }) => {
    describe(description, () => {
      beforeEach(async () => {
        await TestBed.configureTestingModule({
          declarations: [TestHostComponent],
          imports: [
            CommonModule,
            ReactiveFormsModule,
            MatFormFieldModule,
            ObservationCodeLookupModule,
            SharedModule
          ]
        }).compileComponents();
      });

      beforeEach(async () => {
        beforeEachFn();
        fixture = TestBed.createComponent(TestHostComponent);
        fixture.detectChanges();
        hostComponent = fixture.componentInstance;
        component = hostComponent.component;
      });

      it('should create', () => {
        expect(component).toBeTruthy();
      });

      it('should initialize autocomplete correctly', () => {
        expect(component.acInstance).toBeTruthy();
        expect(component.acInstance.getSelectedCodes()).toEqual(
          hostComponent.selectedObservationCodes.value.coding
        );
        expect(component.acInstance.getSelectedItems()).toEqual(
          hostComponent.selectedObservationCodes.value.items
        );
      });

      it('should be able to select an additional item', async () => {
        // get the input element from the DOM
        const hostElement = fixture.nativeElement;
        const input: HTMLInputElement = hostElement.querySelector('input');

        // simulate user entering a new text into the input box
        input.value = 'H';
        const ARROW_DOWN = 40;
        const ENTER = 13;
        input.focus();
        await keyDownInAutocompleteInput(input, ARROW_DOWN);
        // Check if autocompleter displays the dropdown list
        expect(
          (document.querySelector('#searchResults') as HTMLElement).style
            .visibility
        ).toBe('visible');
        await keyDownInAutocompleteInput(input, ARROW_DOWN);
        await keyDownInAutocompleteInput(input, ENTER);

        const requestedUrls = FhirBatchQuery.prototype.getWithCache.calls
          .allArgs()
          .map((params) => params[0]);

        // should include consent groups (currently disabled)
        // expect(requestedUrls).toContain(
        //   jasmine.stringMatching(/_security=phs002409-1,phs002409-2/)
        // );

        // use "code:not" when $last is not used
        expect(requestedUrls).toContain(
          jasmine.stringMatching(
            /(code:not=11881-0&code:not=3137-7&code:not=8302-2&code:not=8303-0|(\$lastn.*&code:text=H))/
          )
        );

        // search by text
        expect(requestedUrls).toContain(
          jasmine.stringMatching(/&code:text=H/)
        );

        // search by code
        expect(requestedUrls).toContain(
          jasmine.stringMatching(/&code=H/)
        );

        expect(hostComponent.selectedObservationCodes.value.coding.length).toBe(
          2
        );
      });

      it('should show distinct code and system for duplicate display', async () => {
        // clear autocomplete selected value
        hostComponent.selectedObservationCodes.setValue(null);
        // get the input element from the DOM
        const hostElement = fixture.nativeElement;
        const input: HTMLInputElement = hostElement.querySelector('input');

        // simulate user entering a new text into the input box
        input.value = 'Duplicate';
        const ARROW_DOWN = 40;
        const ENTER = 13;
        input.focus();
        await keyDownInAutocompleteInput(input, ARROW_DOWN);
        // Check if autocompleter displays the dropdown list
        expect(
          (document.querySelector('#searchResults') as HTMLElement).style
            .visibility
        ).toBe('visible');
        await keyDownInAutocompleteInput(input, ARROW_DOWN);
        await keyDownInAutocompleteInput(input, ENTER);
        await keyDownInAutocompleteInput(input, ARROW_DOWN);
        await keyDownInAutocompleteInput(input, ENTER);
        await keyDownInAutocompleteInput(input, ARROW_DOWN);
        await keyDownInAutocompleteInput(input, ENTER);

        expect(hostComponent.selectedObservationCodes.value.coding.length).toBe(
          3
        );
        expect(hostComponent.selectedObservationCodes.value.items).toEqual([
          'Duplicate Display | code1 | system1',
          'Duplicate Display | code2 | system1',
          'Duplicate Display | code3 | system2'
        ]);
      });
    });
  });
});

describe('ObservationCodeLookupComponent', () => {
  let fixture: ComponentFixture<TestHostComponent>;
  let hostComponent: TestHostComponent;
  let component: ObservationCodeLookupComponent;

  let mockHttp: HttpTestingController;
  let cartService: CartService;
  let cohortService: CohortService;


  beforeEach(async () => {
    await configureTestingModule(
      {
        declarations: [TestHostComponent],
        imports: [
          CommonModule,
          ReactiveFormsModule,
          MatFormFieldModule,
          ObservationCodeLookupModule,
          SharedModule
        ]
      },
      {
        features: {
          hasResearchStudy: true,
          hasAvailableStudy: true
        },
        serverUrl: 'https://dbgap-api.ncbi.nlm.nih.gov/fhir/x1'
      }
    );
    mockHttp = TestBed.inject(HttpTestingController);
    cartService = TestBed.inject(CartService);
    cohortService = TestBed.inject(CohortService);
  });


  beforeEach(() => {
    fixture = TestBed.createComponent(TestHostComponent);
    hostComponent = fixture.componentInstance;
    hostComponent.isPullData = true;
    fixture.detectChanges();
    component = hostComponent.component;
  });


  afterEach(() => {
    // Verify that no unmatched requests are outstanding
    verifyOutstandingRequests(mockHttp);
  });


  it('should use Observations from FHIR server in the pull data step if we don\'t have studies in the cart', () => {
    spyOn(cartService, 'getListItems').and.callFake(() => []);
    spyOn(component, 'setupAutocompleteInputToUseCTSS').and.callThrough();
    spyOn(component, 'setupAutocompleteInputToUseObservations').and.callThrough();
    // @ts-ignore Access to private method
    spyOn(component, 'updateAutocomplete').and.callThrough();
    cohortService.resetCriteria();
    expect(component.setupAutocompleteInputToUseCTSS).not.toHaveBeenCalled();
    expect(component.setupAutocompleteInputToUseObservations).toHaveBeenCalledOnceWith();
    // @ts-ignore Access to private method
    expect(component.updateAutocomplete).toHaveBeenCalledOnceWith();
  });


  it('should use variables from CTSS in the pull data step if we have studies in the cart', () => {
    spyOn(cartService, 'getListItems').and.callFake((resourceType) => {
      return resourceType === 'ResearchStudy' ? [{id: 'someStudyId'}] : [];
    });
    spyOn(component, 'setupAutocompleteInputToUseCTSS').and.callThrough();
    spyOn(component, 'setupAutocompleteInputToUseObservations').and.callThrough();
    // @ts-ignore Access to private method
    spyOn(component, 'updateAutocomplete').and.callThrough();
    cohortService.resetCriteria();
    expect(component.setupAutocompleteInputToUseCTSS).toHaveBeenCalledOnceWith();
    expect(component.setupAutocompleteInputToUseObservations).not.toHaveBeenCalled();
    // @ts-ignore Access to private method
    expect(component.updateAutocomplete).toHaveBeenCalledOnceWith();
  });
});
