import { Component, Input, ViewChildren, QueryList } from '@angular/core';
import { AbstractControl, FormArray, FormControl } from '@angular/forms';
import {
  BaseControlValueAccessor,
  createControlValueAccessorProviders
} from '../base-control-value-accessor';
import { SearchParameter } from 'src/app/types/search.parameter';
import { SearchParameterComponent } from '../search-parameter/search-parameter.component';
import { SearchCondition } from '../../types/search.condition';

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
  /**
   * Limits the list of available search parameters to only parameters for this resource type
   */
  @Input() resourceType = '';
  @ViewChildren(SearchParameterComponent)
  searchParameterComponents: QueryList<SearchParameterComponent>;

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
        resourceType: this.resourceType
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
    const conditions = this.searchParameterComponents.map((c) =>
      c.getConditionUrl()
    );
    const groupedConditions = [];
    conditions.forEach((item) => {
      const match = groupedConditions.find(
        (x) => x.resourceType === item.resourceType
      );
      if (match) {
        match.criteria += item.criteria;
      } else {
        groupedConditions.push(item);
      }
    });
    return groupedConditions;
  }
}
