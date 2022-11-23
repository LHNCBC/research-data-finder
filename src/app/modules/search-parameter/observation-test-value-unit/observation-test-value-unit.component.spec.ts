import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ObservationTestValueUnitComponent } from './observation-test-value-unit.component';
import {
  HttpClientTestingModule,
  HttpTestingController
} from '@angular/common/http/testing';
import { Component, ViewChild } from '@angular/core';
import { UntypedFormControl, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { MatFormFieldModule } from '@angular/material/form-field';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

@Component({
  template: ` <mat-form-field class="flex">
    <mat-label>Test value unit</mat-label>
    <app-observation-test-value-units
      [formControl]="testValueUnit"
      [loincCodes]="loincCodes"
      placeholder="unit code"
    >
    </app-observation-test-value-units>
  </mat-form-field>`
})
class TestHostComponent {
  @ViewChild(ObservationTestValueUnitComponent)
  component: ObservationTestValueUnitComponent;
  testValueUnit = new UntypedFormControl('');
  loincCodes = ['3137-7', '8303-0'];
}

describe('ObservationTestValueUnitComponent', () => {
  let component: ObservationTestValueUnitComponent;
  let hostComponent: TestHostComponent;
  let fixture: ComponentFixture<TestHostComponent>;
  let mockHttp: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [TestHostComponent, ObservationTestValueUnitComponent],
      imports: [
        CommonModule,
        ReactiveFormsModule,
        MatFormFieldModule,
        MatProgressSpinnerModule,
        NoopAnimationsModule,
        HttpClientTestingModule
      ]
    }).compileComponents();

    mockHttp = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(TestHostComponent);
    fixture.detectChanges();
    hostComponent = fixture.componentInstance;
    component = hostComponent.component;
  });

  afterEach(() => {
    // Verify that no unmatched requests are outstanding
    mockHttp.verify();
  });

  it('should create and initialize', () => {
    mockHttp
      .expectOne(
        `https://clinicaltables.nlm.nih.gov/api/loinc_items/v3/search?df=&type=question&ef=units&maxList&terms=&q=LOINC_NUM:3137-7%20OR%208303-0`
      )
      .flush([
        2,
        ['3137-7', '8303-0'],
        {
          units: [
            [{ unit: '[in_us]' }, { unit: 'cm' }, { unit: 'm' }],
            [{ unit: '%' }]
          ]
        },
        [[''], ['']]
      ]);
    expect(component).toBeTruthy();
    expect(component.acInstance.listIsEmpty()).toBeFalsy();
  });
});
