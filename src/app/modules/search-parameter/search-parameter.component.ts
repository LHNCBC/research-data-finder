import { Component, Input, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { SearchParameter } from 'src/app/types/search.parameter';
import {
  BaseControlValueAccessor,
  createControlValueAccessorProviders
} from '../base-control-value-accessor';
import { FhirBackendService } from '../../shared/fhir-backend/fhir-backend.service';
import { SearchCondition } from '../../types/search.condition';
import {
  encodeFhirSearchParameter,
  escapeFhirSearchParameter
} from '../../shared/utils';

/**
 * Component for editing one resource search parameter
 */
@Component({
  selector: 'app-search-parameter',
  templateUrl: './search-parameter.component.html',
  styleUrls: ['./search-parameter.component.less'],
  providers: createControlValueAccessorProviders(SearchParameterComponent)
})
export class SearchParameterComponent
  extends BaseControlValueAccessor<SearchParameter>
  implements OnInit {
  @Input() inputResourceType = '';
  fixedResourceType = false;
  readonly OBSERVATIONBYTEST = 'Observation by Test';
  readonly CODETYPES = ['code', 'CodeableConcept', 'Coding'];
  definitions: any;

  resourceType: FormControl = new FormControl('');
  resourceTypes: string[] = [];
  filteredResourceTypes: Observable<string[]>;
  selectedResourceType: any;

  parameterName: FormControl = new FormControl('');
  parameterNames: string[] = [];
  filteredParameterNames: Observable<string[]>;
  selectedParameter: any;

  parameterValue: FormControl = new FormControl('');
  parameterValues: any[];

  selectedLoincItems: FormControl = new FormControl(null);

  /**
   * Whether to use lookup control for search parameter value.
   */
  get useLookupParamValue(): boolean {
    return (
      this.CODETYPES.includes(this.selectedParameter.type) &&
      Array.isArray(this.parameterValues) &&
      this.parameterValues.length > 0
    );
  }

  constructor(private fhirBackend: FhirBackendService) {
    super();
  }

  ngOnInit(): void {
    this.filteredResourceTypes = this.resourceType.valueChanges.pipe(
      startWith(''),
      map((value) => this._filter(value, this.resourceTypes))
    );

    this.resourceType.valueChanges.subscribe((value) => {
      if (value === this.OBSERVATIONBYTEST) {
        this.selectedParameter = null;
        this.selectedResourceType = null;
        return;
      }
      const match = this.resourceTypes.find((rt) => rt === value);
      if (match) {
        this.selectedResourceType = this.definitions.resources[value];
        this.parameterNames = this.selectedResourceType.searchParameters.map(
          (sp) => sp.name
        );
        this.selectedParameter = null;
        this.parameterName.setValue('');
        this.parameterValue.setValue('');
      }
    });

    this.definitions = this.fhirBackend.getCurrentDefinitions();
    if (!this.inputResourceType) {
      this.resourceTypes = Object.keys(this.definitions.resources).concat(
        this.OBSERVATIONBYTEST
      );
    } else if (this.inputResourceType === 'Observation') {
      this.resourceTypes = ['Observation', this.OBSERVATIONBYTEST];
    } else {
      // single resource type
      this.resourceType.setValue(this.inputResourceType);
      this.resourceTypes = [this.inputResourceType];
      this.fixedResourceType = true;
    }

    this.filteredParameterNames = this.parameterName.valueChanges.pipe(
      startWith(''),
      map((value) => this._filter(value, this.parameterNames))
    );

    this.parameterName.valueChanges.subscribe((value) => {
      if (this.selectedResourceType) {
        this.selectedParameter = this.selectedResourceType.searchParameters.find(
          (p) => p.name === value
        );
        if (this.selectedParameter) {
          this.parameterValue.setValue('');
          if (this.selectedParameter.valueSet) {
            this.parameterValues = this.definitions.valueSets[
              this.selectedParameter.valueSet
            ];
          }
        }
      }
    });
  }

  private _filter(
    value: string,
    options: string[],
    selected: string[] = null
  ): string[] {
    const filterValue = value.toLowerCase();

    return options.filter(
      (option) =>
        option.toLowerCase().includes(filterValue) &&
        (selected ? selected.indexOf(option) === -1 : true)
    );
  }

  /**
   * Part of the ControlValueAccessor interface
   * required to integrate with Angular's core forms API.
   *
   * @param value New value to be written to the model.
   */
  writeValue(value: SearchParameter): void {
    this.resourceType.setValue(value.resourceType || '');
    this.parameterName.setValue(value.name || '');
    // TODO:
    this.parameterValue.setValue(value.value || '');
  }

  /**
   * return resource type and url segment of search string for current search parameter.
   */
  getCondition(): SearchCondition {
    const criteria = this.getCriteria();
    return criteria
      ? {
          resourceType: this.resourceType.value,
          criteria
        }
      : null;
  }

  /**
   * get string of url segment describing the search criteria that will be used to search in server.
   */
  getCriteria(): string {
    if (this.resourceType.value === this.OBSERVATIONBYTEST) {
      return this.getObservationByTestCriteria();
    }
    if (this.selectedParameter.type === 'date') {
      return (
        (this.parameterValue.value.from
          ? `&${this.parameterName.value}=ge${this.parameterValue.value.from}`
          : '') +
        (this.parameterValue.value.to
          ? `&${this.parameterName.value}=le${this.parameterValue.value.to}`
          : '')
      );
    }
    if (this.useLookupParamValue) {
      return `&${this.parameterName.value}=${this.parameterValue.value.join(
        ','
      )}`;
    }
    return `&${this.parameterName.value}=${this.parameterValue.value}`;
  }

  getObservationByTestCriteria(): string {
    const comboCodes = this.selectedLoincItems.value.codes.filter((c) => c);
    const codeParam = comboCodes.length
      ? '&combo-code=' +
        comboCodes.map((code) => encodeFhirSearchParameter(code)).join(',')
      : '';
    const valueParamName = {
      CodeableConcept: 'combo-value-concept',
      Quantity: 'combo-value-quantity',
      string: 'value-string'
    }[this.selectedLoincItems.value.datatype];
    const modifier = this.parameterValue.value.testValueModifier;
    const prefix = this.parameterValue.value.testValuePrefix;
    const testValue = this.parameterValue.value.testValue
      ? escapeFhirSearchParameter(
          this.parameterValue.value.testValue.toString()
        )
      : '';
    const unit = this.parameterValue.value.testValueUnit;
    const from = this.parameterValue.value.from
      ? `&date=ge${encodeURIComponent(this.parameterValue.value.from)}`
      : '';
    const to = this.parameterValue.value.to
      ? `&date=le${encodeURIComponent(this.parameterValue.value.to)}`
      : '';
    const valueParam = testValue.trim()
      ? `&${valueParamName}${modifier}=${prefix}${encodeURIComponent(
          testValue + (unit ? '||' + escapeFhirSearchParameter(unit) : '')
        )}`
      : '';
    return `${codeParam}${valueParam}${from}${to}`;
  }
}
