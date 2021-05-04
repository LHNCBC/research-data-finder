import { Component, Input, ViewChildren, QueryList } from '@angular/core';
import { AbstractControl, FormArray, FormControl } from '@angular/forms';
import {
  BaseControlValueAccessor,
  createControlValueAccessorProviders
} from '../base-control-value-accessor';
import { SearchParameter } from 'src/app/types/search.parameter';
import { SearchParameterComponent } from '../search-parameter/search-parameter.component';

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

  getConditions(): string[] {
    return this.searchParameterComponents.map((c) => c.getConditionUrl());
  }
}
