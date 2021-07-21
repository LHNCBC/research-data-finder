import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ObservationCodeLookupComponent } from './observation-code-lookup.component';
import { ObservationCodeLookupModule } from './observation-code-lookup.module';
import { Component, ViewChild } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { SharedModule } from '../../shared/shared.module';
import { FhirBatchQuery } from '@legacy/js/common/fhir-batch-query';
import observations from './test-fixtures/observations.json';
import metadata from './test-fixtures/metadata.json';

@Component({
  template: ` <mat-form-field class="flex">
    <mat-label>Observation codes from FHIR server</mat-label>
    <app-observation-code-lookup
      [formControl]="selectedObservationCodes"
      placeholder="Type and select one or more"
    >
    </app-observation-code-lookup>
  </mat-form-field>`
})
class TestHostComponent {
  @ViewChild(ObservationCodeLookupComponent)
  component: ObservationCodeLookupComponent;
  selectedObservationCodes = new FormControl({
    coding: [{ code: '3137-7', system: 'http://loinc.org' }],
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
  ): Promise<any> {
    // @ts-ignore keyCode is deprecated, but autocomplete-lhc uses this property
    input.dispatchEvent(new KeyboardEvent('keydown', { keyCode }));
    return fixture.whenStable();
  }

  [
    {
      description: 'when "lastn" operation is supported',
      beforeEachFn: () => {
        spyOn(FhirBatchQuery.prototype, 'getWithCache').and.callFake((url) => {
          const HTTP_OK = 200;
          if (/\$lastn\?/.test(url) || /Observation/.test(url)) {
            return Promise.resolve({ status: HTTP_OK, data: observations });
          } else if (/metadata$/.test(url)) {
            return Promise.resolve({ status: HTTP_OK, data: metadata });
          }
        });
      }
    },
    {
      description: 'when "lastn" operation is not supported',
      beforeEachFn: () => {
        spyOn(FhirBatchQuery.prototype, 'getWithCache').and.callFake((url) => {
          const HTTP_OK = 200;
          const HTTP_ERROR = 404;
          if (/\$lastn\?/.test(url)) {
            return Promise.reject({ status: HTTP_ERROR, error: 'error' });
          } else if (/Observation/.test(url)) {
            return Promise.resolve({ status: HTTP_OK, data: observations });
          } else if (/metadata$/.test(url)) {
            return Promise.resolve({ status: HTTP_OK, data: metadata });
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
        await keyDownInAutocompleteInput(input, ARROW_DOWN);
        await keyDownInAutocompleteInput(input, ENTER);

        // search by text
        expect(
          FhirBatchQuery.prototype.getWithCache.calls.any((x) =>
            x.args[0].match(/_elements=code,value,component&code:text=H/)
          )
        ).toBeTruthy();
        // search by code
        expect(
          FhirBatchQuery.prototype.getWithCache.calls.any((x) =>
            x.args[0].match(/_elements=code,value,component&code=H/)
          )
        ).toBeTruthy();
        expect(hostComponent.selectedObservationCodes.value.coding.length).toBe(
          2
        );
      });
    });
  });
});
