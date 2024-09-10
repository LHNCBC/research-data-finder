import {
  AfterViewInit, Component, ElementRef, HostListener, Input, OnChanges,
  OnDestroy, Optional, Self, SimpleChanges, ViewChild
} from '@angular/core';
import { BaseControlValueAccessor } from '../base-control-value-accessor';
import { ErrorStateMatcher } from '@angular/material/core';
import { AbstractControl, NgControl, UntypedFormControl } from '@angular/forms';
import { Subject } from 'rxjs';
import { MatFormFieldControl } from '@angular/material/form-field';
import Def from 'autocomplete-lhc';
import { find } from 'lodash-es';
import { AutocompleteOption } from '../../types/autocompleteOption';

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
  implements AfterViewInit, MatFormFieldControl<string>, OnDestroy, OnChanges {
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

  // The current error state is used to check if it has changed.
  currentErrorState = false;

  /**
   * Whether the control is in an error state (Implemented as part of MatFormFieldControl)
   */
  get errorState(): boolean {
    const formControl = this.ngControl?.control as UntypedFormControl;
    if (formControl) {
      const newErrorState = (
        this.inputField?.nativeElement.className.indexOf('invalid') >= 0 ||
        (this.errorStateMatcher.isErrorState(formControl, null))
      );
      if (this.currentErrorState !== newErrorState) {
        this.currentErrorState = newErrorState;
        setTimeout(() => this.stateChanges.next());
      }
    }
    return this.currentErrorState;
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
  @Input() isRecordType = false;
  @Input() matchListValue = true;

  ngControl: NgControl = null;
  // Autocompleter instance
  acInstance: any;
  // Callback to handle changes
  listSelectionsObserver: (eventData: any) => void;
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
    this.setupAutocomplete();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.acInstance && changes['options']) {
      this.setupAutocomplete();
    }
  }
  /**
   * Performs cleanup when a component instance is destroyed.
   */
  ngOnDestroy(): void {
    this.destroyAutocomplete();
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
   * Updates the text in the input field.
   */
  updateInputFieldText(): void {
    const option = find(this.options, { value: this.currentData });
    this.acInstance.setFieldToListValue(
      option instanceof Object ? option.name : this.currentData
    );
  }

  /**
   * Set up Autocomplete prefetch options.
   */
  setupAutocomplete(): void {
    this.destroyAutocomplete();
    this.acInstance = new Def.Autocompleter.Prefetch(
      this.inputId,
      this.options.map((o) => AutocompleteComponent.getOptionText(o)),
      {
        codes: this.options.map((o) => AutocompleteComponent.getOptionValue(o)),
        matchListValue: this.matchListValue,
        formattedListItems: this.options.map((o) =>
          AutocompleteComponent.getOptionDesc(o)
        )
      }
    );
    this.updateInputFieldText();
    this.listSelectionsObserver = (eventData) => {
      const { final_val, on_list, item_code } = eventData;
      if (!final_val || on_list || !this.matchListValue) {
        const oldData = this.currentData;
        this.currentData = item_code || final_val;
        if (this.currentData !== oldData) {
          this.onChange(this.currentData);
        }
      }
    };
    Def.Autocompleter.Event.observeListSelections(
      this.inputId,
      this.listSelectionsObserver
    );
  }

  /**
   * Part of the ControlValueAccessor interface
   * required to integrate with Angular's core forms API.
   * @param value New value to be written to the model.
   */
  writeValue(value: string): void {
    this.currentData = value || '';
    if (this.acInstance) {
      this.updateInputFieldText();
    }
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
