import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FhirServerSelectComponent } from './fhir-server-select.component';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientModule } from '@angular/common/http';
import { MatLegacyDialogModule as MatDialogModule } from '@angular/material/legacy-dialog';
import { MatLegacyProgressSpinnerModule as MatProgressSpinnerModule } from '@angular/material/legacy-progress-spinner';

describe('FhirServerSelectComponent', () => {
  let component: FhirServerSelectComponent;
  let fixture: ComponentFixture<FhirServerSelectComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [FhirServerSelectComponent],
      imports: [RouterTestingModule, HttpClientModule, MatDialogModule, MatProgressSpinnerModule]
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(FhirServerSelectComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
