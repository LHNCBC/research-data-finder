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
import { MatFormFieldControl } from '@angular/material/form-field';
import { AbstractControl, UntypedFormControl, NgControl } from '@angular/forms';
import { EMPTY, forkJoin, of, Subject, Subscription } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { catchError, expand, tap } from 'rxjs/operators';
import {
  getNextPageUrl,
  modifyStringForSynonyms,
  generateSynonymLookup
} from '../../shared/utils';
import Bundle = fhir.Bundle;
import Observation = fhir.Observation;
import ValueSetExpansionContains = fhir.ValueSetExpansionContains;
import { ErrorStateMatcher } from '@angular/material/core';
import WORDSYNONYMS from '../../../../word-synonyms.json';

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
  subscription: Subscription;

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

  // Mapping from code to datatype
  code2Type: { [key: string]: string } = {};

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
    this.subscription?.unsubscribe();
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
  }

  /**
   * Set up the autocompleter
   */
  setupAutocomplete(): void {
    const testInputId = this.inputId;

    const acInstance = (this.acInstance = new Def.Autocompleter.Search(
      // We can't use the input element's id here, because it might not be
      // in DOM if the component is in an inactive tab.
      this.input.nativeElement,
      null,
      {
        suggestionMode: Def.Autocompleter.NO_COMPLETION_SUGGESTIONS,
        fhir: {
          search: (fieldVal, count) => {
            return {
              then: (resolve, reject) => {
                const url = this.fhirBackend.features.lastnLookup
                  ? '$fhir/Observation/$lastn?max=1'
                  : '$fhir/Observation';
                const params = {
                  _elements: 'code,value,component',
                  'code:text': modifyStringForSynonyms(
                    ObservationCodeLookupComponent.wordSynonymsLookup,
                    fieldVal
                  ),
                  _count: '500'
                };
                const paramsCode = {
                  _elements: 'code,value,component',
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
                this.subscription?.unsubscribe();

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
                          selectedCodes
                        )
                      );
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
                      contains.push(
                        ...this.getAutocompleteItems(
                          response,
                          processedCodes,
                          selectedCodes
                        )
                      );
                      const nextPageUrl = getNextPageUrl(response);
                      if (nextPageUrl && contains.length < count) {
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
                      return of(contains);
                    })
                  );

                // Resolve autocomplete dropdown after both code and text searches are done.
                this.subscription = forkJoin([obs, obsCode]).subscribe(() => {
                  resolve({
                    resourceType: 'ValueSet',
                    expansion: {
                      total: Number.isInteger(total) ? total : null,
                      contains
                    }
                  });
                  this.loading = false;
                });
              }
            };
          }
        },
        useResultCache: false,
        maxSelect: '*',
        matchListValue: true
      }
    ));

    this.updateAutocomplete();

    // Restore mapping from code to datatype from preselected data,
    // if restricted by datatype
    if (this.currentData.datatype !== ANY_DATATYPE) {
      this.currentData.coding.forEach((code) => {
        if (!this.code2Type[code.system + '|' + code.code]) {
          this.code2Type[
            code.system + '|' + code.code
          ] = this.currentData.datatype;
        }
      });
    }

    this.listSelectionsObserver = (eventData) => {
      const coding = acInstance.getSelectedCodes();
      const items = acInstance.getSelectedItems();
      let datatype = '';
      if (coding.length > 0) {
        datatype = this.code2Type[coding[0].system + '|' + coding[0].code];
        if (!eventData.removed) {
          acInstance.domCache.set('elemVal', eventData.val_typed_in);
          acInstance.useSearchFn(
            eventData.val_typed_in,
            Def.Autocompleter.Base.MAX_ITEMS_BELOW_FIELD
          );
        }
      }
      this.currentData = {
        coding,
        // If there is no restriction by datatype, then do not reset the datatype
        datatype:
          this.currentData.datatype === ANY_DATATYPE ? ANY_DATATYPE : datatype,
        items
      };
      this.onChange(this.currentData);
    };
    Def.Autocompleter.Event.observeListSelections(
      testInputId,
      this.listSelectionsObserver
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
   */
  getAutocompleteItems(
    bundle: Bundle,
    processedCodes: { [key: string]: boolean },
    selectedCodes: Array<string>
  ): ValueSetExpansionContains[] {
    return (bundle.entry || []).reduce((acc, entry) => {
      const observation = entry.resource as Observation;
      const datatype = this.getValueDataType(observation);
      acc.push(
        ...(observation.code.coding
          ?.filter((coding) => {
            let matched = false;
            if (coding.code && !processedCodes[coding.code]) {
              // Even though this observation's data type does not match selected codes, we want to
              // go through its codings and mark 'processedCodes' accordingly, so that these codes
              // can be excluded from next queries. Otherwise, we might get into a near-infinite loop
              // of queries returning the same code. This happened with searching "Total Cholesterol"
              // and selecting code "14647-2".
              processedCodes[coding.code] = true;
              if (
                (!this.currentData.datatype ||
                  this.currentData.datatype === ANY_DATATYPE ||
                  datatype === this.currentData.datatype) &&
                selectedCodes.indexOf(coding.code) === -1
              ) {
                matched = true;
              }
            }
            return matched;
          })
          .map((coding) => {
            this.code2Type[coding.system + '|' + coding.code] = datatype;
            return {
              code: { code: coding.code, system: coding.system },
              display: coding.display || coding.code
            };
          }) || [])
      );
      return acc;
    }, []);
  }

  /**
   * Returns the [x] part of the property name value[x]
   * @param observation - Observation resource data
   */
  getValueDataType(observation: any): string {
    let valueType = '';
    [observation, ...(observation.component || [])].some((obj) => {
      return Object.keys(obj).some((key) => {
        const valueFound = ObservationCodeLookupComponent.reValueKey.test(key);
        if (valueFound) {
          valueType = RegExp.$1;
        }
        return valueFound;
      });
    });

    return valueType;
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
        item.display = `${item.display} | ${item.code.code} | ${item.code.system}`;
      }
    });
  }
}
