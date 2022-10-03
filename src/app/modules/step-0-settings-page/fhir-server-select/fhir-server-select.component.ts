/**
 * This file contains a component for typing the base URL of a FHIR server
 * or selecting a base URL from a predefined list of servers.
 */
import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  Input,
  OnDestroy,
  Optional,
  Self,
  ViewChild
} from '@angular/core';
import { MatFormFieldControl } from '@angular/material/form-field';
import { BaseControlValueAccessor } from '../../base-control-value-accessor';
import { AbstractControl, NgControl } from '@angular/forms';
import { Subject } from 'rxjs';
import Def from 'autocomplete-lhc';
import { FhirBackendService } from '../../../shared/fhir-backend/fhir-backend.service';

@Component({
  selector: 'app-fhir-server-select',
  templateUrl: './fhir-server-select.component.html',
  styleUrls: ['./fhir-server-select.component.less'],
  providers: [
    {
      provide: MatFormFieldControl,
      useExisting: FhirServerSelectComponent
    }
  ]
})
export class FhirServerSelectComponent
  extends BaseControlValueAccessor<string>
  implements AfterViewInit, OnDestroy, MatFormFieldControl<string> {
  inputId = 'serverBaseUrl';

  options = [
    {
      description: 'FHIR Tools project FHIR server (fake data)',
      url: 'https://lforms-fhir.nlm.nih.gov/baseR4'
    },
    {
      description: 'dbGap (https://dbgap-api.ncbi.nlm.nih.gov/fhir/x1)',
      url: 'https://dbgap-api.ncbi.nlm.nih.gov/fhir/x1'
    },
    {
      description: 'https://r4.smarthealthit.org Provider Standalone Launch',
      url:
        'https://launch.smarthealthit.org/v/r4/sim/eyJoIjoiMSIsImoiOiIxIn0/fhir'
    }
  ];

  @Input() placeholder = '';

  // Autocompleter instance
  acInstance: Def.Autocompleter.Prefetch;
  // Callback to handle changes
  listSelectionsObserver: (eventData: any) => void;
  // Reference to the <input> element
  @ViewChild('input') input: ElementRef<HTMLInputElement>;
  // Flag to prevent 'focusin' callback in case of the SMART on FHIR checkbox,
  // click, which would otherwise cause hide the checkbox after unchecking it.
  preventFocusFlag = false;

  currentValue = '';
  get value(): string {
    return this.currentValue;
  }

  /**
   * Whether the control is empty (Implemented as part of MatFormFieldControl)
   */
  get empty(): boolean {
    return !this.value.length;
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
    return this.ngControl?.control.invalid;
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
   * These properties currently unused but required by MatFormFieldControl:
   */
  readonly disabled: boolean = false;
  readonly id: string;

  setDescribedByIds(): void {}

  /**
   * Handles focusin event to maintain the focused state.
   */
  @HostListener('focusin')
  onFocusin(): void {
    if (!this.preventFocusFlag && !this.focused) {
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
      // When the component loses focus, we cannot wait for the notifyObservers
      // function from autocomplete-lhc to call our listener for observe list
      // selection, we must update the value immediately to validate it and
      // properly handle a click on another UI element if validation depends.
      this.updateCurrentValue();
      this.stateChanges.next();
    }
  }

  /**
   * Handles a click on the control's container to maintain the focused state.
   */
  onContainerClick(event: MouseEvent): void {
    // Do not focus serviceBaseUrl input if SMART on FHIR checkbox is being clicked.
    if (
      document.getElementById('smartOnFhir')?.contains(event.target as Node)
    ) {
      this.preventFocusFlag = true;
      // Set the flag back in next Macrotask queue.
      setTimeout(() => {
        this.preventFocusFlag = false;
      }, 0);
      return;
    }
    if (!this.focused) {
      this.input.nativeElement.focus();
    }
  }

  constructor(
    @Optional() @Self() public ngControl: NgControl,
    private elementRef: ElementRef,
    public fhirBackend: FhirBackendService
  ) {
    super();
    if (ngControl != null) {
      // Setting the value accessor directly (instead of using
      // the providers) to avoid running into a circular import.
      ngControl.valueAccessor = this;
    }
  }

  /**
   * Initializes the autocomplete-lhc after creating input field
   * that autocomplete-lhc depends on
   */
  ngAfterViewInit(): void {
    this.setupAutocomplete();
  }

  /**
   * Clean up the autocompleter instance
   */
  ngOnDestroy(): void {
    this.stateChanges.complete();
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
   * Set up Autocompleter prefetch options and adds a selection event listener.
   */
  setupAutocomplete(): void {
    const testInputId = this.inputId;
    this.acInstance = new Def.Autocompleter.Prefetch(
      testInputId,
      this.options.map((o) => o.description),
      { codes: this.options.map((o) => o.url) }
    );
    this.acInstance.setFieldVal(this.currentValue);
    this.listSelectionsObserver = (eventData) => {
      if (eventData.item_code) {
        this.acInstance.setFieldVal(eventData.item_code);
      } else {
        this.updateCurrentValue();
      }
    };
    Def.Autocompleter.Event.observeListSelections(
      testInputId,
      this.listSelectionsObserver
    );
  }

  /**
   * Calls this.onChange() of ControlValueAccessor interface,
   * so that form control value is updated and can be read from parent form.
   */
  updateCurrentValue(): void {
    const inputFieldValue = this.input.nativeElement.value;
    if (this.currentValue !== inputFieldValue) {
      this.currentValue = inputFieldValue;
      this.onChange(this.value);
    }
  }

  /**
   * Updates the control value from outside.
   * Part of the ControlValueAccessor interface.
   */
  writeValue(value: string): void {
    this.currentValue = value;
    if (this.acInstance) {
      this.acInstance.setFieldVal(value);
    }
  }
}
