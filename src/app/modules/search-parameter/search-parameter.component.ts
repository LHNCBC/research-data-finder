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
  @Input() resourceType = '';
  readonly OBSERVATIONBYTEST = 'code text';
  readonly CODETYPES = ['code', 'CodeableConcept', 'Coding'];
  // Observation search parameter names to be hidden
  readonly OBSERVATIONHIDDENPARAMETERNAMES = [
    'combo-code',
    'combo-value-concept',
    'combo-value-quantity',
    'value-string'
  ];
  definitions: any;

  selectedResourceType: any;

  parameterName: FormControl = new FormControl('');
  parameterNames: string[] = [];
  filteredParameterNames: Observable<string[]>;
  selectedParameter: any;

  parameterValue: FormControl = new FormControl('');
  parameterValues: any[];

  selectedObservationCodes: FormControl = new FormControl(null);

  get value(): SearchParameter {
    return {
      name: this.parameterName.value,
      value: this.parameterValue.value,
      selectedObservationCodes: this.selectedObservationCodes.value
    };
  }

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
    this.definitions = this.fhirBackend.getCurrentDefinitions();
    this.selectedResourceType = this.definitions.resources[this.resourceType];
    this.parameterNames = this.selectedResourceType.searchParameters.map(
      (sp) => sp.name
    );
    if (this.resourceType === 'Observation') {
      this.parameterNames = this.parameterNames.filter(
        (n) => !this.OBSERVATIONHIDDENPARAMETERNAMES.includes(n)
      );
      this.parameterNames.unshift(this.OBSERVATIONBYTEST);
    }
    this.selectedParameter = null;

    this.filteredParameterNames = this.parameterName.valueChanges.pipe(
      startWith(''),
      map((value) => this._filter(value, this.parameterNames))
    );

    this.parameterName.valueChanges.subscribe((value) => {
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
      this.onChange(this.value);
    });

    this.parameterValue.valueChanges.subscribe(() => {
      this.onChange(this.value);
    });
    this.selectedObservationCodes.valueChanges.subscribe(() => {
      this.onChange(this.value);
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
    this.parameterName.setValue(value.name || '');
    this.parameterValue.setValue(value.value || '');
    this.selectedObservationCodes.setValue(
      value.selectedObservationCodes || null
    );
  }

  /**
   * get string of url segment describing the search criteria that will be used to search in server.
   */
  getCriteria(): string {
    // Return empty if parameter name is not selected.
    if (!this.parameterName.value) {
      return '';
    }
    if (this.parameterName.value === this.OBSERVATIONBYTEST) {
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
    if (
      this.resourceType === 'Patient' &&
      this.parameterName.value === 'active' &&
      this.parameterValue.value === 'true'
    ) {
      // Include patients with active field not defined when searching active patients
      return '&active:not=false';
    }
    if (this.useLookupParamValue) {
      return `&${this.parameterName.value}=${this.parameterValue.value.join(
        ','
      )}`;
    }
    return `&${this.parameterName.value}=${this.parameterValue.value}`;
  }

  getObservationByTestCriteria(): string {
    // Ignore criteria if no code selected.
    if (!this.selectedObservationCodes.value) {
      return '';
    }
    const comboCodes = this.selectedObservationCodes.value.codes.filter(
      (c) => c
    );
    const codeParam = comboCodes.length
      ? '&combo-code=' +
        comboCodes.map((code) => encodeFhirSearchParameter(code)).join(',')
      : '';
    const valueParamName = {
      CodeableConcept: 'combo-value-concept',
      Quantity: 'combo-value-quantity',
      string: 'value-string'
    }[this.selectedObservationCodes.value.datatype];
    const modifier = this.parameterValue.value.testValueModifier;
    const prefix = this.parameterValue.value.testValuePrefix;
    const testValue = this.parameterValue.value.testValue
      ? escapeFhirSearchParameter(
          this.parameterValue.value.testValue.toString()
        )
      : '';
    const unit = this.parameterValue.value.testValueUnit;
    const valueParam = testValue.trim()
      ? `&${valueParamName}${modifier}=${prefix}${encodeURIComponent(
          testValue + (unit ? '||' + escapeFhirSearchParameter(unit) : '')
        )}`
      : '';
    return `${codeParam}${valueParam}`;
  }
}
