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
// see docs at http://lhncbc.github.io/autocomplete-lhc/docs.html
import Def from 'autocomplete-lhc';
import { MatFormFieldControl } from '@angular/material/form-field';
import { BaseControlValueAccessor } from '../../base-control-value-accessor';
import { NgControl } from '@angular/forms';
import { Subject, Subscription } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { escapeStringForRegExp } from '../../../shared/utils';
import { catchError } from 'rxjs/operators';

import ValueSet = fhir.ValueSet;

// Mapping from LOINC code to units
const code2units: { [code: string]: string[] } = {};

/**
 * Component to select the unit of the Observation value.
 */
@Component({
  selector: 'app-observation-test-value-units',
  templateUrl: './observation-test-value-unit.component.html',
  styleUrls: ['./observation-test-value-unit.component.less'],
  providers: [
    {
      provide: MatFormFieldControl,
      useExisting: ObservationTestValueUnitComponent
    }
  ]
})
export class ObservationTestValueUnitComponent
  extends BaseControlValueAccessor<string>
  implements MatFormFieldControl<string>, AfterViewInit, OnDestroy {
  constructor(
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

  static idPrefix = 'unit-selector-';
  static idIndex = 0;
  inputId =
    ObservationTestValueUnitComponent.idPrefix +
    ++ObservationTestValueUnitComponent.idIndex;

  // Loinc codes used to load the list of units from CTSS
  @Input() loincCodes: string[] = [];

  // See https://material.angular.io/guide/creating-a-custom-form-field-control#ngcontrol
  ngControl: NgControl = null;

  // Reference to the <input> element
  @ViewChild('input') input: ElementRef<HTMLInputElement>;

  /**
   * Whether the control is in a loading state.
   */
  @HostBinding('class.loading') loading = false;

  /**
   * Implemented as part of MatFormFieldControl.
   */
  get value(): string {
    return this.currentData;
  }

  /**
   * Current value
   */
  currentData = '';

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
    return !this.input?.nativeElement.value;
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
  writeValue(value: string | null): void {
    this.currentData = value || '';
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

    this.acInstance = new Def.Autocompleter.Search(testInputId, null, {
      suggestionMode: Def.Autocompleter.NO_COMPLETION_SUGGESTIONS,
      fhir: {
        search: (fieldVal, count) => {
          const isMatchToFieldVal = new RegExp(
            escapeStringForRegExp(fieldVal),
            'i'
          );

          return {
            then: (resolve, reject) => {
              const unloadedCodes = this.loincCodes.filter(
                (c) => !code2units[c]
              );
              if (!unloadedCodes.length) {
                resolve(this.getAutocompleteValueSet(isMatchToFieldVal, count));
              } else {
                this.loading = true;
                this.httpClient
                  .get(
                    'https://clinicaltables.nlm.nih.gov/api/loinc_items/v3/search?df=&type=question&ef=units&maxList&terms=',
                    {
                      params: {
                        q: 'LOINC_NUM:' + unloadedCodes.join(' OR ')
                      }
                    }
                  )
                  .pipe(
                    catchError((error) => {
                      this.loading = false;
                      reject(error);
                      throw error;
                    })
                  )
                  .subscribe((res: Array<any>) => {
                    this.loading = false;
                    const [, codes, extraFields] = res;
                    codes.forEach((code, i) => {
                      code2units[code] =
                        extraFields?.units[i]?.map((item) => item.unit) || [];
                    });
                    resolve(
                      this.getAutocompleteValueSet(isMatchToFieldVal, count)
                    );
                  });
              }
            }
          };
        }
      },
      useResultCache: false,
      maxSelect: 1,
      // This is a trick to get around this condition in autocomplete-lhc:
      //   this.options.minChars || 1
      minChars: '0',
      matchListValue: false
    });

    this.listSelectionsObserver = (eventData) => {
      this.currentData = eventData.final_val;
      this.onChange(this.value);
    };
    Def.Autocompleter.Event.observeListSelections(
      testInputId,
      this.listSelectionsObserver
    );
  }

  /**
   * Returns autocomplete value set
   */
  getAutocompleteValueSet(isMatchToFieldVal: RegExp, count: number): ValueSet {
    const units = this.loincCodes.reduce<string[]>(
      (arr, c) => arr.concat(code2units[c]),
      []
    );
    const uniqueFilteredUnits = [...new Set(units)]
      .filter((c) => isMatchToFieldVal.test(c))
      .sort();
    if (uniqueFilteredUnits.length > count) {
      uniqueFilteredUnits.length = count;
    }

    return {
      status: undefined,
      resourceType: 'ValueSet',
      expansion: {
        identifier: null,
        timestamp: '',
        total: uniqueFilteredUnits.length,
        contains: uniqueFilteredUnits.map((unit) => ({
          code: unit,
          display: unit
        }))
      }
    };
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
  setDescribedByIds(ids: string[]): void {}
}
