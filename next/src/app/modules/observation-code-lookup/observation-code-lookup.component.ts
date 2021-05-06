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
import { Subject } from 'rxjs';
import { HTTP_ABORT } from '@legacy/js/common/fhir-batch-query';

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
    private elementRef: ElementRef
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
    // Mapping from code to datatype
    const code2Type = {};
    // Callback to cancel the previous loading process
    let cancelPreviousProcess = () => {};

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
                // Hash of processed codes, used to exclude repeated codes
                const processedCodes = {};

                this.loading = true;
                cancelPreviousProcess();

                // TODO: temporary use of fhirBackend directly should be replaced with calls to HttpClient
                const process = this.fhirBackend.fhirClient.resourcesMapFilter(
                  this.fhirBackend.features.lastnLookup
                    ? `Observation/$lastn?max=1&_elements=code,value,component&code:text=${encodeURIComponent(
                        fieldVal
                      )}`
                    : `Observation?_elements=code,value,component&code:text=${encodeURIComponent(
                        fieldVal
                      )}`,
                  count,
                  (observation) => {
                    const datatype = this.getValueDataType(observation);
                    if (
                      !this.currentData.datatype ||
                      datatype === this.currentData.datatype
                    ) {
                      return observation.code.coding
                        .filter((coding) => {
                          const matched =
                            !processedCodes[coding.display] &&
                            isMatchToFieldVal.test(coding.display) &&
                            acInstance
                              .getSelectedCodes()
                              .indexOf(coding.code) === -1;
                          processedCodes[coding.display] = true;
                          return matched;
                        })
                        .map((coding) => {
                          code2Type[coding.code] = datatype;
                          return {
                            code: coding.code,
                            display: coding.display
                          };
                        });
                    } else {
                      return false;
                    }
                  },
                  500
                );
                cancelPreviousProcess = process.cancel;
                process.promise.then(
                  ({ entry, total }) => {
                    this.loading = false;
                    resolve({
                      resourceType: 'ValueSet',
                      expansion: {
                        total: Number.isInteger(total) ? total : Infinity,
                        contains: entry
                      }
                    });
                  },
                  ({ status, error }) => {
                    if (status !== HTTP_ABORT) {
                      this.loading = false;
                    }
                    reject(error);
                  }
                );
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
      if (!code2Type[code]) {
        code2Type[code] = this.currentData.datatype;
      }
    });

    this.listSelectionsObserver = (eventData) => {
      const codes = acInstance.getSelectedCodes();
      const items = acInstance.getSelectedItems();
      let datatype = '';
      if (codes.length > 0) {
        datatype = code2Type[codes[0]];
        acInstance.domCache.set('elemVal', eventData.val_typed_in);
        acInstance.useSearchFn(
          eventData.val_typed_in,
          Def.Autocompleter.Base.MAX_ITEMS_BELOW_FIELD
        );
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
