import { Component, Input, ViewChildren, QueryList } from '@angular/core';
import { AbstractControl, FormArray, FormControl } from '@angular/forms';
import {
  BaseControlValueAccessor,
  createControlValueAccessorProviders
} from '../base-control-value-accessor';
import { SearchParameter } from 'src/app/types/search.parameter';
import { SearchParameterComponent } from '../search-parameter/search-parameter.component';
import { SearchCondition } from '../../types/search.condition';
import { Observable } from 'rxjs';

/**
 * Component for managing search parameters of a resource type
 */
@Component({
  selector: 'app-search-parameter-group',
  templateUrl: './search-parameter-group.component.html',
  providers: createControlValueAccessorProviders(SearchParameterGroupComponent)
})
export class SearchParameterGroupComponent extends BaseControlValueAccessor<
  SearchParameter[]
> {
  @ViewChildren(SearchParameterComponent)
  searchParameterComponents: QueryList<SearchParameterComponent>;
  parameterList = new FormArray([]);
  resourceType: FormControl = new FormControl('');
  resourceTypes: string[] = [];
  filteredResourceTypes: Observable<string[]>;

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

  // Get and group search conditions for a resource type.
  getConditions(): SearchCondition {
    const conditions = this.searchParameterComponents
      .map((c) => c.getCondition())
      .join('&');
    return {
      resourceType: this.resourceType.value,
      criteria: `${this.resourceType.value}?${conditions}`
    };
  }
}
