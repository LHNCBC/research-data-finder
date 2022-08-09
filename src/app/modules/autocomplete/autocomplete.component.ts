import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  Input,
  Optional,
  Self,
  ViewChild
} from '@angular/core';
import { BaseControlValueAccessor } from '../base-control-value-accessor';
import { ErrorStateMatcher } from '@angular/material/core';
import { FormControl, NgControl } from '@angular/forms';
import { Observable, ReplaySubject, Subject } from 'rxjs';
import { MatFormFieldControl } from '@angular/material/form-field';
import Def from 'autocomplete-lhc';

/**
 * Autocomplete option can have display name, value and description.
 * In simple cases, when the name is equal to the value and there is no
 * description, it can be a string or only have a name property.
 */
export type AutocompleteOption =
  | {
      name: string;
      value?: string;
      desc?: string;
    }
  | string;

/**
 * Component for selecting values from a list of options using autocomplete-lhc.
 */
@Component({
  selector: 'app-autocomplete',
  templateUrl: './autocomplete.component.html',
  styleUrls: ['./autocomplete.component.less'],
  providers: [
    {
      provide: MatFormFieldControl,
      useExisting: AutocompleteComponent
    }
  ]
})
export class AutocompleteComponent
  extends BaseControlValueAccessor<string>
  implements AfterViewInit, MatFormFieldControl<string> {
  get value(): string {
    return this.currentData;
  }

  /**
   * Whether the control is empty (Implemented as part of MatFormFieldControl)
   */
  get empty(): boolean {
    return !this.currentData;
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
      this.inputField?.nativeElement.className.indexOf('invalid') >= 0 ||
      (formControl && this.errorStateMatcher.isErrorState(formControl, null))
    );
  }

  constructor(
    @Optional() @Self() ngControl: NgControl,
    private errorStateMatcher: ErrorStateMatcher,
    private elementRef: ElementRef
  ) {
    super();
    if (ngControl != null) {
      this.ngControl = ngControl;
      // Setting the value accessor directly (instead of using
      // the providers) to avoid running into a circular import.
      ngControl.valueAccessor = this;
    }
  }

  static idPrefix = 'autocomplete-';
  static idIndex = 0;
  @Input() options: AutocompleteOption[] = [];
  @Input() placeholder = '';

  ngControl: NgControl = null;
  // Autocompleter instance
  acInstance: any;
  inputId = AutocompleteComponent.idPrefix + ++AutocompleteComponent.idIndex;
  currentData = '';
  // Reference to the <input> element
  @ViewChild('input') inputField: ElementRef<HTMLInputElement>;

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
  readonly required = true;

  /**
   * Returns the option value for the data model
   */
  static getOptionValue(option: AutocompleteOption): string {
    return option instanceof Object ? option?.value || option?.name : option;
  }

  /**
   * Returns the textual representation of the option for the input field
   */
  static getOptionText(option: AutocompleteOption): string {
    return option instanceof Object ? option?.name : option;
  }

  /**
   * Returns the HTML formatted representation of the option description for the input field
   */
  static getOptionDesc(option: AutocompleteOption): string {
    return option instanceof Object && option.desc
      ? ` <span style="color: rgba(0, 0, 0, 0.38);">(${option?.desc})</span>`
      : '';
  }

  setDescribedByIds(): void {}

  ngAfterViewInit(): void {
    this.setUpAutocomplete();
  }

  /**
   * Set up Autocomplete prefetch options.
   */
  setUpAutocomplete(): void {
    this.acInstance = new Def.Autocompleter.Prefetch(
      this.inputId,
      this.options.map((o) => AutocompleteComponent.getOptionText(o)),
      {
        codes: this.options.map((o) => AutocompleteComponent.getOptionValue(o)),
        matchListValue: true,
        formattedListItems: this.options.map((o) =>
          AutocompleteComponent.getOptionDesc(o)
        )
      }
    );
    this.acInstance.setFieldToListValue(this.currentData);
    Def.Autocompleter.Event.observeListSelections(
      this.inputId,
      ({ final_val, on_list }) => {
        if (on_list) {
          this.currentData = final_val;
          this.onChange(final_val);
        }
      }
    );
  }

  /**
   * Part of the ControlValueAccessor interface
   * required to integrate with Angular's core forms API.
   * @param value New value to be written to the model.
   */
  writeValue(value: string): void {
    this.currentData = value || '';
  }

  /**
   * Focuses in the input field.
   */
  focus(): void {
    this.inputField.nativeElement.focus();
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
}
