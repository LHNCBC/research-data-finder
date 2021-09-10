import { Component, ViewChildren, QueryList } from '@angular/core';
import { AbstractControl, FormArray, FormControl } from '@angular/forms';
import {
  BaseControlValueAccessor,
  createControlValueAccessorProviders
} from '../base-control-value-accessor';
import { SearchParameter } from 'src/app/types/search.parameter';
import { SearchCondition } from '../../types/search.condition';
import { SearchParameterGroupComponent } from '../search-parameter-group/search-parameter-group.component';
import { ErrorStateMatcher } from '@angular/material/core';
import { ErrorManager } from '../../shared/error-manager/error-manager.service';
import {
  ConnectionStatus,
  FhirBackendService
} from '../../shared/fhir-backend/fhir-backend.service';
import { filter } from 'rxjs/operators';

/**
 * Component for managing resources search parameters
 */
@Component({
  selector: 'app-search-parameters',
  templateUrl: './search-parameters.component.html',
  styleUrls: ['./search-parameters.component.less'],
  providers: [
    ...createControlValueAccessorProviders(SearchParametersComponent),
    {
      provide: ErrorStateMatcher,
      useExisting: ErrorManager
    }
  ]
})
export class SearchParametersComponent extends BaseControlValueAccessor<
  SearchParameter[]
> {
  @ViewChildren(SearchParameterGroupComponent)
  searchParameterGroupComponents: QueryList<SearchParameterGroupComponent>;
  parameterGroupList = new FormArray([]);

  constructor(private fhirBackend: FhirBackendService) {
    super();
    this.parameterGroupList.valueChanges.subscribe((value) => {
      this.onChange(value);
    });

    fhirBackend.initialized
      .pipe(filter((status) => status === ConnectionStatus.Ready))
      .subscribe(() => {
        // Clear search parameters on server change
        this.parameterGroupList.clear();
      });
  }

  /**
   * Add new search parameter group to search parameter group list
   */
  public addParameterGroup(): void {
    this.parameterGroupList.push(
      new FormControl({
        resourceType: '',
        parameters: []
      })
    );
  }

  /**
   * Remove search parameter group from search parameter group list
   */
  public removeParameterGroup(item: AbstractControl): void {
    this.parameterGroupList.removeAt(
      this.parameterGroupList.controls.indexOf(item)
    );
  }

  writeValue(value: SearchParameter[]): void {
    // TODO
  }

  // Get search conditions from each row
  getConditions(): SearchCondition[] {
    const conditions = this.searchParameterGroupComponents
      .map((c) => c.getConditions())
      // Filter out empty resource type or criteria
      .filter((c) => c.resourceType && c.criteria);
    if (!conditions.some((c) => c.resourceType === 'Patient')) {
      // add default Patient condition if missing
      conditions.push({
        resourceType: 'Patient',
        criteria: ''
      });
    }
    return conditions;
  }
}
