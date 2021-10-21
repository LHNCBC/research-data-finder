import { Component, ElementRef, Input, OnInit, ViewChild } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
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
import { SelectedObservationCodes } from '../../types/selected-observation-codes';

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
  @Input() isPullData = false;
  readonly OBSERVATIONBYTEST = 'code text';
  readonly OBSERVATIONBYTESTDESC =
    'The display text associated with the code of the observation type';
  readonly CODETYPES = ['code', 'CodeableConcept', 'Coding'];
  definitions: any;

  selectedResourceType: any;

  parameterName: FormControl = new FormControl('', Validators.required);
  parameters: any[] = [];
  filteredParameters: Observable<any[]>;
  selectedParameter: any;

  parameterValue: FormControl = new FormControl('', (control) =>
    this.isPullData || this.selectedObservationCodes?.value?.datatype
      ? null
      : Validators.required(control)
  );
  parameterValues: any[];

  selectedObservationCodes: FormControl = new FormControl(null, () =>
    this.isPullData || this.selectedObservationCodes?.value?.datatype
      ? null
      : { required: true }
  );
  loincCodes: string[] = [];

  @ViewChild('searchParamName') searchParamName: ElementRef;

  get value(): SearchParameter {
    return {
      element: this.selectedParameter?.element || '',
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
    this.parameters = this.selectedResourceType.searchParameters;
    this.selectedParameter = null;

    this.filteredParameters = this.parameterName.valueChanges.pipe(
      startWith(''),
      map((value) => this._filter(value, this.parameters))
    );

    this.parameterName.valueChanges.subscribe((value) => {
      this.selectedParameter = this.selectedResourceType.searchParameters.find(
        (p) => p.displayName === value
      );
      if (this.selectedParameter) {
        this.parameterValue.setValue(
          this.selectedParameter.type === 'boolean' ? 'true' : ''
        );
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
    this.selectedObservationCodes.valueChanges.subscribe((value) => {
      // Prepare a list of LOINC codes for ObservationTestValueUnitComponent
      this.loincCodes =
        value?.coding
          .filter((c) => c.system === 'http://loinc.org')
          .map((c) => c.code) || [];
      this.onChange(this.value);
    });
  }

  private _filter(value: string, options: any[]): string[] {
    const filterValue = value.toLowerCase();

    return options.filter((option) =>
      option.displayName.toLowerCase().includes(filterValue)
    );
  }

  /**
   * Part of the ControlValueAccessor interface
   * required to integrate with Angular's core forms API.
   *
   * @param value New value to be written to the model.
   */
  writeValue(value: SearchParameter): void {
    const param = this.parameters.find((p) => p.element === value.element);
    this.parameterName.setValue(param?.displayName || '');
    if (this.isPullData) {
      this.parameterName.disable({ emitEvent: false });
    }
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
    if (!this.selectedParameter) {
      return '';
    }
    if (this.selectedParameter.element === this.OBSERVATIONBYTEST) {
      return this.getObservationCodeTextCriteria();
    }
    if (this.selectedParameter.type === 'date') {
      return (
        (this.parameterValue.value.from
          ? `&${this.selectedParameter.element}=ge${this.parameterValue.value.from}`
          : '') +
        (this.parameterValue.value.to
          ? `&${this.selectedParameter.element}=le${this.parameterValue.value.to}`
          : '')
      );
    }
    if (
      this.resourceType === 'Patient' &&
      this.selectedParameter.element === 'active' &&
      this.parameterValue.value === 'true'
    ) {
      // Include patients with active field not defined when searching active patients
      return '&active:not=false';
    }
    if (this.useLookupParamValue) {
      return `&${
        this.selectedParameter.element
      }=${this.parameterValue.value.coding.join(',')}`;
    }
    if (this.selectedParameter.type === 'Quantity') {
      const testValueCriteria = this.getCompositeTestValueCriteria();
      return testValueCriteria
        ? `&${this.selectedParameter.element}${testValueCriteria}`
        : '';
    }
    return `&${this.selectedParameter.element}=${this.parameterValue.value}`;
  }

  /**
   * Get criteria string for Observation "code text" parameter
   */
  private getObservationCodeTextCriteria(): string {
    const selectedCodes = this.selectedObservationCodes
      .value as SelectedObservationCodes;
    // Ignore criteria if no code selected.
    if (!selectedCodes) {
      return '';
    }
    const coding = selectedCodes.coding.filter((c) => c);
    const codeParam = coding.length
      ? '&combo-code=' +
        coding.map((code) => encodeFhirSearchParameter(code.code)).join(',')
      : '';
    const valueParamName = {
      CodeableConcept: 'combo-value-concept',
      Quantity: 'combo-value-quantity',
      string: 'value-string'
    }[this.selectedObservationCodes.value.datatype];
    const testValueCriteria = this.getCompositeTestValueCriteria();
    const valueParam = testValueCriteria
      ? `&${valueParamName}${testValueCriteria}`
      : '';
    return `${codeParam}${valueParam}`;
  }

  /**
   * Get criteria string for composite test value controls
   * e.g. prefix + value + unit
   */
  private getCompositeTestValueCriteria(): string {
    if (this.isPullData) {
      return '';
    }
    const modifier = this.parameterValue.value.testValueModifier;
    const prefix = this.parameterValue.value.testValuePrefix;
    const testValue = this.parameterValue.value.testValue
      ? escapeFhirSearchParameter(
          this.parameterValue.value.testValue.toString()
        )
      : '';
    const unit = this.parameterValue.value.testValueUnit;
    return testValue.trim()
      ? `${modifier}=${prefix}${encodeURIComponent(
          testValue + (unit ? '||' + escapeFhirSearchParameter(unit) : '')
        )}`
      : '';
  }

  /**
   * Focus "Search parameter name" control.
   * This is being called from parent component when the "Add {resource type} criterion" button is clicked.
   */
  focusSearchParamNameInput(): void {
    this.searchParamName.nativeElement.focus();
  }
}
