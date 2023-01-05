import {
  Component,
  Input,
  ViewChildren,
  QueryList,
  OnInit,
  ViewChild,
  ElementRef
} from '@angular/core';
import { AbstractControl, UntypedFormArray, UntypedFormControl } from '@angular/forms';
import {
  BaseControlValueAccessor,
  createControlValueAccessorProviders
} from '../base-control-value-accessor';
import { SearchParameterComponent } from '../search-parameter/search-parameter.component';
import { SearchCondition } from '../../types/search.condition';
import { Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import {
  ConnectionStatus,
  FhirBackendService
} from '../../shared/fhir-backend/fhir-backend.service';
import { SearchParameterGroup } from '../../types/search-parameter-group';
import { ErrorManager } from '../../shared/error-manager/error-manager.service';
import { ErrorStateMatcher } from '@angular/material/core';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { escapeStringForRegExp } from '../../shared/utils';
import { SearchParameter } from '../../types/search.parameter';

/**
 * Component for managing search parameters of a resource type
 */
@Component({
  selector: 'app-search-parameter-group',
  templateUrl: './search-parameter-group.component.html',
  styleUrls: ['./search-parameter-group.component.less'],
  providers: [
    ...createControlValueAccessorProviders(SearchParameterGroupComponent),
    ErrorManager,
    {
      provide: ErrorStateMatcher,
      useExisting: ErrorManager
    }
  ]
})
export class SearchParameterGroupComponent
  extends BaseControlValueAccessor<SearchParameterGroup>
  implements OnInit {
  @Input() inputResourceType = '';
  @Input() allowAddRemoveButtons = true;
  @ViewChild('resourceTypeInput') resourceTypeInput: ElementRef;
  @ViewChildren(SearchParameterComponent)
  searchParameterComponents: QueryList<SearchParameterComponent>;
  parameterList = new UntypedFormArray([]);
  selectedSearchParameterNames: string[];
  maxNumberOfSearchParameters = 0;
  resourceType: UntypedFormControl = new UntypedFormControl('');
  resourceTypes: string[] = [];
  filteredResourceTypes: Observable<string[]>;

  get value(): SearchParameterGroup {
    return {
      resourceType: this.resourceType.value,
      parameters: this.parameterList.value
    };
  }

  constructor(
    private fhirBackend: FhirBackendService,
    private errorManager: ErrorManager,
    private liveAnnouncer: LiveAnnouncer
  ) {
    super();
    this.parameterList.valueChanges.subscribe((value) => {
      this.selectedSearchParameterNames = value.map((item) => item.element);
      this.onChange(this.value);
    });
  }

  ngOnInit(): void {
    if (this.inputResourceType) {
      this.resourceType.setValue(this.inputResourceType);
      this.resourceType.disable();
    } else {
      this.filteredResourceTypes = this.resourceType.valueChanges.pipe(
        startWith(''),
        map((value: string) => {
          const reg = `\\b${escapeStringForRegExp(value)}`;
          const regEx = new RegExp(reg, 'i');
          return this.resourceTypes.filter((r) => regEx.test(r));
        })
      );
      this.resourceType.valueChanges.subscribe((value) => {
        const match = this.resourceTypes.find((rt) => rt === value);
        if (match) {
          this.resourceType.disable({ emitEvent: false });
          this.updateMaxNumberOfSearchParameters();
          this.liveAnnouncer.announce(`Selected record type ${value}.`);
        }
      });
    }
    this.fhirBackend.initialized.subscribe((status) => {
      if (status === ConnectionStatus.Ready) {
        const definitions = this.fhirBackend.getCurrentDefinitions();
        this.resourceTypes = Object.keys(definitions.resources);
        if (this.inputResourceType === 'Observation') {
          this.parameterList.push(
            new UntypedFormControl({
              element: 'code text'
            })
          );
        }
        this.updateMaxNumberOfSearchParameters();
      } else if (status === ConnectionStatus.Disconnect) {
        // Clear search parameters on server change
        this.parameterList.clear();
      }
    });
  }

  /**
   * Add new search parameter to search parameter list
   */
  public addParameter(): void {
    this.parameterList.push(new UntypedFormControl({}));
    this.liveAnnouncer.announce('A new line of search criterion is added.');
    // Focus the input control of the newly added search parameter line.
    setTimeout(() => {
      this.searchParameterComponents.last.focusSearchParamNameInput();
    }, 0);
  }

  /**
   * Remove search parameter from search parameter list
   */
  public removeParameter(item: AbstractControl): void {
    this.parameterList.removeAt(this.parameterList.controls.indexOf(item));
  }

  /**
   * Part of the ControlValueAccessor interface
   * required to integrate with Angular's core forms API.
   *
   * @param value New value to be written to the model.
   */
  writeValue(value: SearchParameterGroup): void {
    this.resourceType.setValue(value?.resourceType);
    this.parameterList.clear();
    value?.parameters?.forEach((v) =>
      this.parameterList.push(new UntypedFormControl(v))
    );
  }

  /**
   * Returns search parameter values.
   */
  getSearchParamValues(): SearchParameter[] {
    return this.searchParameterComponents.map((p) => p.value);
  }

  /**
   * Get and group search conditions for a resource type.
   */
  getConditions(): SearchCondition {
    const conditions = this.searchParameterComponents
      .map((c) => c.getCriteria())
      .join('');
    return {
      resourceType: this.resourceType.value,
      criteria: conditions
    };
  }

  /**
   * Checks for errors
   */
  hasErrors(): boolean {
    return this.errorManager.errors !== null;
  }

  /**
   * Shows errors for existing formControls
   */
  showErrors(): void {
    this.errorManager.showErrors();
  }

  /**
   * Focus "Record type" control.
   * This is being called from parent component when the "Add a record type" button is clicked.
   */
  focusResourceTypeInput(): void {
    this.resourceTypeInput.nativeElement.focus();
  }

  /**
   * Updates the maximum number of search parameters, which must match
   * the possible number of search parameters, since search parameters should
   * not be repeated.
   */
  updateMaxNumberOfSearchParameters(): void {
    this.maxNumberOfSearchParameters = this.fhirBackend.getCurrentDefinitions().resources[
      this.resourceType.value
    ].searchParameters.length;
  }
}
