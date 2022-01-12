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
  SimpleChanges,
  ViewChild
} from '@angular/core';
// see docs at http://lhncbc.github.io/autocomplete-lhc/docs.html
import Def from 'autocomplete-lhc';
import { MatFormFieldControl } from '@angular/material/form-field';
import { BaseControlValueAccessor } from '../../base-control-value-accessor';
import { NgControl } from '@angular/forms';
import { Subject } from 'rxjs';
import { HttpClient } from '@angular/common/http';
import { catchError } from 'rxjs/operators';

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
  implements MatFormFieldControl<string>, AfterViewInit, OnDestroy, OnChanges {
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

  // Mapping from LOINC code to units
  static code2units: { [code: string]: string[] } = {};

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
   * Number of active queries.
   */
  @HostBinding('class.loading') numberOfActiveQueries = 0;

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

  /**
   * Whether the control is empty (Implemented as part of MatFormFieldControl)
   */
  get empty(): boolean {
    return !this.currentData;
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
   * A callback method that is invoked immediately after the default change
   * detector has checked data-bound properties if at least one has changed,
   * and before the view and content children are checked.
   * @param changes - changed properties.
   */
  ngOnChanges(changes: SimpleChanges): void {
    if (changes['loincCodes']) {
      this.loadUnits();
    }
  }

  /**
   * Performs a cleanup when a component instance is destroyed.
   */
  ngOnDestroy(): void {
    this.stateChanges.complete();
    this.destroyAutocomplete();
  }

  /**
   * Sets the select's value. Part of the ControlValueAccessor interface
   * required to integrate with Angular's core forms API.
   *
   * @param value New value to be written to the model.
   */
  writeValue(value: string | null): void {
    this.currentData = value || '';
    if (this.input) {
      this.input.nativeElement.value = this.currentData;
    }
  }

  /**
   * Initialize the autocomplete-lhc
   * Cannot be done in ngOnInit because the DOM elements that autocomplete-lhc depends on are
   * not ready yet on ngOnInit
   */
  ngAfterViewInit(): void {
    // Fill autocomplete with data (if currentData was set in writeValue
    // at the moment when input field was not created).
    this.input.nativeElement.value = this.currentData;
    this.setupAutocomplete();
  }

  /**
   * Set up the autocompleter
   */
  setupAutocomplete(): void {
    const testInputId = this.inputId;

    this.destroyAutocomplete();

    const units = this.loincCodes.reduce<string[]>(
      (arr, c) =>
        arr.concat(ObservationTestValueUnitComponent.code2units[c] || []),
      []
    );
    const uniqueFilteredUnits = [...new Set(units)].sort();

    if (uniqueFilteredUnits.length > 0) {
      this.acInstance = new Def.Autocompleter.Prefetch(
        testInputId,
        uniqueFilteredUnits,
        {
          codes: uniqueFilteredUnits
        }
      );

      this.listSelectionsObserver = (eventData) => {
        this.currentData = eventData.final_val;
        this.onChange(this.value);
      };
      Def.Autocompleter.Event.observeListSelections(
        testInputId,
        this.listSelectionsObserver
      );
    } else {
      // In case of no auto-complete list, listen to input change to update parent form control.
      this.input.nativeElement.addEventListener('change', (e) => {
        this.currentData = (e.target as HTMLInputElement).value;
        this.onChange(this.value);
      });
    }
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
   * Load the list of units from CTSS
   */
  loadUnits(): void {
    const unloadedCodes = this.loincCodes.filter(
      (c) => !ObservationTestValueUnitComponent.code2units[c]
    );

    if (unloadedCodes.length) {
      this.numberOfActiveQueries++;
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
            this.numberOfActiveQueries--;
            throw error;
          })
        )
        .subscribe((res: Array<any>) => {
          this.numberOfActiveQueries--;
          const [, codes, extraFields] = res;
          codes.forEach((code, i) => {
            ObservationTestValueUnitComponent.code2units[code] =
              extraFields?.units[i]?.map((item) => item.unit) || [];
          });
          if (this.numberOfActiveQueries === 0) {
            this.setupAutocomplete();
          }
        });
    } else {
      // If the input element is not created at this point,
      // setupAutocomplete will execute in ngAfterViewInit
      if (this.input) {
        this.setupAutocomplete();
      }
    }
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
