import { ChangeDetectorRef, Component, Input, OnInit } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';
import { SearchParameter } from 'src/app/types/search.parameter';
import {
  BaseControlValueAccessor,
  createControlValueAccessorProviders
} from '../base-control-value-accessor';
import {
  ConnectionStatus,
  FhirBackendService
} from '../../shared/fhir-backend/fhir-backend.service';
import { capitalize } from '../../shared/utils';

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
  @Input() fixedResourceType = true;
  readonly OBSERVATIONBYTEST = 'Observation by Test';
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
  parameterValues: string[];
  filteredParameterValues: Observable<string[]>;

  selectedLoincItems: FormControl = new FormControl(null);

  constructor(private fhirBackend: FhirBackendService) {
    super();
  }

  ngOnInit(): void {
    this.definitions = this.fhirBackend.getCurrentDefinitions();
    this.resourceTypes =
      this.fixedResourceType
        ? ['Observation', this.OBSERVATIONBYTEST]
        : Object.keys(this.definitions.resources).concat(this.OBSERVATIONBYTEST);

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
      }
    });

    this.filteredParameterNames = this.parameterName.valueChanges.pipe(
      startWith(''),
      map((value) => this._filter(value, this.parameterNames))
    );

    this.parameterName.valueChanges.subscribe((value) => {
      if (this.selectedResourceType) {
        this.selectedParameter = this.selectedResourceType.searchParameters.find(
          (p) => p.name === value
        );
        if (this.selectedParameter && this.selectedParameter.valueSet) {
          this.parameterValues = this.definitions.valueSets[
            this.selectedParameter.valueSet
          ].map((v) => v.display);
          this.filteredParameterValues = this.parameterValue.valueChanges.pipe(
            startWith(''),
            map((v) => this._filter(v, this.parameterValues))
          );
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
}
