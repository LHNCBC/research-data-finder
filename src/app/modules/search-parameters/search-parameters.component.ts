import { Component, ViewChildren, QueryList, ViewChild } from '@angular/core';
import { FormControl } from '@angular/forms';
import {
  BaseControlValueAccessor,
  createControlValueAccessorProviders
} from '../base-control-value-accessor';
import { SearchParameter } from 'src/app/types/search.parameter';
import { ErrorStateMatcher } from '@angular/material/core';
import { ErrorManager } from '../../shared/error-manager/error-manager.service';
import { FhirBackendService } from '../../shared/fhir-backend/fhir-backend.service';
import { map, take } from 'rxjs/operators';
import {
  Field,
  Option,
  QueryBuilderComponent,
  QueryBuilderConfig,
  Rule,
  RuleSet
} from '../../../query-builder/public-api';
import { Observable } from 'rxjs';
import {
  AutocompleteComponent,
  AutocompleteOption
} from '../autocomplete/autocomplete.component';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { SearchParameterComponent } from '../search-parameter/search-parameter.component';
import { MatButton } from '@angular/material/button';

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
  @ViewChildren(AutocompleteComponent)
  resourceTypeComponents: QueryList<AutocompleteComponent>;
  @ViewChildren(SearchParameterComponent)
  searchParameterComponents: QueryList<SearchParameterComponent>;
  @ViewChildren('addCriterionBtn')
  buttons: QueryList<MatButton>;
  @ViewChild(QueryBuilderComponent)
  queryBuilderComponent: QueryBuilderComponent;
  public queryCtrl: FormControl = new FormControl({});
  public queryBuilderConfig: QueryBuilderConfig = { fields: {} };
  resourceTypes$: Observable<AutocompleteOption[]>;

  constructor(
    private fhirBackend: FhirBackendService,
    private liveAnnoncer: LiveAnnouncer
  ) {
    super();

    this.resourceTypes$ = fhirBackend.currentDefinitions$.pipe(
      map((definitions) => Object.keys(definitions.resources))
    );

    fhirBackend.currentDefinitions$.subscribe((definitions) => {
      // Clear search parameters on server change
      const config = {
        allowEmptyRulesets: true,
        fields: {},
        /**
         * Adds a rule (criterion) for a record type
         */
        addRule: (parent: RuleSet): void => {
          parent.rules = parent.rules.concat([
            {
              field: {}
            } as Rule
          ]);
          this.liveAnnoncer.announce(
            'A new line of search criterion is added.'
          );
          // Focus the input control of the newly added search parameter line.
          this.searchParameterComponents.changes
            .pipe(take(1))
            .subscribe((components) => {
              setTimeout(() => components.last.focusSearchParamNameInput());
            });
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
   * Focus the input control of the newly added add criterion button.
   */
  focusOnAddCriterionBtn(): void {
    const prevButtons = this.buttons.toArray();
    this.buttons.changes.pipe(take(1)).subscribe((components) => {
      setTimeout(() =>
        components.find((btn) => prevButtons.indexOf(btn) === -1).focus()
      );
    });
  }

  /**
   * Adds a ruleset for a record type
   * @param ruleset parent ruleset
   */
  addResourceType(ruleset: RuleSet): void {
    ruleset.rules = ruleset.rules.concat({
      condition: 'and',
      rules: [],
      // RuleSet is treated as a ruleset for a record type
      // if it has a "resourceType" property
      resourceType: ''
    } as RuleSet);

    this.liveAnnoncer.announce('A new line of record type is added.');

    // Focus the input control of the newly added record type line.
    this.resourceTypeComponents.changes
      .pipe(take(1))
      .subscribe((components) => {
        setTimeout(() => components.last.focus());
      });
  }

  writeValue(value: SearchParameter[]): void {
    // TODO
  }

  /**
   * Returns the indefinite article ('a' or 'an') for the specified word.
   */
  getIndefiniteArticle(word: string): string {
    return /^[euioa]/i.test(word) ? 'an' : 'a';
  }
}
