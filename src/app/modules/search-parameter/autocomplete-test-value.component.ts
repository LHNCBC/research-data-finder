import {
  AfterViewInit,
  Component,
  ElementRef,
  HostBinding,
  HostListener,
  Input,
  OnChanges,
  Optional,
  Self,
  ViewChild
} from '@angular/core';
import { FormControl, NgControl } from '@angular/forms';
import { BaseControlValueAccessor } from '../base-control-value-accessor';
import Def from 'autocomplete-lhc';
import { MatFormFieldControl } from '@angular/material/form-field';
import { EMPTY, Subject, Subscription } from 'rxjs';
import { ErrorStateMatcher } from '@angular/material/core';
import { getNextPageUrl } from '../../shared/utils';
import { catchError, expand } from 'rxjs/operators';
import { AutocompleteTestValue } from '../../types/autocomplete-test-value';
import { HttpClient } from '@angular/common/http';
import ValueSetExpansionContains = fhir.ValueSetExpansionContains;
import Bundle = fhir.Bundle;

/**
 * data type used for this control
 */
export interface Lookup {
  code: string;
  display: string;
}

/**
 * Component for search parameter value as autocomplete multi-select
 */
@Component({
  selector: 'app-autocomplete-test-value',
  templateUrl: './autocomplete-test-value.component.html',
  styleUrls: ['./autocomplete-test-value.component.less'],
  providers: [
    {
      provide: MatFormFieldControl,
      useExisting: AutoCompleteTestValueComponent
    }
  ]
})
export class AutoCompleteTestValueComponent
  extends BaseControlValueAccessor<AutocompleteTestValue>
  implements
    OnChanges,
    AfterViewInit,
    MatFormFieldControl<AutocompleteTestValue> {
  static idPrefix = 'autocomplete-test-value-';
  static idIndex = 0;
  inputId =
    AutoCompleteTestValueComponent.idPrefix +
    ++AutoCompleteTestValueComponent.idIndex;
  @Input() options: Lookup[];
  @Input() placeholder = '';
  @Input() resourceType: string;
  @Input() searchParameter: string;

  currentData: AutocompleteTestValue = {
    coding: [],
    items: []
  };
  ngControl: NgControl = null;
  // Autocompleter instance
  acInstance: Def.Autocompleter.Seaech;
  // Subscription used to cancel the previous loading process
  subscription: Subscription;
  // Reference to the <input> element
  @ViewChild('input') input: ElementRef<HTMLInputElement>;

  /**
   * Whether the control is in a loading state.
   */
  @HostBinding('class.loading') loading = false;

  get value(): AutocompleteTestValue {
    return this.currentData;
  }

  /**
   * Whether the control is empty (Implemented as part of MatFormFieldControl)
   */
  get empty(): boolean {
    return !this.value.coding?.length;
  }

  /**
   * Whether the control is focused (Implemented as part of MatFormFieldControl)
   */
  focused = false;

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

  /**
   * Whether the control is in an error state (Implemented as part of MatFormFieldControl)
   */
  get errorState(): boolean {
    const formControl = this.ngControl?.control as FormControl;
    return (
      this.input?.nativeElement.className.indexOf('invalid') >= 0 ||
      (formControl && this.errorStateMatcher.isErrorState(formControl, null))
    );
  }

  /**
   * These properties currently unused but required by MatFormFieldControl:
   */
  readonly disabled: boolean = false;
  readonly id: string;
  readonly required = false;
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

  constructor(
    @Optional() @Self() ngControl: NgControl,
    private elementRef: ElementRef,
    private errorStateMatcher: ErrorStateMatcher,
    private httpClient: HttpClient
  ) {
    super();
    if (ngControl != null) {
      this.ngControl = ngControl;
      // Setting the value accessor directly (instead of using
      // the providers) to avoid running into a circular import.
      ngControl.valueAccessor = this;
    }
  }

  ngOnChanges(): void {
    if (this.acInstance) {
      this.setupAutocomplete();
    }
  }

  ngAfterViewInit(): void {
    this.setupAutocomplete();
  }

  /**
   * Set up Autocompleter search options.
   * Also call this.onChange() of ControlValueAccessor interface on selection event,
   * so that form control value is updated and can be read from parent form.
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
            return {
              then: (resolve, reject) => {
                // Return local options from definitions if input is empty.
                if (!fieldVal) {
                  resolve({
                    resourceType: 'ValueSet',
                    expansion: {
                      total: this.options.length,
                      contains: this.options
                    }
                  });
                  return;
                }

                const url = `$fhir/${this.resourceType}`;
                const params = {
                  _elements: this.searchParameter
                };
                params[`${this.searchParameter}`] = fieldVal;
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

                const obs = this.httpClient
                  .get(url, {
                    params
                  })
                  .pipe(
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
                        const newParams = { ...params };
                        newParams[`${this.searchParameter}:not`] = Object.keys(
                          processedCodes
                        ).join(',');
                        return this.httpClient.get(url, {
                          params: newParams
                        });
                      } else {
                        if (response.total) {
                          total = response.total;
                        } else if (!nextPageUrl) {
                          total = contains.length;
                        }
                        if (contains.length > count) {
                          contains.length = count;
                        }
                        // Emit a complete notification
                        return EMPTY;
                      }
                    }),
                    catchError((error) => {
                      this.loading = false;
                      reject(error);
                      throw error;
                    })
                  );

                this.subscription = obs.subscribe(() => {
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
        matchListValue: true,
        showListOnFocusIfEmpty: true
      }
    ));

    // Fill autocomplete with data (if currentData was set in writeValue).
    if (this.currentData) {
      this.currentData.items.forEach((item, index) => {
        this.acInstance.storeSelectedItem(item, this.currentData.coding[index]);
        this.acInstance.addToSelectedArea(item);
      });
    }

    Def.Autocompleter.Event.observeListSelections(testInputId, () => {
      const coding = acInstance.getSelectedCodes();
      const items = acInstance.getSelectedItems();
      this.currentData = {
        coding,
        items
      };
      this.onChange(this.currentData);
    });
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
    console.log(bundle.entry);
    return (bundle.entry || []).reduce((acc, entry) => {
      acc.push(
        ...(
          entry.resource[this.searchParameter].coding ||
          entry.resource[this.searchParameter][0].coding
        ).filter((coding) => {
          const matched =
            !processedCodes[coding.code] &&
            selectedCodes.indexOf(coding.code) === -1;
          processedCodes[coding.code] = true;
          return matched;
        })
      );
      return acc;
    }, []);
  }

  /**
   * Part of the ControlValueAccessor interface
   */
  writeValue(value: AutocompleteTestValue): void {
    this.currentData = value;
  }
}
