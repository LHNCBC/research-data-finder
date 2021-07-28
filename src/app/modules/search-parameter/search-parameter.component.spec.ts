import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SearchParameterComponent } from './search-parameter.component';
import { SearchParametersModule } from '../search-parameters/search-parameters.module';
import { FhirBackendService } from '../../shared/fhir-backend/fhir-backend.service';

describe('SearchParameterComponent', () => {
  let component: SearchParameterComponent;
  let fixture: ComponentFixture<SearchParameterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [SearchParameterComponent],
      imports: [SearchParametersModule],
      providers: [
        {
          provide: FhirBackendService,
          useValue: {
            getCurrentDefinitions: () => {
              return {
                resources: {
                  Observation: {
                    searchParameters: [{ name: 'code' }]
                  }
                }
              };
            }
          }
        }
      ]
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SearchParameterComponent);
    component = fixture.componentInstance;
    component.resourceType = 'Observation';
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should have code text parameter', () => {
    expect(component.parameters).not.toBeNull();
    expect(component.parameters.length).toEqual(2);
    expect(component.parameters).toContain(
      jasmine.objectContaining({ name: 'code text' })
    );
  });
});
