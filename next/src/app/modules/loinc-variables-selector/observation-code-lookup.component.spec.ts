import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ObservationCodeLookupComponent } from './observation-code-lookup.component';
import { ObservationCodeLookupModule } from './observation-code-lookup.module';
import { Component, ViewChild } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { SharedModule } from '../../shared/shared.module';

@Component({
  template: ` <mat-form-field class="flex">
    <mat-label>Observation codes from FHIR server</mat-label>
    <app-loinc-variables-selector
      [formControl]="selectedLoincItems"
      placeholder="Type and select one or more"
    >
    </app-loinc-variables-selector>
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
});
