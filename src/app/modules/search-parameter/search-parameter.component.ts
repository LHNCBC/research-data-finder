import {
  Component,
  Input,
  OnChanges,
  OnInit,
  SimpleChanges,
  ViewChild
} from '@angular/core';
import { UntypedFormControl, Validators } from '@angular/forms';
import { SearchParameter } from 'src/app/types/search.parameter';
import {
  BaseControlValueAccessor,
  createControlValueAccessorProviders
} from '../base-control-value-accessor';
import {
  FhirBackendService
} from '../../shared/fhir-backend/fhir-backend.service';
import { isEqual } from 'lodash-es';
import {
  CODETEXT,
  OBSERVATION_VALUE,
  QueryParamsService
} from '../../shared/query-params/query-params.service';
import { AutocompleteComponent } from '../autocomplete/autocomplete.component';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import NON_REQUIRED_BINDING_LISTS
  from '../../../../non-required-binding-lists.json';
import { AutocompleteOption } from '../../types/autocompleteOption';

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
  implements OnInit, OnChanges {
  @Input() resourceType = '';
  // A list of already selected FHIR search parameter names, including the
  // parameter selected in this component. This list is used to exclude dropdown
  // options to avoid duplicate criteria.
  @Input() selectedSearchParameterNames: string[] = [];
  @Input() observationDataType: string;
  @Input() observationUnits: AutocompleteOption[];
  @Input() observationCodes: string[];
  @Input() observationLoincCodes: string[];
  @Input() isPullData = false;
  readonly CODETEXT = CODETEXT;
  readonly OBSERVATION_VALUE = OBSERVATION_VALUE;
  readonly EVIDENCEVARIABLE = 'EvidenceVariable';
  definitions: any;

  selectedResourceType: any;

  parameterName: UntypedFormControl = new UntypedFormControl('', Validators.required);
  parameters: any[] = [];
  parameterOptions: AutocompleteOption[] = [];
  selectedParameter: any;
  currentValue = null;

  parameterValue: UntypedFormControl = new UntypedFormControl('', (control) =>
    this.isPullData || this.selectedObservationCodes?.value?.datatype
      ? null
      : Validators.required(control)
  );
  parameterValues: any[];

  selectedObservationCodes: UntypedFormControl = new UntypedFormControl(null, () =>
    this.isPullData || this.selectedObservationCodes?.value?.datatype
      ? null
      : { required: true }
  );
  loincCodes: string[] = [];

  @ViewChild('searchParamName') searchParamName: AutocompleteComponent;

  get value(): SearchParameter {
    return {
      element: this.selectedParameter?.element || '',
      value: this.parameterValue.value,
      ...(this.selectedParameter?.element === CODETEXT
        ? { selectedObservationCodes: this.selectedObservationCodes.value }
        : {})
    };
  }

  /**
   * Whether to use lookup control for search parameter value.
   */
  get useLookupParamValue(): boolean {
    return this.queryParams.getUseLookupParamValue(this.selectedParameter);
  }

  /**
   * Gets non required binding list values from stored json file, if any.
   */
  get nonRequiredBindingList(): any[] {
    return NON_REQUIRED_BINDING_LISTS[this.fhirBackend.serviceBaseUrl]?.[
      this.resourceType
    ]?.[this.selectedParameter.element];
  }

  constructor(
    private fhirBackend: FhirBackendService,
    private queryParams: QueryParamsService,
    private liveAnnouncer: LiveAnnouncer
  ) {
    super();
  }

  ngOnInit(): void {
    this.definitions = this.fhirBackend.getCurrentDefinitions();
    this.selectedResourceType = this.definitions.resources[this.resourceType];
    this.parameters = this.selectedResourceType.searchParameters;
    this.updateAvailableSearchParameters();
    this.selectedParameter = null;

    this.parameterName.valueChanges.subscribe((value) => {
      const oldUseLookupParameter = this.selectedParameter && this.useLookupParamValue;
      const oldParamType = this.selectedParameter?.type;
      this.selectedParameter = this.selectedResourceType.searchParameters.find(
        (p) => p.displayName === value
      );
      if (this.selectedParameter) {
        this.parameterValue.setValue(
          this.selectedParameter.type === 'boolean' ? 'true' : '', {
            // Avoid updating the value of a previous control, which might cause
            // the model to update with default values from a previous control
            // of a different type.
            emitModelToViewChange: !(
              oldUseLookupParameter !== this.useLookupParamValue
              || oldParamType !== this.selectedParameter.type
            )
          }
        );
        this.liveAnnouncer.announce(
          `Selected ${value}. One or more new fields have appeared.`
        );
        if (this.nonRequiredBindingList) {
          this.parameterValues = this.nonRequiredBindingList;
        } else if (
          this.selectedParameter.valueSet &&
          Array.isArray(
            this.definitions.valueSets[this.selectedParameter.valueSet]
          )
        ) {
          this.parameterValues = this.definitions.valueSets[
            this.selectedParameter.valueSet
          ];
        } else {
          this.parameterValues = undefined;
        }
      }
      this.handleChange();
    });

    this.parameterValue.valueChanges.subscribe(() => {
      this.handleChange();
    });
    this.selectedObservationCodes.valueChanges.subscribe((value) => {
      // Prepare a list of LOINC codes for ObservationTestValueUnitComponent
      this.loincCodes =
        value?.coding
          .filter((c) => c.system === 'http://loinc.org')
          .map((c) => c.code) || [];
      this.handleChange();
    });
  }

  /**
   * A lifecycle hook that is called when any data-bound property of a component
   * changes.
   */
  ngOnChanges(changes: SimpleChanges): void {
    // Announce a change of the variable value type
    if (
      changes.observationDataType &&
      this.selectedParameter?.element === OBSERVATION_VALUE &&
      (changes.observationDataType.currentValue || '') !==
        (changes.observationDataType.previousValue || '')
    ) {
      this.liveAnnouncer.announce(
        'The fields for variable value have updated in response to the change to the variable name.'
      );
    }
  }

  /**
   * Notify ngModel or FormControl linked with component when a control's value
   * changes only if the value is really changed.
   */
  handleChange(): void {
    const newValue = this.value;

    if (!isEqual(this.currentValue, newValue)) {
      this.onChange(newValue);
      this.currentValue = newValue;
    }
  }

  /**
   * Part of the ControlValueAccessor interface
   * required to integrate with Angular's core forms API.
   *
   * @param value New value to be written to the model.
   */
  writeValue(value: SearchParameter): void {
    const param = this.parameters.find((p) => isEqual(p.element,value?.element));
    this.parameterName.setValue(param?.displayName || '');
    if (this.isPullData) {
      this.parameterName.disable({ emitEvent: false });
    }
    // Make sure to write value to this.parameterValue after its initialization value is set after
    // this.parameterName change.
    setTimeout(() => {
      this.parameterValue.setValue(value?.value || '');
      this.selectedObservationCodes.setValue(
        value?.selectedObservationCodes || null
      );
    }, 0);
  }

  /**
   * Generates the search criteria URL segment(s) for querying the server.
   * If the search parameter element is an array, returns an array of criteria
   * strings, each corresponding to an element. Otherwise, returns a single
   * criteria string.
   *
   * @returns The search criteria as a string or array of strings.
   */
  getCriteria(): string | string[] {
    if (Array.isArray(this.value.element)) {
      return this.value.element.map(element =>
        this.queryParams.getQueryParam(this.resourceType, {
          ...this.value, element
        })
      );
    }
    return this.queryParams.getQueryParam(this.resourceType, this.value);
  }

  /**
   * Focus "Search parameter name" control.
   * This is being called from parent component when the "Add {resource type} criterion" button is clicked.
   */
  focusSearchParamNameInput(): void {
    this.searchParamName.focus();
  }

  /**
   * Updates the list of available search parameters.
   */
  updateAvailableSearchParameters(): void {
    this.parameterOptions = this.parameters
      // Skip already selected search parameters
      .filter(
        (p) =>
          p.visible && (
            isEqual(p.element, this.value.element) ||
            !this.selectedSearchParameterNames ||
            this.selectedSearchParameterNames.indexOf(p.element) === -1
          ))
      .map((searchParameter) => ({
        name: searchParameter.displayName,
        value: searchParameter.displayName,
        desc: searchParameter.description
      }));
  }
}
