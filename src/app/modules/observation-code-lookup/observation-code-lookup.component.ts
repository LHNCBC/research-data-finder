import {
  AfterViewInit,
  Component,
  ElementRef,
  HostBinding,
  HostListener,
  Input,
  OnDestroy,
  Optional,
  Self,
  ViewChild
} from '@angular/core';
import { BaseControlValueAccessor } from '../base-control-value-accessor';
// see docs at http://lhncbc.github.io/autocomplete-lhc/docs.html
import Def from 'autocomplete-lhc';
import { FhirBackendService } from '../../shared/fhir-backend/fhir-backend.service';
import { SelectedObservationCodes } from '../../types/selected-observation-codes';
import { MatLegacyFormFieldControl as MatFormFieldControl } from '@angular/material/legacy-form-field';
import { AbstractControl, UntypedFormControl, NgControl } from '@angular/forms';
import { EMPTY, forkJoin, of, Subject, Subscription } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { catchError, expand, tap } from 'rxjs/operators';
import {
  modifyStringForSynonyms,
  generateSynonymLookup,
  escapeStringForRegExp
} from '../../shared/utils';
import Bundle = fhir.Bundle;
import Observation = fhir.Observation;
import ValueSetExpansionContains = fhir.ValueSetExpansionContains;
import { ErrorStateMatcher } from '@angular/material/core';
import WORDSYNONYMS from '../../../../word-synonyms.json';
import { CohortService } from '../../shared/cohort/cohort.service';
import { CartService } from '../../shared/cart/cart.service';
import { SelectRecordsService } from '../../shared/select-records/select-records.service';

// This value should be used as the "datatype" field value for the form control
// value if we don't have a "variable value" criterion (in the "Pull data for
// the cohort" step) and we should not restrict the observation codes by datatype.
const ANY_DATATYPE = 'any';

/**
 * Component for selecting LOINC variables.
 */
