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
import { EMPTY, Observable, of, Subject, Subscription } from 'rxjs';
import { ErrorStateMatcher } from '@angular/material/core';
import { escapeStringForRegExp } from '../../shared/utils';
import {
  catchError,
  expand,
  map,
  switchMap,
  tap
} from 'rxjs/operators';
import { AutocompleteParameterValue } from '../../types/autocomplete-parameter-value';
import { HttpClient, HttpContext } from '@angular/common/http';
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { FhirBackendService } from '../../shared/fhir-backend/fhir-backend.service';
import { ResearchStudyService } from '../../shared/research-study/research-study.service';
import ValueSetExpansionContains = fhir.ValueSetExpansionContains;
import Bundle = fhir.Bundle;
import Resource = fhir.Resource;
import Coding = fhir.Coding;
import { CartService } from '../../shared/cart/cart.service';
import { HIDE_ERRORS } from '../../shared/http-interceptors/toastr-interceptor';

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

  /**
   * Whether the control is in an error state (Implemented as part of MatFormFieldControl)
   */
  get errorState(): boolean {
    const formControl = this.ngControl?.control as UntypedFormControl;
    return (
      this.input?.nativeElement.className.indexOf('invalid') >= 0 ||
      (formControl && this.errorStateMatcher.isErrorState(formControl, null))
    );
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

  static idPrefix = 'autocomplete-test-value-';
  static idIndex = 0;
  static codeTextFieldMapping = {
    MedicationDispense: 'medicationCodeableConcept',
    MedicationRequest: 'medicationCodeableConcept'
  };

  inputId =
    AutocompleteParameterValueComponent.idPrefix +
    ++AutocompleteParameterValueComponent.idIndex;
  @Input() options: Lookup[] = [];
  // Mapping code to display text (used when server doesn't return "display")
  code2display: { [code: string]: string };
  @Input() placeholder = '';
  @Input() resourceType: string;
  @Input() observationCodes: string[];
  @Input() searchParameter: string;
  // Column name, defaults to searchParameter
  @Input() columnName: string;
  // FHIRPath expression to extract autocomplete option, defaults to searchParameter
  @Input() expression: string;
  @Input() usePrefetch = false;
  // Whether to use client search after getting possible values from the server.
  // We use client search for small required sets of values or where the "display"
  // value could be skipped since ":text" won't work in that case.
  useClientSearch: boolean;
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
      this.inputId,
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
    this.searchParamDesc = currentDefinitions.resources[this.resourceType].searchParameters.find(i => i.element === this.searchParameter);
    // At initialization, we don't yet know whether to use client search
    this.useClientSearch = undefined;

    return new Def.Autocompleter.Search(this.inputId, null, {
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
      showListOnFocusIfEmpty: this.searchParameter !== 'code'
    });
  }

  /**
   * Checks if client search is needed.
   * We use client search for small required sets of values or where the "display"
   * value could be skipped since ":text" won't work in that case.
   */
  isClientSearchNeeded(): Observable<boolean> {
    if (this.useClientSearch === undefined) {
      let obs: Observable<boolean>;
      const currentDefinitions = this.fhirBackend.getCurrentDefinitions();
      const valueSet = this.searchParamDesc.required
        ? currentDefinitions.valueSets[this.searchParamDesc.valueSet]
        : null;

      if (this.searchParamDesc.required && valueSet) {
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
              return this.checkIfValuesHaveNoDisplay();
            })
          );
        } else {
          obs = of(valueSet.length <= CLIENT_SEARCH_LENGTH)
        }
      } else {
        obs = this.checkIfValuesHaveNoDisplay();
      }
      return obs.pipe(
        tap((useClientSearch) => {
          this.useClientSearch = useClientSearch;
        })
      );
    } else {
      return of(this.useClientSearch);
    }
  }

  /**
   * Checks if values have no display. We only check the first page of resource
   * bundle.
   */
  checkIfValuesHaveNoDisplay(): Observable<boolean> {
    const url = `$fhir/${this.resourceType}`;
    const params = {
      _elements: this.getFhirName()
    };

    if (this.fhirBackend.features.missingModifier) {
      params[`${this.searchParameter}:missing`] = false;
    } else {
      // if the :missing modifier is not allowed, :not=zzz is used instead
      params[`${this.searchParameter}:not`] = 'zzz';
    }

    return this.httpClient.get(url, { params }).pipe(
      map((response: Bundle) => {
        const codingsGetter = this.getCodingsGetter();
        return (response.entry || []).find((entry) => {
          const codings = codingsGetter(entry.resource);
          return codings.length && codings.find(coding => coding.display === undefined);
        }) !== undefined;
      })
    );
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
    return this.isClientSearchNeeded().pipe(
      switchMap((useClientSearch) => {
        this.code2display = this.options?.reduce((acc, item) => {
          acc[item.code] = item.display;
          return acc;
        }, {}) || {};
        const url = `$fhir/${this.resourceType}`;
        const params = {
          ...(this.observationCodes
            ? { 'combo-code': this.observationCodes.join(',') }
            : {}),
          _elements: this.getFhirName()
        };

        if (!useClientSearch && filterText) {
          params[`${this.searchParameter}:text`] = filterText;
        } else {
          if (this.fhirBackend.features.missingModifier) {
            params[`${this.searchParameter}:missing`] = false;
          } else {
            // if the :missing modifier is not allowed, :not=zzz is used instead
            params[`${this.searchParameter}:not`] = 'zzz';
          }
        }

        // Hash of processed codes, used to exclude repeated codes
        const processedCodes = {};
        // Array of result items for autocompleter
        const contains: ValueSetExpansionContains[] = [];
        // Total amount of items
        let total = null;
        // Already selected codes
        const selectedCodes = this.acInstance.getSelectedCodes();

        this.loading = true;

        return this.httpClient
          .get(url, {
            params
          })
          .pipe(
            expand((response: Bundle) => {
              const prevProcCodesCount = Object.keys(processedCodes).length;
              const newItems = this.getAutocompleteItems(
                response,
                filterText,
                processedCodes,
                selectedCodes
              );
              contains.push(...newItems);
              const nextPageUrl = this.fhirBackend.getNextPageUrl(response);
              if (nextPageUrl && contains.length < count) {
                //  We have to check that there are no new processed codes to avoid unnecessary requests.
                if (prevProcCodesCount === Object.keys(processedCodes).length) {
                  // If the request did not return new codes, then we need
                  // to go to the next page.
                  // Otherwise, it will be an infinite recursion.
                  // You can reproduce this problem on https://dbgap-api.ncbi.nlm.nih.gov/fhir/x1
                  // if you comment next line and enter 'c' in the ResearchStudy.keyword
                  // field and click the 'See more items' link.
                  return this.httpClient.get(nextPageUrl);
                }
                if (newItems.length) {
                  this.liveAnnouncer.announce('New items added to list.');
                  // Update list before calling server for next query.
                  resolve({
                    resourceType: 'ValueSet',
                    expansion: {
                      total: Number.isInteger(total) ? total : null,
                      contains
                    }
                  });
                }
                const newParams = { ...params };
                newParams[`${this.searchParameter}:not`] = this.fhirBackend.features
                  .hasNotModifierIssue
                  ? // Pass a single ":not" parameter, which is currently working
                    // correctly on the HAPI FHIR server.
                  Object.keys(processedCodes).join(',')
                  : // Pass each code as a separate ":not" parameter, which is
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
      })
    )
  }

  /**
   * Set up Autocompleter search options for DbGap variable API search.
   */
  setupAutocomplete_EV_DbgapVariableApi(): any {
    const acInstance = new Def.Autocompleter.Search(this.inputId, null, {
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
      showListOnFocusIfEmpty: true
    });
    return acInstance;
  }

  /**
   * Set up Autocompleter search options.
   */
  setupAutocompleteSearch_EV(): any {
    const acInstance = new Def.Autocompleter.Search(this.inputId, null, {
      suggestionMode: Def.Autocompleter.NO_COMPLETION_SUGGESTIONS,
      fhir: {
        search: (fieldVal, count) => {
          return {
            then: (resolve, reject) => {
              const url = `$fhir/${this.EVIDENCEVARIABLE}`;
              const params = {
                _elements: this.searchParameter
              };
              params[this.searchParameter] = fieldVal;
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
      showListOnFocusIfEmpty: true
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
      const displayItem = e.resource[this.searchParameter];
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
   * Extracts autocomplete items from resource bundle
   * @param bundle - resource bundle
   * @param filterText - text in autocomplete field
   * @param processedCodes - hash of processed codes,
   *   used to exclude repeated codes
   * @param selectedCodes - already selected codes
   */
  getAutocompleteItems(
    bundle: Bundle,
    filterText: string,
    processedCodes: { [key: string]: boolean },
    selectedCodes: Array<string>
  ): ValueSetExpansionContains[] {
    // Additional filter for options list.
    // Because `coding` can have values that don't match the text in the autocomplete field.
    // For example, ResearchStudy.keyword (https://dbgap-api.ncbi.nlm.nih.gov/fhir/x1)
    const reDisplayValue = filterText
      ? new RegExp(`\\b${escapeStringForRegExp(filterText)}`, 'i')
      : /.*/;
    const codingsGetter = this.getCodingsGetter();
    return (bundle.entry || []).reduce((acc, entry) => {
      const codings = codingsGetter(entry.resource);
      if (!codings.length) {
        return acc;
      }
      acc.push(
        ...codings.filter((coding) => {
          const matched =
            // Additional filter for options list.
            coding.display ? reDisplayValue.test(coding.display) : reDisplayValue.test(coding.code) &&
            !processedCodes[coding.code] &&
            selectedCodes.indexOf(coding.code) === -1;

          processedCodes[coding.code] = true;

          return matched;
        }).map(c => c.display ? c : {...c, display: this.code2display[c.code] || c.code })
      );
      return acc;
    }, []);
  }

  /**
   * Get 'q' params value for DbGap varaible API query.
   * e.g. study_id:phs002410*, study_id:(phs002410*%20OR%20phs002409*)
   * @private
   */
  private getDbgapEvResearchStudyParam(): string {
    const selectedStudyIds = (this.cart.getListItems('ResearchStudy') as Resource[])?.map(({id}) => id)
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
   * Returns the FHIR name for the resource field that matches the search parameter.
   */
  getFhirName(): string {
    if (this.searchParameter === 'code') {
      return (
        AutocompleteParameterValueComponent.codeTextFieldMapping[
          this.resourceType
        ] || this.searchParameter
      );
    }
    return this.columnName || this.searchParameter;
  }

  /**
   * Returns a function which extracts the Codings that matches the
   * search parameter from the resource object.
   */
  getCodingsGetter(): (resource: Resource) => Coding[] {
    let propertyName;
    if (this.searchParameter === 'code') {
      propertyName =
        AutocompleteParameterValueComponent.codeTextFieldMapping[
          this.resourceType
        ] || this.searchParameter;
    } else {
      propertyName = this.expression || this.searchParameter;
    }
    const compiledExpression = this.fhirBackend.getEvaluator(propertyName);

    return (resource) =>
      [].concat(
        ...compiledExpression(resource).map((value) => {
          if (Array.isArray(value)) {
            return [].concat(
              ...value.map((v) => (v.code ? [v] : v.coding || []))
            );
          } else if (typeof value === 'string') {
            // if we only have code, add a display value with the same value
            return [{ code: value, display: value }];
          }
          return value.code ? [value] : value.coding || [];
        })
      );
  }

  getAriaLabel(): string {
    return this.resourceType === this.EVIDENCEVARIABLE
      ? `select Evidence Variables by ${this.searchParameter}`
      : this.searchParameter === 'code'
      ? `${this.resourceType} codes from FHIR server`
      : 'Search parameter value';
  }
}
