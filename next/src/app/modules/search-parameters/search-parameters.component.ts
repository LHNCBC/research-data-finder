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
  readonly OBSERVATIONBYTEST = 'Observation by Test';

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
      c.getCondition()
    );
    const groupedConditions = [];
    // add default Patient condition if missing
    groupedConditions.push({
      resourceType: 'Patient',
      criteria: ''
    });
    conditions.forEach((item) => {
      const match = groupedConditions.find(
        (x) => x.resourceType === item.resourceType
      );
      // do not combine conditions for 'Observation by Test'
      if (match && item.resourceType !== this.OBSERVATIONBYTEST) {
        match.criteria += item.criteria;
      } else {
        groupedConditions.push(item);
      }
    });
    conditions.map((item) => {
      // for 'Observation by Test', search url needs to use 'Observation'
      if (item.resourceType === this.OBSERVATIONBYTEST) {
        item.resourceType = 'Observation';
      }
    });
    return groupedConditions;
  }
}
