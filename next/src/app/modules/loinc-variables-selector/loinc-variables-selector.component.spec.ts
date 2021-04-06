import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LoincVariablesSelectorComponent } from './loinc-variables-selector.component';
import { LoincVariablesSelectorModule } from './loinc-variables-selector.module';
import { FhirBackendModule } from '../../shared/fhir-backend/fhir-backend.module';
import { SharedModule } from '../../shared/shared.module';

describe('SelectLoincCodesComponent', () => {
  let component: LoincVariablesSelectorComponent;
  let fixture: ComponentFixture<LoincVariablesSelectorComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ LoincVariablesSelectorComponent ],
      imports: [ LoincVariablesSelectorModule, SharedModule ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(LoincVariablesSelectorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
