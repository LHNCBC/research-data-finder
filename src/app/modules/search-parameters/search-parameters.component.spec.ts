import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SearchParametersComponent } from './search-parameters.component';
import { SearchParametersModule } from './search-parameters.module';
import {
  ConnectionStatus,
  FhirBackendService
} from '../../shared/fhir-backend/fhir-backend.service';
import { configureTestingModule } from 'src/test/helpers';
import { ErrorManager } from '../../shared/error-manager/error-manager.service';
import { RouterTestingModule } from '@angular/router/testing';

describe('SearchParametersComponent', () => {
  let component: SearchParametersComponent;
  let fixture: ComponentFixture<SearchParametersComponent>;
  let fhirBackend: FhirBackendService;

  beforeEach(async () => {
    await configureTestingModule({
      declarations: [SearchParametersComponent],
      imports: [SearchParametersModule, RouterTestingModule],
      providers: [ErrorManager]
    });
    fhirBackend = TestBed.inject(FhirBackendService);
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(SearchParametersComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should clear the search parameters when connecting to a new server', () => {
    fhirBackend.initialized.next(ConnectionStatus.Ready);
    expect(component.queryCtrl.value.rules.length).toBe(0);
  });

  describe('already selected search parameters', () => {
    let criteria;
    let resourceTypeCriteria;

    beforeEach(() => {
      criteria = component.queryCtrl.value;
      expect(component.selectedSearchParameterNamesMap.size).toBe(0);
      component.addResourceType(criteria);
      resourceTypeCriteria = criteria.rules[0];
    });

    it('should be initialized', () => {
      expect(component.selectedSearchParameterNamesMap.size).toBe(1);
    });

    it('should be updated', () => {
      component.queryBuilderConfig.addRule(resourceTypeCriteria);
      resourceTypeCriteria.rules[0].field = {
        element: 'some-element'
      };
      component.updateSelectedSearchParameterNames(resourceTypeCriteria);
      expect(
        component.selectedSearchParameterNamesMap.get(resourceTypeCriteria)
      ).toEqual(['some-element']);
    });

    it('should be cleared', () => {
      component.queryBuilderConfig.addRule(resourceTypeCriteria);
      resourceTypeCriteria.rules[0].field = {
        element: 'some-element'
      };
      component.updateSelectedSearchParameterNames(resourceTypeCriteria);
      expect(
        component.selectedSearchParameterNamesMap.get(resourceTypeCriteria)
      ).toEqual(['some-element']);

      component.queryBuilderConfig.removeRule(
        resourceTypeCriteria.rules[0],
        resourceTypeCriteria
      );
      expect(
        component.selectedSearchParameterNamesMap.get(resourceTypeCriteria)
      ).toEqual([]);
    });

    it('should be removed', () => {
      component.queryBuilderConfig.removeRule(criteria.rules[0], criteria);
      expect(component.selectedSearchParameterNamesMap.size).toBe(0);
    });
  });
});
