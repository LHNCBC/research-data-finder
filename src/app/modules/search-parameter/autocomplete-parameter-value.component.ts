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
import { LiveAnnouncer } from '@angular/cdk/a11y';
import { FhirBackendService } from '../../shared/fhir-backend/fhir-backend.service';
import ValueSetExpansionContains = fhir.ValueSetExpansionContains;
import Bundle = fhir.Bundle;
import { ResearchStudyService } from '../../shared/research-study/research-study.service';

/**
 * data type used for this control
 */
export interface Lookup {
  code: string;
  display: string;
}

const EVIDENCEVARIABLE = 'EvidenceVariable';

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

  constructor(
    @Optional() @Self() ngControl: NgControl,
    private elementRef: ElementRef,
    private errorStateMatcher: ErrorStateMatcher,
    private httpClient: HttpClient,
    private liveAnnoncer: LiveAnnouncer,
    private fhirBackend: FhirBackendService,
    private researchStudy: ResearchStudyService
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
  @Input() placeholder = '';
  @Input() resourceType: string;
  @Input() searchParameter: string;
  @Input() usePrefetch = false;

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
      this.resourceType === EVIDENCEVARIABLE
        ? this.getAutocomplete_EV()
        : this.getAutocomplete();

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
    return this.fhirBackend.serviceBaseUrl ===
      'https://dbgap-api.ncbi.nlm.nih.gov/fhir/x1'
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
      { maxSelect: '*', codes: this.options.map((o) => o.code) }
    );
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
              const url = `$fhir/${this.resourceType}`;
              const params = {
                _elements: this.getCodeTextField()
              };
              params[`${this.searchParameter}:text`] =
                fieldVal ||
                'a,b,c,d,e,f,g,h,i,j,k,l,m,n,o,p,q,r,s,t,u,v,w,x,y,z';
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
                      newParams[`${this.searchParameter}:not`] = Object.keys(
                        processedCodes
                      ).join(',');
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
      showListOnFocusIfEmpty: this.searchParameter !== 'code'
    });
    return acInstance;
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
              const url = 'http://lhc-lx-luanx2:5000/api/dbg_vars/v3/search';
              const params = {
                sf: `dbgv.${this.searchParameter}`,
                df: `dbgv.${this.searchParameter}`,
                terms: fieldVal,
                maxList: count,
                q: this.getDbgapEvResearchStudyParam()
              };
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
                    throw error;
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
  setupAutocompleteSearch_EV(): any {
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
      if (!entry.resource[this.getCodeTextField()]) {
        return acc;
      }
      acc.push(
        ...(
          entry.resource[this.getCodeTextField()].coding ||
          entry.resource[this.getCodeTextField()][0].coding
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
   * Get 'q' params value for DbGap varaible API query.
   * e.g. study_id:phs002410*, study_id:(phs002410*%20OR%20phs002409*)
   * @private
   */
  private getDbgapEvResearchStudyParam(): string {
    if (!this.researchStudy.myStudyIds.length) {
      return '';
    }
    if (this.researchStudy.myStudyIds.length === 1) {
      return `study_id:${this.researchStudy.myStudyIds[0]}*`;
    }
    return `study_id:(${this.researchStudy.myStudyIds
      .map((id) => id + '*')
      .join(' OR ')})`;
  }

  /**
   * Part of the ControlValueAccessor interface
   */
  writeValue(value: AutocompleteParameterValue): void {
    this.currentData = value;
  }

  /**
   * Gets the main code field in case of "code text".
   * Otherwise return the search parameter for normal parameters.
   */
  getCodeTextField(): string {
    if (this.searchParameter === 'code') {
      return (
        AutocompleteParameterValueComponent.codeTextFieldMapping[
          this.resourceType
        ] || this.searchParameter
      );
    }
    return this.searchParameter;
  }

  getAriaLabel(): string {
    return this.resourceType === EVIDENCEVARIABLE
      ? `select Evidence Variables by ${this.searchParameter}`
      : this.searchParameter === 'code'
      ? `${this.resourceType} codes from FHIR server`
      : 'Search parameter value';
  }
}
