import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FhirServerSelectComponent } from './fhir-server-select.component';
import { HttpClientModule } from '@angular/common/http';
import { MatDialogModule } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { configureTestingModule } from 'src/test/helpers';

describe('FhirServerSelectComponent', () => {
  let component: FhirServerSelectComponent;
  let fixture: ComponentFixture<FhirServerSelectComponent>;

  beforeEach(async () => {
    await configureTestingModule({
      declarations: [FhirServerSelectComponent],
      imports: [HttpClientModule, MatDialogModule, MatProgressSpinnerModule]
    }, {
      serverUrl: 'https://lforms-fhir.nlm.nih.gov/baseR4'
    });
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
