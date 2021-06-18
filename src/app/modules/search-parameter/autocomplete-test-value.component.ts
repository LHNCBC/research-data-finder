import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  Input,
  OnChanges,
  Optional,
  Self,
  ViewChild
} from '@angular/core';
import { NgControl } from '@angular/forms';
import { BaseControlValueAccessor } from '../base-control-value-accessor';
import Def from 'autocomplete-lhc';
import { MatFormFieldControl } from '@angular/material/form-field';
import { Subject } from 'rxjs';

/**
 * data type used for this control
 */
export interface Lookup {
  code: string;
  display: string;
}

/**
 * Component for from/to date inputs combined together as one control
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
  extends BaseControlValueAccessor<string[]>
  implements OnChanges, AfterViewInit, MatFormFieldControl<string[]> {
  static idPrefix = 'autocomplete-test-value-';
  static idIndex = 0;
  inputId =
    AutoCompleteTestValueComponent.idPrefix +
    ++AutoCompleteTestValueComponent.idIndex;
  @Input() options: Lookup[];
  @Input() placeholder = '';

  currentData: string[] = [];
  ngControl: NgControl = null;
  // Autocompleter instance
  acInstance: Def.Autocompleter.Prefetch;
  // Reference to the <input> element
  @ViewChild('input') input: ElementRef<HTMLInputElement>;

  get value(): string[] {
    return this.currentData;
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
   * These properties currently unused but required by MatFormFieldControl:
   */
  readonly disabled: boolean = false;
  readonly id: string;
  readonly required = false;
  readonly errorState = false;
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
    private elementRef: ElementRef
  ) {
    super();
    if (ngControl != null) {
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
   * Set up Autocompleter prefetch options.
   * Also call this.onChange() of ControlValueAccessor interface on selection event,
   * so that form control value is updated and can be read from parent form.
   */
  setupAutocomplete(): void {
    const testInputId = this.inputId;
    this.acInstance = new Def.Autocompleter.Prefetch(
      testInputId,
      this.options.map((o) => o.display),
      { maxSelect: '*', codes: this.options.map((o) => o.code) }
    );

    // Fill autocomplete with data (if currentData was set in writeValue).
    if (this.currentData) {
      this.currentData.forEach((code) => {
        const item = this.options.find((o) => o.code === code)?.display;
        if (item) {
          this.acInstance.storeSelectedItem(item, code);
          this.acInstance.addToSelectedArea(item);
        }
      });
    }

    Def.Autocompleter.Event.observeListSelections(testInputId, () => {
      this.currentData = this.acInstance.getSelectedCodes() || [];
      this.onChange(this.value);
    });
  }

  /**
   * Part of the ControlValueAccessor interface
   */
  writeValue(value: string[]): void {
    this.currentData = value;
  }
}
