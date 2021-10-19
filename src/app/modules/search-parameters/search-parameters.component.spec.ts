import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SearchParametersComponent } from './search-parameters.component';
import { SearchParametersModule } from './search-parameters.module';
import {
  ConnectionStatus,
  FhirBackendService
} from '../../shared/fhir-backend/fhir-backend.service';
import { configureTestingModule } from 'src/test/helpers';

describe('SearchParametersComponent', () => {
  let component: SearchParametersComponent;
  let fixture: ComponentFixture<SearchParametersComponent>;
  let fhirBackend: FhirBackendService;

  beforeEach(async () => {
    await configureTestingModule({
      declarations: [SearchParametersComponent],
      imports: [SearchParametersModule]
    });
    fhirBackend = TestBed.inject(FhirBackendService);
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SearchParametersComponent);
    component = fixture.componentInstance;
    spyOn(component.parameterGroupList, 'clear');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should clear the search parameters when connecting to a new server', () => {
    expect(component.parameterGroupList.clear).not.toHaveBeenCalled();
    fhirBackend.initialized.next(ConnectionStatus.Ready);
    expect(component.parameterGroupList.clear).toHaveBeenCalled();
  });
});
