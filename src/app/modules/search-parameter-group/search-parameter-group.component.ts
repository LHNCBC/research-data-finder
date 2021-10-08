import {
  Component,
  Input,
  ViewChildren,
  QueryList,
  OnInit,
  ViewChild,
  ElementRef
} from '@angular/core';
import { AbstractControl, FormArray, FormControl } from '@angular/forms';
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
  @ViewChild('resourceTypeInput') resourceTypeInput: ElementRef;
  @ViewChildren(SearchParameterComponent)
  searchParameterComponents: QueryList<SearchParameterComponent>;
  parameterList = new FormArray([]);
  resourceType: FormControl = new FormControl('');
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
    private liveAnnoncer: LiveAnnouncer
  ) {
    super();
    fhirBackend.initialized.subscribe((status) => {
      if (status === ConnectionStatus.Ready) {
        const definitions = this.fhirBackend.getCurrentDefinitions();
        this.resourceTypes = Object.keys(definitions.resources);
        if (this.inputResourceType === 'Observation') {
          this.parameterList.push(
            new FormControl({
              element: 'code text'
            })
          );
        }
      } else if (status === ConnectionStatus.Disconnect) {
        // Clear search parameters on server change
        this.parameterList.clear();
      }
    });
    this.parameterList.valueChanges.subscribe(() => {
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
        map((value: string) =>
          this.resourceTypes.filter((r) =>
            r.toLowerCase().includes(value.toLowerCase())
          )
        )
      );
      this.resourceType.valueChanges.subscribe((value) => {
        const match = this.resourceTypes.find((rt) => rt === value);
        if (match) {
          this.resourceType.disable({ emitEvent: false });
          this.liveAnnoncer.announce(`Selected resource type ${value}.`);
        }
      });
    }
  }

  /**
   * Add new search parameter to search parameter list
   */
  public addParameter(): void {
    this.parameterList.push(new FormControl({}));
    this.liveAnnoncer.announce('A new line of search criterion is added.');
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
      this.parameterList.push(new FormControl(v))
    );
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
   * Focus "Resource Type" control.
   * This is being called from parent component when the "Add a resource type" button is clicked.
   */
  focusResourceTypeInput(): void {
    this.resourceTypeInput.nativeElement.focus();
  }
}
