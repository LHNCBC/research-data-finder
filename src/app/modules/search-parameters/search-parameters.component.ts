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
import { ResourceTypeCriteria } from '../../types/search-parameters';
import { getFocusableChildren } from '../../shared/utils';

const OPERATOR_ADDING_MESSAGE =
  ' A radio group for selecting an AND/OR operator to combine criteria has appeared above the criteria.';

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
  @ViewChildren('addResourceTypeBtn')
  addResourceTypeBtns: QueryList<MatButton>;
  switchRadioGroupMap = new Map<RuleSet, string>();
  switchRadioGroupIndex = 1;
  @ViewChild(QueryBuilderComponent)
  queryBuilderComponent: QueryBuilderComponent;
  public queryCtrl: FormControl = new FormControl({});
  public queryBuilderConfig: QueryBuilderConfig = { fields: {} };
  resourceTypes$: Observable<AutocompleteOption[]>;
  selectedElements = new Map<ResourceTypeCriteria, string[]>();

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
         * Adds a rule (criterion) for a resource type
         */
        addRule: (parent: RuleSet): void => {
          parent.rules = parent.rules.concat([
            {
              field: {}
            } as Rule
          ]);

          let message = 'A new line of search criterion is added.';
          if (parent.rules.length === 2) {
            message += OPERATOR_ADDING_MESSAGE;
          }
          this.liveAnnoncer.announce(message);

          // Focus the input control of the newly added search parameter line.
          this.searchParameterComponents.changes
            .pipe(take(1))
            .subscribe((components) => {
              setTimeout(() => components.last.focusSearchParamNameInput());
            });
        },

        /**
         * Adds a subgroup of criteria for resource types.
         * @param parent - parent group of criteria.
         */
        addRuleSet: (parent: RuleSet): void => {
          parent.rules = parent.rules.concat([{ condition: 'and', rules: [] }]);
          let message =
            'A new subgroup of criteria for resource types is added.';
          if (parent.rules.length === 2) {
            message += OPERATOR_ADDING_MESSAGE;
          }
          this.liveAnnoncer.announce(message);

          // Focus the newly added add resource type button.
          this.addResourceTypeBtns.changes
            .pipe(take(1))
            .subscribe((components) => {
              setTimeout(() => components.last.focus());
            });
        },

        /**
         * Removes a rule (criterion) from a resource type criteria
         * @param rule - criterion
         * @param parent - resource type criteria
         */
        removeRule: (rule: Rule, parent: RuleSet) => {
          parent.rules = parent.rules.filter((r) => r !== rule);
          if ('resourceType' in parent) {
            this.updateSelectedElements(
              (parent as unknown) as ResourceTypeCriteria
            );
          } else if ('resourceType' in rule) {
            this.selectedElements.delete(
              (rule as unknown) as ResourceTypeCriteria
            );
          }
        },

        /**
         * Removes a ruleset from a parent ruleset.
         * @param ruleset - set of rules (ResourceTypeCriteria or Criteria).
         * @param parent - set of rules (Criteria).
         */
        removeRuleSet: (ruleset: RuleSet, parent: RuleSet) => {
          parent.rules = parent.rules.filter((r) => r !== ruleset);
          this.switchRadioGroupMap.delete(ruleset);
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
   * Focuses the newly added add criterion button.
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
   * Returns the unique identifier of the radio button group for a set of rules.
   * @param ruleset - set of rules.
   */
  getSwitchRadioGroupId(ruleset: RuleSet): string {
    if (!this.switchRadioGroupMap.has(ruleset)) {
      this.switchRadioGroupMap.set(
        ruleset,
        'q-switch-group-' + ++this.switchRadioGroupIndex
      );
    }
    return this.switchRadioGroupMap.get(ruleset);
  }

  /**
   * Focuses on previous search parameter name field or focusable HTMLElement.
   * @param element - current element.
   */
  focusOnPreviousElement(element: HTMLElement): void {
    const focusableElements = getFocusableChildren(document.body);
    const prevElement =
      focusableElements[focusableElements.indexOf(element) - 1];
    const prevSearchParameter =
      prevElement && prevElement.closest('.search-parameter');
    if (prevSearchParameter) {
      prevSearchParameter.querySelector('input').focus();
    } else {
      prevElement.focus();
    }
  }

  /**
   * Adds a ruleset for a resource type
   * @param ruleset parent ruleset
   */
  addResourceType(ruleset: RuleSet): void {
    const newResourceTypeCriteria = {
      condition: 'and',
      rules: [],
      // RuleSet is treated as a ruleset for a resource type
      // if it has a "resourceType" property
      resourceType: ''
    };

    ruleset.rules = ruleset.rules.concat(newResourceTypeCriteria as RuleSet);

    let message = 'A new line of resource type is added.';
    if (ruleset.rules.length === 2) {
      message += OPERATOR_ADDING_MESSAGE;
    }
    this.liveAnnoncer.announce(message);

    // Focus the input control of the newly added resource type line.
    this.resourceTypeComponents.changes
      .pipe(take(1))
      .subscribe((components) => {
        setTimeout(() => components.last.focus());
      });

    this.selectedElements.set(
      newResourceTypeCriteria as ResourceTypeCriteria,
      []
    );
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

  /**
   * Updates the list of already selected elements (that match the search
   * parameters) for the specified resource type criteria. This list is used to
   * exclude dropdown options to avoid duplicate criteria.
   * @param parentRuleSet - resource type criteria
   */
  updateSelectedElements(parentRuleSet: ResourceTypeCriteria): void {
    this.selectedElements.set(
      parentRuleSet,
      parentRuleSet.rules.map((c) => c.field.element)
    );
  }
}
