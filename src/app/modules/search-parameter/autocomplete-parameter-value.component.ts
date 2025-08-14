import {
  AfterViewInit,
  Component,
  ElementRef,
  HostBinding,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  Optional,
  Self,
  ViewChild
} from '@angular/core';
import { AbstractControl, NgControl, UntypedFormControl } from '@angular/forms';
import { BaseControlValueAccessor } from '../base-control-value-accessor';
import Def from 'autocomplete-lhc';
import { MatFormFieldControl } from '@angular/material/form-field';
import {
  EMPTY,
  forkJoin,
  from,
  Observable,
  of,
  Subject,
  Subscription
} from 'rxjs';
import { ErrorStateMatcher } from '@angular/material/core';
import { escapeStringForRegExp } from '../../shared/utils';
import {
  catchError,
  defaultIfEmpty,
  expand,
  filter,
  map,
  mergeMap,
  reduce,
  switchMap,
  take,
  tap
} from 'rxjs/operators';
import {
  AutocompleteParameterValue
} from '../../types/autocomplete-parameter-value';
import { HttpClient, HttpContext } from '@angular/common/http';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import {
  FhirBackendService
} from '../../shared/fhir-backend/fhir-backend.service';
import {
  ResearchStudyService
} from '../../shared/research-study/research-study.service';
import { CartService } from '../../shared/cart/cart.service';
import { HIDE_ERRORS } from '../../shared/http-interceptors/toastr-interceptor';
import { isEqual } from 'lodash-es';
import ValueSetExpansionContains = fhir.ValueSetExpansionContains;
import Bundle = fhir.Bundle;
import Resource = fhir.Resource;
import Coding = fhir.Coding;

/**
 * data type used for this control
 */
export interface Lookup {
  code: string;
  display: string;
}

// The number of possible search parameter values for which we can request all
// possible values from server and use client search instead of ":text".
const CLIENT_SEARCH_LENGTH = 100;

/**
 * Component for search parameter value as autocomplete multi-select
 */
