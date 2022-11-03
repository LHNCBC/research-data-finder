import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AutocompleteParameterValueComponent } from './autocomplete-parameter-value.component';
import { Component, ViewChild } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { SharedModule } from '../../shared/shared.module';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { RouterTestingModule } from '@angular/router/testing';

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
  selectedCodes = new FormControl({
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
    await TestBed.configureTestingModule({
      declarations: [TestHostComponent, AutocompleteParameterValueComponent],
      imports: [
        CommonModule,
        ReactiveFormsModule,
        MatFormFieldModule,
        SharedModule,
        MatProgressSpinnerModule,
        NoopAnimationsModule,
        RouterTestingModule
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
