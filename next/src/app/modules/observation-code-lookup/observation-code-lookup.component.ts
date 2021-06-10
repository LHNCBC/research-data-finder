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
import { escapeStringForRegExp } from '@legacy/js/common/utils';
// see docs at http://lhncbc.github.io/autocomplete-lhc/docs.html
import Def from 'autocomplete-lhc';
import { FhirBackendService } from '../../shared/fhir-backend/fhir-backend.service';
import { SelectedLoincCodes } from '../../types/selected-loinc-codes';
import { MatFormFieldControl } from '@angular/material/form-field';
import { NgControl } from '@angular/forms';
import { EMPTY, Subject, Subscription } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { catchError, expand, takeWhile } from 'rxjs/operators';
import { getNextPageUrl } from '../../shared/utils';
import Bundle = fhir.Bundle;
import Observation = fhir.Observation;
import ValueSetExpansionContains = fhir.ValueSetExpansionContains;

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
  extends BaseControlValueAccessor<SelectedLoincCodes>
  implements MatFormFieldControl<SelectedLoincCodes>, AfterViewInit, OnDestroy {
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
  currentData: SelectedLoincCodes = {
    datatype: '',
    codes: [],
    items: []
  };

  /**
   * Implemented as part of MatFormFieldControl.
   */
  get value(): SelectedLoincCodes {
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
    return !this.currentData.datatype && !this.input?.nativeElement.value;
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
    return this.input?.nativeElement.className.indexOf('invalid') >= 0 || false;
  }

  // Mapping from code to datatype
  code2Type: { [key: string]: string } = {};

  /**
   * This properties currently unused but required by MatFormFieldControl:
   */
  readonly disabled: boolean = false;
  readonly id: string;
  readonly required = false;

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
    private httpClient: HttpClient
  ) {
    super();

    if (ngControl != null) {
      // Setting the value accessor directly (instead of using
      // the providers) to avoid running into a circular import.
      ngControl.valueAccessor = this;
    }
  }

  /**
   * Clean up the autocompleter instance
   */
  ngOnDestroy(): void {
    this.stateChanges.complete();
    this.subscription?.unsubscribe();
    if (this.acInstance) {
      this.acInstance.destroy();
    }
  }

  /**
   * Sets the select's value. Part of the ControlValueAccessor interface
   * required to integrate with Angular's core forms API.
   *
   * @param value New value to be written to the model.
   */
  writeValue(value: SelectedLoincCodes | null): void {
    this.currentData = value || {
      datatype: '',
      codes: [],
      items: []
    };
    if (this.acInstance) {
      throw new Error(
        'Failed to set value after initialization. Autocompleter only has method to add data (addToSelectedArea)'
      );
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
      testInputId,
      null,
      {
        suggestionMode: Def.Autocompleter.NO_COMPLETION_SUGGESTIONS,
        fhir: {
          search: (fieldVal, count) => {
            const isMatchToFieldVal = new RegExp(
              escapeStringForRegExp(fieldVal),
              'i'
            );
            return {
              then: (resolve, reject) => {
                const url = this.fhirBackend.features.lastnLookup
                  ? '$fhir/Observation/$lastn?max=1'
                  : '$fhir/Observation';
                const params = {
                  _elements: 'code,value,component',
                  'combo-code:text': fieldVal,
                  _count: '500'
                };
                // Hash of processed codes, used to exclude repeated codes
                const processedCodes = {};
                // Array of result items for autocompleter
                const contains: ValueSetExpansionContains[] = [];
                // Total amount of items
                let total = Infinity;
                // Already selected codes
                const selectedCodes = acInstance.getSelectedCodes();

                this.loading = true;
                this.subscription?.unsubscribe();

                this.subscription = this.httpClient
                  // Load first page of Observation resources
                  .get(url, {
                    params
                  })
                  .pipe(
                    // Modifying the Observable to load the following pages sequentially
                    expand((response: Bundle) => {
                      const nextPageUrl = getNextPageUrl(response);
                      if (nextPageUrl && contains.length < count) {
                        if (this.fhirBackend.features.lastnLookup) {
                          return this.httpClient.get(nextPageUrl);
                        } else {
                          return this.httpClient.get(url, {
                            params: {
                              ...params,
                              'code:not': Object.keys(processedCodes).join(',')
                            }
                          });
                        }
                      } else {
                        // Emit a complete notification
                        return EMPTY;
                      }
                    }),
                    // Process each page of Observation resources until we get the required number of values
                    takeWhile((response: Bundle) => {
                      contains.push(
                        ...this.getAutocompleteItems(
                          response,
                          processedCodes,
                          selectedCodes,
                          isMatchToFieldVal
                        )
                      );
                      const nextPageUrl = getNextPageUrl(response);
                      const stop = !nextPageUrl || contains.length >= count;
                      if (stop) {
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
                        resolve({
                          resourceType: 'ValueSet',
                          expansion: {
                            total: Number.isInteger(total) ? total : Infinity,
                            contains
                          }
                        });
                        this.loading = false;
                      }
                      return !stop;
                    }),
                    catchError((error) => {
                      this.loading = false;
                      reject(error);
                      throw error;
                    })
                  )
                  .subscribe();
              }
            };
          }
        },
        useResultCache: false,
        maxSelect: '*',
        matchListValue: true
      }
    ));

    // Fill component with data (see writeValue)
    this.currentData.items.forEach((item, index) => {
      this.acInstance.storeSelectedItem(item, this.currentData.codes[index]);
      this.acInstance.addToSelectedArea(item);
    });

    // Restore mapping from code to datatype from preselected data
    this.currentData.codes.forEach((code) => {
      if (!this.code2Type[code]) {
        this.code2Type[code] = this.currentData.datatype;
      }
    });

    this.listSelectionsObserver = (eventData) => {
      const codes = acInstance.getSelectedCodes();
      const items = acInstance.getSelectedItems();
      let datatype = '';
      if (codes.length > 0) {
        datatype = this.code2Type[codes[0]];
        if (!eventData.removed) {
          acInstance.domCache.set('elemVal', eventData.val_typed_in);
          acInstance.useSearchFn(
            eventData.val_typed_in,
            Def.Autocompleter.Base.MAX_ITEMS_BELOW_FIELD
          );
        }
      }
      this.currentData = {
        codes,
        datatype,
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
      const datatype = this.getValueDataType(observation);
      if (
        !this.currentData.datatype ||
        datatype === this.currentData.datatype
      ) {
        acc.push(
          ...observation.code.coding
            .filter((coding) => {
              const matched =
                !processedCodes[coding.code] &&
                isMatchToFieldVal.test(coding.display) &&
                selectedCodes.indexOf(coding.code) === -1;
              processedCodes[coding.code] = true;
              return matched;
            })
            .map((coding) => {
              this.code2Type[coding.code] = datatype;
              return {
                code: coding.code,
                display: coding.display
              };
            })
        );
      }
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
      document.getElementById(this.inputId).focus();
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
}
