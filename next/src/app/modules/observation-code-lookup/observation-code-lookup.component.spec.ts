import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ObservationCodeLookupComponent } from './observation-code-lookup.component';
import { ObservationCodeLookupModule } from './observation-code-lookup.module';
import { Component, ViewChild } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { SharedModule } from '../../shared/shared.module';
import { FhirBatchQuery } from '@legacy/js/common/fhir-batch-query';

@Component({
  template: ` <mat-form-field class="flex">
    <mat-label>Observation codes from FHIR server</mat-label>
    <app-observation-code-lookup
      [formControl]="selectedLoincItems"
      placeholder="Type and select one or more"
    >
    </app-observation-code-lookup>
  </mat-form-field>`
})
class TestHostComponent {
  @ViewChild(ObservationCodeLookupComponent)
  component: ObservationCodeLookupComponent;
  selectedLoincItems = new FormControl({
    codes: ['3137-7'],
    items: ['Height cm'],
    datatype: 'Quantity'
  });
}

describe('SelectLoincCodesComponent', () => {
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
    spyOn(FhirBatchQuery.prototype, 'resourcesMapFilter').and.callThrough();
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
      hostComponent.selectedLoincItems.value.codes
    );
    expect(component.acInstance.getSelectedItems()).toEqual(
      hostComponent.selectedLoincItems.value.items
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

    expect(
      FhirBatchQuery.prototype.resourcesMapFilter.calls.mostRecent().args[0]
    ).toEqual(
      'Observation/$lastn?max=1&_elements=code,value,component&code:text=H'
    );
    expect(hostComponent.selectedLoincItems.value.codes.length).toBe(2);
  });
});