@Component({
  selector: 'app-observation-code-lookup',
  templateUrl: './observation-code-lookup.component.html',
  styleUrls: ['./observation-code-lookup.component.less'],
  providers: [
    {
      provide: MatFormFieldControl,
      useExisting: ObservationCodeLookupComponent
    }
  ]
})
export class ObservationCodeLookupComponent
  extends BaseControlValueAccessor<SelectedObservationCodes>
  implements
    MatFormFieldControl<SelectedObservationCodes>,
    AfterViewInit,
    OnDestroy {
  static readonly wordSynonymsLookup = generateSynonymLookup(WORDSYNONYMS);
  static reValueKey = /^value(.*)/;

  static idPrefix = 'code-selector-';
  static idIndex = 0;
  inputId =
    ObservationCodeLookupComponent.idPrefix +
    ++ObservationCodeLookupComponent.idIndex;

  // See https://material.angular.io/guide/creating-a-custom-form-field-control#ngcontrol
  ngControl: NgControl = null;

  // Reference to the <input> element
  @ViewChild('input') input: ElementRef<HTMLInputElement>;

  /**
   * Whether the control is in a loading state.
   */
  @HostBinding('class.loading') loading = false;

  /**
   * Describes the currently selected data:
   * datatype - type of data for the selected Observation codes
   * codes - Observation codes
   */
  currentData: SelectedObservationCodes = {
    datatype: '',
    coding: [],
    items: []
  };

  /**
   * Implemented as part of MatFormFieldControl.
   */
  get value(): SelectedObservationCodes {
    return this.currentData;
  }

  // Autocompleter instance
  acInstance: Def.Autocompleter.Search;
  // Callback to handle changes
  listSelectionsObserver: (eventData: any) => void;
  // Subscription used to cancel the previous loading process
  subscriptionForLoading: Subscription;
  // Timeout for delaying search on user keystroke
  keystrokeTimeoutId: any;
  // Subscription to a change in cohort criteria
  subscriptionForCriteria: Subscription;

  /**
   * Whether the control is empty (Implemented as part of MatFormFieldControl)
   */
  get empty(): boolean {
    return !this.currentData.items.length && !this.input?.nativeElement.value;
  }

  /**
   * Whether the control is focused (Implemented as part of MatFormFieldControl)
   */
  focused = false;

  /**
   * The placeholder for this control.
   */
  @Input() placeholder = '';

  /**
   * Whether the component is used in the pull data step.
   */
  @Input() isPullData = false;

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
   * This properties currently unused but required by MatFormFieldControl:
   */
  readonly disabled: boolean = false;
  readonly id: string;

  /**
   * Whether the MatFormField label should try to float.
   */
  get shouldLabelFloat(): boolean {
    return this.focused || !this.empty;
  }

  /**
   * Stream that emits whenever the state of the control changes such that
   * the parent `MatFormField` needs to run change detection.
   */
  readonly stateChanges = new Subject<void>();

  constructor(
    private fhirBackend: FhirBackendService,
    @Optional() @Self() ngControl: NgControl,
    private elementRef: ElementRef,
    private httpClient: HttpClient,
    public cohort: CohortService,
    private cart: CartService,
    private selectRecords: SelectRecordsService,
    private errorStateMatcher: ErrorStateMatcher
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
   * Performs a cleanup when a component instance is destroyed.
   */
  ngOnDestroy(): void {
    this.stateChanges.complete();
    this.subscriptionForLoading?.unsubscribe();
    this.subscriptionForCriteria?.unsubscribe();
    this.destroyAutocomplete();
  }

  /**
   * Sets the select's value. Part of the ControlValueAccessor interface
   * required to integrate with Angular's core forms API.
   *
   * @param value New value to be written to the model.
   */
  writeValue(value: SelectedObservationCodes | null): void {
    this.currentData = value || {
      datatype: '',
      coding: [],
      items: []
    };
    if (this.acInstance) {
      this.updateAutocomplete();
    }
  }

  /**
   * Initialize the autocomplete-lhc
   * Cannot be done in ngOnInit because the DOM elements that autocomplete-lhc depends on are
   * not ready yet on ngOnInit
   */
  ngAfterViewInit(): void {
    this.setupAutocomplete();
    this.subscriptionForCriteria = this.cohort.criteria$.subscribe(() => {
      this.destroyAutocomplete();
      this.setupAutocomplete();
    });
  }

  /**
   * Set up the autocompleter.
   */
  setupAutocomplete(): void {
    if (
      this.isPullData &&
      this.fhirBackend.isDbgap(this.fhirBackend.serviceBaseUrl) &&
      this.cart.getListItems('ResearchStudy')?.length
    ) {
      this.setupAutocompleteInputToUseCTSS();
    } else {
      this.setupAutocompleteInputToUseObservations();
    }
    this.updateAutocomplete();

    const acInstance = this.acInstance;
    this.listSelectionsObserver = (eventData) => {
      const data = acInstance.getSelectedCodes();
      const items = acInstance.getSelectedItems();
      let datatype = '';
      if (data.length > 0) {
        datatype = data[0].datatype;
        if (!eventData.removed) {
          acInstance.domCache.set('elemVal', eventData.val_typed_in);
          acInstance.useSearchFn(
            eventData.val_typed_in,
            Def.Autocompleter.Base.MAX_ITEMS_BELOW_FIELD
          );
        }
      }
      this.currentData = {
        coding: data.map(i => ({
          code: i.code,
          system: i.system
        })),
        // If there is no restriction by datatype, then do not reset the datatype
        datatype:
          this.currentData.datatype === ANY_DATATYPE ? ANY_DATATYPE : datatype,
        defaultUnit: data[0]?.unitCode,
        defaultUnitSystem: data[0]?.unitSystem,
        items
      };
      this.onChange(this.currentData);
    };
    Def.Autocompleter.Event.observeListSelections(
      this.inputId,
      this.listSelectionsObserver
    );
  }

  /**
   * Set up the autocompleter to extract data from observations.
   */
  setupAutocompleteInputToUseObservations(): void {
    const acInstance = (this.acInstance = new Def.Autocompleter.Search(
      // We can't use the input element's id here, because it might not be
      // in DOM if the component is in an inactive tab.
      this.input.nativeElement,
      null,
      {
        suggestionMode: Def.Autocompleter.NO_COMPLETION_SUGGESTIONS,
        fhir: {
          search: (fieldVal, count) => {
              const fieldValWithSynonyms = modifyStringForSynonyms(
                ObservationCodeLookupComponent.wordSynonymsLookup,
                fieldVal
              );
              // Construct RegExp /base|basic/i from comma-separated synonym string
              // 'base,basic', for example.
              const isMatchToFieldVal = new RegExp(
                escapeStringForRegExp(fieldValWithSynonyms).replace(/\\,/g, '|'),
                'i'
              );
              return {
                then: (resolve, reject) => {
                  clearTimeout(this.keystrokeTimeoutId);
                  this.keystrokeTimeoutId = setTimeout(() => {
                    const url = this.fhirBackend.features.lastnLookup
                      ? '$fhir/Observation/$lastn?max=1'
                      : '$fhir/Observation';
                    const _elements = 'subject,code,value,component';
                    const subject = this.isPullData
                      ? {
                        // "subject:Patient" doesn't work for $lastn and due to
                        // a bug it doesn't work on baseR5
                        subject: this.cohort.currentState.patients
                          .map((patient) => 'Patient/' + patient.id)
                          .join(',')
                      }
                      : {};
                    const params = {
                      _elements,
                      ...subject,
                      'code:text': fieldValWithSynonyms,
                      _count: '500'
                    };
                    const paramsCode = {
                      _elements,
                      ...subject,
                      code: fieldVal,
                      _count: '1'
                    };
                    // Hash of processed codes, used to exclude repeated codes
                    const processedCodes = {};
                    // Array of result items for autocompleter
                    const contains: ValueSetExpansionContains[] = [];
                    // Total amount of items
                    let total = null;
                    // Already selected codes
                    const selectedCodes = acInstance.getSelectedCodes();

                    this.loading = true;
                    this.subscriptionForLoading?.unsubscribe();

                    const obsCode = this.httpClient
                      .get(url, {
                        params: paramsCode
                      })
                      .pipe(
                        tap((response: Bundle) => {
                          contains.unshift(
                            ...this.getAutocompleteItems(
                              response,
                              processedCodes,
                              selectedCodes,
                              isMatchToFieldVal
                            )
                          );
                          // Update list immediately.
                          resolve({
                            resourceType: 'ValueSet',
                            expansion: {
                              total: Number.isInteger(response.total)
                                ? response.total
                                : null,
                              contains
                            }
                          });
                        }),
                        catchError((error) => {
                          this.loading = false;
                          reject(error);
                          return of(contains);
                        })
                      );

                    const obs = this.httpClient
                      // Load first page of Observation resources
                      .get(url, {
                        params
                      })
                      .pipe(
                        // Modifying the Observable to load the following pages sequentially
                        expand((response: Bundle) => {
                          const newItems = this.getAutocompleteItems(
                            response,
                            processedCodes,
                            selectedCodes,
                            isMatchToFieldVal
                          );
                          contains.push(...newItems);
                          const nextPageUrl = this.fhirBackend.getNextPageUrl(response);
                          if (
                            nextPageUrl &&
                            contains.length < count &&
                            // Checking "newItems.length" eliminates an infinite loop
                            // in case the server misinterprets the ":not" modifier
                            // for the "code" search parameter.
                            newItems.length
                          ) {
                            // Update list immediately
                            resolve({
                              resourceType: 'ValueSet',
                              expansion: {
                                total: Number.isInteger(response.total)
                                  ? response.total
                                  : null,
                                contains
                              }
                            });
                            if (this.fhirBackend.features.lastnLookup) {
                              return this.httpClient.get(nextPageUrl);
                            } else {
                              return this.httpClient.get(url, {
                                params: {
                                  ...params,
                                  'code:not': this.fhirBackend.features
                                    .hasNotModifierIssue
                                    ? // Pass a single "code:not" parameter, which is currently working
                                      // correctly on the HAPI FHIR server.
                                    Object.keys(processedCodes).join(',')
                                    : // Pass each code as a separate "code:not" parameter, which is
                                      // currently causing performance issues on the HAPI FHIR server.
                                    Object.keys(processedCodes)
                                }
                              });
                            }
                          } else {
                            if (
                              this.fhirBackend.features.lastnLookup &&
                              response.total
                            ) {
                              total = response.total;
                            } else if (!nextPageUrl) {
                              total = contains.length;
                            }
                            if (contains.length > count) {
                              contains.length = count;
                            }
                            this.appendCodeSystemToDuplicateDisplay(contains);
                            // Emit a complete notification
                            return EMPTY;
                          }
                        }),
                        catchError((error) => {
                          this.loading = false;
                          reject(error);
                          // An error has occurred in one of the subsequent "next-page" queries for codes.
                          // Even though it now fails, we show a list for items we have retrieved so far.
                          // So, below method is called in case there are different items with the same display.
                          this.appendCodeSystemToDuplicateDisplay(contains);
                          return of(contains);
                        })
                      );

                    // Resolve autocomplete dropdown after both code and text searches are done.
                    this.subscriptionForLoading = forkJoin([obs, obsCode])
                      .subscribe(() => {
                        resolve({
                          resourceType: 'ValueSet',
                          expansion: {
                            total: Number.isInteger(total) ? total : null,
                            contains
                          }
                        });
                        this.loading = false;
                      });
                  }, 200);
                }
              };
          }
        },
        useResultCache: false,
        maxSelect: '*',
        matchListValue: true,
        showLoadingIndicator: false
      }
    ));
  }

  /**
   * Set up the autocompleter to use CTSS for Observation code lookup.
   */
  setupAutocompleteInputToUseCTSS(): void {
    this.acInstance = new Def.Autocompleter.Search(
      // We can't use the input element's id here, because it might not be
      // in DOM if the component is in an inactive tab.
      this.input.nativeElement,
      null,
      {
        suggestionMode: Def.Autocompleter.NO_COMPLETION_SUGGESTIONS,
        fhir: true,
        search: (fieldVal, count) => {
          const studiesInCart = this.cart.getListItems('ResearchStudy');
          const studyIds = []
            .concat(
              ...(studiesInCart?.length
                ? studiesInCart
                : this.selectRecords.currentState['ResearchStudy']
                .resources || [])
            )
            .map((r) => r.id + '*');
          const query = fieldVal
            ? [`(display_name:(${fieldVal}*) OR synonyms:(${fieldVal}*))`]
            : [];
          if (studyIds.length) {
            query.push('study_id:(' + studyIds.join(' OR ') + ')');
          }

          let offset = 0;
          // &authenticity_token=&terms=heigh
          return {
            then: (resolve, reject) => {
              clearTimeout(this.keystrokeTimeoutId);
              this.keystrokeTimeoutId = setTimeout(() => {
              const url = new URL(
                'https://clinicaltables.nlm.nih.gov/fhir/R4/ValueSet/dbg-vars'
              );
              Object.entries({
                rec_type: 'dbgv',
                offset,
                count,
                sf: 'display_name',
                df: 'display_name',
                q: query.join(' AND ')
              }).forEach(([name, value]) => {
                url.searchParams.set(name, value);
              });
              this.loading = true;
              this.subscriptionForLoading?.unsubscribe();

              this.subscriptionForLoading = this.httpClient
                .post(
                  'https://clinicaltables.nlm.nih.gov/fhir/R4/ValueSet/$expand?_format=json',
                  'url=' + encodeURIComponent(url.toString()),
                  {
                    headers: {
                      'Content-Type': 'application/x-www-form-urlencoded'
                    }
                  }
                )
                .subscribe(
                  (data: any) => {
                    data.expansion.contains.forEach(item => {
                      // Autocompleter's function "storeSelectedItem" has only
                      // two parameters: "itemText" and "code"
                      // That is why we store "code" and "system" in the "code"
                      // field, which doesn't match the ValueSet spec.
                      item.code = {code: item.code};
                      // If CTSS returns fake system
                      // "http://clinicaltables.nlm.nih.gov/fhir/CodeSystem/dbg-vars"
                      // in the "system" field, we skip it.
                      if (!/clinicaltables/.test(item.system)) {
                        item.code.system = item.system;
                      }
                      // Remove the unused "system" field that is now stored in the "code" field.
                      delete item.system;
                    })
                    this.appendCodeSystemToDuplicateDisplay(data.expansion.contains);
                    resolve(data);
                    this.loading = false;
                  },
                  (error) => {
                    this.loading = false;
                    reject(error);
                  }
                );
              }, 200);
            }
          };
        },
        useResultCache: false,
        maxSelect: '*',
        matchListValue: true,
        showListOnFocusIfEmpty: true,
        showLoadingIndicator: false
      }
    );
  }

  /**
   * Fill component with this.currentData
   */
  private updateAutocomplete(): void {
    this.acInstance.clearStoredSelection();
    this.currentData.items.forEach((item, index) => {
      this.acInstance.storeSelectedItem(item, this.currentData.coding[index]);
      this.acInstance.addToSelectedArea(item);
    });
  }

  /**
   * Destroy the autocompleter instance
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
   * Extracts autocomplete items from resource bundle
   * @param bundle - resource bundle
   * @param processedCodes - hash of processed codes,
   *   used to exclude repeated codes
   * @param selectedCodes - already selected codes
   * @param isMatchToFieldVal - RegExp to check if
   *   a string matches the value of the input field
   */
  getAutocompleteItems(
    bundle: Bundle,
    processedCodes: { [key: string]: boolean },
    selectedCodes: Array<string>,
    isMatchToFieldVal: RegExp
  ): ValueSetExpansionContains[] {
    return (bundle.entry || []).reduce((acc, entry) => {
      const observation = entry.resource as Observation;
      const {datatype, unitCode, unitSystem} = this.getValueDataTypeAndUnit(observation);
      acc.push(
        ...(observation.code.coding
          ?.filter((coding) => {
            let matched = false;
            if (coding.code && !processedCodes[coding.code]) {
              if (
                (!this.currentData.datatype ||
                  this.currentData.datatype === ANY_DATATYPE ||
                  // TODO: maybe we have to compare units here too:
                  //    unitCode === this.currentData.defaultUnit
                  //    unitSystem === this.currentData.defaultUnitSystem
                  //    (!) also we need to check commensurable units
                  datatype === this.currentData.datatype) &&
                selectedCodes.indexOf(coding.code) === -1 &&
                (isMatchToFieldVal.test(coding.code) ||
                  isMatchToFieldVal.test(coding.display))
              ) {
                processedCodes[coding.code] = true;
                matched = true;
              }
            }
            return matched;
          })
          .map((coding) => {
            return {
              // Autocompleter's function "storeSelectedItem" has only two
              // parameters: "itemText" and "code"
              // That is why we store "code" and "system" in the "code" field,
              // which doesn't match the ValueSet spec.
              code: { code: coding.code, system: coding.system, datatype, unitCode, unitSystem },
              display: coding.display || coding.code
            };
          }) || [])
      );
      return acc;
    }, []);
  }

  /**
   * Returns the data type (the [x] part of the property name value[x]) of the
   * value and in addition, for a data type equal to Quantity, returns the unit
   * code and system of units.
   * @param observation - Observation resource data
   */
  getValueDataTypeAndUnit(observation: any):  {
    datatype: string, unitCode: string, unitSystem: string
  } {
    let datatype = '';
    let unitCode: string;
    let unitSystem: string;
    [observation, ...(observation.component || [])].some((obj) => {
      return Object.keys(obj).some((key) => {
        const valueFound = ObservationCodeLookupComponent.reValueKey.test(key);
        if (valueFound) {
          datatype = RegExp.$1;
          if (datatype === 'Quantity') {
            unitCode = obj[key].code;
            unitSystem = obj[key].system;
          }
        }
        return valueFound;
      });
    });

    return {datatype, unitCode, unitSystem};
  }

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
    }
  }

  /**
   * Handles a click on the control's container to maintain the focused state.
   */
  onContainerClick(event: MouseEvent): void {
    if (!this.focused) {
      this.input.nativeElement.focus();
    }
  }

  /**
   * Implemented as part of MatFormFieldControl (required but not used).
   */
  setDescribedByIds(ids: string[]): void {
    if (ids.length) {
      this.elementRef.nativeElement.setAttribute(
        'aria-describedby',
        ids.join(' ')
      );
    } else {
      this.elementRef.nativeElement.removeAttribute('aria-describedby');
    }
  }

  /**
   * For autocomplete items with the same display and different code + code system
   * combination, append code + code system to the display so distinct items are
   * shown to user.
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
        item.display =
          `${item.display} | ${item.code.code}` +
          (item.code.system ? ` | ${item.code.system}` : '');
      }
    });
  }
}
