import { Component, ViewChildren, QueryList } from '@angular/core';
import { AbstractControl, FormArray, FormControl } from '@angular/forms';
import {
  BaseControlValueAccessor,
  createControlValueAccessorProviders
} from '../base-control-value-accessor';
import { SearchParameter } from 'src/app/types/search.parameter';
import { SearchCondition } from '../../types/search.condition';
import { SearchParameterGroupComponent } from '../search-parameter-group/search-parameter-group.component';

/**
 * Component for managing resources search parameters
 */
@Component({
  selector: 'app-search-parameters',
  templateUrl: './search-parameters.component.html',
  styleUrls: ['./search-parameters.component.less'],
  providers: createControlValueAccessorProviders(SearchParametersComponent)
})
export class SearchParametersComponent extends BaseControlValueAccessor<
  SearchParameter[]
> {
  @ViewChildren(SearchParameterGroupComponent)
  searchParameterGroupComponents: QueryList<SearchParameterGroupComponent>;
  parameterList = new FormArray([]);

  constructor() {
    super();
    this.parameterList.valueChanges.subscribe((value) => {
      this.onChange(value);
    });
  }

  /**
   * Add new search parameter to search parameter list
   */
  public addParameter(): void {
    this.parameterList.push(
      new FormControl({
        resourceType: '',
        parameters: []
      })
    );
  }

  /**
   * Remove search parameter from search parameter list
   */
  public removeParameter(item: AbstractControl): void {
    this.parameterList.removeAt(this.parameterList.controls.indexOf(item));
  }

  writeValue(value: SearchParameter[]): void {
    // TODO
  }

  // Get search conditions from each row, group them on the resource type
  getConditions(): SearchCondition[] {
    const conditions = this.searchParameterGroupComponents.map((c) =>
      c.getConditions()
    );
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
