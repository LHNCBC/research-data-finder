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
            getCurrentDefinitions: () => []
          }
        }
      ]
    }).compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SearchParameterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
