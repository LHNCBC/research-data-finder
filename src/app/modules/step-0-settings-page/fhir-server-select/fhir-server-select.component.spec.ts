import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FhirServerSelectComponent } from './fhir-server-select.component';
import { RouterTestingModule } from '@angular/router/testing';
import { HttpClientModule } from '@angular/common/http';

describe('FhirServerSelectComponent', () => {
  let component: FhirServerSelectComponent;
  let fixture: ComponentFixture<FhirServerSelectComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [FhirServerSelectComponent],
      imports: [RouterTestingModule, HttpClientModule]
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