@Component({
  selector: 'app-autocomplete-parameter-value',
  templateUrl: './autocomplete-parameter-value.component.html',
  styleUrls: ['./autocomplete-parameter-value.component.less'],
  providers: [
    {
      provide: MatFormFieldControl,
      useExisting: AutocompleteParameterValueComponent
    }
  ]
})
export class AutocompleteParameterValueComponent
  extends BaseControlValueAccessor<AutocompleteParameterValue>
  implements
    OnDestroy,
    OnChanges,
    AfterViewInit,
    MatFormFieldControl<AutocompleteParameterValue> {
  get value(): AutocompleteParameterValue {
    return this.currentData;
  }

  /**
   * Whether the control is empty (Implemented as part of MatFormFieldControl)
   */
  get empty(): boolean {
    return !this.value.codes?.length;
  }

  /**
   * Whether the MatFormField label should try to float.
   */
  get shouldLabelFloat(): boolean {
    return this.focused || !this.empty;
  }

  // The current error state is used to check if it has changed.
  currentErrorState = false;

  /**
   * Whether the control is in an error state (Implemented as part of MatFormFieldControl)
   */
  get errorState(): boolean {
    const formControl = this.ngControl?.control as UntypedFormControl;
    if (formControl) {
      const newErrorState = (
        this.input?.nativeElement.className.indexOf('invalid') >= 0 ||
        (this.errorStateMatcher.isErrorState(formControl, null))
      );
      if (this.currentErrorState !== newErrorState) {
        this.currentErrorState = newErrorState;
        setTimeout(() => this.stateChanges.next());
      }
    }
    return this.currentErrorState;
  }

  /**
   * Whether the control has required validator (Implemented as part of MatFormFieldControl)
   */
  get required(): boolean {
    const validator = this.ngControl?.control.validator;
    if (validator) {
      const exampleResult = validator({} as AbstractControl);
      if (exampleResult && exampleResult.required) {
        return true;
      }
    }
    return false;
  }

  /**
   * Whether DbGap server is selected
   */
  get isDbgap(): boolean {
    return (
      this.fhirBackend.serviceBaseUrl ===
      'https://dbgap-api.ncbi.nlm.nih.gov/fhir/x1'
    );
  }

  constructor(
    @Optional() @Self() ngControl: NgControl,
    private elementRef: ElementRef,
    private errorStateMatcher: ErrorStateMatcher,
    private httpClient: HttpClient,
    private liveAnnouncer: LiveAnnouncer,
    private fhirBackend: FhirBackendService,
    private researchStudy: ResearchStudyService,
    private cart: CartService
  ) {
    super();
    if (ngControl != null) {
      this.ngControl = ngControl;
      // Setting the value accessor directly (instead of using
      // the providers) to avoid running into a circular import.
      ngControl.valueAccessor = this;
    }
  }


  /**
   * Unique id prefix for the input element.
   * Used to generate unique ids for multiple instances of this component.
   */
  static idPrefix = 'autocomplete-test-value-';
  /**
   * Static index to generate unique ids for the input element.
   */
  static idIndex = 0;
  /**
   * Unique id for the input element.
   */
  inputId =
    AutocompleteParameterValueComponent.idPrefix +
    ++AutocompleteParameterValueComponent.idIndex;

  /**
   * The list of autocomplete options available for selection.
   * Each option contains a code and its display text.
   */
  @Input() options: Lookup[] = [];
  /**
   * Mapping code to display text (used when server doesn't return "display")
   */
  code2display: { [code: string]: string };
  /**
   * Placeholder text for the autocomplete input.
   * Provided as an input to the component.
   */
  @Input() placeholder = '';
  /**
   * The FHIR resource type for which autocomplete values are provided.
   */
  @Input() resourceType: string;
  /**
   * List of observation codes used for filtering autocomplete options.
   */
  @Input() observationCodes: string[];
  /**
   * The search parameter(s) used for FHIR queries.
   * Can be a single string or an array of strings.
   */
  @Input() searchParameter: string[] | string;
  // Column name, defaults to searchParameter
  @Input() columnName: string[] | string;
  // FHIRPath expression to extract autocomplete option, defaults to searchParameter
  @Input() expression: string[] | string;
  /**
   * Whether to use prefetch mode for the autocompleter.
   * If true, all possible values are passed to the component through the "options" parameter.
   */
  @Input() usePrefetch = false;
  /**
   * Indicates whether to use client-side search for autocomplete options.
   * Can be a boolean or an array of booleans for multiple search parameters.
   * The client-side search is used for small sets of values or when display
   * values are missing.
   */
  useClientSearch: boolean[] | boolean;
  // Description of the current search parameter extracted from spec definitions
  searchParamDesc: any;

  EVIDENCEVARIABLE = 'EvidenceVariable';
  dbgapLoincOnly = false;
  currentData: AutocompleteParameterValue = {
    codes: [],
    items: []
  };
  ngControl: NgControl = null;
  // Autocompleter instance
  acInstance: any;
  // Callback to handle changes
  listSelectionsObserver: (eventData: any) => void;
  // Subscription used to cancel the previous loading process
  subscription: Subscription;
  // Reference to the <input> element
  @ViewChild('input') input: ElementRef<HTMLInputElement>;

  /**
   * Whether the control is in a loading state.
   */
  @HostBinding('class.loading') loading = false;

  /**
   * Whether the control is focused (Implemented as part of MatFormFieldControl)
   */
  focused = false;

  /**
   * Stream that emits whenever the state of the control changes such that
   * the parent `MatFormField` needs to run change detection.
   */
  readonly stateChanges = new Subject<void>();

  /**
   * These properties currently unused but required by MatFormFieldControl:
   */
  readonly disabled: boolean = false;
  readonly id: string;

  /**
   * Returns EV id from a DbGap variable API response
   * e.g. phv00054122.v1.p1 => phv00054122
   * @private
   */
  private static getEvIdFromDbgapVariableApi(value: string): string {
    return /^(.+)\.v\d+\.p\d+$/.test(value) ? RegExp.$1 : null;
  }
  setDescribedByIds(): void {}

  /**
   * Handles focusin event to maintain the focused state.
   */
  @HostListener('focusin')
  onFocusin(): void {
    if (!this.focused) {
      this.focused = true;
      this.stateChanges.next();
    }
  }

  /**
   * Handles focusout event to maintain the focused state.
   */
  @HostListener('focusout', ['$event.relatedTarget'])
  onFocusOut(relatedTarget: HTMLElement): void {
    if (
      this.focused &&
      !this.elementRef.nativeElement.contains(relatedTarget)
    ) {
      this.focused = false;
      this.stateChanges.next();
      this.loading = false;
      this.subscription?.unsubscribe();
    }
  }

  /**
   * Handles a click on the control's container to maintain the focused state.
   */
  onContainerClick(event: MouseEvent): void {
    if (!this.focused) {
      document.getElementById(this.inputId).focus();
    }
  }

  /**
   * A callback method that is invoked immediately after the default change
   * detector has checked data-bound properties if at least one has changed,
   * and before the view and content children are checked.
   */
  ngOnChanges(): void {
    if (this.acInstance) {
      this.setupAutocomplete();
    }
  }

  ngAfterViewInit(): void {
    this.setupAutocomplete();
  }

  /**
   * Performs cleanup when a component instance is destroyed.
   */
  ngOnDestroy(): void {
    this.destroyAutocomplete();
  }

  /**
   * Set up Autocompleter.
   * Also call this.onChange() of ControlValueAccessor interface on selection event,
   * so that form control value is updated and can be read from parent form.
   */
  setupAutocomplete(): void {
    // Destroy previous instance
    this.destroyAutocomplete();

    this.acInstance =
      this.resourceType === this.EVIDENCEVARIABLE
        ? this.getAutocomplete_EV()
        : this.getAutocomplete();

    this.updateAutocomplete();

    this.listSelectionsObserver = () => {
      const coding = this.acInstance.getSelectedCodes();
      const items = this.acInstance.getSelectedItems();
      this.currentData = {
        codes: coding,
        items
      };
      this.onChange(this.currentData?.codes.length ? this.currentData : null);
    };

    Def.Autocompleter.Event.observeListSelections(
      this.inputId,
      this.listSelectionsObserver
    );
  }

  /**
   * Fill component with this.currentData.
   */
  private updateAutocomplete(): void {
    // Fill autocomplete with data (if currentData was set in writeValue).
    this.acInstance.clearStoredSelection();
    this.currentData.items.forEach((item, index) => {
      this.acInstance.storeSelectedItem(item, this.currentData.codes[index]);
      this.acInstance.addToSelectedArea(item);
    });
  }

  /**
   * Destroy the autocompleter
   */
  destroyAutocomplete(): void {
    if (this.acInstance) {
      this.acInstance.destroy();
      Def.Autocompleter.Event.removeCallback(
        this.inputId,
        'LIST_SEL',
        this.listSelectionsObserver
      );
      this.acInstance = null;
    }
  }

  /**
   * Get autocompleter instance.
   * It could be a Prefetch or a Search instance depending on this.usePrefetch.
   */
  getAutocomplete(): any {
    return this.usePrefetch
      ? this.setupAutocompletePrefetch()
      : this.setupAutocompleteSearch();
  }

  /**
   * Get autocompleter instance for Evidence Variable.
   * The instance uses DbGap variable API if server is DbGap, otherwise it uses fhir queries.
   */
  getAutocomplete_EV(): any {
    return this.isDbgap
      ? this.setupAutocomplete_EV_DbgapVariableApi()
      : this.setupAutocompleteSearch_EV();
  }

  /**
   * Set up Autocompleter prefetch options.
   */
  setupAutocompletePrefetch(): any {
    return new Def.Autocompleter.Prefetch(
      // We can't use the input element's id here, because it might not be
      // in DOM if the component is in an inactive tab.
      this.input.nativeElement,
      this.options.map((o) => o.display),
      {
        maxSelect: '*',
        codes: this.options.map((o) => o.code),
        matchListValue: true
      }
    );
  }

  /**
   * Set up Autocompleter search options.
   */
  setupAutocompleteSearch(): any {
    const currentDefinitions = this.fhirBackend.getCurrentDefinitions();
    // Get search parameter description from specification
    this.searchParamDesc = currentDefinitions.resources[this.resourceType]
      .searchParameters.find(i => isEqual(i.element, this.searchParameter));
    // At initialization, we don't yet know whether to use client search
    this.useClientSearch = undefined;

    return new Def.Autocompleter.Search(
      // We can't use the input element's id here, because it might not be
      // in DOM if the component is in an inactive tab.
      this.input.nativeElement, null, {
      suggestionMode: Def.Autocompleter.NO_COMPLETION_SUGGESTIONS,
      fhir: {
        search: (fieldVal, count) => {
          return {
            then: (resolve, reject) => {
              this.subscription?.unsubscribe();
              this.subscription = this.searchItemsOnFhirServer(fieldVal, count, resolve, reject).subscribe();
            }
          };
        }
      },
      useResultCache: false,
      maxSelect: '*',
      matchListValue: true,
      showListOnFocusIfEmpty: this.searchParameter !== 'code',
      showLoadingIndicator: false
    });
  }


  /**
   * Returns the item at the specified index if `val` is an array,
   * or returns `val` itself if it is not an array.
   *
   * @param val - The array or single item.
   * @param index - The index to retrieve if `val` is an array.
   * @returns The item at the index or `val` itself.
   */
  private getItemByIndex<T>(val: T[] | T, index: number): T | undefined {
    if (Array.isArray(val)) {
      return val[index];
    }
    return val;
  }


  /**
   * Checks if client search is needed.
   * We use client search for small required sets of values or where the "display"
   * value could be skipped since ":text" won't work in that case.
   */
  isClientSearchNeeded(index: number): Observable<boolean> {
    if (this.getItemByIndex(this.useClientSearch, index) === undefined) {
      let obs: Observable<boolean>;
      const currentDefinitions = this.fhirBackend.getCurrentDefinitions();
      const required = this.getItemByIndex(this.searchParamDesc?.required, index);
      const valueSet = required
        ? currentDefinitions.valueSets[this.getItemByIndex(this.searchParamDesc.valueSet, index)]
        : null;

      if (required && valueSet) {
        if (typeof valueSet === 'string') {
          obs = this.httpClient.get(`$fhir/ValueSet/$expand`, {
            params: {
              url: valueSet
            },
            // "/ValueSet/$expand" may not be implemented
            context: new HttpContext().set(HIDE_ERRORS, true)
          }).pipe(
            map((vs: any) => vs?.expansion?.total <= CLIENT_SEARCH_LENGTH),
            catchError(() => {
              return this.checkIfValuesHaveNoDisplay(index);
            })
          );
        } else {
          obs = of(valueSet.length <= CLIENT_SEARCH_LENGTH)
        }
      } else {
        obs = this.checkIfValuesHaveNoDisplay(index);
      }
      return obs.pipe(
        tap((useClientSearch) => {
          if (this.getNumberOfSearchParameters() > 1) {
            if (!Array.isArray(this.useClientSearch)) {
              this.useClientSearch = [];
            }
            this.useClientSearch[index] = useClientSearch;
          } else {
            this.useClientSearch = useClientSearch;
          }
        })
      );
    } else {
      return of(this.getItemByIndex(this.useClientSearch, index));
    }
  }


  /**
   * Returns the search parameter name at the specified index for a FHIR search
   * query. If the parameter type is 'Reference', appends '.code' to
   * the parameter name. Otherwise, returns the parameter name as is.
   *
   * @param index - The index of the search parameter.
   * @returns The search parameter name, possibly with '.code' appended.
   */
  getSearchParameterName(index: number): string {
    const searchParameter = this.getItemByIndex(this.searchParameter, index);
    return this.getItemByIndex(this.searchParamDesc?.type, index) === 'Reference' ?
      `${searchParameter}.code` : `${searchParameter}`;
  }


  /**
   * Returns the `_elements` parameter value for a FHIR search query at
   * the specified index. If the parameter type is 'Reference', returns
   * a comma-separated string including 'contained', 'code', and
   * the FHIR field name. Otherwise, returns just the FHIR field name.
   *
   * @param index - The index of the search parameter.
   * @returns The `_elements` parameter value for the FHIR query.
   */
  getElementsParam(index: number): string {
    const type = this.getItemByIndex(this.searchParamDesc?.type, index);
    const fhirName = this.getItemByIndex(this.columnName ||
      this.searchParamDesc?.rootPropertyName || this.searchParameter, index);

    return type === 'Reference' ?
      (['contained', 'code', fhirName]).join(',')
      : fhirName;
  }


   /**
   * Checks if any of the values for the specified search parameter index
   * in the FHIR resource bundle do not have a `display` property.
   * Only the first page of the resource bundle is checked.
   *
   * @param index - The index of the search parameter to check.
   * @returns An observable that emits `true` if at least one value does not
   *  have a `display` property, otherwise `false`.
   */
  checkIfValuesHaveNoDisplay(index: number): Observable<boolean> {
    const url = `$fhir/${this.resourceType}`;
    const params = {
      _elements: this.getElementsParam(index)
    };
    const searchParameterName = this.getSearchParameterName(index);

    if (this.fhirBackend.features.missingModifier) {
      params[`${searchParameterName}:missing`] = false;
    } else {
      // if the :missing modifier is not allowed, :not=zzz is used instead
      params[`${searchParameterName}:not`] = 'zzz';
    }

    return this.httpClient.get(url, { params }).pipe(
      switchMap((response: Bundle) => {
        const codingsGetter = this.getCodingsGetter(index);
        return from(response.entry || []).pipe(
          mergeMap(entry => codingsGetter(entry.resource)),
          map(codings => codings.length && !!codings.find(coding => coding.display === undefined)),
          filter(result => result),
          take(1),
          defaultIfEmpty(false)
        )
      })
    );
  }


  /**
   * Returns the number of search parameters.
   * If `searchParameter` is an array, returns its length; otherwise, returns 1.
   *
   * @returns The number of search parameters.
   */
  getNumberOfSearchParameters(): number {
    return Array.isArray(this.searchParameter) ?
      this.searchParameter.length
      : 1;
  }

  /**
   * Search for autocomplete items on the FHIR server.
   * @param filterText - filter text
   * @param count - number of items to be found
   * @param resolve - success callback
   * @param reject - error callback
   */
  searchItemsOnFhirServer(
    filterText: string,
    count: number,
    resolve: Function,
    reject: Function
  ) {

    this.loading = true;

    const paramCount = this.getNumberOfSearchParameters();

    const url = `$fhir/${this.resourceType}`;
    // Hash of processed codes, used to exclude repeated codes
    const processedCodes = {};
    // Array of result items for autocompleter
    const contains: ValueSetExpansionContains[] = [];
    // Already selected codes
    const selectedCodes = this.acInstance.getSelectedCodes();

    return forkJoin(Array.from(
      { length: paramCount },
      (_, index) => this.isClientSearchNeeded(index)
    )).pipe(
      switchMap((useClientSearchArr) => {
        return forkJoin(useClientSearchArr.map((useClientSearch, index) => {
          this.code2display = this.options?.reduce((acc, item) => {
            acc[item.code] = item.display;
            return acc;
          }, {}) || {};
          const params = {
            ...(this.observationCodes
              ? { 'combo-code': this.observationCodes.join(',') }
              : {}),
            _elements: this.getElementsParam(index)
          };

          const paramName = this.getSearchParameterName(index);

          if (!useClientSearch && filterText) {
            params[`${paramName}:text`] = filterText;
          } else {
            if (this.fhirBackend.features.missingModifier) {
              params[`${paramName}:missing`] = false;
            } else {
              // if the :missing modifier is not allowed, :not=zzz is used instead
              params[`${paramName}:not`] = 'zzz';
            }
          }

          return this.httpClient
            .get(url, {
              params
            }).pipe(
              mergeMap((response:Bundle) => {
                return this.getAutocompleteItems({
                    bundle: response,
                    filterText,
                    processedCodes,
                    selectedCodes,
                    index,
                    params,
                    searchParameterName: paramName
                  })
                }
              )
            );
        })).pipe(
          switchMap((results) => of(results).pipe(
            expand(resultArr => {
              const newItems = resultArr.flatMap(r => r.newItems);
              contains.push(...newItems);
              this.appendCodeSystemToDuplicateDisplay(contains);
              const nextPages =
                resultArr.filter(({nextPageUrl}) => nextPageUrl);
              const responseTotal = resultArr.reduce((sum, item) => {
                if (sum !== null && item.bundle.total) {
                  return sum + item.bundle.total;
                }
                return null;
              }, 0);
              if (nextPages.length > 0 && contains.length < count) {
                if (newItems.length) {
                  this.liveAnnouncer.announce('New items added to list.');
                  // Update list before calling server for next query.
                  resolve({
                    resourceType: 'ValueSet',
                    expansion: {
                      total: responseTotal,
                      contains
                    }
                  });
                }

                return forkJoin(nextPages.map(({params, searchParameterName, codesCountChanged, nextPageUrl}, index) => {
                  let nextPageRequest: Observable<Bundle>;
                  let newParams : {
                    [p: string]: string | number | boolean | readonly (string | number | boolean)[]
                  } = {};
                  //  We have to check that there are no new processed codes to avoid unnecessary requests.
                  if (!codesCountChanged) {
                    // If the request did not return new codes, then we need
                    // to go to the next page.
                    // Otherwise, it will be an infinite recursion.
                    // You can reproduce this problem on https://dbgap-api.ncbi.nlm.nih.gov/fhir/x1
                    // if you comment next line and enter 'c' in the ResearchStudy.keyword
                    // field and click the 'See more items' link.
                    newParams = params;
                    nextPageRequest = this.httpClient.get<Bundle>(nextPageUrl)
                  } else {
                    newParams = { ...params };
                    newParams[`${searchParameterName}:not`] = this.fhirBackend.features
                      .hasNotModifierIssue
                      ? // Pass a single ":not" parameter, which is currently working
                        // correctly on the HAPI FHIR server.
                      Object.keys(processedCodes).join(',')
                      : // Pass each code as a separate ":not" parameter, which is
                        // currently causing performance issues on the HAPI FHIR server.
                      Object.keys(processedCodes);
                    nextPageRequest = this.httpClient
                      .get<Bundle>(url, {
                        params: newParams
                      })
                  }
                  return nextPageRequest.pipe(
                      mergeMap((response:Bundle) => this.getAutocompleteItems({
                        bundle: response,
                        filterText,
                        processedCodes,
                        selectedCodes,
                        index,
                        params: newParams,
                        searchParameterName
                      }))
                    );
                }));
              } else {
                let total = null;
                if (nextPages.length === 0) {
                  total = contains.length;
                } else if (responseTotal) {
                  total = responseTotal;
                }
                if (contains.length > count) {
                  contains.length = count;
                }
                this.loading = false;
                this.liveAnnouncer.announce('Finished loading list.');
                resolve({
                  resourceType: 'ValueSet',
                  expansion: {
                    total: Number.isInteger(total) ? total : null,
                    contains
                  }
                });
                // Emit a complete notification
                return EMPTY;
              }
            })
          ))
        )
      }),
      catchError((error) => {
        this.loading = false;
        reject(error);
        return of(contains);
      })
    );
  }

  /**
   * Set up Autocompleter search options for DbGap variable API search.
   */
  setupAutocomplete_EV_DbgapVariableApi(): any {
    const acInstance = new Def.Autocompleter.Search(
      // We can't use the input element's id here, because it might not be
      // in DOM if the component is in an inactive tab.
      this.input.nativeElement, null, {
      suggestionMode: Def.Autocompleter.NO_COMPLETION_SUGGESTIONS,
      fhir: {
        search: (fieldVal, count) => {
          return {
            then: (resolve, reject) => {
              const url =
                'https://clinicaltables.nlm.nih.gov/api/dbg_vars/v3/search';
              const params = {
                rec_type: 'dbgv',
                terms: fieldVal,
                maxList: count,
                sf: `dbgv.${this.searchParameter}`,
                df: `dbgv.${this.searchParameter}`,
                q: this.getDbgapEvResearchStudyParam()
              };
              if (this.dbgapLoincOnly) {
                params['q'] += ' has_loinc:true';
              }
              // Array of result items for autocompleter
              const contains: ValueSetExpansionContains[] = [];
              // Already selected items
              const selectedCodes = acInstance.getSelectedItems();

              this.loading = true;
              this.subscription?.unsubscribe();

              this.subscription = this.httpClient
                .get(url, {
                  params
                })
                .pipe(
                  catchError((error) => {
                    this.loading = false;
                    reject(error);
                    return of(contains);
                  })
                )
                .subscribe((response) => {
                  contains.push(
                    ...this.getAutocompleteItems_EV_dbgapVariableApi(
                      response,
                      selectedCodes
                    )
                  );
                  this.loading = false;
                  this.liveAnnouncer.announce('Finished loading list.');
                  resolve({
                    resourceType: 'ValueSet',
                    expansion: {
                      total: response[0],
                      contains
                    }
                  });
                });
            }
          };
        }
      },
      useResultCache: false,
      maxSelect: '*',
      matchListValue: true,
      showListOnFocusIfEmpty: true,
      showLoadingIndicator: false
    });
    return acInstance;
  }

  /**
   * Set up Autocompleter search options.
   */
  setupAutocompleteSearch_EV(): any {
    const acInstance = new Def.Autocompleter.Search(
      // We can't use the input element's id here, because it might not be
      // in DOM if the component is in an inactive tab.
      this.input.nativeElement, null, {
      suggestionMode: Def.Autocompleter.NO_COMPLETION_SUGGESTIONS,
      fhir: {
        search: (fieldVal, count) => {
          return {
            then: (resolve, reject) => {
              const url = `$fhir/${this.EVIDENCEVARIABLE}`;
              const params = {
                _elements: this.searchParameter
              };
              params[this.searchParameter as string] = fieldVal;
              // Hash of processed codes, used to exclude repeated codes
              const processedCodes = {};
              // Array of result items for autocompleter
              const contains: ValueSetExpansionContains[] = [];
              // Total amount of items
              let total = null;
              // Already selected items
              const selectedCodes = acInstance.getSelectedItems();

              this.loading = true;
              this.subscription?.unsubscribe();

              const obs = this.httpClient
                .get(url, {
                  params
                })
                .pipe(
                  expand((response: Bundle) => {
                    contains.push(
                      ...this.getAutocompleteItems_EV(
                        response,
                        processedCodes,
                        selectedCodes
                      )
                    );
                    const nextPageUrl = this.fhirBackend.getNextPageUrl(response);
                    if (nextPageUrl && contains.length < count) {
                      this.liveAnnouncer.announce('New items added to list.');
                      // Update list before calling server for next query.
                      resolve({
                        resourceType: 'ValueSet',
                        expansion: {
                          total: Number.isInteger(total) ? total : null,
                          contains
                        }
                      });
                      const newParams = { ...params };
                      newParams['_id:not'] = this.fhirBackend.features
                        .hasNotModifierIssue
                        ? // Pass a single "_id:not" parameter, which is currently working
                          // correctly on the HAPI FHIR server.
                          Object.keys(processedCodes).join(',')
                        : // Pass each code as a separate "_id:not" parameter, which is
                          // currently causing performance issues on the HAPI FHIR server.
                          Object.keys(processedCodes);
                      return this.httpClient.get(url, {
                        params: newParams
                      });
                    } else {
                      if (!nextPageUrl) {
                        total = contains.length;
                      } else if (response.total) {
                        total = response.total;
                      }
                      if (contains.length > count) {
                        contains.length = count;
                      }
                      this.loading = false;
                      this.liveAnnouncer.announce('Finished loading list.');
                      resolve({
                        resourceType: 'ValueSet',
                        expansion: {
                          total: Number.isInteger(total) ? total : null,
                          contains
                        }
                      });
                      // Emit a complete notification
                      return EMPTY;
                    }
                  }),
                  catchError((error) => {
                    this.loading = false;
                    reject(error);
                    return of(contains);
                  })
                );

              this.subscription = obs.subscribe();
            }
          };
        }
      },
      useResultCache: false,
      maxSelect: '*',
      matchListValue: true,
      showListOnFocusIfEmpty: true,
      showLoadingIndicator: false
    });
    return acInstance;
  }

  /**
   * Extracts autocomplete items from resource bundle
   * @param bundle - resource bundle
   * @param processedCodes - hash of processed items.
   * Key is the EV name/description value; value is an array of EV IDs.
   * Multiple EVs with the same name/description will be grouped.
   * @param selectedCodes - already selected items
   */
  getAutocompleteItems_EV(
    bundle: Bundle,
    processedCodes: { [key: string]: string[] },
    selectedCodes: Array<string>
  ): ValueSetExpansionContains[] {
    const result = [];
    (bundle.entry || []).forEach((e) => {
      const displayItem = e.resource[this.searchParameter as string];
      if (processedCodes[displayItem]) {
        processedCodes[displayItem].push(e.resource.id);
      } else {
        processedCodes[displayItem] = [e.resource.id];
        if (selectedCodes.indexOf(displayItem) === -1) {
          result.push({
            display: displayItem,
            code: processedCodes[displayItem]
          });
        }
      }
    });
    return result;
  }

  /**
   * Extracts autocomplete items from DbGap variable API response
   * @param response - response from DbGap variable API
   * The response takes the form of an array: first item is the total match on server;
   * second item is an array of IDs, fourth item is an array of requested property (name/description).
   * @param selectedCodes - already selected items
   */
  getAutocompleteItems_EV_dbgapVariableApi(
    response: any,
    selectedCodes: Array<string>
  ): ValueSetExpansionContains[] {
    if (!response[1]?.length) {
      return [];
    }
    const result = [];
    for (let i = 0; i < response[1].length; i++) {
      const displayItem = response[3][i][0];
      const id = AutocompleteParameterValueComponent.getEvIdFromDbgapVariableApi(
        response[1][i]
      );
      const duplicateDisplayItem = result.find(
        (x) => x.display === displayItem
      );
      if (duplicateDisplayItem) {
        duplicateDisplayItem.code.push(id);
      } else if (selectedCodes.indexOf(displayItem) === -1) {
        result.push({
          display: displayItem,
          code: [id]
        });
      }
    }
    return result;
  }

  /**
   * Extracts autocomplete items from a FHIR resource bundle for
   * the autocompleter. Filters and processes codings based on the filter text,
   * already processed codes, and selected codes. Returns an observable emitting
   * an object containing new items, the source bundle, request parameters,
   * search parameter name, a flag indicating whether the list of processed
   * codes has changed, and the next page URL if available.
   *
   * @param bundle - The FHIR resource bundle.
   * @param filterText - The text to filter autocomplete options.
   * @param processedCodes - Hash of processed codes to avoid duplicates.
   * @param selectedCodes - Array of already selected codes.
   * @param index - The index of the search parameter.
   * @param params - The request parameters.
   * @param searchParameterName - The name of the search parameter.
   * @returns Observable emitting the extracted autocomplete items and related metadata.
   */
  getAutocompleteItems(
    {
      bundle,
      filterText,
      processedCodes,
      selectedCodes,
      index,
      params,
      searchParameterName
    } : {
      bundle: Bundle,
      filterText: string,
      processedCodes: { [key: string]: boolean },
      selectedCodes: Array<string>,
      index: number,
      params: { [key: string]: string | number | boolean | readonly (string | number | boolean)[] },
      searchParameterName: string
    }
  ): Observable<{
      newItems: ValueSetExpansionContains[],
      bundle: Bundle,
      params: { [key: string]: string | number | boolean | readonly (string | number | boolean)[] },
      searchParameterName: string,
      codesCountChanged: boolean,
      nextPageUrl: string | null
  }> {
    // Additional filter for options list.
    // Because `coding` can have values that don't match the text in the autocomplete field.
    // For example, ResearchStudy.keyword (https://dbgap-api.ncbi.nlm.nih.gov/fhir/x1)
    const reDisplay = filterText
      ? new RegExp(`\\b${escapeStringForRegExp(filterText)}`, 'i')
      : /.*/;
    const getCodings = this.getCodingsGetter(index);
    const prevCodesCount = Object.keys(processedCodes).length;
    return from(bundle.entry || []).pipe(
      mergeMap(entry => getCodings(entry.resource)),
      reduce((items, codings) => {
        codings = codings.map((coding) => {
          return {
            display: coding.display,
            code: (coding.system ? coding.system : '') + '|' + coding.code
          };
        }).filter((coding) => {
          const matched =
            // Additional filter for options list.
            (coding.display ?
                reDisplay.test(coding.display)
                : reDisplay.test(coding.code)
            ) &&
            !processedCodes[coding.code] &&
            selectedCodes.indexOf(coding.code) === -1;

          processedCodes[coding.code] = true;

          return matched;
        }).map(c => c.display ? c : {...c, display: this.code2display[c.code] || c.code });
        if (codings.length) {
          items.push(...codings);
        }
        return items;
      }, []),
      map((newItems: ValueSetExpansionContains[]) => ({
        newItems,
        bundle,
        params,
        searchParameterName,
        codesCountChanged: prevCodesCount !== Object.keys(processedCodes).length,
        nextPageUrl: this.fhirBackend.getNextPageUrl(bundle)
      }))
    );
  }


  /**
   * For autocomplete items with the same display and different code + code system
   * combination, append code + code system to the display so distinct items are
   * shown to the user.
   * @param contains the array of items for the autocomplete
   */
  appendCodeSystemToDuplicateDisplay(contains: any[]): void {
    // an array of displays that have more than one appearance.
    const duplicateDisplays = contains
      .filter(
        (item, index, arr) =>
          arr.findIndex((x) => x.display === item.display) !== index
      )
      .map((item) => item.display);
    contains.forEach((item) => {
      if (duplicateDisplays.includes(item.display)) {
        item.display = `${item.display} | ${item.code.split('|').reverse().join(' | ')}`;
      }
    });
  }


  /**
   * Get 'q' params value for DbGap variable API query.
   * e.g. study_id:phs002410*, study_id:(phs002410*%20OR%20phs002409*)
   * @private
   */
  private getDbgapEvResearchStudyParam(): string {
    const selectedStudyIds =
      (this.cart.getListItems('ResearchStudy') as Resource[])
        ?.map(({id}) => id)
      || this.researchStudy.currentState?.myStudyIds || [];
    if (!selectedStudyIds.length) {
      return '';
    }
    if (selectedStudyIds.length === 1) {
      return `study_id:${selectedStudyIds[0]}*`;
    }
    return `study_id:(${selectedStudyIds
      .map((id) => id + '*')
      .join(' OR ')})`;
  }

  /**
   * Part of the ControlValueAccessor interface
   */
  writeValue(value: AutocompleteParameterValue): void {
    this.currentData = value || {
      codes: [],
      items: []
    };
    if (this.acInstance) {
      this.updateAutocomplete();
    }
  }


  /**
   * Returns a function which extracts the Codings that matches the
   * search parameter from the resource object.
   */
  getCodingsGetter(index: number): (resource: Resource) => Observable<Coding[]> {
    const expression = this.getItemByIndex(
      this.expression || this.searchParamDesc?.expression || this.searchParameter,
      index);

    const compiledExpression = this.fhirBackend.getEvaluator(
      this.getItemByIndex(this.searchParamDesc?.type, index) === 'Reference' ?
        `(${expression}).resolve().code` // If it is a Reference, resolve it to
                                         // get the Coding
        : expression);

    return (resource) => {
      const v = compiledExpression(resource);
      return (v instanceof Promise ? from(v) : of(v)).pipe(
        map(vvv => {
          return [].concat(...vvv.map((value) => {
            if (Array.isArray(value)) {
              return [].concat(
                ...value.map((v) => (v.code ? [v] : v.coding || []))
              );
            } else if (typeof value === 'string') {
              // if we only have code, add a display value with the same value
              return [{code: value, display: value}];
            }
            return value.code ? [value] : value.coding || [];
          }));
        })
      );
    }
  }

  getAriaLabel(): string {
    return this.resourceType === this.EVIDENCEVARIABLE
      ? `select Evidence Variables by ${this.searchParameter}`
      : this.searchParameter === 'code'
      ? `${this.resourceType} codes from FHIR server`
      : 'Search parameter value';
  }
}
