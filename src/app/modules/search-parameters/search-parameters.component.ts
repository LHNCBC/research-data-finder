import { Component, ViewChildren, QueryList, ViewChild } from '@angular/core';
import { AbstractControl, FormArray, FormControl } from '@angular/forms';
import {
  BaseControlValueAccessor,
  createControlValueAccessorProviders
} from '../base-control-value-accessor';
import { SearchParameter } from 'src/app/types/search.parameter';
import { SearchParameterGroupComponent } from '../search-parameter-group/search-parameter-group.component';
import { ErrorStateMatcher } from '@angular/material/core';
import { ErrorManager } from '../../shared/error-manager/error-manager.service';
import { FhirBackendService } from '../../shared/fhir-backend/fhir-backend.service';
import { map } from 'rxjs/operators';
import {
  Field,
  Option,
  QueryBuilderComponent,
  QueryBuilderConfig,
  Rule,
  RuleSet
} from '../../../query-builder/public-api';
import { Observable } from 'rxjs';
import { AutocompleteOption } from './autocomplete/autocomplete.component';
import { LiveAnnouncer } from '@angular/cdk/a11y';

/**
 * Component for managing resources search parameters
 */
@Component({
  selector: 'app-search-parameters',
  templateUrl: './search-parameters.component.html',
  styleUrls: ['./search-parameters.component.less'],
  providers: [
    ...createControlValueAccessorProviders(SearchParametersComponent),
    {
      provide: ErrorStateMatcher,
      useExisting: ErrorManager
    }
  ]
})
export class SearchParametersComponent extends BaseControlValueAccessor<
  SearchParameter[]
> {
  @ViewChildren(SearchParameterGroupComponent)
  searchParameterGroupComponents: QueryList<SearchParameterGroupComponent>;
  parameterGroupList = new FormArray([]);
  @ViewChild(QueryBuilderComponent)
  queryBuilderComponent: QueryBuilderComponent;
  public queryCtrl: FormControl = new FormControl({});
  public queryBuilderConfig: QueryBuilderConfig = { fields: {} };
  resourceTypes$: Observable<AutocompleteOption[]>;
  fieldsCache: {
    [resourceType: string]: AutocompleteOption[];
  } = {};

  constructor(
    private fhirBackend: FhirBackendService,
    private liveAnnoncer: LiveAnnouncer
  ) {
    super();
    this.parameterGroupList.valueChanges.subscribe((value) => {
      this.onChange(value);
    });

    this.resourceTypes$ = fhirBackend.currentDefinitions$.pipe(
      map((definitions) =>
        Object.keys(definitions.resources).map((resourceType) => ({
          name: resourceType
        }))
      )
    );

    fhirBackend.currentDefinitions$.subscribe((definitions) => {
      // Clear search parameters on server change
      this.parameterGroupList.clear();
      this.fieldsCache = {};
      const config = {
        allowEmptyRulesets: true,
        fields: {},
        /**
         * Adds a rule (criterion) for a resource type
         */
        addRule: (parent: RuleSet): void => {
          parent.rules = parent.rules.concat([
            {
              field: {}
            } as Rule
          ]);
        },

        getInputType: (fieldName: string, operator: string): string => {
          return 'search-parameter';
        },
        getOperators: (fieldName: string, field: Field): string[] => {
          return [];
        },
        // Override to an empty method only to remove the exception
        getOptions: (fieldName: string): Option[] => null
      };
      const resourceTypes = Object.keys(definitions.resources);
      resourceTypes.forEach((resourceType) => {
        definitions.resources[resourceType].searchParameters.forEach((desc) => {
          config.fields[resourceType + '-' + desc.element] = desc;
        });
      });
      this.queryCtrl.setValue({
        condition: 'and',
        rules: []
      });
      this.queryBuilderConfig = config;
    });
  }

  /**
   * Adds a ruleset for a resource type
   * @param ruleset parent ruleset
   */
  addResourceType(ruleset: RuleSet): void {
    ruleset.rules = ruleset.rules.concat({
      condition: 'and',
      rules: [],
      // RuleSet is treated as a ruleset for a resource type
      // if it has a "resourceType" property
      resourceType: ''
    } as RuleSet);
  }

  /**
   * Add new search parameter group to search parameter group list
   */
  public addParameterGroup(): void {
    this.parameterGroupList.push(
      new FormControl({
        resourceType: '',
        parameters: []
      })
    );
    this.liveAnnoncer.announce('A new line of resource type is added.');
    // Focus the input control of the newly added resource type line.
    setTimeout(() => {
      this.searchParameterGroupComponents.last.focusResourceTypeInput();
    }, 0);
  }

  /**
   * Remove search parameter group from search parameter group list
   */
  public removeParameterGroup(item: AbstractControl): void {
    this.parameterGroupList.removeAt(
      this.parameterGroupList.controls.indexOf(item)
    );
  }

  writeValue(value: SearchParameter[]): void {
    // TODO
  }

  /**
   * Returns the indefinite article ('a' or 'an') for the specified word.
   */
  getIndefiniteArticle(word: string): string {
    return /^[eyuioa]/i.test(word) ? 'an' : 'a';
  }
}
