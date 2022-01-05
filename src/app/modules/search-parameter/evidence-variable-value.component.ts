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
import { AutocompleteParameterValue } from '../../types/autocomplete-parameter-value';
import { HttpClient } from '@angular/common/http';
import ValueSetExpansionContains = fhir.ValueSetExpansionContains;
import Bundle = fhir.Bundle;
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { FhirBackendService } from '../../shared/fhir-backend/fhir-backend.service';

const EVIDENCEVARIABLE = 'EvidenceVariable';

/**
 * Component for search parameter value as autocomplete multi-select
 * for Evidence Variable search parameters
 */
@Component({
  selector: 'app-evidence-variable-value',
  templateUrl: './evidence-variable-value.component.html',
  styleUrls: ['./evidence-variable-value.component.less'],
  providers: [
    {
      provide: MatFormFieldControl,
      useExisting: EvidenceVariableValueComponent
    }
  ]
})
export class EvidenceVariableValueComponent
  extends BaseControlValueAccessor<AutocompleteParameterValue>
  implements
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
    const formControl = this.ngControl?.control as FormControl;
    return (
      this.input?.nativeElement.className.indexOf('invalid') >= 0 ||
      (formControl && this.errorStateMatcher.isErrorState(formControl, null))
    );
  }

  static idPrefix = 'autocomplete-test-value-';
  static idIndex = 0;
  static codeTextFieldMapping = {
    MedicationDispense: 'medicationCodeableConcept',
    MedicationRequest: 'medicationCodeableConcept'
  };

  inputId =
    EvidenceVariableValueComponent.idPrefix +
    ++EvidenceVariableValueComponent.idIndex;
  @Input() placeholder = '';
  @Input() searchParameter: string;

  currentData: AutocompleteParameterValue = {
    codes: [],
    items: []
  };
  ngControl: NgControl = null;
  // Autocompleter instance
  acInstance: any;
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

  constructor(
    @Optional() @Self() ngControl: NgControl,
    private elementRef: ElementRef,
    private errorStateMatcher: ErrorStateMatcher,
    private httpClient: HttpClient,
    private liveAnnoncer: LiveAnnouncer,
    private fhirBackend: FhirBackendService
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
   * Set up Autocompleter.
   * Also call this.onChange() of ControlValueAccessor interface on selection event,
   * so that form control value is updated and can be read from parent form.
   */
  setupAutocomplete(): void {
    this.acInstance =
      this.fhirBackend.serviceBaseUrl ===
      'https://dbgap-api.ncbi.nlm.nih.gov/fhir/x1'
        ? this.setupAutocompleteDbgapVariableApi()
        : this.setupAutocompleteSearch();

    // Fill autocomplete with data (if currentData was set in writeValue).
    if (this.currentData) {
      this.currentData.items.forEach((item, index) => {
        this.acInstance.storeSelectedItem(item, this.currentData.codes[index]);
        this.acInstance.addToSelectedArea(item);
      });
    }

    Def.Autocompleter.Event.observeListSelections(this.inputId, () => {
      const coding = this.acInstance.getSelectedCodes();
      const items = this.acInstance.getSelectedItems();
      this.currentData = {
        codes: coding,
        items
      };
      this.onChange(this.currentData);
    });
  }

  /**
   * Set up Autocompleter search options for DbGap variable API search.
   */
  setupAutocompleteDbgapVariableApi(): any {
    const acInstance = new Def.Autocompleter.Search(this.inputId, null, {
      suggestionMode: Def.Autocompleter.NO_COMPLETION_SUGGESTIONS,
      fhir: {
        search: (fieldVal, count) => {
          return {
            then: (resolve, reject) => {
              const url = 'http://lhc-lx-luanx2:5000/api/dbg_vars/v3/search';
              const params = {
                sf: `dbgv.${this.searchParameter}`,
                terms: fieldVal,
                maxList: count
              };
              // Array of result items for autocompleter
              const contains: ValueSetExpansionContains[] = [];
              // Already selected codes
              const selectedCodes = acInstance.getSelectedCodes();

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
                    throw error;
                  })
                )
                .subscribe((response) => {
                  contains.push(
                    ...this.getAutocompleteItems_dbgapVariableApi(
                      response,
                      selectedCodes
                    )
                  );
                  this.loading = false;
                  this.liveAnnoncer.announce('Finished loading list.');
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
  setupAutocompleteSearch(): any {
    const acInstance = new Def.Autocompleter.Search(this.inputId, null, {
      suggestionMode: Def.Autocompleter.NO_COMPLETION_SUGGESTIONS,
      fhir: {
        search: (fieldVal, count) => {
          return {
            then: (resolve, reject) => {
              const url = `$fhir/${EVIDENCEVARIABLE}`;
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
                      this.liveAnnoncer.announce('New items added to list.');
                      // Update list before calling server for next query.
                      resolve({
                        resourceType: 'ValueSet',
                        expansion: {
                          total: Number.isInteger(total) ? total : null,
                          contains
                        }
                      });
                      const newParams = { ...params };
                      newParams['_id:not'] = Object.keys(processedCodes).join(
                        ','
                      );
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
                      this.liveAnnoncer.announce('Finished loading list.');
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
                    throw error;
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
   * @param processedCodes - hash of processed IDs,
   *   used to exclude repeated items
   * @param selectedCodes - already selected codes
   */
  getAutocompleteItems(
    bundle: Bundle,
    processedCodes: { [key: string]: boolean },
    selectedCodes: Array<string>
  ): ValueSetExpansionContains[] {
    return (bundle.entry || [])
      .filter((e) => {
        const matched =
          !processedCodes[e.resource.id] &&
          selectedCodes.indexOf(e.resource.id) === -1;
        processedCodes[e.resource.id] = true;
        return matched;
      })
      .map((e) => {
        const result: ValueSetExpansionContains = {};
        result.code = e.resource.id;
        result.display = e.resource.id;
        return result;
      });
  }

  /**
   * Extracts autocomplete items from DbGap variable API response
   * @param response - response from DbGap variable API
   * @param selectedCodes - already selected codes
   */
  getAutocompleteItems_dbgapVariableApi(
    response: any,
    selectedCodes: Array<string>
  ): ValueSetExpansionContains[] {
    return (response[1] || [])
      .filter((e) => {
        const id = this.getEvIdFromDbgapVariableApi(e);
        const matched = id && selectedCodes.indexOf(id) === -1;
        return matched;
      })
      .map((e) => {
        const id = this.getEvIdFromDbgapVariableApi(e);
        const result: ValueSetExpansionContains = {};
        result.code = id;
        result.display = id;
        return result;
      });
  }

  /**
   * Returns EV id from a DbGap variable API response
   * e.g. phv00054122.v1.p1 => phv00054122
   * @private
   */
  private getEvIdFromDbgapVariableApi(value: string): string {
    return /^(.+)\.v\d+\.p\d+$/.test(value) ? RegExp.$1 : null;
  }

  /**
   * Part of the ControlValueAccessor interface
   */
  writeValue(value: AutocompleteParameterValue): void {
    this.currentData = value;
  }
}
